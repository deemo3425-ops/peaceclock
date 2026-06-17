import { NextRequest, NextResponse } from 'next/server';
import type { MapResponse } from '@peaceclock/api-types';
import { Side, Category, Audience, Tier } from '@peaceclock/api-types';
import { tiersAtOrAbove } from '@peaceclock/count-engine';
import { queryMap, DEFAULT_THEATER, isTheaterSlug, type TheaterSlug } from '@peaceclock/db';
import { todayUtc } from '@/lib/dates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function enumOrUndef<T extends string>(values: readonly T[], v: string | null): T | undefined {
  return v != null && (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * GET /api/map?asOf&threshold&side&category&audience&bbox&zoom  (M4·T0.4, EDD §9.3)
 * bbox = "minX,minY,maxX,maxY" in EPSG:3857. threshold → tiersAtOrAbove. Returns
 * clustered GeoJSON honoring as-of + tier + facet filters. Platform-neutral (M6).
 */
export async function GET(request: NextRequest): Promise<NextResponse<MapResponse>> {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get('asOf') ?? todayUtc();
  const zoom = Number(searchParams.get('zoom') ?? '3');
  const bboxRaw = (searchParams.get('bbox') ?? '').split(',').map(Number);
  const threshold = enumOrUndef(Object.values(Tier), searchParams.get('threshold')) ?? Tier.CONFIRMED;

  const theaterRaw = searchParams.get('theater');
  let theater: TheaterSlug | 'all' = DEFAULT_THEATER;
  if (theaterRaw === 'all') theater = 'all';
  else if (theaterRaw && isTheaterSlug(theaterRaw)) theater = theaterRaw;

  const empty: MapResponse = { type: 'FeatureCollection', features: [], theater: theater as MapResponse['theater'], asOf, zoom };
  if (!DATE_RE.test(asOf) || bboxRaw.length !== 4 || bboxRaw.some((n) => !Number.isFinite(n)) || !Number.isFinite(zoom)) {
    return NextResponse.json(empty, { status: bboxRaw.length === 4 ? 200 : 400 });
  }

  try {
    const features = await queryMap({
      asOf,
      tiers: [...tiersAtOrAbove(threshold)],
      bbox: bboxRaw as [number, number, number, number],
      zoom,
      theater: theater === 'all' ? 'all' : theater,
      side: enumOrUndef(Object.values(Side), searchParams.get('side')),
      category: enumOrUndef(Object.values(Category), searchParams.get('category')),
      audience: enumOrUndef(Object.values(Audience), searchParams.get('audience')),
    });
    return NextResponse.json(
      { type: 'FeatureCollection', features, theater: theater as MapResponse['theater'], asOf, zoom },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('[/api/map] Error:', error);
    return NextResponse.json(empty, { status: 500 });
  }
}
