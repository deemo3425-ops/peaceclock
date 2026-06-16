# PeaceClock — Product Requirements Document

**Status:** Draft
**Owner:** David Morgan
**Branding & Design:** New Florence Interactive, an LLC
**Last updated:** 2026-06-16

---

## 1. Overview

PeaceClock is a public-facing application that tracks the human cost of the war in Ukraine as **confirmed casualty counts**, broken down by side — the **Ukraine coalition** and **Russia** — and by time window. It leads with the most defensible data (confirmed civilian casualties) and presents per-side military counts as clearly-labeled secondary data. Every count is backed by **geolocated, authenticated evidence**: sources, news, and X (Twitter) OSINT posts, each carrying a visible authentication level. An **AI corroboration** layer cross-checks each evidence post against similar posts to assign a provisional authentication tier.

PeaceClock ships on **four surfaces** — the web, the **Apple App Store (iOS/iPadOS)**, the **Google Play Store (Android)**, and the **Mac App Store (macOS)** — plus a **promotional website** that markets the product, links to every store, and hosts the live web experience. All surfaces present the same two views over the same backend.

The product is two views:

- **View 1 — Counter (default):** a date-controlled confirmed-casualty counter with a user-movable authentication threshold, over a world-map background where evidence is pinned and linked.
- **View 2 — Map (full-screen):** the world map promoted to its own zoomable view of all geolocated evidence, filtered by authentication level.

The name reflects the project's intent: a clock that counts what war costs, and that we hope will one day stop.

## 2. Problem Statement

Per-side casualty figures for the war in Ukraine are the most contested numbers of the conflict — weaponized by both belligerents, reported without provenance, and impossible to verify at face value. Estimated and projected figures add noise without accountability.

PeaceClock takes the opposite stance: **only confirmed casualties count.** A figure exists in PeaceClock only if it is backed by authenticated evidence (a geolocated OSINT post, a named-individual confirmation, an official verified report). Estimates and projections are out of scope. This makes the count a defensible **lower bound** rather than a contested guess.

## 3. Goals and Non-Goals

### Goals
- Count **only confirmed casualties** — every figure traces to authenticated evidence.
- Break counts down by **two sides** (Ukraine coalition, Russia) and by **time window** (24h, 7d, 30d, 90d, 1y, total).
- Track **all three categories** from launch: Killed, Wounded, Missing/POW.
- Lead with the **strongest-confirmed series** (OHCHR civilians); present per-side military counts as labeled secondary data.
- Make **time travel** first-class: a date controller shows the confirmed count as of any date.
- Let users **move the authentication threshold** and watch the count change.
- Use **AI to corroborate** evidence posts against similar posts, assigning a provisional tier.
- Pin evidence to **geographic locations** on a world map, each tagged with an authentication level.
- Ship both views to the **web, Apple App Store (iOS/iPadOS), Google Play (Android), and Mac App Store (macOS)** from one product, plus a **promotional website**.
- Load fast and remain accessible on low-bandwidth and mobile connections.

### Non-Goals
- We do not show estimated, projected, or modeled figures. Confirmed only.
- We do not produce original casualty assessments or conduct field verification ourselves; we aggregate others' confirmations.
- We do not treat a belligerent's claims about its enemy as confirmation.
- We do not take a political or military position; the project is humanitarian and informational.
- We do not track non-casualty war metrics (territory, equipment, economic cost) in v1.

## 4. Definitions

- **Confirmed casualty** — a casualty backed by authenticated evidence meeting a stated bar. Anything below the bar is excluded, not estimated.
- **Authentication level** — the verification tier of a piece of evidence, displayed on every pin and figure, ordered strongest to weakest:
  - **Official** — verified institutional report (e.g. OHCHR).
  - **Confirmed** — named individual / multi-source human corroboration (e.g. Mediazona+BBC).
  - **OSINT** — geolocated open-source, single credible human source.
  - **AI-corroborated** — provisional tier assigned by the AI corroboration layer (§6.4), pending human audit; visually distinct and always separable.
- **Ukraine coalition** — Ukrainian armed forces and integrated formations (incl. International Legion, allied volunteer units). Civilian casualties are a separate series.
- **Russia** — Russian armed forces and formations fighting on Russia's behalf (incl. affiliated PMCs and proxy formations). Civilian casualties are a separate series.
- **Casualty categories** — Killed, Wounded, Missing/POW, tracked separately; all three counted in v1. Killed is the most reliable; wounded the least.
- **Time windows** — last 24h, 7d, 30d, 90d, 1y, and cumulative total (since 24 Feb 2022), all relative to the **selected date**.
- **Evidence** — a sourced item tied to a casualty count: a primary source, a news report, or an X (Twitter) OSINT post. Carries publisher, date, geolocation, authentication level, and link.

## 5. Views

### 5.1 View 1 — Counter (default)
- **Date controller**, defaulting to **today**; scrubbing it recomputes every count as-of that date.
- **Authentication threshold control** — a slider from **Official → Confirmed → OSINT → AI-corroborated**. The headline count includes every tier at or above the chosen threshold and updates **live** as the user moves it. Default is a strict bar (Official + Confirmed).
- **Primary series:** confirmed **civilian** casualties (both sides, OHCHR-led), the strongest data.
- **Secondary series:** per-side **military** counts (Ukraine coalition, Russia) across windows 24h / 7d / 30d / 90d / 1y / total, clearly labeled lower-coverage. All three categories (Killed / Wounded / Missing-POW) selectable.
- **Background is the world map**: evidence is pinned geographically; pins link to the source, news article, or X post, each showing its authentication level.

### 5.2 View 2 — Map (full-screen)
- The world map promoted to a dedicated, **zoomable, pannable** view.
- Geolocated evidence pins with **clustering** at low zoom; expand to individual evidence at high zoom.
- **Filter by authentication level** (incl. show/hide AI-corroborated separately), side, category, and date (shared controls with View 1).
- Clicking a pin opens the evidence: source / news / X post, its authentication level, date, and side attribution. For AI-corroborated pins, the corroborating posts and match score are shown.
- Honors the selected date and threshold.

### 5.3 Platforms & distribution
PeaceClock is delivered on four product surfaces plus a marketing site. Both views (§5.1, §5.2) are identical in capability across every app surface; only input affordances and chrome adapt per platform.

- **Web app** — the canonical implementation; also embedded in the promotional website as the live experience.
- **Apple App Store (iOS / iPadOS)** — native app, published to the App Store.
- **Google Play Store (Android)** — native app, published to Google Play.
- **Mac App Store (macOS)** — native app, published to the Mac App Store.
- **Promotional website** — a marketing site that explains the project and its methodology, shows the live counter, links to all three app stores (with official store badges), and carries the about/funding and methodology pages.

Requirements common to all app surfaces:
- **Feature parity** — same date controller, authentication-threshold slider, per-side/per-window counts, and full-screen map on every surface.
- **Deep links & shareable state** — a counter/map state (date, threshold, side, location) is addressable by URL and opens the same view on web and in-app (universal links / App Links).
- **Offline / last-known-good** — apps cache the most recent counts and map tiles and display them (clearly timestamped) when offline (PRD §7).
- **Store compliance** — content rating, privacy-nutrition labels / Data Safety form, and sensitive-content handling (no graphic imagery; evidence linked, not embedded — §9) must satisfy Apple and Google review. The app is informational/humanitarian and takes no political position (§9).
- **Accessibility** — platform a11y (Dynamic Type, VoiceOver, TalkBack) in addition to WCAG on web (§6.6).
- **No account required** to view; no ads; privacy-respecting analytics only (§7).

## 6. Functional Requirements

### 6.1 Date-as-of computation
- All counts and map evidence are computed **as of the selected date**; default today.
- A 24h window = confirmed casualties attributed to the selected date; longer windows aggregate backward from it. Total = cumulative since 24 Feb 2022 up to the selected date.

### 6.2 Confirmed-only ingestion
- Only evidence meeting the authentication bar produces a counted casualty.
- Each counted casualty links to its evidence (source / news / X post), authentication level, geolocation, and date.
- A belligerent's claim about its enemy never constitutes confirmation.

### 6.3 Authentication threshold
- The headline counter includes all tiers at/above the user-selected threshold; default Official + Confirmed.
- Both views display each item's tier; tiers are visually distinct and filterable.

### 6.4 AI corroboration (research)
- For each evidence post (especially X/OSINT), the AI **searches the internal PeaceClock evidence DB for similar posts** describing the same event/casualty and computes a **match score** and a count of corroborating vs. contradicting items. The search corpus is the ingested evidence DB only — fully controlled and auditable; the AI does not pull live X/news/web.
- **Model:** **Claude Haiku 4.5** (`claude-haiku-4-5`) runs corroboration at volume; **ambiguous / count-affecting cases escalate to Claude Opus 4.8** (`claude-opus-4-8`) for adjudication.
- Based on corroboration, the AI **auto-assigns a provisional authentication tier** (typically AI-corroborated → OSINT), and the casualty **counts immediately** under that tier.
- **Geolocation:** the AI proposes coordinates from post text/media and **auto-pins** the evidence on the map, **flagged for later audit** (mirrors the tiering approach). Placement errors are expected and surfaced for correction.
- Every AI-assigned item (tier and location) is **flagged for human audit**; audits can promote, demote, reposition, or reject it, and corrections are logged.
- The AI's corroborating posts, match score, and contradicting evidence are **shown to users** on the pin/figure, so the basis is transparent.
- AI-corroborated items are always **separable** — users can exclude them via the threshold control, and they never silently masquerade as human-Confirmed.

### 6.5 Source / evidence transparency
- Every figure links to its underlying evidence item(s).
- A "Sources & Methodology" page defines side boundaries, the confirmation bar per tier, the AI corroboration method and its audit process, and the no-enemy-claims rule.

### 6.6 Updates
- Data refreshes on a defined cadence (e.g., daily); smallest window is 24h.
- Each update logs new confirmed evidence, AI assignments, human audits, and resulting recounts.

### 6.7 Accessibility & Reach
- Mobile-first, responsive; map degrades gracefully on low bandwidth.
- WCAG 2.1 AA: contrast, screen readers, keyboard navigation. Map pins keyboard-reachable with text equivalents; the threshold slider operable by keyboard.
- Sensitive framing: dignity over spectacle; both sides presented even-handedly; no graphic imagery.

## 7. Non-Functional Requirements

- **Performance:** First contentful paint under 2s on 3G; counter usable before the full map tileset loads; threshold slider recomputes counts without a full reload.
- **Reliability:** 99.9% uptime; cached last-known-good data and map tiles if a source is unreachable.
- **Trust:** Privacy-respecting aggregate analytics only. Clear about/funding disclosure.
- **Maintainability:** Authentication bar, AI corroboration thresholds, and source ingestion configurable without code changes where possible.

## 8. Success Metrics

- **Provenance coverage:** % of counted casualties linked to authenticated evidence. Target: 100% (definitional).
- **Authentication labeling:** % of pins/figures showing a tier. Target: 100%.
- **AI audit accuracy:** % of AI-assigned tiers upheld on human audit (and time-to-audit backlog).
- **Geolocation coverage:** % of evidence successfully placed on the map.
- **Freshness:** median age of newest confirmed evidence vs. latest available.
- **Reach:** monthly visitors (web), app installs and active users per store (iOS, Android, macOS), and citations from journalism and research.
- **Store health:** app-store ratings, crash-free session rate, and review pass/rejection rate per platform.
- **Accessibility:** automated and manual audit pass rate (WCAG on web; platform a11y on apps).

## 9. Sensitivities and Ethics

- Casualty data represents real human lives; tone and presentation must be respectful and non-sensational.
- "Confirmed" is a **lower bound**, not the truth — real casualties exceed what is verifiable. The UI must say so and never imply completeness or precision.
- **AI auto-tiering counts items before human review** — this is a deliberate speed/accuracy trade-off. It is mitigated by: a separable AI-corroborated tier, transparent display of the AI's basis, mandatory human audit, and logged corrections. The risk of false positives is disclosed to users.
- The project is neutral: same confirmation standard applied to both sides; no advocacy. The known data asymmetry between sides is shown, not papered over.
- We never launder a belligerent's claim about its enemy into a confirmation.
- X/OSINT evidence: graphic or identifying content is linked, not embedded; victims are treated with dignity.

## 10. Open Questions

- Per-tier confirmation bar and AI match-score thresholds are specified in **Appendix A**; v1 values there are the starting point to be tuned against real data.
- Best available confirmed military sources per side at launch (RU: Mediazona+BBC; UA: which — UALosses, memorials?), given the asymmetry.
- Human-audit staffing/cadence to keep the AI tiering + geolocation audit backlog manageable.
- Map provider / tile source and offline-degradation behavior.
- Multilingual support (Ukrainian, Russian, English) at launch?

## 11. Milestones (Proposed)

1. **M1 — Foundations:** Evidence data model (side, category, date, geolocation, authentication tier, links); confirmation bar per tier defined; ingestion for OHCHR civilians + one confirmed military source per side.
2. **M2 — View 1 Counter:** Date controller (default today), authentication-threshold slider with live recount, civilian-primary / military-secondary counts across all windows and categories, world-map background with linked pins.
3. **M3 — AI corroboration:** Internal-DB similar-post search (Claude Haiku 4.5, Opus 4.8 escalation), match scoring, provisional auto-tiering, AI-assisted auto-pin geolocation, human-audit queue, transparent display of corroboration on pins.
4. **M4 — View 2 Map:** Full-screen zoomable map, clustering, authentication/side/category/date filters, pin detail incl. AI corroboration.
5. **M5 — Promotional website:** Marketing site with live counter, methodology and about/funding pages, and store badges/links.
6. **M6 — Apps & store submission:** Package both views as native apps; submit to the Apple App Store (iOS/iPadOS), Google Play (Android), and Mac App Store (macOS), incl. content ratings, privacy labels, and store review.
7. **M7 — Polish & launch:** Accessibility audit (web + platform a11y), performance hardening, offline/last-known-good, coordinated public launch across all surfaces.

## 12. AI Cost Controls

The AI corroboration layer (§6.4) bills a model call per incoming post; left unbounded its cost scales with the OSINT firehose. Reference pricing (per 1M tokens): **Haiku 4.5 $1 in / $5 out; Opus 4.8 $5 in / $25 out** (5× Haiku). **Batch API −50%; prompt-cache reads ≈ 0.1× input (writes 1.25×).** Controls, highest-leverage first:

- **Embedding prefilter, not the LLM, for candidate retrieval.** A cheap vector search over the evidence DB returns the **top-K** similar items; Haiku (§6.4) only scores those K. This keeps token cost O(K), not O(DB), and is the single largest lever.
- **Cache the static rubric.** The Appendix A tier/score rubric and methodology prompt are identical across calls — send them as a cached prefix (≈0.1× input on the cached portion).
- **Batch, don't stream.** The smallest window is 24h, so corroboration is not latency-critical → run it through the Batch API (−50%).
- **Keep Opus rare and targeted.** Narrow the §A.3 escalation band, cap Opus calls/day against a budget, and **escalate only items that could cross the user's default headline threshold** (Official+Confirmed) — never pay 5× to adjudicate an item that will only ever appear as AI-corroborated on the map.
- **Triage before any LLM call.** Hash/near-duplicate drop, source allowlist, and rule-based junk filtering so the model never fires on obvious noise. The §A.3 dedup rule runs as a pre-LLM embedding check.
- **Idempotency.** Once an item is tiered, do not re-run corroboration unless *new contradicting* evidence arrives.
- **Hard budget guardrail (see §7).** A configurable monthly AI-spend cap with graceful degradation: when exceeded, new items queue as **unverified/pending** rather than calling the model. Per-item AI cost is tracked in observability and reported as a success metric.

---

## Appendix A — Confirmation Bar & Match-Score Thresholds

These are the **v1 starting values**. They are configurable (§7) and must be tuned against real data; every change is logged on the methodology page.

### A.1 Per-tier confirmation bar

A casualty is admitted to a tier only if it clears that tier's bar. Tiers are ordered strongest → weakest; an item is recorded at the **highest tier it qualifies for**.

| Tier | What it requires | Evidence granularity | Human review |
|------|------------------|----------------------|--------------|
| **Official** | Appears in a report from a recognized institution with a verification mandate (e.g. OHCHR, ICRC, a national ombudsman, court/registry records). The institution *is* the verification — a single authoritative report suffices. | Count- or individual-level | Not required (source is authoritative); spot-audited |
| **Confirmed** | A **named** individual, with **≥2 independent credible human sources**, *or* one source-of-record specializing in named-dead verification (e.g. Mediazona + BBC). Must carry identifying detail (name, or unit + date + place). Never based on a belligerent's claim about its enemy. | Individual-level (named) | Required |
| **OSINT** | **Geolocated** open-source media (photo/video) with a **confirmed location and date** from ≥1 credible open-source analyst, no credible contradiction. May be unnamed / event-level. | Event-level | Required before promotion above AI-corroborated |
| **AI-corroborated** | Assigned automatically by the AI (§6.4) when DB corroboration clears the thresholds in A.2 but the item has **not yet passed human audit**. Provisional; always separable. | Event- or individual-level | Pending (queued) |

Anything that clears none of the above is **not counted** — held as *unverified* and surfaced for human triage, never shown in the headline number.

### A.2 AI match score

For a new evidence post, the AI (Claude Haiku 4.5) compares it to existing DB evidence and computes a **match score `s` ∈ [0,1]** as a weighted blend of four dimensions:

| Dimension | What it compares | Weight |
|-----------|------------------|--------|
| **Where** | Location / geolocation overlap | 0.30 |
| **When** | Event date/time proximity | 0.25 |
| **What** | Event type & casualty details (side, category, count) | 0.25 |
| **Who** | Named/identifiable individual or unit (when present) | 0.20 |

It also tallies **corroborating** items (`c`) and **contradicting** items (`k`) among matches above a floor of `s ≥ 0.60`.

### A.3 Thresholds (auto-tiering, dedup, escalation)

Applied after scoring, in order:

1. **Duplicate / merge** — if a match has `s ≥ 0.90` on Where+When+What against an **already-counted** casualty, treat the new post as **additional evidence for that casualty**, not a new count. (Prevents inflation from many posts about one event.)
2. **OSINT (provisional)** — `s ≥ 0.85`, `c ≥ 2`, `k = 0`. Strong, mutually-consistent corroboration → tier **OSINT**, flagged for audit.
3. **AI-corroborated** — `0.70 ≤ s < 0.85` and `c ≥ 1` and `c > k`. → tier **AI-corroborated**, counts immediately if at/above the user's threshold, flagged for audit.
4. **Not counted** — `s < 0.70`, **or** `k ≥ c`. Held as *unverified* for human triage.
5. **Escalate to Claude Opus 4.8** whenever any of: a contradiction exists (`k ≥ 1`) that isn't clearly outweighed; `s` falls in the gray band **0.65–0.78**; cross-side attribution conflicts (same event claimed for both sides); a possible duplicate scores `0.85 ≤ s < 0.90`; or media is flagged graphic/sensitive. Opus adjudicates the final tier and its decision is logged.

### A.4 Geolocation confidence

AI auto-pinned locations (§6.4) carry their own confidence and **do not raise a casualty's authentication tier**. A low-confidence pin can still attach to a high-tier casualty; the pin is flagged for audit and the map shows placement uncertainty. Mis-pins are corrected in audit without changing the count.

### A.5 Worked example

**Incoming post (X/OSINT):** a video posted 2026-06-15 showing a destroyed Russian armored column near Vovchansk, captioned with ~6 KIA, geotagged to a road junction. Side: Russia. Category: Killed.

**Step 1 — Score against the evidence DB.** The AI (Haiku 4.5) finds three prior DB items about the same strike:

| DB match | Where | When | What | Who | Weighted `s` |
|----------|-------|------|------|-----|--------------|
| News report, same junction, 2026-06-15 | 0.95 | 0.90 | 0.80 | 0.20 | **0.74** |
| Second X video, different angle, same day | 0.90 | 0.85 | 0.85 | 0.10 | **0.71** |
| Unrelated post, Kupiansk, 2026-06-13 | 0.20 | 0.40 | 0.50 | 0.00 | **0.30** |

Weighted `s` uses Where 0.30 / When 0.25 / What 0.25 / Who 0.20 (e.g. row 1: `0.30·0.95 + 0.25·0.90 + 0.25·0.80 + 0.20·0.20 = 0.74`).

**Step 2 — Tally above the `s ≥ 0.60` floor.** Two matches qualify (0.74, 0.71); both corroborate, none contradict → `c = 2`, `k = 0`. The 0.30 item is ignored.

**Step 3 — Apply thresholds (A.3) in order:**
- **Dedup?** No match reaches `s ≥ 0.90` against an *already-counted* casualty (the two corroborators are uncounted evidence, not counted casualties), so this is a new count — not a merge.
- **OSINT?** Requires `s ≥ 0.85`. Top `s` is 0.74 → fails.
- **AI-corroborated?** `0.70 ≤ s < 0.85` (0.74 ✓), `c ≥ 1` (2 ✓), `c > k` (2 > 0 ✓) → **assigned AI-corroborated.**
- **Escalate?** No contradiction; top `s` 0.74 sits just below the 0.65–0.78 gray band's upper edge → it *does* fall in 0.65–0.78, so this case **escalates to Opus 4.8** for adjudication. Opus reviews the two corroborators, confirms it isn't a duplicate of an already-counted strike, and upholds **AI-corroborated**.

**Step 4 — Count & display.** The 6 KIA are attributed to **Russia / Killed / 2026-06-15**, tier **AI-corroborated**. They count toward the headline only if the user's threshold (§5.1) includes AI-corroborated; under the default strict bar (Official + Confirmed) they appear on the map but not in the headline number. The AI auto-pins the road junction (flagged for geolocation audit), and the pin shows the match score, the two corroborating items, and "pending human audit."

**Later audit.** A reviewer finds the named-dead source-of-record never lists these individuals (event-level only, no names) → the item stays at **OSINT** after the human confirms geolocation, *not* promoted to Confirmed. The decision and reasoning are logged.
