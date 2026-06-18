/**
 * UA confirmed military adapter (M1·WS5·T5.3)
 * Named-dead source-of-record for Ukrainian casualties.
 *
 * BLOCKER (PRD §10, T5.3 carry-over):
 * No UA source-of-record has been selected yet. Candidates include UALosses,
 * official memorial registries, and memorial-service aggregators. Until product
 * signs off on a source, this adapter remains a documented stub and is excluded
 * from the ingest cron. The public counter will show asymmetry: OHCHR civilians
 * + RU confirmed military only (see METHODOLOGY.md).
 *
 * Candidates: UALosses, official memorials, memorial services.
 */

import { SourceAdapter, NormalizedEvidence } from '../ingestion';

/** Documented blocker — re-export for cron / ops visibility. */
export const UA_SOURCE_BLOCKER =
  'UA confirmed-military source undecided (PRD §10). Ship OHCHR + RU only.';

export const uaConfirmedAdapter: SourceAdapter = {
  name: 'UA-Confirmed (TBD)',

  async fetchSince(_watermark: string): Promise<NormalizedEvidence[]> {
    // Intentionally empty — source decision blocked (T5.3).
    console.warn(`[ua-confirmed] ${UA_SOURCE_BLOCKER}`);
    return [];
  },

  normalize(_raw: unknown): NormalizedEvidence {
    throw new Error(UA_SOURCE_BLOCKER);
  },
};