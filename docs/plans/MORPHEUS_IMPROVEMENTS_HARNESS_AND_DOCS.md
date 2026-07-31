# Improvement Plan: Harness-First, Docs-Current, and an Auth Scaffold That Matches the API

**Origin.** Written from `yagyu.app`, a Morpheus fork, after a bug-fix series on the
Firebase email-verification flow. Every item below is a gap the fork discovered at
runtime rather than at review time. The fixes for WI-2 and WI-3 are already
implemented and proven in that fork; their code is inlined here verbatim so this
plan can be executed without access to it.

**How to use this plan.** Work items are independent and each ends with acceptance
criteria. You can stop after any one of them and leave the repo consistent. Read
`AGENTS.md` first. Suggested order is at the bottom — it is not the numeric order.

**Validation for every item.** `pnpm check` before reporting done, `pnpm validate`
if you touched tests, `pnpm format` if you created or edited files without
committing. Do not skip validation because a change "looks small".

---

## WI-1 — Golden principle: build the harness before the infrastructure

### Why

The pack's thesis is that agents can only iterate on what they can observe, and it
delivers on that for the web app: `harness/validate-local.mjs` means an agent can
prove a route renders. Nothing in the workflow _requires_ that property of anything
added later. A fork that adds a mobile app, a queue, email ingestion, or a cache
gets a subsystem no agent can observe, and from that point on every change to it is
a guess reported as a success.

The pack already shows the asymmetry: the web app has a harness, the API has none,
and so nothing in the repo can tell an agent whether the API actually serves a
request. WI-5 is a concrete instance of the same failure — auth shipped without the
harness that would observe it, and a fork paid for that with a shipped bug.

### Changes

**1. `AGENTS.md` → `## Operating Principles`** — add:

```markdown
- **Harness before infra.** Before adding a new piece of the stack (mobile app,
  queue, cache, search, ingestion), evaluate the options, then build the harness
  that proves it works and the doc that explains it — then build the thing. An
  agent cannot iterate on what it cannot observe, and a subsystem with no harness
  is one every future agent will guess about.
```

**2. `AGENTS.md` → `## Anti-Patterns`** — add:

```markdown
- add a new piece of the stack before its harness and its doc exist
```

**3. New skill `.agents/skills/add-infra/SKILL.md`:**

```markdown
---
name: add-infra
description: Adds a new piece of the infrastructure stack — mobile app, queue, cache, search,
  ingestion, a new deploy target — by evaluating options, then building the harness
  and the documentation before the implementation. Use when the request adds a
  runtime, an external service, or a deploy target rather than a feature inside the
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
```

**4. Register the skill** in the `## Available Skills` table in `AGENTS.md` and in
the skills table in `README.md`:

```markdown
| add-infra | /add-infra | Evaluate infra options, harness + docs first, then build |
```

**5. `.agents/skills/scope-feature/SKILL.md`** — at the top of Phase 1, add:

```markdown
If the request adds a runtime, an external service, or a deploy target rather than
a feature inside the existing stack, stop and use `/add-infra` instead: that
workflow builds the harness and the docs before the implementation.
```

### Acceptance

- `/add-infra` exists, is listed in both skill tables, and `scope-feature` hands
  off to it
- the principle appears in `## Operating Principles` and the anti-patterns list
- the skill's Phase 3 explicitly requires observing the harness fail first

---

## WI-2 — Documentation currency: an always-on rule plus a mechanical check

### Why

In the fork, a bug-fix series added five routes, two route guards, a sign-up name
field, and a non-obvious auth invariant. `ARCHITECTURE.md` still described two
routes and never mentioned email verification. Nothing failed, nothing warned, and
the next agent to read that file would have been misled on every one of those
points.

The pack's only instruction on this is Working Loop step 7 — "If conventions
changed, update docs" — which is prose, conditional, and last in a list. It loses
every time to a passing `pnpm check`.

The failure has a second shape worth naming: the fork's hard-won facts _were_
written down, but only in `docs/plans/*.md`. Plans are point-in-time proposals, so
a reader cannot tell which parts still hold. Knowledge reachable only from a plan
is knowledge the next agent will re-derive.

The mechanical check below found a real latent bug in the fork on its first run:
`NEON_APP_DATABASE_URL` was required by the Zod env schema but absent from
`.env.example`, so a fresh clone failed env validation with no hint about the
missing variable.

### Changes

**1. New `.agents/rules/documentation-currency.mdc`:**

````markdown
---
description: Docs are part of the change. When routes, entities, env vars, or a documented
  flow change, update the docs in the same pass and run pnpm docs:check.
alwaysApply: true
---

# Documentation currency

Stale docs are worse than no docs: every future agent inherits the error and
trusts it. A change is not done until the docs that describe it are true again.

## The rule

When your change touches any of the following, update the doc **in the same
pass** — not "later", not in a plan file:

| You changed                                   | Update                              |
| --------------------------------------------- | ----------------------------------- |
| a web route or a route guard                  | Route Map in `ARCHITECTURE.md`      |
| an entity, or a field on one                  | Entity Model in `ARCHITECTURE.md`   |
| the env schema (`packages/shared/.../env.ts`) | `.env.example`                      |
| a documented data flow                        | Data Flow in `ARCHITECTURE.md`      |
| a rule future code must obey                  | Key Invariants in `ARCHITECTURE.md` |
| design tokens in `globals.css`                | token table in `docs/UI_DESIGN.md`  |
| a convention other code should copy           | the matching `docs/*.md`            |

Then run:

```bash
pnpm docs:check
```

It mechanically compares the router, the entities, and the env schema against the
docs, and fails on drift. It runs inside `pnpm check`, so CI catches what you
forget — but do not use it as a to-do list: it cannot see a rewritten flow or a new
invariant, and those are the parts that cost the next agent the most.

## Write invariants, not narration

Prefer the fact that would have prevented the bug over a description of the
change. Bad: "added a verify-email page". Good: "verification is read from the ID
token claim, never `user.emailVerified` — they diverge on session restore".

The second sentence stops a future agent from reintroducing the bug. The first just
tells them a file exists, which they can already see.

## Plans are not documentation

`docs/plans/*.md` are point-in-time proposals and go stale by design. Never leave a
fact that is true today reachable only from a plan file: promote it to
`ARCHITECTURE.md` or the relevant `docs/*.md`. If a plan and a doc disagree, the doc
wins and the plan is history.
````

**2. New `harness/check-docs-sync.mjs`** — proven in the fork, copy verbatim:

```js
#!/usr/bin/env node
/**
 * Documentation-currency harness.
 *
 * Docs rot silently: nothing breaks when a new route or entity never reaches
 * ARCHITECTURE.md, so every future agent inherits a wrong map. This asserts the
 * few facts that are cheap to extract from source and expensive to get wrong.
 *
 * Checks:
 *   1. web routes in apps/web/src/app/router.tsx == ARCHITECTURE.md route map
 *   2. API entity classes == ARCHITECTURE.md entity model
 *   3. required env vars in the Zod env schema == .env.example keys
 *
 * Usage: node harness/check-docs-sync.mjs
 * Exit codes: 0 = docs match the code, 1 = drift found, 2 = harness could not run.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHITECTURE = join(ROOT, 'ARCHITECTURE.md');

function read(path) {
  return readFileSync(path, 'utf8');
}

/**
 * Body of the section whose heading contains `title`, up to the next heading.
 * Matched loosely so renaming or re-levelling a heading does not break the check.
 */
function section(markdown, title) {
  const heading = new RegExp(`^#{2,4} .*${title}.*$`, 'm');
  const match = heading.exec(markdown);
  if (match === null) return null;
  const rest = markdown.slice(match.index + match[0].length);
  const end = rest.search(/^#{1,4} /m);
  return end === -1 ? rest : rest.slice(0, end);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function difference(a, b) {
  return [...a].filter((item) => !b.has(item)).sort();
}

const failures = [];

function compare(label, fromCode, fromDocs, hint) {
  const missing = difference(fromCode, fromDocs);
  const stale = difference(fromDocs, fromCode);
  if (missing.length === 0 && stale.length === 0) {
    console.log(`PASS ${label} (${fromCode.size} in sync)`);
    return;
  }
  console.log(`FAIL ${label}`);
  if (missing.length > 0) console.log(`     - in code, missing from docs: ${missing.join(', ')}`);
  if (stale.length > 0) console.log(`     - in docs, absent from code: ${stale.join(', ')}`);
  console.log(`     hint: ${hint}`);
  failures.push(label);
}

function checkRoutes(architecture) {
  const router = read(join(ROOT, 'apps/web/src/app/router.tsx'));
  const code = new Set([...router.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]));

  const body = section(architecture, 'Route Map');
  if (body === null) {
    console.log('FAIL web routes\n     - ARCHITECTURE.md has no "Route Map" section');
    failures.push('web routes');
    return;
  }
  // First table cell of each row, e.g. "| /verify-email | ... |"
  const docs = new Set(
    [...body.matchAll(/^\|\s*(\/[^\s|]*)\s*\|/gm)].map((m) => m[1].replace(/`/g, '')),
  );

  compare('web routes', code, docs, 'update the Route Map table in ARCHITECTURE.md');
}

function checkEntities(architecture) {
  const entityDir = join(ROOT, 'apps/api/src');
  const code = new Set(
    walk(entityDir)
      .filter((path) => path.endsWith('.entity.ts'))
      .flatMap((path) => [...read(path).matchAll(/export class (\w+) extends BaseEntity/g)])
      .map((m) => m[1]),
  );

  const body = section(architecture, 'Entity Model');
  if (body === null) {
    console.log('FAIL API entities\n     - ARCHITECTURE.md has no "Entity Model" section');
    failures.push('API entities');
    return;
  }
  // The entity model is prose-ish, so only assert presence rather than parsing it
  const documented = new Set([...code].filter((name) => new RegExp(`\\b${name}\\b`).test(body)));

  compare(
    'API entities',
    code,
    documented,
    'add the entity to the Entity Model in ARCHITECTURE.md',
  );
}

function checkEnvExample() {
  const examplePath = join(ROOT, '.env.example');
  if (!existsSync(examplePath)) {
    console.log(`SKIP env vars (no .env.example)`);
    return;
  }
  const schema = read(join(ROOT, 'packages/shared/src/schemas/env.ts'));
  const body = schema.slice(schema.indexOf('z.object('));
  // Optional and defaulted vars need no entry: the app boots without them
  const required = new Set(
    [...body.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):\s*z[\s\S]*?(?=\n\s{2}[A-Z]|\n\}\))/gm)]
      .filter(([declaration]) => !/\.optional\(\)|\.default\(/.test(declaration))
      .map(([, name]) => name),
  );

  const example = read(examplePath);
  const documented = new Set(
    [...required].filter((name) => new RegExp(`^${name}=`, 'm').test(example)),
  );

  compare('env vars', required, documented, 'add the variable to .env.example');
}

function main() {
  const architecture = read(ARCHITECTURE);
  checkRoutes(architecture);
  checkEntities(architecture);
  checkEnvExample();

  console.log(
    failures.length === 0
      ? '\n✓ documentation is in sync with the code'
      : `\n✗ documentation drift in: ${failures.join(', ')}. Update the docs, then re-run: pnpm docs:check`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

try {
  main();
} catch (err) {
  console.error(`FAIL harness: ${err.message}`);
  process.exit(2);
}
```

Run it immediately after adding it. All three checks pass on the pack as it stands
today (verified): routes `/`, `/login`, `/chat` match `router.tsx`; entities `User`,
`Conversation`, `Message` are all documented; and every required env var appears in
`.env.example`. So a failure on first run means you introduced it — fix the drift
rather than loosening the check.

**3. `package.json`:**

```json
"check": "turbo lint type-check && pnpm docs:check",
"validate": "turbo lint type-check test && pnpm docs:check",
"docs:check": "node harness/check-docs-sync.mjs",
```

CI needs no change: `ci.yml` already runs `pnpm check`.

**4. `.agents/skills/build-plan/SKILL.md`** — add a phase after Runtime Verify:

````markdown
## Phase 5 — Update Docs

Not optional, and not a follow-up task. Work the Documentation Impact section of
the plan, then confirm nothing drifted:

```bash
pnpm docs:check
```
````

At minimum, reconcile `ARCHITECTURE.md` with what you built: Route Map for new
routes or guards, Entity Model for new entities or fields, Data Flow for changed
flows, Key Invariants for any rule future code must obey.

Record the invariants you discovered while building — the non-obvious constraint
that cost you an hour is the highest-value sentence in the whole change. See
`.agents/rules/documentation-currency.mdc`.

````

Also add to that skill's Phase 4, since the pack has a harness and the skill does
not mention it:

```markdown
Then run `pnpm validate:local` rather than trusting terminal output, and open the
screenshots in `harness/artifacts/`. A passing exit code proves the page rendered
something, not that it rendered the right thing.
````

**5. `.agents/skills/debug/SKILL.md`** — add a final phase:

```markdown
## Phase 6 — Capture the Invariant

Once the fix is applied and `pnpm check` passes, ask: **why was this bug writable
in the first place?** If the answer is a fact about the system that was not written
down anywhere, write it down now.

- A rule future code must obey → Key Invariants in `ARCHITECTURE.md`
- A flow that behaves differently than the docs imply → Data Flow or the relevant
  `docs/*.md`
- A route, guard, entity, or env var that changed → the matching section, then
  `pnpm docs:check`
- A case the harness should have caught → add the route or assertion to `harness/`

State the invariant as the constraint, not as a changelog entry. A bug class that
stays undocumented gets reintroduced.
```

**6. `.agents/skills/plan-feature/SKILL.md`** — add to the plan template, before
`### Risks`:

```markdown
### Documentation Impact

Name the docs this feature makes stale, and the edit each one needs. Treat it as
part of the file list, because build-plan will work it as Phase 5:

- new/changed routes or guards → Route Map in `ARCHITECTURE.md`
- new entities or fields → Entity Model in `ARCHITECTURE.md`
- new env vars → `.env.example`
- changed flows → Data Flow in `ARCHITECTURE.md`
- rules future code must obey → Key Invariants in `ARCHITECTURE.md`
- new harness routes or assertions → `harness/`

Write "none" only if the feature is genuinely invisible in all of the above.
```

**7. `AGENTS.md`:**

- `## Operating Principles`: add "**Docs are part of the change.** Routes,
  entities, env vars, flows, and invariants are updated in the same pass, verified
  by `pnpm docs:check`. Stale docs are worse than none — every future agent
  inherits the error."
- `## Working Loop` step 7: replace "If conventions changed, update docs" with
  "Update the docs your change made stale, in this same pass, and record any
  invariant you discovered (see `.agents/rules/documentation-currency.mdc`)"
- `## Commands`: add `pnpm docs:check`
- `## Repository Map`: add `harness/` — it is currently absent even though three
  harnesses exist
- `## Anti-Patterns`: add "ship a route, entity, env var, or flow change without
  updating `ARCHITECTURE.md`" and "leave a hard-won invariant recorded only in a
  chat, a commit message, or a `docs/plans/` file"

### Acceptance

- `pnpm docs:check` passes on a clean tree, and `pnpm check` runs it
- deleting a row from the `ARCHITECTURE.md` route map makes `pnpm check` fail with
  the missing path named (verify this, then restore the row)
- adding a required var to the env schema without touching `.env.example` fails
- `build-plan`, `debug`, and `plan-feature` each have their doc step

---

## WI-3 — Fix Playwright browser resolution: stop re-downloading Chromium

### Why

In the fork, Chromium was re-downloaded on essentially every agent session. The
pack already knows the symptom and encodes it as folklore in `init-project` Phase 7:

> On sandboxed agent runners the browser cache path can differ per sandbox profile:
> install and run the harness in the SAME permission context, or the harness won't
> find the executable even right after a successful install.

That is a workaround for a cause that turns out to be diagnosable and fixable in
the repo. There are two independent causes:

1. **The cache is ephemeral.** The agent sandbox sets `PLAYWRIGHT_BROWSERS_PATH` to
   a per-session temp directory (observed:
   `/var/folders/.../T/cursor-sandbox-cache/<hash>/playwright`). Every install lands
   there and dies with the session, while the real cache at
   `~/Library/Caches/ms-playwright` sits fully populated and unused.

2. **The architecture is misdetected.** The sandbox blocks `sysctl`, so `os.cpus()`
   returns `[]`. Playwright detects Apple Silicon with
   `os.cpus().some((cpu) => cpu.model.includes('Apple'))` in
   `packages/utils/hostPlatform.ts`; with no CPUs it concludes `mac-x64` and looks
   for `chrome-headless-shell-mac-x64`, which never matches the `mac-arm64` build on
   disk. So even a persistent cache would be missed, and a fresh install downloads
   an x64 browser that then runs under Rosetta.

Both are fixed below. One residual constraint cannot be fixed from the repo:
**Chromium segfaults (`SIGSEGV` / `SEGV_ACCERR`) under the sandbox's syscall
filter**, so the browser harnesses must run with full permissions. The value of
fixing 1 and 2 is that the sandboxed case now fails in well under a second with the
correct instruction, instead of spending minutes on a download that cannot help.

### Changes

**1. New `harness/lib/browser.mjs`** — proven in the fork, copy verbatim:

```js
/**
 * Shared Chromium launcher for the harnesses.
 *
 * Two agent-sandbox quirks otherwise make every harness run re-download ~150MB
 * of Chromium, and this module exists to neutralise both:
 *
 *  1. The sandbox points PLAYWRIGHT_BROWSERS_PATH at a per-session temp
 *     directory, so nothing installed ever survives the session. We pin it back
 *     to Playwright's own platform default, which one `playwright install`
 *     populates for good and which CI can cache.
 *  2. The sandbox blocks sysctl, so `os.cpus()` returns [] — and Playwright
 *     detects Apple Silicon with `cpus().some(c => c.model.includes('Apple'))`.
 *     With no CPUs it concludes mac-x64 and hunts for an x64 build that never
 *     matches the arm64 one on disk. PLAYWRIGHT_HOST_PLATFORM_OVERRIDE is
 *     Playwright's own escape hatch for exactly this.
 */
import { execFileSync } from 'child_process';
import { cpus, homedir, release } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function defaultBrowsersPath() {
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'ms-playwright');
  if (process.platform === 'win32') {
    return join(
      process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local'),
      'ms-playwright',
    );
  }
  return join(process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache'), 'ms-playwright');
}

/**
 * The hostPlatform string Playwright would compute if it could see the CPU.
 * Mirrors calculatePlatform() in playwright-core's hostPlatform.ts; returns null
 * when Playwright's own detection is already correct.
 */
function appleSiliconOverride() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return null;
  if (cpus().some((cpu) => cpu.model.includes('Apple'))) return null;
  const major = Number(release().split('.')[0]);
  if (major < 20) return null;
  const LAST_STABLE_MACOS_MAJOR = 26;
  return major < 25
    ? `mac${major - 9}-arm64`
    : `mac${Math.min(major + 1, LAST_STABLE_MACOS_MAJOR)}-arm64`;
}

export const BROWSERS_PATH = process.env['MORPHEUS_BROWSERS_PATH'] || defaultBrowsersPath();

function applyEnv() {
  process.env['PLAYWRIGHT_BROWSERS_PATH'] = BROWSERS_PATH;
  const override = appleSiliconOverride();
  if (override && !process.env['PLAYWRIGHT_HOST_PLATFORM_OVERRIDE']) {
    process.env['PLAYWRIGHT_HOST_PLATFORM_OVERRIDE'] = override;
  }
}

function install() {
  console.log(`… installing Chromium once into ${BROWSERS_PATH}`);
  execFileSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

/**
 * Returns a launched Chromium, installing it first if this machine has none.
 * Throws with actionable remediation when neither launch nor install works.
 */
export async function launchChromium(options = {}) {
  applyEnv();

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('playwright is not installed. Remediation: run `pnpm install`.');
  }

  try {
    return await chromium.launch(options);
  } catch (err) {
    // Chromium starts but is killed by the agent sandbox's syscall filter. No
    // amount of reinstalling fixes this; the harness has to run unsandboxed.
    if (/SIGSEGV|browser has been closed|kill EPERM/.test(err.message)) {
      throw new Error(
        'Chromium crashed on launch (SIGSEGV). It cannot run inside the agent sandbox. ' +
          'Remediation: re-run this harness with full permissions — do NOT reinstall the browser.',
      );
    }
    if (!/Executable doesn't exist|Please run the following command/.test(err.message)) throw err;
    try {
      install();
    } catch {
      throw new Error(
        `Chromium is missing from ${BROWSERS_PATH} and the automatic install failed. ` +
          'Remediation: run `pnpm playwright:install` with full permissions (the download ' +
          'needs network access the sandbox blocks).',
      );
    }
    return chromium.launch(options);
  }
}
```

The dynamic `import('playwright')` after `applyEnv()` is load-bearing: Playwright
reads both env vars at module initialisation, so a static import at the top of the
file would be too early. Keep it dynamic.

**2. New `harness/install-browsers.mjs`:**

```js
#!/usr/bin/env node
/**
 * Installs the Chromium build the harnesses need, into the one location they look
 * in. Idempotent: a browser that is already there is left alone.
 *
 * Run this once per machine. Prefer it over a bare `pnpm exec playwright install`,
 * which obeys whatever PLAYWRIGHT_BROWSERS_PATH the shell happens to carry — in
 * agent sandboxes that is a per-session temp directory, so the download is thrown
 * away the moment the session ends.
 *
 * Usage: pnpm playwright:install
 */
import { BROWSERS_PATH, launchChromium } from './lib/browser.mjs';

console.log(`browsers path: ${BROWSERS_PATH}`);

try {
  const browser = await launchChromium();
  await browser.close();
  console.log('✓ Chromium is installed and launches');
} catch (err) {
  console.error(`FAIL ${err.message}`);
  process.exit(1);
}
```

`package.json`: `"playwright:install": "node harness/install-browsers.mjs"`.

**3. Refactor all three harnesses** — `validate-local.mjs`,
`validate-deployment.mjs`, `design-shots.mjs` — to `import { launchChromium } from
'./lib/browser.mjs'` and replace their `await import('playwright')` +
`chromium.launch()` blocks with `await launchChromium(...)`. Delete their local
"run `pnpm exec playwright install chromium`" remediation strings; the helper now
owns that message and gives a more accurate one.

**4. `.agents/skills/init-project/SKILL.md` Phase 7** — replace the folklore
paragraph and the bare install with:

```bash
# Install the Chromium build the validation harnesses use. Idempotent, and it
# pins the install location so it survives across agent sessions.
pnpm playwright:install
```

If the surrounding prose still warns about permission contexts, replace it with:
Chromium cannot run inside the agent sandbox, so run `playwright:install` and the
harnesses with full permissions. The harness now says so when it happens.

**5. `.agents/skills/validate-app/SKILL.md`** — add before the harness sections:

```markdown
## Chromium and the agent sandbox

Read this before debugging a browser failure, or you will waste a 150MB download.

Both Playwright harnesses go through `harness/lib/browser.mjs`, which pins
`PLAYWRIGHT_BROWSERS_PATH` to Playwright's platform default (the sandbox otherwise
points it at a per-session temp dir) and sets
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` on Apple Silicon (the sandbox blocks `sysctl`,
so `os.cpus()` is empty and Playwright wrongly resolves `mac-x64`).

What remains, and cannot be fixed from the repo: Chromium itself segfaults inside
the agent sandbox. So:

- run `pnpm validate:local` / `pnpm validate:deploy` with **full permissions**
- `SIGSEGV` or "browser has been closed" means wrong permissions, not a missing
  browser. The harness says so. Do not reinstall.
- install once per machine with `pnpm playwright:install`
```

**6. `AGENTS.md` → `## Anti-Patterns`:** add "reinstall Chromium when a harness
fails — read its remediation line first".

**7. Optional, `.github/workflows/ci.yml`:** if a browser harness is ever added to
CI, cache the browsers directory keyed on the Playwright version, since the helper
now uses the standard path on Linux (`~/.cache/ms-playwright`):

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ hashFiles('pnpm-lock.yaml') }}
```

### Acceptance

- `pnpm playwright:install` run twice: the second run finishes in under a second
  with no download
- with `PLAYWRIGHT_BROWSERS_PATH` exported to a nonexistent temp path,
  `pnpm validate:local` still finds the browser
- in a restricted sandbox on Apple Silicon, a harness fails in under two seconds
  with the "cannot run inside the agent sandbox" message and downloads nothing
- no harness still contains the string `playwright install chromium` as its own
  remediation text

---

## WI-4 — Ship an auth scaffold that matches the API's own contract

### Why — the highest-leverage item

The pack's API guard rejects unverified password accounts:

```ts
if (decoded.firebase.sign_in_provider === 'password' && !decoded.email_verified) {
  throw new UnauthorizedException('Email not verified');
}
```

The web scaffold's answer to that state is to destroy the session. `signUp` sends
the verification email and then signs out in a `finally`; `signIn` signs out and
throws `AuthError('email-not-verified')`. It is internally coherent, but it means
the pack ships **no signed-in-unverified state at all**: no verification page, no
polling, no resend, no cooldown, and `ProtectedRoute` checks only `user`.

The moment a fork wants the ordinary product behaviour — "stay signed in and tell
me you're waiting on my email" — it must invent all of that, and it walks into a
trap the pack gives no warning about:

**`user.emailVerified` and the ID token's `email_verified` claim diverge.**
Reloading the account refreshes the flag but leaves the cached token untouched, and
the API reads the claim. A client that gates on the flag renders a fully verified
UI whose every API call 401s — and because `getOrCreate` runs inside the guard, no
`User` row is ever created either, so the failure looks like a database problem.
The fork shipped exactly this and needed a dedicated review pass to find it. The
pack's `getToken` (`user.getIdToken()`, unforced) is the other half of the same
trap.

Two options. Recommend B, and note that B is the pack completing its own contract
rather than adding a feature: the API already demands verification.

**Option A — minimal.** Keep sign-out-on-unverified. Add the divergence as a Key
Invariant in `ARCHITECTURE.md` and a comment at `getToken`. Cheap, but leaves every
fork to build the real flow and to rediscover the trap while doing it.

**Option B — recommended: ship the signed-in-unverified state.** Port what the fork
proved:

- `AuthProvider` exposes `emailVerified`, derived from `getIdTokenResult()` claims,
  subscribing via `onIdTokenChanged` (not `onAuthStateChanged`), and resolves
  `loading` only after the claim resolves — otherwise guards route on a
  half-initialised state
- `refreshUser()`: `reload()`, then `getIdToken(true)` when newly verified, then
  re-read the claim
- `signUp(email, password, displayName)` calls `updateProfile` so the guard's
  `decoded['name']` is populated. Today every password sign-up stores
  `displayName: null`, because the sign-up form never asks for a name.
- `sendEmailVerification` continue URL points at the verification page, not
  `/login`
- `PublicRoute`: redirects signed-in visitors away from `/` and `/login`; renders
  children while auth resolves so anonymous visitors never see a spinner
- `ProtectedRoute`: requires signed in **and** verified, else the verification page
- a `/verify-email` page: polls every 5s, resend behind a 60s cooldown whose
  timestamp lives in `sessionStorage`. Not `location.state` — the guard unmounts the
  page on redirect and the cooldown is lost.
- every redirect uses `replace: true`, or the back button strands the user
- remove the now-unreachable `AuthError('email-not-verified')` path
- trim the sign-up name to reject whitespace-only input

Document it in `ARCHITECTURE.md` (Route Map with a Guard column, an
Authentication section, the invariant in Key Invariants) and in `docs/AUTH.md`
(WI-7).

### Acceptance

- sign up with a name lands on the verification page; verifying in another tab
  redirects automatically with no manual reload; the created `User` row has
  `displayName` set
- a signed-in verified user visiting `/login` is redirected away
- no route can render a signed-in-verified UI while the API returns 401
- `rg "\.emailVerified" apps/web/src` returns only the claim-derivation site, or
  nothing

---

## WI-5 — An auth-journey harness: the test that was missing

### Why

Neither existing safety net could have caught WI-4's bug. There are no unit tests
(WI-6), and `validate-local.mjs` visits public routes signed out, so it never holds
a token. The failure only appears when a real signed-in session's token meets the
real guard — which is precisely the harness-shaped hole WI-1 exists to prevent.
Auth shipped without the harness that observes it.

### Changes

**1. Firebase Auth Emulator** so the journey needs no real mailbox:

- add `firebase-tools` as a devDependency and a `firebase.json` configuring the
  auth emulator
- `.env.example`: `FIREBASE_AUTH_EMULATOR_HOST` and
  `VITE_FIREBASE_AUTH_EMULATOR_HOST`
- in the web Firebase init, call `connectAuthEmulator` only when the `VITE_` flag
  is set, and in the API point the Admin SDK at the emulator only when its flag is
  set. Guard both so production can never reach an emulator.

**2. New `harness/validate-auth-journey.mjs`** using `launchChromium` from WI-3:

1. start the emulator; boot web and api
2. sign up with email, password, and a name
3. assert the app lands on the verification page
4. mark the email verified through the emulator's REST API
5. assert the client redirects itself within the poll interval, with no reload
6. assert an authenticated `GET` against the API returns 200 and that the user
   record carries the `displayName` from step 2
7. screenshot each state into `harness/artifacts/auth-*.png`

Follow the existing harness conventions: PASS/FAIL lines, `hint:` on failures,
exit codes 0/1/2. Add `"validate:auth"` to `package.json`.

**3. Prove it red.** Temporarily derive verification from `user.emailVerified`
instead of the token claim and confirm the harness fails at step 6 with a 401.
Revert, confirm green, and paste both outputs into your report. Step 6 is the whole
point: an assertion on the API response is what distinguishes this from a UI test
that would have passed while the product was broken.

**4. Document** in `validate-app` (add to the harness table) and `docs/AUTH.md`.

### Acceptance

- `pnpm validate:auth` passes against the emulator with no real mailbox and no
  production credentials
- it fails, with a clear message, when verification is read from the account flag
- the emulator is unreachable unless the env flags are set

---

## WI-8 — A release skill for the promotion path

### Why

`ARCHITECTURE.md` documents the promotion path — iterate locally, merge to
`staging`, merge to `main` — and `.github/workflows/` implements it, but no skill
drives it. So the highest-consequence routine operation in the repo is the one an
agent performs from memory, which shows up in two ways:

1. **Gates get skipped.** The two things worth doing before production sees a
   change — a green `ci.yml` and a green `migrate.yml` on `staging` — are exactly
   the things an agent in a hurry treats as optional. The migration gate matters
   most: `main` runs the same migration against production, so a migration that
   fails on staging is a warning that arrives exactly once.
2. **The direction inverts.** In the fork, every prior promotion was a
   `merge: main into staging` commit — work landed on `main` first and `staging`
   became a trailing mirror, inverting the whole point of the pipeline. Nothing in
   the repo objected, because nothing in the repo described the intended direction
   as an executable procedure. Eight such commits accumulated before anyone noticed.

A skill fixes both, and gives the deploy harness from `validate-app` the workflow
it was always implied to belong to.

### Changes

**1. New skill `.agents/skills/release/SKILL.md`** — this is the version proven in
the fork; adapt branch names and URLs if the pack's differ:

````markdown
# release

Ships the current work through the documented promotion path: local → `staging` →
`main`. Validates before each promotion and verifies the deployment after it, so a
broken build is caught on staging rather than in production.

Read AGENTS.md first. See `ARCHITECTURE.md` § Deployment & Environments for what
each branch maps to.

Never skip a gate because the change "looks small". The whole value of this
workflow is that production is the last thing to see a change, not the first.

## Phase 1 — Validate locally

```bash
pnpm format
pnpm validate        # lint + type-check + tests + docs:check
pnpm validate:local  # needs full permissions — Chromium cannot run sandboxed
```

Open the screenshots in `harness/artifacts/`. A green exit code proves the pages
rendered something, not that they rendered the right thing. Stop on any failure.

## Phase 2 — Review what ships

```bash
git status --short
git diff --stat
```

Check, and say what you checked: no secrets (`.env`, service-account JSON, tokens),
no debug leftovers (`console.log`, `.only`), no stray artifacts. If a migration
file was added, say so explicitly — it runs against staging on push and against
**production** on merge.

## Phase 3 — Commit onto staging

`staging` is the integration branch; work is promoted from it, not to it. If your
work is uncommitted on another branch, check it can move safely:

```bash
git diff --name-only origin/main origin/staging
```

Empty output means the trees are identical and `git checkout staging` carries
uncommitted changes cleanly. If it is not empty, do not drag uncommitted work
across a diverged tree — commit on the current branch, then merge it into
`staging`.

Stage explicit paths (`git add -A` is how untracked scratch files reach a remote),
then commit with a HEREDOC and a conventional prefix describing why, not what.
Push to `origin staging`.

## Phase 4 — Wait for staging CI and migration

| Workflow      | Does                                                |
| ------------- | --------------------------------------------------- |
| `ci.yml`      | format check, lint, type-check, tests, build        |
| `migrate.yml` | applies pending MikroORM migrations to Neon staging |

```bash
gh run list --branch staging --limit 5
gh run watch <run-id> --exit-status
```

Both must conclude `success`. On failure, fix and return to Phase 1 — never promote
a red staging. A failed migration is a hard stop: `main` runs the same migration
against production.

## Phase 5 — Verify the staging deployment

```bash
pnpm validate:deploy  # needs full permissions
```

Staging sits behind Vercel deployment protection, so an SSO redirect is a pass.

## Phase 6 — Promote to main

```bash
git checkout main
git merge staging
git push origin main
```

A fast-forward is expected when `main` has nothing `staging` lacks. If the merge is
not a fast-forward, stop and find out why `main` diverged before forcing anything —
someone committed straight to production.

## Phase 7 — Verify production

Watch both workflows on `main`, then run `pnpm validate:deploy` and actually open
the production screenshot. This is the last gate, and the one a user would
otherwise hit first.

## Phase 8 — Report

The commit SHA on each branch, both workflow conclusions per branch, the verified
URLs, and anything deliberately deferred.

## Rollback

```bash
git checkout main
git revert <sha>   # or `git revert -m 1 <merge-sha>` for a merge commit
git push origin main
```

Revert forward; never force-push `main`. A reverted migration needs a new migration
that undoes it — rolling back code does not roll back a schema change, which is why
Phase 4 treats migrations as a hard gate.
````

**2. Register it** in the `## Available Skills` table in `AGENTS.md` and the skills
table in `README.md`:

```markdown
| release | /release | Promote work local → staging → main with gates at each step |
```

**3. `AGENTS.md` → `## Anti-Patterns`:** add "commit straight to `main`, or merge
`main` into `staging` — promotion flows one way" and "promote to `main` before
staging CI and the staging migration are green".

**4. Cross-link** from `.agents/skills/validate-app/SKILL.md`: note that
`validate:deploy` is Phases 5 and 7 of `/release`, so an agent arriving at the
harness finds the workflow it belongs to.

### Acceptance

- `/release` exists and appears in both skill tables
- the skill names both workflows by filename and treats a failed migration as a
  hard stop
- a dry read of the skill answers: how to move uncommitted work onto `staging`
  safely, how to tell whether the merge to `main` should fast-forward, and how to
  roll back a bad migration

---

## WI-6 — Ship exemplar tests

### Why

The pack has `docs/TESTING.md`, a `write-tests` skill, vitest configs for three
packages, a jsdom setup file, a CI test step — and zero test files. Every package
runs `vitest run --passWithNoTests`, so `pnpm test` is green on an empty suite and
the CI step proves nothing. Worse, `write-tests` has no in-repo example to imitate,
and forks inherit "tests are optional" as the lived convention. The fork wrote none.

### Changes

Three P0 tests, matching `docs/TESTING.md`'s own priority list, chosen to be
templates rather than coverage:

1. `packages/shared` — the env schema: a Zod boundary test, including the failure
   message on a missing required var
2. `apps/api` — `FirebaseAuthGuard` with `verifyIdToken` mocked: valid token,
   unverified password account (401), missing header (401). This is the contract
   WI-4 depends on.
3. `apps/web` — `ProtectedRoute` with `@testing-library/react`: the redirect matrix
   over signed-out / signed-in-unverified / signed-in-verified

Then reconsider `--passWithNoTests`: keep it only where a package legitimately has
no tests, so an accidentally empty suite in a package that should have them fails.

### Acceptance

- `pnpm test` runs and reports a non-zero number of tests
- each test follows the AAA and boundary-mocking conventions in `docs/TESTING.md`,
  so it reads as a template
- `docs/TESTING.md` references these files as the worked examples

---

## WI-7 — Promote auth and frontend facts out of plans and into docs

### Why

`docs/` covers style, testing, logging, UI design, and domains — and says nothing
about auth or the frontend, which is where every fork spends its first day. The
consequence is visible in the fork: its auth knowledge accumulated in
`docs/plans/*.md`, where a reader cannot distinguish a current fact from an
abandoned proposal, and the canonical docs stayed silent.

### Changes

- **`docs/AUTH.md`** (new): the Firebase Console checklist, the client/server
  split, the verification contract including the token-claim invariant, guard
  behaviour and its error shapes, emulator usage (WI-5), and authorized domains
  with a cross-link to `docs/RUNBOOK_DOMAINS.md` rather than a copy of it
- **`ARCHITECTURE.md`**: give the route map a Guard column; add the token-claim rule
  to Key Invariants; describe the sign-up and verification flow in Data Flow
- **`AGENTS.md`** documentation read order and the `README.md` doc list: add
  `docs/AUTH.md`
- respect the existing anti-pattern: link, do not duplicate

### Acceptance

- a reader can answer "what happens when an unverified user calls the API, and how
  does the client find out" from `docs/AUTH.md` alone
- `pnpm docs:check` passes
- no auth fact that is currently true lives only in `docs/plans/`

---

## Suggested order

1. **WI-3** — every other harness-touching item is slow and annoying until this is
   fixed.
2. **WI-2** — makes the remaining items self-enforcing rather than remembered.
3. **WI-1** — the principle, now that the harness tooling it points at is sound.
4. **WI-8** — cheap, self-contained, and it protects everything shipped after it.
5. **WI-4** — the largest correctness win for forks.
6. **WI-5** — locks WI-4 in with the evidence that was missing.
7. **WI-6**, then **WI-7**.

## Out of scope

- pixel-diff visual regression testing
- migrating the harnesses to `@playwright/test`; plain scripts with exit codes are
  the pack's chosen idiom and they suit agents well
- rewriting the existing `docs/plans/*.md` files; they are history, and WI-2's rule
  is what stops new facts from landing there
