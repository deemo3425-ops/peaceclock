/**
 * Cost tracking helpers (T0.5, EDD §12)
 * Used by M3 corroboration worker to log per-item AI spend.
 */

export interface CostRecord {
  itemId: string;
  model: 'haiku' | 'opus';
  inputTokens: number;
  outputTokens: number;
  usd: number;
  timestamp: Date;
}

/**
 * Record the cost of an AI API call.
 * In production, this writes to audit_log (EDD §5.4).
 * For now, it's a no-op stub.
 */
export function recordModelCost(record: CostRecord): void {
  console.log('[cost] recorded', {
    itemId: record.itemId,
    model: record.model,
    usd: record.usd,
  });
  // TODO: Write to audit_log.model_cost_usd (M3·WS5)
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
