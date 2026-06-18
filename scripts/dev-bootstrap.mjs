#!/usr/bin/env node
/**
 * Phase 0 local bootstrap ($0 testing): migrate + SQL fixture seed.
 * Reads DATABASE_URL from env or apps/web/.env.local.
 *
 *   pnpm dev:bootstrap
 *   pnpm --filter @peaceclock/web dev
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = join(root, 'apps/web/.env.local');

function loadEnvLocal() {
  if (!existsSync(envLocal)) return;
  for (const line of readFileSync(envLocal, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error('[dev-bootstrap] DATABASE_URL missing.');
  console.error('  cp apps/web/.env.local.example apps/web/.env.local');
  console.error('  # set Neon dev branch URL, then re-run: pnpm dev:bootstrap');
  process.exit(1);
}

console.log('[dev-bootstrap] migrate…');
run('npx', ['drizzle-kit', 'migrate']);

console.log('[dev-bootstrap] SQL fixture seed (no Voyage/Anthropic cost)…');
run('node', ['packages/db/src/__tests__/fixtures/seed.mjs', '--seed-only']);

console.log('[dev-bootstrap] done — pnpm --filter @peaceclock/web dev');