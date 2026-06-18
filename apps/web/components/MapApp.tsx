'use client';

import { useCallback, useState } from 'react';
import type { EvidenceDetail, MapFeature } from '@peaceclock/api-types';
import { Category, Tier } from '@peaceclock/api-types';
import { MapView } from './MapView';
import { ThresholdSlider } from './ThresholdSlider';
import { DateController } from './DateController';
import { CategoryToggle } from './CategoryToggle';
import type { TheaterSlug } from '@peaceclock/db';
import { DEFAULT_THRESHOLD, SIDE_LABEL, TIER_LABEL } from '@/lib/labels';

interface Props {
  theater: TheaterSlug;
  initialAsOf: string;
  initialThreshold?: Tier;
  initialCategory?: Category;
}

/**
 * View 2 root (M4·WS1/WS2). Shares the View 1 controls + URL-state contract
 * (history.replaceState, deep-linkable /m/:theater/:date). Pin click opens evidence
 * detail (links only, never embedded media — PRD §9).
 */
export function MapApp({ theater, initialAsOf, initialThreshold, initialCategory }: Props) {
  const [asOf, setAsOf] = useState(initialAsOf);
  const [threshold, setThreshold] = useState<Tier>(initialThreshold ?? DEFAULT_THRESHOLD);
  const [category, setCategory] = useState<Category>(initialCategory ?? Category.KILLED);
  const [detail, setDetail] = useState<EvidenceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const syncUrl = useCallback((d: string, t: Tier, c: Category) => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams();
    if (t !== DEFAULT_THRESHOLD) qs.set('threshold', t);
    if (c !== Category.KILLED) qs.set('category', c);
    window.history.replaceState(null, '', `/m/${theater}/${d}${qs.toString() ? `?${qs}` : ''}`);
  }, [theater]);

  const onPinClick = useCallback(async (f: MapFeature) => {
    const id = f.properties.repEvidenceId;
    if (!id) return;
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/evidence/${id}`);
      setDetail(res.ok ? await res.json() : null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  return (
    <div className="maproot">
      <div className="maproot__controls">
        <a className="maproot__nav" href={`/c/${theater}/${asOf}`}>← Counter</a>
        <DateController asOf={asOf} onChange={(d) => { setAsOf(d); syncUrl(d, threshold, category); }} />
        <CategoryToggle category={category} onChange={(c) => { setCategory(c); syncUrl(asOf, threshold, c); }} />
        <ThresholdSlider threshold={threshold} onChange={(t) => { setThreshold(t); syncUrl(asOf, t, category); }} />
      </div>

      <MapView asOf={asOf} threshold={threshold} category={category} onPinClick={onPinClick} />

      {(detail || loadingDetail) && (
        <aside className="pindetail" role="region" aria-label="Evidence detail">
          <button className="pindetail__close" onClick={() => setDetail(null)} aria-label="Close detail">×</button>
          {loadingDetail && <p>Loading…</p>}
          {detail && (
            <>
              <h2>{SIDE_LABEL[detail.side]} · {TIER_LABEL[detail.tier]}</h2>
              <p>{detail.publisher} · {detail.date}</p>
              {detail.url && (
                <p><a href={detail.url} target="_blank" rel="noreferrer noopener">Open source ↗</a> (link only — media never embedded)</p>
              )}
              {typeof detail.matchScore === 'number' && <p>Match score: {detail.matchScore.toFixed(2)}</p>}
              {detail.corroborators && detail.corroborators.length > 0 && (
                <p>Corroborating evidence: {detail.corroborators.length}</p>
              )}
              {detail.contradictions && detail.contradictions.length > 0 && (
                <p className="badge--provisional">Contradictions: {detail.contradictions.length}</p>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  );
}
