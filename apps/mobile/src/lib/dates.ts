/** Pure date utilities — mirrored from apps/web/lib/dates.ts */

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Inclusive day count between two ISO dates (UTC calendar days). */
export function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Add `offset` calendar days to an ISO date (UTC). */
export function addDays(iso: string, offset: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Map a slider index [0, max] to an ISO date between start and end (inclusive). */
export function dateFromIndex(start: string, end: string, index: number, max: number): string {
  if (max <= 0) return end;
  const clamped = Math.max(0, Math.min(index, max));
  return addDays(start, Math.round((clamped / max) * daysBetween(start, end)));
}

/** Map an ISO date to a slider index [0, max] between start and end (inclusive). */
export function indexFromDate(start: string, end: string, date: string, max: number): number {
  const span = daysBetween(start, end);
  if (span <= 0 || max <= 0) return max;
  const offset = daysBetween(start, date);
  return Math.round((offset / span) * max);
}