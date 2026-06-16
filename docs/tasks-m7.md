# PeaceClock — M7 (Polish & Launch) Task Breakdown

**Milestone:** M7 — Polish & launch (PRD §11.7, §7, §9; EDD §10–§12)
**Depends on:** M2–M6 functionally complete across surfaces (web, promo site, iOS, Android, macOS).
**Goal:** Consolidate the cross-cutting non-functional requirements — performance, accessibility, offline, observability, security, and a coordinated public launch across all five surfaces. This milestone closes out the NFRs that were referenced throughout the PRD/EDD but not yet consolidated.

**Exit criteria for M7**
- Performance targets met on every surface (FCP < 2s on 3G for the counter; smooth map; app cold-start budget).
- Accessibility audit (WCAG 2.1 AA web + platform a11y on apps) passed, with manual sign-off.
- Offline / last-known-good verified end-to-end; reliability target (99.9%) instrumented with last-known-good fallback.
- Observability complete: ingestion, AI cost/budget, audit backlog, uptime, error tracking — all dashboarded and alerting.
- Security & privacy review passed; methodology/about/funding finalized; coordinated launch executed.

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d.

---

## WS0 — Performance hardening

- **T0.1 — Counter & API perf pass** (M) — deps: M2, M4
  Verify FCP < 2s on throttled 3G; CDN cache hit-rates on `/api/counts` and `/api/map`; prefix-sum/range queries within budget; eliminate any regressions.
  *Acceptance:* Lighthouse + synthetic checks meet targets across web; cache hit-rate dashboarded.

- **T0.2 — Map perf at density** (M) — deps: M4
  Cluster query p95 within budget at peak point density; client FPS during pan/zoom; common-response warming tuned.
  *Acceptance:* load test at projected volume passes; no unbounded DBSCAN inputs.

- **T0.3 — App cold-start & footprint** (S) — deps: M6
  Native cold-start, bundle size, memory on mid-tier devices.
  *Acceptance:* cold-start + size within target on a reference low-end device.

---

## WS1 — Accessibility audit

- **T1.1 — Web WCAG 2.1 AA audit** (M) — deps: M2, M4, M5
  Full audit of counter, map (incl. list fallback), and marketing pages; remediate findings.
  *Acceptance:* automated + manual audit pass; remediations merged; sign-off recorded.

- **T1.2 — Platform a11y audit** (M) — deps: M6
  VoiceOver/TalkBack, Dynamic Type, keyboard (iPad/Mac) across both views.
  *Acceptance:* manual a11y pass on iOS/Android/macOS; issues fixed.

---

## WS2 — Reliability & offline

- **T2.1 — Last-known-good fallback** (M) — deps: M2, M4
  Serve cached aggregates/tiles when a source or upstream is unreachable (EDD §7, §12); graceful degradation banners.
  *Acceptance:* simulated source/upstream outage keeps counts + map serving last-known-good with clear timestamping.

- **T2.2 — Offline E2E (apps)** (S) — deps: M6·T3.1
  End-to-end offline verification on devices (counts, map, banner, reconnect refresh).
  *Acceptance:* offline scenarios pass on iOS/Android/macOS.

- **T2.3 — Uptime/SLO instrumentation** (S) — deps: M2
  99.9% uptime target instrumented; health checks; alerting.
  *Acceptance:* uptime SLO dashboarded with alerts.

---

## WS3 — Observability & ops

- **T3.1 — Unified dashboards** (M) — deps: M3·T6.3
  Consolidate: ingestion (items/dropped/source), AI cost vs monthly cap, escalation rate, audit backlog + tier-uphold rate, API latency/cache, error rates.
  *Acceptance:* single ops view; each PRD §8/§12 metric present.

- **T3.2 — Error tracking & alerting** (S) — deps: all surfaces
  Crash/error reporting across web + apps; pager/alert routing for pipeline, budget cap, uptime.
  *Acceptance:* test alerts fire and route; crash-free session rate tracked per store (PRD §8).

---

## WS4 — Security, privacy & content review

- **T4.1 — Security review** (M) — deps: M3, M6
  Review API authz/rate-limits, secret handling, no PII, dependency/supply-chain scan; ensure the AI pipeline can't be poisoned to inflate counts beyond audit controls.
  *Acceptance:* review complete; criticals resolved.

- **T4.2 — Privacy & content consistency** (S) — deps: M5·T1.3, M6·T5.3
  Privacy policy ↔ app privacy labels ↔ actual analytics all consistent; sensitive-content handling (linked not embedded) verified on every surface (PRD §9).
  *Acceptance:* consistency audit passes across web + 3 stores.

---

## WS5 — Content finalization

- **T5.1 — Methodology / about / funding sign-off** (S) — deps: M5·WS0
  Final review of tier definitions, sources, neutrality, coverage asymmetry, funding disclosure; lock against `tiering.config`.
  *Acceptance:* content owner sign-off; no drift vs encoded config.

- **T5.2 — Launch copy & store assets final** (S) — deps: M6·T5.2
  Final marketing + store copy/screenshots, consistent neutral framing.
  *Acceptance:* assets approved across surfaces.

---

## WS6 — Launch

- **T6.1 — Pre-launch checklist** (M) — deps: WS0–WS5
  Cross-surface go/no-go: perf, a11y, offline, observability, security, store approvals, content sign-off.
  *Acceptance:* checklist complete; go decision recorded.

- **T6.2 — Coordinated multi-surface launch** (M) — deps: T6.1, M6·T5.4
  Release web + promo site publicly; flip store listings live; coordinate announcement; monitor.
  *Acceptance:* all five surfaces live; ROADMAP "Deployed" updated per surface; post-launch monitoring green.

- **T6.3 — Post-launch watch** (S) — deps: T6.2
  Day-1/week-1 monitoring: error rates, cost vs cap, audit backlog, store ratings/crash-free; hotfix path ready.
  *Acceptance:* watch window completed; issues triaged.

---

## Critical path
```
M2–M6 done → WS0 ; WS1 ; WS2 ; WS3 ; WS4 ; WS5  (parallelizable)
all → T6.1 → T6.2 → T6.3
```

**Long pole:** store **approvals** (carried from M6·T5.4) gate the app portion of the coordinated launch — web + promo site can launch independently if app review slips; the ROADMAP "Deployed" tracks surfaces separately for exactly this reason.

## Open decisions / carry-overs
- **Staggered vs simultaneous launch** — launch web/promo first and apps as approved, or hold for a single coordinated moment? (Recommend staggered; ROADMAP deploys per surface.)
- **SLO/alert thresholds** — finalize uptime, cost-cap, and audit-backlog alert levels from real M1–M4 data.
- **Incident/runbook ownership** — who owns the pager for pipeline/budget/uptime alerts post-launch (ties to PRD §10 audit staffing).
