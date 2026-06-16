import { NextRequest, NextResponse } from 'next/server';
import type { CountsResponse } from '@peaceclock/api-types';

export async function GET(request: NextRequest): Promise<NextResponse<CountsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const asOf = (await searchParams).get('asOf') || new Date().toISOString().split('T')[0];

    console.log('[/api/counts] GET', { asOf });

    // TODO: Implement /api/counts (M2·T1.1)
    // Parameters: asOf, from, to
    // Returns: per-day tier series + last-updated
    return NextResponse.json(
      {
        series: [],
        lastUpdated: new Date().toISOString(),
        asOf,
      },
      { status: 501 } // Not Implemented
    );
  } catch (error) {
    console.error('[/api/counts] Error:', error);
    return NextResponse.json(
      {
        series: [],
        lastUpdated: new Date().toISOString(),
        asOf: new Date().toISOString().split('T')[0],
      },
      { status: 500 }
    );
  }
}
