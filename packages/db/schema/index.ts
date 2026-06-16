import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core';

// Vector type stub for pgvector
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector';
  },
});

// Enums (M1·T1.1)
export const sideEnum = pgEnum('side', ['ua_coalition', 'russia']);
export const categoryEnum = pgEnum('category', ['killed', 'wounded', 'missing_pow']);
export const audienceEnum = pgEnum('audience', ['military', 'civilian']);
export const tierEnum = pgEnum('tier', ['official', 'confirmed', 'osint', 'ai_corroborated']);
export const evidenceKindEnum = pgEnum('evidence_kind', ['official', 'news', 'x_post']);
export const corroStatusEnum = pgEnum('corro_status', ['pending', 'embedding', 'scoring', 'scored', 'escalating', 'done', 'unverified']);

// Tables (M1·WS1)
// TODO: Implement evidence, casualty, daily_agg, audit_log, map_point, corro_batch tables
// See EDD §5 for schema details

export const evidenceTable = pgTable(
  'evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: evidenceKindEnum('kind').notNull(),
    publisher: text('publisher').notNull(),
    url: text('url'),
    publishedAt: date('published_at'),
    raw: text('raw'), // jsonb
    contentHash: text('content_hash').unique(),
    embedding: vector('embedding', { dimensions: 1024 }),
    corroStatus: corroStatusEnum('corro_status').default('pending'),
    ingestedAt: timestamp('ingested_at').defaultNow(),
  },
  (table) => ({
    contentHashIdx: uniqueIndex('idx_evidence_content_hash').on(table.contentHash),
  })
);

// spend_meter (T0.5, EDD §8.1)
export { spendMeter } from './spend-meter';
