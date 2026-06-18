import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeTally, applyThresholds, CandidateAssessment } from '../scoring';

const mockGetDb = vi.fn();
const mockCheckBudget = vi.fn();
const mockRetrieveCandidates = vi.fn();
const mockSubmitHaikuBatch = vi.fn();
const mockPollBatch = vi.fn();
const mockFetchResults = vi.fn();
const mockOpusCapReached = vi.fn();
const mockSubmitOpusBatch = vi.fn();
const mockWriteOutcome = vi.fn();

vi.mock('../index', () => ({
  getDb: () => mockGetDb(),
}));

vi.mock('../candidates', () => ({
  retrieveCandidates: (...args: unknown[]) => mockRetrieveCandidates(...args),
  findDedupTarget: vi.fn(() => null),
}));

vi.mock('../corroboration/budget', () => ({
  checkBudget: () => mockCheckBudget(),
  opusCapReached: () => mockOpusCapReached(),
}));

vi.mock('../corroboration/batch', () => ({
  submitHaikuBatch: (...args: unknown[]) => mockSubmitHaikuBatch(...args),
  submitOpusBatch: (...args: unknown[]) => mockSubmitOpusBatch(...args),
  pollBatch: (...args: unknown[]) => mockPollBatch(...args),
  fetchResults: (...args: unknown[]) => mockFetchResults(...args),
}));

vi.mock('../write-outcome', () => ({
  writeOutcome: (...args: unknown[]) => mockWriteOutcome(...args),
}));

import {
  couldCrossHeadline,
  facetsFromRaw,
  tickSubmit,
  tickProcess,
  tickOpus,
} from '../corroboration/worker';

const A5: CandidateAssessment[] = [
  { candidateId: 'news', where: 0.95, when: 0.9, what: 0.8, who: 0.2, relation: 'corroborates' },
  { candidateId: 'vid', where: 0.9, when: 0.85, what: 0.85, who: 0.1, relation: 'corroborates' },
  { candidateId: 'unrel', where: 0.2, when: 0.4, what: 0.5, who: 0.0, relation: 'unrelated' },
];

function chainSelect(resolved: unknown, withLimit = false) {
  const limit = vi.fn().mockResolvedValue(resolved);
  const where = withLimit
    ? vi.fn().mockReturnValue({ limit })
    : vi.fn().mockResolvedValue(resolved);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, limit };
}

function createDbMock(opts: {
  executeRows?: Array<Record<string, unknown>>;
  selectCalls?: Array<{ rows: unknown[]; withLimit?: boolean }>;
}) {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  const execute = vi.fn().mockResolvedValue(opts.executeRows ?? []);
  const selectCalls = [...(opts.selectCalls ?? [])];
  const select = vi.fn().mockImplementation(() => {
    const next = selectCalls.shift() ?? { rows: [], withLimit: false };
    return chainSelect(next.rows, next.withLimit ?? false);
  });

  mockGetDb.mockReturnValue({ execute, update, insert, select });
  return { execute, update, updateWhere, select, insert };
}

describe('§A.5 end-to-end decision path (pure)', () => {
  it('scores → ai_corroborated + escalate, and the Opus gate admits it', () => {
    const t = computeTally(A5);
    const d = applyThresholds({ top: t.top, c: t.c, k: t.k });
    expect(d.tier).toBe('ai_corroborated');
    expect(d.escalate).toBe(true);
    expect(couldCrossHeadline(t.top, d.escalationFlags)).toBe(true);
  });
});

describe('couldCrossHeadline gate (T4.1)', () => {
  const none = { nearDup: false, crossSide: false, contradiction: false };

  it('low-confidence map-only item is NOT worth Opus', () => {
    expect(couldCrossHeadline(0.66, none)).toBe(false);
  });

  it('near-dup against a counted casualty escalates regardless of top', () => {
    expect(couldCrossHeadline(0.5, { ...none, nearDup: true })).toBe(true);
  });

  it('cross-side conflict escalates', () => {
    expect(couldCrossHeadline(0.5, { ...none, crossSide: true })).toBe(true);
  });

  it('contradiction escalates', () => {
    expect(couldCrossHeadline(0.5, { ...none, contradiction: true })).toBe(true);
  });
});

describe('facetsFromRaw theater parsing', () => {
  it('uses theater from the evidence row when provided', () => {
    const facets = facetsFromRaw('{"text":"post"}', '2024-01-01', 'ukraine');
    expect(facets.theater).toBe('ukraine');
  });

  it('falls back to theater in raw JSON when row column is absent', () => {
    const facets = facetsFromRaw('{"text":"post","theater":"ukraine"}', '2024-01-01', null);
    expect(facets.theater).toBe('ukraine');
  });

  it('defaults to ukraine when theater is unknown', () => {
    const facets = facetsFromRaw('{"text":"post","theater":"mars"}', '2024-01-01', null);
    expect(facets.theater).toBe('ukraine');
  });
});

describe('tickSubmit reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckBudget.mockResolvedValue({ overCap: false, usd: 0, capUsd: 10 });
    mockRetrieveCandidates.mockResolvedValue([]);
    mockSubmitHaikuBatch.mockResolvedValue('batch-1');
  });

  it('degrades evidence without embedding to unverified instead of leaving scoring', async () => {
    const db = createDbMock({
      executeRows: [{
        id: 'ev-no-embed',
        raw: '{"text":"orphan post"}',
        published_at: '2024-01-01',
        embedding: null,
        theater: 'ukraine',
      }],
    });

    const result = await tickSubmit();

    expect(result).toEqual({ submitted: 0, degraded: 1 });
    expect(db.update).toHaveBeenCalled();
    expect(db.updateWhere).toHaveBeenCalled();
    expect(mockSubmitHaikuBatch).not.toHaveBeenCalled();
  });

  it('submits scorable items and degrades only those missing embeddings', async () => {
    const embedding = Array.from({ length: 4 }, (_, i) => i * 0.1);
    const db = createDbMock({
      executeRows: [
        {
          id: 'ev-ok',
          raw: '{"text":"scorable"}',
          published_at: '2024-01-01',
          embedding,
          theater: 'ukraine',
        },
        {
          id: 'ev-missing',
          raw: '{"text":"no vector"}',
          published_at: '2024-01-01',
          embedding: null,
          theater: 'ukraine',
        },
      ],
    });

    const result = await tickSubmit();

    expect(result.submitted).toBe(1);
    expect(result.degraded).toBe(0);
    expect(db.update).toHaveBeenCalled();
    expect(mockSubmitHaikuBatch).toHaveBeenCalledWith([
      { evidenceId: 'ev-ok', newPost: 'scorable', candidates: [] },
    ]);
  });
});

describe('tickProcess dedup embedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPollBatch.mockResolvedValue('ended');
    mockRetrieveCandidates.mockResolvedValue([]);
    mockWriteOutcome.mockResolvedValue(undefined);
  });

  it('re-fetches evidence embedding before retrieveCandidates (not empty [])', async () => {
    const embedding = [0.11, 0.22, 0.33, 0.44];
    createDbMock({
      selectCalls: [
        { rows: [{
          id: 'batch-1',
          providerId: 'prov-1',
          stage: 'haiku',
          status: 'submitted',
        }] },
        { rows: [{ corroStatus: 'scoring' }], withLimit: true },
        { rows: [{
          raw: '{"text":"dedup me"}',
          publishedAt: '2024-01-01',
          theater: 'ukraine',
        }], withLimit: true },
        { rows: [{ embedding, theater: 'ukraine' }], withLimit: true },
      ],
    });

    mockFetchResults.mockResolvedValue([{
      evidenceId: 'ev-dedup',
      assessment: {
        candidates: A5,
        geo: null,
      },
      costUsd: 0.01,
    }]);

    await tickProcess();

    const dedupCall = mockRetrieveCandidates.mock.calls.find((call) => call[0] === 'ev-dedup');
    expect(dedupCall).toBeDefined();
    expect(dedupCall?.[1]).toEqual(embedding);
    expect(dedupCall?.[1]).not.toEqual([]);
  });
});

describe('tickOpus duplicate prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpusCapReached.mockResolvedValue(false);
    mockRetrieveCandidates.mockResolvedValue([]);
    mockSubmitOpusBatch.mockResolvedValue('opus-batch-2');
  });

  it('excludes evidence IDs already in an active submitted opus batch', async () => {
    createDbMock({
      selectCalls: [
        { rows: [{
          providerId: 'opus-batch-1',
          stage: 'opus',
          status: 'submitted',
          evidenceIds: JSON.stringify(['ev-in-flight']),
        }] },
        { rows: [
          { id: 'ev-in-flight', raw: '{"text":"already queued"}', publishedAt: '2024-01-01', theater: 'ukraine', embedding: [0.1] },
          { id: 'ev-ready', raw: '{"text":"needs opus"}', publishedAt: '2024-01-02', theater: 'ukraine', embedding: [0.2] },
        ], withLimit: true },
      ],
    });

    const result = await tickOpus();

    expect(result).toEqual({ adjudicated: 1, capped: false });
    expect(mockSubmitOpusBatch).toHaveBeenCalledWith([
      { evidenceId: 'ev-ready', newPost: 'needs opus', candidates: [] },
    ]);
  });

  it('returns zero adjudicated when all escalating items are already in-flight', async () => {
    createDbMock({
      selectCalls: [
        { rows: [{
          providerId: 'opus-batch-1',
          stage: 'opus',
          status: 'submitted',
          evidenceIds: JSON.stringify(['ev-in-flight']),
        }] },
        { rows: [
          { id: 'ev-in-flight', raw: '{"text":"already queued"}', publishedAt: '2024-01-01', theater: 'ukraine', embedding: [0.1] },
        ], withLimit: true },
      ],
    });

    const result = await tickOpus();

    expect(result).toEqual({ adjudicated: 0, capped: false });
    expect(mockSubmitOpusBatch).not.toHaveBeenCalled();
  });
});