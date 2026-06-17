/**
 * Server-only counts fetch for RSC (M2·WS3·T3.1).
 * Calls the db data layer directly (no HTTP round-trip) and shapes via the
 * shared engine. Resilient: on any error (e.g. no DB in dev) returns an empty
 * but valid CountsResponse so the headline still renders.
 */

import 'server-only';
import type { CountsResponse } from '@peaceclock/api-types';
import { buildCountsResponse } from '@peaceclock/count-engine';
import { queryDailyAgg, querySideFreshness, DEFAULT_THEATER, theaterEpoch } from '@peaceclock/db';
import { Theater } from '@peaceclock/api-types';

export async function getCountsData(
  asOf: string,
  theater = DEFAULT_THEATER,
): Promise<CountsResponse> {
  const epoch = theaterEpoch(theater);
  try {
    const [rows, freshness] = await Promise.all([
      queryDailyAgg(epoch, asOf, theater),
      querySideFreshness(theater),
    ]);
    return buildCountsResponse({
      rows, freshness, asOf, from: epoch,
      theater: theater as Theater,
      epochStart: epoch,
    });
  } catch (error) {
    console.error('[getCountsData] falling back to empty series:', error);
    return {
      series: [],
      theater: theater as Theater,
      epochStart: epoch,
      lastUpdated: new Date(0).toISOString(),
      lastUpdatedBySide: {},
      asOf,
      from: epoch,
      to: asOf,
    };
  }
}
