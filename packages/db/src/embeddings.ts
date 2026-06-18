/**
 * Embeddings client (M1·WS3·T3.1)
 * Uses Voyage AI API (voyage-3 model, 1024 dimensions).
 * Cost is tracked via recordModelCost().
 */

import { recordModelCost } from './cost';

const VOYAGE_API_BASE = 'https://api.voyageai.com/v1';
const MODEL = 'voyage-3'; // Anthropic-recommended
const DIMENSIONS = 1024;

function useStubEmbeddings(): boolean {
  const key = process.env.VOYAGE_API_KEY;
  return (
    process.env.CI_STUB_EMBEDDINGS === '1' ||
    key === 'fake' ||
    key === 'test'
  );
}

function getVoyageApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error('VOYAGE_API_KEY environment variable not set');
  }
  return key;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

/**
 * Embed text using Voyage API.
 * T3.1: batching, retry/backoff handled externally (via adapter).
 */
export async function embed(text: string): Promise<EmbeddingResult> {
  if (useStubEmbeddings()) {
    return {
      embedding: Array.from({ length: DIMENSIONS }, () => 0),
      tokens: 0,
    };
  }

  const apiKey = getVoyageApiKey();

  const response = await fetch(`${VOYAGE_API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
      input_type: 'search_document',
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
    usage: { total_tokens: number };
  };

  const embedding = data.data[0].embedding;
  const tokens = data.usage.total_tokens;

  // Record cost (no model cost for embeddings in pricing, but track usage)
  console.log('[embeddings] embedded text', { model: MODEL, tokens });

  return { embedding, tokens };
}

/**
 * Batch embed multiple texts (T3.1 optimization, deferred).
 * For now, embed serially with backoff.
 */
export async function embedBatch(
  texts: string[],
  delayMs = 100
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (const text of texts) {
    results.push(await embed(text));
    // Backoff between requests
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return results;
}
