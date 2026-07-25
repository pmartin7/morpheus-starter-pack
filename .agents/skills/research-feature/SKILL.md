# research-feature

Read-only research workflow. Produces 2–3 implementation options for a feature, then delegates to staff-engineer for evaluation.

Read AGENTS.md before starting.

## Phase 1 — Understand

Ask the user:

1. What is the feature? (one sentence)
2. Who uses it? (user type, entry point)
3. Any constraints? (deadline, tech restrictions, performance requirements)
4. Any existing patterns to follow?

Do not proceed until the feature is unambiguous.

## Phase 2 — Explore

Read in order:

1. ARCHITECTURE.md — understand current routes, entities, data flow
2. docs/STYLE_GUIDE.md — understand conventions
3. Scan relevant existing code files (controllers, services, entities related to the feature area)

Goal: understand what already exists that the feature can build on.

## Phase 3 — Simplify the Spec

Challenge the feature scope:

- Can this be done with existing primitives?
- What is the minimum viable version?
- What parts are YAGNI?

Write a simplified spec (2–4 sentences) that captures the minimum complete feature.

## Phase 4 — Generate Options

Produce 2–3 implementation options. For each option:

- Name and one-sentence summary
- Key design decision it represents
- Files added/modified (list)
- Tradeoffs (2–3 bullet points)

Options should represent meaningfully different approaches (not just naming variations).

## Phase 5 — Staff Engineer Review

Delegate to staff-engineer agent (Mode A):

- Provide the simplified spec
- Provide all options
- Provide the path to the relevant evaluation-criteria.md file: `.agents/skills/research-feature/references/evaluation-criteria.md`

Present the staff-engineer's recommendation to the user with a short explanation.
