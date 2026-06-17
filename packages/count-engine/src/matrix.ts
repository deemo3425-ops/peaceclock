/**
 * Pure headline-matrix builder (M2·WS3·T3.4).
 * For a given as-of date, threshold, and category, compute the per-side ×
 * per-audience × per-window counts the Counter renders. Runs identically on
 * the server (SSR) and client (on date/threshold change) — no extra fetch.
 */

import { CountSeries, Side, Audience, Category, Tier } from '@peaceclock/api-types';
import { count, Window } from './index';

export const WINDOWS: Window[] = ['24h', '7d', '30d', '90d', '1y', 'total'];

// Civilian first (primary), military second (secondary, lower-coverage) — PRD §3/§5.1.
const ROWS: { side: Side; audience: Audience }[] = [
  { side: Side.UA_COALITION, audience: Audience.CIVILIAN },
  { side: Side.RUSSIA, audience: Audience.CIVILIAN },
  { side: Side.UA_COALITION, audience: Audience.MILITARY },
  { side: Side.RUSSIA, audience: Audience.MILITARY },
];

export interface MatrixRow {
  side: Side;
  audience: Audience;
  counts: Record<Window, number>;
}

export interface MatrixOptions {
  asOf: string;
  threshold: Tier;
  category: Category;
  theater?: string;
  epochStart?: string;
}

/** Compute the full headline matrix from a daily series. */
export function computeMatrix(series: CountSeries[], opts: MatrixOptions): MatrixRow[] {
  return ROWS.map(({ side, audience }) => {
    const counts = {} as Record<Window, number>;
    for (const window of WINDOWS) {
      counts[window] = count(series, {
        asOf: opts.asOf,
        window,
        threshold: opts.threshold,
        theater: opts.theater,
        epochStart: opts.epochStart,
        side,
        audience,
        category: opts.category,
      });
    }
    return { side, audience, counts };
  });
}
