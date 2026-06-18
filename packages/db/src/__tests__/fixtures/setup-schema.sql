-- CI / integration test schema (mirrors packages/db/drizzle baseline from PR1).
-- Applied before db integration tests and optional E2E seed.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "public"."audience" AS ENUM('military', 'civilian');
CREATE TYPE "public"."audit_action" AS ENUM('tier_assign', 'tier_change', 'geo_assign', 'geo_fix', 'dedup_merge', 'reject');
CREATE TYPE "public"."audit_actor" AS ENUM('ai_haiku', 'ai_opus', 'human');
CREATE TYPE "public"."casualty_status" AS ENUM('counted', 'unverified', 'rejected');
CREATE TYPE "public"."category" AS ENUM('killed', 'wounded', 'missing_pow');
CREATE TYPE "public"."stage" AS ENUM('haiku', 'opus');
CREATE TYPE "public"."status" AS ENUM('submitted', 'ended', 'processed');
CREATE TYPE "public"."corro_status" AS ENUM('pending', 'embedding', 'scoring', 'scored', 'escalating', 'done', 'unverified');
CREATE TYPE "public"."evidence_kind" AS ENUM('official', 'news', 'x_post');
CREATE TYPE "public"."geo_status" AS ENUM('source', 'ai_auto', 'audited');
CREATE TYPE "public"."side" AS ENUM('ua_coalition', 'russia');
CREATE TYPE "public"."theater" AS ENUM('ukraine');
CREATE TYPE "public"."tier" AS ENUM('official', 'confirmed', 'osint', 'ai_corroborated');

CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"casualty_id" uuid NOT NULL,
	"actor" "audit_actor" NOT NULL,
	"action" "audit_action" NOT NULL,
	"before" text,
	"after" text,
	"reason" text,
	"model_cost_usd" numeric(10, 6),
	"at" timestamp DEFAULT now()
);

CREATE TABLE "corro_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"stage" "stage" NOT NULL,
	"status" "status" NOT NULL,
	"evidence_ids" text NOT NULL,
	"submitted_at" timestamp DEFAULT now(),
	"ended_at" timestamp
);

CREATE TABLE "casualty_evidence" (
	"casualty_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL
);

CREATE TABLE "casualty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theater" "theater" DEFAULT 'ukraine' NOT NULL,
	"side" "side" NOT NULL,
	"category" "category" NOT NULL,
	"audience" "audience" NOT NULL,
	"count" integer DEFAULT 1,
	"event_date" date NOT NULL,
	"tier" "tier" NOT NULL,
	"status" "casualty_status" DEFAULT 'counted',
	"dedup_group" uuid,
	"is_canonical" boolean DEFAULT true,
	"match_score" real,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "daily_agg" (
	"day" date NOT NULL,
	"theater" "theater" DEFAULT 'ukraine' NOT NULL,
	"side" "side" NOT NULL,
	"category" "category" NOT NULL,
	"audience" "audience" NOT NULL,
	"tier" "tier" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_daily_agg" PRIMARY KEY("theater","day","side","category","audience","tier")
);

CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theater" "theater" DEFAULT 'ukraine' NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"publisher" text NOT NULL,
	"url" text,
	"published_at" date,
	"raw" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1024),
	"geom" geography(Point,4326) NOT NULL,
	"geo_confidence" real,
	"geo_status" "geo_status",
	"corro_status" "corro_status" DEFAULT 'pending',
	"ingested_at" timestamp DEFAULT now()
);

CREATE TABLE "map_point" (
	"casualty_id" uuid PRIMARY KEY NOT NULL,
	"theater" "theater" DEFAULT 'ukraine' NOT NULL,
	"evidence_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"category" "category" NOT NULL,
	"audience" "audience" NOT NULL,
	"tier" "tier" NOT NULL,
	"event_date" date NOT NULL,
	"geo_confidence" real,
	"geom_3857" geometry(Point,3857) NOT NULL
);

CREATE TABLE "spend_meter" (
	"month" date NOT NULL,
	"usd" numeric(10, 4) DEFAULT '0.0000',
	"cap_usd" numeric(10, 4) NOT NULL,
	CONSTRAINT "spend_meter_month_pk" PRIMARY KEY("month")
);

ALTER TABLE "casualty_evidence" ADD CONSTRAINT "casualty_evidence_casualty_id_casualty_id_fk" FOREIGN KEY ("casualty_id") REFERENCES "public"."casualty"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "casualty_evidence" ADD CONSTRAINT "casualty_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "idx_casualty_facet" ON "casualty" USING btree ("side","category","audience","event_date","tier");
CREATE INDEX "idx_casualty_dedup_group" ON "casualty" USING btree ("dedup_group");
CREATE UNIQUE INDEX "idx_evidence_theater_content_hash" ON "evidence" USING btree ("theater","content_hash");
CREATE INDEX "idx_evidence_geom_gist" ON "evidence" USING gist ("geom");
CREATE INDEX "idx_evidence_embedding_ivfflat" ON "evidence" USING ivfflat ("embedding" vector_cosine_ops);
CREATE INDEX "map_point_gix" ON "map_point" USING gist ("geom_3857");
CREATE INDEX "idx_map_point_event_date" ON "map_point" USING btree ("event_date");
CREATE INDEX "idx_map_point_tier" ON "map_point" USING btree ("tier");
CREATE INDEX "idx_map_point_theater" ON "map_point" USING btree ("theater");

-- Allow the default CI/app role to read/write fixture data.
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;