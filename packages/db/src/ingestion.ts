/**
 * Ingestion framework (M1·WS4, EDD §7)
 * Adapter interface, triage, official-tier short-circuit.
 */

import crypto from 'crypto';
import { getDb } from './index';
import {
  evidenceTable,
  casualtyTable,
  casualtyEvidenceTable,
} from '../schema';
import { embed } from './embeddings';
import { applyAggDelta } from './agg-delta';
import { getWatermark, setWatermark } from './watermark';
import { eq, and, sql } from 'drizzle-orm';

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Raw evidence from a source (normalized).
 * T4.1: SourceAdapter.normalize() returns this.
 */
export interface NormalizedEvidence {
  kind: 'official' | 'news' | 'x_post';
  publisher: string;
  url?: string;
  publishedAt?: string; // ISO date
  text: string;
  raw: Record<string, unknown>; // full payload
}

/**
 * Casualty fields carried in evidence.raw for short-circuit ingestion.
 */
export interface CasualtyPayload {
  side: 'ua_coalition' | 'russia';
  category: 'killed' | 'wounded' | 'missing_pow';
  audience: 'military' | 'civilian';
  eventDate: string;
  count: number;
  tier?: 'official' | 'confirmed';
  /** Named-individual dedup key (RU/UA confirmed military). */
  dedupKey?: string;
}

/**
 * SourceAdapter interface (T4.1, EDD §7).
 * Each source (OHCHR, Mediazona, X OSINT) implements this.
 */
export interface SourceAdapter {
  name: string;
  fetchSince(watermark: string): Promise<NormalizedEvidence[]>;
  normalize(raw: unknown): NormalizedEvidence;
}

/**
 * Compute content hash for dedup (T4.2).
 * Deterministic hash of the normalized text.
 */
function computeContentHash(evidence: NormalizedEvidence): string {
  const canonical = JSON.stringify({
    kind: evidence.kind,
    publisher: evidence.publisher,
    text: evidence.text.trim(),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** Deterministic UUID v4-shaped id from a dedup key. */
function dedupKeyToGroup(dedupKey: string): string {
  const hex = crypto.createHash('sha256').update(dedupKey).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parseCasualtyPayload(
  evidence: NormalizedEvidence,
  isOfficial: boolean,
): CasualtyPayload | null {
  const raw = evidence.raw;
  const embedded = raw.casualty as Partial<CasualtyPayload> | undefined;
  if (!embedded?.side || !embedded.category || !embedded.audience || !embedded.eventDate) {
    return null;
  }
  if (typeof embedded.count !== 'number' || embedded.count <= 0) {
    return null;
  }

  const tier =
    embedded.tier ??
    (isOfficial || evidence.kind === 'official' ? 'official' : undefined);
  if (!tier) return null;

  return {
    side: embedded.side,
    category: embedded.category,
    audience: embedded.audience,
    eventDate: embedded.eventDate,
    count: embedded.count,
    tier,
    dedupKey: typeof embedded.dedupKey === 'string' ? embedded.dedupKey : undefined,
  };
}

/**
 * Triage: drop exact/near-duplicate, apply allowlist, filter junk (T4.2).
 * Returns true if evidence should be ingested, false if filtered out.
 */
async function triage(
  evidence: NormalizedEvidence,
  hash: string,
  theater: 'ukraine' = 'ukraine',
): Promise<boolean> {
  const db = getDb();

  // Exact duplicate check per (theater, content_hash) — cross-theater collision allowed
  const existing = await db
    .select()
    .from(evidenceTable)
    .where(and(eq(evidenceTable.theater, theater), eq(evidenceTable.contentHash, hash)))
    .limit(1);

  if (existing.length > 0) {
    console.log('[triage] drop exact duplicate', { theater, hash });
    return false;
  }

  // Source allowlist (all kinds allowed in M1; stricter in M3)
  const allowedPublishers = ['OHCHR', 'Mediazona', 'BBC', 'UALosses'];
  if (!allowedPublishers.includes(evidence.publisher)) {
    console.log('[triage] drop unlisted publisher', { publisher: evidence.publisher });
    return false;
  }

  // Junk filter: minimum text length
  if (evidence.text.trim().length < 20) {
    console.log('[triage] drop low-content', { hash });
    return false;
  }

  return true;
}

/**
 * Mint a casualty row and apply aggregate delta (T4.3 official / T5.2 confirmed).
 */
async function mintShortCircuitCasualty(
  evidenceId: string,
  payload: CasualtyPayload,
): Promise<string | null> {
  const db = getDb();
  const theater = 'ukraine' as const;
  const tier = payload.tier!;

  let dedupGroup: string | undefined;
  if (payload.dedupKey) {
    dedupGroup = dedupKeyToGroup(payload.dedupKey);
    const [existing] = await db
      .select({ id: casualtyTable.id })
      .from(casualtyTable)
      .where(
        and(
          eq(casualtyTable.dedupGroup, dedupGroup),
          eq(casualtyTable.isCanonical, true),
          eq(casualtyTable.status, 'counted'),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .insert(casualtyEvidenceTable)
        .values({ casualtyId: existing.id, evidenceId })
        .onConflictDoNothing({
          target: [casualtyEvidenceTable.casualtyId, casualtyEvidenceTable.evidenceId],
        });
      console.log('[ingest] dedup merge named individual', {
        dedupKey: payload.dedupKey,
        casualtyId: existing.id,
      });
      return existing.id;
    }
  }

  const [created] = await db
    .insert(casualtyTable)
    .values({
      theater,
      side: payload.side,
      category: payload.category,
      audience: payload.audience,
      count: payload.count,
      eventDate: payload.eventDate,
      tier,
      status: 'counted',
      dedupGroup,
      isCanonical: true,
    })
    .returning({ id: casualtyTable.id });

  await db.insert(casualtyEvidenceTable).values({
    casualtyId: created.id,
    evidenceId,
  });

  await applyAggDelta({
    eventDate: payload.eventDate,
    theater,
    side: payload.side,
    category: payload.category,
    audience: payload.audience,
    newTier: tier,
    count: payload.count,
  });

  console.log('[ingest] casualty minted', {
    casualtyId: created.id,
    tier,
    side: payload.side,
    count: payload.count,
    eventDate: payload.eventDate,
  });

  return created.id;
}

/**
 * Ingest evidence: persist, embed, enqueue corroboration (T4.2).
 * Official sources short-circuit to casualty (T4.3).
 */
export async function ingestEvidence(
  evidence: NormalizedEvidence,
  isOfficial: boolean,
): Promise<void> {
  const hash = computeContentHash(evidence);
  const theater = 'ukraine' as const;

  // Triage
  const shouldIngest = await triage(evidence, hash, theater);
  if (!shouldIngest) {
    return;
  }

  const casualtyPayload = parseCasualtyPayload(evidence, isOfficial);
  const shortCircuits = casualtyPayload !== null;

  // Embed
  const { embedding } = await embed(evidence.text);

  // Persist evidence
  const db = getDb();
  const result = await db
    .insert(evidenceTable)
    .values({
      theater,
      kind: evidence.kind,
      publisher: evidence.publisher,
      url: evidence.url,
      publishedAt: evidence.publishedAt,
      raw: JSON.stringify(evidence.raw),
      contentHash: hash,
      embedding: sql`${toVectorLiteral(embedding)}::vector`,
      geom: sql`ST_GeogFromText('POINT(0 0)')`, // placeholder; AI/audit fills in
      corroStatus: shortCircuits ? 'done' : 'pending',
    })
    .returning({ id: evidenceTable.id });

  const evidenceId = result[0]!.id;
  console.log('[ingest] evidence persisted', { evidenceId, hash });

  // Official / confirmed short-circuit: mint casualty immediately (T4.3, T5.2)
  if (casualtyPayload) {
    await mintShortCircuitCasualty(evidenceId, casualtyPayload);
  }
}

export interface AdapterRunResult {
  adapter: string;
  fetched: number;
  watermark: string;
}

/**
 * Run all adapters: fetch since watermark, ingest, advance watermark (T4.1).
 */
export async function runAdapters(adapters: SourceAdapter[]): Promise<AdapterRunResult[]> {
  const results: AdapterRunResult[] = [];

  for (const adapter of adapters) {
    console.log(`[ingest] running adapter: ${adapter.name}`);
    const watermark = await getWatermark(adapter.name);
    let items: NormalizedEvidence[];

    try {
      items = await adapter.fetchSince(watermark);
    } catch (error) {
      console.error(`[ingest] adapter ${adapter.name} fetch failed — watermark not advanced`, error);
      results.push({ adapter: adapter.name, fetched: 0, watermark });
      continue;
    }

    let maxDate = watermark;
    for (const item of items) {
      const isOfficial = item.kind === 'official';
      await ingestEvidence(item, isOfficial);
      if (item.publishedAt && item.publishedAt > maxDate) {
        maxDate = item.publishedAt;
      }
    }

    if (maxDate > watermark) {
      await setWatermark(adapter.name, maxDate);
    }

    results.push({ adapter: adapter.name, fetched: items.length, watermark: maxDate });
    console.log(`[ingest] adapter ${adapter.name} done`, {
      fetched: items.length,
      watermark: maxDate,
    });
  }

  return results;
}