'use client';

import { useMemo, useState, useCallback } from 'react';
import type { CountSeries, CountsResponse } from '@peaceclock/api-types';
import { Category, Tier } from '@peaceclock/api-types';
import { computeMatrix } from '@peaceclock/count-engine';
import type { TheaterSlug } from '@peaceclock/db';
import { DEFAULT_THRESHOLD, CATEGORY_LABEL, TIER_LABEL } from '@/lib/labels';
import { track } from '@/lib/analytics';
import { CountMatrix } from './CountMatrix';
import { ThresholdSlider } from './ThresholdSlider';
import { DateController } from './DateController';
import { CategoryToggle } from './CategoryToggle';
import { Freshness } from './Freshness';

interface CounterProps {
  data: CountsResponse;
  theater: TheaterSlug;
  initialAsOf: string;
  initialThreshold?: Tier;
  initialCategory?: Category;
}

/**
 * View 1 root (M2·WS3). Holds date / threshold / category state and recomputes
 * the headline matrix client-side via the shared engine — no extra network on
 * scrub or slider (T3.2/T3.3). URL is kept in sync via history.replaceState so
 * the view is deep-linkable and refresh-restorable (server reads the same date).
 */
export function Counter({ data, theater, initialAsOf, initialThreshold, initialCategory }: CounterProps) {
  const series: CountSeries[] = data.series;
  const [asOf, setAsOf] = useState(initialAsOf);
  const [threshold, setThreshold] = useState<Tier>(initialThreshold ?? DEFAULT_THRESHOLD);
  const [category, setCategory] = useState<Category>(initialCategory ?? Category.KILLED);

  const syncUrl = useCallback((d: string, t: Tier, c: Category) => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams();
    if (t !== DEFAULT_THRESHOLD) qs.set('threshold', t);
    if (c !== Category.KILLED) qs.set('category', c);
    const suffix = qs.toString() ? `?${qs}` : '';
    window.history.replaceState(null, '', `/c/${theater}/${d}${suffix}`);
  }, [theater]);

  const onDate = useCallback((d: string) => { setAsOf(d); syncUrl(d, threshold, category); track('scrub_date'); }, [threshold, category, syncUrl]);
  const onThreshold = useCallback((t: Tier) => { setThreshold(t); syncUrl(asOf, t, category); track('change_threshold', { threshold: t }); }, [asOf, category, syncUrl]);
  const onCategory = useCallback((c: Category) => { setCategory(c); syncUrl(asOf, threshold, c); track('toggle_category', { category: c }); }, [asOf, threshold, syncUrl]);

  const matrix = useMemo(
    () => computeMatrix(series, {
      asOf, threshold, category,
      theater: data.theater,
      epochStart: data.epochStart,
    }),
    [series, asOf, threshold, category, data.theater, data.epochStart],
  );

  // SR-friendly announcement of the current selection + civilian totals (T5.1).
  const announce = useMemo(() => {
    const civ = matrix.filter((r) => r.audience === 'civilian');
    const totals = civ.map((r) => `${r.side} ${r.counts.total.toLocaleString()}`).join(', ');
    return `${CATEGORY_LABEL[category]}, ${TIER_LABEL[threshold]}, as of ${asOf}. Civilian totals: ${totals}.`;
  }, [matrix, category, threshold, asOf]);

  return (
    <main className="counter" aria-labelledby="counter-title">
      <header className="counter__head">
        <h1 id="counter-title">PeaceClock</h1>
        <p className="counter__sub">
          Confirmed casualties of the war in Ukraine — a lower bound, counted only when evidence meets the bar.
        </p>
        <a
          className="maproot__nav"
          href={`/m/${theater}/${asOf}`}
          aria-label={`View geolocated evidence map as of ${asOf}`}
        >
          View map →
        </a>
      </header>

      <div className="counter__controls" role="toolbar" aria-label="Counter filters">
        <DateController asOf={asOf} onChange={onDate} />
        <CategoryToggle category={category} onChange={onCategory} />
        <ThresholdSlider threshold={threshold} onChange={onThreshold} />
      </div>

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <CountMatrix rows={matrix} category={category} threshold={threshold} asOf={asOf} />

      <Freshness asOf={asOf} lastUpdated={data.lastUpdated} lastUpdatedBySide={data.lastUpdatedBySide} />
    </main>
  );
}
