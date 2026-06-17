'use client';

import { INVASION_START } from '@peaceclock/count-engine';
import { todayUtc } from '@/lib/dates';

interface Props {
  asOf: string;
  onChange: (d: string) => void;
}

/**
 * Date controller (T3.2). Defaults to today; clamped to
 * [INVASION_START, today]. Recomputes all cells client-side from the loaded
 * series — no extra fetch within range.
 */
export function DateController({ asOf, onChange }: Props) {
  const max = todayUtc();
  return (
    <div className="control control--date">
      <label htmlFor="asOf" className="control__label">
        As of
      </label>
      <input
        id="asOf"
        type="date"
        value={asOf}
        min={INVASION_START}
        max={max}
        onChange={(e) => {
          const v = e.target.value;
          if (v && v >= INVASION_START && v <= max) onChange(v);
        }}
      />
    </div>
  );
}
