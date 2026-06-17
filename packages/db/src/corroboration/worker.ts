/**
 * Corroboration worker state machine (M3·WS3, EDD §8.1).
 * Stateless across cron ticks; all progress persisted in DB. corro_status:
 *   pending → scoring → (done | escalating → done | unverified)
 *
 * Tick B: claim pending → budget gate → prefilter candidates → submit Haiku batch.
 * Tick C: poll submitted batches → parse → ladder → writeOutcome | enqueue Opus.
 * Tick D: gated Opus adjudication under the daily cap.
 *
 * Idempotent & resumable: items are claimed with FOR UPDATE SKIP LOCKED; a
 * crashed tick leaves a corro_batch row that the next tick resumes; re-delivered
 * results for a `done` item are no-ops.
 */

import { getDb } from '../index';
import { evidenceTable, carroBatchTable } from '../../schema';
import { sql, eq, inArray } from 'drizzle-orm';
import { retrieveCandidates, findDedupTarget } from '../candidates';
import { computeTally, applyThresholds } from '../scoring';
import { writeOutcome } from '../write-outcome';
import { checkBudget, opusCapReached } from './budget';
import {
  submitHaikuBatch,
  submitOpusBatch,
  pollBatch,
  fetchResults,
  type ScoringItem,
} from './batch';
import { TIER_THRESHOLDS } from '../tiering.config';
import { DEFAULT_THEATER, type TheaterSlug } from '../theater.config';
import { Side, Category, Audience, Tier } from '@peaceclock/api-types';

const CLAIM_LIMIT = 50;

/**
 * T4.1 — could Opus plausibly push this item to/over the default headline
 * threshold (Official+Confirmed)? Only those are worth a 5× call. Gray-band AI
 * items with real corroboration qualify; pure low-confidence map-only items do
 * not. OSINT_PROXIMITY is a tunable v1 value.
 */
const OSINT_PROXIMITY = 0.7;
export function couldCrossHeadline(top: number, flags: { nearDup: boolean; crossSide: boolean; contradiction: boolean }): boolean {
  return top >= OSINT_PROXIMITY || flags.nearDup || flags.crossSide || flags.contradiction;
}

/** Parse the stored evidence payload into the casualty facets the worker needs. */
interface EvidenceFacets {
  theater: TheaterSlug;
  side: Side;
  category: Category;
  audience: Audience;
  eventDate: string;
  text: string;
}
function facetsFromRaw(raw: string, publishedAt: string | null): EvidenceFacets {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(raw); } catch { /* raw is plain text */ }
  return {
    theater: DEFAULT_THEATER,
    side: (p.side as Side) ?? Side.RUSSIA,
    category: (p.category as Category) ?? Category.KILLED,
    audience: (p.audience as Audience) ?? Audience.MILITARY,
    eventDate: (p.eventDate as string) ?? publishedAt ?? new Date().toISOString().slice(0, 10),
    text: (p.text as string) ?? raw,
  };
}

// ── Tick B — claim, budget-gate, prefilter, submit Haiku batch ───────────────

export async function tickSubmit(): Promise<{ submitted: number; batchId?: string; degraded: number }> {
  const db = getDb();

  // Claim pending items atomically (no double-claim across concurrent ticks).
  const claimed = await db.execute(sql`
    UPDATE evidence SET corro_status = 'scoring'
    WHERE id IN (
      SELECT id FROM evidence WHERE corro_status = 'pending'
      ORDER BY ingested_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${CLAIM_LIMIT}
    )
    RETURNING id, raw, published_at, embedding
  `);
  const rows = claimed as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) return { submitted: 0, degraded: 0 };

  // Budget gate (T6.1): over cap → degrade claimed items to unverified, no call.
  const budget = await checkBudget();
  if (budget.overCap) {
    const ids = rows.map((r) => String(r.id));
    await db.update(evidenceTable).set({ corroStatus: 'unverified' }).where(inArray(evidenceTable.id, ids));
    console.warn(`[worker] budget cap reached ($${budget.usd}/$${budget.capUsd}) — ${ids.length} items degraded to unverified`);
    return { submitted: 0, degraded: ids.length };
  }

  // Prefilter candidates per item.
  const items: ScoringItem[] = [];
  for (const r of rows) {
    const id = String(r.id);
    const embedding = (r.embedding as number[] | null) ?? null;
    if (!embedding) continue;
    const facets = facetsFromRaw(String(r.raw ?? ''), (r.published_at as string) ?? null);
    const th = (r.theater as TheaterSlug) ?? DEFAULT_THEATER;
    const candidates = await retrieveCandidates(id, embedding, undefined, undefined, th);
    items.push({ evidenceId: id, newPost: facets.text, candidates });
  }
  if (items.length === 0) return { submitted: 0, degraded: 0 };

  const batchId = await submitHaikuBatch(items);
  await db.insert(carroBatchTable).values({
    providerId: batchId,
    stage: 'haiku',
    status: 'submitted',
    evidenceIds: JSON.stringify(items.map((i) => i.evidenceId)),
  });

  return { submitted: items.length, batchId, degraded: 0 };
}

// ── Tick C — poll submitted Haiku batches, apply ladder, write outcomes ──────

export async function tickProcess(): Promise<{ processed: number; escalated: number }> {
  const db = getDb();
  const batches = await db.select().from(carroBatchTable).where(
    sql`${carroBatchTable.stage} = 'haiku' AND ${carroBatchTable.status} = 'submitted'`,
  );

  let processed = 0;
  let escalated = 0;

  for (const batch of batches) {
    const status = await pollBatch(batch.providerId);
    if (status !== 'ended') continue;

    const results = await fetchResults(batch.providerId, 'claude-haiku-4-5' as any);
    for (const res of results) {
      const facets = await loadFacets(res.evidenceId);
      if (!res.assessment) {
        await db.update(evidenceTable).set({ corroStatus: 'unverified' }).where(eq(evidenceTable.id, res.evidenceId));
        continue;
      }

      const tally = computeTally(res.assessment.candidates);
      const candidates = await retrieveCandidates(
        res.evidenceId, [], undefined, undefined, facets.theater,
      );
      const dedup = findDedupTarget(candidates);
      const decision = applyThresholds({
        top: tally.top, c: tally.c, k: tally.k,
        dedup: dedup ? { s: dedup.sim, isCountedCanonical: true, targetCasualtyId: dedup.casualtyId } : undefined,
      });

      const gateOk = couldCrossHeadline(tally.top, decision.escalationFlags);
      if (decision.escalate && gateOk) {
        await db.update(evidenceTable).set({ corroStatus: 'escalating' }).where(eq(evidenceTable.id, res.evidenceId));
        escalated += 1;
        continue;
      }

      await finalize(res.evidenceId, facets, decision, tally.top, res.assessment.geo, res.costUsd, 'ai_haiku');
      processed += 1;
    }

    await db.update(carroBatchTable).set({ status: 'processed', endedAt: new Date() }).where(eq(carroBatchTable.id, batch.id));
  }

  return { processed, escalated };
}

// ── Tick D — gated Opus adjudication ─────────────────────────────────────────

export async function tickOpus(): Promise<{ adjudicated: number; capped: boolean }> {
  const db = getDb();
  if (await opusCapReached()) return { adjudicated: 0, capped: true };

  const escalating = await db.select().from(evidenceTable).where(eq(evidenceTable.corroStatus, 'escalating')).limit(CLAIM_LIMIT);
  if (escalating.length === 0) return { adjudicated: 0, capped: false };

  const items: ScoringItem[] = [];
  for (const e of escalating) {
    const th = (e.theater as TheaterSlug) ?? DEFAULT_THEATER;
    const candidates = await retrieveCandidates(
      e.id, (e.embedding as number[] | null) ?? [], undefined, undefined, th,
    );
    const facets = facetsFromRaw(e.raw ?? '', e.publishedAt ?? null);
    items.push({ evidenceId: e.id, newPost: facets.text, candidates });
  }

  const batchId = await submitOpusBatch(items);
  await db.insert(carroBatchTable).values({
    providerId: batchId, stage: 'opus', status: 'submitted',
    evidenceIds: JSON.stringify(items.map((i) => i.evidenceId)),
  });
  return { adjudicated: items.length, capped: false };
}

/** Poll + finalize Opus batches (final tier, audit actor=ai_opus). */
export async function tickOpusProcess(): Promise<{ finalized: number }> {
  const db = getDb();
  const batches = await db.select().from(carroBatchTable).where(
    sql`${carroBatchTable.stage} = 'opus' AND ${carroBatchTable.status} = 'submitted'`,
  );
  let finalized = 0;
  for (const batch of batches) {
    if ((await pollBatch(batch.providerId)) !== 'ended') continue;
    const results = await fetchResults(batch.providerId, 'claude-opus-4-8' as any);
    for (const res of results) {
      const facets = await loadFacets(res.evidenceId);
      if (!res.assessment) {
        await db.update(evidenceTable).set({ corroStatus: 'unverified' }).where(eq(evidenceTable.id, res.evidenceId));
        continue;
      }
      const tally = computeTally(res.assessment.candidates);
      const decision = applyThresholds({ top: tally.top, c: tally.c, k: tally.k });
      await finalize(res.evidenceId, facets, decision, tally.top, res.assessment.geo, res.costUsd, 'ai_opus');
      finalized += 1;
    }
    await db.update(carroBatchTable).set({ status: 'processed', endedAt: new Date() }).where(eq(carroBatchTable.id, batch.id));
  }
  return { finalized };
}

// ── shared finalize ──────────────────────────────────────────────────────────

async function loadFacets(evidenceId: string): Promise<EvidenceFacets> {
  const db = getDb();
  const [e] = await db.select().from(evidenceTable).where(eq(evidenceTable.id, evidenceId)).limit(1);
  const base = facetsFromRaw(e?.raw ?? '', e?.publishedAt ?? null);
  return { ...base, theater: (e?.theater as TheaterSlug) ?? DEFAULT_THEATER };
}

async function finalize(
  evidenceId: string,
  facets: EvidenceFacets,
  decision: ReturnType<typeof applyThresholds>,
  top: number,
  geo: { lat: number; lng: number; confidence: number } | null,
  costUsd: number,
  actor: 'ai_haiku' | 'ai_opus',
): Promise<void> {
  const db = getDb();

  if (decision.action === 'merge' && decision.dedupTargetId) {
    await writeOutcome({
      kind: 'merge', evidenceId, targetCasualtyId: decision.dedupTargetId,
      geo: geo ?? undefined, actor, reason: 'dedup merge (s ≥ 0.90 vs counted)', costUsd,
    });
  } else if (decision.action === 'count' && decision.tier) {
    await writeOutcome({
      kind: 'create', evidenceId, theater: facets.theater,
      side: facets.side, category: facets.category, audience: facets.audience, eventDate: facets.eventDate,
      tier: decision.tier as Tier, count: 1, matchScore: top, geo: geo ?? undefined,
      actor, reason: `auto-tier ${decision.tier} (s=${top.toFixed(2)})`, costUsd,
    });
  } else {
    // unverified: record cost only, leave uncounted for human triage.
    await db.update(evidenceTable).set({ corroStatus: 'unverified' }).where(eq(evidenceTable.id, evidenceId));
    return;
  }

  await db.update(evidenceTable).set({ corroStatus: 'done' }).where(eq(evidenceTable.id, evidenceId));
}

/** One full cron tick: advance every ready stage. Cron entrypoint (T3.1). */
export async function runTick(): Promise<void> {
  await tickSubmit();
  await tickProcess();
  await tickOpus();
  await tickOpusProcess();
}
