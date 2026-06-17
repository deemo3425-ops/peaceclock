/**
 * Clustered map query (M4·WS0, EDD §9.3). Reads map_point, clusters server-side
 * in EPSG:3857 for screen-uniform output. Hybrid by zoom band:
 *   z<8 grid aggregate · 8–14 ST_ClusterDBSCAN · z>14 raw points.
 * The bbox `&&` prefilter (GiST) bounds the candidate set — mandatory before the
 * in-memory DBSCAN window. Returns platform-neutral GeoJSON MapFeatures.
 */

import { getDb } from './index';
import { sql } from 'drizzle-orm';
import { eps, gridCell, zoomBand } from '@peaceclock/count-engine';
import { Theater, Side, Tier, Category, Audience } from '@peaceclock/api-types';
import type { TheaterSlug } from './theater.config';
import type { MapFeature, MapFeatureProperties } from '@peaceclock/api-types';

export interface MapQueryParams {
  asOf: string;
  tiers: Tier[]; // tier set at/above the slider threshold
  bbox: [number, number, number, number]; // [minX,minY,maxX,maxY] in 3857
  zoom: number;
  /** Single theater, or omit/`all` for world/regional multi-theater view (M8). */
  theater?: TheaterSlug | 'all';
  side?: Side;
  category?: Category;
  audience?: Audience;
  pixelRadius?: number;
}

interface ClusterRow {
  n: number | string;
  centroid: { type: string; coordinates: number[] } | null;
  bounds: { type: string; coordinates: number[][][] | number[] } | null;
  theater: string;
  dominant_side: string;
  top_tier: string;
  rep_casualty_id: string | null;
  rep_evidence_id: string | null;
}

function toCoord(geo: ClusterRow['centroid']): [number, number] | null {
  if (!geo || geo.type !== 'Point' || !Array.isArray(geo.coordinates)) return null;
  const [lng, lat] = geo.coordinates as number[];
  return [lng, lat];
}

function toBounds(geo: ClusterRow['bounds']): MapFeatureProperties['bounds'] {
  if (!geo) return null;
  if (geo.type === 'Point') {
    const [lng, lat] = geo.coordinates as number[];
    return [lng, lat, lng, lat];
  }
  // Polygon envelope ring → min/max.
  const ring = (geo.coordinates as number[][][])[0];
  if (!ring) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  return [minLng, minLat, maxLng, maxLat];
}

function rowToFeature(r: ClusterRow): MapFeature | null {
  const coord = toCoord(r.centroid);
  if (!coord) return null;
  const n = Number(r.n);
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coord },
    properties: {
      kind: n > 1 ? 'cluster' : 'point',
      n,
      theater: r.theater as Theater,
      dominantSide: r.dominant_side as Side,
      topTier: r.top_tier as Tier,
      repCasualtyId: r.rep_casualty_id,
      repEvidenceId: r.rep_evidence_id,
      bounds: toBounds(r.bounds),
    },
  };
}

/** Build the bbox + facet filter CTE shared by every band. */
function filteredCte(p: MapQueryParams) {
  const [minX, minY, maxX, maxY] = p.bbox;
  const tierList = sql.join(p.tiers.map((t) => sql`${t}`), sql`, `);
  return sql`
    params AS (
      SELECT ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 3857) AS bbox
    ),
    filtered AS (
      SELECT mp.casualty_id, mp.evidence_id, mp.theater, mp.side, mp.category, mp.audience,
             mp.tier, mp.geo_confidence, mp.geom_3857
      FROM map_point mp, params p
      WHERE mp.geom_3857 && p.bbox
        AND mp.event_date <= ${p.asOf}
        AND (${p.theater ?? null}::text IS NULL OR ${p.theater ?? null} = 'all' OR mp.theater = ${p.theater ?? null})
        AND mp.tier = ANY(ARRAY[${tierList}]::tier[])
        AND (${p.side ?? null}::text IS NULL OR mp.side = ${p.side ?? null})
        AND (${p.category ?? null}::text IS NULL OR mp.category = ${p.category ?? null})
        AND (${p.audience ?? null}::text IS NULL OR mp.audience = ${p.audience ?? null})
    )`;
}

const SELECT_AGG = sql`
  count(*) AS n,
  ST_AsGeoJSON(ST_Transform(ST_Centroid(ST_Collect(geom_3857)), 4326))::json AS centroid,
  ST_AsGeoJSON(ST_Transform(ST_Envelope(ST_Collect(geom_3857)), 4326))::json AS bounds,
  mode() WITHIN GROUP (ORDER BY theater) AS theater,
  mode() WITHIN GROUP (ORDER BY side) AS dominant_side,
  max(tier) AS top_tier,
  (array_agg(casualty_id ORDER BY geo_confidence DESC NULLS LAST))[1] AS rep_casualty_id,
  (array_agg(evidence_id ORDER BY geo_confidence DESC NULLS LAST))[1] AS rep_evidence_id`;

export async function queryMap(p: MapQueryParams): Promise<MapFeature[]> {
  if (p.tiers.length === 0) return [];
  const db = getDb();
  const band = zoomBand(p.zoom);
  const radius = p.pixelRadius ?? 60;
  const filtered = filteredCte(p);

  let rows: unknown;
  if (band === 'dbscan') {
    const epsVal = eps(p.zoom, radius);
    rows = await db.execute(sql`
      WITH ${filtered},
      clustered AS (
        SELECT f.*, ST_ClusterDBSCAN(geom_3857, eps := ${epsVal}, minpoints := 1) OVER () AS cid
        FROM filtered f
      )
      SELECT ${SELECT_AGG} FROM clustered GROUP BY cid
    `);
  } else if (band === 'grid') {
    const cell = gridCell(p.zoom, radius);
    rows = await db.execute(sql`
      WITH ${filtered},
      g AS (SELECT f.*, ST_SnapToGrid(geom_3857, ${cell}) AS cellgeom FROM filtered f)
      SELECT ${SELECT_AGG} FROM g GROUP BY cellgeom
    `);
  } else {
    // raw points (z>14): one feature per map_point, no clustering.
    rows = await db.execute(sql`
      WITH ${filtered}
      SELECT 1 AS n,
        ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::json AS centroid,
        ST_AsGeoJSON(ST_Transform(geom_3857, 4326))::json AS bounds,
        theater, side AS dominant_side, tier AS top_tier,
        casualty_id AS rep_casualty_id, evidence_id AS rep_evidence_id
      FROM filtered
    `);
  }

  const out: MapFeature[] = [];
  for (const r of rows as unknown as ClusterRow[]) {
    const f = rowToFeature(r);
    if (f) out.push(f);
  }
  return out;
}
