/**
 * Metrics skeleton (WS6·T6.3, M7·WS3·T3.1)
 * Cost, ingestion, corroboration queue, and aggregation metrics.
 * queryPipelineMetrics() is the ops dashboard entry point; real dashboarding
 * wires this to OTel/Grafana in production.
 */

import { sql, ne, gte } from 'drizzle-orm';
import { getDb } from './index';
import { evidenceTable, carroBatchTable } from '../schema';
import { checkBudget } from './corroboration/budget';
import { queryAuditQueue } from './audit';

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

/** Unified pipeline snapshot for ops dashboards (M7·WS3·T3.1). */
export interface PipelineMetrics {
  /** Evidence rows created in the trailing 24 hours. */
  ingestCount24h: number;
  /** corro_batch rows not yet fully processed (submitted or ended). */
  corroQueueDepth: number;
  /** Month-to-date AI spend in USD. */
  budgetSpendUsd: number;
  /** Monthly budget cap in USD. */
  budgetCapUsd: number;
  /** AI-corroborated casualties awaiting human audit. */
  auditBacklog: number;
  queriedAt: string;
}

/**
 * Query live pipeline metrics from Postgres (skeleton).
 * Returns zeros when DATABASE_URL is unavailable — safe for health probes.
 */
export async function queryPipelineMetrics(): Promise<PipelineMetrics> {
  const queriedAt = new Date().toISOString();
  const empty: PipelineMetrics = {
    ingestCount24h: 0,
    corroQueueDepth: 0,
    budgetSpendUsd: 0,
    budgetCapUsd: 0,
    auditBacklog: 0,
    queriedAt,
  };

  try {
    const db = getDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [ingestRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evidenceTable)
      .where(gte(evidenceTable.ingestedAt, since));

    const [corroRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(carroBatchTable)
      .where(ne(carroBatchTable.status, 'processed'));

    const budget = await checkBudget();
    const auditQueue = await queryAuditQueue(1_000);

    return {
      ingestCount24h: ingestRow?.count ?? 0,
      corroQueueDepth: corroRow?.count ?? 0,
      budgetSpendUsd: budget.usd,
      budgetCapUsd: budget.capUsd,
      auditBacklog: auditQueue.length,
      queriedAt,
    };
  } catch (error) {
    console.warn('[metrics] queryPipelineMetrics fallback:', error);
    return empty;
  }
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