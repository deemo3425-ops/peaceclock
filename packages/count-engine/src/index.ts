/**
 * PeaceClock count engine — platform-agnostic pure TypeScript
 * T0.1: window math, T0.2: as-of semantics, T0.3: tier→threshold mapping
 *
 * Event-date axis: event_date ≤ asOf is included; event_date > asOf is excluded.
 * All dates are UTC calendar days (YYYY-MM-DD). No local-timezone math.
 * Window start is clamped to INVASION_START (2022-02-24) — no data before that date.
 */

import { CountSeries, Tier, Side, Category, Audience } from '@peaceclock/api-types';

export { Tier, Side, Category, Audience };
export type { CountSeries };
export {
  buildCountsResponse,
  type AggRow,
  type SideFreshness,
  type BuildCountsArgs,
} from './counts-response';
export {
  computeMatrix,
  WINDOWS,
  type MatrixRow,
  type MatrixOptions,
} from './matrix';
export {
  mercatorToLonLat,
  lonLatToMercator,
  parsePoint3857,
  toPoint3857Wkt,
  type LonLat,
  type Meters,
} from './geo';
export {
  worldUnitsPerPixel,
  eps,
  zoomBand,
  gridCell,
  tileSizeMeters,
  snapBboxToTileGrid,
  EARTH_CIRCUMFERENCE_M,
  TILE_PX,
  DEFAULT_PIXEL_RADIUS,
  type ZoomBand,
} from './map-cluster';

export const INVASION_START = '2022-02-24';

// Tier rank: higher number = more authoritative
const TIER_RANK: Record<Tier, number> = {
  [Tier.OFFICIAL]: 4,
  [Tier.CONFIRMED]: 3,
  [Tier.OSINT]: 2,
  [Tier.AI_CORROBORATED]: 1,
};

export type Window = '24h' | '7d' | '30d' | '90d' | '1y' | 'total';

const WINDOW_OFFSETS: Record<Exclude<Window, 'total'>, number> = {
  '24h': 0,
  '7d': 6,
  '30d': 29,
  '90d': 89,
  '1y': 364,
};

/**
 * Compute the inclusive start date for a window ending at asOf.
 * '24h' → asOf itself (single calendar day). 'total' → INVASION_START.
 */
/** Inclusive window start; `epochStart` is the theater epoch (PRD §4). */
export function windowStart(asOf: string, window: Window, epochStart = INVASION_START): string {
  if (window === 'total') return epochStart;

  const d = new Date(asOf + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - WINDOW_OFFSETS[window]);
  const start = d.toISOString().slice(0, 10);

  return start < epochStart ? epochStart : start;
}

/**
 * Return all tiers whose rank is ≥ the threshold tier's rank.
 * Default (Official+Confirmed) = tiersAtOrAbove(Tier.CONFIRMED).
 */
export function tiersAtOrAbove(threshold: Tier): Set<Tier> {
  const minRank = TIER_RANK[threshold];
  const result = new Set<Tier>();
  for (const [tier, rank] of Object.entries(TIER_RANK) as [Tier, number][]) {
    if (rank >= minRank) result.add(tier);
  }
  return result;
}

export interface CountOptions {
  asOf: string;       // ISO date YYYY-MM-DD (inclusive upper bound, T0.2)
  window: Window;
  threshold: Tier;    // minimum tier rank to include (T0.3)
  theater?: string;   // filter series to one theater (PRD §6.8)
  epochStart?: string; // theater epoch for window clamp
  side?: Side;
  category?: Category;
  audience?: Audience;
}

/**
 * Sum counts in series matching opts.
 * Series rows with event_date > asOf are excluded (T0.2 as-of semantics).
 * Series rows with tier rank < threshold rank are excluded (T0.3).
 */
export function count(series: CountSeries[], opts: CountOptions): number {
  const start = windowStart(opts.asOf, opts.window, opts.epochStart);
  const eligible = tiersAtOrAbove(opts.threshold);

  let total = 0;
  for (const row of series) {
    if (opts.theater != null && row.theater !== opts.theater) continue;
    if (row.day < start || row.day > opts.asOf) continue;
    if (!eligible.has(row.tier)) continue;
    if (opts.side !== undefined && row.side !== opts.side) continue;
    if (opts.category !== undefined && row.category !== opts.category) continue;
    if (opts.audience !== undefined && row.audience !== opts.audience) continue;
    total += row.count;
  }
  return total;
}
