/**
 * UA confirmed military adapter (M1·WS5·T5.3)
 * Named-dead source-of-record for Ukrainian casualties.
 * Source decision blocked on PRD §10 (T5.3 carry-over).
 *
 * Candidates: UALosses, official memorials, memorial services.
 */

import { SourceAdapter, NormalizedEvidence } from '../ingestion';

export const uaConfirmedAdapter: SourceAdapter = {
  name: 'UA-Confirmed (TBD)',

  async fetchSince(watermark: string): Promise<NormalizedEvidence[]> {
    // TODO: Source decision required (PRD §10)
    // Once chosen, fetch and normalize like RU adapter
    throw new Error('UA source not yet decided (T5.3 blocked)');
  },

  normalize(raw: unknown): NormalizedEvidence {
    throw new Error('UA source not yet decided (T5.3 blocked)');
  },
};
