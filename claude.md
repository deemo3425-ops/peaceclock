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

### M1 · Foundations — COMPLETE ✓
- **WS0** ✓ Infrastructure (repo, drizzle, env, otel, spend_meter)
- **WS1** ✓ Data model (8 tables, 11 enums)
- **WS2** ✓ Tier config (weights, thresholds, apply_agg_delta)
- **WS3** ✓ Embeddings (Voyage API client)
- **WS4** ✓ Ingestion framework (adapter iface, triage, ingestEvidence())
- **WS5** ✓ Source adapters (OHCHR, RU, UA stubs)
- **WS6** ✓ Validation (integration test, methodology page, metrics skeleton)

**M1 Completed: 18 commits, 6 workstreams, tsc ✓, E2E fixtures green.**

Next: M2 (counter / View 1).
