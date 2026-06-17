/**
 * Geo helpers (M2·WS4). EPSG:3857 (Web Mercator) → lon/lat for the lightweight
 * map backdrop. Pure + tested so M4's real map and native clients reuse it.
 */

export interface LonLat {
  lon: number;
  lat: number;
}

const HALF_CIRC = 20037508.34; // half Earth circumference in meters (EPSG:3857)

/** Inverse Web Mercator: meters (x, y) → degrees (lon, lat). */
export function mercatorToLonLat(x: number, y: number): LonLat {
  const lon = (x / HALF_CIRC) * 180;
  let lat = (y / HALF_CIRC) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lon, lat };
}

export interface Meters {
  x: number;
  y: number;
}

/** Forward Web Mercator: degrees (lon, lat) → meters (x, y). lat clamped to ±85.05113°. */
export function lonLatToMercator(lon: number, lat: number): Meters {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const x = (lon / 180) * HALF_CIRC;
  const y = (Math.log(Math.tan(((90 + clampedLat) * Math.PI) / 360)) / Math.PI) * HALF_CIRC;
  return { x, y };
}

/** "POINT(x y)" in EPSG:3857 meters, for map_point.geom_3857. */
export function toPoint3857Wkt(lon: number, lat: number): string {
  const { x, y } = lonLatToMercator(lon, lat);
  return `POINT(${x} ${y})`;
}

/** Parse "POINT(x y)" or "x y" (EPSG:3857 meters). Returns null if unparseable. */
export function parsePoint3857(wkt: string): LonLat | null {
  const m = wkt.match(/-?\d+(?:\.\d+)?/g);
  if (!m || m.length < 2) return null;
  const x = Number(m[0]);
  const y = Number(m[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return mercatorToLonLat(x, y);
}
