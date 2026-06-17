'use client';

import { Tier } from '@peaceclock/api-types';
import { TIER_ORDER, TIER_LABEL } from '@/lib/labels';

interface Props {
  threshold: Tier;
  onChange: (t: Tier) => void;
}

/**
 * Authentication-threshold slider (T3.3). Official → Confirmed → OSINT →
 * AI-corroborated. Live client-side recount (no network). AI-corroborated is
 * labeled provisional and yields OSINT-equal totals until M3 produces rows.
 */
export function ThresholdSlider({ threshold, onChange }: Props) {
  const idx = TIER_ORDER.indexOf(threshold);

  return (
    <div className="control control--slider">
      <label htmlFor="threshold" className="control__label">
        Authentication level
      </label>
      <input
        id="threshold"
        type="range"
        min={0}
        max={TIER_ORDER.length - 1}
        step={1}
        value={idx}
        onChange={(e) => onChange(TIER_ORDER[Number(e.target.value)])}
        aria-valuetext={TIER_LABEL[threshold]}
        list="threshold-ticks"
      />
      <datalist id="threshold-ticks">
        {TIER_ORDER.map((t, i) => (
          <option key={t} value={i} label={TIER_LABEL[t]} />
        ))}
      </datalist>
      <output htmlFor="threshold" className="control__value">
        {TIER_LABEL[threshold]}
        {threshold === Tier.AI_CORROBORATED && (
          <span className="badge badge--provisional"> provisional — populated once AI corroboration ships (M3)</span>
        )}
      </output>
    </div>
  );
}
