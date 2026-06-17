/**
 * Evidence / source-attribution data access (M2·WS2, PRD §6.3).
 * T2.1: detail for one evidence id. T2.2: resolve the backing sources for a
 * count cell (side, category, audience, date range, eligible tiers).
 *
 * Side/tier/date live on `casualty`, linked via `casualty_evidence`.
 * Links only — no graphic media embedded (PRD §9). AI-corroboration detail
 * (corroborators, contradictions, matchScore beyond the casualty's) is M3.
 */

import { getDb } from './index';
import { evidenceTable, casualtyTable, casualtyEvidenceTable } from '../schema';
import { and, eq, gte, lte, inArray, desc, sql } from 'drizzle-orm';
import type { EvidenceDetail } from '@peaceclock/api-types';
import { Theater, Side, Tier, Category, Audience } from '@peaceclock/api-types';
import { DEFAULT_THEATER, type TheaterSlug } from './theater.config';

/** Map a joined evidence+casualty row to the public EvidenceDetail shape. */
function toDetail(e: {
  id: string;
  kind: string;
  publisher: string;
  url: string | null;
  publishedAt: string | null;
}, c: { theater: string; side: string; tier: string; eventDate: string; matchScore: number | null }): EvidenceDetail {
  return {
    id: e.id,
    theater: (c.theater as Theater) || Theater.UKRAINE,
    kind: e.kind as EvidenceDetail['kind'],
    publisher: e.publisher,
    url: e.url ?? '',
    publishedAt: e.publishedAt ?? '',
    side: c.side as Side,
    tier: c.tier as Tier,
    date: c.eventDate,
    matchScore: c.matchScore ?? undefined,
  };
}

/**
 * T2.1 — detail for one evidence id, via its canonical backing casualty.
 * Returns null if the id is unknown (route maps to 404).
 */
export async function queryEvidenceDetail(id: string): Promise<EvidenceDetail | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: evidenceTable.id,
      kind: evidenceTable.kind,
      publisher: evidenceTable.publisher,
      url: evidenceTable.url,
      publishedAt: evidenceTable.publishedAt,
      theater: casualtyTable.theater,
      side: casualtyTable.side,
      tier: casualtyTable.tier,
      eventDate: casualtyTable.eventDate,
      matchScore: casualtyTable.matchScore,
    })
    .from(evidenceTable)
    .leftJoin(casualtyEvidenceTable, eq(casualtyEvidenceTable.evidenceId, evidenceTable.id))
    .leftJoin(casualtyTable, eq(casualtyTable.id, casualtyEvidenceTable.casualtyId))
    .where(eq(evidenceTable.id, id))
    .orderBy(desc(casualtyTable.isCanonical))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const detail = toDetail(
    { id: r.id, kind: r.kind, publisher: r.publisher, url: r.url, publishedAt: r.publishedAt },
    {
      theater: r.theater ?? DEFAULT_THEATER,
      side: r.side ?? '', tier: r.tier ?? '', eventDate: r.eventDate ?? '', matchScore: r.matchScore,
    },
  );

  // T8.1 — corroboration basis: co-linked evidence on the same casualty (links
  // only, non-graphic per PRD §9). Contradictions are surfaced once the worker
  // persists relation per evidence (carried with the dedup group).
  const basis = await queryCorroborationBasis(id);
  detail.corroborators = basis.corroborators;
  detail.contradictions = basis.contradictions;
  return detail;
}

/**
 * T8.1 — corroborating / contradicting evidence ids for an evidence item, via
 * its canonical casualty's co-linked evidence (excluding itself).
 */
export async function queryCorroborationBasis(
  evidenceId: string,
): Promise<{ corroborators: string[]; contradictions: string[] }> {
  const db = getDb();
  const rows = await db
    .select({ otherId: casualtyEvidenceTable.evidenceId })
    .from(casualtyEvidenceTable)
    .where(
      sql`${casualtyEvidenceTable.casualtyId} IN (
        SELECT casualty_id FROM casualty_evidence WHERE evidence_id = ${evidenceId}
      ) AND ${casualtyEvidenceTable.evidenceId} <> ${evidenceId}`,
    );
  return { corroborators: rows.map((r) => r.otherId), contradictions: [] };
}

export interface CellSourceFilter {
  theater?: TheaterSlug;
  side: Side;
  category: Category;
  audience: Audience;
  from: string; // inclusive event_date lower bound (window start)
  to: string; // inclusive event_date upper bound (asOf)
  tiers: Tier[]; // eligible tier set (tiersAtOrAbove threshold)
  limit?: number; // cap (PRD perf); default 50
}

/**
 * T2.2 — sources backing a count cell. Returns the evidence detail list for
 * canonical casualties matching (side, category, audience), event_date in
 * [from, to], tier in the eligible set. Capped for payload size.
 */
export async function resolveCellSources(filter: CellSourceFilter): Promise<EvidenceDetail[]> {
  const db = getDb();
  if (filter.tiers.length === 0) return [];

  const rows = await db
    .select({
      id: evidenceTable.id,
      kind: evidenceTable.kind,
      publisher: evidenceTable.publisher,
      url: evidenceTable.url,
      publishedAt: evidenceTable.publishedAt,
      theater: casualtyTable.theater,
      side: casualtyTable.side,
      tier: casualtyTable.tier,
      eventDate: casualtyTable.eventDate,
      matchScore: casualtyTable.matchScore,
    })
    .from(casualtyTable)
    .innerJoin(casualtyEvidenceTable, eq(casualtyEvidenceTable.casualtyId, casualtyTable.id))
    .innerJoin(evidenceTable, eq(evidenceTable.id, casualtyEvidenceTable.evidenceId))
    .where(
      and(
        eq(casualtyTable.theater, filter.theater ?? DEFAULT_THEATER),
        eq(casualtyTable.side, filter.side),
        eq(casualtyTable.category, filter.category),
        eq(casualtyTable.audience, filter.audience),
        eq(casualtyTable.isCanonical, true),
        gte(casualtyTable.eventDate, filter.from),
        lte(casualtyTable.eventDate, filter.to),
        inArray(casualtyTable.tier, filter.tiers),
      ),
    )
    .orderBy(desc(casualtyTable.eventDate))
    .limit(filter.limit ?? 50);

  return rows.map((r) =>
    toDetail(
      { id: r.id, kind: r.kind, publisher: r.publisher, url: r.url, publishedAt: r.publishedAt },
      {
        theater: r.theater ?? DEFAULT_THEATER,
        side: r.side, tier: r.tier, eventDate: r.eventDate, matchScore: r.matchScore,
      },
    ),
  );
}
