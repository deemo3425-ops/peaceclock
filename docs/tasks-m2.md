# PeaceClock — M2 (Counter / View 1) Task Breakdown

**Milestone:** M2 — Counter / View 1 (PRD §11.2, §5.1; EDD §6, §9.1)
**Depends on:** M1 complete — `daily_agg` + prefix sums populated from real ingestion ([tasks.md](./tasks.md)).
**Goal:** Ship View 1: a date-controlled, threshold-sliderable counter showing per-side confirmed counts across windows (24h / 7d / 30d / 90d / 1y / total), civilian-primary and military-secondary, every figure linked to a source, over a lightweight world-map background. First public web surface.

**Exit criteria for M2**
- `/api/counts?asOf=D` returns the per-day tier series; all counts derive from `daily_agg` (no `casualty` scans).
- A platform-agnostic count-engine library computes any window × tier-threshold × as-of correctly (shared via `@peaceclock/api-types`/logic package for reuse by native clients in M6).
- View 1 renders the headline server-side (<2s FCP on 3G), then hydrates a **date controller** (default today) and an **authentication-threshold slider** (Official→Confirmed→OSINT→AI-corroborated) that recompute **client-side with no extra fetch**.
- Every count cell links to ≥1 source; "as of <date>" + last-updated shown.
- WCAG 2.1 AA on the counter; mobile-first; privacy-respecting analytics.
- E2E green: load → scrub date → move threshold → open a source.

> **Data note:** the `ai_corroborated` tier has **no rows until M3** (the corroboration pipeline ships in M3). In M2 the slider supports all four positions, but the AI-corroborated stop yields the same totals as OSINT until M3 produces such rows. Build the control now; the data lights up later.

> **Scope boundary:** the **full interactive/clustered map is M4**. M2 ships only a *lightweight, non-interactive* world backdrop with a capped set of linked pins (WS4). Do not build `ST_ClusterDBSCAN` here.

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d. Each task lists **deps** and **acceptance**.

---

## WS0 — Count engine (shared, platform-agnostic) — EDD §6

- **T0.1 — Window math library** (M) — deps: M1·T1.4, M1·T2.2
  Pure TS in the shared logic package: `count(series, asOf D, window W, threshold T) → number`. Windows 24h/7d/30d/90d/1y/total relative to D; window sums via prefix sums; tier-threshold = sum over tiers ≥ T.
  *Acceptance:* unit tests cover edges — `total = prefix[D]`; window start clamped to `INVASION_START` (2022-02-24); 24h = single day; date-boundary/timezone handling fixed to UTC day; empty range → 0.

- **T0.2 — As-of semantics** (S) — deps: T0.1
  Enforce `event_date ≤ D` inclusion; document the `event_date` axis choice (EDD §6) and clamp behavior in the module header.
  *Acceptance:* casualty with `event_date > D` excluded, `= D` included; tests pinned.

- **T0.3 — Tier→threshold mapping** (S) — deps: M1·T2.1
  Slider position → tier set (≥ T) using the tier rank from M1. Default = Official+Confirmed (PRD §5.1).
  *Acceptance:* slider at OSINT → {Official,Confirmed,OSINT}; default position resolves to {Official,Confirmed}; AI-corroborated stop includes all four.

---

## WS1 — `/api/counts` — EDD §9.1

- **T1.1 — Endpoint + query** (M) — deps: T0.1, M1·T1.4
  `/api/counts?asOf=D&from=...&to=...` returns per-day series keyed by `(side, category, audience, tier)` over the visible range, plus prefix totals for `total`. Reads `daily_agg` + prefix sums only.
  *Acceptance:* output matches the engine on fixtures; `EXPLAIN` shows index use, **no seq scan on `casualty`**.

- **T1.2 — Typed payload in `@peaceclock/api-types`** (S) — deps: T1.1
  Define the response type once (shared web + future native, EDD §9.4); keep payload small — per-day series, not pre-expanded per-window.
  *Acceptance:* type exported + consumed by client; payload for a 2-year range within size budget (documented).

- **T1.3 — Edge caching** (S) — deps: T1.1
  Immutable past-day aggregates cached at the edge; trailing day revalidated on new ingest (EDD §6/§10). Cache key = `(asOf-day, from, to)`.
  *Acceptance:* repeat request served from cache; ingest into the trailing day invalidates only that key.

- **T1.4 — Last-updated / freshness** (S) — deps: T1.1
  Return `last_updated` (newest evidence timestamp, per side) for the "as of" / freshness display (PRD §6.1, §8).
  *Acceptance:* `last_updated` matches latest ingested evidence; per-side breakdown present.

---

## WS2 — Source attribution API — PRD §6.3

- **T2.1 — `/api/evidence/:id`** (S) — deps: M1·T1.2
  Returns source/news/X link, tier, side, audience, date, attribution. (AI-corroboration detail — corroborating posts, match score — is M3.)
  *Acceptance:* returns detail for a known id; 404 on unknown; no graphic media embedded (links only, PRD §9).

- **T2.2 — Figure → sources resolver** (M) — deps: T1.1, T2.1
  Each count cell resolves to ≥1 backing source (PRD §6.3 "every displayed number links to its source"); for an aggregate cell, a filtered sources list for that `(side, category, audience, window, threshold, asOf)`.
  *Acceptance:* every headline cell yields a non-empty source list; links resolve via T2.1.

---

## WS3 — View 1 Counter UI (web) — PRD §5.1

- **T3.1 — RSC shell + server-rendered headline** (M) — deps: T1.1, T0.1
  Server-render the default view (threshold = Official+Confirmed, date = today, per-side killed across windows) for fast first paint (PRD §7).
  *Acceptance:* SSR HTML contains the headline numbers with JS disabled; Lighthouse **FCP < 2s** on throttled 3G.

- **T3.2 — Date controller** (M) — deps: T3.1, T0.1
  Date scrubber/picker defaulting to today; writes URL state (`/c/:date...`, deep-linkable per PRD §5.3); recomputes all cells **client-side** from the fetched series.
  *Acceptance:* changing date updates every cell with **no extra fetch** within the loaded range; URL reflects state; refresh restores it.

- **T3.3 — Authentication-threshold slider** (M) — deps: T3.1, T0.3
  Slider Official→Confirmed→OSINT→AI-corroborated; live client-side recount; default strict; AI-corroborated visually distinct and labeled provisional.
  *Acceptance:* moving the slider updates the headline **instantly, no network**; default = Official+Confirmed; AI-corroborated stop styled distinctly (and yields OSINT-equal totals until M3 — documented).

- **T3.4 — Count matrix** (M) — deps: T3.1
  Per side (Ukraine coalition, Russia) × windows (24h/7d/30d/90d/1y/total). **Civilian primary**; **military secondary**, clearly labeled lower-coverage (PRD §3, §5.1). Category toggle (killed / wounded / missing-POW), killed default.
  *Acceptance:* matrix matches engine output; civilian/military visually separated; military labeled lower-coverage; category toggle works (wounded/missing may be empty pending source coverage).

- **T3.5 — Attribution + freshness display** (S) — deps: T2.2, T1.4, T3.4
  Each cell links to its source(s); show "as of <date>" and `last_updated`; tier/uncertainty indicated per PRD §5.1/§9 (no false precision).
  *Acceptance:* every cell links to a source; "as of" + last-updated render; counts framed as a lower bound (copy reviewed).

---

## WS4 — World-map background (lightweight) — PRD §5.1

- **T4.1 — Backdrop + linked pins** (M) — deps: T2.1
  A lightweight, **non-interactive** world backdrop behind the counter showing a **capped** set of recent geolocated evidence pins, each with an authentication-level badge, linking to `/api/evidence/:id`. Heavy clustering and full interactivity are **M4**.
  *Acceptance:* pins render with auth badges and resolve to source detail; no clustering code; perf budget respected; the M2↔M4 boundary documented in code.

---

## WS5 — Quality, accessibility, analytics

- **T5.1 — Accessibility (WCAG 2.1 AA)** (M) — deps: T3.2, T3.3, T3.4
  Slider + date control keyboard-operable; ARIA labels; SR-friendly count announcements; contrast; text equivalents for pins (PRD §6.6).
  *Acceptance:* automated axe pass + manual keyboard/VoiceOver run on the counter; slider announces tier + resulting count.

- **T5.2 — Responsive / low-bandwidth** (S) — deps: T3.1
  Mobile-first layout; counter usable before the backdrop fully loads; graceful degradation (PRD §7).
  *Acceptance:* verified at mobile/tablet/desktop; counter interactive without the map backdrop loaded.

- **T5.3 — Privacy-respecting analytics** (S) — deps: T3.2, T3.3
  Aggregate events (page view, date scrub, threshold move) with no PII (PRD §7).
  *Acceptance:* events fire; no PII captured; data flow documented.

- **T5.4 — M2 E2E test** (M) — deps: all WS3, T2.2
  Playwright: load → scrub date → move threshold → toggle category → open a source. Cross-check displayed numbers against the WS0 engine library.
  *Acceptance:* E2E green in CI; displayed numbers equal engine output for the test fixtures.

---

## Critical path & sequencing

```
M1 done ─┬─ T0.1→T0.2 ; T0.3
         ├─ T1.1→T1.2 ; T1.3 ; T1.4
         └─ T2.1→T2.2
T0.1 + T1.1 → T3.1 → T3.2 ; T3.3 ; T3.4 → T3.5
T2.1 → T4.1
T3.* → T5.1, T5.2, T5.3, T5.4
```

**Long pole:** the WS0 engine + `/api/counts` (T0.1, T1.1) gate the entire UI — land them first and lock their tests, since every cell, the slider, and the scrubber read from them.

## Open decisions / carry-overs
- **Wounded / Missing-POW data** — the category toggle (T3.4) ships, but those series may be empty until source coverage lands (PRD §10, M1 carry-over). Confirm whether to hide empty categories or show "no confirmed data".
- **M2↔M4 map boundary** — T4.1 backdrop is intentionally minimal; confirm the visual it presents (static world image vs. a basic tile map) so it doesn't pre-empt M4 design.
- **AI-corroborated slider stop** — present but data-less until M3; confirm copy ("provisional — populated once AI corroboration ships").
