/**
 * MapLibre pin/cluster encoding (PRD §5.3). Mirrors apps/web/lib/mapSprites.ts so
 * web (MapLibre GL JS) and native (MapLibre Native) tint the same SDF glyphs
 * with identical tier/side expressions.
 *
 * **Sprite spec (canonical, M6 reuse path):** `apps/web/public/sprites/peaceclock-pins.json`
 * — glyph names, atlas coordinates, and `sdf` flags. Regenerate via
 * `node apps/web/scripts/generate-map-sprites.mjs`. Native bundles sliced glyphs under
 * `apps/mobile/assets/sprites/` (same names as the JSON keys). Production clients may
 * also fetch `${apiBaseUrl()}/sprites/peaceclock-pins.{json,png}` and slice at runtime
 * (web MapView path) when online.
 */

/** Ukraine v1 side chroma — coalition cool blue, Russia muted red (PRD §5.3). */
export const SIDE_CHROMA = [
  'match',
  ['get', 'dominantSide'],
  'russia',
  '#b85c5c',
  '#4a8fd4',
];

/** Tier ring stroke colors. */
export const TIER_RING_COLOR = [
  'match',
  ['get', 'topTier'],
  'official',
  '#d4af37',
  'confirmed',
  '#f5f7fa',
  'osint',
  '#5eead4',
  'ai_corroborated',
  '#f59e0b',
  '#f5f7fa',
];

export const TIER_RING_ICON = ['concat', 'ring-', ['get', 'topTier']] as const;

/** Cluster disc fill — dominant side at ~80% effective opacity via color. */
export const CLUSTER_FILL = [
  'match',
  ['get', 'dominantSide'],
  'russia',
  '#b85c5c',
  '#4a8fd4',
];

export const CLUSTER_RADIUS = [
  'interpolate',
  ['linear'],
  ['get', 'n'],
  1,
  0.55,
  10,
  0.7,
  100,
  0.95,
  1000,
  1.15,
];

export const CLUSTER_COUNT = [
  'case',
  ['>', ['get', 'n'], 999],
  '999+',
  ['to-string', ['get', 'n']],
];

/** Pin base scale — static on native (no pulse). */
export const PIN_ICON_SIZE = 0.72;

/** Bundled SDF glyphs sliced from the shared atlas (peaceclock-pins.json). */
export const MAP_SPRITE_IMAGES = {
  'pin-base': { source: require('../../assets/sprites/pin-base.png'), sdf: true },
  'ring-official': { source: require('../../assets/sprites/ring-official.png'), sdf: true },
  'ring-confirmed': { source: require('../../assets/sprites/ring-confirmed.png'), sdf: true },
  'ring-osint': { source: require('../../assets/sprites/ring-osint.png'), sdf: true },
  'ring-ai_corroborated': {
    source: require('../../assets/sprites/ring-ai_corroborated.png'),
    sdf: true,
  },
  'badge-provisional': { source: require('../../assets/sprites/badge-provisional.png'), sdf: true },
  'cluster-disc': { source: require('../../assets/sprites/cluster-disc.png'), sdf: true },
} as const;