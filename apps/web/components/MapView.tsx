'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as MLMap, GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import type { MapResponse, MapFeature } from '@peaceclock/api-types';
import { Side, Category, Tier } from '@peaceclock/api-types';
import { lonLatToMercator } from '@peaceclock/count-engine';
import { track } from '@/lib/analytics';

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
 */
export function MapView({ asOf, threshold, side, category, onPinClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);

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

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: (STYLE_URL as any) ?? RASTER_FALLBACK,
        center: [31.2, 48.4], // Ukraine
        zoom: 4,
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapRef.current = map;

      map.on('load', () => {
        map.addSource('pins', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'clusters', type: 'circle', source: 'pins', filter: ['==', ['get', 'kind'], 'cluster'],
          paint: {
            'circle-color': ['match', ['get', 'dominantSide'], 'russia', '#d96b6b', '#6db1ff'],
            'circle-radius': ['interpolate', ['linear'], ['get', 'n'], 1, 12, 100, 28],
            'circle-opacity': 0.8,
          },
        });
        map.addLayer({
          id: 'cluster-count', type: 'symbol', source: 'pins', filter: ['==', ['get', 'kind'], 'cluster'],
          layout: { 'text-field': ['get', 'n'], 'text-size': 12 }, paint: { 'text-color': '#04101f' },
        });
        map.addLayer({
          id: 'points', type: 'circle', source: 'pins', filter: ['==', ['get', 'kind'], 'point'],
          paint: {
            'circle-color': ['match', ['get', 'dominantSide'], 'russia', '#d96b6b', '#6db1ff'],
            'circle-radius': 6,
            'circle-stroke-width': ['case', ['==', ['get', 'topTier'], 'ai_corroborated'], 2, 1],
            'circle-stroke-color': ['case', ['==', ['get', 'topTier'], 'ai_corroborated'], '#ff9d6b', '#04101f'],
          },
        });

        const onCluster = (e: any) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (!f) return;
          const bounds = (f.properties as any).bounds;
          const parsed = typeof bounds === 'string' ? JSON.parse(bounds) : bounds;
          if (parsed) { map.fitBounds(parsed as [number, number, number, number], { padding: 60, maxZoom: 15 }); track('change_threshold', {}); }
        };
        map.on('click', 'clusters', onCluster);
        map.on('click', 'points', (e: any) => {
          const f = e.features?.[0];
          if (f && onPinClick) onPinClick({ type: 'Feature', geometry: f.geometry, properties: f.properties } as MapFeature);
        });
        for (const layer of ['clusters', 'points']) {
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

  return <div ref={containerRef} className="mapview" aria-label="Map of geolocated confirmed evidence" role="application" />;
}
