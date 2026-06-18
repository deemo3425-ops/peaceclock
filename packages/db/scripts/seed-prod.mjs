/**
 * Production seed: reset OHCHR + RU adapter watermarks and run full fixture ingest.
 *
 * Usage (from repo root):
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... VOYAGE_API_KEY=... pnpm db:seed
 *
 * Requires @peaceclock/db to be built (dist/index.js).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REQUIRED = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'VOYAGE_API_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[seed] ${key} is required`);
    process.exit(1);
  }
}

/** Day before Ukraine epoch — ensures all fixture publishedAt values are ingested. */
const SEED_WATERMARK = '2022-02-23';

const db = await import(pathToFileURL(join(__dirname, '../dist/index.js')).href);
const { setWatermark, runIngestion, ohchrAdapter, ruConfirmedAdapter } = db;

console.log('[seed] resetting watermarks to', SEED_WATERMARK);
await setWatermark(ohchrAdapter.name, SEED_WATERMARK);
await setWatermark(ruConfirmedAdapter.name, SEED_WATERMARK);

console.log('[seed] running OHCHR + RU confirmed ingest adapters');
const results = await runIngestion();
console.log('[seed] complete:', JSON.stringify(results, null, 2));