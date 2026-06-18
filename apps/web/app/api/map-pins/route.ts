import { NextRequest, NextResponse } from 'next/server';
import type { MapPinsResponse } from '@peaceclock/api-types';
import { Theater } from '@peaceclock/api-types';
import { getMapPins } from '@/lib/map-pins';
import { DEFAULT_THEATER } from '@peaceclock/db';
import { todayUtc } from '@/lib/dates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/map-pins?asOf=D  (M2·T4.1)
 * Capped set of recent geolocated evidence for the lightweight backdrop.
 * No clustering — that is M4.
 */
export async function GET(request: NextRequest): Promise<NextResponse<MapPinsResponse>> {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get('asOf') ?? todayUtc();
  const safeAsOf = DATE_RE.test(asOf) ? asOf : todayUtc();

  const pins = await getMapPins(safeAsOf);
  return NextResponse.json(
    { pins, theater: DEFAULT_THEATER as Theater, asOf: safeAsOf },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
