'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as MLMap, GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import type { MapResponse, MapFeature } from '@peaceclock/api-types';
import { Side, Category, Tier } from '@peaceclock/api-types';
import { lonLatToMercator } from '@peaceclock/count-engine';
import { track } from '@/lib/analytics';
import {
  loadMapSprites,
  prefersReducedMotion,
  pinIconSize,
  SIDE_CHROMA,
  TIER_RING_COLOR,
  TIER_RING_ICON,
  CLUSTER_FILL,
  CLUSTER_RADIUS,
  CLUSTER_COUNT,
} from '@/lib/mapSprites';

// Configurable tile/base style (EDD §14 open question). Falls back to a keyless
// raster OSM style so the map renders without a provider key in dev.
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
const RASTER_FALLBACK = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

interface Props {
  asOf: string;
  threshold: Tier;
  side?: Side;
  category?: Category;
  onPinClick?: (f: MapFeature) => void;
}

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...a: any[]) => { if (t) clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}

/**
 * Full-screen MapLibre GL JS map (M4·WS1). maplibre-gl is imported lazily inside
 * an effect so its `window`/WebGL access never runs during SSR. Viewport drives
 * /api/map refetch (debounced); cluster click → fitBounds; pin click → detail.
 * Pin/cluster graphics use the PRD §5.3 SDF sprite atlas (symbol layers).
 */
export function MapView({ asOf, threshold, side, category, onPinClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [spriteError, setSpriteError] = useState<string | null>(null);

  const fetchViewport = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const sw = lonLatToMercator(b.getWest(), b.getSouth());
    const ne = lonLatToMercator(b.getEast(), b.getNorth());
    const bbox = [sw.x, sw.y, ne.x, ne.y].join(',');
    const zoom = Math.round(map.getZoom());
    const qs = new URLSearchParams({ asOf, threshold, zoom: String(zoom), bbox });
    if (side) qs.set('side', side);
    if (category) qs.set('category', category);
    try {
      const res = await fetch(`/api/map?${qs}`);
      if (!res.ok) return;
      const data: MapResponse = await res.json();
      const src = map.getSource('pins') as GeoJSONSource | undefined;
      if (src) src.setData({ type: 'FeatureCollection', features: data.features as any });
    } catch { /* transient — next moveend retries */ }
  }, [asOf, threshold, side, category]);

  // Init once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;

      const reducedMotion = prefersReducedMotion();
      const iconSize = pinIconSize(reducedMotion);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: (STYLE_URL as any) ?? RASTER_FALLBACK,
        center: [31.2, 48.4], // Ukraine
        zoom: 4,
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapRef.current = map;

      map.on('load', async () => {
        let spritesLoaded = false;
        try {
          await loadMapSprites(map);
          spritesLoaded = true;
        } catch (err) {
          console.error('[MapView] sprite atlas failed to load:', err);
          if (!cancelled) {
            setSpriteError('Pin graphics could not load. The map is still available without evidence pins.');
          }
        }

        map.addSource('pins', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        if (!spritesLoaded) {
          if (!cancelled) {
            setReady(true);
            fetchViewport();
            map.on('moveend', debounce(fetchViewport, 300));
          }
          return;
        }

        // Cluster density disc (PRD §5.3).
        map.addLayer({
          id: 'clusters',
          type: 'symbol',
          source: 'pins',
          filter: ['all', ['==', ['get', 'kind'], 'cluster'], ['>', ['get', 'n'], 1]],
          layout: {
            'icon-image': 'cluster-disc',
            'icon-size': CLUSTER_RADIUS,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-color': CLUSTER_FILL,
            'icon-opacity': 0.8,
          },
        });

        // Tier crown on cluster rim — highest tier ring glyph.
        map.addLayer({
          id: 'cluster-tier-crown',
          type: 'symbol',
          source: 'pins',
          filter: ['all', ['==', ['get', 'kind'], 'cluster'], ['>', ['get', 'n'], 1]],
          layout: {
            'icon-image': TIER_RING_ICON,
            'icon-size': 0.42,
            'icon-offset': [14, -14],
            'icon-allow-overlap': true,
          },
          paint: { 'icon-color': TIER_RING_COLOR },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'pins',
          filter: ['all', ['==', ['get', 'kind'], 'cluster'], ['>', ['get', 'n'], 1]],
          layout: {
            'text-field': CLUSTER_COUNT,
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#04101f' },
        });

        // Point pins — layered base + tier ring (+ provisional badge for AI).
        map.addLayer({
          id: 'points-base',
          type: 'symbol',
          source: 'pins',
          filter: ['==', ['get', 'kind'], 'point'],
          layout: {
            'icon-image': 'pin-base',
            'icon-size': iconSize,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-color': SIDE_CHROMA,
            'icon-opacity': 0.95,
          },
        });

        map.addLayer({
          id: 'points-ring',
          type: 'symbol',
          source: 'pins',
          filter: ['==', ['get', 'kind'], 'point'],
          layout: {
            'icon-image': TIER_RING_ICON,
            'icon-size': iconSize * 1.05,
            'icon-allow-overlap': true,
          },
          paint: { 'icon-color': TIER_RING_COLOR },
        });

        map.addLayer({
          id: 'points-badge',
          type: 'symbol',
          source: 'pins',
          filter: ['all', ['==', ['get', 'kind'], 'point'], ['==', ['get', 'topTier'], 'ai_corroborated']],
          layout: {
            'icon-image': 'badge-provisional',
            'icon-size': iconSize * 0.55,
            'icon-offset': [6, -6],
            'icon-allow-overlap': true,
          },
          paint: { 'icon-color': '#f59e0b' },
        });

        const onCluster = (e: any) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (!f) return;
          const bounds = (f.properties as any).bounds;
          const parsed = typeof bounds === 'string' ? JSON.parse(bounds) : bounds;
          if (parsed) {
            // prefers-reduced-motion: instant fitBounds (no staggered reveal).
            map.fitBounds(parsed as [number, number, number, number], {
              padding: 60,
              maxZoom: 15,
              duration: reducedMotion ? 0 : 450,
            });
            track('change_threshold', {});
          }
        };
        map.on('click', 'clusters', onCluster);
        map.on('click', 'cluster-count', onCluster);
        map.on('click', 'points-base', (e: any) => {
          const f = e.features?.[0];
          if (f && onPinClick) onPinClick({ type: 'Feature', geometry: f.geometry, properties: f.properties } as MapFeature);
        });
        map.on('click', 'points-ring', (e: any) => {
          const f = e.features?.[0];
          if (f && onPinClick) onPinClick({ type: 'Feature', geometry: f.geometry, properties: f.properties } as MapFeature);
        });

        for (const layer of ['clusters', 'cluster-count', 'points-base', 'points-ring', 'points-badge']) {
          map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
        }

        setReady(true);
        fetchViewport();
        map.on('moveend', debounce(fetchViewport, 300));
      });
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when shared filters change.
  useEffect(() => { if (ready) fetchViewport(); }, [ready, fetchViewport]);

  return (
    <div className="mapview-wrap">
      {spriteError && (
        <div className="mapview__sprite-error" role="alert">
          {spriteError}
        </div>
      )}
      <div
        ref={containerRef}
        className={`mapview${prefersReducedMotion() ? ' mapview--reduced-motion' : ''}`}
        aria-label="Map of geolocated confirmed evidence"
        role="application"
      />
    </div>
  );
}