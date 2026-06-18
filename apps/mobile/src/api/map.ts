import type { EvidenceDetail, MapResponse } from '@peaceclock/api-types';
import { Category, Tier } from '@peaceclock/api-types';
import { apiGet } from './client';
import type { TheaterSlug } from './counts';

export interface FetchMapParams {
  theater?: TheaterSlug;
  asOf: string;
  threshold?: Tier;
  side?: string;
  category?: Category;
  bbox: string;
  zoom: number;
}

/** Clustered GeoJSON for the current viewport (EDD §9.3, platform-neutral). */
export async function fetchMap(params: FetchMapParams): Promise<MapResponse> {
  const qs = new URLSearchParams({
    theater: params.theater ?? 'ukraine',
    asOf: params.asOf,
    threshold: params.threshold ?? Tier.CONFIRMED,
    bbox: params.bbox,
    zoom: String(params.zoom),
  });
  if (params.side) qs.set('side', params.side);
  if (params.category) qs.set('category', params.category);
  return apiGet<MapResponse>(`/api/map?${qs}`);
}

/** Evidence detail for pin tap (links only — PRD §9). */
export async function fetchEvidenceDetail(id: string): Promise<EvidenceDetail | null> {
  try {
    return await apiGet<EvidenceDetail>(`/api/evidence/${id}`);
  } catch {
    return null;
  }
}