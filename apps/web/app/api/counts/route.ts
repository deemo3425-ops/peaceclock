import { NextRequest, NextResponse } from 'next/server';
import type { CountsResponse } from '@peaceclock/api-types';
import { buildCountsResponse } from '@peaceclock/count-engine';
import { queryDailyAgg, querySideFreshness, DEFAULT_THEATER, theaterEpoch, isTheaterSlug } from '@peaceclock/db';
import { Theater } from '@peaceclock/api-types';
import { validateEnv } from '@/lib/env';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/counts?asOf=D&from=...&to=...  (M2·T1.1, EDD §9.1)
 * Returns the per-day daily_agg series over [from, asOf] plus per-side freshness.
 * Reads daily_agg only — no casualty scan. Client recomputes windows/thresholds
 * via @peaceclock/count-engine with no extra fetch.
 */
export async function GET(request: NextRequest): Promise<NextResponse<CountsResponse>> {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get('asOf') ?? today();
  const theaterRaw = searchParams.get('theater') ?? DEFAULT_THEATER;
  const theater = isTheaterSlug(theaterRaw) ? theaterRaw : DEFAULT_THEATER;
  const epoch = theaterEpoch(theater);
  const from = searchParams.get('from') ?? epoch;

  if (!DATE_RE.test(asOf) || !DATE_RE.test(from)) {
    return NextResponse.json(emptyResponse(theater, asOf, from, epoch), { status: 400 });
  }

  try {
    validateEnv();
    const [rows, freshness] = await Promise.all([
      queryDailyAgg(from, asOf, theater),
      querySideFreshness(theater),
    ]);

    const body = buildCountsResponse({
      rows, freshness, asOf, from,
      theater: theater as Theater,
      epochStart: epoch,
    });
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[/api/counts] Error:', error);
    return NextResponse.json(emptyResponse(theater, asOf, from, epoch), { status: 500 });
  }
}

function emptyResponse(
  theater: string,
  asOf: string,
  from: string,
  epoch: string,
): CountsResponse {
  return {
    series: [],
    theater: theater as Theater,
    epochStart: epoch,
    lastUpdated: new Date(0).toISOString(),
    lastUpdatedBySide: {},
    asOf,
    from,
    to: asOf,
  };
}