/**
 * RU confirmed military adapter (M1·WS5·T5.2)
 * Named-dead source-of-record for Russian casualties.
 * Source candidates: Mediazona, BBC Monitoring (T5.2 notes)
 *
 * M1: fixture-driven; real API integration in M2+.
 */

import { SourceAdapter, NormalizedEvidence } from '../ingestion';
import ruFixtures from './fixtures/ru-confirmed.json';

export interface RuConfirmedFixtureRow {
  id: string;
  source: 'Mediazona' | 'BBC';
  publishedAt: string;
  eventDate: string;
  name: string;
  url: string;
  location: string;
}

function loadFixtures(): RuConfirmedFixtureRow[] {
  return ruFixtures as RuConfirmedFixtureRow[];
}

function buildText(row: RuConfirmedFixtureRow): string {
  return (
    `${row.source} confirmed Russian military casualty: ${row.name} ` +
    `killed near ${row.location} on ${row.eventDate}. Record id ${row.id}.`
  );
}

function rowToEvidence(row: RuConfirmedFixtureRow): NormalizedEvidence {
  return {
    kind: 'news',
    publisher: row.source,
    url: row.url,
    publishedAt: row.publishedAt,
    text: buildText(row),
    raw: {
      source: row.source.toLowerCase(),
      recordId: row.id,
      name: row.name,
      location: row.location,
      casualty: {
        side: 'russia',
        category: 'killed',
        audience: 'military',
        eventDate: row.eventDate,
        count: 1,
        tier: 'confirmed',
        dedupKey: `ru-named:${row.name.toLowerCase().trim()}`,
      },
    },
  };
}

export const ruConfirmedAdapter: SourceAdapter = {
  name: 'RU-Confirmed (Mediazona/BBC)',

  async fetchSince(watermark: string): Promise<NormalizedEvidence[]> {
    return loadFixtures()
      .filter((row) => row.publishedAt > watermark)
      .map(rowToEvidence)
      .sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));
  },

  normalize(raw: unknown): NormalizedEvidence {
    return rowToEvidence(raw as RuConfirmedFixtureRow);
  },
};