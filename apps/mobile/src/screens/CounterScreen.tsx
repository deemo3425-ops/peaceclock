import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { CountsResponse } from '@peaceclock/api-types';
import { Audience, Category, Tier } from '@peaceclock/api-types';
import { computeMatrix } from '@peaceclock/count-engine';
import { INVASION_START } from '@peaceclock/count-engine';
import { colors, typography } from '../theme/tokens';
import { fetchCounts, reshapeCountsForAsOf, type TheaterSlug } from '../api/counts';
import { isValidDate, todayUtc } from '../lib/dates';
import { CATEGORY_LABEL, DEFAULT_THRESHOLD, TIER_LABEL } from '../lib/labels';
import { DateScrubber } from '../components/DateScrubber';
import { ThresholdSlider } from '../components/ThresholdSlider';
import { CategoryToggle } from '../components/CategoryToggle';
import { CountMatrix } from '../components/CountMatrix';
import { Freshness } from '../components/Freshness';
import type { RootTabParamList } from '../navigation/types';

function clampDate(date: string | undefined): string {
  const max = todayUtc();
  if (!date || !isValidDate(date)) return max;
  if (date < INVASION_START) return INVASION_START;
  if (date > max) return max;
  return date;
}

/**
 * View 1 native counter (M6·WS1). Fetches /api/counts once, then recomputes
 * matrix client-side via computeMatrix + buildCountsResponse on scrub/slider.
 */
export function CounterScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Counter'>>();
  const theater: TheaterSlug =
    route.params?.theater === 'ukraine' ? 'ukraine' : 'ukraine';
  const initialAsOf = clampDate(route.params?.date);

  const [raw, setRaw] = useState<CountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(initialAsOf);
  const [threshold, setThreshold] = useState<Tier>(DEFAULT_THRESHOLD);
  const [category, setCategory] = useState<Category>(Category.KILLED);

  useEffect(() => {
    setAsOf(clampDate(route.params?.date));
  }, [route.params?.date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCounts(theater, todayUtc())
      .then((data) => {
        if (!cancelled) setRaw(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load counts');
          setRaw(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [theater]);

  const data = useMemo(
    () => (raw ? reshapeCountsForAsOf(raw, asOf) : null),
    [raw, asOf],
  );

  const matrix = useMemo(
    () =>
      data
        ? computeMatrix(data.series, {
            asOf,
            threshold,
            category,
            theater: data.theater,
            epochStart: data.epochStart,
          })
        : [],
    [data, asOf, threshold, category],
  );

  const announce = useMemo(() => {
    const civ = matrix.filter((r) => r.audience === Audience.CIVILIAN);
    const totals = civ.map((r) => `${r.side} ${r.counts.total.toLocaleString()}`).join(', ');
    return `${CATEGORY_LABEL[category]}, ${TIER_LABEL[threshold]}, as of ${asOf}. Civilian totals: ${totals}.`;
  }, [matrix, category, threshold, asOf]);

  const onDate = useCallback((d: string) => setAsOf(clampDate(d)), []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Loading counts…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load counts</Text>
        <Text style={styles.errorText}>{error ?? 'No data'}</Text>
        <Text style={styles.errorHint}>
          Set EXPO_PUBLIC_API_URL to your PeaceClock web origin.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>PeaceClock</Text>
        <Text style={styles.subtitle}>
          Confirmed casualties of the war in Ukraine — a lower bound, counted only when evidence meets the bar.
        </Text>
      </View>

      <View style={styles.controls}>
        <DateScrubber asOf={asOf} onChange={onDate} />
        <CategoryToggle category={category} onChange={setCategory} />
        <ThresholdSlider threshold={threshold} onChange={setThreshold} />
      </View>

      <Text style={styles.srOnly} accessibilityRole="text" accessibilityLiveRegion="polite">
        {announce}
      </Text>

      <CountMatrix
        rows={matrix}
        category={category}
        threshold={threshold}
        asOf={asOf}
      />

      <Freshness
        asOf={asOf}
        lastUpdated={data.lastUpdated}
        lastUpdatedBySide={data.lastUpdatedBySide}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    gap: 8,
  },
  title: {
    color: colors.fg,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.fontSizeBase,
    lineHeight: 22,
  },
  controls: {
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorTitle: {
    color: colors.fg,
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: colors.warn,
    fontSize: 14,
    textAlign: 'center',
  },
  errorHint: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});