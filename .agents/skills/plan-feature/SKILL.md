# plan-feature

Drafts a file-by-file implementation plan for a feature, then delegates to staff-engineer for audit (plus ai-engineer when the plan touches the AI stack).

Requires research output (options + recommendation) from research-feature. Read AGENTS.md before starting.

## Phase 1 — Draft Plan

Write a plan with these sections:

### Summary
One paragraph describing what will be built and why.

### Design Decisions
Bullet list of key decisions made (data model choices, API shape, component structure). Each decision gets one sentence of rationale.

### File-by-File Changes
For each file: path, whether new or modified, one-sentence description of what changes and why.
Group by layer: packages first, then api, then web.

### Test Strategy
List P0 test cases (auth guard, service logic, Zod schemas, critical UI behaviour).
Note: tests are written in a separate agent pass via generate-test.

### Risks
List 2–4 things that could go wrong during implementation. For each: risk description + mitigation.

## Phase 2 — Staff Engineer Audit

Delegate to staff-engineer agent (Mode B):
- Provide the full plan
- Provide AGENTS.md Golden Principles as context

Apply the staff-engineer's edits to the plan.

## Phase 2b — AI Engineer Audit (conditional)

Only when the plan touches the AI stack (prompts, message-history assembly,
model selection, `apps/api/src/ai/`, retrieval/embeddings), delegate to the
ai-engineer agent (Mode A):
- Provide the AI-relevant sections of the plan
- The agent audits for token efficiency, output quality, and latency, and
  names the trade-offs

Apply the ai-engineer's edits to the plan. Skip this phase entirely for plans
that don't touch the AI stack.

## Phase 3 — Present

Show the final audited plan to the user. Ask: "Ready to build? Run /build-plan to implement this plan."
