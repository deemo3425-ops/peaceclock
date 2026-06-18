/**
 * Map tile style (M6·WS2). Mirrors apps/web/lib/map.ts — OSM raster fallback for dev;
 * set EXPO_PUBLIC_MAP_STYLE_URL to a MapTiler vector style in production.
 */

export const OSM_RASTER_FALLBACK = {
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
} as const;

export function resolveMapStyle(): string | object {
  const url = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim();
  return url ? url : OSM_RASTER_FALLBACK;
}