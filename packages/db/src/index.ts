import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    const client = postgres(databaseUrl);
    db = drizzle(client, { schema });
  }
  return db;
}

export { schema };
export type { evidenceTable } from '../schema';
// Tier config — re-exported so marketing/methodology content can't drift from code.
export {
  TIER_RANK,
  MATCH_WEIGHTS,
  TIER_THRESHOLDS,
  SCORE_FLOOR,
  DEFAULT_HEADLINE_THRESHOLD,
  computeMatchScore,
} from './tiering.config';
export { queryDailyAgg, querySideFreshness } from './counts';
export type { AggRow, SideFreshness } from './counts';
export { queryEvidenceDetail, resolveCellSources, queryCorroborationBasis } from './evidence';
export type { CellSourceFilter } from './evidence';
export { queryMapPins } from './map';
export type { MapPointRow } from './map';
export {
  THEATERS,
  DEFAULT_THEATER,
  theaterEpoch,
  enabledTheaters,
  isTheaterSlug,
} from './theater.config';
export type { TheaterSlug, TheaterConfig, TheaterBounds, TheaterSide } from './theater.config';
export { queryMap } from './map-query';
export type { MapQueryParams } from './map-query';
export {
  retrieveCandidates,
  findDedupTarget,
  CANDIDATE_SIM_FLOOR,
  CANDIDATE_TOP_K,
} from './candidates';
export type { Candidate, DedupTarget } from './candidates';
export {
  computeTally,
  applyThresholds,
  escalationTriggers,
  ASSESSMENT_SCHEMA,
} from './scoring';
export type {
  Relation,
  CandidateAssessment,
  GeoProposal,
  AssessmentResult,
  Tally,
  ScoredCandidate,
  LadderInput,
  LadderDecision,
  LadderTier,
  LadderAction,
  EscalationFlags,
  DedupCandidate,
} from './scoring';
export { writeOutcome, changeTier } from './write-outcome';
export type { Outcome, CreateOutcome, MergeOutcome, GeoPin } from './write-outcome';
export { queryAuditQueue, rejectCasualty, repositionCasualty } from './audit';
export type { AuditQueueItem } from './audit';
export {
  runTick,
  tickSubmit,
  tickProcess,
  tickOpus,
  tickOpusProcess,
  couldCrossHeadline,
} from './corroboration/worker';
export { checkBudget, opusSpentToday, opusCapReached } from './corroboration/budget';
export type { BudgetStatus } from './corroboration/budget';
export {
  submitHaikuBatch,
  submitOpusBatch,
  pollBatch,
  fetchResults,
} from './corroboration/batch';
export type { ScoringItem, ParsedResult, BatchStatus } from './corroboration/batch';
