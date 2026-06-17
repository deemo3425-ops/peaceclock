# PeaceClock — M8 (Multi-theater expansion) Task Breakdown

**Milestone:** M8 — Multi-theater expansion (PRD §6.8, §11.8; EDD §5.0, §9.1/§9.2)
**Depends on:** M1–M7 complete for Ukraine; theater column + config registry already in schema (M1·T1.0).
**Goal:** Enable additional war theaters without schema redesign — theater selector UI, per-theater ingestion, multi-theater map at world zoom, gated sub-releases per theater.

**Exit criteria for M8**
- `theater` pgEnum extended for the second theater; `theater.config.ts` entry `enabled: true` only after source-coverage sign-off.
- Counter + map theater selector switches entire context (counts, epoch, pins, methodology blurb).
- Deep links `/c/:theater/:date`, `/m/:theater/:date` work on web and in-app.
- `/api/counts`, `/api/map`, `/api/sources` reject unknown theater slugs; automated test proves zero cross-theater aggregate leakage.
- Map at world zoom (`theater=all`) shows multiple theaters with distinct halos; zoom-in applies single-theater filter.
- Per-theater audit queue and corroboration candidate retrieval remain theater-scoped.

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d.

---

## WS0 — Theater framework

- **T0.1 — Migration: extend `theater` enum** (S) — deps: M7
  Add second theater slug (e.g. `gaza`); backfill not needed for new slug.
  *Acceptance:* migration applies; existing Ukraine rows unchanged.

- **T0.2 — Theater config entry + methodology** (M) — deps: T0.1
  Add `TheaterConfig` for second theater: epoch, bounds, sides, labels, enabled flag. Methodology page section per theater (PRD §6.5).
  *Acceptance:* config reviewed; `enabled: false` until T0.4 sign-off.

- **T0.3 — Cross-theater isolation tests** (M) — deps: M1·T1.4
  Property tests: mixed `daily_agg` fixture → queries with `theater=T` never return other theaters' counts; candidate retrieval never crosses theaters.
  *Acceptance:* CI invariant suite green (PRD §8 "theater isolation").

---

## WS1 — Ingestion & pipeline per theater

- **T1.1 — Theater-scoped source adapters** (L) — deps: T0.2
  Register adapters per theater in config; ingestion sets `theater` on evidence; allowlists per theater.
  *Acceptance:* second theater ingests fixtures; Ukraine adapters unaffected.

- **T1.2 — Theater context in AI prompts** (S) — deps: M3 worker
  Haiku/Opus user content includes theater slug + geo bounds hint for side attribution.
  *Acceptance:* prompt carries theater; candidate SQL already filtered (M1·T1.0).

- **T1.3 — Per-theater audit queue** (S) — deps: M3·WS7
  `queryAuditQueue(theater?)` filters `casualty.theater`.
  *Acceptance:* audit UI shows one theater at a time.

---

## WS2 — APIs & count engine

- **T2.1 — Theater selector API surface** (S) — deps: T0.2
  `GET /api/theaters` → enabled theaters + display names + epochs (or embed in layout RSC).
  *Acceptance:* clients discover enabled theaters without hard-coding.

- **T2.2 — URL + deep-link generalization** (M) — deps: M2 routes
  Migrate `/c/[date]` → `/c/[theater]/[date]`; redirect old URLs to `ukraine`. Same for `/m/...`.
  *Acceptance:* deep links restore theater + date + threshold; legacy URLs redirect.

---

## WS3 — UI: theater selector + multi-theater map

- **T3.1 — Theater selector component** (M) — deps: T2.1, M2 Counter
  Tabs or dropdown in Counter + Map; switches fetch context; no cross-theater headline totals (PRD §3 non-goals).
  *Acceptance:* selector changes matrix, map pins, and URL together.

- **T3.2 — Multi-theater world map** (M) — deps: M4 MapView, T0.1
  `theater=all` at low zoom; theater halo on clusters (PRD §5.2); zoom-in snaps to theater bounds.
  *Acceptance:* world view shows ≥2 theaters when enabled; single-theater zoom filters correctly.

- **T3.3 — Per-theater pin palette** (M) — deps: M4·WS1 pin sprites (PRD §5.3)
  Side chroma + vignette per theater config; shared tier ring system.
  *Acceptance:* pins distinguishable per theater at world zoom; a11y dash patterns preserved.

---

## WS4 — Launch gate per theater

- **T4.1 — Source-coverage sign-off checklist** (S) — deps: T1.1
  Document minimum confirmed-source bar before `enabled: true` (PRD §6.8).
  *Acceptance:* checklist reviewed; second theater flip is a deliberate config change, not a deploy default.

- **T4.2 — Store content-rating update** (S) — deps: M6
  If sensitive-region rules differ, update App Store / Play content descriptors before enabling theater in production apps.
  *Acceptance:* store metadata updated or N/A documented.

---

## Critical path

```
T0.1 → T0.2 → T1.1 → T4.1 (sign-off) → enable theater
T0.3 (parallel, gates merge)
T2.1 → T3.1 (selector UI)
M4 pin sprites → T3.3
T2.2 (URL migration, parallel with T3.1)
```

**See also:** [PRD.md](./PRD.md) §4, §6.8, §5.3 · [EDD.md](./EDD.md) §5.0 · [ROADMAP.md](./ROADMAP.md)