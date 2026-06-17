/**
 * Ingestion framework (M1·WS4, EDD §7)
 * Adapter interface, triage, official-tier short-circuit.
 */

import crypto from 'crypto';
import { getDb } from './index';
import { evidenceTable } from '../schema';
import { embed } from './embeddings';
import { applyAggDelta } from './agg-delta';
import { eq } from 'drizzle-orm';

/**
 * Raw evidence from a source (normalized).
 * T4.1: SourceAdapter.normalize() returns this.
 */
export interface NormalizedEvidence {
  kind: 'official' | 'news' | 'x_post';
  publisher: string;
  url?: string;
  publishedAt?: string; // ISO date
  text: string;
  raw: Record<string, unknown>; // full payload
}

/**
 * SourceAdapter interface (T4.1, EDD §7).
 * Each source (OHCHR, Mediazona, X OSINT) implements this.
 */
export interface SourceAdapter {
  name: string;
  fetchSince(watermark: string): Promise<NormalizedEvidence[]>;
  normalize(raw: unknown): NormalizedEvidence;
}

/**
 * Compute content hash for dedup (T4.2).
 * Deterministic hash of the normalized text.
 */
function computeContentHash(evidence: NormalizedEvidence): string {
  const canonical = JSON.stringify({
    kind: evidence.kind,
    publisher: evidence.publisher,
    text: evidence.text.trim(),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Triage: drop exact/near-duplicate, apply allowlist, filter junk (T4.2).
 * Returns true if evidence should be ingested, false if filtered out.
 */
async function triage(evidence: NormalizedEvidence, hash: string): Promise<boolean> {
  const db = getDb();

  // Exact duplicate check (content_hash unique constraint in DB, but check first)
  const existing = await db
    .select()
    .from(evidenceTable)
    .where(eq(evidenceTable.contentHash, hash))
    .limit(1);

  if (existing.length > 0) {
    console.log('[triage] drop exact duplicate', { hash });
    return false;
  }

  // Source allowlist (all kinds allowed in M1; stricter in M3)
  const allowedPublishers = ['OHCHR', 'Mediazona', 'BBC', 'UALosses'];
  if (!allowedPublishers.includes(evidence.publisher)) {
    console.log('[triage] drop unlisted publisher', { publisher: evidence.publisher });
    return false;
  }

  // Junk filter: minimum text length
  if (evidence.text.trim().length < 20) {
    console.log('[triage] drop low-content', { hash });
    return false;
  }

  return true;
}

/**
 * Ingest evidence: persist, embed, enqueue corroboration (T4.2).
 * Official sources short-circuit to casualty (T4.3).
 */
export async function ingestEvidence(
  evidence: NormalizedEvidence,
  isOfficial: boolean
): Promise<void> {
  const hash = computeContentHash(evidence);

  // Triage
  const shouldIngest = await triage(evidence, hash);
  if (!shouldIngest) {
    return;
  }

  // Embed
  const { embedding } = await embed(evidence.text);

  // Persist evidence
  const db = getDb();
  const result = await db
    .insert(evidenceTable)
    .values({
      theater: 'ukraine',
      kind: evidence.kind,
      publisher: evidence.publisher,
      url: evidence.url,
      publishedAt: evidence.publishedAt,
      raw: JSON.stringify(evidence.raw),
      contentHash: hash,
      embedding,
      geom: 'POINT(0 0)', // placeholder; AI/audit fills in
      corroStatus: isOfficial ? 'done' : 'pending',
    })
    .returning({ id: evidenceTable.id });

  const evidenceId = result[0].id;
  console.log('[ingest] evidence persisted', { evidenceId, hash });

  // Official-tier short-circuit: mint casualty immediately (T4.3)
  // TODO: official source → casualty row (M1·T4.3)
}

/**
 * Run all adapters (stub for Vercel Cron, T4.1).
 */
export async function runAdapters(adapters: SourceAdapter[]): Promise<void> {
  for (const adapter of adapters) {
    console.log(`[ingest] running adapter: ${adapter.name}`);
    // TODO: Get watermark, fetch, ingest
  }
}
