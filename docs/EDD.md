# PeaceClock — Engineering Design Document

**Status:** Draft
**Author:** David Morgan (eng)
**Branding & Design:** New Florence Interactive, an LLC
**Last updated:** 2026-06-16
**Companion:** [PRD.md](./PRD.md) — product requirements this design implements.

---

## 1. Scope

This EDD describes how we build PeaceClock as specified in the PRD: a confirmed-only, two-view (date-controlled counter + full-screen map) casualty tracker for the war in Ukraine, with per-side/per-window counts, four authentication tiers, a user-movable threshold, and an AI corroboration layer (Haiku 4.5 → Opus 4.8 escalation). It covers architecture, data model, the as-of/windowed query engine, the ingestion + AI pipeline, the map, audit, cost controls, and operational concerns. It does **not** re-argue product decisions — those are settled in the PRD.

## 2. Engineering goals & non-goals

**Goals**
- Sub-2s first paint for the counter (PRD §7); threshold slider and date scrub recompute without a full reload.
- Counts are **derived from an append-only evidence store** — every number is reconstructible and auditable.
- The AI pipeline is bounded in cost (PRD §12) and fully logged for audit (PRD §6.4).
- Correct "as of date D" semantics across all windows and tiers.

**Non-goals**
- Real-time (<24h) updating; sub-daily windows (PRD §3).
- Building our own map tile infrastructure — we consume a tile provider.
- Producing original casualty assessments — we ingest others' confirmations.

## 3. Architecture overview

```
                       ┌─────────────────────────────────────────────┐
   Sources             │  Ingestion workers (Vercel Cron, daily)     │
   (OHCHR, Mediazona,  │   fetch → normalize → dedupe(hash) → store   │
    news, X/OSINT) ───▶│   → enqueue corroboration job               │
                       └───────────────┬─────────────────────────────┘
                                       ▼
                       ┌─────────────────────────────────────────────┐
   Vector prefilter ◀──│  Corroboration pipeline (Batch, daily)      │
   (pgvector, Voyage)  │   embed → top-K similar → Haiku score        │
                       │   → tier + geolocate → Opus escalate (rare)  │
                       │   → write casualty rows + audit + agg deltas │
                       └───────────────┬─────────────────────────────┘
                                       ▼
   Postgres (Neon)  ── evidence ── casualties ── daily_agg ── audit ── embeddings(pgvector/PostGIS)
                                       ▲
                       ┌───────────────┴─────────────────────────────┐
   Next.js (App Router on Vercel) — backend APIs + web app + promo site │
     /api/counts   → range-sum over daily_agg (counter)              │
     /api/map      → clustered evidence pins (map)                   │
     /api/evidence → pin/figure detail                               │
                       └───────────────┬─────────────────────────────┘
                                       │  same JSON/GeoJSON contract (§9.4)
                 ┌─────────────────────┼──────────────────────┬───────────────┐
                 ▼                     ▼                      ▼               ▼
          Web app + promo      iOS / iPadOS app        Android app      macOS app
          (Next.js, Vercel)    (Expo RN, App Store)    (Expo RN, Play)  (iPad-app on
          View 1 + View 2      MapLibre Native         MapLibre Native   Apple Silicon →
                                                                         Mac App Store)
```

## 4. Technology choices

| Layer | Choice | Rationale |
|---|---|---|
| App / API | **Next.js (App Router) on Vercel** | RSC for fast counter first paint; route handlers for the data APIs; Cron for ingestion. Also serves the web app + promotional website. |
| Native apps | **Expo / React Native** (iOS, Android) + **MapLibre Native** | One TypeScript/React client across mobile stores, sharing types/logic with the web client and the same backend APIs (§9.4). |
| macOS app | **"Designed for iPad" on Apple Silicon** → Mac App Store (React Native macOS as a later fidelity upgrade) | Lowest-effort route to a Mac App Store binary from the same Expo app; avoids a separate codebase for v1 (§9.4, §14). |
| Build & submit | **Expo EAS Build + EAS Submit** (Fastlane under the hood) | Cloud builds and store submission to App Store Connect + Google Play; macOS via the iPad-app path. |
| Primary DB | **Postgres (Neon)** | Relational fits the evidence→casualty→aggregate model; serverless-friendly. |
| Vector search | **pgvector** extension | Keeps embeddings next to the data; powers the §8 prefilter without a separate vector store. |
| Geo | **PostGIS** extension | Geo clustering, bbox queries, ST_ClusterDBSCAN for the map. |
| Embeddings | **Voyage AI** (`voyage-3`) | Anthropic-recommended embeddings; used for candidate prefilter + dedup. |
| LLM | **Anthropic** — Haiku 4.5 default, Opus 4.8 escalation (`claude-haiku-4-5` / `claude-opus-4-8`), via Batch API | PRD §6.4; pricing/cost controls in PRD §12. |
| Map render | **MapLibre GL JS** + third-party vector tiles (MapTiler/Protomaps) | Open, no per-pin licensing; clustering client+server. |
| Media | **Vercel Blob** for cached thumbnails; originals linked, not embedded | PRD §9 — graphic content linked, not hosted. |
| Jobs | **Vercel Cron** + a durable queue for corroboration fan-out | Daily cadence (PRD §6.5); batchable, not latency-critical. |
| Observability | OpenTelemetry traces + a per-item AI-cost meter | PRD §12 budget guardrail + §8 metric. |

## 5. Data model

Append-only at the core; aggregates are derived and rebuildable.

### 5.1 `evidence`
A single sourced item. Immutable once written (corrections are new rows / audit entries).
```
evidence(
  id              uuid pk,
  kind            enum('official','news','x_post'),
  publisher       text,            -- e.g. 'OHCHR', 'Mediazona', '@user'
  url             text,
  published_at    date,            -- source publication date
  raw             jsonb,           -- normalized source payload
  content_hash    text unique,     -- dedup at ingest (PRD §12 triage)
  embedding       vector(1024),    -- Voyage; pgvector + ivfflat index
  geom            geography(Point),-- nullable; AI/source-provided (PostGIS)
  geo_confidence  real,            -- 0..1; independent of tier (PRD §A.4)
  geo_status      enum('source','ai_auto','audited'),
  ingested_at     timestamptz default now()
)
```

### 5.2 `casualty`
The counted unit. Tier and dedup live here; aggregates read from here.
```
casualty(
  id              uuid pk,
  side            enum('ua_coalition','russia'),
  category        enum('killed','wounded','missing_pow'),
  audience        enum('military','civilian'),   -- civilian series kept separate (PRD §4)
  count           int default 1,                 -- 1 for named; N for event-level OSINT
  event_date      date not null,                 -- when the casualty occurred (as-of axis)
  tier            enum('official','confirmed','osint','ai_corroborated'),
  status          enum('counted','unverified','rejected'),
  dedup_group     uuid,                          -- canonical row per real-world casualty/event
  is_canonical    boolean,                       -- only canonical rows hit aggregates
  match_score     real,                          -- §A.2 s, when AI-assigned
  created_at      timestamptz default now()
)
casualty_evidence(casualty_id, evidence_id)      -- M:N; one casualty, many corroborating items
```

### 5.3 `daily_agg` (derived rollup — the query engine's backbone)
```
daily_agg(
  day        date,
  side       enum, category enum, audience enum,
  tier       enum,
  count      int,                 -- sum of canonical casualty.count for that cell
  primary key(day, side, category, audience, tier)
)
```
Rebuildable from `casualty` at any time. Updated incrementally as the pipeline writes (delta upserts). This is what the counter and map filters read — never a scan of `casualty`.

### 5.4 `audit_log`
```
audit_log(
  id, casualty_id, actor enum('ai_haiku','ai_opus','human'),
  action enum('tier_assign','tier_change','geo_assign','geo_fix','dedup_merge','reject'),
  before jsonb, after jsonb, reason text, model_cost_usd numeric, at timestamptz
)
```
Satisfies PRD §6.4 (logged corrections) and §12 (per-item cost). Human audit queue is a view over `casualty` where `tier='ai_corroborated'` ordered by recency/impact.

## 6. The as-of / windowed count engine

This is the load-bearing piece. PRD §6.1: every count is computed **as of the selected date D**, per side/category, across windows {24h, 7d, 30d, 90d, 1y, total}, at or above an authentication **threshold T**.

**Attribution axis:** `event_date` (when the casualty occurred). "As of D" = casualties with `event_date ≤ D`. (The alternate "as *known* on D" view, using `confirmed_at`, is deferred — see §15.)

**Count definition** for side S, category C, audience A, window W, threshold T:
```
sum(daily_agg.count)
 where side=S and category=C and audience=A
   and tier >= T                          -- tiers ordered official>confirmed>osint>ai_corroborated
   and day in window(W, D)                -- e.g. 7d → [D-6, D]; total → [INVASION_START, D]
```
- **Tier-threshold** is a sum over the tier dimension ≥ T — so moving the slider (PRD §5.1) is just re-summing already-fetched rows; the client can hold all four tiers' daily series and re-aggregate locally with **zero extra requests**.
- **Windows** are range-sums over `day`. We maintain a **per-(side,category,audience,tier) cumulative prefix sum** so `total` and any window are O(1) lookups (`prefix[D] - prefix[D-window]`).
- The full matrix for a given D and all tiers is small (6 windows × 2 sides × 3 categories × 2 audiences × 4 tiers) and cacheable per-day. `/api/counts?asOf=D` returns the per-day tier series for the visible range; the slider and the 24h/7d/.../total cells are computed client-side.

**Caching:** `daily_agg` for past days is immutable once audited; cache aggressively (CDN + per-day cache key). Only the trailing edge (recent days, still receiving evidence) is revalidated.

## 7. Ingestion

Per-source adapters, run on Vercel Cron (daily; per-source cadence configurable):
1. Fetch new items since last watermark.
2. Normalize to the `evidence` shape; compute `content_hash`.
3. **Triage (pre-LLM, PRD §12):** drop exact/near-duplicate hashes, apply source allowlist, rule-based junk filter.
4. Persist `evidence`; embed via Voyage; enqueue a corroboration job.
5. Official-tier sources (OHCHR) can short-circuit: they mint `casualty` rows at `tier='official'` without AI (PRD §A.1) — still embedded for dedup.

A belligerent's claim about its enemy is tagged and **excluded from confirmation** at this layer (PRD §6.2) — stored for context only.

## 8. AI corroboration pipeline

Implements PRD §6.4 + Appendix A, with PRD §12 cost controls baked in. Runs as a **daily batch**, not per-request.

1. **Embedding prefilter (not the LLM).** For each new evidence item, `pgvector` returns the **top-K** (K≈20) nearest DB items above a similarity floor. The LLM never sees the whole DB — token cost is O(K). This is also the §A.3 dedup candidate set.
2. **Haiku scoring.** One Haiku 4.5 call scores the item against the K candidates → match score `s` (§A.2 weights), corroborating `c` / contradicting `k` tallies. The **static A.1/A.2 rubric is a cached prefix** (≈0.1× input). Calls are submitted via the **Batch API (−50%)**.
3. **Threshold logic (§A.3), in order:** dedup/merge (`s≥0.90` vs a counted casualty → attach evidence, set `is_canonical=false`); OSINT (`s≥0.85, c≥2, k=0`); AI-corroborated (`0.70≤s<0.85, c≥1, c>k`); else `status='unverified'`.
4. **Geolocation.** Haiku proposes coordinates from text/media → `geom`, `geo_confidence`, `geo_status='ai_auto'`, flagged for audit. Geo confidence never changes `tier` (PRD §A.4).
5. **Opus escalation — rare and targeted.** Only when §A.3 rule 5 fires **and** the item could cross the **default headline threshold** (Official+Confirmed). The gray-band/contradiction/duplicate/sensitive triggers go to a **daily-capped** Opus 4.8 queue (budget-bounded, PRD §12). Opus adjudicates → final tier + `audit_log`.
6. **Write.** Upsert `casualty`, append `casualty_evidence`, write `audit_log` (with `model_cost_usd`), and apply incremental `daily_agg` deltas.
7. **Idempotency.** An item already tiered is not re-scored unless *new contradicting* evidence links to its dedup group.

**Budget guardrail.** A running monthly spend meter (from `audit_log.model_cost_usd` + batch usage) gates the pipeline: over cap → new items land `status='unverified'` (queued), not sent to a model (PRD §12). Per-item cost is exported as a metric.

### 8.1 Worker implementation

The Anthropic Batch API is asynchronous (minutes–24h), so the worker is a **resumable state machine persisted in the DB**, advanced by Vercel Cron — not a long-running process. Each `evidence` row carries a status; each cron tick advances whatever stage is ready and is safe to run concurrently.

```
evidence.corro_status:  pending → embedded → scoring → scored → (escalating →) done | unverified
```

```sql
-- in-flight batch tracking
corro_batch (
  id            uuid pk,
  provider_id   text,                       -- Anthropic batch id (msgbatch_…)
  stage         enum('haiku','opus'),
  status        enum('submitted','ended','processed'),
  evidence_ids  uuid[],
  submitted_at  timestamptz, ended_at timestamptz
);
-- month-to-date spend meter (single row per month)
spend_meter (month date pk, usd numeric, cap_usd numeric);
```

**Tick A — embed.** Claim `pending` rows, embed via Voyage, set `embedded`. Claiming uses `FOR UPDATE SKIP LOCKED` so overlapping ticks never double-process:

```sql
UPDATE evidence SET corro_status = 'embedding'
WHERE id IN (
  SELECT id FROM evidence WHERE corro_status = 'pending'
  ORDER BY ingested_at LIMIT 500
  FOR UPDATE SKIP LOCKED
) RETURNING id, raw->>'text' AS text;
```

**Tick B — prefilter + submit Haiku batch.** For each `embedded` item, `pgvector` returns the top-K candidates (the §A.3 dedup set too). The LLM never sees the whole DB — cost is O(K):

```sql
-- ivfflat index: CREATE INDEX ON evidence USING ivfflat (embedding vector_cosine_ops);
SELECT c.id, c.kind, c.publisher, c.published_at, c.raw->>'text' AS text,
       1 - (c.embedding <=> $q) AS sim
FROM   evidence c
WHERE  c.id <> $newId
  AND  (c.embedding <=> $q) < 0.40          -- cosine-distance floor ≈ sim ≥ 0.60 (§A.2 floor)
ORDER  BY c.embedding <=> $q
LIMIT  20;                                   -- K
```

We **do not** ask the model for the final score `s`. Haiku returns, per candidate, the four §A.2 sub-dimensions in [0,1] and a `corroborates | contradicts | unrelated` label, plus a geolocation proposal — and the worker computes `s`, `c`, `k` deterministically from the §A.2 weights. This keeps the threshold math in code (auditable, tunable per §14) rather than in the model. Structured output enforces the shape:

```ts
// one batch request per evidence item; rubric is a CACHED system prefix (≈0.1× input)
const req = {
  custom_id: evidenceId,
  params: {
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [{ type: "text", text: RUBRIC_A1_A2, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: ASSESSMENT_SCHEMA } },
    messages: [{ role: "user", content: renderPostAndCandidates(post, candidates) }],
  },
};
// ASSESSMENT_SCHEMA → {
//   candidates: [{ id, where:0..1, when:0..1, what:0..1, who:0..1,
//                  relation: "corroborates"|"contradicts"|"unrelated" }],
//   geo: { lat, lng, confidence } | null
// }
const batch = await anthropic.messages.batches.create({ requests });   // −50% Batch pricing
await db.corroBatch.insert({ provider_id: batch.id, stage: "haiku",
                             status: "submitted", evidence_ids });
```

Before submitting, the **budget gate** checks `spend_meter`: if month-to-date ≥ cap, the claimed items are set `unverified` and no batch is sent (PRD §12).

**Tick C — poll & process.** For each `submitted` batch, `batches.retrieve`; when `processing_status === "ended"`, stream `batches.results` and apply §A.3 **in code**:

```ts
for (const r of await anthropic.messages.batches.results(batch.provider_id)) {
  if (r.result.type !== "succeeded") { markUnverified(r.custom_id); continue; }
  const a = parse(r.result.message);                       // ASSESSMENT_SCHEMA
  const scored = a.candidates.map(c => ({
    ...c, s: 0.30*c.where + 0.25*c.when + 0.25*c.what + 0.20*c.who,
  }));
  const top = maxBy(scored, "s");
  const c = scored.filter(x => x.relation === "corroborates" && x.s >= 0.60).length;
  const k = scored.filter(x => x.relation === "contradicts"  && x.s >= 0.60).length;

  const tier = applyThresholds(top, c, k);                 // §A.3 rules 1–4, returns tier | "escalate" | "unverified"
  await writeOutcome(r.custom_id, { tier, score: top.s, c, k, geo: a.geo });
}
await db.corroBatch.update(batch.id, { status: "processed" });
```

`applyThresholds` is the literal §A.3 ladder: dedup/merge (`s≥0.90` vs a *counted* casualty → attach evidence, `is_canonical=false`, no new count); OSINT (`s≥0.85, c≥2, k=0`); AI-corroborated (`0.70≤s<0.85, c≥1, c>k`); gray band / contradiction / near-dup / sensitive → `escalate`; else `unverified`.

**Tick D — Opus escalation (rare, gated).** Items flagged `escalate` are filtered to those that **could cross the default headline threshold** (Official+Confirmed) and submitted as a second, **daily-capped** batch on `claude-opus-4-8` with the same candidates + the contradicting evidence. Opus returns a final tier via structured output; the worker writes it. Everything else flagged `escalate` but below the headline-impact bar stays `ai_corroborated` (map-only) without paying 5× (PRD §12).

**Writing an outcome** (`writeOutcome`) is one transaction:
1. upsert `casualty` (side/category/audience from the assessment, `event_date`, `tier`, `count`, `dedup_group`, `is_canonical`),
2. append `casualty_evidence`,
3. set `geom/geo_confidence/geo_status='ai_auto'` on the evidence (flagged for audit),
4. `apply_agg_delta(event_date, side, category, audience, tier, +count)` — and on a later tier change, `−count` from the old tier cell, `+count` to the new, keeping `daily_agg` + prefix sums correct (§6),
5. append `audit_log` with `actor`, `before/after`, `reason`, and `model_cost_usd`,
6. `spend_meter.usd += batch_share_of_cost`.

**Idempotency & recovery.** Status transitions are monotonic and claimed with `SKIP LOCKED`; a crashed tick leaves a batch in `submitted`/`ended` and the next tick resumes it. A re-delivered result is a no-op because the evidence is already `done`. Re-scoring only happens when *new contradicting* evidence links to a dedup group (§8 idempotency rule), which re-opens just that group.

**Substrate.** Cron + DB state is deliberately boring and resumable. If the daily fan-out outgrows a single cron invocation at OSINT volume, the same state machine maps onto a durable workflow/queue runner without changing the stage semantics (§14).

## 9. APIs & views

### 9.1 `/api/counts?asOf=D`
Returns, for the visible date range, the per-day series keyed by (side, category, audience, tier). Small payload; CDN-cached per day. The **counter (View 1)** is an RSC shell that renders the default-threshold headline server-side (fast first paint), then hydrates a client slider/date-scrubber that recomputes windows and threshold locally from the fetched series.

### 9.2 `/api/map?asOf=D&tiers=...&side=...&bbox=...&zoom=...`
Returns clustered evidence pins for the viewport. Server-side clustering via PostGIS `ST_ClusterDBSCAN` (mid zoom) → individual evidence (high zoom). **Map (View 2)** is MapLibre; the same `asOf`/threshold/side/category controls drive both views (shared URL state). Pin detail → `/api/evidence/:id` (source/news/X link, tier, side, date; for AI-corroborated, the corroborating items + match score + contradicting evidence). The clustering implementation is §9.3.

### 9.3 Map clustering — implementation

**What we cluster.** Not raw `evidence` (an evidence item can back several casualties → double-counting). The pipeline maintains a denormalized `map_point`: **one row per counted, canonical casualty**, with a resolved location taken from its best-geolocated evidence. This keeps the map consistent with the counts (§6) and gives clustering a clean, single-geometry input.

```sql
map_point (
  casualty_id   uuid primary key,
  evidence_id   uuid,                       -- representative (best geo_confidence) evidence for pin detail
  side          enum, category enum, audience enum,
  tier          enum,
  event_date    date,
  geo_confidence real,
  geom_3857     geometry(Point, 3857)       -- ST_Transform(evidence.geom::geometry, 3857), precomputed
);
CREATE INDEX map_point_gix  ON map_point USING gist (geom_3857);
CREATE INDEX map_point_date ON map_point (event_date);
CREATE INDEX map_point_tier ON map_point (tier);
```

We cluster in **EPSG:3857 (Web Mercator)**, not geography. 3857's coordinate units already bake in the Mercator scaling, so a constant per-zoom `eps` yields **screen-uniform clusters** — pins that are N pixels apart on screen cluster regardless of latitude. The conversion from a pixel radius to 3857 units at a given zoom (512px tiles):

```
worldUnitsPerPixel(z) = 40075016.6855785 / (512 * 2^z)   -- earth circumference (m) / pixels across the world
eps(z)                = pixelRadius * worldUnitsPerPixel(z)   -- pixelRadius ≈ 60
```

**The query** (parameters: `bbox` in 3857, `z`, `asOf`, `tiers[]` = the tier set at/above the slider, optional `side`/`category`/`audience`, `pixelRadius`):

```sql
WITH params AS (
  SELECT
    ST_MakeEnvelope($minX, $minY, $maxX, $maxY, 3857)               AS bbox,
    $pixelRadius * (40075016.6855785 / (512 * pow(2, $z)))::float8  AS eps
),
filtered AS (                              -- bbox + facet filters; uses the GiST + btree indexes
  SELECT mp.casualty_id, mp.evidence_id, mp.side, mp.tier,
         mp.geo_confidence, mp.geom_3857
  FROM   map_point mp, params p
  WHERE  mp.geom_3857 && p.bbox
    AND  mp.event_date <= $asOf
    AND  mp.tier = ANY($tiers)
    AND  ($side     IS NULL OR mp.side     = $side)
    AND  ($category IS NULL OR mp.category = $category)
    AND  ($audience IS NULL OR mp.audience = $audience)
),
clustered AS (                             -- window function over the bounded candidate set
  SELECT f.*,
         ST_ClusterDBSCAN(geom_3857, eps := (SELECT eps FROM params), minpoints := 1)
           OVER ()                         AS cid
  FROM filtered f
)
SELECT
  cid,
  count(*)                                                   AS n,
  ST_AsGeoJSON(
    ST_Transform(ST_Centroid(ST_Collect(geom_3857)), 4326)
  )::json                                                    AS centroid,            -- pin position
  ST_AsGeoJSON(
    ST_Transform(ST_Envelope(ST_Collect(geom_3857)), 4326)
  )::json                                                    AS bounds,              -- fitBounds on click
  mode() WITHIN GROUP (ORDER BY side)                        AS dominant_side,       -- pin color
  max(tier)                                                  AS top_tier,            -- strongest tier in cluster (badge)
  (array_agg(casualty_id ORDER BY geo_confidence DESC))[1]   AS rep_casualty_id,     -- used when n = 1
  (array_agg(evidence_id ORDER BY geo_confidence DESC))[1]   AS rep_evidence_id
FROM clustered
GROUP BY cid;
```

Notes that matter:
- **`minpoints := 1`** — every point becomes a core point, so singletons get their own `cid` (no `NULL` "noise" bucket to special-case). A cluster with `n = 1` is rendered as an individual pin and carries `rep_evidence_id` for the detail call.
- **`ST_ClusterDBSCAN` is an in-memory window function** over the candidate set, so it does **not** use the spatial index for the clustering step — the `bbox &&` filter in `filtered` is what keeps the candidate set small enough to cluster cheaply. Bounding the input is mandatory, not optional.
- **`tiers[]`** is the explicit set of authentication tiers at/above the slider threshold (PRD §5.1), so the map reacts to the same control as the counter. `event_date <= $asOf` enforces the as-of axis (§6).
- Output is assembled into a **GeoJSON `FeatureCollection`** (cluster features carry `n`, `top_tier`, `dominant_side`, `bounds`; singletons carry the rep IDs) and handed to MapLibre.

**Zoom strategy (hybrid).** Pure DBSCAN at world zoom over tens of thousands of points per pan is too heavy. We switch by zoom band:
- `z < 8` — **grid aggregate** with `ST_SnapToGrid(geom_3857, cell(z))` + `GROUP BY` (cheap, coarse) instead of DBSCAN.
- `8 ≤ z ≤ 14` — the **DBSCAN** query above.
- `z > 14` — **raw points**, no clustering (return `filtered` directly).

**Caching.** The response is keyed by `(quantized bbox, z, sorted tiers, side, category, audience, asOf-day)`. Past `asOf` days are immutable (§6), so their cluster responses are CDN-cacheable indefinitely; only the trailing day revalidates. Bbox is snapped to a tile grid before keying so neighboring pans hit the same cache entries.

### 9.4 Clients & distribution

PeaceClock ships four product surfaces (PRD §5.3) over **one backend** and **one API contract**. Nothing about the data model, the count engine (§6), or the corroboration pipeline (§8) is client-specific — clients are thin renderers of `/api/counts`, `/api/map`, and `/api/evidence`.

**Shared contract.** The API responses are typed in a `@peaceclock/api-types` package consumed by both the web client and the native client, so the counter matrix, tier enum, and map GeoJSON have one definition. The counter is a small per-day tier series (§6) the client aggregates locally; the map is a GeoJSON `FeatureCollection` (§9.3). Both shapes are identical across platforms, so the date controller, threshold slider, side/category filters, and as-of logic are written once as platform-agnostic TypeScript and only the rendering differs.

**Surfaces:**
- **Web app + promotional website** — Next.js on Vercel (the canonical client). The promo site is the same Next.js app: marketing/landing routes, the methodology and about/funding pages, App Store / Google Play / Mac App Store badges, and the **live counter server-rendered** for fast first paint and link previews. Both views run in the browser (MapLibre **GL JS** for the map). Universal-link / App-Link routes (`/c/...`, `/m/...`) resolve to the same state on web and hand off to the app when installed.
- **iOS / iPadOS (Apple App Store)** and **Android (Google Play)** — one **Expo / React Native** app. View 1 is RN components over the shared TS logic; View 2 uses **MapLibre Native** (`@maplibre/maplibre-react-native`) consuming the *same* `/api/map` GeoJSON and tile provider as web. Deep links via universal links (iOS) / App Links (Android).
- **macOS (Mac App Store)** — v1 ships the **iPad app on Apple Silicon** ("Designed for iPad"), giving a Mac App Store binary from the same Expo project with no separate codebase. If we need true desktop chrome (resizable window, menu bar), **React Native macOS** is the planned fidelity upgrade — still sharing the TS core (§14).

**Offline / last-known-good (PRD §5.3, §7).** Native apps persist the most recent `/api/counts` series and a small set of map tiles + cluster responses locally (SQLite/MMKV). When offline, the app renders the cached state with a clear "as of <timestamp>" banner and disables the date scrubber beyond cached range. Because past-day aggregates are immutable (§6), cached history never goes stale — only the trailing edge needs a refresh.

**Build & release.** **Expo EAS Build + EAS Submit** produces and uploads binaries to App Store Connect and Google Play; the macOS build follows the iPad-app path. Native config (versioning, entitlements, signing) lives in `app.config.ts`; CI runs typecheck + the shared-logic test suite before an EAS build. The web app/promo site deploy on Vercel.

**Store-review engineering (PRD §5.3, §9).** Handled in the client, not the backend: content rating set to reflect a news/informational app about an armed conflict; **no graphic media is ever embedded** — evidence opens its source URL in an in-app browser / external link, satisfying the "linked, not hosted" rule (§11); Apple **privacy-nutrition labels** and Google **Data Safety** declare only privacy-respecting aggregate analytics and no account/PII; neutral, non-political framing in store copy and in-app (§9). No login, no purchases, no ads.

## 10. Performance

- Counter: server-rendered headline + a single `/api/counts` fetch; immutable past-day aggregates are CDN-cached; slider/scrub are client-local (no round trips).
- Map: vector tiles cached at the edge; pin queries bounded by bbox+zoom; clusters precomputable per (day, tier-set) for common filters.
- `daily_agg` + prefix sums keep every count an indexed range-sum, never a `casualty` scan.

## 11. Observability, security, privacy

- **Cost:** per-item `model_cost_usd` + batch usage → monthly meter, dashboarded; drives the §8 guardrail.
- **Audit:** every AI/human action in `audit_log`; the human queue is a view; corrections are reversible at the casualty level without changing history.
- **Privacy/sensitivity (PRD §9):** graphic/identifying media is **linked, never embedded**; Blob stores only non-graphic thumbnails where safe. No tracking beyond privacy-respecting aggregate analytics.
- **Neutrality:** enemy-claim exclusion enforced in ingest; same pipeline both sides.

## 12. Failure modes

| Failure | Handling |
|---|---|
| Source unreachable | Serve last-known-good `daily_agg` (PRD §7); watermark unadvanced, retry next cron. |
| Model/Batch outage | Items stay `unverified`/queued; counts unaffected; backfill on recovery. |
| Budget cap hit | Queue as `unverified`; alert; no silent overspend. |
| Bad AI tier/geo | Human audit promotes/demotes/repositions; `audit_log` records it; `daily_agg` delta re-applied. |
| Source revision changes a figure | New evidence rows + audit; canonical casualty updated; aggregates recomputed for affected days. |

## 13. Milestone mapping (PRD §11)

- **M1 Foundations** → §5 schema, §7 OHCHR + one military source/side, embeddings.
- **M2 Counter** → §6 engine, §9.1 API, View 1 with slider (web).
- **M3 AI corroboration** → §8 full pipeline (prefilter, Haiku/Opus, geolocate, audit queue) + §12 cost controls.
- **M4 Map** → §9.2/§9.3, PostGIS clustering, MapLibre GL JS (web).
- **M5 Promotional website** → §9.4 Next.js marketing routes, SSR live counter, methodology/about pages, store badges.
- **M6 Apps & store submission** → §9.4 Expo/RN clients (iOS, Android), MapLibre Native, macOS via iPad-app path, EAS Build/Submit, store-review prep.
- **M7 Polish/launch** → §10 perf, §11 a11y/audit, §9.4 offline/last-known-good, coordinated multi-surface launch.

## 14. Open engineering questions

- **Embedding model & dimension** — confirm `voyage-3` (1024-d) vs a multilingual variant given Ukrainian/Russian source text.
- **`event_date` extraction** — how reliably can we date a casualty from an OSINT post; fallback when only `published_at` is known.
- **Queue/worker substrate** — Vercel Cron + a durable queue vs a dedicated worker for the daily batch fan-out at OSINT volume.
- **"As of" semantics v2** — add a `confirmed_at`-based "as known on D" view alongside the `event_date` view? (deferred)
- **Map tile provider** — MapTiler vs self-hosted Protomaps for cost/offline-degradation (PRD §10).
- **Aggregate recompute cost** — incremental `daily_agg` deltas vs periodic full rebuild for correctness after large source revisions.
- **macOS fidelity** — ship "Designed for iPad" on Apple Silicon for v1, or invest in React Native macOS for native desktop chrome up front? (§9.4)
- **Code-sharing depth** — how much UI to share between web (React) and native (React Native) via `react-native-web` vs. keeping platform-specific view layers over a shared TS core.
- **Map parity** — confirm MapLibre Native renders the §9.3 GeoJSON clusters and the chosen tile provider identically to MapLibre GL JS on web; reconcile any clustering/style differences.
