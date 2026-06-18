/**
 * M3·WS9 — Corroboration live-infra E2E (PR6)
 * DB-backed: idempotency, budget degradation, writeOutcome atomicity, Opus cap.
 * Anthropic Batch API is mocked; one path uses recorded batch-results.json.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { Side, Category, Audience, Tier } from '@peaceclock/api-types';
import { getDb } from '../index';
import {
  evidenceTable,
  casualtyTable,
  casualtyEvidenceTable,
  dailyAggTable,
  auditLogTable,
  carroBatchTable,
} from '../../schema';
import { spendMeter } from '../../schema/spend-meter';
import { writeOutcome } from '../write-outcome';
import { tickSubmit, tickProcess, tickOpus } from '../corroboration/worker';
import { BUDGET_CAP_USD, OPUS_DAILY_CAP_USD } from '../tiering.config';
import { recordModelCost } from '../cost';
import * as batch from '../corroboration/batch';
import * as candidates from '../candidates';
import type { ParsedResult } from '../corroboration/batch';
import batchFixture from './fixtures/batch-results.json';

const fixture = batchFixture as {
  batchId: string;
  parsed: ParsedResult[];
};

const EVIDENCE_A5 = '00000000-0000-4000-8000-000000000001';
const EVIDENCE_BUDGET = '00000000-0000-4000-8000-000000000002';
const EVIDENCE_WRITE = '00000000-0000-4000-8000-000000000003';
const EVIDENCE_OPUS = '00000000-0000-4000-8000-000000000004';
const CASUALTY_ANCHOR = '00000000-0000-4000-8000-000000000010';

const hasDb = Boolean(process.env.DATABASE_URL);

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function zeroEmbedding(): string {
  return `[${Array.from({ length: 1024 }, () => 0).join(',')}]`;
}

async function truncateWorkerTables() {
  const db = getDb();
  await db.execute(sql`
    TRUNCATE TABLE
      audit_log,
      map_point,
      casualty_evidence,
      casualty,
      daily_agg,
      corro_batch,
      evidence,
      spend_meter
    CASCADE
  `);
}

async function insertEvidence(opts: {
  id: string;
  corroStatus?: 'pending' | 'scoring' | 'escalating' | 'done' | 'unverified';
  contentHash?: string;
  raw?: string;
  withEmbedding?: boolean;
}) {
  const db = getDb();
  const embeddingSql = opts.withEmbedding === false
    ? sql`NULL`
    : sql`${zeroEmbedding()}::vector`;

  await db.execute(sql`
    INSERT INTO evidence (
      id, kind, publisher, raw, content_hash, embedding, geom, corro_status
    ) VALUES (
      ${opts.id}::uuid,
      'news',
      'fixture',
      ${opts.raw ?? JSON.stringify({
        text: 'Vovchansk column casualty report',
        side: 'russia',
        category: 'killed',
        audience: 'military',
        eventDate: '2024-06-15',
      })},
      ${opts.contentHash ?? `hash-${opts.id}`},
      ${embeddingSql},
      ST_GeogFromText('POINT(37.8 49.2)'),
      ${opts.corroStatus ?? 'pending'}
    )
  `);
}

describe.skipIf(!hasDb)('Worker E2E (live Postgres)', () => {
  beforeEach(async () => {
    await truncateWorkerTables();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('processes recorded batch fixture → osint casualty (recorded Haiku response)', async () => {
    await insertEvidence({ id: EVIDENCE_A5, corroStatus: 'scoring' });

    const db = getDb();
    await db.insert(carroBatchTable).values({
      providerId: fixture.batchId,
      stage: 'haiku',
      status: 'submitted',
      evidenceIds: JSON.stringify([EVIDENCE_A5]),
    });

    vi.spyOn(batch, 'pollBatch').mockResolvedValue('ended');
    vi.spyOn(batch, 'fetchResults').mockResolvedValue(fixture.parsed);
    vi.spyOn(batch, 'submitHaikuBatch');
    vi.spyOn(candidates, 'retrieveCandidates').mockResolvedValue([]);

    const first = await tickProcess();
    expect(first.processed).toBe(1);

    const casualties = await db.select().from(casualtyTable);
    expect(casualties).toHaveLength(1);
    expect(casualties[0].tier).toBe('osint');

    const [evidence] = await db
      .select()
      .from(evidenceTable)
      .where(eq(evidenceTable.id, EVIDENCE_A5));
    expect(evidence.corroStatus).toBe('done');

    const aggs = await db.select().from(dailyAggTable);
    expect(aggs.some((a) => a.tier === 'osint' && a.count === 1)).toBe(true);
  });

  it('re-delivered batch results for done evidence are a no-op (idempotency)', async () => {
    await insertEvidence({ id: EVIDENCE_A5, corroStatus: 'scoring' });

    const db = getDb();
    const [batchRow] = await db.insert(carroBatchTable).values({
      providerId: fixture.batchId,
      stage: 'haiku',
      status: 'submitted',
      evidenceIds: JSON.stringify([EVIDENCE_A5]),
    }).returning();

    vi.spyOn(batch, 'pollBatch').mockResolvedValue('ended');
    vi.spyOn(batch, 'fetchResults').mockResolvedValue(fixture.parsed);
    vi.spyOn(candidates, 'retrieveCandidates').mockResolvedValue([]);

    await tickProcess();

    const casualtyCountAfterFirst = (await db.select().from(casualtyTable)).length;
    const aggSumAfterFirst = (await db.select().from(dailyAggTable))
      .reduce((sum, row) => sum + (row.count ?? 0), 0);

    await db.update(carroBatchTable)
      .set({ status: 'submitted', endedAt: null })
      .where(eq(carroBatchTable.id, batchRow.id));

    const replay = await tickProcess();
    expect(replay.processed).toBe(0);

    expect((await db.select().from(casualtyTable)).length).toBe(casualtyCountAfterFirst);
    const aggSumAfterReplay = (await db.select().from(dailyAggTable))
      .reduce((sum, row) => sum + (row.count ?? 0), 0);
    expect(aggSumAfterReplay).toBe(aggSumAfterFirst);
  });

  it('budget cap degradation: over-cap items → unverified, no Haiku batch', async () => {
    const db = getDb();
    await db.insert(spendMeter).values({
      month: currentMonth(),
      usd: String(BUDGET_CAP_USD),
      capUsd: String(BUDGET_CAP_USD),
    });

    await insertEvidence({ id: EVIDENCE_BUDGET, corroStatus: 'pending' });

    const submitSpy = vi.spyOn(batch, 'submitHaikuBatch');

    const result = await tickSubmit();

    expect(result.submitted).toBe(0);
    expect(result.degraded).toBe(1);
    expect(submitSpy).not.toHaveBeenCalled();

    const [evidence] = await db
      .select()
      .from(evidenceTable)
      .where(eq(evidenceTable.id, EVIDENCE_BUDGET));
    expect(evidence.corroStatus).toBe('unverified');

    expect((await db.select().from(casualtyTable))).toHaveLength(0);
    expect((await db.select().from(carroBatchTable))).toHaveLength(0);
  });

  it('writeOutcome is atomic: create touches casualty, link, agg, audit together', async () => {
    await insertEvidence({ id: EVIDENCE_WRITE });

    const casualtyId = await writeOutcome({
      kind: 'create',
      evidenceId: EVIDENCE_WRITE,
      side: Side.RUSSIA,
      category: Category.KILLED,
      audience: Audience.MILITARY,
      eventDate: '2024-06-15',
      tier: Tier.AI_CORROBORATED,
      count: 1,
      matchScore: 0.75,
      actor: 'ai_haiku',
      reason: 'fixture create',
      costUsd: 0.002,
    });

    const db = getDb();
    const [casualty] = await db.select().from(casualtyTable).where(eq(casualtyTable.id, casualtyId));
    expect(casualty).toBeDefined();

    const links = await db
      .select()
      .from(casualtyEvidenceTable)
      .where(eq(casualtyEvidenceTable.evidenceId, EVIDENCE_WRITE));
    expect(links).toHaveLength(1);

    const [agg] = await db
      .select()
      .from(dailyAggTable)
      .where(sql`${dailyAggTable.day} = '2024-06-15' AND ${dailyAggTable.tier} = 'ai_corroborated'`);
    expect(agg?.count).toBe(1);

    const audits = await db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.casualtyId, casualtyId));
    expect(audits).toHaveLength(1);
    expect(Number(audits[0].modelCostUsd)).toBeCloseTo(0.002, 5);
  });

  it('writeOutcome rolls back entirely when merge target is missing', async () => {
    await insertEvidence({ id: EVIDENCE_WRITE });

    const db = getDb();
    const before = {
      casualties: (await db.select().from(casualtyTable)).length,
      links: (await db.select().from(casualtyEvidenceTable)).length,
      aggs: (await db.select().from(dailyAggTable)).length,
      audits: (await db.select().from(auditLogTable)).length,
    };

    await expect(writeOutcome({
      kind: 'merge',
      evidenceId: EVIDENCE_WRITE,
      targetCasualtyId: '00000000-0000-4000-8000-00000000ffff',
      actor: 'ai_haiku',
      reason: 'forced failure',
      costUsd: 0.001,
    })).rejects.toThrow();

    expect((await db.select().from(casualtyTable)).length).toBe(before.casualties);
    expect((await db.select().from(casualtyEvidenceTable)).length).toBe(before.links);
    expect((await db.select().from(dailyAggTable)).length).toBe(before.aggs);
    expect((await db.select().from(auditLogTable)).length).toBe(before.audits);
  });

  it('Opus gate respects daily cap — no new batch when cap reached', async () => {
    const db = getDb();

    await db.insert(casualtyTable).values({
      id: CASUALTY_ANCHOR,
      side: 'russia',
      category: 'killed',
      audience: 'military',
      eventDate: '2024-06-01',
      tier: 'ai_corroborated',
      status: 'counted',
    });

    await db.insert(auditLogTable).values({
      casualtyId: CASUALTY_ANCHOR,
      actor: 'ai_opus',
      action: 'tier_assign',
      modelCostUsd: String(OPUS_DAILY_CAP_USD),
      reason: 'saturate opus daily cap',
    });

    await insertEvidence({ id: EVIDENCE_OPUS, corroStatus: 'escalating' });

    const submitSpy = vi.spyOn(batch, 'submitOpusBatch');

    const result = await tickOpus();

    expect(result.capped).toBe(true);
    expect(result.adjudicated).toBe(0);
    expect(submitSpy).not.toHaveBeenCalled();
    expect((await db.select().from(carroBatchTable))).toHaveLength(0);
  });

  it('recordModelCost increments spend_meter for budget gate', async () => {
    await recordModelCost({
      itemId: EVIDENCE_WRITE,
      model: 'haiku',
      inputTokens: 1000,
      outputTokens: 200,
      usd: 0.0025,
      timestamp: new Date(),
    });

    const db = getDb();
    const [row] = await db
      .select()
      .from(spendMeter)
      .where(eq(spendMeter.month, currentMonth()));

    expect(row).toBeDefined();
    expect(Number(row.usd)).toBeCloseTo(0.0025, 4);
    expect(Number(row.capUsd)).toBe(BUDGET_CAP_USD);
  });
});