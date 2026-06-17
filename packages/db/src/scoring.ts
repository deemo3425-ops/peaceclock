/**
 * Corroboration scoring & threshold ladder (M3·WS1/WS2, PRD §A.3/§A.5, EDD §8.1).
 * Pure, deterministic, DB-free — the worker (WS3) and Opus stage (WS4) call
 * these; weights/thresholds live in tiering.config (NOT in the model prompt).
 */

import {
  computeMatchScore,
  TIER_THRESHOLDS,
  SCORE_FLOOR,
  CONTRADICTION_CLEAR_MARGIN,
} from './tiering.config';

// ── T1.1 — assessment output schema (structured output) ──────────────────────

export type Relation = 'corroborates' | 'contradicts' | 'unrelated';

/** Per-candidate sub-scores the model returns; the worker computes `s`. */
export interface CandidateAssessment {
  candidateId: string;
  where: number; // [0,1]
  when: number; // [0,1]
  what: number; // [0,1]
  who: number; // [0,1]
  relation: Relation;
}

export interface GeoProposal {
  lat: number;
  lng: number;
  confidence: number; // [0,1]
}

export interface AssessmentResult {
  candidates: CandidateAssessment[];
  geo: GeoProposal | null;
}

/**
 * JSON schema for the model's structured output (Haiku/Opus). Sub-scores only —
 * the composite `s` and all tier logic are computed in code from these.
 */
export const ASSESSMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates', 'geo'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateId', 'where', 'when', 'what', 'who', 'relation'],
        properties: {
          candidateId: { type: 'string' },
          where: { type: 'number', minimum: 0, maximum: 1 },
          when: { type: 'number', minimum: 0, maximum: 1 },
          what: { type: 'number', minimum: 0, maximum: 1 },
          who: { type: 'number', minimum: 0, maximum: 1 },
          relation: { type: 'string', enum: ['corroborates', 'contradicts', 'unrelated'] },
        },
      },
    },
    geo: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['lat', 'lng', 'confidence'],
      properties: {
        lat: { type: 'number', minimum: -90, maximum: 90 },
        lng: { type: 'number', minimum: -180, maximum: 180 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
  },
} as const;

// ── T1.4 — deterministic s / c / k ───────────────────────────────────────────

export interface ScoredCandidate {
  candidateId: string;
  s: number;
  relation: Relation;
}

export interface Tally {
  scored: ScoredCandidate[]; // candidates with s ≥ SCORE_FLOOR (corroborate/contradict)
  c: number; // corroborators above floor
  k: number; // contradictions above floor
  top: number; // max s above floor (0 if none)
}

/**
 * Compute s = .30·where+.25·when+.25·what+.20·who per candidate, then tally
 * corroborators/contradictions above the s ≥ SCORE_FLOOR floor (§A.5 Step 2).
 * `unrelated` items never count regardless of score.
 */
export function computeTally(assessments: CandidateAssessment[]): Tally {
  const scored: ScoredCandidate[] = [];
  let c = 0;
  let k = 0;
  let top = 0;

  for (const a of assessments) {
    const s = computeMatchScore(a.where, a.when, a.what, a.who);
    if (a.relation === 'unrelated' || s < SCORE_FLOOR) continue;
    scored.push({ candidateId: a.candidateId, s, relation: a.relation });
    if (s > top) top = s;
    if (a.relation === 'corroborates') c += 1;
    else if (a.relation === 'contradicts') k += 1;
  }

  return { scored, c, k, top };
}

// ── T2.1 / T2.2 — threshold ladder + escalation ──────────────────────────────

export type LadderTier = 'osint' | 'ai_corroborated' | null;
export type LadderAction = 'merge' | 'count' | 'unverified';

/** Best dedup candidate: top match against an already-counted canonical casualty. */
export interface DedupCandidate {
  s: number;
  isCountedCanonical: boolean;
  targetCasualtyId: string;
}

export interface LadderInput {
  top: number;
  c: number;
  k: number;
  dedup?: DedupCandidate;
  crossSideConflict?: boolean;
  sensitiveMedia?: boolean;
}

export interface EscalationFlags {
  grayBand: boolean;
  contradiction: boolean;
  nearDup: boolean;
  crossSide: boolean;
  sensitive: boolean;
}

export interface LadderDecision {
  tier: LadderTier;
  action: LadderAction;
  escalate: boolean;
  escalationFlags: EscalationFlags;
  dedupTargetId?: string;
}

/** T2.2 — which §A.3 rule-5 escalation triggers fire. */
export function escalationTriggers(input: LadderInput): EscalationFlags {
  const { top, c, k, dedup } = input;
  const g = TIER_THRESHOLDS.grayBand;
  const nd = TIER_THRESHOLDS.nearDup;
  return {
    grayBand: top >= g.matchScoreMin && top <= g.matchScoreMax,
    contradiction: k >= 1 && c - k < CONTRADICTION_CLEAR_MARGIN,
    nearDup: dedup != null && dedup.isCountedCanonical && dedup.s >= nd.matchScoreMin && dedup.s < nd.matchScoreMax,
    crossSide: input.crossSideConflict === true,
    sensitive: input.sensitiveMedia === true,
  };
}

/**
 * T2.1 — apply the §A.3 ladder in order. Escalation is a cross-cutting flag
 * (rule 5) layered on the tier decision, not a separate branch.
 */
export function applyThresholds(input: LadderInput): LadderDecision {
  const { top, c, k, dedup } = input;
  const flags = escalationTriggers(input);
  const escalate =
    flags.grayBand || flags.contradiction || flags.nearDup || flags.crossSide || flags.sensitive;

  // Rule 1 — duplicate / merge: s ≥ 0.90 against an already-counted casualty.
  if (dedup && dedup.isCountedCanonical && dedup.s >= TIER_THRESHOLDS.dedup) {
    return {
      tier: null,
      action: 'merge',
      escalate: false, // a confirmed merge is not adjudicated
      escalationFlags: flags,
      dedupTargetId: dedup.targetCasualtyId,
    };
  }

  // Rule 4 (guard) — contradictions dominate → not counted.
  if (k >= c) {
    return { tier: null, action: 'unverified', escalate, escalationFlags: flags };
  }

  // Rule 2 — OSINT.
  const o = TIER_THRESHOLDS.osint;
  if (top >= o.matchScore && c >= o.minCorroborators && k <= o.maxContradictions) {
    return { tier: 'osint', action: 'count', escalate, escalationFlags: flags };
  }

  // Rule 3 — AI-corroborated.
  const ai = TIER_THRESHOLDS.aiCorroborated;
  if (top >= ai.matchScoreMin && top < ai.matchScoreMax && c >= ai.minCorroborators && c > k) {
    return { tier: 'ai_corroborated', action: 'count', escalate, escalationFlags: flags };
  }

  // Rule 4 — fallthrough: below 0.70 or otherwise unqualified.
  return { tier: null, action: 'unverified', escalate, escalationFlags: flags };
}
