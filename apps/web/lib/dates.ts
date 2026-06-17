/** Pure date utilities — safe in both server and client components. */

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
