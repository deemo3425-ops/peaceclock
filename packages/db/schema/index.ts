import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  integer,
  real,
  boolean,
  pgEnum,
  uniqueIndex,
  foreignKey,
  customType,
} from 'drizzle-orm/pg-core';

// Vector type stub for pgvector
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector';
  },
});

// Enums (T1.1)
export const sideEnum = pgEnum('side', ['ua_coalition', 'russia']);
export const categoryEnum = pgEnum('category', ['killed', 'wounded', 'missing_pow']);
export const audienceEnum = pgEnum('audience', ['military', 'civilian']);
export const tierEnum = pgEnum('tier', ['official', 'confirmed', 'osint', 'ai_corroborated']);
export const evidenceKindEnum = pgEnum('evidence_kind', ['official', 'news', 'x_post']);
export const corroStatusEnum = pgEnum('corro_status', ['pending', 'embedding', 'scoring', 'scored', 'escalating', 'done', 'unverified']);
export const casualtyStatusEnum = pgEnum('casualty_status', ['counted', 'unverified', 'rejected']);
export const geoStatusEnum = pgEnum('geo_status', ['source', 'ai_auto', 'audited']);
export const auditActionEnum = pgEnum('audit_action', ['tier_assign', 'tier_change', 'geo_assign', 'geo_fix', 'dedup_merge', 'reject']);
export const auditActorEnum = pgEnum('audit_actor', ['ai_haiku', 'ai_opus', 'human']);

// evidence (T1.2, EDD §5.1)
export const evidenceTable = pgTable(
  'evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: evidenceKindEnum('kind').notNull(),
    publisher: text('publisher').notNull(),
    url: text('url'),
    publishedAt: date('published_at'),
    raw: text('raw').notNull(), // jsonb in prod
    contentHash: text('content_hash').notNull(),
    embedding: vector('embedding'),
    geom: text('geom').notNull(), // geography(Point) — WKT for now
    geoConfidence: real('geo_confidence'),
    geoStatus: geoStatusEnum('geo_status'),
    corroStatus: corroStatusEnum('corro_status').default('pending'),
    ingestedAt: timestamp('ingested_at').defaultNow(),
  },
  (table) => ({
    contentHashUnique: uniqueIndex('idx_evidence_content_hash').on(table.contentHash),
  })
);

// casualty (T1.3, EDD §5.2)
export const casualtyTable = pgTable(
  'casualty',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    side: sideEnum('side').notNull(),
    category: categoryEnum('category').notNull(),
    audience: audienceEnum('audience').notNull(),
    count: integer('count').default(1),
    eventDate: date('event_date').notNull(), // attribution axis
    tier: tierEnum('tier').notNull(),
    status: casualtyStatusEnum('status').default('counted'),
    dedupGroup: uuid('dedup_group'),
    isCanonical: boolean('is_canonical').default(true),
    matchScore: real('match_score'),
    createdAt: timestamp('created_at').defaultNow(),
  }
);

// casualty_evidence (T1.3, M:N link)
export const casualtyEvidenceTable = pgTable(
  'casualty_evidence',
  {
    casualtyId: uuid('casualty_id').notNull(),
    evidenceId: uuid('evidence_id').notNull(),
  },
  (table) => ({
    fkCasualty: foreignKey({
      columns: [table.casualtyId],
      foreignColumns: [casualtyTable.id],
    }),
    fkEvidence: foreignKey({
      columns: [table.evidenceId],
      foreignColumns: [evidenceTable.id],
    }),
  })
);

// daily_agg (T1.4, EDD §5.3) — windowed count rollup
export const dailyAggTable = pgTable(
  'daily_agg',
  {
    day: date('day').notNull(),
    side: sideEnum('side').notNull(),
    category: categoryEnum('category').notNull(),
    audience: audienceEnum('audience').notNull(),
    tier: tierEnum('tier').notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => ({
    pk: { name: 'pk_daily_agg', columns: [table.day, table.side, table.category, table.audience, table.tier] },
  })
);

// audit_log (T1.5, EDD §5.4)
export const auditLogTable = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  casualtyId: uuid('casualty_id').notNull(),
  actor: auditActorEnum('actor').notNull(),
  action: auditActionEnum('action').notNull(),
  before: text('before'), // jsonb
  after: text('after'), // jsonb
  reason: text('reason'),
  modelCostUsd: numeric('model_cost_usd', { precision: 10, scale: 6 }),
  at: timestamp('at').defaultNow(),
});

// map_point (T1.6, EDD §9.3) — denorm for clustering
export const mapPointTable = pgTable(
  'map_point',
  {
    casualtyId: uuid('casualty_id').primaryKey(),
    evidenceId: uuid('evidence_id').notNull(), // best-geo evidence
    side: sideEnum('side').notNull(),
    category: categoryEnum('category').notNull(),
    audience: audienceEnum('audience').notNull(),
    tier: tierEnum('tier').notNull(),
    eventDate: date('event_date').notNull(),
    geoConfidence: real('geo_confidence'),
    geom3857: text('geom_3857').notNull(), // EPSG:3857 (Web Mercator)
  }
);

// corro_batch (T1.7, EDD §8.1) — Anthropic batch tracking
export const carroBatchTable = pgTable('corro_batch', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: text('provider_id').notNull(), // Anthropic batch ID
  stage: pgEnum('stage', ['haiku', 'opus'])('stage').notNull(),
  status: pgEnum('status', ['submitted', 'ended', 'processed'])('status').notNull(),
  evidenceIds: text('evidence_ids').notNull(), // uuid[] as json array
  submittedAt: timestamp('submitted_at').defaultNow(),
  endedAt: timestamp('ended_at'),
});

// spend_meter (T0.5, EDD §8.1)
export { spendMeter } from './spend-meter';
