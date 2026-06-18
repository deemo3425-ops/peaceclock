import type { CountsResponse, Side } from '@peaceclock/api-types';
import { Theater } from '@peaceclock/api-types';
import {
  buildCountsResponse,
  type AggRow,
  type SideFreshness,
  INVASION_START,
} from '@peaceclock/count-engine';
import { apiGet } from './client';
import { todayUtc } from '../lib/dates';

export type TheaterSlug = 'ukraine';

/** Raw fetch — returns the server-shaped CountsResponse. */
export async function fetchCounts(
  theater: TheaterSlug = 'ukraine',
  asOf: string = todayUtc(),
): Promise<CountsResponse> {
  const qs = new URLSearchParams({ theater, asOf });
  return apiGet<CountsResponse>(`/api/counts?${qs}`);
}

/** Convert API freshness map to SideFreshness rows for buildCountsResponse. */
export function freshnessFromResponse(
  lastUpdatedBySide: CountsResponse['lastUpdatedBySide'],
): SideFreshness[] {
  return (Object.entries(lastUpdatedBySide) as [Side, string][])
    .filter(([, ts]) => Boolean(ts))
    .map(([side, lastUpdated]) => ({ side, lastUpdated }));
}

/**
 * Re-shape a loaded series for a new as-of date client-side (no refetch).
 * Mirrors web Counter: scrub/slider recompute from the cached daily series.
 */
export function reshapeCountsForAsOf(
  raw: CountsResponse,
  asOf: string,
): CountsResponse {
  const rows: AggRow[] = raw.series.map((r) => ({
    day: r.day,
    theater: r.theater,
    side: r.side,
    category: r.category,
    audience: r.audience,
    tier: r.tier,
    count: r.count,
  }));

  return buildCountsResponse({
    rows,
    freshness: freshnessFromResponse(raw.lastUpdatedBySide),
    asOf,
    theater: raw.theater ?? Theater.UKRAINE,
    epochStart: raw.epochStart ?? INVASION_START,
    from: raw.epochStart ?? INVASION_START,
  });
}