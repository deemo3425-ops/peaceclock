/**
 * Human audit queue + actions (M3·WS7, PRD §6.4/§8).
 * Lists AI-assigned casualties for review and applies promote/demote/reposition/
 * reject with full audit_log + aggregate correction. Tier changes reuse
 * changeTier (T5.3); reject and reposition are handled here transactionally.
 */

import { getDb } from './index';
import { casualtyTable, evidenceTable, mapPointTable, auditLogTable, dailyAggTable } from '../schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { toPoint3857Wkt } from '@peaceclock/count-engine';
import { Side, Category, Audience, Tier } from '@peaceclock/api-types';

export interface AuditQueueItem {
  casualtyId: string;
  side: Side;
  category: Category;
  audience: Audience;
  eventDate: string;
  tier: Tier;
  count: number;
  matchScore: number | null;
  corroborators: number;
}

/**
 * T7.1 — AI-assigned items awaiting audit, ordered by headline impact
 * (count desc) then recency. Includes a corroborator count for triage.
 */
export async function queryAuditQueue(limit = 100): Promise<AuditQueueItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      casualtyId: casualtyTable.id,
      side: casualtyTable.side,
      category: casualtyTable.category,
      audience: casualtyTable.audience,
      eventDate: casualtyTable.eventDate,
      tier: casualtyTable.tier,
      count: casualtyTable.count,
      matchScore: casualtyTable.matchScore,
      corroborators: sql<number>`(SELECT count(*) FROM casualty_evidence ce WHERE ce.casualty_id = ${casualtyTable.id})`,
    })
    .from(casualtyTable)
    .where(and(eq(casualtyTable.tier, 'ai_corroborated'), eq(casualtyTable.status, 'counted')))
    .orderBy(desc(casualtyTable.count), desc(casualtyTable.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    casualtyId: r.casualtyId,
    side: r.side as Side,
    category: r.category as Category,
    audience: r.audience as Audience,
    eventDate: r.eventDate,
    tier: r.tier as Tier,
    count: r.count ?? 1,
    matchScore: r.matchScore,
    corroborators: Number(r.corroborators),
  }));
}

/** T7.2 — reject: remove the count + its aggregate contribution, log it. */
export async function rejectCasualty(casualtyId: string, reason: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(casualtyTable).where(eq(casualtyTable.id, casualtyId)).limit(1);
    if (!c || c.status === 'rejected') return;
    const n = c.count ?? 1;

    await tx
      .update(dailyAggTable)
      .set({ count: sql`${dailyAggTable.count} - ${n}` })
      .where(
        and(
          eq(dailyAggTable.theater, c.theater),
          eq(dailyAggTable.day, c.eventDate),
          eq(dailyAggTable.side, c.side),
          eq(dailyAggTable.category, c.category),
          eq(dailyAggTable.audience, c.audience),
          eq(dailyAggTable.tier, c.tier),
        ),
      );

    await tx.update(casualtyTable).set({ status: 'rejected' }).where(eq(casualtyTable.id, casualtyId));
    await tx.delete(mapPointTable).where(eq(mapPointTable.casualtyId, casualtyId));

    await tx.insert(auditLogTable).values({
      casualtyId,
      actor: 'human',
      action: 'reject',
      before: JSON.stringify({ tier: c.tier, status: c.status, count: n }),
      after: JSON.stringify({ status: 'rejected' }),
      reason,
    });
  });
}

/** T7.2 — reposition (geo fix): move the casualty's best-geo evidence + map_point. */
export async function repositionCasualty(
  casualtyId: string,
  lat: number,
  lng: number,
  reason: string,
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [mp] = await tx.select().from(mapPointTable).where(eq(mapPointTable.casualtyId, casualtyId)).limit(1);

    await tx
      .update(mapPointTable)
      .set({ geom3857: toPoint3857Wkt(lng, lat) })
      .where(eq(mapPointTable.casualtyId, casualtyId));

    if (mp) {
      await tx
        .update(evidenceTable)
        .set({ geom: `POINT(${lng} ${lat})`, geoStatus: 'audited' })
        .where(eq(evidenceTable.id, mp.evidenceId));
    }

    await tx.insert(auditLogTable).values({
      casualtyId,
      actor: 'human',
      action: 'geo_fix',
      after: JSON.stringify({ lat, lng }),
      reason,
    });
  });
}
