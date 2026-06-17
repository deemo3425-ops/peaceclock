/**
 * MapLibre SDF sprite loader (PRD §5.3). Shared glyph names for web (M4) + native (M6).
 */

import type { Map as MLMap, ExpressionSpecification } from 'maplibre-gl';

const SPRITE_PNG = '/sprites/peaceclock-pins.png';
const SPRITE_JSON = '/sprites/peaceclock-pins.json';

/** Ukraine v1 side chroma — coalition cool blue, Russia muted red (PRD §5.3). */
export const SIDE_CHROMA: ExpressionSpecification = [
  'match',
  ['get', 'dominantSide'],
  'russia',
  '#b85c5c',
  '#4a8fd4',
];

/** Tier ring stroke colors. */
export const TIER_RING_COLOR: ExpressionSpecification = [
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

export const TIER_RING_ICON: ExpressionSpecification = [
  'concat',
  'ring-',
  ['get', 'topTier'],
];

/** Cluster disc fill — dominant side at ~80% effective opacity via color. */
export const CLUSTER_FILL: ExpressionSpecification = [
  'match',
  ['get', 'dominantSide'],
  'russia',
  '#b85c5c',
  '#4a8fd4',
];

export const CLUSTER_RADIUS: ExpressionSpecification = [
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

export const CLUSTER_COUNT: ExpressionSpecification = [
  'case',
  ['>', ['get', 'n'], 999],
  '999+',
  ['to-string', ['get', 'n']],
];

export type ReducedMotion = boolean;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Load SDF glyphs from the atlas into a MapLibre map instance. */
export async function loadMapSprites(map: MLMap): Promise<void> {
  const [pngRes, jsonRes] = await Promise.all([fetch(SPRITE_PNG), fetch(SPRITE_JSON)]);
  if (!pngRes.ok) throw new Error(`Failed to load sprite atlas: ${pngRes.status}`);
  if (!jsonRes.ok) throw new Error(`Failed to load sprite metadata: ${jsonRes.status}`);
  const meta = (await jsonRes.json()) as { peaceclock: Record<string, SpriteFrame> };
  const blob = await pngRes.blob();
  const bitmap = await createImageBitmap(blob);

  const sheet = meta.peaceclock as Record<
    string,
    { x: number; y: number; width: number; height: number; sdf?: boolean }
  >;

  for (const [name, frame] of Object.entries(sheet)) {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(
      bitmap,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height,
    );
    const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
    if (!map.hasImage(name)) {
      map.addImage(name, imageData, { sdf: frame.sdf ?? true, pixelRatio: 2 });
    }
  }
}

/** Pin base scale — static under prefers-reduced-motion (no pulse). */
export function pinIconSize(reducedMotion: ReducedMotion): number {
  return reducedMotion ? 0.72 : 0.72;
}

interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  sdf?: boolean;
}