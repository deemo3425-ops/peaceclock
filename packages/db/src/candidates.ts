/**
 * Candidate retrieval & dedup prefilter (M3·WS0, EDD §8.1 Tick B).
 * pgvector cosine top-K over prior evidence — the cheap prefilter that selects
 * what the LLM scores. NO model call here. Dedup (T0.2) keys off whether a
 * high-similarity neighbor is an already-counted canonical casualty.
 */

import { getDb } from './index';
import { sql } from 'drizzle-orm';
import { TIER_THRESHOLDS } from './tiering.config';
import { DEFAULT_THEATER, type TheaterSlug } from './theater.config';

/** Cosine-similarity floor for prefilter candidacy (EDD §8.1). */
export const CANDIDATE_SIM_FLOOR = 0.6;
export const CANDIDATE_TOP_K = 20;

export interface Candidate {
  evidenceId: string;
  publisher: string;
  text: string; // raw payload for the model
  sim: number; // cosine similarity in [0,1]
  casualtyId: string | null; // linked canonical casualty, if any
  isCountedCanonical: boolean; // counted + canonical → dedup target eligible
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * T0.1 — top-K prior evidence by cosine similarity to `embedding`, sim ≥ floor,
 * excluding `selfEvidenceId`. Joined to any linked casualty so the caller can
 * apply the dedup rule. ivfflat index on evidence.embedding serves the ORDER BY.
 */
export async function retrieveCandidates(
  selfEvidenceId: string,
  embedding: number[],
  k: number = CANDIDATE_TOP_K,
  floor: number = CANDIDATE_SIM_FLOOR,
  theater: TheaterSlug = DEFAULT_THEATER,
): Promise<Candidate[]> {
  const db = getDb();
  const vec = toVectorLiteral(embedding);

  const rows = await db.execute(sql`
    SELECT
      e.id AS evidence_id,
      e.publisher AS publisher,
      e.raw AS text,
      ce.casualty_id AS casualty_id,
      c.is_canonical AS is_canonical,
      c.status AS status,
      1 - (e.embedding <=> ${vec}::vector) AS sim
    FROM evidence e
    LEFT JOIN casualty_evidence ce ON ce.evidence_id = e.id
    LEFT JOIN casualty c ON c.id = ce.casualty_id
    WHERE e.id <> ${selfEvidenceId}
      AND e.theater = ${theater}
      AND e.embedding IS NOT NULL
      AND 1 - (e.embedding <=> ${vec}::vector) >= ${floor}
    ORDER BY e.embedding <=> ${vec}::vector ASC
    LIMIT ${k}
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    evidenceId: String(r.evidence_id),
    publisher: String(r.publisher ?? ''),
    text: String(r.text ?? ''),
    sim: Number(r.sim),
    casualtyId: r.casualty_id ? String(r.casualty_id) : null,
    isCountedCanonical: r.is_canonical === true && r.status === 'counted',
  }));
}

export interface DedupTarget {
  casualtyId: string;
  evidenceId: string;
  sim: number;
}

/**
 * T0.2 — best dedup target: the highest-similarity candidate that is an
 * already-counted canonical casualty AND meets the dedup floor (s ≥ 0.90).
 * Returns null if none — the item is then a new count, not a merge.
 * Note: `sim` here is the embedding cosine; the LLM match-score `s` confirms
 * the merge in applyThresholds. We pass the strongest counted neighbor through.
 */
export function findDedupTarget(candidates: Candidate[]): DedupTarget | null {
  let best: DedupTarget | null = null;
  for (const c of candidates) {
    if (!c.isCountedCanonical || !c.casualtyId) continue;
    if (c.sim < TIER_THRESHOLDS.dedup) continue;
    if (!best || c.sim > best.sim) {
      best = { casualtyId: c.casualtyId, evidenceId: c.evidenceId, sim: c.sim };
    }
  }
  return best;
}
