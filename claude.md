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
