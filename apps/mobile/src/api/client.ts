/**
 * API base URL from Expo public env (M6·T0.2).
 * Set EXPO_PUBLIC_API_URL to the deployed web origin (e.g. https://peaceclock.org).
 */
export function apiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  return base ?? 'http://localhost:3000';
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${apiBaseUrl()}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}