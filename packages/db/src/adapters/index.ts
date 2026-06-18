/**
 * Source adapters (M1·WS5)
 * Each implements SourceAdapter interface from ../ingestion.
 */

import { runAdapters } from '../ingestion';
import { ohchrAdapter, backfillOhchr } from './ohchr';
import { ruConfirmedAdapter } from './ru-confirmed';
import { uaConfirmedAdapter, UA_SOURCE_BLOCKER } from './ua-confirmed';

export { ohchrAdapter, backfillOhchr } from './ohchr';
export { ruConfirmedAdapter } from './ru-confirmed';
export { uaConfirmedAdapter, UA_SOURCE_BLOCKER } from './ua-confirmed';

/** Default adapters wired into the ingest cron (UA excluded — T5.3 blocked). */
export const defaultIngestAdapters = [ohchrAdapter, ruConfirmedAdapter];

/**
 * Run all production ingest adapters (OHCHR + RU confirmed).
 * UA adapter is excluded until PRD §10 source decision lands.
 */
export async function runIngestion() {
  return runAdapters(defaultIngestAdapters);
}