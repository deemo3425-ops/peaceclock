# PeaceClock — Coordinated Launch Checklist

**Milestone:** M7·WS6 — Coordinated multi-surface launch  
**Scope:** Web app, promotional site, iOS, Android, macOS  
**Theater:** Ukraine only (`theater=ukraine`) until M8

Use this checklist for the go/no-go decision before flipping any surface live. Each section must be signed off by the named owner. **Deployed** in [ROADMAP.md](./ROADMAP.md) stays at 0% until a human confirms the surface is live.

---

## 1. Pre-flight (all surfaces)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1.1 | `main` green — all CI checks pass (typecheck, unit, e2e where applicable) | Eng | ☐ |
| 1.2 | Production env vars set per [deploy-runbook.md](./deploy-runbook.md) (`DATABASE_URL`, `CRON_SECRET`, API keys) | Eng | ☐ |
| 1.3 | Neon migrate + seed smoke on production DB | Eng | ☐ |
| 1.4 | Vercel crons verified (`/api/cron/ingest`, `/api/cron/corroborate`) | Eng | ☐ |
| 1.5 | `queryPipelineMetrics()` dashboard wired — ingest 24h, corro queue, budget spend, audit backlog | Ops | ☐ |
| 1.6 | OTel traces reaching collector (`OTEL_EXPORTER_OTLP_ENDPOINT` set) | Ops | ☐ |
| 1.7 | Uptime SLO (99.9%) instrumented with alerts | Ops | ☐ |
| 1.8 | Budget-cap and audit-backlog alert thresholds configured | Ops | ☐ |

---

## 2. Web app (counter + map)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 2.1 | Lighthouse perf ≥ 90, FCP < 2s on throttled 3G | Eng | ☐ |
| 2.2 | WCAG 2.1 AA — axe pass on counter, map, audit (`e2e/a11y.spec.ts`) | Eng | ☐ |
| 2.3 | `/api/counts` and `/api/map` return live data on production DB | Eng | ☐ |
| 2.4 | Offline banner verified — simulate API outage, last-known-good timestamp shown | Eng | ☐ |
| 2.5 | Deep links work: `/c/ukraine/:date`, `/m/ukraine/:date` | Eng | ☐ |
| 2.6 | Map tiles + sprites load (MapTiler key or fallback) | Eng | ☐ |

---

## 3. Promotional website (M5)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 3.1 | Methodology, about, funding pages reviewed and signed off | Content | ☐ |
| 3.2 | Live counter embed matches web app numbers | Content | ☐ |
| 3.3 | Store badges link to live listings (or "coming soon" removed) | Content | ☐ |
| 3.4 | Privacy policy consistent with app store disclosures | Legal | ☐ |

---

## 4. Native apps (iOS, Android, macOS)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 4.1 | EAS production builds succeed for all three platforms | Eng | ☐ |
| 4.2 | TestFlight + Play internal testing sign-off | Eng | ☐ |
| 4.3 | Store review approved (or stagger plan documented) | PM | ☐ |
| 4.4 | Deep links (`peaceclock://`, universal links) open correct view/date | Eng | ☐ |
| 4.5 | Offline cache + banner verified on device (counts + map) | Eng | ☐ |
| 4.6 | VoiceOver / TalkBack manual pass | Eng | ☐ |
| 4.7 | Privacy nutrition labels / Data Safety forms match actual analytics | Legal | ☐ |
| 4.8 | Sensitive-content framing approved (linked sources, not embedded) | Content | ☐ |

---

## 5. Security & privacy

| # | Item | Owner | Status |
|---|------|-------|--------|
| 5.1 | API authz + rate limits reviewed (`CRON_SECRET`, audit routes) | Security | ☐ |
| 5.2 | No PII in logs, traces, or analytics | Security | ☐ |
| 5.3 | Dependency / supply-chain scan clean (no critical CVEs) | Security | ☐ |
| 5.4 | AI pipeline poisoning review — counts cannot inflate beyond audit controls | Security | ☐ |

---

## 6. Launch day

| # | Item | Owner | Status |
|---|------|-------|--------|
| 6.1 | **Go/no-go meeting** — all sections above green or explicitly waived | PM | ☐ |
| 6.2 | Promote Vercel production deployment | Eng | ☐ |
| 6.3 | Flip promo site DNS / deploy | Eng | ☐ |
| 6.4 | Release app store listings (stagger per surface if review pending) | PM | ☐ |
| 6.5 | Post-launch announcement (social, press if applicable) | PM | ☐ |
| 6.6 | Update ROADMAP.md **Deployed** column per surface as each goes live | PM | ☐ |

---

## 7. Post-launch watch (day 1 / week 1)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 7.1 | Error rates within baseline — web + native crash-free sessions | Ops | ☐ |
| 7.2 | AI cost vs monthly cap — no unexpected spend spike | Ops | ☐ |
| 7.3 | Audit backlog stable — no unbounded growth | Ops | ☐ |
| 7.4 | Store ratings / reviews monitored; hotfix path ready | PM | ☐ |
| 7.5 | Watch window closed; issues triaged | PM | ☐ |

---

## Staggered launch option

If app store review slips, launch web + promo first:

1. Complete sections 1–3 and 6.2–6.3.
2. Set ROADMAP **Deployed** for Web app and Promotional website.
3. Hold section 6.4 until store approvals land; flip each store independently.

---

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Engineering lead | | | ☐ Go / ☐ No-go |
| Content owner | | | ☐ Go / ☐ No-go |
| Ops / on-call | | | ☐ Go / ☐ No-go |
| PM / launch owner | | | ☐ Go / ☐ No-go |