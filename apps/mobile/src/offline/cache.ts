/**
 * Native last-known-good cache (M7·WS2·T2.2, M6·T3.1).
 * Persists the latest /api/counts series and map viewport responses so the
 * app can render cached state with a clear timestamp when offline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CountsResponse, MapResponse } from '@peaceclock/api-types';

const COUNTS_KEY = '@peaceclock/counts:lkg';
const MAP_PREFIX = '@peaceclock/map:lkg:';

export interface CacheEnvelope<T> {
  data: T;
  /** ISO timestamp when this payload was stored locally. */
  cachedAt: string;
}

export async function getCachedCounts(): Promise<CacheEnvelope<CountsResponse> | null> {
  try {
    const raw = await AsyncStorage.getItem(COUNTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<CountsResponse>;
    if (!parsed?.data?.series || !parsed.cachedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedCounts(data: CountsResponse): Promise<void> {
  const envelope: CacheEnvelope<CountsResponse> = {
    data,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(COUNTS_KEY, JSON.stringify(envelope));
}

export function mapCacheKey(params: {
  theater: string;
  asOf: string;
  threshold: string;
  category: string;
  bbox: string;
  zoom: number;
}): string {
  return `${MAP_PREFIX}${params.theater}:${params.asOf}:${params.threshold}:${params.category}:${params.bbox}:${params.zoom}`;
}

export async function getCachedMap(key: string): Promise<CacheEnvelope<MapResponse> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<MapResponse>;
    if (!parsed?.data || !parsed.cachedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedMap(key: string, data: MapResponse): Promise<void> {
  const envelope: CacheEnvelope<MapResponse> = {
    data,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(key, JSON.stringify(envelope));
}