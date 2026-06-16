# PeaceClock — M3 (AI Corroboration) Task Breakdown

**Milestone:** M3 — AI corroboration (PRD §6.4, Appendix A, §12; EDD §8, §8.1)
**Depends on:** M1 complete — schema (`evidence`, `casualty`, `corro_batch`, `spend_meter`, `map_point`, `audit_log`), embeddings, `tiering.config`, `apply_agg_delta`, `daily_agg` ([tasks.md](./tasks.md)). M2's `/api/evidence` is extended here (not required to start).
**Goal:** Stand up the batch corroboration pipeline that turns ingested OSINT/news evidence into tiered, geolocated, audited casualty rows — Haiku 4.5 scoring with rare Opus 4.8 escalation, the §A.3 threshold ladder in code, AI auto-pin geolocation, a human-audit queue, and the §12 budget guardrail. This is the highest-risk milestone (weight 22%).

**Exit criteria for M3**
- The worker (EDD §8.1) ingests `pending` evidence → embeds → prefilters top-K → Haiku-scores (Batch) → applies §A.3 → writes tiered casualties + geo + audit + `daily_agg` deltas → escalates the rare case to Opus.
- The §A.5 worked example passes end-to-end (s≈0.74 → AI-corroborated, gray-band escalation upheld).
- AI tiering and geolocation **count immediately** but land in the **human-audit queue**; audits promote/demote/reposition/reject with full `audit_log` and aggregate correction.
- The budget guardrail caps monthly spend and degrades to `unverified` (no model call) when exceeded.
- The pipeline is **resumable and idempotent** across crashes and re-delivered batch results.
- `/api/evidence/:id` exposes the corroboration basis (corroborating posts, match score, contradictions).

> **Cost discipline is a hard requirement, not a nice-to-have** (PRD §12): embedding prefilter (not the LLM) for candidates; cached rubric prefix (~0.1× input); Batch API (−50%); Opus only when it could cross the default headline threshold, daily-capped. Every task that calls a model records its cost.

Legend — size: S ≤0.5d, M ~1–2d, L ~3–5d. Each task lists **deps** and **acceptance**.

---

## WS0 — Candidate retrieval & dedup (prefilter) — EDD §8.1 Tick B

- **T0.1 — Top-K candidate query** (M) — deps: M1·T3.2
  Implement the pgvector top-K retrieval (cosine `<=>`, distance floor ≈ sim ≥ 0.60, `LIMIT K≈20`) returning candidate text + metadata for one new evidence item.
  *Acceptance:* on a seeded fixture, returns the expected neighbors ordered by similarity within latency budget; floor excludes unrelated items.

- **T0.2 — Dedup/merge detection** (M) — deps: T0.1
  Implement §A.3 rule 1: a candidate with `s ≥ 0.90` against an **already-counted canonical casualty** → mark the new evidence for **merge** (attach as evidence, `is_canonical=false`, no new count) rather than a new casualty.
  *Acceptance:* duplicate-event fixture produces one canonical casualty + N attached evidence, **not** N casualties; aggregates unchanged by the merge.

---

## WS1 — Haiku scoring (Batch API) — EDD §8.1 Tick B/C

- **T1.1 — Assessment output schema** (S) — deps: M1·T2.1
  Define `ASSESSMENT_SCHEMA` (structured output): per-candidate `{where,when,what,who ∈[0,1], relation: corroborates|contradicts|unrelated}` + `geo:{lat,lng,confidence}|null`. Model returns sub-scores; the worker computes `s`.
  *Acceptance:* schema validates; a sample model response parses; weights live in code, not the prompt.

- **T1.2 — Cached rubric prefix** (S) — deps: T1.1
  Assemble the Haiku request: A.1/A.2 rubric as a **cached system prefix** (`cache_control: ephemeral`); per-request user content = the new post + its K candidates.
  *Acceptance:* repeated batch requests show `cache_read_input_tokens > 0` for the rubric; per-request payload contains only the variable part.

- **T1.3 — Batch submit / poll / parse** (M) — deps: T1.2, M1·T1.7
  Submit Haiku requests via the **Batch API** (`claude-haiku-4-5`), one `custom_id` per evidence id; record `corro_batch`; poll `processing_status`; stream results; parse to `ASSESSMENT_SCHEMA`; handle per-item `errored`/`expired` → `unverified`.
  *Acceptance:* a multi-item batch round-trips end-to-end (mocked + one live smoke); failed items don't block the batch; batch usage cost recorded (WS6).

- **T1.4 — Deterministic s/c/k** (S) — deps: T1.1
  Compute `s = .30·where + .25·when + .25·what + .20·who` per candidate; `c`/`k` = corroborating/contradicting counts above the `s ≥ 0.60` floor; `top = max s`.
  *Acceptance:* unit tests pinned to the §A.5 numbers (row1 s=0.74, c=2, k=0).

---

## WS2 — Threshold ladder (in code) — EDD §8.1, PRD §A.3

- **T2.1 — `applyThresholds`** (M) — deps: T1.4, M1·T2.1, T0.2
  Implement the §A.3 ladder in order: dedup/merge → OSINT (`s≥0.85,c≥2,k=0`) → AI-corroborated (`0.70≤s<0.85,c≥1,c>k`) → `escalate` (gray band / contradiction / near-dup / sensitive) → `unverified`. Returns a tagged decision.
  *Acceptance:* property tests over random `(s,c,k)` match a reference table; §A.5 case returns `ai_corroborated` + `escalate` flag (gray band 0.74 ∈ 0.65–0.78).

- **T2.2 — Escalation flagging** (S) — deps: T2.1
  Encode the rule-5 triggers (contradiction `k≥1` not clearly outweighed; `s∈0.65–0.78`; cross-side attribution conflict; near-dup `0.85≤s<0.90`; sensitive media) → mark for Opus queue (WS4).
  *Acceptance:* each trigger independently routes to `escalate`; non-triggers do not.

---

## WS3 — Worker state machine — EDD §8.1

- **T3.1 — Status model + claiming** (M) — deps: M1·T1.2
  `corro_status` transitions (`pending→embedding→scoring→scored→escalating→done|unverified`); claim with `FOR UPDATE SKIP LOCKED`; Vercel Cron entrypoint.
  *Acceptance:* two concurrent ticks never double-claim an item (integration test with parallel runners).

- **T3.2 — Tick orchestration** (M) — deps: T3.1, WS0, WS1
  Each cron tick advances ready stages: A embed → B prefilter+submit Haiku batch → C poll+process → D Opus. Stateless across ticks; persists progress in DB.
  *Acceptance:* a full item traverses A→done across multiple simulated ticks; partial progress survives a tick boundary.

- **T3.3 — Resumability & idempotency** (M) — deps: T3.2
  Crashed tick leaves a batch `submitted`/`ended`; next tick resumes. Re-delivered result for a `done` item is a no-op. Re-score only when **new contradicting** evidence links to a dedup group.
  *Acceptance:* kill-mid-batch test resumes cleanly; replaying a results stream produces no duplicate casualties/aggregates.

---

## WS4 — Opus escalation (gated) — EDD §8.1 Tick D, PRD §12

- **T4.1 — Escalation gate + daily cap** (M) — deps: T2.2
  Filter `escalate` items to those that **could cross the default headline threshold** (Official+Confirmed); enforce a configurable **daily Opus cap**; items below the bar stay `ai_corroborated` (map-only) without Opus.
  *Acceptance:* only headline-impacting items enqueue for Opus; cap halts further Opus submissions that day; below-bar items finalize without a 5× call.

- **T4.2 — Opus adjudication batch** (M) — deps: T4.1, T1.3
  Submit gated items to `claude-opus-4-8` (Batch) with candidates + contradictions; structured-output final tier; write via WS5; `audit_log.actor='ai_opus'`.
  *Acceptance:* §A.5 escalation resolves to `ai_corroborated` (upheld); decision + reason + cost logged.

---

## WS5 — writeOutcome, geolocation & aggregates — EDD §8.1

- **T5.1 — Transactional `writeOutcome`** (L) — deps: T2.1, M1·T2.2
  One transaction: upsert `casualty` (side/category/audience/event_date/tier/count/dedup_group/is_canonical) → append `casualty_evidence` → set evidence geo → `apply_agg_delta(+count)` → `audit_log` (actor/before/after/reason/cost) → `spend_meter +=`.
  *Acceptance:* a created casualty, its evidence link, its aggregate cell, and its audit row are all present or all absent (atomicity test); tier change applies `−old/+new` deltas correctly.

- **T5.2 — AI geolocation auto-pin** (M) — deps: T1.1, T5.1
  Persist the model's proposed coords → `evidence.geom`, `geo_confidence`, `geo_status='ai_auto'`, flagged for audit; populate/refresh `map_point` (canonical casualty → best-geo evidence, `geom_3857`).
  *Acceptance:* auto-pinned evidence appears in `map_point` with correct `geom_3857`; geo confidence never alters `tier` (PRD §A.4) — asserted.

- **T5.3 — Aggregate consistency under change** (M) — deps: T5.1, M1·T2.3
  Ensure tier promotions/demotions and merges keep `daily_agg` + prefix sums correct; reconcile against a from-scratch recount.
  *Acceptance:* random sequences of create/promote/demote/merge leave aggregates equal to a full rebuild (property test).

---

## WS6 — Budget guardrail & cost — PRD §12

- **T6.1 — Pre-submit budget gate** (M) — deps: M1·T0.5, T1.3
  Before each batch, check `spend_meter` month-to-date vs cap; over cap → claimed items set `unverified` (queued), no model call; alert emitted.
  *Acceptance:* with cap forced low, new items land `unverified` and **no** batch is submitted; alert fires; counts unaffected.

- **T6.2 — Cost accounting** (S) — deps: T1.3, T4.2, T5.1
  Attribute batch usage (Haiku + Opus + embeddings) to per-item `audit_log.model_cost_usd` and increment `spend_meter`.
  *Acceptance:* summed `model_cost_usd` reconciles with batch usage reports within tolerance.

- **T6.3 — Cost & pipeline metrics** (S) — deps: T6.2
  Emit cost/item, monthly spend vs cap, escalation rate, items/stage. (PRD §8 AI metrics.)
  *Acceptance:* dashboard shows the series; escalation rate visible.

---

## WS7 — Human audit queue — PRD §6.4, §8

- **T7.1 — Audit queue view** (M) — deps: T5.1
  A queue over `casualty` where `tier='ai_corroborated'` (and AI-geo `geo_status='ai_auto'`), ordered by recency/headline impact; shows the corroboration basis.
  *Acceptance:* queue lists AI-assigned items with their evidence, score, contradictions; ordering by impact verified.

- **T7.2 — Audit actions** (M) — deps: T7.1, T5.1
  Promote / demote / reposition (geo fix) / reject → write `audit_log` (actor='human'), re-apply `apply_agg_delta`, update `map_point`.
  *Acceptance:* each action updates tier/geo, logs before/after, and corrects aggregates; rejection removes the count and its aggregate contribution.

- **T7.3 — Re-score trigger** (S) — deps: T3.3, T0.1
  New contradicting evidence linking to a dedup group reopens just that group for re-scoring.
  *Acceptance:* injecting a contradiction re-queues the affected casualty only; unrelated items untouched.

- **T7.4 — AI audit-accuracy metric** (S) — deps: T7.2
  Track % of AI-assigned tiers upheld on human audit + time-to-audit backlog (PRD §8 success metric).
  *Acceptance:* metric computes from `audit_log` (ai_* vs human action); backlog age series visible.

---

## WS8 — Corroboration transparency API — PRD §6.4

- **T8.1 — Extend `/api/evidence/:id`** (M) — deps: M2·T2.1, T5.1
  Add the corroboration basis to evidence detail: corroborating posts, `match_score`, contradicting evidence, tier, and (for AI-geo) placement uncertainty. Feeds View 2 pin detail in M4.
  *Acceptance:* an AI-corroborated item returns its corroborators + score + contradictions; non-graphic (links only, PRD §9).

---

## WS9 — Validation

- **T9.1 — §A.5 worked-example E2E** (M) — deps: WS1–WS5
  Encode the Appendix A.5 scenario (Vovchansk RU column, 3 DB matches) as a fixture: scoring → tally → ladder → gray-band escalation → Opus upholds AI-corroborated → counted + auto-pinned + queued.
  *Acceptance:* the end-to-end trace matches §A.5 step for step.

- **T9.2 — Idempotency / recovery suite** (M) — deps: T3.3, T5.1
  Crash mid-batch, re-delivered results, duplicate ingestion → no duplicate casualties/aggregates.
  *Acceptance:* all recovery scenarios green; aggregates equal a full rebuild after chaos.

- **T9.3 — Budget-degradation test** (S) — deps: T6.1
  Cap exceeded mid-run → remainder queues `unverified`, counts and prior items intact, recovery on cap reset.
  *Acceptance:* degradation + recovery proven; no overspend.

---

## Critical path & sequencing

```
M1 done ─┬─ T0.1→T0.2
         ├─ T1.1→T1.2→T1.3 ; T1.4
         └─ T2.1→T2.2
T1.4+T2.1 → T5.1 → T5.2 ; T5.3
T2.2 → T4.1→T4.2
T3.1→T3.2→T3.3   (wraps WS0/WS1/WS4 into ticks)
T5.1 → T7.1→T7.2→T7.3 ; T7.4
T6.1 ; T6.2→T6.3
T5.1 → T8.1
→ T9.1, T9.2, T9.3
```

**Long poles:** `writeOutcome` (T5.1 — transactional correctness across casualty+geo+agg+audit+cost) and the worker state machine (WS3 — resumability). Land and lock these before scaling volume; everything downstream trusts their invariants.

## Open decisions / carry-overs
- **Match-score thresholds are v1 starting values** (PRD §A, §14) — instrument T2.1 so the constants are tunable against real audit outcomes (T7.4) without redeploy.
- **Opus daily cap value** (T4.1) and the monthly budget cap (T6.1) — set initial numbers from an estimated OSINT volume; revisit once real throughput is measured.
- **Audit staffing/cadence** (PRD §10) — the queue (WS7) assumes human reviewers; confirm capacity so the backlog metric (T7.4) stays healthy.
- **Multilingual scoring** — Haiku on UA/RU source text; validate corroboration quality on Cyrillic posts (ties to the embedding-model question, EDD §14).
