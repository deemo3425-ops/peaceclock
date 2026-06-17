/**
 * Shared types for PeaceClock API
 * Consumed by web (Next.js) and native clients (React Native / Expo)
 */

// Enums
export enum Theater {
  UKRAINE = 'ukraine',
}

export enum Side {
  UA_COALITION = 'ua_coalition',
  RUSSIA = 'russia',
}

export enum Category {
  KILLED = 'killed',
  WOUNDED = 'wounded',
  MISSING_POW = 'missing_pow',
}

export enum Audience {
  MILITARY = 'military',
  CIVILIAN = 'civilian',
}

export enum Tier {
  OFFICIAL = 'official',
  CONFIRMED = 'confirmed',
  OSINT = 'osint',
  AI_CORROBORATED = 'ai_corroborated',
}

// Count engine
export interface CountSeries {
  day: string; // ISO date
  theater: Theater;
  side: Side;
  category: Category;
  audience: Audience;
  tier: Tier;
  count: number;
}

export interface CountsResponse {
  series: CountSeries[];
  theater: Theater;
  epochStart: string; // theater epoch — clamps total window (PRD §4)
  lastUpdated: string; // ISO timestamp — newest across all sides
  lastUpdatedBySide: Partial<Record<Side, string>>; // T1.4 per-side freshness
  asOf: string; // ISO date — inclusive upper bound (event_date ≤ asOf)
  from: string; // ISO date — inclusive lower bound of returned series
  to: string; // ISO date — = asOf
}

// Map
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: Record<string, unknown>;
}

// Clustered map (View 2, EDD §9.3). Platform-neutral — web (M4) + native (M6).
export interface MapFeatureProperties {
  kind: 'cluster' | 'point';
  n: number; // points in the cluster (1 for a singleton/point)
  theater: Theater;
  dominantSide: Side; // pin color
  topTier: Tier; // strongest tier in the cluster (badge)
  repCasualtyId: string | null; // representative ids when n = 1 (or cluster rep)
  repEvidenceId: string | null;
  bounds: [number, number, number, number] | null; // [minLng,minLat,maxLng,maxLat] for fitBounds
}

export interface MapFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  properties: MapFeatureProperties;
}

export interface MapResponse {
  type: 'FeatureCollection';
  features: MapFeature[];
  theater: Theater | 'all'; // single theater or world/regional multi-theater view (PRD §5.2)
  asOf: string;
  zoom: number;
}

// Evidence
export interface EvidenceDetail {
  id: string;
  theater: Theater;
  kind: 'official' | 'news' | 'x_post';
  publisher: string;
  url: string;
  publishedAt: string;
  side: Side;
  tier: Tier;
  date: string;
  corroborators?: string[];
  matchScore?: number;
  contradictions?: string[];
}

// Map pins (M2 lightweight backdrop; full clustering is M4)
export interface MapPin {
  id: string; // evidence id — links to /api/evidence/:id
  theater: Theater;
  lon: number;
  lat: number;
  side: Side;
  tier: Tier;
  category: Category;
  date: string; // event_date
}

export interface MapPinsResponse {
  pins: MapPin[];
  theater: Theater | 'all';
  asOf: string;
}
