/**
 * Metrics skeleton (WS6·T6.3)
 * Cost, ingestion, and aggregation metrics.
 * Real dashboarding deferred to M7.
 */

export interface IngestMetrics {
  sourceId: string;
  ingested: number;
  dropped: number;
  duplicates: number;
  junkFiltered: number;
  embeddingTimeMs: number;
  embeddingCostUsd: number;
  timestamp: Date;
}

export interface AggMetrics {
  day: string;
  totalCasualties: number;
  byTier: Record<string, number>;
  byCategory: Record<string, number>;
  timestamp: Date;
}

export interface MonthlyMetrics {
  month: string;
  totalIngested: number;
  totalEmbeddingCostUsd: number;
  monthlyBudgetUsedPercent: number;
}

/**
 * Record ingest metrics (stub; real implementation uses OTel/analytics backend).
 */
export function recordIngestMetrics(metrics: IngestMetrics): void {
  console.log('[metrics] ingest', {
    source: metrics.sourceId,
    ingested: metrics.ingested,
    dropped: metrics.dropped,
    costUsd: metrics.embeddingCostUsd,
  });
}

/**
 * Record daily agg metrics (stub).
 */
export function recordAggMetrics(metrics: AggMetrics): void {
  console.log('[metrics] agg', {
    day: metrics.day,
    total: metrics.totalCasualties,
    byTier: metrics.byTier,
  });
}

/**
 * Record monthly budget metrics (stub).
 */
export function recordMonthlyMetrics(metrics: MonthlyMetrics): void {
  console.log('[metrics] monthly', {
    month: metrics.month,
    budgetUsedPercent: metrics.monthlyBudgetUsedPercent,
  });
}
