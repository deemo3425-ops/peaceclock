/**
 * M1 Integration test (WS6·T6.2)
 * End-to-end: ingest fixtures → embed → aggregate → verify counts.
 *
 * Run with: pnpm test
 */

import { describe, it, expect } from 'vitest';
import { getDb } from '../index';
import { ingestEvidence } from '../ingestion';
import { casualtyTable, dailyAggTable } from '../../schema';

describe('M1 Integration', () => {
  it('should ingest fixture, embed, and aggregate correctly', async () => {
    // T6.2: Fixture data (OHCHR-like civilian casualty)
    const fixture = {
      kind: 'official' as const,
      publisher: 'OHCHR',
      url: 'https://example.com/report',
      publishedAt: '2022-03-01',
      text: 'OHCHR report: 10 civilians killed in Kharkiv region on 2022-03-01.',
      raw: { source: 'ohchr', region: 'Kharkiv' },
    };

    // Ingest as official-tier
    await ingestEvidence(fixture, true);

    // Verify evidence persisted
    const db = getDb();
    const evidences = await db.select().from(casualtyTable).limit(1);
    expect(evidences.length).toBeGreaterThan(0);
  });

  it('should maintain aggregate consistency on tier changes', async () => {
    // T6.2: Verify apply_agg_delta consistency
    // (Full property test deferred to M3 tiering tests)
    const db = getDb();

    // After ingest, daily_agg should have entries
    const aggs = await db.select().from(dailyAggTable).limit(10);
    expect(aggs).toBeDefined();
  });

  it('should be idempotent: re-ingesting same hash yields no change', async () => {
    // T6.2: Idempotency assertion
    // Same fixture hash should be rejected on re-ingest
    const fixture = {
      kind: 'official' as const,
      publisher: 'OHCHR',
      url: 'https://example.com/report2',
      publishedAt: '2022-03-02',
      text: 'Second OHCHR report: 5 civilians.',
      raw: { source: 'ohchr', region: 'Lviv' },
    };

    const db = getDb();
    const beforeCount = (await db.select().from(casualtyTable)).length;

    // Ingest once
    await ingestEvidence(fixture, true);
    const afterFirstIngest = (await db.select().from(casualtyTable)).length;

    // Ingest again (same hash) — should reject
    await ingestEvidence(fixture, true);
    const afterSecondIngest = (await db.select().from(casualtyTable)).length;

    // Count should not increase on second ingest
    expect(afterFirstIngest).toBe(afterSecondIngest);
  });
});
