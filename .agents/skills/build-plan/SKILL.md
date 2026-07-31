---
name: build-plan
description: Implements a completed feature plan in dependency order using parallel
  subagents, validates with pnpm check, and runtime-verifies in the browser.
  Use when a plan from plan-feature is approved and ready to build.
---

# build-plan

Implements a feature plan using parallel subagents, validates, and runtime-verifies.

Requires a completed plan from plan-feature. Read AGENTS.md and the plan before starting.

## Phase 1 — Orient

Read:

1. The feature plan
2. ARCHITECTURE.md
3. docs/STYLE_GUIDE.md
4. Any existing files the plan says to modify

Do not read files not referenced by the plan.

## Phase 2 — Implement

Implement in dependency order using parallel subagents where possible:

1. **packages layer first** — any changes to packages/shared (Zod schemas, types)
2. **api and web in parallel** — once packages are done, implement api changes and web changes simultaneously using two subagents

Each subagent receives:

- Its specific file list from the plan
- Relevant excerpts from AGENTS.md (Golden Principles, conventions)
- Relevant excerpts from docs/STYLE_GUIDE.md
- The Zod schemas from packages/shared it needs to use

## Phase 3 — Validate

Run from repo root:

```bash
pnpm check
```

If errors: fix and rerun once. If errors remain after one fix pass, report them and stop.

## Phase 3b — AI Engineer Review (conditional)

Only when the implementation changed AI-stack files (prompts, message-history
assembly, model selection, `apps/api/src/ai/`, retrieval/embeddings), delegate
to the ai-engineer agent (Mode B):

- Provide the paths of the changed AI-stack files
- The agent scores them against its best-practices checklist (token
  efficiency, quality, latency) and returns minimal diffs for failures

Apply the diffs you agree with, rerun `pnpm check`, and note any recommendation
you rejected and why. Skip this phase entirely when no AI-stack files changed.

## Phase 4 — Runtime Verify

Start dev server:

```bash
pnpm dev
```

Use browser tools to:

1. Navigate to the affected route(s)
2. Verify the feature works as specified
3. Check for console errors

Then run `pnpm validate:local` rather than trusting terminal output, and open the
screenshots in `harness/artifacts/`. A passing exit code proves the page rendered
something, not that it rendered the right thing.

Report what was verified and any issues found.

## Phase 5 — Update Docs

Not optional, and not a follow-up task. Work the Documentation Impact section of
the plan, then confirm nothing drifted:

```bash
pnpm docs:check
```

At minimum, reconcile `ARCHITECTURE.md` with what you built: Route Map for new
routes or guards, Entity Model for new entities or fields, Data Flow for changed
flows, Key Invariants for any rule future code must obey.

Record the invariants you discovered while building — the non-obvious constraint
that cost you an hour is the highest-value sentence in the whole change. See
`.agents/rules/documentation-currency.mdc`.
