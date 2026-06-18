import { ImageResponse } from 'next/og';
import { Audience, Category, Side, Tier } from '@peaceclock/api-types';
import { computeMatrix } from '@peaceclock/count-engine';
import { DEFAULT_HEADLINE_THRESHOLD } from '@peaceclock/db';
import { getCountsData } from '@/lib/counts';
import { todayUtc } from '@/lib/dates';

// Node runtime — live counts use the postgres data layer (not edge-compatible).
export const runtime = 'nodejs';

const THRESHOLD_BY_SLUG: Record<string, Tier> = {
  official: Tier.OFFICIAL,
  confirmed: Tier.CONFIRMED,
  osint: Tier.OSINT,
  ai_corroborated: Tier.AI_CORROBORATED,
};

const SIDE_LABEL: Record<Side, string> = {
  [Side.UA_COALITION]: 'Ukraine coalition',
  [Side.RUSSIA]: 'Russia',
};

/** Dynamic OG/Twitter card (M5·T1.2) — live headline civilian totals at default threshold. */
export async function GET() {
  const asOf = todayUtc();
  const threshold = THRESHOLD_BY_SLUG[DEFAULT_HEADLINE_THRESHOLD] ?? Tier.CONFIRMED;
  const data = await getCountsData(asOf);
  const matrix = computeMatrix(data.series, {
    asOf,
    threshold,
    category: Category.KILLED,
    theater: data.theater,
    epochStart: data.epochStart,
  });

  const civilian = matrix.filter((r) => r.audience === Audience.CIVILIAN);
  const fmt = (n: number) => n.toLocaleString('en-US');

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '56px 64px',
          background: 'linear-gradient(145deg, #0b0d10 0%, #14181d 55%, #18222c 100%)',
          color: '#e7ecf1',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 22, color: '#9aa7b4', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            New Florence Interactive
          </div>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
            PeaceClock
          </div>
          <div style={{ fontSize: 26, color: '#9aa7b4', maxWidth: 900, lineHeight: 1.35 }}>
            Confirmed casualties of the war in Ukraine — a lower bound, not a claim of the full toll.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 40, marginTop: 32 }}>
          {civilian.map((row) => (
            <div
              key={row.side}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flex: 1,
                padding: '28px 32px',
                borderRadius: 16,
                border: '1px solid #283139',
                background: 'rgba(20, 24, 29, 0.85)',
              }}
            >
              <div style={{ fontSize: 20, color: '#9aa7b4' }}>{SIDE_LABEL[row.side]} · civilians killed</div>
              <div style={{ fontSize: 64, fontWeight: 700, color: '#ffd27d', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(row.counts.total)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 32 }}>
          <div style={{ fontSize: 22, color: '#9aa7b4' }}>
            As of {asOf} · Official + Confirmed threshold
          </div>
          <div style={{ fontSize: 22, color: '#6db1ff' }}>peaceclock.org</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}