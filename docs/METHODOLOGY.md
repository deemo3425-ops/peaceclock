# PeaceClock — Methodology

**Date:** 2026-06-16  
**Companion:** [PRD.md](./PRD.md) (product overview), [EDD.md](./EDD.md) (engineering design).

---

## Tier Definitions

PeaceClock categorizes casualty evidence into four authentication tiers, ordered by confidence:

| Tier | Definition | Examples | Admission |
|---|---|---|---|
| **Official** | Direct government or OHCHR reports | OHCHR press releases, military casualty releases | Source allowlist + triage |
| **Confirmed** | Named-dead records from reputable sources | Mediazona (RU), Ukrainian memorials (UA) | Named individual + documentary evidence |
| **OSINT** | Cross-corroborated reports with ≥2 sources | Independent verification of event + side match | Match score ≥0.85, 2+ corroborators, 0 contradictions |
| **AI-corroborated** | Provisional tier assigned by Claude | Event passes semantic matching but lacks full confirmation | Match score 0.70–0.85, 1+ corroborators, no contradictions |

Tiers are strictly ordered: official ⊃ confirmed ⊃ OSINT ⊃ AI. The public headline defaults to Official + Confirmed (PRD §3).

### Sub-dimension weights (AI scoring)

Each match-score sub-dimension [0, 1] is weighted per Appendix A.2:

- **Where (30%)**: geographic accuracy — does the location match?
- **When (25%)**: temporal accuracy — is the date/timeline consistent?
- **What (25%)**: event type/count — does the casualty type/count align?
- **Who (20%)**: identity/affiliation — are the named individuals and side attribution consistent?

Composite score: `s = 0.30·where + 0.25·when + 0.25·what + 0.20·who`

---

## Source Coverage

### Ukraine coalition

| Category | Source | Type | Coverage |
|---|---|---|---|
| Civilian | OHCHR reports | Official | 2022-02-24 → present |
| Military | *[Source TBD — M1 carry-over]* | Confirmed | Pending decision (PRD §10) |

### Russia

| Category | Source | Type | Coverage |
|---|---|---|---|
| Military | Mediazona (named-dead) | Confirmed | Ongoing; backfilled to earliest available |
| Military | BBC Monitoring | Confirmed | Ongoing; spot-checks for corroboration |

### Coverage asymmetry

**Important:** Russia's confirmed casualties are based on named-individual lists (Mediazona + BBC); Ukraine's are pending a source decision (PRD §10). Until the UA source is chosen and backfilled, the public headline will show Official + Confirmed counts with **asymmetry between sides** that reflects source availability, not casualty reality.

---

## Data Quality & Audit

1. **Deduplication:** Identical entries are detected by content hash and rejected at ingest (triage layer, EDD §7).

2. **AI audit:** All AI-assigned tiers are logged (EDD §5.4) and subject to human review in a priority queue (EDD §8).

3. **Tier correction:** Human audit can promote, demote, or reject any tier; corrections are applied via the aggregate delta function (EDD §6) and logged immutably.

4. **Idempotency:** Re-running ingestion for the same source data yields no change; the watermark tracks fetch progress.

---

## Enemy-claim exclusion rule

Per PRD §6.2: **casualty claims made by a belligerent about itself are excluded from confirmation**. For example, a Ukrainian government statement about Ukrainian casualties is stored (for context) but not used to confirm counts in the counter. This prevents self-interested inflation while maintaining an evidence record.

---

## References

- **PRD §A — Confirmation bar & match-score thresholds:** [PRD.md](./PRD.md#appendix-a-confirmation-bar--match-score-thresholds)
- **EDD §6 — Count engine & aggregation:** [EDD.md](./EDD.md#6-the-as-of--windowed-count-engine)
- **EDD §8 — AI corroboration pipeline:** [EDD.md](./EDD.md#8-ai-corroboration-pipeline)
