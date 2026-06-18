# Claude Code Preferences

## Communication Style
- **Be spartan.** Say less. One sentence per update; short responses.
- No trailing summaries ("Here's what changed...").
- No multi-paragraph explanations; prefer code + brief rationale.
- No narration of what you're about to do; just do it.
- **Always end with "Next steps:" and list them.** User responds "ok" and I formalize it here.

## Execution
- Prefer tool calls over prose. Show, don't tell.
- Terse is better than thorough.
- Assume the user can read diffs and code.
- **Track progress in TDD:** test files, tsc checks, test runs. Include in context.

## When Blocked
- State the blocker clearly; ask once.
- No verbose debugging narratives.

## Workflow
1. I do work, end with next steps.
2. User says "ok".
3. I update this file to lock in the decision/workflow change.
4. Everything is trackable via test files and type checks.

## Progress Tracking

### M1 · Foundations — COMPLETE ✓
- **WS0** ✓ Infrastructure (repo, drizzle, env, otel, spend_meter)
- **WS1** ✓ Data model (8 tables, 11 enums)
- **WS2** ✓ Tier config (weights, thresholds, apply_agg_delta)
- **WS3** ✓ Embeddings (Voyage API client)
- **WS4** ✓ Ingestion framework (adapter iface, triage, ingestEvidence())
- **WS5** ✓ Source adapters (OHCHR, RU, UA stubs)
- **WS6** ✓ Validation (integration test, methodology page, metrics skeleton)

**M1 Completed: 18 commits, 6 workstreams, tsc ✓, E2E fixtures green.**

### M2 · Counter / View 1 — IN PROGRESS
- **WS0** ✓ Count engine (`packages/count-engine`) — 22 tests green, tsc ✓
  - T0.1 window math (24h/7d/30d/90d/1y/total, INVASION_START clamp)
  - T0.2 as-of semantics (event_date ≤ asOf)
  - T0.3 tier→threshold mapping (tiersAtOrAbove)
- **WS1** ✓ `/api/counts` endpoint — web/db/count-engine tsc ✓, 27 tests green
  - T1.1 reads `daily_agg` only (`queryDailyAgg`), no casualty scan
  - T1.2 typed `CountsResponse` (api-types) + pure `buildCountsResponse` (count-engine)
  - T1.3 Cache-Control s-maxage/SWR headers (edge invalidation-on-ingest deferred)
  - T1.4 per-side freshness (`querySideFreshness`, casualty→evidence join)
- **WS2** ✓ Source attribution API — web/db tsc ✓
  - T2.1 `/api/evidence/:id` (`queryEvidenceDetail`, 404 unknown, links only)
  - T2.2 `/api/sources` figure→sources resolver (`resolveCellSources`, window+threshold via engine)
- **WS3** ✓ View 1 Counter UI — `next build` green (6 routes), 32 engine tests
  - T3.1 RSC shell + SSR headline (`app/page.tsx`, `getCountsData`, force-dynamic)
  - T3.2 date controller + `/c/[date]` deep-link, URL sync via history.replaceState (no refetch)
  - T3.3 threshold slider (Official→…→AI, provisional badge), client recount
  - T3.4 count matrix (civilian primary / military secondary, category toggle) — `computeMatrix` in count-engine
  - T3.5 SourceCell (lazy `/api/sources`) + Freshness ("as of" + per-side last-updated)
- **WS4** ✓ World-map background — `next build` green, geo tests pass
  - T4.1 `MapBackdrop` (equirectangular, capped pins, auth badges → `/api/evidence/:id`), `/api/map-pins`, `queryMapPins` (no clustering — M4 boundary documented)
  - geo: `mercatorToLonLat`/`parsePoint3857` in count-engine (5 tests)
- **WS5** ✓ Quality / a11y / analytics — 37 engine tests, build green
  - T5.1 a11y: slider aria-valuetext, radiogroup category, table scopes/captions, sr-only `aria-live` count announcement
  - T5.2 responsive: mobile-first CSS, counter usable without backdrop
  - T5.3 analytics: `lib/analytics.ts` no-PII `track()` wired into all controls
  - T5.4 E2E: Playwright config + `e2e/counter.spec.ts` (load→scrub→threshold→category→source + deep-link restore); needs seeded DB + `playwright install` in CI (not run locally)

**M2 COMPLETE: count engine + /api/counts + attribution + Counter UI + map backdrop, tsc ✓, 37 tests, next build ✓.**

### M3 · AI Corroboration — CORE COMPLETE (loop: implement all PRD/roadmap tasks)
db tsc ✓, web `next build` ✓ (10 routes), 60 tests green (count-engine 39 + db scoring/gate 21).
- **WS0** ✓ `retrieveCandidates` (pgvector cosine top-K) + `findDedupTarget` (T0.1/T0.2)
- **WS1** ✓ `ASSESSMENT_SCHEMA` (T1.1), `computeTally` s/c/k (T1.4), Haiku Batch submit/poll/parse via `@anthropic-ai/sdk` beta batches + cached rubric prefix (T1.2/T1.3)
- **WS2** ✓ `applyThresholds` + `escalationTriggers` (T2.1/T2.2), §A.5 pinned
- **WS3** ✓ worker state machine `runTick`/`tickSubmit`/`tickProcess`/`tickOpus` (FOR UPDATE SKIP LOCKED claim, corro_batch resumability) + cron route `/api/cron/corroborate` + vercel.json
- **WS4** ✓ Opus gate `couldCrossHeadline` (T4.1) + Opus batch adjudication (T4.2)
- **WS5** ✓ `writeOutcome` (T5.1) + geo auto-pin (T5.2) + `changeTier` (T5.3)
- **WS6** ✓ budget gate `checkBudget`/`opusCapReached` (T6.1), per-item cost in batch parse (T6.2)
- **WS7** ✓ audit queue `queryAuditQueue`/`rejectCasualty`/`repositionCasualty` + `/api/audit` + `/audit` UI
- **WS8** ✓ `/api/evidence/:id` corroboration basis (`queryCorroborationBasis`)
- **WS9** ◑ §A.5 pure decision path tested; DB-backed E2E/idempotency/budget-degradation need live DB (CI)
- Note: PRD §A.5 had arithmetic typo (0.74→0.75, 0.71→0.715) — corrected in PRD + tests.
- Carry-overs (need live infra): pgvector ivfflat index, real Batch round-trip, transactional E2E, audit-accuracy metric (T7.4), pipeline metrics (T6.3).

### M4 · Map / View 2 — CORE COMPLETE (loop)
db tsc ✓, web `next build` ✓ (13 routes), count-engine 45 tests (incl. 6 map-cluster).
- **WS0** ✓ `/api/map` clustering — pure eps/zoomBand/gridCell in count-engine (T0.2/T0.3, tested); `queryMap` hybrid SQL (z<8 grid · 8–14 ST_ClusterDBSCAN · z>14 raw) per EDD §9.3; typed `MapResponse`/`MapFeature` in api-types (T0.4); edge cache headers (T0.5)
- **WS1** ✓ MapLibre GL JS `MapView` (deferred dynamic import — no SSR crash), cluster/pin layers, viewport-debounced refetch, cluster fitBounds, pin detail panel via `/api/evidence/:id` (T1.1–T1.5)
- **WS2** ✓ shared controls reused from M2, URL state `/m/:date`, Counter↔Map nav (T2.1/T2.2)
- **WS4** ◑ a11y roles + e2e/map.spec.ts (needs DB+tiles in CI)
- Carry-overs: tile provider choice (EDD §14; raster OSM fallback for dev), GiST index + p95 perf, list-view a11y fallback, web↔native parity (M6).

### Ship plan · EXECUTE-PLAN.md — LOCKED ✓
M1–M4 core built (~63%); M5–M7 not started. Full DAG in `docs/EXECUTE-PLAN.md` (17 PRs, PR1→PR17).
- **Baseline:** `e3b3ad2` — M2–M4 WIP committed to `main` (unblocks execute-plan worktrees).
- **Execute-plan PLAN_ID:** `41662179` — **17/17 merged to `main`** @ `c474179` (PR17 + PR6 worker-e2e). Worktrees retained under `/tmp/grok-exec-wt-41662179/`.
- **Scope:** Ukraine theater only; M8 post-launch (separate `/execute-plan` run → `tasks-m8.md`).
- **Level-0 parallel:** PR1 migrations, PR2 security/env, PR7 pin sprites.
- **P0 before ingest:** worker fixes (PR3), fail-closed cron/audit (PR2).
- **Run:** `/execute-plan docs/EXECUTE-PLAN.md --resume 41662179 --concurrency 4`.

### Deployment · LOCKED ✓
- **Testing (pre-launch):** **$0/mo** — local `pnpm dev` + GitHub Actions CI only; no hosted `test.peaceclock.org`, no `staging` branch, no Vercel Pro, no cloud crons, no `pnpm db:seed` on cloud DBs (use `db:setup:test` / `db:seed:test` SQL fixtures); optional Neon Free `dev` branch for local `.env.local`.
- **Production (go-live):** **≤$50/mo** — Vercel Pro ($20, required for `*/5` corroborate cron) + Neon Free `main` + domain; MapTiler Free/OSM until traffic warrants Flex; AI remainder **≤$29/mo** — set `BUDGET_CAP_USD=30`, `OPUS_DAILY_CAP_USD=10` at first prod deploy; monitor `spend_meter`.
- **Launch gate:** defer Vercel link/Pro until [LAUNCH-CHECKLIST.md](./docs/LAUNCH-CHECKLIST.md) go/no-go; then migrate + `db:seed` on Neon `main`, deploy `main`, smoke [deploy-runbook.md](./docs/deploy-runbook.md) §8.
- **Default view:** `/` = full-screen map (View 2); `/map` → `/`; counter at `/c/:theater/:date`.
- **Phases:** 0 ✓ local env · 1 ✓ `origin` push · 2 ✓ `pnpm smoke:local` · 3 ◑ Neon `main` migrated+seeded, `pnpm prod:bootstrap`, budget cap $30 — **blocked:** `vercel login` + real API keys + Pro upgrade.
- **Neon:** project `peaceclock` (`sweet-surf-34533741`), branches `dev` (local) + `main` (prod at launch); `apps/web/.env.local` wired to `dev`.
- **Local bootstrap:** `pnpm dev:bootstrap` → `pnpm --filter @peaceclock/web dev` (migrate + SQL seed, $0).
- **Remote:** https://github.com/deemo3425-ops/peaceclock (`origin/main` @ `cb96dfe`).
