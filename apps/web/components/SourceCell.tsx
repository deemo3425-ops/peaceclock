'use client';

import { useState } from 'react';
import type { EvidenceDetail } from '@peaceclock/api-types';
import { Side, Audience, Category, Tier } from '@peaceclock/api-types';
import type { Window } from '@peaceclock/count-engine';
import { track } from '@/lib/analytics';

interface Props {
  value: number;
  side: Side;
  audience: Audience;
  category: Category;
  window: Window;
  threshold: Tier;
  asOf: string;
}

/**
 * A single count cell (T3.5). Renders the number as a disclosure button that
 * lazily fetches the backing sources for exactly this (side, audience,
 * category, window, threshold, asOf) cell via /api/sources. Links only.
 * A zero cell is not a link.
 */
export function SourceCell({ value, side, audience, category, window, threshold, asOf }: Props) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<EvidenceDetail[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) track('open_source', { window, threshold, category });
    if (next && sources === null && !loading) {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ side, audience, category, window, threshold, asOf });
        const res = await fetch(`/api/sources?${qs}`);
        setSources(res.ok ? await res.json() : []);
      } catch {
        setSources([]);
      } finally {
        setLoading(false);
      }
    }
  }

  if (value === 0) {
    return <span className="cell cell--zero">0</span>;
  }

  return (
    <>
      <button
        type="button"
        className="cell cell--link"
        aria-expanded={open}
        onClick={toggle}
        title="Show sources"
      >
        {value.toLocaleString()}
      </button>
      {open && (
        <div className="cell__sources" role="region" aria-label="Sources">
          {loading && <span>Loading…</span>}
          {sources && sources.length === 0 && !loading && <span>No linked sources.</span>}
          {sources && sources.length > 0 && (
            <ul>
              {sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url || `/api/evidence/${s.id}`} target="_blank" rel="noreferrer noopener">
                    {s.publisher}
                  </a>{' '}
                  <span className="cell__tier">{s.tier}</span> · {s.date}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
