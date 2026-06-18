/**
 * Map tile provider configuration (M4·WS3, PR8, EDD §14).
 *
 * **Production:** Set `NEXT_PUBLIC_MAP_STYLE_URL` to a MapTiler vector style JSON
 * URL (see `.env.example`). MapLibre GL JS loads the style directly; vector tiles
 * scale cleanly at all zoom levels and carry provider attribution in the style spec.
 *
 * **Development:** When `NEXT_PUBLIC_MAP_STYLE_URL` is unset, `resolveMapStyle()`
 * returns a keyless OpenStreetMap **raster** fallback so the map renders without a
 * provider API key. Suitable for local dev and CI smoke tests only — not for
 * production traffic (rate limits, no offline cache policy).
 *
 * @see apps/web/components/MapView.tsx — consumer
 */

import type { StyleSpecification } from 'maplibre-gl';

/** Keyless OSM raster tiles for local dev when NEXT_PUBLIC_MAP_STYLE_URL is unset. */
export const OSM_RASTER_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/**
 * MapTiler (prod) style URL from env, or the OSM raster fallback when unset.
 * `NEXT_PUBLIC_*` is inlined at build time — restart `next dev` after changing it.
 */
export function resolveMapStyle(): string | StyleSpecification {
  const url = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  return url ? url : OSM_RASTER_FALLBACK;
}