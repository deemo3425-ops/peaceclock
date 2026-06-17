import { NextRequest, NextResponse } from 'next/server';
import { runTick } from '@peaceclock/db';
import { authorizeCron, validateEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Corroboration worker cron entrypoint (M3·WS3·T3.1, EDD §8.1).
 * Wire in vercel.json crons. Protected by CRON_SECRET (Vercel sets the
 * Authorization: Bearer header on scheduled invocations).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    validateEnv();
    await runTick();
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/corroborate] tick failed:', error);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}