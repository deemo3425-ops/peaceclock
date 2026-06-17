/**
 * Budget guardrail (M3·WS6·T6.1, PRD §12). Month-to-date spend vs cap gates
 * every batch; over cap → items degrade to `unverified` with NO model call.
 * Opus has an additional daily cap (EDD §8.1 Tick D).
 */

import { getDb } from '../index';
import { spendMeter } from '../../schema/spend-meter';
import { auditLogTable } from '../../schema';
import { sql, eq } from 'drizzle-orm';
import { BUDGET_CAP_USD, OPUS_DAILY_CAP_USD } from '../tiering.config';

function monthStart(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export interface BudgetStatus {
  usd: number;
  capUsd: number;
  overCap: boolean;
}

/** Month-to-date spend vs cap. Missing row ⇒ 0 spent against the default cap. */
export async function checkBudget(): Promise<BudgetStatus> {
  const db = getDb();
  const [row] = await db.select().from(spendMeter).where(eq(spendMeter.month, monthStart())).limit(1);
  const usd = row ? Number(row.usd) : 0;
  const capUsd = row && Number(row.capUsd) > 0 ? Number(row.capUsd) : BUDGET_CAP_USD;
  return { usd, capUsd, overCap: usd >= capUsd };
}

/** Sum today's Opus spend from audit_log (actor='ai_opus'). */
export async function opusSpentToday(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${auditLogTable.modelCostUsd}), 0)` })
    .from(auditLogTable)
    .where(sql`${auditLogTable.actor} = 'ai_opus' AND ${auditLogTable.at}::date = current_date`);
  return Number(row?.total ?? 0);
}

/** True if another Opus batch of ~estimatedUsd would breach the daily cap. */
export async function opusCapReached(estimatedUsd = 0): Promise<boolean> {
  const spent = await opusSpentToday();
  return spent + estimatedUsd >= OPUS_DAILY_CAP_USD;
}
