# PeaceClock — Production Deploy Runbook

**PR:** M7·PR11 — Production deploy bootstrap  
**Scope:** Vercel (web) + Neon (Postgres) + scheduled crons  
**Theater:** Ukraine only (`theater=ukraine`) until M8

This runbook covers first-time production setup, database bootstrap, cron verification, and the post-deploy smoke checklist.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Vercel account | Team or personal; GitHub repo connected |
| Neon account | Postgres 15+ with **PostGIS** and **pgvector** |
| API keys | Anthropic (corroboration), Voyage (embeddings) |
| Map tiles (optional) | MapTiler key for production vector tiles |

Local tooling: Node ≥ 20, pnpm 9, repo cloned and `pnpm install` complete.

---

## 1. Neon database

### 1.1 Create project

1. Create a Neon project (e.g. `peaceclock-prod`).
2. Copy the **pooled** connection string (`?sslmode=require`). Use the pooler URL for Vercel serverless; use the direct URL for one-off migrations if Neon recommends it.
3. Store as `DATABASE_URL` — never commit to git.

### 1.2 Enable extensions

Neon supports PostGIS and pgvector on recent Postgres versions. The baseline migration (`packages/db/drizzle/0000_baseline.sql`) runs:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
```

If migration fails on extensions, enable them in the Neon SQL console first, then re-run migrate.

### 1.3 Smoke-query (optional)

After migrate (step 3), confirm extensions:

```sql
SELECT postgis_version();
SELECT '[1,2,3]'::vector;
```

---

## 2. Vercel project

### 2.1 Link repository

1. **Import** the GitHub repo in Vercel.
2. **Root Directory:** `apps/web` (monorepo — do not deploy from repo root).
3. **Framework Preset:** Next.js (auto-detected).
4. **Build Command:** `cd ../.. && pnpm install && pnpm --filter @peaceclock/api-types build && pnpm --filter @peaceclock/count-engine build && pnpm --filter @peaceclock/db build && pnpm --filter @peaceclock/web build`  
   Or set Vercel's default with **Install Command:** `cd ../.. && pnpm install` and **Build Command:** `pnpm --filter @peaceclock/web build` after workspace packages build in install hook.
5. **Output Directory:** `.next` (default for Next.js in `apps/web`).
6. **Node.js Version:** 20.x (matches `engines` in root `package.json`).

### 2.2 Domains

- **Production:** `peaceclock.org` (or staging subdomain first).
- **Preview:** Vercel preview URLs per PR — use for smoke tests before promoting.

### 2.3 Cron jobs (`apps/web/vercel.json`)

Crons are defined in `apps/web/vercel.json`:

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/corroborate` | `*/5 * * * *` (every 5 min) | AI corroboration worker (`runTick`) |
| `/api/cron/ingest` | `0 6 * * *` (daily 06:00 UTC) | OHCHR + RU confirmed adapters |

**Verify:** In Vercel → Project → Settings → Cron Jobs, both paths appear after deploy. Cron invocations require **Vercel Pro** (or equivalent plan with cron support).

Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled requests. Both routes enforce this in production (fail-closed when `CRON_SECRET` is unset).

---

## 3. Environment variables

Set in Vercel → Settings → Environment Variables for **Production** and **Preview** as appropriate.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon pooled Postgres URL |
| `ANTHROPIC_API_KEY` | Yes | Claude Batch API (corroboration worker) |
| `VOYAGE_API_KEY` | Yes | Embeddings on ingest |
| `CRON_SECRET` | Yes (prod) | Long random string; Vercel cron `Authorization` header |
| `AUDIT_SECRET` | Yes (prod) | Protects `/api/audit` mutations |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical URL, e.g. `https://peaceclock.org` |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Recommended | MapTiler style URL (see `.env.example`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional | OpenTelemetry collector |
| `NEXT_PUBLIC_APP_STORE_URL` | Optional | Omit until M6 — shows "coming soon" badges |
| `NEXT_PUBLIC_PLAY_STORE_URL` | Optional | Omit until M6 |
| `NEXT_PUBLIC_MAC_STORE_URL` | Optional | Omit until M6 |

Reference template: `.env.example` at repo root.

**Generate secrets:**

```bash
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # AUDIT_SECRET
```

**Local / CI:** Copy `.env.example` to `.env.local` in `apps/web` for `pnpm dev`. Never use production secrets locally.

---

## 4. Database migrations

From **repo root** with `DATABASE_URL` pointing at the target Neon database:

```bash
export DATABASE_URL="postgresql://..."
pnpm db:migrate
```

This runs `drizzle-kit migrate` against `packages/db/drizzle/` (baseline: `0000_baseline.sql`).

**When to re-run:** After any PR that adds migration files under `packages/db/drizzle/`. Run against preview DB first, then production.

**CI parity:** GitHub Actions applies test schema via `packages/db/src/__tests__/fixtures/setup-schema.sql`; production uses committed Drizzle migrations only.

---

## 5. Seed data (OHCHR + RU fixtures)

M1 ships **fixture-driven** adapters (`ohchr`, `ru-confirmed`). Initial production bootstrap loads fixture data through the real ingest pipeline (embed + agg deltas), not raw SQL.

From repo root:

```bash
export DATABASE_URL="postgresql://..."
export ANTHROPIC_API_KEY="sk-ant-..."
export VOYAGE_API_KEY="pa-..."
pnpm db:seed
```

What `db:seed` does:

1. Builds `@peaceclock/db`
2. Resets ingest watermarks to `2022-02-23` (day before Ukraine epoch)
3. Runs `runIngestion()` — OHCHR (`tier=official`, civilian) + RU confirmed (`tier=confirmed`, military)
4. UA adapter is **excluded** (PRD §10 source blocker)

**Idempotency:** Re-running is safe — duplicate evidence is dropped by content hash. Watermarks advance so the daily ingest cron only fetches new items.

**Alternative (manual cron):** After deploy, trigger ingest once:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/ingest"
```

Prefer `pnpm db:seed` before first deploy so `/api/counts` returns data immediately.

---

## 6. Deploy

1. Push to `main` (or merge PR) — Vercel builds and deploys `apps/web`.
2. Confirm build logs: workspace packages compile, `next build` succeeds.
3. Open Vercel → Deployments → latest **Ready** URL.

**Rollback:** Promote a previous successful deployment in Vercel; migrations are forward-only — do not drop prod tables without a planned migration.

---

## 7. Cron smoke test

After first production deploy and env vars are set:

### 7.1 Corroborate (every 5 min)

Manual trigger (same auth Vercel uses):

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/corroborate"
```

**Expect:** `200` + `{"ok":true,"ranAt":"..."}`  
**Fail closed:** `401` without header; `401` if `CRON_SECRET` unset in production.

Check Vercel → Logs → filter `[cron/corroborate]` for tick output.

### 7.2 Ingest (daily)

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/cron/ingest"
```

**Expect:** `200` + `{"ok":true,"adapters":[...]}` with OHCHR and RU-Confirmed adapter summaries.

### 7.3 Vercel dashboard

- Settings → Cron Jobs: both jobs listed, last run timestamps updating.
- Functions → `/api/cron/*`: no sustained 401/500 after deploy.

---

## 8. Post-deploy smoke test checklist

Run against **preview** first, then **production**. Record pass/fail and deployment URL.

### 8.1 Pages (HTTP 200, no blank shell)

| # | Check | URL / action | Pass |
|---|-------|--------------|------|
| 1 | Landing / counter | `GET /` | ☐ |
| 2 | Counter deep link | `GET /c/ukraine/2023-06-01` | ☐ |
| 3 | Map view | `GET /map` | ☐ |
| 4 | Map deep link | `GET /m/ukraine/2023-06-01` | ☐ |
| 5 | Legacy redirect | `GET /c/2023-06-01` → `/c/ukraine/2023-06-01` | ☐ |
| 6 | Methodology | `GET /methodology` | ☐ |
| 7 | Privacy | `GET /privacy` | ☐ |

### 8.2 APIs (JSON, seeded data)

| # | Check | URL / action | Pass |
|---|-------|--------------|------|
| 8 | Counts API | `GET /api/counts?theater=ukraine` — `series` non-empty after seed | ☐ |
| 9 | Counts date range | `GET /api/counts?theater=ukraine&asOf=2023-06-01&from=2022-02-24` | ☐ |
| 10 | Map API | `GET /api/map?theater=ukraine&asOf=2023-06-01` — GeoJSON `features` present or empty cluster set | ☐ |
| 11 | Sources API | `GET /api/sources?theater=ukraine` — returns source freshness | ☐ |
| 12 | OG image | `GET /api/og` — `image/png` 200 | ☐ |

### 8.3 Security & ops

| # | Check | URL / action | Pass |
|---|-------|--------------|------|
| 13 | Cron auth | `GET /api/cron/corroborate` without header → `401` | ☐ |
| 14 | Audit auth | `POST /api/audit` without header → `401` | ☐ |
| 15 | Robots | `GET /robots.txt` — disallows `/api/cron/` | ☐ |
| 16 | Sitemap | `GET /sitemap.xml` — valid XML, includes `/` | ☐ |

### 8.4 Crons (scheduled)

| # | Check | Action | Pass |
|---|-------|--------|------|
| 17 | Corroborate cron | Manual curl (§7.1) or wait 5 min; logs show tick | ☐ |
| 18 | Ingest cron | Manual curl (§7.2); adapters report `fetched` ≥ 0 | ☐ |

### 8.5 Data sanity (after seed)

| # | Check | SQL / API | Pass |
|---|-------|-----------|------|
| 19 | `daily_agg` rows | `SELECT count(*) FROM daily_agg WHERE theater = 'ukraine';` > 0 | ☐ |
| 20 | OHCHR official tier | Rows with `tier = 'official'` and `audience = 'civilian'` | ☐ |
| 21 | RU confirmed tier | Rows with `tier = 'confirmed'`, `side = 'russia'`, `audience = 'military'` | ☐ |
| 22 | Watermarks set | `SELECT * FROM ingest_watermark;` — OHCHR + RU-Confirmed entries | ☐ |

**Sign-off:** Deployment URL _______________ Date _______________ Operator _______________

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `next build` fails on Vercel | Missing stub env in CI | Ensure build does not call `validateEnv()` at layout; API routes validate at runtime |
| `/api/counts` empty `series` | Seed not run | `pnpm db:seed` or manual ingest cron |
| Cron `401` | `CRON_SECRET` mismatch | Align Vercel env with manual curl header |
| Cron `500` on corroborate | Missing `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` | Set all DB_REQUIRED vars |
| Migration extension error | Neon extension not enabled | Enable PostGIS + vector in Neon console |
| Map blank | No `NEXT_PUBLIC_MAP_STYLE_URL` | Add MapTiler key or accept OSM raster fallback in dev only |
| High Voyage spend on seed | Full fixture backfill embeds all items | Expected once; monitor `spend_meter` table |

---

## 10. Related docs

- [EXECUTE-PLAN.md](./EXECUTE-PLAN.md) — PR11 acceptance criteria
- [EDD.md](./EDD.md) §7 (ingest), §8 (corroboration), §14 (map tiles)
- [.env.example](../.env.example) — env template
- [apps/web/vercel.json](../apps/web/vercel.json) — cron definitions