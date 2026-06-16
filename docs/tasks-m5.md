# PeaceClock — M5 (Promotional Website) Task Breakdown

**Milestone:** M5 — Promotional website (PRD §11.5, §5.3; EDD §9.4)
**Depends on:** M2 (live counter), ideally M4 (map) for the embedded experience; same Next.js app on Vercel.
**Goal:** Ship the marketing site that explains PeaceClock and its methodology, shows the live counter, links to all three app stores, and hosts the about/funding and methodology pages. First *marketing* surface; doubles as the web home.

**Exit criteria for M5**
- Public landing page with the **live counter** (server-rendered) and a clear path into both views.
- **Methodology** and **About / Funding** pages published, matching the encoded tier config and source list (PRD §6.4, §9).
- **Store badges/links** (Apple App Store, Google Play, Mac App Store) present (deep-linking to listings once M6 ships; "coming soon" until then).
- SEO/social: metadata, Open Graph/Twitter cards with the live counter, sitemap, robots.
- Privacy policy + analytics disclosure; privacy-respecting analytics only (PRD §7).

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d.

---

## WS0 — Site shell & content

- **T0.1 — Marketing routes & layout** (M) — deps: M2 done
  Landing, methodology, about/funding, privacy routes in the existing Next.js app; shared header/footer; nav into View 1 / View 2.
  *Acceptance:* routes render; nav resolves to the live views; consistent layout.

- **T0.2 — Landing page + live counter** (M) — deps: T0.1, M2·T3.1
  Hero with the **server-rendered** live counter (current confirmed totals, "as of" + last-updated), mission statement, and a "lower bound, not the truth" framing (PRD §9).
  *Acceptance:* counter numbers render server-side (no-JS visible); copy reviewed for neutrality/dignity.

- **T0.3 — Methodology page** (M) — deps: T0.1, M1·T6.1, M3·T2.1
  Tier definitions (Appendix A.1), per-side sources, the no-enemy-claims rule, AI corroboration + audit explanation, coverage asymmetry (PRD §6.4, §9). Sourced from `tiering.config` so it can't drift.
  *Acceptance:* content matches encoded config; reviewed; links to source registry.

- **T0.4 — About / Funding page** (S) — deps: T0.1
  Project purpose, neutrality statement, who runs it, funding disclosure, contact (PRD §7, §9).
  *Acceptance:* funding/neutrality disclosure present; reviewed.

---

## WS1 — Distribution & growth surfaces

- **T1.1 — App-store badges & links** (S) — deps: T0.1
  Official Apple/Google/Mac App Store badges; link to listings (live after M6; "coming soon" state before).
  *Acceptance:* badges meet each store's brand guidelines; graceful pre-launch state; universal-link handoff when apps installed (PRD §5.3).

- **T1.2 — SEO & social cards** (M) — deps: T0.2
  Metadata, sitemap, robots, canonical URLs; Open Graph / Twitter cards rendering the live counter image (dynamic OG image).
  *Acceptance:* valid OG/Twitter preview shows current counts; sitemap submitted; Lighthouse SEO ≥ 95.

- **T1.3 — Privacy policy & analytics disclosure** (S) — deps: T0.1, M2·T5.3
  Privacy policy; cookie/analytics disclosure; aligns with app privacy labels (M6).
  *Acceptance:* policy published; matches actual analytics (no PII); consistent with store privacy declarations.

---

## WS2 — Quality & launch-readiness

- **T2.1 — Accessibility & responsive** (S) — deps: WS0
  WCAG 2.1 AA on marketing pages; mobile-first.
  *Acceptance:* axe pass; verified across breakpoints.

- **T2.2 — Performance** (S) — deps: T0.2
  Static/ISR where possible; fast first paint; the live counter doesn't block the page.
  *Acceptance:* Lighthouse perf ≥ 90; counter hydrates without blocking.

- **T2.3 — M5 E2E** (S) — deps: WS0, WS1
  Load landing → counter shows → navigate to methodology/about → store links present → enter live view.
  *Acceptance:* E2E green in CI.

---

## Critical path
```
M2 done → T0.1 → T0.2 ; T0.3 ; T0.4
T0.1 → T1.1 ; T0.2 → T1.2 ; T0.1 → T1.3
WS0/WS1 → T2.1, T2.2, T2.3
```

## Open decisions / carry-overs
- **Store links** are "coming soon" until M6 listings exist — confirm the pre-launch CTA.
- **Branding/design system** — confirm visual identity before content polish (shared with the apps, M6).
- **Funding disclosure content** (T0.4) — needs the actual funding/governance facts from the project owner.
