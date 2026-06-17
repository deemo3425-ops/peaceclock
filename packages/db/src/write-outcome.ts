/**
 * Transactional outcome writer (M3·WS5·T5.1/T5.2, EDD §8.1).
 * One DB transaction per decision so a casualty, its evidence link, its geo,
 * its daily_agg delta, its audit row, and the spend increment are ALL present
 * or ALL absent. The worker (WS3) and audit queue (WS7) write only through here.
 */

import { getDb } from './index';
import {
  casualtyTable,
  casualtyEvidenceTable,
  evidenceTable,
  dailyAggTable,
  auditLogTable,
  mapPointTable,
} from '../schema';
import { spendMeter } from '../schema/spend-meter';
import { and, eq, sql } from 'drizzle-orm';
import { toPoint3857Wkt } from '@peaceclock/count-engine';
import { Side, Category, Audience, Tier } from '@peaceclock/api-types';
import { DEFAULT_THEATER, type TheaterSlug } from './theater.config';

type Actor = 'ai_haiku' | 'ai_opus' | 'human';

export interface GeoPin {
  lat: number;
  lng: number;
  confidence: number;
}

export interface CreateOutcome {
  kind: 'create';
  evidenceId: string;
  theater?: TheaterSlug;
  side: Side;
  category: Category;
  audience: Audience;
  eventDate: string;
  tier: Tier;
  count: number;
  dedupGroup?: string;
  matchScore?: number;
  geo?: GeoPin;
  actor: Actor;
  reason: string;
  costUsd: number;
}

export interface MergeOutcome {
  kind: 'merge';
  evidenceId: string;
  targetCasualtyId: string; // existing counted canonical casualty
  geo?: GeoPin;
  actor: Actor;
  reason: string;
  costUsd: number;
}

export type Outcome = CreateOutcome | MergeOutcome;

function monthStart(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Increment the spend meter for the current month (within the open tx). */
async function bumpSpend(tx: any, costUsd: number): Promise<void> {
  if (costUsd <= 0) return;
  await tx
    .insert(spendMeter)
    .values({ month: monthStart(), usd: costUsd.toFixed(4), capUsd: '0.0000' })
    .onConflictDoUpdate({
      target: spendMeter.month,
      set: { usd: sql`${spendMeter.usd} + ${costUsd}` },
    });
}

/** Apply a +count (or −count) delta to a daily_agg cell (within the open tx). */
async function aggDelta(
  tx: any,
  cell: { theater: TheaterSlug; day: string; side: Side; category: Category; audience: Audience; tier: Tier },
  delta: number,
): Promise<void> {
  await tx
    .insert(dailyAggTable)
    .values({ ...cell, count: delta })
    .onConflictDoUpdate({
      target: [
        dailyAggTable.theater,
        dailyAggTable.day,
        dailyAggTable.side,
        dailyAggTable.category,
        dailyAggTable.audience,
        dailyAggTable.tier,
      ],
      set: { count: sql`${dailyAggTable.count} + ${delta}` },
    });
}

/** Set evidence geo + upsert the canonical casualty's map_point (T5.2). */
async function writeGeo(
  tx: any,
  evidenceId: string,
  casualtyId: string,
  cell: { theater: TheaterSlug; side: Side; category: Category; audience: Audience; tier: Tier; eventDate: string },
  geo: GeoPin,
): Promise<void> {
  await tx
    .update(evidenceTable)
    .set({
      geom: `POINT(${geo.lng} ${geo.lat})`,
      geoConfidence: geo.confidence,
      geoStatus: 'ai_auto',
    })
    .where(eq(evidenceTable.id, evidenceId));

  await tx
    .insert(mapPointTable)
    .values({
      casualtyId,
      theater: cell.theater,
      evidenceId,
      side: cell.side,
      category: cell.category,
      audience: cell.audience,
      tier: cell.tier,
      eventDate: cell.eventDate,
      geoConfidence: geo.confidence,
      geom3857: toPoint3857Wkt(geo.lng, geo.lat),
    })
    .onConflictDoUpdate({
      target: mapPointTable.casualtyId,
      set: { evidenceId, geom3857: toPoint3857Wkt(geo.lng, geo.lat), geoConfidence: geo.confidence, tier: cell.tier },
    });
}

/**
 * Persist a worker/audit decision atomically. Returns the casualty id touched
 * (the new one for create, the merge target for merge).
 */
export async function writeOutcome(outcome: Outcome): Promise<string> {
  const db = getDb();

  return db.transaction(async (tx) => {
    if (outcome.kind === 'merge') {
      // Attach as additional evidence — NO new casualty, NO agg delta (§A.3 rule 1).
      await tx
        .insert(casualtyEvidenceTable)
        .values({ casualtyId: outcome.targetCasualtyId, evidenceId: outcome.evidenceId });

      if (outcome.geo) {
        const [c] = await tx.select().from(casualtyTable).where(eq(casualtyTable.id, outcome.targetCasualtyId)).limit(1);
        if (c) {
          await writeGeo(tx, outcome.evidenceId, outcome.targetCasualtyId, {
            theater: (c.theater as TheaterSlug) ?? DEFAULT_THEATER,
            side: c.side as Side, category: c.category as Category, audience: c.audience as Audience,
            tier: c.tier as Tier, eventDate: c.eventDate,
          }, outcome.geo);
        }
      }

      await tx.insert(auditLogTable).values({
        casualtyId: outcome.targetCasualtyId,
        actor: outcome.actor,
        action: 'dedup_merge',
        after: JSON.stringify({ mergedEvidence: outcome.evidenceId }),
        reason: outcome.reason,
        modelCostUsd: outcome.costUsd.toFixed(6),
      });

      await bumpSpend(tx, outcome.costUsd);
      return outcome.targetCasualtyId;
    }

    // create: new counted casualty.
    const theater = outcome.theater ?? DEFAULT_THEATER;
    const [created] = await tx
      .insert(casualtyTable)
      .values({
        theater,
        side: outcome.side,
        category: outcome.category,
        audience: outcome.audience,
        count: outcome.count,
        eventDate: outcome.eventDate,
        tier: outcome.tier,
        status: 'counted',
        dedupGroup: outcome.dedupGroup,
        isCanonical: true,
        matchScore: outcome.matchScore,
      })
      .returning({ id: casualtyTable.id });

    const casualtyId = created.id;

    await tx.insert(casualtyEvidenceTable).values({ casualtyId, evidenceId: outcome.evidenceId });

    await aggDelta(tx, {
      theater, day: outcome.eventDate, side: outcome.side, category: outcome.category,
      audience: outcome.audience, tier: outcome.tier,
    }, outcome.count);

    if (outcome.geo) {
      await writeGeo(tx, outcome.evidenceId, casualtyId, {
        theater, side: outcome.side, category: outcome.category, audience: outcome.audience,
        tier: outcome.tier, eventDate: outcome.eventDate,
      }, outcome.geo);
    }

    await tx.insert(auditLogTable).values({
      casualtyId,
      actor: outcome.actor,
      action: 'tier_assign',
      after: JSON.stringify({ tier: outcome.tier, matchScore: outcome.matchScore }),
      reason: outcome.reason,
      modelCostUsd: outcome.costUsd.toFixed(6),
    });

    await bumpSpend(tx, outcome.costUsd);
    return casualtyId;
  });
}

/**
 * Tier change for audit/Opus (T5.3): −old / +new on daily_agg, atomically,
 * with an audit row. count is read from the casualty.
 */
export async function changeTier(
  casualtyId: string,
  newTier: Tier,
  actor: Actor,
  reason: string,
  costUsd = 0,
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(casualtyTable).where(eq(casualtyTable.id, casualtyId)).limit(1);
    if (!c) throw new Error(`casualty ${casualtyId} not found`);
    const oldTier = c.tier as Tier;
    if (oldTier === newTier) return;

    const n = c.count ?? 1;
    const theater = (c.theater as TheaterSlug) ?? DEFAULT_THEATER;
    const cell = {
      theater, day: c.eventDate, side: c.side as Side, category: c.category as Category,
      audience: c.audience as Audience,
    };
    await aggDelta(tx, { ...cell, tier: oldTier }, -n);
    await aggDelta(tx, { ...cell, tier: newTier }, n);

    await tx.update(casualtyTable).set({ tier: newTier }).where(eq(casualtyTable.id, casualtyId));

    await tx.insert(auditLogTable).values({
      casualtyId,
      actor,
      action: 'tier_change',
      before: JSON.stringify({ tier: oldTier }),
      after: JSON.stringify({ tier: newTier }),
      reason,
      modelCostUsd: costUsd.toFixed(6),
    });
    if (costUsd > 0) await bumpSpend(tx, costUsd);
  });
}
