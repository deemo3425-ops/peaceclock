/**
 * M1 Integration test (WS6·T6.2)
 * End-to-end: ingest fixtures → embed → aggregate → verify counts.
 *
 * Run with: pnpm test
 */

import { describe, it, expect } from 'vitest';
import { getDb } from '../index';
import { ingestEvidence } from '../ingestion';
import { runIngestion } from '../adapters';
import { casualtyTable, dailyAggTable, evidenceTable } from '../../schema';
import { eq } from 'drizzle-orm';

describe('M1 Integration', () => {
  it('should ingest fixture, embed, and aggregate correctly', async () => {
    // T6.2: Fixture data (OHCHR-like civilian casualty)
    const fixture = {
      kind: 'official' as const,
      publisher: 'OHCHR',
      url: 'https://example.com/report',
      publishedAt: '2022-03-01',
      text: 'OHCHR report: 10 civilians killed in Kharkiv region on 2022-03-01.',
      raw: {
        source: 'ohchr',
        region: 'Kharkiv',
        casualty: {
          side: 'ua_coalition',
          category: 'killed',
          audience: 'civilian',
          eventDate: '2022-03-01',
          count: 10,
          tier: 'official',
        },
      },
    };

    // Ingest as official-tier
    await ingestEvidence(fixture, true);

    const db = getDb();
    const casualties = await db
      .select()
      .from(casualtyTable)
      .where(eq(casualtyTable.tier, 'official'))
      .limit(1);
    expect(casualties.length).toBeGreaterThan(0);
    expect(casualties[0]!.count).toBe(10);

    const aggs = await db
      .select()
      .from(dailyAggTable)
      .where(eq(dailyAggTable.tier, 'official'))
      .limit(1);
    expect(aggs.length).toBeGreaterThan(0);
  });

  it('should query daily_agg after ingest without error', async () => {
    // T6.2: aggregate deltas land in PR5 official short-circuit; table must be reachable.
    const db = getDb();
    const aggs = await db.select().from(dailyAggTable).limit(10);
    expect(Array.isArray(aggs)).toBe(true);
  });

  it('should be idempotent: re-ingesting same hash yields no change', async () => {
    // T6.2: Idempotency assertion
    // Same fixture hash should be rejected on re-ingest
    const fixture = {
      kind: 'official' as const,
      publisher: 'OHCHR',
      url: 'https://example.com/report2',
      publishedAt: '2022-03-02',
      text: 'Second OHCHR report: 5 civilians killed in Lviv on 2022-03-02.',
      raw: {
        source: 'ohchr',
        region: 'Lviv',
        casualty: {
          side: 'ua_coalition',
          category: 'killed',
          audience: 'civilian',
          eventDate: '2022-03-02',
          count: 5,
          tier: 'official',
        },
      },
    };

    const db = getDb();
    const beforeCount = (await db.select().from(evidenceTable)).length;

    // Ingest once
    await ingestEvidence(fixture, true);
    const afterFirstIngest = (await db.select().from(evidenceTable)).length;

    // Ingest again (same hash) — should reject
    await ingestEvidence(fixture, true);
    const afterSecondIngest = (await db.select().from(evidenceTable)).length;

    // Count should not increase on second ingest
    expect(afterFirstIngest).toBe(afterSecondIngest);
  });

  it('should run fixture adapters producing official OHCHR + confirmed RU rows', async () => {
    const db = getDb();
    const beforeOfficial = (await db.select().from(casualtyTable).where(eq(casualtyTable.tier, 'official'))).length;
    const beforeConfirmed = (await db.select().from(casualtyTable).where(eq(casualtyTable.tier, 'confirmed'))).length;

    const results = await runIngestion();
    expect(results.length).toBe(2);
    expect(results.some((r) => r.adapter === 'OHCHR' && r.fetched > 0)).toBe(true);
    expect(results.some((r) => r.adapter === 'RU-Confirmed (Mediazona/BBC)' && r.fetched > 0)).toBe(true);

    const afterOfficial = (await db.select().from(casualtyTable).where(eq(casualtyTable.tier, 'official'))).length;
    const afterConfirmed = (await db.select().from(casualtyTable).where(eq(casualtyTable.tier, 'confirmed'))).length;
    expect(afterOfficial).toBeGreaterThan(beforeOfficial);
    expect(afterConfirmed).toBeGreaterThan(beforeConfirmed);

    const aggs = await db.select().from(dailyAggTable).limit(20);
    expect(aggs.some((a) => a.tier === 'official')).toBe(true);
    expect(aggs.some((a) => a.tier === 'confirmed')).toBe(true);

    // Idempotent re-run: watermark advanced, no new rows
    const officialMid = afterOfficial;
    const confirmedMid = afterConfirmed;
    await runIngestion();
    const officialEnd = (await db.select().from(casualtyTable).where(eq(casualtyTable.tier, 'official'))).length;
    const confirmedEnd = (await db.select().from(casualtyTable).where(eq(casualtyTable.tier, 'confirmed'))).length;
    expect(officialEnd).toBe(officialMid);
    expect(confirmedEnd).toBe(confirmedMid);
  });
});
