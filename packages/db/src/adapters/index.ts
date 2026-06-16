/**
 * Source adapters (M1·WS5)
 * Each implements SourceAdapter interface from ../ingestion.
 */

export { ohchrAdapter, backfillOhchr } from './ohchr';
export { ruConfirmedAdapter } from './ru-confirmed';
export { uaConfirmedAdapter } from './ua-confirmed';
