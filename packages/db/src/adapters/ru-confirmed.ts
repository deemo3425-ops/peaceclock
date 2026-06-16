/**
 * RU confirmed military adapter (M1·WS5·T5.2)
 * Named-dead source-of-record for Russian casualties.
 * Source candidates: Mediazona, BBC Monitoring (T5.2 notes)
 */

import { SourceAdapter, NormalizedEvidence } from '../ingestion';

export const ruConfirmedAdapter: SourceAdapter = {
  name: 'RU-Confirmed (Mediazona/BBC)',

  async fetchSince(watermark: string): Promise<NormalizedEvidence[]> {
    // TODO: Fetch from Mediazona API / BBC RSS since watermark
    return [];
  },

  normalize(raw: unknown): NormalizedEvidence {
    // TODO: Parse named-dead report into NormalizedEvidence
    throw new Error('not implemented');
  },
};
