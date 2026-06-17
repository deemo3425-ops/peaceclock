# PeaceClock — Ship Plan (Execute-Plan Design Doc)

**Status:** Ready for `/execute-plan`
**Sources:** [PRD.md](./PRD.md) · [EDD.md](./EDD.md) · [ROADMAP.md](./ROADMAP.md) · [tasks.md](./tasks.md) · [tasks-m2.md](./tasks-m2.md) · [tasks-m3.md](./tasks-m3.md) · [tasks-m4.md](./tasks-m4.md) · [tasks-m5.md](./tasks-m5.md) · [tasks-m6.md](./tasks-m6.md) · [tasks-m7.md](./tasks-m7.md) · codebase audit (2026-06-16)
**Scope:** M1–M7 ship path (Ukraine theater). M8 (multi-theater UI + second theater) is a **post-launch** stack — not in this DAG.

---

## Executive Summary

M1–M4 core is **built and unit-tested** (~63% completed per ROADMAP). Remaining work is: committed migrations, worker/security hardening, CI + live-infra E2E, real ingestion, PRD §5.3 pin sprites, production deploy, M5 promo polish, M6 native apps, M7 launch. Seventeen PRs in a DAG; max parallelism 3 at level 0.

---

## Current State

| Area | Status | Gap |
|------|--------|-----|
| M1 Foundations | Built | No committed SQL migrations; adapters stubbed (`ohchr.ts`, `ru-confirmed.ts` throw; `ua-confirmed.ts` blocked); `ingestEvidence` official short-circuit TODO |
| M2 Counter | Built | `next build` fails without env vars (`validateEnv` in layout); E2E needs seeded DB in CI |
| M3 Corroboration | Core built | Worker edge-case bugs (see audit); fail-open cron/audit auth; live Batch/DB E2E missing |
| M4 Map | Core built | Circle pins (not PRD §5.3 sprites); tile provider unset; GiST index not in repo; map list a11y fallback missing |
| M5 Promo site | Partial | Routes exist (`/`, `/about`, `/methodology`, `/privacy`); `/api/og` missing; store badges stubbed |
| M6 Apps | Not started | No `apps/mobile` |
| M7 Polish | Not started | No `.github/workflows/ci.yml`; no prod deploy |
| Theater dimension | Schema in code | `theater` columns on fact tables; migration + URL prefix + selector UI deferred |

**Tests (2026-06-16):** count-engine 45 ✓ · db unit 21 ✓ · db integration 3 ✗ (no `DATABASE_URL`) · tsc ✓ (after `api-types` build) · `next build` ✗ (env in layout)

### Built Inventory (code)

| Package / surface | Key artifacts |
|-------------------|---------------|
| `packages/count-engine` | Window math, matrix, map clustering (45 tests) |
| `packages/db` | Schema + theater config, ingestion, corroboration worker, map/count queries, audit |
| `packages/api-types` | `CountsResponse`, `MapResponse`, `Theater` enum |
| `apps/web` | 13 routes: counter `/c/[date]`, map `/m/[date]`, APIs, audit UI, marketing pages |
| `apps/web/components` | Counter, MapView, MapBackdrop, ThresholdSlider, SourceCell, AuditQueue, StoreBadges |

### Code Audit → PR Mapping

| Finding | Location | PR |
|---------|----------|-----|
| `validateEnv()` in root layout breaks `next build` | `apps/web/app/layout.tsx` | PR2 |
| Cron auth fail-open when `CRON_SECRET` unset | `apps/web/app/api/cron/corroborate/route.ts` | PR2 |
| Audit auth fail-open when `AUDIT_SECRET` unset | `apps/web/app/api/audit/route.ts` | PR2 |
| `String(error)` leaked on 500 | cron route | PR2 |
| Evidence without embedding stuck in `scoring` | `worker.ts` L100–107 | PR3 |
| Claimed rows not reset when batch empty | `worker.ts` L107 | PR3 |
| Dedup calls `retrieveCandidates(id, [])` | `worker.ts` L144–146 | PR3 |
| Duplicate Opus batch submission possible | `worker.ts` `tickOpus` | PR3 |
| No drizzle migration SQL committed | `packages/db/` (no `drizzle/`) | PR1 |
| Adapters throw `not implemented` | `adapters/ohchr.ts`, `ru-confirmed.ts` | PR5 |
| Official ingest short-circuit TODO | `ingestion.ts` L125 | PR5 |
| OG meta references missing `/api/og` | `apps/web/app/page.tsx` | PR9 |
| Circle layers, not sprite atlas | `MapView.tsx`, `MapBackdrop.tsx` | PR7 |
| Legacy URLs `/c/[date]` not theater-prefixed | `apps/web/app/c/`, `m/` | PR10 |
| No CI workflow | `.github/workflows/` absent | PR4 |

---

## Architecture

```
Sources → ingest(theater) → evidence → corroboration worker → casualty + daily_agg + map_point
                                              ↓
                         Next.js APIs (/counts, /map, /evidence, /sources, /audit)
                                              ↓
                    Web Counter + Map (+ future Expo clients, M6)
```

**Launch constraint:** Ukraine-only (`theater=ukraine`). APIs accept `?theater=`; UI hardcodes Ukraine until M8 selector.

---

## Milestone → PR Coverage

| Milestone | PRs | Notes |
|-----------|-----|-------|
| M1 carry-over | PR1, PR5 | Migrations + real adapters + official short-circuit |
| M2 carry-over | PR4, PR10 | CI E2E + theater URL prefix |
| M3 carry-over | PR2, PR3, PR6 | Security + worker fixes + live-infra E2E |
| M4 carry-over | PR7, PR8, PR16 | Sprites + tiles/perf + map a11y |
| M5 | PR9 | OG image, content polish, SEO |
| M6 | PR12–PR15 | Expo scaffold → counter → map → stores |
| M7 | PR11, PR16, PR17 | Deploy + a11y/perf + observability/launch |
| M8 | — | Separate run → [tasks-m8.md](./tasks-m8.md) |

---

## Key Decisions

1. **Ship Ukraine first** — theater plumbing in schema/API now; selector + second theater wait for M8 after public launch.
2. **Fix worker + security before live ingest** — stuck `scoring` rows, duplicate Opus submits, and fail-open cron/audit are P0.
3. **Migrations before prod** — drizzle-kit migrations committed; Neon gets `theater` columns + GiST + ivfflat.
4. **Split env validation from layout** — `validateEnv()` must not break `next build`; validate at runtime in data routes only.
5. **Pin sprites in M4 carry-over PR** — replace MapLibre circle layers with SDF sprite atlas per PRD §5.3 before calling map "shipped".
6. **Web deploys before app stores** — Vercel + Neon live after M5; M6 store review is the long pole (4–6 weeks).
7. **CI gates merge** — `tsc`, unit tests, integration (ephemeral Postgres), Playwright (seeded fixture) required on `main`.

---

## PR Plan

### PR 1: Database migrations — theater, GiST, ivfflat

- **Description:** Add drizzle-kit migration SQL for current schema: `theater` enum/columns on `evidence`, `casualty`, `daily_agg`, `map_point`; `unique(theater, content_hash)`; `daily_agg` PK includes `theater`; GiST on `map_point.geom_3857`; ivfflat on `evidence.embedding`. Add `pnpm db:migrate` / `db:generate` scripts. Baseline migration from `packages/db/schema/index.ts`.
- **Files/components affected:** `packages/db/schema/index.ts`, `packages/db/drizzle/`, `drizzle.config.ts`, `packages/db/package.json`, root `package.json`
- **Dependencies:** None
- **Tasks:** M1·T0.3, T1.0–T1.6
- **Acceptance:** `pnpm db:migrate` applies on ephemeral Postgres; GiST + ivfflat indexes present; cross-theater hash collision allowed, same-theater rejected

### PR 2: Security & env hardening

- **Description:** Fail-closed cron (`CRON_SECRET` required in prod); fail-closed audit (`AUDIT_SECRET`); move `validateEnv()` out of `app/layout.tsx` into API routes / server data loaders that need DB keys; stub env for `next build` in CI; add `.env.example` entries; generic 500 messages (no `String(error)` to clients).
- **Files/components affected:** `apps/web/app/layout.tsx`, `apps/web/lib/env.ts`, `apps/web/app/api/cron/corroborate/route.ts`, `apps/web/app/api/audit/route.ts`, `.env.example`
- **Dependencies:** None
- **Tasks:** M1·T0.4, M7·T4.1 (partial)
- **Acceptance:** `next build` passes without live secrets; cron/audit return 401 when secret set and header missing; prod without secrets fails at route invocation not layout

### PR 3: Worker reliability fixes

- **Description:** Fix evidence-without-embedding stuck in `scoring` (degrade to `unverified`); reset claimed rows when batch empty; prevent duplicate Opus batch submission (mark `opus_pending` or exclude IDs in active opus `corro_batch`); fix `tickProcess` dedup by re-fetching evidence embedding before `retrieveCandidates`; parse `theater` from evidence row in `facetsFromRaw`; add `UNIQUE(casualty_id, evidence_id)` on `casualty_evidence`.
- **Files/components affected:** `packages/db/src/corroboration/worker.ts`, `packages/db/schema/index.ts`, `packages/db/src/__tests__/worker-gate.test.ts`
- **Dependencies:** PR 1
- **Tasks:** M3·WS3, WS4
- **Acceptance:** unit tests cover null-embedding degrade, empty-batch reset, dedup with real embedding; no duplicate opus batches in fixture scenario

### PR 4: CI pipeline

- **Description:** GitHub Actions: `pnpm install` → build `api-types` → `pnpm -r exec tsc --noEmit` → unit tests (count-engine + db) → integration tests with service Postgres + `DATABASE_URL` → `next build` with stub env → Playwright `counter.spec.ts` + `map.spec.ts` against dev server + seeded fixture.
- **Files/components affected:** `.github/workflows/ci.yml`, `packages/db/src/__tests__/integration.test.ts`, `apps/web/e2e/`, `apps/web/playwright.config.ts`, `packages/db/src/__tests__/fixtures/` (seed script)
- **Dependencies:** PR 2
- **Tasks:** M1·T0.1, M2·T5.4, M4·WS4, M5·T2.3
- **Acceptance:** CI green on clean checkout; integration tests pass with ephemeral DB

### PR 5: Ingestion completion & source adapters

- **Description:** Complete `ingestEvidence` official short-circuit (`tier=official` casualty + agg delta); implement OHCHR civilian adapter (fixture-driven + watermark); implement RU adapter (Mediazona/BBC fixture-driven); cron ingest route; watermark store. UA adapter remains stub with documented blocker unless source decision lands.
- **Files/components affected:** `packages/db/src/ingestion.ts`, `packages/db/src/adapters/ohchr.ts`, `packages/db/src/adapters/ru-confirmed.ts`, `packages/db/src/adapters/index.ts`, `apps/web/app/api/cron/ingest/route.ts`, `apps/web/vercel.json`
- **Dependencies:** PR 1, PR 3
- **Tasks:** M1·WS4–WS5, M1·T4.3
- **Acceptance:** fixture ingest produces `official` OHCHR rows + `confirmed` RU rows; `daily_agg` updates via `apply_agg_delta`; ingest cron wired in vercel.json

### PR 6: Corroboration live-infra E2E

- **Description:** DB-backed tests: worker idempotency (re-delivered batch no-op), budget cap degradation (items → `unverified`, no Haiku call), `writeOutcome` transactional integrity, Opus gate respects daily cap. Mock Anthropic Batch in unit layer; one integration test with recorded fixture responses. Wire `recordModelCost()` in `cost.ts`.
- **Files/components affected:** `packages/db/src/__tests__/worker-e2e.test.ts`, `packages/db/src/__tests__/fixtures/batch-results.json`, `packages/db/src/corroboration/batch.ts`, `packages/db/src/cost.ts`
- **Dependencies:** PR 3, PR 4
- **Tasks:** M3·WS9, T6.2–T6.3, T7.4
- **Acceptance:** integration suite green with live Postgres; idempotency + budget tests pass

### PR 7: Map pin sprite system (PRD §5.3)

- **Description:** Design + implement MapLibre SDF sprite atlas per PRD §5.3: tier rings (gold/white/cyan/amber dashed), side chroma (Ukraine palette), provisional badge, cluster density disc, geo-confidence halo. Replace circle layers in `MapView` and `MapBackdrop`. `prefers-reduced-motion` static fallback. Export spec for M6 native reuse.
- **Files/components affected:** `apps/web/components/MapView.tsx`, `apps/web/components/MapBackdrop.tsx`, `apps/web/public/sprites/`, `apps/web/app/globals.css`
- **Dependencies:** None
- **Tasks:** M4·T1.2 (visual), PRD §5.3
- **Acceptance:** pins render as sprites not circles; tier/side distinguishable without color alone; reduced-motion disables animations

### PR 8: Map tile provider & query perf

- **Description:** Configure `NEXT_PUBLIC_MAP_STYLE_URL` (MapTiler prod; OSM raster dev fallback documented); verify `map_point` GiST from PR1; load-test `/api/map` p95; verify bbox snap to tile grid for cache keys.
- **Files/components affected:** `apps/web/components/MapView.tsx`, `apps/web/lib/map.ts`, `packages/db/src/map-query.ts`, `.env.example`
- **Dependencies:** PR 1, PR 7
- **Tasks:** M4·WS3, EDD §14
- **Acceptance:** map loads with configured tiles; `/api/map` p95 within EDD budget at fixture density

### PR 9: Promotional site & SEO (M5)

- **Description:** Polish landing (`app/page.tsx`), shared `SiteFooter`/nav, methodology synced to `tiering.config`, about/funding content, privacy policy. Add `/api/og` dynamic OG image with live counter snapshot. Wire `robots.ts`/`sitemap.ts`. Store badges "coming soon" until M6. Fix stale ThresholdSlider M3 copy if present.
- **Files/components affected:** `apps/web/app/page.tsx`, `apps/web/app/about/page.tsx`, `apps/web/app/methodology/page.tsx`, `apps/web/app/privacy/page.tsx`, `apps/web/components/SiteFooter.tsx`, `apps/web/components/StoreBadges.tsx`, `apps/web/components/ThresholdSlider.tsx`, `apps/web/app/api/og/route.tsx`, `apps/web/app/sitemap.ts`
- **Dependencies:** PR 2
- **Tasks:** M5·WS0–WS1
- **Acceptance:** OG/Twitter preview shows live counts; sitemap valid; methodology matches `tiering.config`; Lighthouse SEO ≥ 95

### PR 10: Deep links & URL theater prefix

- **Description:** Migrate routes `/c/[date]` → `/c/ukraine/[date]`, `/m/[date]` → `/m/ukraine/[date]` with redirects from legacy paths. Thread `theater` through `Counter` URL sync and `MapApp` shared state. Hardcode Ukraine in shell (no selector yet).
- **Files/components affected:** `apps/web/app/c/`, `apps/web/app/m/`, `apps/web/components/Counter.tsx`, `apps/web/components/MapApp.tsx`, `apps/web/middleware.ts`
- **Dependencies:** PR 9
- **Tasks:** M2·T3.2 (theater segment), M8·T0.4 (partial — URLs only)
- **Acceptance:** `/c/ukraine/2024-01-01` deep-links restore state; legacy `/c/2024-01-01` redirects

### PR 11: Production deploy bootstrap

- **Description:** Vercel project link, Neon prod DB, env vars (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `CRON_SECRET`, `AUDIT_SECRET`), run migrations, seed OHCHR/RU fixtures, enable crons. Smoke test `/`, `/map`, `/api/counts?theater=ukraine`.
- **Files/components affected:** `apps/web/vercel.json`, `docs/deploy-runbook.md`, root `package.json` scripts (`db:migrate`, `db:seed`)
- **Dependencies:** PR 4, PR 5, PR 9, PR 10
- **Tasks:** M7·T6.1 (partial)
- **Acceptance:** preview + prod deployments healthy; crons fire; counts API returns seeded data

### PR 12: Expo app scaffold (M6·WS0)

- **Description:** `apps/mobile` Expo project; consume `@peaceclock/api-types` + `@peaceclock/count-engine`; `app.config.ts` bundle IDs; shared theme tokens from web CSS variables.
- **Files/components affected:** `apps/mobile/`, `pnpm-workspace.yaml`, root `package.json`, `packages/api-types/`, `packages/count-engine/`
- **Dependencies:** PR 11
- **Tasks:** M6·WS0
- **Acceptance:** `expo start` runs; shared packages resolve; theme tokens documented

### PR 13: Native counter view (M6·WS1)

- **Description:** RN Counter: date scrubber, threshold slider, matrix, SourceCell pattern, deep links (`peaceclock://c/ukraine/:date`). Reuse count-engine — no duplicated window math.
- **Files/components affected:** `apps/mobile/src/screens/CounterScreen.tsx`, `apps/mobile/src/navigation/`, `apps/mobile/src/api/`
- **Dependencies:** PR 12
- **Tasks:** M6·WS1
- **Acceptance:** counter parity with web controls; deep link opens correct date/theater

### PR 14: Native map view (M6·WS2)

- **Description:** MapLibre Native map consuming `/api/map`; cluster/pin layers using shared sprite atlas from PR 7; pin detail panel via `/api/evidence/:id`.
- **Files/components affected:** `apps/mobile/src/screens/MapScreen.tsx`, `apps/mobile/package.json`
- **Dependencies:** PR 7, PR 13
- **Tasks:** M6·WS2
- **Acceptance:** map clusters + pin detail work; sprites match web tier/side encoding

### PR 15: EAS build & store submission (M6·WS3–5)

- **Description:** EAS Build profiles (ios, android); iPad-on-Mac path for Mac App Store; privacy nutrition labels / Data Safety forms; content rating; TestFlight + Play internal testing; submit.
- **Files/components affected:** `apps/mobile/eas.json`, `apps/mobile/app.config.ts`, store metadata assets
- **Dependencies:** PR 14
- **Tasks:** M6·WS3–WS5
- **Acceptance:** builds succeed on EAS; internal testing tracks live; submission packages ready

### PR 16: Accessibility & performance audit (M7·WS0–1)

- **Description:** WCAG 2.1 AA pass on counter, map (incl. keyboard list fallback), marketing pages; Lighthouse FCP < 2s on 3G; map p95 within budget; remediate findings. Add `e2e/a11y.spec.ts`.
- **Files/components affected:** `apps/web/components/`, `apps/web/app/globals.css`, `apps/web/e2e/a11y.spec.ts`
- **Dependencies:** PR 8, PR 9, PR 11
- **Tasks:** M7·WS0–WS1, M4·T4.2 (list fallback)
- **Acceptance:** axe pass on key pages; Lighthouse perf ≥ 90; map keyboard-navigable via list fallback

### PR 17: Observability, offline & launch (M7·WS2–6)

- **Description:** Last-known-good banners (web + native); OTel dashboards for ingest/corroboration/budget; uptime SLO; audit backlog metric; coordinated launch checklist; update `ROADMAP.md` deployed column.
- **Files/components affected:** `apps/web/lib/otel.ts`, `packages/db/src/metrics.ts`, `apps/mobile/src/offline/`, `docs/ROADMAP.md`
- **Dependencies:** PR 11, PR 15, PR 16
- **Tasks:** M7·WS2–WS6
- **Acceptance:** outage simulation shows last-known-good banner; ops dashboard has PRD §8 metrics; launch checklist signed off

---

## Execution Order (linearized stack)

```
PR1 → PR2 → PR3 → PR4 → PR5 → PR6 → PR7 → PR8 → PR9 → PR10 → PR11 → PR12 → PR13 → PR14 → PR15 → PR16 → PR17
```

**Max parallelism (by level):**

| Level | PRs | Notes |
|-------|-----|-------|
| 0 | PR1, PR2, PR7 | migrations, security, sprites — independent |
| 1 | PR3, PR4, PR8 | worker, CI, map perf |
| 2 | PR5, PR6 | ingest, corro E2E |
| 3 | PR9, PR10 | promo, URLs |
| 4 | PR11 | deploy |
| 5 | PR12 | Expo scaffold |
| 6 | PR13 | native counter |
| 7 | PR14 | native map |
| 8 | PR15 | stores |
| 9 | PR16, PR17 | polish + launch |

---

## Post-Launch Stack (M8 — separate `/execute-plan` run)

Not in this DAG. See [tasks-m8.md](./tasks-m8.md):

- Theater selector UI (PRD §5.1)
- Second `theater` enum value + config entry
- Per-theater adapters + methodology sections
- Multi-theater world map (`theater=all` at low zoom)
- Cross-theater isolation test suite

Suggested M8 PR stack (future doc): enum migration → config → selector UI → second theater ingest → world map → isolation tests.

---

## Verification Gates (every PR)

```bash
pnpm --filter @peaceclock/api-types build && pnpm -r exec tsc --noEmit
pnpm --filter @peaceclock/count-engine test
pnpm --filter @peaceclock/db test          # integration when PR4 lands
```

- No new `any` in hot paths without justification
- `next build` must pass after PR2

---

## How to Run

```bash
# Dry-run (parse DAG, show stack order)
/execute-plan docs/EXECUTE-PLAN.md --dry-run

# Execute full stack (concurrency 4)
/execute-plan docs/EXECUTE-PLAN.md --concurrency 4

# With cross-cutting instructions
/execute-plan docs/EXECUTE-PLAN.md --instructions "Ukraine theater only; no M8 scope; tsc + tests required per PR"
```

---

## Open Blockers (human decisions)

| Blocker | Blocks | Default if unresolved |
|---------|--------|----------------------|
| UA confirmed-military source (PRD §10) | PR5 UA adapter | Ship OHCHR + RU only; document asymmetry |
| Map tile provider (EDD §14) | PR8 | OSM raster dev; MapTiler prod |
| Audit staffing cadence | PR17 metric targets | Dashboard only; no SLA |
| Store copy / funding disclosure | PR9, PR15 | Placeholder reviewed by owner |
| Branding / New Florence sprite assets | PR7 | Engineer-generated SDF from spec; designer review before launch |