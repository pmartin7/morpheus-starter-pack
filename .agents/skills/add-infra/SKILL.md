---
name: add-infra
description: Adds a new piece of the infrastructure stack — mobile app, queue, cache,
  search, ingestion, a new deploy target — by evaluating options, then building the
  harness and the documentation before the implementation. Use when the request adds
  a runtime, an external service, or a deploy target rather than a feature inside the
  existing stack.
---

# add-infra

Adds a new piece of the stack in the order that keeps it observable: options →
harness → docs → build. Enforces Operating Principle "harness before infra".

Read AGENTS.md and ARCHITECTURE.md before starting.

## Phase 1 — Classify

This skill applies when the request adds any of:

- a new runtime or app (mobile app, worker, cron, background job)
- a new external service (queue, cache, search index, blob store, mail provider)
- a new deploy target or pipeline

If the request is a feature _inside_ the existing stack, stop and use
`/scope-feature` instead. Say which you concluded and why.

## Phase 2 — Evaluate Options

Produce 2–3 meaningfully different options. Score each on the usual rubric
(`.agents/skills/scope-feature/references/rubric.md`) plus four operational
criteria that decide whether a fork can live with it:

1. **Local dev story** — can it run on a laptop without cloud credentials? An
   emulator or container beats a shared staging environment.
2. **Agent legibility** — can a script assert it works and produce an artifact
   (exit code, screenshot, log line)? If not, the option is worse than it looks.
3. **Operational surface** — new secrets, new dashboards, new failure modes.
4. **Cost and lock-in** at prototype scale.

Delegate to the staff-engineer agent (Mode A) for the recommendation. Present it
and get the user's choice before continuing.

## Phase 3 — Harness First (the gate)

Before any implementation code, write `harness/validate-<subsystem>.mjs` following
the conventions of the existing harnesses:

- PASS/FAIL per check, each failure followed by a one-line `hint:` with the fix
- exit `0` pass, `1` validation failure, `2` harness could not run
- an artifact where one is meaningful (screenshot, response body, log excerpt)
- reuse `harness/lib/browser.mjs` for anything that drives a browser

Add a `validate:<subsystem>` script to the root `package.json`.

**Prove it red.** Run it before the subsystem exists and confirm it FAILS with a
useful message. A harness nobody has watched fail is not evidence — it is
decoration. Paste the failing output into your report.

## Phase 4 — Document Before Building

Write the docs while the design is still a decision rather than a memory:

- `ARCHITECTURE.md`: topology block, route/screen map, data flow, and any new Key
  Invariant the subsystem imposes
- `.env.example`: every new variable, with a comment on where to obtain it
- `docs/<SUBSYSTEM>.md` only when there is a non-obvious operational story
  (emulators, credentials, release pipeline). Do not restate what ARCHITECTURE.md
  already says — see the anti-pattern on duplicated docs.
- `.agents/skills/validate-app/SKILL.md`: add the new command to the table

## Phase 5 — Build Until Green

Implement the smallest version that turns the harness green. The harness is the
definition of done, not a formality afterwards.

## Phase 6 — Wire In

- add the harness to CI if it can run without secrets
- run `pnpm check` and `pnpm docs:check`
- report: the option chosen and why, the harness failing before and passing after,
  and the docs written

## Example — "add a mobile app"

Phase 2 weighs Expo managed vs bare React Native vs PWA, and Expo wins largely on
criteria 1 and 2: EAS plus a dev client can boot in CI and be driven headlessly.
Phase 3 writes a harness that boots the app and asserts the first screen renders
before `apps/mobile` exists. Phase 4 fills in the Screen Map and the EAS release
story. Only then does Phase 5 scaffold the app.
