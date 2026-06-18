'use client';

import { useEffect, useState } from 'react';
import type { CountsResponse } from '@peaceclock/api-types';
import { readCountsCache, writeCountsCache } from '@/lib/counts-cache';

interface Props {
  theater: string;
  asOf: string;
  /** Seed from SSR so first visit has something to show when offline. */
  seed?: CountsResponse;
}

function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/**
 * Last-known-good banner (M7·WS2·T2.1). Polls /api/counts; on failure, surfaces
 * the cached payload timestamp so users know figures may be stale.
 */
export function OfflineBanner({ theater, asOf, seed }: Props) {
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if (seed?.series?.length) writeCountsCache(seed);

    let cancelled = false;

    async function refresh() {
      try {
        const qs = new URLSearchParams({ theater, asOf });
        const res = await fetch(`/api/counts?${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`counts ${res.status}`);
        const data = (await res.json()) as CountsResponse;
        if (cancelled) return;
        writeCountsCache(data);
        setOffline(false);
        setCachedAt(null);
      } catch {
        if (cancelled) return;
        const cached = readCountsCache();
        if (cached) {
          setOffline(true);
          setCachedAt(cached.cachedAt);
        }
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [theater, asOf, seed]);

  if (!offline || !cachedAt) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <strong>Offline — showing last known counts.</strong>{' '}
      Cached at {fmt(cachedAt)}. Figures may be stale until the connection recovers.
    </div>
  );
}