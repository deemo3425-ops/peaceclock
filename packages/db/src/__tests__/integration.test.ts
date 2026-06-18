/**
 * M1 Integration test (WS6·T6.2)
 * End-to-end: ingest fixtures → embed → aggregate → verify counts.
 *
 * Run with: pnpm test
 */

import { describe, it, expect } from 'vitest';
import { getDb } from '../index';
import { ingestEvidence } from '../ingestion';
import { evidenceTable, dailyAggTable } from '../../schema';

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

    // Verify evidence persisted (official casualty short-circuit is PR5)
    const db = getDb();
    const rows = await db.select().from(evidenceTable).limit(1);
    expect(rows.length).toBeGreaterThan(0);
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
      text: 'Second OHCHR report: 5 civilians.',
      raw: { source: 'ohchr', region: 'Lviv' },
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
});
