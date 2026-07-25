---
name: write-tests
description: Independent P0 test writing. A separate agent that did not implement the
  feature writes behaviour-focused tests, runs them, and triages failures as
  implementation bugs or test bugs. Use when adding test coverage after a
  feature is implemented or when a plan calls for a test pass.
---

# write-tests

Independent P0 test writing. A separate agent (who did not implement the feature) writes the tests to avoid "code shaped to satisfy tests."

Read AGENTS.md and docs/TESTING.md before starting.

## Phase 1 — Scope

Ask the user (or read the plan if plan-driven):

1. Which files need tests? (list paths)
2. Is this interactive (user-driven) or plan-driven (tests specified in plan)?
3. Any specific behaviours that must be covered?

## Phase 2 — Delegate to Tester Subagent

Launch a subagent that:

- Has NOT seen the implementation (do not pass implementation context)
- Receives: file paths to test, AGENTS.md Golden Principles, docs/TESTING.md conventions
- Writes tests following AAA pattern, mocking at boundaries only
- Uses vitest + @nestjs/testing for API, vitest + @testing-library/react for web

The subagent writes test files colocated with source (`*.test.ts` / `*.test.tsx`).

## Phase 3 — Run and Triage

Run tests:

```bash
pnpm test
```

For each failure, determine:

- **Bug in implementation**: report to user, do not fix (that is the debug skill's job)
- **Bug in test**: fix the test

## Phase 4 — Report

Present:

1. Tests written (file paths + count)
2. Tests passing
3. Any bugs found in implementation (do not fix — report only)
