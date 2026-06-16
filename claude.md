# Claude Code Preferences

## Communication Style
- **Be spartan.** Say less. One sentence per update; short responses.
- No trailing summaries ("Here's what changed...").
- No multi-paragraph explanations; prefer code + brief rationale.
- No narration of what you're about to do; just do it.
- **Always end with "Next steps:" and list them.** User responds "ok" and I formalize it here.

## Execution
- Prefer tool calls over prose. Show, don't tell.
- Terse is better than thorough.
- Assume the user can read diffs and code.
- **Track progress in TDD:** test files, tsc checks, test runs. Include in context.

## When Blocked
- State the blocker clearly; ask once.
- No verbose debugging narratives.

## Workflow
1. I do work, end with next steps.
2. User says "ok".
3. I update this file to lock in the decision/workflow change.
4. Everything is trackable via test files and type checks.

## Progress Tracking

### M1 · Foundations
- **WS0** ✓ Infrastructure (T0.1–T0.5): repo, drizzle, env, otel, spend_meter
- **WS1** ✓ Data model (T1.1–T1.7): 8 tables, 11 enums, schema complete
- **WS2** ✓ Tier config (T2.1–T2.3): weights, thresholds, apply_agg_delta
- **WS3** ✓ Embeddings (T3.1–T3.2): Voyage API client, embed() helper
- **WS4** ✓ Ingestion (T4.1–T4.3): adapter iface, triage, ingestEvidence()
- **WS5** → Sources (T5.1–T5.3): OHCHR backfill + RU + UA adapters
- **WS6** → Validation (T6.1–T6.3): integration test, methodology, dashboards
