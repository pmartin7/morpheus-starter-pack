---
name: debug
description: Hypothesis-driven bug diagnosis. Reproduces the bug, explores the failing
  code paths, generates root-cause hypotheses with evidence, and delegates to
  the root-cause-analyst agent for validation and a scored fix recommendation.
  Use when diagnosing bugs, investigating unexpected behaviour, or triaging
  defects.
---

# debug

Hypothesis-driven bug diagnosis workflow. Reproduces the bug, generates hypotheses, delegates to root-cause-analyst for root cause analysis.

Read AGENTS.md before starting.

## Phase 1 — Understand

Ask the user:

1. What is the bug? (observed behaviour vs expected behaviour)
2. Steps to reproduce
3. When did it start? (after what change, if known)
4. Any error messages or stack traces?

## Phase 2 — Reproduce

Start dev server (`pnpm dev`) and use browser tools to reproduce the bug.
Capture: error messages, network requests, console output, visual state.

If the bug cannot be reproduced, ask for more context before proceeding.

## Phase 3 — Explore Code Paths

Read the files involved in the failing path:

- The relevant controller/route
- The relevant service
- Any guards or pipes in the path
- The relevant frontend component and hooks

Goal: understand what the code actually does vs what it should do.

## Phase 4 — Generate Hypotheses

Write 2–4 hypotheses about the root cause. For each:

- One sentence: "The bug is caused by X"
- Evidence for: what in the code supports this hypothesis
- Evidence against: what in the code contradicts this hypothesis

## Phase 5 — Root Cause Review

Delegate to root-cause-analyst agent:

- Provide bug description + reproduction steps
- Provide hypotheses with evidence
- Provide file paths and relevant code excerpts
- Reference `.agents/skills/debug/references/rubric.md`

Present the analyst's root cause analysis and proposed fix to the user.
