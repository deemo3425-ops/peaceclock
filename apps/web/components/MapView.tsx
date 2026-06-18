'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Map as MLMap, GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import type { MapResponse, MapFeature } from '@peaceclock/api-types';
import { Side, Category, Tier } from '@peaceclock/api-types';
import { lonLatToMercator } from '@peaceclock/count-engine';
import { track } from '@/lib/analytics';
import { SIDE_LABEL, TIER_LABEL } from '@/lib/labels';
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
import { resolveMapStyle } from '@/lib/map';

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

function featureKey(f: MapFeature, index: number): string {
  const [lng, lat] = f.geometry.coordinates;
  const id = f.properties.repEvidenceId ?? f.properties.repCasualtyId;
  return id ? `${f.properties.kind}-${id}` : `${f.properties.kind}-${lng}-${lat}-${index}`;
}

function featureLabel(f: MapFeature): string {
  const side = SIDE_LABEL[f.properties.dominantSide];
  const tier = TIER_LABEL[f.properties.topTier];
  if (f.properties.kind === 'cluster' && f.properties.n > 1) {
    return `Cluster · ${f.properties.n} evidence points · ${side} · ${tier}`;
  }
  return `Evidence pin · ${side} · ${tier}`;
}

/**
 * Full-screen MapLibre GL JS map (M4·WS1). maplibre-gl is imported lazily inside
 * an effect so its `window`/WebGL access never runs during SSR. Viewport drives
 * /api/map refetch (debounced); cluster click → fitBounds; pin click → detail.
 * Pin/cluster graphics use the PRD §5.3 SDF sprite atlas (symbol layers).
 * M7·T4.2: keyboard-accessible list fallback of visible pins/clusters.
 */
export function MapView({ asOf, threshold, side, category, onPinClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listWasOpen = useRef(false);
  const [ready, setReady] = useState(false);
  const [spriteError, setSpriteError] = useState<string | null>(null);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const listItems = useMemo(
    () => features.filter((f) => f.properties.kind === 'point' || (f.properties.kind === 'cluster' && f.properties.n > 1)),
    [features],
  );

  const listSummary = useMemo(() => {
    const points = listItems.filter((f) => f.properties.kind === 'point').length;
    const clusters = listItems.filter((f) => f.properties.kind === 'cluster').length;
    if (!listItems.length) return 'No evidence pins in the current map view.';
    const parts = [];
    if (points) parts.push(`${points} pin${points === 1 ? '' : 's'}`);
    if (clusters) parts.push(`${clusters} cluster${clusters === 1 ? '' : 's'}`);
    return `${parts.join(', ')} visible. Use arrow keys to move, Enter to open.`;
  }, [listItems]);

  const fitCluster = useCallback((bounds: [number, number, number, number]) => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(bounds, {
      padding: 60,
      maxZoom: 15,
      duration: prefersReducedMotion() ? 0 : 450,
    });
    track('change_threshold', {});
  }, []);

  const activateFeature = useCallback((f: MapFeature) => {
    if (f.properties.kind === 'cluster' && f.properties.bounds) {
      fitCluster(f.properties.bounds);
      return;
    }
    if (f.properties.kind === 'point' && onPinClick) onPinClick(f);
  }, [fitCluster, onPinClick]);

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
      const feats = data.features as MapFeature[];
      const src = map.getSource('pins') as GeoJSONSource | undefined;
      if (src) src.setData({ type: 'FeatureCollection', features: feats as any });
      setFeatures(feats);
      setFocusedIndex(0);
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
        style: resolveMapStyle() as any,
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
          if (parsed) fitCluster(parsed as [number, number, number, number]);
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

  // Focus the list when opened; return focus to toggle when closed.
  useEffect(() => {
    if (listOpen) {
      listRef.current?.focus();
      listWasOpen.current = true;
    } else if (listWasOpen.current) {
      toggleRef.current?.focus();
      listWasOpen.current = false;
    }
  }, [listOpen]);

  // Keep focused option scrolled into view.
  useEffect(() => {
    if (!listOpen || !listRef.current) return;
    const option = listRef.current.querySelector<HTMLElement>(`[data-index="${focusedIndex}"]`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [listOpen, focusedIndex]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (!listItems.length) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setListOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, listItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(listItems.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const f = listItems[focusedIndex];
      if (f) activateFeature(f);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setListOpen(false);
    }
  };

  return (
    <div className="mapview-wrap">
      {spriteError && (
        <div className="mapview__sprite-error" role="alert">
          {spriteError}
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        className="mapview__list-toggle"
        aria-expanded={listOpen}
        aria-controls="map-pin-list"
        onClick={() => setListOpen((open) => !open)}
      >
        {listOpen ? 'Hide evidence list' : 'Show evidence list'}
      </button>

      {listOpen && (
        <aside
          id="map-pin-list"
          className="mapview__list-panel"
          role="region"
          aria-label="Evidence in current map view"
        >
          <p className="mapview__list-summary" role="status" aria-live="polite">
            {listSummary}
          </p>
          <ul
            ref={listRef}
            className="mapview__list"
            role="listbox"
            aria-label="Evidence pins and clusters"
            tabIndex={0}
            onKeyDown={onListKeyDown}
          >
            {listItems.map((f, index) => (
              <li key={featureKey(f, index)}>
                <button
                  type="button"
                  role="option"
                  data-index={index}
                  aria-selected={focusedIndex === index}
                  className={`mapview__list-item${focusedIndex === index ? ' mapview__list-item--focused' : ''}`}
                  onClick={() => {
                    setFocusedIndex(index);
                    activateFeature(f);
                  }}
                  onFocus={() => setFocusedIndex(index)}
                >
                  {featureLabel(f)}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div
        ref={containerRef}
        className={`mapview${prefersReducedMotion() ? ' mapview--reduced-motion' : ''}`}
        aria-label="Map of geolocated confirmed evidence"
        aria-describedby="map-a11y-hint"
        role="application"
      />
      <p id="map-a11y-hint" className="sr-only">
        Interactive map. Use the evidence list button for keyboard access to pins and clusters in the current view.
      </p>
    </div>
  );
}