import { describe, it, expect } from 'vitest';
import {
  count,
  windowStart,
  tiersAtOrAbove,
  INVASION_START,
  Window,
} from '../index';
import { CountSeries, Theater, Tier, Side, Category, Audience } from '@peaceclock/api-types';

// ── fixture helpers ──────────────────────────────────────────────────────────

function row(
  day: string,
  n: number,
  tier: Tier = Tier.CONFIRMED,
  side: Side = Side.RUSSIA,
  category: Category = Category.KILLED,
  audience: Audience = Audience.MILITARY,
): CountSeries {
  return { day, count: n, theater: Theater.UKRAINE, tier, side, category, audience };
}

// ── T0.1 — windowStart ───────────────────────────────────────────────────────

describe('windowStart', () => {
  it('24h → same day', () => {
    expect(windowStart('2024-03-15', '24h')).toBe('2024-03-15');
  });

  it('7d → 6 days before', () => {
    expect(windowStart('2024-03-15', '7d')).toBe('2024-03-09');
  });

  it('30d → 29 days before', () => {
    expect(windowStart('2024-03-15', '30d')).toBe('2024-02-15');
  });

  it('90d → 89 days before', () => {
    expect(windowStart('2024-03-15', '90d')).toBe('2023-12-17');
  });

  it('1y → 364 days before', () => {
    // 2024 is a leap year; 2024-03-15 - 364d = 2023-03-17
    expect(windowStart('2024-03-15', '1y')).toBe('2023-03-17');
  });

  it('total → INVASION_START', () => {
    expect(windowStart('2024-03-15', 'total')).toBe(INVASION_START);
  });

  it('clamps to INVASION_START when window starts before it', () => {
    expect(windowStart('2022-03-01', '1y')).toBe(INVASION_START);
  });

  it('clamps 7d before INVASION_START', () => {
    expect(windowStart('2022-02-25', '7d')).toBe(INVASION_START);
  });
});

// ── T0.2 — as-of semantics ───────────────────────────────────────────────────

describe('as-of semantics', () => {
  const series = [
    row('2024-01-01', 10),
    row('2024-01-02', 20),
    row('2024-01-03', 30), // event_date > asOf — must be excluded
  ];

  it('includes event_date = asOf', () => {
    expect(count(series, { asOf: '2024-01-02', window: 'total', threshold: Tier.CONFIRMED })).toBe(30);
  });

  it('excludes event_date > asOf', () => {
    expect(count(series, { asOf: '2024-01-01', window: 'total', threshold: Tier.CONFIRMED })).toBe(10);
  });
});

// ── T0.3 — tier threshold mapping ────────────────────────────────────────────

describe('tiersAtOrAbove', () => {
  it('AI_CORROBORATED → all four tiers', () => {
    const t = tiersAtOrAbove(Tier.AI_CORROBORATED);
    expect(t.has(Tier.OFFICIAL)).toBe(true);
    expect(t.has(Tier.CONFIRMED)).toBe(true);
    expect(t.has(Tier.OSINT)).toBe(true);
    expect(t.has(Tier.AI_CORROBORATED)).toBe(true);
  });

  it('OSINT → {Official, Confirmed, OSINT}', () => {
    const t = tiersAtOrAbove(Tier.OSINT);
    expect(t.has(Tier.OFFICIAL)).toBe(true);
    expect(t.has(Tier.CONFIRMED)).toBe(true);
    expect(t.has(Tier.OSINT)).toBe(true);
    expect(t.has(Tier.AI_CORROBORATED)).toBe(false);
  });

  it('CONFIRMED (default) → {Official, Confirmed}', () => {
    const t = tiersAtOrAbove(Tier.CONFIRMED);
    expect(t.has(Tier.OFFICIAL)).toBe(true);
    expect(t.has(Tier.CONFIRMED)).toBe(true);
    expect(t.has(Tier.OSINT)).toBe(false);
    expect(t.has(Tier.AI_CORROBORATED)).toBe(false);
  });

  it('OFFICIAL → {Official} only', () => {
    const t = tiersAtOrAbove(Tier.OFFICIAL);
    expect(t.has(Tier.OFFICIAL)).toBe(true);
    expect(t.has(Tier.CONFIRMED)).toBe(false);
  });
});

// ── count() — window × tier matrix ──────────────────────────────────────────

describe('count()', () => {
  // 10 rows, 1 per day 2024-01-01..2024-01-10
  const series: CountSeries[] = [
    row('2024-01-01', 1, Tier.OFFICIAL),
    row('2024-01-02', 2, Tier.CONFIRMED),
    row('2024-01-03', 3, Tier.CONFIRMED),
    row('2024-01-04', 4, Tier.OSINT),
    row('2024-01-05', 5, Tier.AI_CORROBORATED),
    row('2024-01-06', 6, Tier.CONFIRMED),
    row('2024-01-07', 7, Tier.OFFICIAL),
    row('2024-01-08', 8, Tier.CONFIRMED),
    row('2024-01-09', 9, Tier.OSINT),
    row('2024-01-10', 10, Tier.CONFIRMED),
  ];

  it('total = prefix[asOf] for CONFIRMED threshold', () => {
    // Official(1+7=8) + Confirmed(2+3+6+8+10=29) = 37
    const result = count(series, { asOf: '2024-01-10', window: 'total', threshold: Tier.CONFIRMED });
    expect(result).toBe(37);
  });

  it('total with AI threshold includes all', () => {
    // 1+2+3+4+5+6+7+8+9+10 = 55
    const result = count(series, { asOf: '2024-01-10', window: 'total', threshold: Tier.AI_CORROBORATED });
    expect(result).toBe(55);
  });

  it('24h = single day', () => {
    const result = count(series, { asOf: '2024-01-05', window: '24h', threshold: Tier.AI_CORROBORATED });
    expect(result).toBe(5);
  });

  it('7d sum', () => {
    // Jan 4..10: 4+5+6+7+8+9+10 = 49 (all tiers)
    const result = count(series, { asOf: '2024-01-10', window: '7d', threshold: Tier.AI_CORROBORATED });
    expect(result).toBe(49);
  });

  it('empty range → 0', () => {
    const result = count(series, { asOf: '2023-12-31', window: 'total', threshold: Tier.CONFIRMED });
    expect(result).toBe(0);
  });

  it('filters by side', () => {
    const mixed: CountSeries[] = [
      row('2024-01-01', 100, Tier.CONFIRMED, Side.RUSSIA),
      row('2024-01-01', 200, Tier.CONFIRMED, Side.UA_COALITION),
    ];
    expect(count(mixed, { asOf: '2024-01-01', window: 'total', threshold: Tier.CONFIRMED, side: Side.RUSSIA })).toBe(100);
    expect(count(mixed, { asOf: '2024-01-01', window: 'total', threshold: Tier.CONFIRMED, side: Side.UA_COALITION })).toBe(200);
  });

  it('filters by category', () => {
    const mixed: CountSeries[] = [
      row('2024-01-01', 50, Tier.CONFIRMED, Side.RUSSIA, Category.KILLED),
      row('2024-01-01', 30, Tier.CONFIRMED, Side.RUSSIA, Category.WOUNDED),
    ];
    expect(count(mixed, { asOf: '2024-01-01', window: 'total', threshold: Tier.CONFIRMED, category: Category.KILLED })).toBe(50);
    expect(count(mixed, { asOf: '2024-01-01', window: 'total', threshold: Tier.CONFIRMED, category: Category.WOUNDED })).toBe(30);
  });

  it('INVASION_START clamp: window before invasion yields correct sum', () => {
    // asOf is day 2 of invasion, 1y window should clamp to INVASION_START
    const s = [
      row(INVASION_START, 5, Tier.CONFIRMED),
      row('2022-02-25', 3, Tier.CONFIRMED),
    ];
    const result = count(s, { asOf: '2022-02-25', window: '1y', threshold: Tier.CONFIRMED });
    expect(result).toBe(8);
  });
});
