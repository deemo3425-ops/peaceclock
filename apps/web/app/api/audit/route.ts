import { NextRequest, NextResponse } from 'next/server';
import { Tier } from '@peaceclock/api-types';
import {
  queryAuditQueue,
  changeTier,
  rejectCasualty,
  repositionCasualty,
} from '@peaceclock/db';
import { authorizeAudit, validateEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** GET /api/audit — the human-audit queue (M3·WS7·T7.1). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorizeAudit(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    validateEnv();
    const items = await queryAuditQueue();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[/api/audit] queue fetch failed:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

/**
 * POST /api/audit — apply an audit action (T7.2).
 * Body: { casualtyId, action: 'promote'|'demote'|'reject'|'reposition', tier?, lat?, lng?, reason }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorizeAudit(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const { casualtyId, action, tier, lat, lng, reason } = body ?? {};
  if (!casualtyId || !action) {
    return NextResponse.json({ error: 'casualtyId and action required' }, { status: 400 });
  }

  try {
    validateEnv();

    switch (action) {
      case 'promote':
      case 'demote':
        if (!Object.values(Tier).includes(tier as Tier)) {
          return NextResponse.json({ error: 'valid tier required' }, { status: 400 });
        }
        await changeTier(String(casualtyId), tier as Tier, 'human', String(reason ?? `${action} by audit`));
        break;
      case 'reject':
        await rejectCasualty(String(casualtyId), String(reason ?? 'rejected by audit'));
        break;
      case 'reposition':
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
        }
        await repositionCasualty(String(casualtyId), lat, lng, String(reason ?? 'repositioned by audit'));
        break;
      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/audit] action failed:', error);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}