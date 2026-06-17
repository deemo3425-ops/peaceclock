/**
 * Batch corroboration calls (M3·WS1·T1.3, WS4·T4.2, EDD §8.1 Ticks C/D).
 * Haiku scoring + Opus adjudication via the Anthropic Batch API (−50%).
 * One custom_id per evidence id. Submit → poll → stream results → parse to
 * AssessmentResult. Per-item errors degrade to `unverified`; they don't block
 * the batch. Cost is attributed per item (WS6·T6.2).
 */

import Anthropic from '@anthropic-ai/sdk';
import { ASSESSMENT_TOOL, systemPrefix, buildUserContent } from './prompt';
import type { Candidate } from '../candidates';
import type { AssessmentResult } from '../scoring';
import { recordModelCost } from '../cost';

const HAIKU = 'claude-haiku-4-5';
const OPUS = 'claude-opus-4-8';
const BATCH_DISCOUNT = 0.5;

const PRICING = {
  [HAIKU]: { input: 1, output: 5 },
  [OPUS]: { input: 5, output: 25 },
} as const;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ScoringItem {
  evidenceId: string;
  newPost: string;
  candidates: Candidate[];
}

type Model = typeof HAIKU | typeof OPUS;

function buildRequests(items: ScoringItem[], model: Model) {
  return items.map((item) => ({
    custom_id: item.evidenceId,
    params: {
      model,
      max_tokens: 1500,
      system: systemPrefix(),
      messages: [{ role: 'user' as const, content: buildUserContent(item.newPost, item.candidates) }],
      tools: [ASSESSMENT_TOOL],
      tool_choice: { type: 'tool' as const, name: 'record_assessment' },
    },
  }));
}

/** Submit a scoring/adjudication batch; returns the provider batch id. */
export async function submitBatch(items: ScoringItem[], model: Model = HAIKU): Promise<string> {
  if (items.length === 0) throw new Error('submitBatch: no items');
  const batch = await getClient().beta.messages.batches.create({
    requests: buildRequests(items, model) as any,
  });
  return batch.id;
}

export const submitHaikuBatch = (items: ScoringItem[]) => submitBatch(items, HAIKU);
export const submitOpusBatch = (items: ScoringItem[]) => submitBatch(items, OPUS);

export type BatchStatus = 'in_progress' | 'ended' | 'canceling';

/** Poll batch processing status. */
export async function pollBatch(batchId: string): Promise<BatchStatus> {
  const b = await getClient().beta.messages.batches.retrieve(batchId);
  return b.processing_status as BatchStatus;
}

export interface ParsedResult {
  evidenceId: string;
  assessment: AssessmentResult | null; // null = errored/expired → unverified
  costUsd: number;
}

function costOf(model: Model, usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }): number {
  const rates = PRICING[model];
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  return ((input * rates.input + output * rates.output) / 1_000_000) * BATCH_DISCOUNT;
}

/**
 * Stream and parse results for an ended batch. Records per-item cost.
 * Robust to per-item `errored`/`expired`/`canceled` (→ assessment null).
 */
export async function fetchResults(batchId: string, model: Model = HAIKU): Promise<ParsedResult[]> {
  const out: ParsedResult[] = [];
  const results = await getClient().beta.messages.batches.results(batchId);

  for await (const entry of results) {
    const evidenceId = entry.custom_id;
    if (entry.result.type !== 'succeeded') {
      out.push({ evidenceId, assessment: null, costUsd: 0 });
      continue;
    }
    const message = entry.result.message;
    const cost = costOf(model, message.usage as any);
    recordModelCost({
      itemId: evidenceId,
      model: model === HAIKU ? 'haiku' : 'opus',
      inputTokens: (message.usage as any).input_tokens ?? 0,
      outputTokens: (message.usage as any).output_tokens ?? 0,
      usd: cost,
      timestamp: new Date(),
    });

    const toolUse = message.content.find((b: any) => b.type === 'tool_use');
    const assessment = toolUse ? ((toolUse as any).input as AssessmentResult) : null;
    out.push({ evidenceId, assessment, costUsd: cost });
  }

  return out;
}
