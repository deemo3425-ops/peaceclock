import { describe, it, expect } from 'vitest';
import { buildCountsResponse, AggRow, count, INVASION_START } from '../index';
import { Theater, Tier, Side, Category, Audience } from '@peaceclock/api-types';

function agg(day: string, n: number, tier: Tier, side: Side): AggRow {
  return {
    day, count: n, tier, side, theater: Theater.UKRAINE,
    category: Category.KILLED, audience: Audience.MILITARY,
  };
}

const rows: AggRow[] = [
  agg('2024-01-01', 5, Tier.OFFICIAL, Side.RUSSIA),
  agg('2024-01-02', 7, Tier.CONFIRMED, Side.RUSSIA),
  agg('2024-01-03', 9, Tier.OSINT, Side.RUSSIA),
  agg('2024-01-02', 4, Tier.CONFIRMED, Side.UA_COALITION),
];

describe('buildCountsResponse', () => {
  it('filters to [from, asOf] inclusive', () => {
    const res = buildCountsResponse({ rows, freshness: [], asOf: '2024-01-02', from: '2024-01-02' });
    expect(res.series).toHaveLength(2); // both 2024-01-02 rows
    expect(res.series.every((r) => r.day === '2024-01-02')).toBe(true);
  });

  it('excludes rows after asOf (as-of semantics)', () => {
    const res = buildCountsResponse({ rows, freshness: [], asOf: '2024-01-02' });
    expect(res.series.some((r) => r.day === '2024-01-03')).toBe(false);
  });

  it('clamps from to INVASION_START', () => {
    const res = buildCountsResponse({ rows, freshness: [], asOf: '2024-01-03', from: '2000-01-01' });
    expect(res.from).toBe(INVASION_START);
    expect(res.to).toBe('2024-01-03');
  });

  it('rolls per-side freshness into global max', () => {
    const res = buildCountsResponse({
      rows,
      asOf: '2024-01-03',
      freshness: [
        { side: Side.RUSSIA, lastUpdated: '2024-01-03T10:00:00Z' },
        { side: Side.UA_COALITION, lastUpdated: '2024-01-02T08:00:00Z' },
      ],
    });
    expect(res.lastUpdatedBySide[Side.RUSSIA]).toBe('2024-01-03T10:00:00Z');
    expect(res.lastUpdated).toBe('2024-01-03T10:00:00Z');
  });

  it('payload feeds the count engine consistently', () => {
    const res = buildCountsResponse({ rows, freshness: [], asOf: '2024-01-03' });
    // Russia total at OSINT threshold = 5+7+9 = 21
    const ru = count(res.series, {
      asOf: '2024-01-03',
      window: 'total',
      threshold: Tier.OSINT,
      side: Side.RUSSIA,
    });
    expect(ru).toBe(21);
    // UA total at CONFIRMED = 4
    const ua = count(res.series, {
      asOf: '2024-01-03',
      window: 'total',
      threshold: Tier.CONFIRMED,
      side: Side.UA_COALITION,
    });
    expect(ua).toBe(4);
  });
});
