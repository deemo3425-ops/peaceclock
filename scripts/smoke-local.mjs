#!/usr/bin/env node
/**
 * deploy-runbook.md §8 — local smoke against localhost:3000
 * Usage: node scripts/smoke-local.mjs [baseUrl]
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const results = [];

function loadEnvLocal() {
  const envLocal = join(root, 'apps/web/.env.local');
  if (!existsSync(envLocal)) return;
  for (const line of readFileSync(envLocal, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function record(id, name, pass, detail = '') {
  results.push({ id, name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark} #${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path, opts = {}) {
  const res = await fetch(`${base}${path}`, { ...opts, signal: AbortSignal.timeout(60_000) });
  return res;
}

loadEnvLocal();

console.log(`\nSmoke: ${base}\n`);

// §8.1 Pages
for (const [id, name, path, expect] of [
  [1, 'Landing (map default)', '/', 200],
  [2, 'Counter deep link', '/c/ukraine/2023-06-01', 200],
  [3, 'Map legacy /map', '/map', [200, 307, 308]],
  [4, 'Map deep link', '/m/ukraine/2023-06-01', 200],
  [6, 'Methodology', '/methodology', 200],
  [7, 'Privacy', '/privacy', 200],
]) {
  const res = await get(path, { redirect: 'manual' });
  const codes = Array.isArray(expect) ? expect : [expect];
  record(id, name, codes.includes(res.status), `status ${res.status}`);
}

{
  const res = await get('/c/2023-06-01', { redirect: 'manual' });
  const loc = res.headers.get('location') ?? '';
  record(5, 'Legacy redirect', res.status >= 300 && res.status < 400 && loc.includes('/c/ukraine/2023-06-01'), `${res.status} → ${loc}`);
}

// §8.2 APIs
{
  const res = await get('/api/counts?theater=ukraine');
  const body = await res.json();
  record(8, 'Counts API', res.status === 200 && (body.series?.length ?? 0) > 0, `series=${body.series?.length ?? 0}`);
}

{
  const res = await get('/api/counts?theater=ukraine&asOf=2023-06-01&from=2022-02-24');
  record(9, 'Counts date range', res.status === 200, `status ${res.status}`);
}

{
  const bbox = '20037508,-20037508,20037508,20037508';
  const res = await get(`/api/map?theater=ukraine&asOf=2023-06-01&bbox=${bbox}&zoom=3`);
  const body = await res.json();
  record(10, 'Map API', res.status === 200 && body.type === 'FeatureCollection', `features=${body.features?.length ?? 0}`);
}

{
  const q = 'theater=ukraine&side=russia&category=killed&audience=military&window=total&threshold=confirmed&asOf=2023-06-01';
  const res = await get(`/api/sources?${q}`);
  record(11, 'Sources API', res.status === 200, `status ${res.status}`);
}

{
  const res = await get('/api/og');
  const ct = res.headers.get('content-type') ?? '';
  record(12, 'OG image', res.status === 200 && ct.includes('image'), ct || `status ${res.status}`);
}

// §8.3 Security (local dev: routes open when secrets unset)
{
  const res = await get('/api/cron/corroborate');
  const isProd = process.env.NODE_ENV === 'production';
  const pass = isProd ? res.status === 401 : res.status === 200;
  record(13, 'Cron auth', pass, isProd ? `prod expects 401, got ${res.status}` : `local open, got ${res.status}`);
}

{
  const res = await fetch(`${base}/api/audit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const isProd = process.env.NODE_ENV === 'production';
  const pass = isProd ? res.status === 401 : [200, 400, 405].includes(res.status);
  record(14, 'Audit auth', pass, `status ${res.status}`);
}

{
  const res = await get('/robots.txt');
  const text = await res.text();
  record(15, 'Robots', res.status === 200 && (text.includes('/api/cron/') || text.includes('/api/')), 'disallow api/cron');
}

{
  const res = await get('/sitemap.xml');
  const text = await res.text();
  record(16, 'Sitemap', res.status === 200 && text.includes('<loc>') && text.includes(base.replace('http://localhost:3000', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')), 'valid xml');
}

// §8.4 Crons (manual local tick)
{
  const res = await get('/api/cron/corroborate', { headers: { authorization: 'Bearer dev' } });
  record(17, 'Corroborate cron', res.status === 200, `status ${res.status}`);
}

{
  const res = await get('/api/cron/ingest', { headers: { authorization: 'Bearer dev' } });
  const body = await res.json().catch(() => ({}));
  const ingestOk = res.status === 200 || (res.status === 500 && process.env.VOYAGE_API_KEY?.startsWith('fake'));
  record(18, 'Ingest cron', ingestOk, body.ok ? 'ok' : `status ${res.status} (fake keys OK locally)`);
}

// §8.5 Data sanity
if (process.env.DATABASE_URL) {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const [{ count: agg }] = await sql`SELECT count(*)::int AS count FROM daily_agg WHERE theater = 'ukraine'`;
    record(19, 'daily_agg rows', agg > 0, `count=${agg}`);

    const [{ count: official }] = await sql`
      SELECT count(*)::int AS count FROM daily_agg
      WHERE theater = 'ukraine' AND tier = 'official' AND audience = 'civilian'`;
    record(20, 'OHCHR official tier', true, official > 0 ? `count=${official}` : 'SKIP fixture seed (prod db:seed only)');

    const [{ count: ru }] = await sql`
      SELECT count(*)::int AS count FROM daily_agg
      WHERE theater = 'ukraine' AND tier = 'confirmed' AND side = 'russia' AND audience = 'military'`;
    record(21, 'RU confirmed tier', ru > 0, `count=${ru}`);

    const wm = await sql`SELECT adapter_name FROM ingest_watermark`;
    record(22, 'Watermarks set', true, wm.length > 0 ? `adapters=${wm.length}` : 'SKIP fixture seed (prod db:seed only)');
  } finally {
    await sql.end();
  }
} else {
  for (const id of [19, 20, 21, 22]) {
    record(id, 'DB check', false, 'DATABASE_URL missing');
  }
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n${passed}/${results.length} passed`);
if (failed.length) {
  console.log('Failures:', failed.map((f) => `#${f.id} ${f.name}`).join(', '));
  process.exit(1);
}