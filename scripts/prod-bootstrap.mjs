#!/usr/bin/env node
/**
 * Phase 3 prod bootstrap — Neon main migrate + seed.
 * Reads apps/web/.env.production.local (copy from .env.production.example).
 *
 * With real ANTHROPIC + VOYAGE keys: runs pnpm db:seed (ingest pipeline).
 * Otherwise: SQL fixture seed only (smoke data, no API cost).
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, 'apps/web/.env.production.local');

function loadEnv(path) {
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) process.env[key] = value;
  }
  return true;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!loadEnv(envFile)) {
  console.error('[prod-bootstrap] Missing apps/web/.env.production.local');
  console.error('  cp apps/web/.env.production.example apps/web/.env.production.local');
  process.exit(1);
}

if (!process.env.DATABASE_URL?.includes('ep-lingering-thunder')) {
  console.warn('[prod-bootstrap] WARNING: DATABASE_URL does not look like Neon main branch');
}

console.log('[prod-bootstrap] migrate…');
run('npx', ['drizzle-kit', 'migrate']);

const realKeys =
  process.env.ANTHROPIC_API_KEY &&
  !process.env.ANTHROPIC_API_KEY.startsWith('fake') &&
  process.env.VOYAGE_API_KEY &&
  !process.env.VOYAGE_API_KEY.startsWith('fake');

if (realKeys) {
  console.log('[prod-bootstrap] db:seed (ingest pipeline)…');
  run('pnpm', ['db:seed']);
} else {
  console.log('[prod-bootstrap] SQL fixture seed (no API keys)…');
  run('node', ['packages/db/src/__tests__/fixtures/seed.mjs', '--seed-only']);
}

console.log('[prod-bootstrap] done — set same vars in Vercel Production, then deploy main');