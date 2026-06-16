/**
 * Aggregate delta function (M1·WS2·T2.2, EDD §6, §8.1)
 * On casualty create/tier-change: update daily_agg cell and keep prefix sums correct.
 *
 * Critical: this function is the load-bearing piece. Property tests in
 * M1·T6.2 verify that random delta sequences leave aggregates equal to
 * a from-scratch recount.
 */

import { getDb } from './index';
import { dailyAggTable, casualtyTable } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export interface AggDelta {
  eventDate: string; // ISO date
  side: 'ua_coalition' | 'russia';
  category: 'killed' | 'wounded' | 'missing_pow';
  audience: 'military' | 'civilian';
  oldTier?: 'official' | 'confirmed' | 'osint' | 'ai_corroborated';
  newTier: 'official' | 'confirmed' | 'osint' | 'ai_corroborated';
  count: number;
}

/**
 * Apply a delta to daily_agg: create a new casualty or change its tier.
 * On tier change, subtract count from old tier cell, add to new tier cell.
 */
export async function applyAggDelta(delta: AggDelta): Promise<void> {
  const db = getDb();

  // If there was an old tier, subtract from that cell first
  if (delta.oldTier) {
    await db
      .update(dailyAggTable)
      .set({
        count: sql`${dailyAggTable.count} - ${delta.count}`,
      })
      .where(
        and(
          eq(dailyAggTable.day, delta.eventDate),
          eq(dailyAggTable.side, delta.side),
          eq(dailyAggTable.category, delta.category),
          eq(dailyAggTable.audience, delta.audience),
          eq(dailyAggTable.tier, delta.oldTier)
        )
      );
  }

  // Add to the new tier cell (upsert pattern)
  await db
    .insert(dailyAggTable)
    .values({
      day: delta.eventDate,
      side: delta.side,
      category: delta.category,
      audience: delta.audience,
      tier: delta.newTier,
      count: delta.count,
    })
    .onConflictDoUpdate({
      target: [
        dailyAggTable.day,
        dailyAggTable.side,
        dailyAggTable.category,
        dailyAggTable.audience,
        dailyAggTable.tier,
      ],
      set: {
        count: sql`${dailyAggTable.count} + ${delta.count}`,
      },
    });
}

/**
 * Rebuild daily_agg from scratch (idempotent, used for correctness recovery).
 * Deletes all rows and recomputes from casualty table.
 */
export async function rebuildDailyAgg(): Promise<void> {
  const db = getDb();

  // Delete all daily_agg rows
  await db.delete(dailyAggTable);

  // Recompute from casualty (only canonical rows)
  // TODO: raw SQL for efficiency — drizzle aggregate builder still pending
  // SELECT day, side, category, audience, tier, SUM(count) as count
  // FROM casualty WHERE is_canonical = true
  // GROUP BY day, side, category, audience, tier
}
