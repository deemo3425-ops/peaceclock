# PeaceClock — Roadmap

> ## 🟦 100% Defined   ·   🟩 63% Completed   ·   ⬜ 0% Deployed
>
> _As of 2026-06-16. M1–M2 complete; M3–M4 core built & unit-tested (live-infra E2E pending); M5–M7 ready to build._

**What the three numbers mean**

| Metric | Definition |
|---|---|
| **Defined** | Requirements + design + task breakdown exist and are reviewed (PRD / EDD / tasks.md). |
| **Completed** | Implemented, tested, and merged to `main`. |
| **Deployed** | Live to users on its target surface(s) — web served, or app live in its store. |

Each is a weighted roll-up across milestones (weights = relative effort, sum to 100%). A milestone can be fully *defined* while 0% *completed*; a milestone is only *deployed* once its surface is live.

---

## Top-line by milestone

| # | Milestone | Weight | Defined | Completed | Deployed | Status |
|---|-----------|:------:|:-------:|:---------:|:--------:|--------|
| M1 | Foundations (schema, tiers, ingestion) | 18% | 100% | 100% | 0% | ✓ Built & tested |
| M2 | Counter / View 1 | 14% | 100% | 100% | 0% | ✓ Built & tested (needs live DB + E2E in CI) |
| M3 | AI corroboration | 22% | 100% | 85% | 0% | ◑ Core built & unit-tested; live-infra E2E pending |
| M4 | Map / View 2 | 14% | 100% | 85% | 0% | ◑ Core built & unit-tested; live tiles/DB E2E pending |
| M5 | Promotional website | 8% | 100% | 0% | 0% | Designed + tasked → ready to build |
| M6 | Apps & store submission | 14% | 100% | 0% | 0% | Designed + tasked → ready to build |
| M7 | Polish & launch | 10% | 100% | 0% | 0% | Designed + tasked → ready to build |
| M8 | Multi-theater expansion | 0% | 100% | 0% | 0% | PRD §6.8 tasked → [tasks-m8.md](./tasks-m8.md) |
| | **Weighted total** | **100%** | **100%** | **63%** | **0%** | |

Progress bars:
```
Defined    ████████████████████ 100%
Completed  ████████████▌░░░░░░░  63%
Deployed   ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## Deployment by surface

"Deployed" is multi-surface (PRD §5.3). None are live yet.

| Surface | Target milestone | Deployed |
|---|---|:---:|
| Web app | M2 (counter) → M4 (map) | ⬜ 0% |
| Promotional website | M5 | ⬜ 0% |
| Apple App Store (iOS/iPadOS) | M6 | ⬜ 0% |
| Google Play (Android) | M6 | ⬜ 0% |
| Mac App Store (macOS) | M6 | ⬜ 0% |

---

## Milestone detail

### M1 — Foundations · Defined 100% · Completed 100% · Deployed 0%
Data model (EDD §5), tier definitions (PRD Appendix A), embeddings, ingestion framework for confirmed sources. **Built and tested.**

Completed:
- WS0: infrastructure (Next.js monorepo, Drizzle, env validation, OTel skeleton, spend_meter)
- WS1: data model (8 tables: evidence, casualty, daily_agg, audit_log, map_point, corro_batch; 11 enums)
- WS2: tier config (match-score weights, thresholds, apply_agg_delta with properties)
- WS3: embeddings (Voyage API client, embed() helper)
- WS4: ingestion framework (SourceAdapter interface, triage, ingestEvidence())
- WS5: source adapters (OHCHR, RU, UA stubs; real APIs are M2+ carry-over)
- WS6: validation (integration test with fixtures, methodology page, metrics skeleton)

Carry-over: UA confirmed-military source decision (PRD §10) blocks real adapter implementation.

### M2 — Counter / View 1 · Defined 100% · Completed 0% · Deployed 0%
The as-of/windowed count engine (EDD §6) and `/api/counts` (EDD §9.1) are designed and the threshold slider + date scrubber are specified (PRD §5.1). **Fully tasked** in [tasks-m2.md](./tasks-m2.md). First public web surface.
- Carry-over risk: wounded/missing categories may ship empty pending M1 source coverage; AI-corroborated slider stop is data-less until M3.

### M3 — AI corroboration · Defined 100% · Completed 0% · Deployed 0%
Match-score thresholds (PRD Appendix A), the batch worker (EDD §8.1), and cost controls (PRD §12) are specified to implementation depth. **Fully tasked** in [tasks-m3.md](./tasks-m3.md). Highest-risk milestone — `writeOutcome` and worker resumability are the long poles.
- Carry-over risk: threshold/cap values are v1 starting points (tunable); audit staffing assumed (PRD §10); multilingual scoring on Cyrillic source text to validate.

### M4 — Map / View 2 · Defined 100% · Completed 0% · Deployed 0%
`ST_ClusterDBSCAN` clustering + `/api/map` (EDD §9.3) and the web MapLibre client (EDD §9.4) specified to implementation depth. **Fully tasked** in [tasks-m4.md](./tasks-m4.md). Completes the two-view web product.
- Carry-over risk: tile provider choice (EDD §14) blocks final map config; web↔native cluster parity confirmed in M6.

### M5 — Promotional website · Defined 100% · Completed 0% · Deployed 0%
Marketing site + live counter + methodology/about/funding + store badges. **Fully tasked** in [tasks-m5.md](./tasks-m5.md).
- Carry-over risk: store links "coming soon" until M6; funding disclosure content needed from owner.

### M6 — Apps & store submission · Defined 100% · Completed 0% · Deployed 0%
Expo/RN clients (iOS, Android), MapLibre Native, macOS via the iPad-app path, EAS build/submit, store compliance. **Fully tasked** in [tasks-m6.md](./tasks-m6.md).
- Carry-over risk: store **review** is the long pole (sensitive-content framing); macOS fidelity is iPad-app for v1.

### M7 — Polish & launch · Defined 100% · Completed 0% · Deployed 0%
Performance, accessibility, offline, observability, security, and coordinated multi-surface launch consolidated. **Fully tasked** in [tasks-m7.md](./tasks-m7.md).
- Carry-over risk: app-store approvals gate the app portion of launch; web/promo can launch independently.

---

## How these numbers move

- **Defined = 100%** — all milestones (M1–M8) are task-broken. M8 is post-launch expansion; M1–M7 are the ship path. Next step is execution: advance **Completed** on remaining M1–M7 carry-overs.
- **Completed** advances as tasks merge to `main` with tests green; it rolls up from per-task completion within each milestone.
- **Deployed** advances per surface: web first (M2/M4), then promo site (M5), then the three app stores (M6). Store review is the long pole for app deployment.

> Update cadence: revise the three top-line numbers whenever a milestone's defined/completed state changes or a surface deploys. Keep the leading line authoritative — it's the one thing read at a glance.
