import { NextRequest, NextResponse } from 'next/server';
import type { EvidenceDetail } from '@peaceclock/api-types';
import { queryEvidenceDetail } from '@peaceclock/db';

/**
 * GET /api/evidence/:id  (M2·T2.1, PRD §6.3)
 * Source attribution for one evidence record: link, tier, side, date, publisher.
 * Links only — no graphic media (PRD §9). 404 on unknown id.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<EvidenceDetail | { error: string }>> {
  const { id } = await params;

  try {
    const detail = await queryEvidenceDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('[/api/evidence/:id] Error:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
