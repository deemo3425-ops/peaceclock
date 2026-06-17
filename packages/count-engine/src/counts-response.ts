/**
 * Pure builder for the /api/counts payload (T1.1/T1.2).
 * Transforms raw daily_agg rows + per-side freshness into a CountsResponse.
 * Kept DB-free so it is unit-testable and reusable by native clients (EDD §9.4).
 */

import { CountsResponse, CountSeries, Side, Theater } from '@peaceclock/api-types';
import { INVASION_START } from './index';

/** A daily_agg row as returned from the DB (already string-typed dates). */
export interface AggRow {
  day: string;
  theater: Theater;
  side: Side;
  category: CountSeries['category'];
  audience: CountSeries['audience'];
  tier: CountSeries['tier'];
  count: number;
}

/** Newest evidence timestamp for a side (T1.4). */
export interface SideFreshness {
  side: Side;
  lastUpdated: string; // ISO timestamp
}

export interface BuildCountsArgs {
  rows: AggRow[];
  freshness: SideFreshness[];
  asOf: string;
  theater?: Theater;
  epochStart?: string; // theater epoch; defaults to INVASION_START (Ukraine)
  from?: string;
}

/**
 * Build the response. Filters rows to [from, asOf] inclusive (as-of upper bound,
 * INVASION_START lower clamp), and rolls per-side freshness into a global max.
 */
export function buildCountsResponse(args: BuildCountsArgs): CountsResponse {
  const asOf = args.asOf;
  const theater = args.theater ?? Theater.UKRAINE;
  const epoch = args.epochStart ?? INVASION_START;
  const rawFrom = args.from ?? epoch;
  const from = rawFrom < epoch ? epoch : rawFrom;

  const series: CountSeries[] = args.rows
    .filter((r) => r.day >= from && r.day <= asOf)
    .map((r) => ({
      day: r.day,
      theater: r.theater,
      side: r.side,
      category: r.category,
      audience: r.audience,
      tier: r.tier,
      count: r.count,
    }));

  const lastUpdatedBySide: Partial<Record<Side, string>> = {};
  let lastUpdated = '';
  for (const f of args.freshness) {
    lastUpdatedBySide[f.side] = f.lastUpdated;
    if (f.lastUpdated > lastUpdated) lastUpdated = f.lastUpdated;
  }

  return {
    series,
    theater,
    epochStart: epoch,
    lastUpdated: lastUpdated || new Date(0).toISOString(),
    lastUpdatedBySide,
    asOf,
    from,
    to: asOf,
  };
}
