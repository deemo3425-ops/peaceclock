/**
 * Theater registry (PRD §4, §6.8; EDD §5.0).
 * Versioned config — add a theater here + migration enum extension, no schema redesign.
 */

export type TheaterSlug = 'ukraine';

export interface TheaterSide {
  slug: 'ua_coalition' | 'russia';
  label: string;
}

export interface TheaterBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface TheaterConfig {
  slug: TheaterSlug;
  displayName: string;
  epochStart: string; // clamps "total" window (PRD §4)
  bounds: TheaterBounds; // default map framing
  sides: TheaterSide[];
  enabled: boolean; // false = hidden until source coverage sign-off (PRD §6.8)
}

/** Launch theater; additional slugs extend `theater` enum via migration (M8). */
export const THEATERS: Record<TheaterSlug, TheaterConfig> = {
  ukraine: {
    slug: 'ukraine',
    displayName: 'Ukraine',
    epochStart: '2022-02-24',
    bounds: { west: 22, south: 44, east: 40, north: 52.5 },
    sides: [
      { slug: 'ua_coalition', label: 'Ukraine coalition' },
      { slug: 'russia', label: 'Russia' },
    ],
    enabled: true,
  },
};

export const DEFAULT_THEATER: TheaterSlug = 'ukraine';

export function theaterEpoch(slug: TheaterSlug = DEFAULT_THEATER): string {
  return THEATERS[slug].epochStart;
}

export function enabledTheaters(): TheaterConfig[] {
  return Object.values(THEATERS).filter((t) => t.enabled);
}

export function isTheaterSlug(v: string): v is TheaterSlug {
  return v in THEATERS;
}