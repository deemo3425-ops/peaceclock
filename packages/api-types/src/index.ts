/**
 * Shared types for PeaceClock API
 * Consumed by web (Next.js) and native clients (React Native / Expo)
 */

// Enums
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
  side: Side;
  category: Category;
  audience: Audience;
  tier: Tier;
  count: number;
}

export interface CountsResponse {
  series: CountSeries[];
  lastUpdated: string; // ISO timestamp
  asOf: string; // ISO date
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

export interface MapResponse {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  asOf: string;
  lastUpdated: string;
}

// Evidence
export interface EvidenceDetail {
  id: string;
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
