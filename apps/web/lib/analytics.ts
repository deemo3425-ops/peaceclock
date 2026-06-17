/**
 * Privacy-respecting analytics (M2·WS5·T5.3). Aggregate UI events only —
 * NO PII, no identifiers, no IP/user joins. Swap the sink for a real
 * privacy-first provider (e.g. Plausible) in deploy; the call sites stay.
 */

export type AnalyticsEvent =
  | 'view_counter'
  | 'scrub_date'
  | 'change_threshold'
  | 'toggle_category'
  | 'open_source';

// Allowlisted, non-identifying props only.
export interface AnalyticsProps {
  window?: string;
  threshold?: string;
  category?: string;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === 'undefined') return;
  // Dev sink: console. No network, no PII.
  // eslint-disable-next-line no-console
  console.debug('[analytics]', event, props);
}
