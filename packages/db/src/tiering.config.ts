/**
 * Tier definitions and match-score weights (M1·WS2, PRD §A, EDD §2.1)
 * Tunable constants locked by tests pinned to §A.5 worked example.
 */

// Tier ordering (T2.1): official (highest) → confirmed → osint → ai_corroborated (lowest)
export const TIER_RANK = {
  official: 4,
  confirmed: 3,
  osint: 2,
  ai_corroborated: 1,
} as const;

// Match-score sub-dimension weights (§A.2, T2.1)
export const MATCH_WEIGHTS = {
  where: 0.3, // geographic accuracy
  when: 0.25, // temporal accuracy
  what: 0.25, // event type/count accuracy
  who: 0.2, // identity/affiliation accuracy
} as const;

// Sum of weights should be 1.0
const weightSum =
  MATCH_WEIGHTS.where +
  MATCH_WEIGHTS.when +
  MATCH_WEIGHTS.what +
  MATCH_WEIGHTS.who;
if (Math.abs(weightSum - 1.0) > 0.0001) {
  throw new Error(`MATCH_WEIGHTS sum to ${weightSum}, expected 1.0`);
}

/**
 * Compute composite match score from sub-dimensions (§A.2).
 * Each sub-dimension is [0, 1].
 */
export function computeMatchScore(
  where: number,
  when: number,
  what: number,
  who: number
): number {
  return (
    MATCH_WEIGHTS.where * where +
    MATCH_WEIGHTS.when * when +
    MATCH_WEIGHTS.what * what +
    MATCH_WEIGHTS.who * who
  );
}

/**
 * Tier thresholds (§A.3, T2.1) — match score floors for tier admission.
 * Higher score → higher tier (more confident).
 */
export const TIER_THRESHOLDS = {
  dedup: 0.9, // exact duplicate candidate (against an already-counted casualty)
  osint: {
    matchScore: 0.85,
    minCorroborators: 2,
    maxContradictions: 0,
  },
  aiCorroborated: {
    matchScoreMin: 0.7,
    matchScoreMax: 0.85,
    minCorroborators: 1,
  },
  grayBand: {
    matchScoreMin: 0.65,
    matchScoreMax: 0.78,
    // If a score lands here, escalate to Opus for human-like judgment.
  },
  nearDup: {
    // 0.85 ≤ s < 0.90 against a counted casualty → escalate (rule 5).
    matchScoreMin: 0.85,
    matchScoreMax: 0.9,
  },
} as const;

/**
 * Candidate score floor (§A.5 Step 2) — only candidates with s ≥ this count
 * toward c (corroborators) / k (contradictions).
 */
export const SCORE_FLOOR = 0.6;

/**
 * A contradiction (k ≥ 1) is "clearly outweighed" only when corroborators
 * exceed contradictions by at least this margin; otherwise escalate (rule 5).
 * v1 starting value — tune against audit outcomes (T7.4).
 */
export const CONTRADICTION_CLEAR_MARGIN = 2;

/**
 * Default monthly AI budget cap (T0.5, M1).
 * Can be overridden per deployment; tuned in M7 based on real usage.
 */
export const BUDGET_CAP_USD = 30; // prod launch cap (≤$50/mo total budget)

/**
 * Default daily Opus cap (M3·T4.1, EDD §8.1).
 * Prevents runaway Opus costs during escalation storms.
 */
export const OPUS_DAILY_CAP_USD = 10;

/**
 * Default headline threshold (PRD §3, M2/M6).
 * Tiers at or above this determine the public headline count.
 */
export const DEFAULT_HEADLINE_THRESHOLD = 'confirmed';
