/**
 * OHCHR civilian casualties adapter (M1·WS5·T5.1)
 * Fetches OHCHR reports on civilian casualties in Ukraine.
 * Source: https://www.ohchr.org/en/countries/ua
 *
 * For M1, uses fixture data; real API integration in M2+.
 */

import { SourceAdapter, NormalizedEvidence, ingestEvidence } from '../ingestion';

export const ohchrAdapter: SourceAdapter = {
  name: 'OHCHR',

  async fetchSince(watermark: string): Promise<NormalizedEvidence[]> {
    // TODO: Fetch from OHCHR API since watermark
    // For M1: return fixture data
    return [];
  },

  normalize(raw: unknown): NormalizedEvidence {
    // TODO: Parse OHCHR report format into NormalizedEvidence
    throw new Error('not implemented');
  },
};

/**
 * Backfill OHCHR civilian series (T5.1, M1).
 * Fixture: hardcoded confirmed civilian counts for key dates.
 * Real backfill will fetch from OHCHR historical reports.
 */
export async function backfillOhchr(): Promise<void> {
  console.log('[ohchr] backfill not yet implemented (M1 fixtures only)');
  // TODO: Fetch OHCHR historical reports 2022-02-24 → present
  // Parse, ingest as official-tier civilian casualties
}
