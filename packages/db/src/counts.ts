/**
 * Counts data access (M2·WS1·T1.1, EDD §6/§9.1).
 * Reads daily_agg ONLY (no casualty scan) plus per-side freshness.
 * Returns raw rows; payload shaping lives in @peaceclock/count-engine
 * (buildCountsResponse) so the transform is shared + DB-free testable.
 */

import { getDb } from './index';
import { dailyAggTable, casualtyTable, casualtyEvidenceTable, evidenceTable } from '../schema';
import { and, gte, lte, eq, sql } from 'drizzle-orm';
import { Theater, Side, Category, Audience, Tier } from '@peaceclock/api-types';
import { DEFAULT_THEATER, type TheaterSlug } from './theater.config';

// daily_agg enum columns carry the same string values as the api-types enums;
// cast the drizzle string-literal unions to the shared enums for client reuse.
export interface AggRow {
  day: string;
  theater: Theater;
  side: Side;
  category: Category;
  audience: Audience;
  tier: Tier;
  count: number;
}

export interface SideFreshness {
  side: Side;
  lastUpdated: string; // ISO timestamp
}

/**
 * Fetch daily_agg rows in [from, to] inclusive. Index-only on the
 * composite PK range; no seq scan on casualty (T1.1 acceptance).
 */
export async function queryDailyAgg(
  from: string,
  to: string,
  theater: TheaterSlug = DEFAULT_THEATER,
): Promise<AggRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(dailyAggTable)
    .where(
      and(
        eq(dailyAggTable.theater, theater),
        gte(dailyAggTable.day, from),
        lte(dailyAggTable.day, to),
      ),
    );

  return rows.map((r) => ({
    day: r.day,
    theater: r.theater as Theater,
    side: r.side as Side,
    category: r.category as Category,
    audience: r.audience as Audience,
    tier: r.tier as Tier,
    count: r.count,
  }));
}

/**
 * Per-side freshness = newest evidence.ingested_at for that side (T1.4),
 * via casualty → casualty_evidence → evidence.
 */
export async function querySideFreshness(
  theater: TheaterSlug = DEFAULT_THEATER,
): Promise<SideFreshness[]> {
  const db = getDb();
  const rows = await db
    .select({
      side: casualtyTable.side,
      lastUpdated: sql<string>`max(${evidenceTable.ingestedAt})`,
    })
    .from(casualtyTable)
    .innerJoin(casualtyEvidenceTable, eq(casualtyEvidenceTable.casualtyId, casualtyTable.id))
    .innerJoin(evidenceTable, eq(evidenceTable.id, casualtyEvidenceTable.evidenceId))
    .where(eq(casualtyTable.theater, theater))
    .groupBy(casualtyTable.side);

  return rows
    .filter((r) => r.lastUpdated != null)
    .map((r) => ({
      side: r.side as Side,
      lastUpdated: new Date(r.lastUpdated as string).toISOString(),
    }));
}
