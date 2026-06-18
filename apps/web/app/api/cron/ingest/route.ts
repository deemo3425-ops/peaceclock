import { NextRequest, NextResponse } from 'next/server';
import { runIngestion } from '@peaceclock/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Ingestion cron entrypoint (M1·WS4·T4.1, EDD §7).
 * Runs OHCHR + RU confirmed adapters daily. UA adapter excluded (T5.3 blocked).
 * Protected by CRON_SECRET (Vercel sets Authorization: Bearer on scheduled runs).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const results = await runIngestion();
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      adapters: results,
    });
  } catch (error) {
    console.error('[cron/ingest] run failed:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}