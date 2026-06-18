/**
 * Map clustering math (M4·WS0, EDD §9.3) — pure & platform-neutral so the
 * server query, the web client, and the native client agree exactly.
 *
 * We cluster in EPSG:3857: a constant per-zoom `eps` yields screen-uniform
 * clusters (N pixels apart on screen regardless of latitude).
 */

export const EARTH_CIRCUMFERENCE_M = 40075016.6855785;
export const TILE_PX = 512;
export const DEFAULT_PIXEL_RADIUS = 60;

export type ZoomBand = 'grid' | 'dbscan' | 'raw';

/** 3857 world units per screen pixel at zoom z (512px tiles). */
export function worldUnitsPerPixel(z: number): number {
  return EARTH_CIRCUMFERENCE_M / (TILE_PX * Math.pow(2, z));
}

/** DBSCAN eps in 3857 meters for a pixel radius at zoom z. */
export function eps(z: number, pixelRadius: number = DEFAULT_PIXEL_RADIUS): number {
  return pixelRadius * worldUnitsPerPixel(z);
}

/** Hybrid zoom strategy: grid (z<8), DBSCAN (8–14), raw points (z>14). */
export function zoomBand(z: number): ZoomBand {
  if (z < 8) return 'grid';
  if (z <= 14) return 'dbscan';
  return 'raw';
}

/** Grid cell size (3857 m) for the coarse z<8 aggregate — a multiple of eps. */
export function gridCell(z: number, pixelRadius: number = DEFAULT_PIXEL_RADIUS): number {
  // Coarser than DBSCAN eps so world zoom stays cheap (≈ a tile-ish bucket).
  return eps(z, pixelRadius) * 2;
}

/** Web Mercator tile width in 3857 meters at zoom z (512px tiles). */
export function tileSizeMeters(z: number): number {
  return EARTH_CIRCUMFERENCE_M / Math.pow(2, z);
}

/**
 * Snap a viewport bbox to the Web Mercator tile grid at zoom z.
 * Expands min corners down and max corners up so neighboring pans share the
 * same quantized envelope — used for `/api/map` CDN cache keys (EDD §9.3).
 */
export function snapBboxToTileGrid(
  bbox: [number, number, number, number],
  zoom: number,
): [number, number, number, number] {
  const cell = tileSizeMeters(zoom);
  const [minX, minY, maxX, maxY] = bbox;
  return [
    Math.floor(minX / cell) * cell,
    Math.floor(minY / cell) * cell,
    Math.ceil(maxX / cell) * cell,
    Math.ceil(maxY / cell) * cell,
  ];
}
