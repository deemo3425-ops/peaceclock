import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import {
  Camera,
  Images,
  MapView,
  ShapeSource,
  SymbolLayer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import type { EvidenceDetail, MapFeature, MapResponse } from '@peaceclock/api-types';
import { Category, Theater, Tier } from '@peaceclock/api-types';
import { INVASION_START, lonLatToMercator } from '@peaceclock/count-engine';
import { fetchEvidenceDetail, fetchMap } from '../api/map';
import { DateScrubber } from '../components/DateScrubber';
import { ThresholdSlider } from '../components/ThresholdSlider';
import { CategoryToggle } from '../components/CategoryToggle';
import { isValidDate, todayUtc } from '../lib/dates';
import { DEFAULT_THRESHOLD, SIDE_LABEL, TIER_LABEL } from '../lib/labels';
import {
  CLUSTER_COUNT,
  CLUSTER_FILL,
  CLUSTER_RADIUS,
  MAP_SPRITE_IMAGES,
  PIN_ICON_SIZE,
  SIDE_CHROMA,
  TIER_RING_COLOR,
  TIER_RING_ICON,
} from '../lib/mapSprites';
import { resolveMapStyle } from '../lib/mapStyle';
import type { RootTabParamList } from '../navigation/types';
import { OfflineBanner } from '../components/OfflineBanner';
import { getCachedMap, mapCacheKey, setCachedMap } from '../offline/cache';
import { colors, radii, typography } from '../theme/tokens';

const UKRAINE_CENTER: [number, number] = [31.2, 48.4];
const INITIAL_ZOOM = 4;
const EMPTY_FC: MapResponse = {
  type: 'FeatureCollection',
  features: [],
  theater: Theater.UKRAINE,
  asOf: todayUtc(),
  zoom: INITIAL_ZOOM,
};

function clampDate(date: string | undefined): string {
  const max = todayUtc();
  if (!date || !isValidDate(date)) return max;
  if (date < INVASION_START) return INVASION_START;
  if (date > max) return max;
  return date;
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

function bboxFromVisibleBounds(
  northEast: GeoJSON.Position,
  southWest: GeoJSON.Position,
): string {
  const sw = lonLatToMercator(southWest[0], southWest[1]);
  const ne = lonLatToMercator(northEast[0], northEast[1]);
  return [sw.x, sw.y, ne.x, ne.y].join(',');
}

function parseClusterBounds(
  bounds: MapFeature['properties']['bounds'],
): [number, number, number, number] | null {
  if (!bounds) return null;
  const parsed = typeof bounds === 'string' ? (JSON.parse(bounds) as number[]) : bounds;
  if (!Array.isArray(parsed) || parsed.length !== 4) return null;
  return parsed as [number, number, number, number];
}

/**
 * View 2 native map (M6·WS2). MapLibre Native full-screen map; viewport-debounced
 * `/api/map` fetch (theater=ukraine, bbox EPSG:3857, zoom); cluster/pin symbol layers
 * tinted via the shared peaceclock-pins sprite spec; pin tap → evidence detail panel.
 */
export function MapScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Map'>>();
  const cameraRef = useRef<CameraRef>(null);
  const mapReady = useRef(false);

  const [asOf, setAsOf] = useState(() => clampDate(route.params?.date));
  const [threshold, setThreshold] = useState<Tier>(DEFAULT_THRESHOLD);
  const [category, setCategory] = useState<Category>(Category.KILLED);
  const [mapData, setMapData] = useState<MapResponse>(EMPTY_FC);
  const [mapError, setMapError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvidenceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setAsOf(clampDate(route.params?.date));
  }, [route.params?.date]);

  const loadViewport = useCallback(
    async (northEast: GeoJSON.Position, southWest: GeoJSON.Position, zoomLevel: number) => {
      const bbox = bboxFromVisibleBounds(northEast, southWest);
      const zoom = Math.round(zoomLevel);
      const cacheKey = mapCacheKey({
        theater: 'ukraine',
        asOf,
        threshold,
        category,
        bbox,
        zoom,
      });
      try {
        const data = await fetchMap({ theater: 'ukraine', asOf, threshold, category, bbox, zoom });
        await setCachedMap(cacheKey, data);
        setMapData(data);
        setMapError(null);
        setOfflineCachedAt(null);
      } catch (err: unknown) {
        const cached = await getCachedMap(cacheKey);
        if (cached) {
          setMapData(cached.data);
          setOfflineCachedAt(cached.cachedAt);
          setMapError(null);
        } else {
          setMapError(err instanceof Error ? err.message : 'Failed to load map data');
          setOfflineCachedAt(null);
        }
      }
    },
    [asOf, threshold, category],
  );

  const debouncedLoad = useMemo(() => debounce(loadViewport, 300), [loadViewport]);

  const onRegionDidChange = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point, { visibleBounds: GeoJSON.Position[]; zoomLevel: number }>) => {
      const { visibleBounds, zoomLevel } = feature.properties;
      if (!visibleBounds || visibleBounds.length < 2) return;
      const [northEast, southWest] = visibleBounds;
      debouncedLoad(northEast, southWest, zoomLevel);
    },
    [debouncedLoad],
  );

  useEffect(() => {
    if (mapReady.current) {
      // Refetch when shared filters change (same contract as web MapView).
      debouncedLoad(
        [UKRAINE_CENTER[0] + 8, UKRAINE_CENTER[1] + 4],
        [UKRAINE_CENTER[0] - 8, UKRAINE_CENTER[1] - 4],
        INITIAL_ZOOM,
      );
    }
  }, [asOf, threshold, category, debouncedLoad]);

  const onPinPress = useCallback(async (feature: GeoJSON.Feature) => {
    const props = feature.properties as MapFeature['properties'] | undefined;
    if (!props) return;

    if (props.kind === 'cluster' && props.n > 1) {
      const bounds = parseClusterBounds(props.bounds);
      if (bounds) {
        const [minLng, minLat, maxLng, maxLat] = bounds;
        cameraRef.current?.fitBounds([maxLng, maxLat], [minLng, minLat], 60, 450);
      }
      return;
    }

    const evidenceId = props.repEvidenceId;
    if (!evidenceId) return;
    setLoadingDetail(true);
    setDetail(null);
    try {
      setDetail(await fetchEvidenceDetail(evidenceId));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const geoJson = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: mapData.features }),
    [mapData.features],
  );

  return (
    <View style={styles.root}>
      <OfflineBanner cachedAt={offlineCachedAt} />
      <MapView
        style={styles.map}
        mapStyle={resolveMapStyle()}
        attributionEnabled
        logoEnabled={false}
        onDidFinishLoadingMap={() => {
          mapReady.current = true;
        }}
        onRegionDidChange={onRegionDidChange}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: UKRAINE_CENTER,
            zoomLevel: INITIAL_ZOOM,
          }}
        />

        <Images images={MAP_SPRITE_IMAGES} />

        <ShapeSource id="pins" shape={geoJson} onPress={(e) => onPinPress(e.features[0]!)}>
          <SymbolLayer
            id="clusters"
            filter={['all', ['==', ['get', 'kind'], 'cluster'], ['>', ['get', 'n'], 1]]}
            style={{
              iconImage: 'cluster-disc',
              iconSize: CLUSTER_RADIUS as never,
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              iconColor: CLUSTER_FILL as never,
              iconOpacity: 0.8,
            }}
          />
          <SymbolLayer
            id="cluster-tier-crown"
            filter={['all', ['==', ['get', 'kind'], 'cluster'], ['>', ['get', 'n'], 1]]}
            style={{
              iconImage: TIER_RING_ICON as never,
              iconSize: 0.42,
              iconOffset: [14, -14],
              iconAllowOverlap: true,
              iconColor: TIER_RING_COLOR as never,
            }}
          />
          <SymbolLayer
            id="cluster-count"
            filter={['all', ['==', ['get', 'kind'], 'cluster'], ['>', ['get', 'n'], 1]]}
            style={{
              textField: CLUSTER_COUNT as never,
              textSize: 12,
              textAllowOverlap: true,
              textColor: '#04101f',
            }}
          />
          <SymbolLayer
            id="points-base"
            filter={['==', ['get', 'kind'], 'point']}
            style={{
              iconImage: 'pin-base',
              iconSize: PIN_ICON_SIZE,
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              iconColor: SIDE_CHROMA as never,
              iconOpacity: 0.95,
            }}
          />
          <SymbolLayer
            id="points-ring"
            filter={['==', ['get', 'kind'], 'point']}
            style={{
              iconImage: TIER_RING_ICON as never,
              iconSize: PIN_ICON_SIZE * 1.05,
              iconAllowOverlap: true,
              iconColor: TIER_RING_COLOR as never,
            }}
          />
          <SymbolLayer
            id="points-badge"
            filter={[
              'all',
              ['==', ['get', 'kind'], 'point'],
              ['==', ['get', 'topTier'], 'ai_corroborated'],
            ]}
            style={{
              iconImage: 'badge-provisional',
              iconSize: PIN_ICON_SIZE * 0.55,
              iconOffset: [6, -6],
              iconAllowOverlap: true,
              iconColor: '#f59e0b',
            }}
          />
        </ShapeSource>
      </MapView>

      <View style={styles.controls} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.controlsRow}
        >
          <View style={styles.controlBlock}>
            <DateScrubber asOf={asOf} onChange={(d) => setAsOf(clampDate(d))} />
          </View>
          <View style={styles.controlBlock}>
            <CategoryToggle category={category} onChange={setCategory} />
          </View>
          <View style={styles.controlBlockWide}>
            <ThresholdSlider threshold={threshold} onChange={setThreshold} />
          </View>
        </ScrollView>
        {mapError ? <Text style={styles.mapError}>{mapError}</Text> : null}
      </View>

      {(detail || loadingDetail) && (
        <View style={styles.detail} accessibilityRole="summary" accessibilityLabel="Evidence detail">
          <Pressable
            style={styles.detailClose}
            onPress={() => setDetail(null)}
            accessibilityRole="button"
            accessibilityLabel="Close detail"
          >
            <Text style={styles.detailCloseText}>×</Text>
          </Pressable>
          {loadingDetail && (
            <View style={styles.detailLoading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.detailMuted}>Loading…</Text>
            </View>
          )}
          {detail && (
            <View style={styles.detailBody}>
              <Text style={styles.detailTitle}>
                {SIDE_LABEL[detail.side]} · {TIER_LABEL[detail.tier]}
              </Text>
              <Text style={styles.detailMeta}>
                {detail.publisher} · {detail.date}
              </Text>
              {detail.url ? (
                <Pressable
                  onPress={() => Linking.openURL(detail.url)}
                  accessibilityRole="link"
                  accessibilityHint="Opens source in browser; media is never embedded"
                >
                  <Text style={styles.detailLink}>Open source ↗</Text>
                </Pressable>
              ) : null}
              {typeof detail.matchScore === 'number' && (
                <Text style={styles.detailMuted}>
                  Match score: {detail.matchScore.toFixed(2)}
                </Text>
              )}
              {detail.corroborators && detail.corroborators.length > 0 && (
                <Text style={styles.detailMuted}>
                  Corroborating evidence: {detail.corroborators.length}
                </Text>
              )}
              {detail.contradictions && detail.contradictions.length > 0 && (
                <Text style={styles.detailWarn}>
                  Contradictions: {detail.contradictions.length}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  controlsRow: {
    gap: 8,
    paddingBottom: 4,
  },
  controlBlock: {
    minWidth: 220,
    backgroundColor: colors.panel,
    borderRadius: radii.panel,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  controlBlockWide: {
    minWidth: 280,
    backgroundColor: colors.panel,
    borderRadius: radii.panel,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  mapError: {
    color: colors.warn,
    fontSize: 12,
    backgroundColor: colors.panel,
    padding: 6,
    borderRadius: radii.control,
  },
  detail: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.panel,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 8,
  },
  detailClose: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  detailCloseText: {
    color: colors.muted,
    fontSize: 24,
    lineHeight: 24,
  },
  detailLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailBody: {
    gap: 6,
    paddingRight: 24,
  },
  detailTitle: {
    color: colors.fg,
    fontSize: 18,
    fontWeight: '600',
  },
  detailMeta: {
    color: colors.muted,
    fontSize: typography.fontSizeBase,
  },
  detailLink: {
    color: colors.accent,
    fontSize: typography.fontSizeBase,
    fontWeight: '600',
  },
  detailMuted: {
    color: colors.muted,
    fontSize: 14,
  },
  detailWarn: {
    color: colors.warn,
    fontSize: 14,
  },
});