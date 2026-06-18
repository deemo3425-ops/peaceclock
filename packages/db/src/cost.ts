/**
 * Cost tracking helpers (T0.5, EDD §12)
 * Used by M3 corroboration worker to log per-item AI spend.
 */

import { sql } from 'drizzle-orm';
import { getDb } from './index';
import { spendMeter } from '../schema/spend-meter';
import { BUDGET_CAP_USD } from './tiering.config';

export interface CostRecord {
  itemId: string;
  model: 'haiku' | 'opus';
  inputTokens: number;
  outputTokens: number;
  usd: number;
  timestamp: Date;
}

function monthStart(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Record the cost of an AI API call.
 * Increments spend_meter for the month (EDD §8.1 budget guardrail).
 * Per-item audit_log.model_cost_usd is written by writeOutcome for counted items.
 */
export async function recordModelCost(record: CostRecord): Promise<void> {
  if (record.usd <= 0) return;

  const db = getDb();
  const month = monthStart(record.timestamp);

  await db
    .insert(spendMeter)
    .values({
      month,
      usd: record.usd.toFixed(4),
      capUsd: BUDGET_CAP_USD.toFixed(4),
    })
    .onConflictDoUpdate({
      target: spendMeter.month,
      set: { usd: sql`${spendMeter.usd} + ${record.usd}` },
    });
}

/**
 * Estimate cost for a model call (helper for budgeting).
 */
export function estimateCost(
  model: 'haiku' | 'opus',
  inputTokens: number,
  outputTokens: number
): number {
  // Pricing: haiku $1/$5, opus $5/$25 per 1M tokens
  const pricingPerMillion = {
    haiku: { input: 1, output: 5 },
    opus: { input: 5, output: 25 },
  };

  const rates = pricingPerMillion[model];
  return (
    (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
  );
}