# PeaceClock — M4 (Map / View 2) Task Breakdown

**Milestone:** M4 — Map / View 2 (PRD §5.2; EDD §9.2, §9.3, §9.4)
**Depends on:** M1 (`map_point`, PostGIS), M3 (pipeline populates `map_point`; corroboration detail in `/api/evidence`, M3·WS8), M2 (shared date/threshold/side/category state; replaces the M2 lightweight backdrop).
**Goal:** Ship View 2: a full-screen, zoomable/pannable world map of geolocated confirmed evidence, server-clustered, filterable by authentication tier / side / category / date (shared with View 1), with pin detail that exposes the corroboration basis. Completes the two-view web product.

**Exit criteria for M4**
- `/api/map` returns clustered GeoJSON for a viewport, honoring `asOf`, the tier threshold, and side/category/audience filters (EDD §9.3).
- The hybrid zoom strategy works: grid aggregate `z<8`, `ST_ClusterDBSCAN` `8–14`, raw points `z>14`.
- Clusters render with count + dominant side + strongest tier; cluster click zooms to its bounds; pin click opens evidence detail incl. AI corroborators/score/contradictions (M3·WS8).
- Map filters and date/threshold are the **same controls as View 1**, driven by shared URL state; switching views preserves state.
- Past-day cluster responses are CDN-cached; pan/zoom stays within the interaction budget.
- WCAG 2.1 AA: pins keyboard-reachable with text equivalents; graphic media linked, not embedded (PRD §9).

> **Scope:** this is the **web** map (MapLibre **GL JS**). Native map parity (MapLibre Native) is **M6** (PRD §5.3, EDD §9.4) — keep the `/api/map` contract platform-neutral so M6 reuses it unchanged.

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d. Each task lists **deps** and **acceptance**.

---

## WS0 — `/api/map` clustering endpoint — EDD §9.3

- **T0.1 — `map_point` readiness** (S) — deps: M3·T5.2
  Verify the pipeline-maintained `map_point` (one row per counted canonical casualty, best-geo evidence, `geom_3857`); add a backfill/refresh job for rows predating M3.
  *Acceptance:* every counted, geolocated canonical casualty has exactly one `map_point`; backfill is idempotent.

- **T0.2 — Core clustering query** (L) — deps: T0.1
  Implement the §9.3 SQL: bbox `&&` filter → `ST_ClusterDBSCAN(geom_3857, eps, minpoints:=1) OVER ()` → `GROUP BY cid`; `eps = pixelRadius · 40075016.6855785/(512·2^z)`; output per-cluster `n`, centroid, bounds, `dominant_side`, `top_tier`, rep evidence/casualty ids. Parameterized by `asOf`, `tiers[]`, side/category/audience.
  *Acceptance:* matches a hand-computed fixture (screen-uniform clusters across latitudes); singletons (`n=1`) carry rep ids; `event_date ≤ asOf` and tier filter applied; query uses the GiST index for the bbox prefilter.

- **T0.3 — Hybrid zoom strategy** (M) — deps: T0.2
  `z<8` → `ST_SnapToGrid` grid aggregate; `8≤z≤14` → DBSCAN (T0.2); `z>14` → raw points (no clustering). One handler dispatches by zoom band.
  *Acceptance:* each band returns correct shapes; world-zoom (`z<8`) does not run DBSCAN over the full point set (verified by plan/timing).

- **T0.4 — Endpoint + typed payload** (M) — deps: T0.2, T0.3
  `/api/map?asOf&tiers&side&category&audience&bbox&zoom` → GeoJSON `FeatureCollection`; define the type in `@peaceclock/api-types` (platform-neutral for M6).
  *Acceptance:* valid GeoJSON; cluster vs singleton features distinguishable; type consumed by the client; `tiers[]` reflects the slider threshold.

- **T0.5 — Edge caching** (S) — deps: T0.4
  Cache key `(tile-snapped bbox, z, sorted tiers, side, category, audience, asOf-day)`; immutable past days cached indefinitely; trailing day revalidated (EDD §6/§9.3).
  *Acceptance:* neighboring pans hit cached entries; new ingest invalidates only the trailing-day keys.

---

## WS1 — Map UI (web, MapLibre GL JS) — EDD §9.4

- **T1.1 — Full-screen map + tiles** (M) — deps: M2 done
  MapLibre GL JS full-screen view; configure the tile provider + base style; default world view; pan/zoom controls.
  *Acceptance:* map renders at all zoom levels; tile provider configurable via env (EDD §14 open question).

- **T1.2 — Cluster & pin rendering** (M) — deps: T1.1, T0.4
  Render clusters (badge = `n`, color = `dominant_side`, tier badge = `top_tier`) and singleton pins (auth-tier styling; AI-corroborated visually distinct). Symbol layers from the GeoJSON.
  *Acceptance:* clusters/pins reflect the API; tier and side encodings legible and consistent with View 1.

- **T1.3 — Viewport-driven fetch + cluster expand** (M) — deps: T1.2
  On pan/zoom (debounced), refetch `/api/map` with the new bbox/zoom; cluster click → `fitBounds(feature.bounds)`.
  *Acceptance:* clusters resolve into sub-clusters/pins as you zoom; click-to-zoom uses the server `bounds`; no refetch storms (debounce verified).

- **T1.4 — Pin detail panel** (M) — deps: T1.2, M3·T8.1
  Pin click → detail: source/news/X link, tier, side, audience, date. AI-corroborated → corroborating posts, `match_score`, contradictions, geo-placement uncertainty (from `/api/evidence/:id`).
  *Acceptance:* detail resolves for cluster singletons and (via rep id) representative pins; corroboration basis shown for AI items; **media linked, never embedded** (PRD §9).

- **T1.5 — Map filters (shared controls)** (M) — deps: T1.3, T2.1
  Authentication-threshold, side, category, and date controls on the map re-query live; same control components/state as View 1.
  *Acceptance:* moving the threshold/side/category/date updates pins and clusters; control state matches View 1 exactly.

---

## WS2 — Shared state & view navigation

- **T2.1 — Unified URL state** (M) — deps: M2·T3.2/T3.3
  One source of truth for `{asOf, threshold, side, category, audience, map viewport}` in the URL; deep-linkable (`/m/...`, PRD §5.3); read by both views.
  *Acceptance:* a shared link reopens the same counter+map state; back/forward works; refresh restores.

- **T2.2 — Counter ↔ map navigation** (S) — deps: T2.1, T1.5
  View switch preserves all shared state; replace the M2 lightweight backdrop entry point with the real full-screen map.
  *Acceptance:* switching views keeps date/threshold/side/category; M2 backdrop fully superseded.

---

## WS3 — Performance

- **T3.1 — Server cluster perf** (M) — deps: T0.2, T0.3
  Bound candidate sets by bbox; confirm GiST index use; cap worst-case point counts per request; set a query-time budget + alarm.
  *Acceptance:* p95 cluster query within budget at representative densities; no unbounded DBSCAN input.

- **T3.2 — Client perf & low-bandwidth** (M) — deps: T1.3
  Edge-cache tiles; debounce refetch; cap rendered features; graceful degradation on slow links (PRD §7).
  *Acceptance:* smooth pan/zoom at target FPS; map usable on throttled 3G; no jank from over-rendering.

- **T3.3 — Common-response precompute (optional)** (S) — deps: T0.5
  Precompute/warm cluster responses for common `(zoom-bucket, default tiers, recent asOf-day)` combos.
  *Acceptance:* first-paint cluster fetch served warm for the default view; measured improvement documented.

---

## WS4 — Quality, accessibility, sensitivity

- **T4.1 — Map accessibility** (M) — deps: T1.4, T1.5
  Keyboard-reachable pins; an accessible **list/table fallback** of visible evidence; ARIA + screen-reader labels; focus management in the detail panel (PRD §6.6).
  *Acceptance:* full keyboard traversal of pins + detail; SR reads pin tier/side/date; list fallback equivalent to the map.

- **T4.2 — Sensitivity & neutrality** (S) — deps: T1.4
  Graphic/identifying media linked (in-app browser/external), never embedded; even-handed side styling; dignified framing (PRD §9).
  *Acceptance:* no inline graphic media; both sides visually balanced; copy reviewed.

- **T4.3 — Responsive / touch** (S) — deps: T1.1
  Mobile-first full-screen map; touch pan/zoom/tap; detail panel as a mobile sheet.
  *Acceptance:* verified on mobile/tablet/desktop; touch gestures and detail sheet work.

- **T4.4 — M4 E2E test** (M) — deps: WS1, WS2
  Playwright: open map → pan/zoom → expand a cluster → filter by tier/side/date → open a pin → source resolves. Cross-check visible pin/cluster counts against `map_point`/the engine.
  *Acceptance:* E2E green in CI; counts reconcile with the data layer.

---

## Critical path & sequencing

```
M3 pipeline → T0.1 → T0.2 → T0.3 → T0.4 → T0.5
M2 done   → T1.1 → T1.2 → T1.3 → T1.4 ; T1.5
T2.1 → T1.5 ; T2.1 → T2.2
T0.2/T0.3 → T3.1 ; T1.3 → T3.2 ; T0.5 → T3.3
WS1/WS2 → T4.1, T4.2, T4.3, T4.4
```

**Long pole:** the clustering query (T0.2) + hybrid zoom (T0.3) — the screen-uniform `eps` math and the world-zoom fallback are the subtle parts; lock their fixtures before wiring the UI. Everything visual reads from `/api/map`.

## Open decisions / carry-overs
- **Tile provider** (EDD §14) — MapTiler vs self-hosted Protomaps; cost + offline-degradation behavior (PRD §10). Blocks final T1.1 config.
- **Web↔native cluster parity** (EDD §14) — confirm MapLibre Native (M6) renders the same `/api/map` GeoJSON identically; keep the contract neutral now.
- **Cluster precompute cost** (T3.3) — only warm common combos; full precompute likely not worth it at launch volume.
- **List-view fallback scope** (T4.1) — how much of the map's evidence the accessible fallback must enumerate per viewport.
