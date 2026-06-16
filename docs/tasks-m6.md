# PeaceClock — M6 (Apps & Store Submission) Task Breakdown

**Milestone:** M6 — Apps & store submission (PRD §11.6, §5.3; EDD §9.4)
**Depends on:** M2 (counter), M3 (corroboration detail API), M4 (map + `/api/map` contract); the shared count-engine library and `@peaceclock/api-types`.
**Goal:** Package both views as native apps and publish to the **Apple App Store (iOS/iPadOS)**, **Google Play (Android)**, and **Mac App Store (macOS)** — one Expo/React Native client over the same backend, MapLibre Native for the map, macOS via the iPad-app path. Three new deployment surfaces.

**Exit criteria for M6**
- One Expo/RN app renders View 1 (counter) + View 2 (map) at **feature parity** with web, reusing the shared count-engine + API types.
- Map uses **MapLibre Native** consuming the same `/api/map` GeoJSON; parity with web confirmed.
- Apps live in the **Apple App Store**, **Google Play**, and **Mac App Store** (macOS via "Designed for iPad" on Apple Silicon).
- **Offline / last-known-good** works (cached counts + tiles, timestamped) per PRD §5.3, §7.
- **Deep links** (universal links / App Links) resolve shared state; **store compliance** (ratings, privacy labels, Data Safety) passes review.

> The backend is unchanged — this is a client-packaging milestone (EDD §9.4). No new APIs; if a gap appears, fix the shared contract, not a per-platform shim.

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d.

---

## WS0 — Cross-platform client foundation

- **T0.1 — Expo/RN app scaffold** (M) — deps: M4 done
  Expo app in the monorepo; consume the shared count-engine library + `@peaceclock/api-types`; `app.config.ts` (bundle ids, versions, icons, splash).
  *Acceptance:* app boots on iOS + Android simulators; shared logic imported, not reimplemented.

- **T0.2 — Networking & state layer** (S) — deps: T0.1
  API client for `/api/counts`, `/api/map`, `/api/evidence`; shared URL/state model mapped to native navigation/deep links.
  *Acceptance:* all three endpoints fetch + type-check; state model matches web.

- **T0.3 — Design-system parity** (M) — deps: T0.1
  Shared visual identity (with M5/web); tier/side encodings, typography, dignified framing (PRD §9) consistent across surfaces.
  *Acceptance:* counter + map chrome visually consistent with web; tier/side colors identical.

---

## WS1 — View 1 (Counter) native

- **T1.1 — Counter UI** (M) — deps: T0.2, T0.3
  Date controller, authentication-threshold slider, side×window matrix (civilian-primary/military-secondary), category toggle — over the **shared** engine (no recompute logic duplicated).
  *Acceptance:* matrix + slider + date control match web output for the same inputs; native gestures for the slider/scrubber.

- **T1.2 — Source attribution & detail** (S) — deps: T1.1, M3·T8.1
  Tap a figure → sources; evidence detail incl. AI corroboration basis; open source URLs in an in-app browser (no embedded graphic media, PRD §9).
  *Acceptance:* every cell links to a source; media linked not embedded; corroboration shown for AI items.

---

## WS2 — View 2 (Map) native — MapLibre Native

- **T2.1 — MapLibre Native map** (M) — deps: T0.2
  `@maplibre/maplibre-react-native` full-screen map; same tile provider as web; pan/zoom.
  *Acceptance:* map renders on iOS + Android; tile provider configurable.

- **T2.2 — Clusters/pins from `/api/map`** (M) — deps: T2.1, M4·T0.4
  Render the same clustered GeoJSON; tier/side encodings; cluster click → fitBounds; pin tap → detail panel.
  *Acceptance:* clusters/pins match web for the same viewport/filters; **web↔native parity confirmed** (EDD §14 open question resolved).

- **T2.3 — Map filters (shared)** (S) — deps: T2.2, T1.1
  Threshold/side/category/date drive both native views, shared with the counter.
  *Acceptance:* filter state shared across native View 1/View 2; matches web semantics.

---

## WS3 — Platform integration

- **T3.1 — Offline / last-known-good** (M) — deps: T0.2
  Persist latest `/api/counts` series + a small tile/cluster cache (SQLite/MMKV); render cached state with an "as of <timestamp>" banner offline; disable scrub beyond cached range (PRD §5.3, §7).
  *Acceptance:* airplane-mode shows cached counts/map with timestamp; immutable past-day data never stale; trailing edge refreshes on reconnect.

- **T3.2 — Deep links** (M) — deps: T0.2
  Universal Links (iOS) + App Links (Android); `/c/...` and `/m/...` resolve to the same in-app state and hand off from web when installed (PRD §5.3).
  *Acceptance:* a shared link opens the correct in-app view/state; web→app handoff verified on device.

- **T3.3 — Platform accessibility** (M) — deps: WS1, WS2
  Dynamic Type, VoiceOver, TalkBack; keyboard on iPad/Mac; pin list fallback parity with web (PRD §6.6).
  *Acceptance:* VoiceOver/TalkBack traverse counter + map; Dynamic Type scales; list fallback present.

---

## WS4 — macOS

- **T4.1 — "Designed for iPad" on Apple Silicon** (M) — deps: WS1, WS2
  Enable the iPad app to run on Apple Silicon Macs; verify map + counter behave with desktop input; Mac App Store target.
  *Acceptance:* app runs as a Mac binary; map/counter usable with trackpad/keyboard; no iPad-only assumptions break.
  *Note:* React Native macOS (native desktop chrome) is a **post-v1 fidelity upgrade** (EDD §14), not in M6.

---

## WS5 — Build, release & store compliance

- **T5.1 — EAS Build + Submit** (M) — deps: WS1, WS2
  EAS Build for iOS/Android (+ macOS via iPad path); signing/entitlements; EAS Submit to App Store Connect + Google Play; CI runs typecheck + shared tests before build.
  *Acceptance:* signed builds produced and uploaded to both consoles from CI.

- **T5.2 — Store metadata & assets** (M) — deps: T5.1
  Listings: name, description (neutral framing), screenshots, keywords, support/marketing URLs (link to M5 site), age/content rating reflecting an armed-conflict news app.
  *Acceptance:* complete listings staged in App Store Connect + Play Console; ratings set.

- **T5.3 — Privacy labels & Data Safety** (M) — deps: T5.1, M2·T5.3
  Apple privacy-nutrition labels + Google Data Safety: privacy-respecting aggregate analytics only, no account/PII; consistent with the M5 privacy policy.
  *Acceptance:* forms completed truthfully; consistent across stores + website.

- **T5.4 — Review submission & sign-off** (M) — deps: T5.2, T5.3, WS3
  Submit to all three stores; handle sensitive-content/UGC questions (evidence linked not embedded, no UGC creation); track and resolve review feedback.
  *Acceptance:* approved on Apple App Store, Google Play, and Mac App Store.

---

## WS6 — Validation

- **T6.1 — Cross-platform E2E** (M) — deps: WS1, WS2, WS3
  Device tests (iOS, Android, Mac): counter scrub/threshold, map pan/zoom/filter/pin, deep link, offline mode. Cross-check numbers against the shared engine.
  *Acceptance:* green on all three platforms; numbers match web.

- **T6.2 — Parity audit vs web** (S) — deps: T6.1
  Feature-parity checklist (controls, windows, tiers, attribution, map) signed off (PRD §5.3).
  *Acceptance:* parity checklist complete; deltas justified or fixed.

---

## Critical path
```
M4 done → T0.1 → T0.2 → T0.3
T0.2 → T1.1 → T1.2
T0.2 → T2.1 → T2.2 → T2.3
T0.2 → T3.1 ; T3.2 ; WS1/WS2 → T3.3
WS1/WS2 → T4.1
WS1/WS2 → T5.1 → T5.2 ; T5.3 → T5.4
→ T6.1 → T6.2
```

**Long pole:** store **review** (T5.4) — submission timing and reviewer feedback are outside our control; sensitive-content framing (armed conflict, linked OSINT) is the most likely review friction. Stage metadata/privacy forms early and keep evidence strictly linked, never embedded.

## Open decisions / carry-overs
- **macOS fidelity** (EDD §14) — iPad-app for v1; React Native macOS deferred.
- **Web↔native map parity** (EDD §14) — resolved by T2.2; reconcile any MapLibre GL JS vs Native style/cluster differences.
- **Code-sharing depth** (EDD §14) — how much UI via `react-native-web` vs platform-specific view layers over the shared core.
- **Store review friction** — sensitive-content rating + OSINT links; prepare reviewer notes.
