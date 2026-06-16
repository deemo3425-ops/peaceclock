# PeaceClock — M1 (Foundations) Task Breakdown

**Milestone:** M1 — Foundations (PRD §11.1, EDD §13)
**Goal:** Stand up the data model, the confirmation-tier definitions, embeddings, and ingestion for OHCHR civilians + one confirmed military source per side — so that real, sourced, tiered casualty rows land in the database and roll up into `daily_agg`. No UI in M1; the counter (View 1) is M2.

**Exit criteria for M1**
- Schema (EDD §5) migrated on Neon with `pgvector` + `PostGIS` enabled.
- Tier definitions (PRD Appendix A.1) encoded as config + documented.
- OHCHR civilian series backfilled from 2022-02-24 to present at `tier='official'`.
- One confirmed military source per side ingesting and producing `tier='confirmed'`/`official` rows (RU live; UA source chosen).
- Every ingested item is embedded (Voyage) and deduped by `content_hash`.
- `daily_agg` + prefix sums correctly reflect all ingested counts via `apply_agg_delta`.
- CI green: typecheck, migration check, ingestion + agg unit/integration tests.

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d. Each task lists **deps** and **acceptance**.

---

## WS0 — Project & infra scaffolding

- **T0.1 — Repo + app scaffold** (S)
  Next.js (App Router) + TypeScript monorepo; `@peaceclock/api-types` package stub (EDD §9.4); lint/format/typecheck config.
  *Acceptance:* `pnpm build` + `pnpm typecheck` pass in CI on a clean checkout.

- **T0.2 — Neon Postgres + extensions** (S) — deps: T0.1
  Provision Neon; enable `pgvector` and `postgis`; wire `DATABASE_URL`; pooled vs direct connection documented.
  *Acceptance:* a smoke query confirms both extensions load (`SELECT postgis_version()`, `vector` type usable).

- **T0.3 — Migration tooling** (S) — deps: T0.2
  Pick + wire a migration runner (e.g. drizzle-kit / node-pg-migrate); `migrate up/down` in CI; one no-op baseline migration.
  *Acceptance:* CI runs migrations against an ephemeral DB and a rollback succeeds.

- **T0.4 — Secrets & env** (S) — deps: T0.1
  `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `DATABASE_URL`, source API keys in Vercel env (preview/prod separated); `.env.example`.
  *Acceptance:* env schema validated at boot; missing var fails fast with a clear message.

- **T0.5 — Observability + cost-meter skeleton** (M) — deps: T0.2
  OpenTelemetry tracing baseline; `spend_meter` table (EDD §8.1) created with the monthly cap configurable; a `recordModelCost()` helper (no-op until M3 but wired).
  *Acceptance:* `spend_meter` row auto-creates per month; a unit test asserts cap read/write.

---

## WS1 — Data model & migrations (EDD §5)

- **T1.1 — Core enums** (S) — deps: T0.3
  `side`, `category`, `audience`, `tier` (ordered: official>confirmed>osint>ai_corroborated), `evidence.kind`, status enums.
  *Acceptance:* enums created; tier ordering encoded (numeric rank helper) and unit-tested.

- **T1.2 — `evidence` table** (M) — deps: T1.1
  All columns per EDD §5.1 incl. `embedding vector(1024)`, `geom geography(Point)`, `content_hash unique`, `corro_status`.
  *Acceptance:* migration applies; `content_hash` unique constraint rejects dup insert; GiST index on `geom`, ivfflat index on `embedding` (`vector_cosine_ops`) created.

- **T1.3 — `casualty` + `casualty_evidence`** (M) — deps: T1.1
  Per EDD §5.2; M:N link table; indexes on `(side,category,audience,event_date,tier)` and `dedup_group`.
  *Acceptance:* FK integrity enforced; can insert a casualty linked to ≥1 evidence.

- **T1.4 — `daily_agg` + prefix-sum support** (M) — deps: T1.3
  Per EDD §5.3; PK `(day,side,category,audience,tier)`; a `daily_agg_prefix` materialization or query path for O(1) windows (EDD §6).
  *Acceptance:* schema applies; a fixture proves a window range-sum + total prefix lookup return correct numbers.

- **T1.5 — `audit_log`** (S) — deps: T1.3
  Per EDD §5.4 incl. `model_cost_usd`.
  *Acceptance:* insert + query by `casualty_id` works; cost column numeric.

- **T1.6 — `map_point` denorm table** (S) — deps: T1.3
  Per EDD §9.3 incl. `geom_3857`, indexes (GiST + btree on date/tier). (Populated by pipeline later; table + indexes now.)
  *Acceptance:* table + indexes created; `ST_Transform` into `geom_3857` validated on a sample row.

- **T1.7 — `corro_batch`** (S) — deps: T1.1
  Per EDD §8.1 (used in M3; create now so ingestion can set `corro_status`).
  *Acceptance:* table created; status enum present.

---

## WS2 — Tiers & count engine primitives

- **T2.1 — Encode confirmation bar per tier** (M) — deps: T1.1
  Implement PRD Appendix A.1 as config: per-tier admission rules + A.2 weights (Where .30 / When .25 / What .25 / Who .20) + A.3 thresholds as tunable constants in one module (`tiering.config.ts`). Documented inline against Appendix A.
  *Acceptance:* constants exported + unit-tested against the §A.5 worked example (s=0.74 → AI-corroborated, gray-band escalate flag).

- **T2.2 — `apply_agg_delta` function** (M) — deps: T1.4
  SQL/TS function: on casualty create/tier-change, `+count`/`−count` the correct `(day,side,category,audience,tier)` cell and keep prefix sums consistent (EDD §6, §8.1 writeOutcome step 4). Transactional.
  *Acceptance:* property test — random casualty insert/tier-change sequences leave `daily_agg` equal to a from-scratch recount; concurrent deltas (2 tx) don't lose updates.

- **T2.3 — `daily_agg` rebuild job** (S) — deps: T2.2
  Idempotent full recompute from `casualty` (for correctness recovery, EDD §12/§14).
  *Acceptance:* running rebuild after a series of deltas yields identical aggregates (no drift).

---

## WS3 — Embeddings (EDD §4, §8.1)

- **T3.1 — Voyage client + embed helper** (S) — deps: T0.4
  `embed(text): vector(1024)` via `voyage-3`; batching; retry/backoff; cost recorded via `recordModelCost()`.
  *Acceptance:* helper returns a 1024-d vector; rate-limit retry covered by a test (mocked).

- **T3.2 — Embedding write path + index tuning** (S) — deps: T1.2, T3.1
  Populate `evidence.embedding` on ingest; set `ivfflat` lists + `ivfflat.probes`; document the recall/latency tradeoff.
  *Acceptance:* a top-K cosine query (`<=>`) returns expected nearest neighbors on a seeded fixture within target latency.

> Note: multilingual embedding choice (UA/RU source text) is an open question (EDD §14) — T3.1 ships `voyage-3` with the model behind config so it can be swapped without a migration.

---

## WS4 — Ingestion framework (EDD §7)

- **T4.1 — Adapter interface + scheduler** (M) — deps: T1.2
  Define `SourceAdapter { fetchSince(watermark), normalize(raw) → evidence }`; a per-source `watermark` store; Vercel Cron entrypoint that runs adapters daily.
  *Acceptance:* a fake adapter ingests fixtures end-to-end and advances its watermark; re-run is idempotent.

- **T4.2 — Normalize + triage + persist** (M) — deps: T4.1, T1.2, T3.2
  Compute `content_hash`; pre-LLM triage (exact/near-dup drop, source allowlist, junk filter — PRD §12); persist `evidence`; embed; set `corro_status='pending'`.
  *Acceptance:* duplicate payloads are dropped at the hash gate; persisted rows carry embeddings; counts of ingested/dropped logged.

- **T4.3 — Official-tier short-circuit** (S) — deps: T4.2, T2.2
  Official sources (OHCHR) mint `casualty` rows at `tier='official'` without AI (PRD §A.1) and call `apply_agg_delta` — still embedded for dedup.
  *Acceptance:* an OHCHR fixture produces civilian `casualty` rows and correct `daily_agg` cells.

---

## WS5 — Source adapters

- **T5.1 — OHCHR civilian adapter + backfill** (L) — deps: T4.3
  Adapter for OHCHR civilian casualty reports (killed/injured); map to `audience='civilian'`, per-side where reported; **backfill 2022-02-24 → present**; idempotent re-runs.
  *Acceptance:* historical civilian series present in `casualty`/`daily_agg`; spot-checked totals match a published OHCHR figure for a known date; re-run does not double-count.

- **T5.2 — RU confirmed-military adapter (Mediazona + BBC)** (L) — deps: T4.2, T2.1
  Named-dead source-of-record → `side='russia'`, `audience='military'`, `category='killed'`, `tier='confirmed'`; dedup by named individual; watermark + backfill.
  *Acceptance:* confirmed RU killed rows created at `tier='confirmed'`; named-individual dedup prevents duplicates across runs.

- **T5.3 — UA confirmed-military adapter** (L) — deps: T4.2, T2.1; **blocked on source decision (PRD §10 open question)**
  Choose + implement the UA equivalent (candidate: UALosses / official memorials). Same shape as T5.2 for `side='ua_coalition'`.
  *Acceptance:* confirmed UA killed rows created at the chosen tier; methodology page notes the source-coverage asymmetry vs RU (PRD §9).
  *Note:* if the source decision slips, M1 ships with OHCHR + RU and T5.3 tracks as the one carry-over — flag at M1 review.

---

## WS6 — Validation & docs

- **T6.1 — Methodology page content (data)** (S) — deps: T2.1, T5.1–T5.3
  Document tier definitions, per-side sources, the no-enemy-claims rule, and the coverage asymmetry (feeds PRD §6.4 / "Sources & Methodology").
  *Acceptance:* draft methodology doc reviewed; matches encoded `tiering.config.ts`.

- **T6.2 — M1 integration test** (M) — deps: all WS4/WS5
  End-to-end: run all adapters against recorded fixtures → assert `evidence`, `casualty`, `daily_agg`, and prefix sums are correct and stable across re-runs.
  *Acceptance:* CI job green; re-run idempotency proven; aggregate-vs-recount equality asserted.

- **T6.3 — Cost & ingestion dashboards (skeleton)** (S) — deps: T0.5, T4.2
  Emit metrics: items ingested/dropped per source, embedding cost, monthly spend vs cap.
  *Acceptance:* metrics visible; spend meter increments on embedding calls.

---

## Critical path & sequencing

```
T0.1→T0.2→T0.3→T1.1→T1.2 ─┬─ T1.3→T1.4→T2.2→T2.3
                          ├─ T1.5  T1.6  T1.7
T0.4→T3.1→T3.2 ───────────┘
T2.1 (parallel after T1.1)
T4.1→T4.2→T4.3 → T5.1 ; T5.2 ; T5.3(blocked: UA source)
→ T6.1, T6.2, T6.3
```

**Likely carry-over into M2/M3:** T5.3 (UA source decision), multilingual embedding choice (T3.1 note). Everything else should close inside M1.

## Open decisions to resolve during M1
- **UA confirmed-military source** (PRD §10) — blocks T5.3; decide by M1 mid-point.
- **Embedding model for UA/RU text** (EDD §14) — `voyage-3` default; revisit if recall on Cyrillic source text is poor.
- **Migration runner** (T0.3) — pick one and standardize before WS1 lands.

---

## After M1: next steps

**M1 is considered complete when:**
- All WS0–WS6 workstreams are merged to `main` with CI green.
- The end-to-end ingestion test (T6.2) passes: real adapters, real sources, real `daily_agg` + prefix sums.
- `tiering.config` + `apply_agg_delta` are locked and tested against the §A.5 worked example.
- The ROADMAP "Completed" column shows **M1: 100%** (or your tracking system equiv.).

**Immediately after M1:**
1. **Update ROADMAP.md**: M1 Completed → 100%, total Completed ticks up to 18%.
2. **Begin M2** (counter / View 1) — gate: M1 complete. Start with [tasks-m2.md](./tasks-m2.md), WS0 (the count-engine library).
3. **Resolve the UA source decision** (M1·T5.3 carry-over) — feed into M2 as needed; the counter can ship with OHCHR + RU if UA source is still pending.
4. **Validate embedding quality** on real Cyrillic/Ukrainian source text early in M2 (when ingestion is live); adjust model if recall is poor.

**Critical path forward (M2 → M7):**
- **M2** (14% weight) gates M3/M4 (both need `/api/counts` to be stable).
- **M3** (22% weight, highest risk) feeds M4 + M7 — start as soon as M2 endpoints are ready.
- **M4** (14% weight) can parallelize with M3 once M2 API is live.
- **M5** (8% weight) depends on M2; ideally M4 too for the full embedded experience.
- **M6** (14% weight) depends on M2/M3/M4 complete; store review is the long pole (~4–6 weeks).
- **M7** (10% weight) can start mid-M6; gate: M2–M6 all feature-complete.

**See also:**
- [tasks-m2.md](./tasks-m2.md) — Counter / View 1 (first public web surface).
- [tasks-m3.md](./tasks-m3.md) — AI corroboration (highest-risk; `writeOutcome` + worker resumability are long poles).
- [tasks-m4.md](./tasks-m4.md) — Map / View 2 (completes the web product).
- [tasks-m5.md](./tasks-m5.md) — Promotional website (marketing + live counter).
- [tasks-m6.md](./tasks-m6.md) — Apps & store submission (three new surfaces; store review is the constraint).
- [tasks-m7.md](./tasks-m7.md) — Polish & launch (NFRs consolidated; coordinated public launch).
- [ROADMAP.md](./ROADMAP.md) — 🟦 100% Defined · ⬜ 0% Completed · ⬜ 0% Deployed (source of truth for progress; update as milestones complete).
