import { describe, it, expect } from 'vitest';
import { computeMatrix, WINDOWS } from '../index';
import { CountSeries, Theater, Side, Audience, Category, Tier } from '@peaceclock/api-types';

function row(
  day: string,
  n: number,
  side: Side,
  audience: Audience,
  tier: Tier = Tier.CONFIRMED,
  category: Category = Category.KILLED,
): CountSeries {
  return { day, count: n, theater: Theater.UKRAINE, side, audience, tier, category };
}

const series: CountSeries[] = [
  row('2024-01-10', 100, Side.UA_COALITION, Audience.CIVILIAN),
  row('2024-01-10', 200, Side.RUSSIA, Audience.MILITARY),
  row('2024-01-09', 5, Side.UA_COALITION, Audience.CIVILIAN),
  row('2024-01-10', 7, Side.RUSSIA, Audience.MILITARY, Tier.OSINT),
];

describe('computeMatrix', () => {
  it('returns 4 rows, civilian first', () => {
    const m = computeMatrix(series, { asOf: '2024-01-10', threshold: Tier.CONFIRMED, category: Category.KILLED });
    expect(m).toHaveLength(4);
    expect(m[0].audience).toBe(Audience.CIVILIAN);
    expect(m[2].audience).toBe(Audience.MILITARY);
  });

  it('computes every window per row', () => {
    const m = computeMatrix(series, { asOf: '2024-01-10', threshold: Tier.CONFIRMED, category: Category.KILLED });
    for (const r of m) {
      for (const w of WINDOWS) expect(typeof r.counts[w]).toBe('number');
    }
  });

  it('UA civilian total = 105, 24h = 100', () => {
    const m = computeMatrix(series, { asOf: '2024-01-10', threshold: Tier.CONFIRMED, category: Category.KILLED });
    const uaCiv = m.find((r) => r.side === Side.UA_COALITION && r.audience === Audience.CIVILIAN)!;
    expect(uaCiv.counts.total).toBe(105);
    expect(uaCiv.counts['24h']).toBe(100);
  });

  it('threshold excludes OSINT row at CONFIRMED', () => {
    const m = computeMatrix(series, { asOf: '2024-01-10', threshold: Tier.CONFIRMED, category: Category.KILLED });
    const ruMil = m.find((r) => r.side === Side.RUSSIA && r.audience === Audience.MILITARY)!;
    expect(ruMil.counts.total).toBe(200); // the OSINT 7 is excluded
  });

  it('threshold OSINT includes the OSINT row', () => {
    const m = computeMatrix(series, { asOf: '2024-01-10', threshold: Tier.OSINT, category: Category.KILLED });
    const ruMil = m.find((r) => r.side === Side.RUSSIA && r.audience === Audience.MILITARY)!;
    expect(ruMil.counts.total).toBe(207);
  });
});
