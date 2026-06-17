import { NextRequest, NextResponse } from 'next/server';
import type { EvidenceDetail } from '@peaceclock/api-types';
import { Side, Category, Audience, Tier } from '@peaceclock/api-types';
import { windowStart, tiersAtOrAbove, type Window } from '@peaceclock/count-engine';
import { resolveCellSources, DEFAULT_THEATER, isTheaterSlug } from '@peaceclock/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WINDOWS: Window[] = ['24h', '7d', '30d', '90d', '1y', 'total'];

function isMember<T extends string>(values: readonly T[], v: string | null): v is T {
  return v != null && (values as readonly string[]).includes(v);
}

/**
 * GET /api/sources?side&category&audience&window&threshold&asOf  (M2·T2.2, PRD §6.3)
 * Resolves the backing sources for a single count cell. window+threshold+asOf
 * are mapped to an event_date range and eligible tier set via the shared engine,
 * so the list matches exactly what the cell counts.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<EvidenceDetail[] | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const side = searchParams.get('side');
  const category = searchParams.get('category');
  const audience = searchParams.get('audience');
  const window = searchParams.get('window');
  const threshold = searchParams.get('threshold');
  const asOf = searchParams.get('asOf');
  const theaterRaw = searchParams.get('theater') ?? DEFAULT_THEATER;
  const theater = isTheaterSlug(theaterRaw) ? theaterRaw : DEFAULT_THEATER;

  if (
    !isMember(Object.values(Side), side) ||
    !isMember(Object.values(Category), category) ||
    !isMember(Object.values(Audience), audience) ||
    !isMember(WINDOWS, window) ||
    !isMember(Object.values(Tier), threshold) ||
    !asOf ||
    !DATE_RE.test(asOf)
  ) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 });
  }

  const from = windowStart(asOf, window);
  const tiers = [...tiersAtOrAbove(threshold)];

  try {
    const sources = await resolveCellSources({
      theater,
      side,
      category,
      audience,
      from,
      to: asOf,
      tiers,
    });
    return NextResponse.json(sources, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[/api/sources] Error:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
