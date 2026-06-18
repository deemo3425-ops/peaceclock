/**
 * Per-adapter ingestion watermark store (M1·WS4·T4.1).
 * Tracks the last successfully processed publishedAt per source adapter.
 */

import { sql } from 'drizzle-orm';
import { getDb } from './index';
import { theaterEpoch } from './theater.config';

let initialized = false;

async function ensureTable(): Promise<void> {
  if (initialized) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ingest_watermark (
      adapter_name text PRIMARY KEY,
      watermark text NOT NULL,
      updated_at timestamptz DEFAULT now()
    )
  `);
  initialized = true;
}

/** Default watermark: theater epoch (2022-02-24 for Ukraine). */
export function defaultWatermark(): string {
  return theaterEpoch('ukraine');
}

export async function getWatermark(adapterName: string): Promise<string> {
  await ensureTable();
  const db = getDb();
  const rows = await db.execute<{ watermark: string }>(sql`
    SELECT watermark FROM ingest_watermark WHERE adapter_name = ${adapterName}
  `);
  if (rows.length === 0) return defaultWatermark();
  return rows[0]!.watermark;
}

export async function setWatermark(adapterName: string, watermark: string): Promise<void> {
  await ensureTable();
  const db = getDb();
  await db.execute(sql`
    INSERT INTO ingest_watermark (adapter_name, watermark, updated_at)
    VALUES (${adapterName}, ${watermark}, now())
    ON CONFLICT (adapter_name) DO UPDATE
    SET watermark = EXCLUDED.watermark, updated_at = now()
  `);
}