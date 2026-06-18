/**
 * Client-side last-known-good cache for /api/counts (M7·WS2·T2.1).
 * Persists the most recent successful response so the offline banner can
 * show a trustworthy "as of" timestamp when the network or API is down.
 */

import type { CountsResponse } from '@peaceclock/api-types';

const STORAGE_KEY = 'peaceclock:counts:lkg';

export interface CachedCounts {
  data: CountsResponse;
  /** ISO timestamp when this payload was stored locally. */
  cachedAt: string;
}

export function readCountsCache(): CachedCounts | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCounts;
    if (!parsed?.data?.series || !parsed.cachedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCountsCache(data: CountsResponse): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: CachedCounts = { data, cachedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota or private-mode — degrade silently; banner simply won't show a timestamp.
  }
}