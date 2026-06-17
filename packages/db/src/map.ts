/**
 * Map-point data access (M2·WS4·T4.1). Reads map_point for the lightweight
 * backdrop — a capped set of recent geolocated evidence. NO clustering here;
 * ST_ClusterDBSCAN + full interactivity are M4. Returns raw EPSG:3857 geom;
 * the route converts to lon/lat via @peaceclock/count-engine.
 */

import { getDb } from './index';
import { mapPointTable } from '../schema';
import { and, lte, desc, eq } from 'drizzle-orm';
import { Theater, Side, Tier, Category } from '@peaceclock/api-types';
import { DEFAULT_THEATER, type TheaterSlug } from './theater.config';


export interface MapPointRow {
  evidenceId: string;
  theater: Theater;
  side: Side;
  tier: Tier;
  category: Category;
  eventDate: string;
  geom3857: string;
}

/** Most-recent geolocated points with event_date ≤ asOf, capped (default 150). */
export async function queryMapPins(
  asOf: string,
  limit = 150,
  theater: TheaterSlug = DEFAULT_THEATER,
): Promise<MapPointRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      evidenceId: mapPointTable.evidenceId,
      theater: mapPointTable.theater,
      side: mapPointTable.side,
      tier: mapPointTable.tier,
      category: mapPointTable.category,
      eventDate: mapPointTable.eventDate,
      geom3857: mapPointTable.geom3857,
    })
    .from(mapPointTable)
    .where(and(eq(mapPointTable.theater, theater), lte(mapPointTable.eventDate, asOf)))
    .orderBy(desc(mapPointTable.eventDate))
    .limit(limit);

  return rows.map((r) => ({
    evidenceId: r.evidenceId,
    theater: r.theater as Theater,
    side: r.side as Side,
    tier: r.tier as Tier,
    category: r.category as Category,
    eventDate: r.eventDate,
    geom3857: r.geom3857,
  }));
}
