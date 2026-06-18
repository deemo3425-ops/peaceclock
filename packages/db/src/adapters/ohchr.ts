/**
 * OHCHR civilian casualties adapter (M1·WS5·T5.1)
 * Fetches OHCHR reports on civilian casualties in Ukraine.
 * Source: https://www.ohchr.org/en/countries/ua
 *
 * M1: fixture-driven; real API integration in M2+.
 */

import { SourceAdapter, NormalizedEvidence, runAdapters } from '../ingestion';
import { setWatermark } from '../watermark';
import ohchrFixtures from './fixtures/ohchr.json';

export interface OhchrFixtureRow {
  id: string;
  reportDate: string;
  publishedAt: string;
  url: string;
  region: string;
  killed: number;
  wounded: number;
  side: 'ua_coalition' | 'russia';
  audience: 'civilian' | 'military';
}

function loadFixtures(): OhchrFixtureRow[] {
  return ohchrFixtures as OhchrFixtureRow[];
}

function buildText(row: OhchrFixtureRow, category: 'killed' | 'wounded', count: number): string {
  return (
    `OHCHR Ukraine civilian casualties update (${row.reportDate}): ` +
    `${count} civilians ${category} in ${row.region} region. ` +
    `Source report id ${row.id}.`
  );
}

function rowToEvidence(
  row: OhchrFixtureRow,
  category: 'killed' | 'wounded',
  count: number,
): NormalizedEvidence {
  return {
    kind: 'official',
    publisher: 'OHCHR',
    url: row.url,
    publishedAt: row.publishedAt,
    text: buildText(row, category, count),
    raw: {
      source: 'ohchr',
      reportId: row.id,
      region: row.region,
      casualty: {
        side: row.side,
        category,
        audience: row.audience,
        eventDate: row.reportDate,
        count,
        tier: 'official',
      },
    },
  };
}

export const ohchrAdapter: SourceAdapter = {
  name: 'OHCHR',

  async fetchSince(watermark: string): Promise<NormalizedEvidence[]> {
    const rows = loadFixtures().filter((row) => row.publishedAt > watermark);
    const out: NormalizedEvidence[] = [];

    for (const row of rows) {
      if (row.killed > 0) {
        out.push(rowToEvidence(row, 'killed', row.killed));
      }
      if (row.wounded > 0) {
        out.push(rowToEvidence(row, 'wounded', row.wounded));
      }
    }

    return out.sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));
  },

  normalize(raw: unknown): NormalizedEvidence {
    const row = raw as OhchrFixtureRow;
    const category = row.killed > 0 ? 'killed' : 'wounded';
    const count = category === 'killed' ? row.killed : row.wounded;
    return rowToEvidence(row, category, count);
  },
};

/**
 * Backfill OHCHR civilian series (T5.1, M1).
 * Resets watermark and re-runs the adapter against all fixtures.
 */
export async function backfillOhchr(): Promise<void> {
  await setWatermark(ohchrAdapter.name, '2022-02-23');
  await runAdapters([ohchrAdapter]);
  console.log('[ohchr] backfill complete');
}