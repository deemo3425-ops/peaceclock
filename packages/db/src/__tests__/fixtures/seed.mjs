/**
 * Apply CI test schema and optional E2E seed data.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node packages/db/src/__tests__/fixtures/seed.mjs
 *   DATABASE_URL=... node packages/db/src/__tests__/fixtures/seed.mjs --seed-only
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaOnly = process.argv.includes('--schema-only');
const seedOnly = process.argv.includes('--seed-only');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[seed] DATABASE_URL is required');
  process.exit(1);
}

const files = schemaOnly
  ? ['setup-schema.sql']
  : seedOnly
    ? ['seed.sql']
    : ['setup-schema.sql', 'seed.sql'];
const sql = postgres(databaseUrl);

try {
  for (const file of files) {
    const contents = readFileSync(join(__dirname, file), 'utf8');
    await sql.unsafe(contents);
    console.log(`[seed] applied ${file}`);
  }
} finally {
  await sql.end();
}