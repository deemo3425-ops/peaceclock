import { NextRequest, NextResponse } from 'next/server';
import { runTick } from '@peaceclock/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Corroboration worker cron entrypoint (M3·WS3·T3.1, EDD §8.1).
 * Wire in vercel.json crons. Protected by CRON_SECRET (Vercel sets the
 * Authorization: Bearer header on scheduled invocations).
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
    await runTick();
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/corroborate] tick failed:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
