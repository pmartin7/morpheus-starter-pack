# Morpheus Starter — Improvement Plan

**Audience:** an agent working in the `morpheus-starter` repository.
**Source:** retrospective of a real end-to-end init of a product (yagyu.app) from a
fresh clone: `/init-project` → chat removal → GitHub + Vercel provisioning →
staging branch setup → custom domains → validation harnesses. Every item below
maps to a concrete failure or friction point hit during that run.

Work through the priorities in order. Each item has a **Problem observed**,
**Change**, and **Acceptance** section. Do not add anything not listed here.

---

## P0 — Latent defects in the starter (broken on first real use)

### 1. Firebase Admin SDK is never initialized in the API

**Problem observed:** the starter ships an auth guard that calls
`admin.auth().verifyIdToken(...)`, but `admin.initializeApp()` is never called
anywhere. The first authenticated request crashes. This was only discovered by
reading the code, not by any check.

**Change:** in `apps/api/src/main.ts` (after env validation), initialize the
Admin SDK from env vars:

```ts
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env['FIREBASE_PROJECT_ID'],
    // env stores often escape newlines in the PEM key
    privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
  }),
});
```

Add `FIREBASE_PROJECT_ID` / `FIREBASE_PRIVATE_KEY` / `FIREBASE_CLIENT_EMAIL` to
the Zod env schema and `.env.example` (with the `\n`-escaped key format shown).

**Acceptance:** a fresh clone with valid Firebase env vars can verify an ID
token without any code change.

### 2. Firebase client crashes the web app at module load → blank page in prod

**Problem observed:** `apps/web/src/lib/firebase.ts` called
`initializeApp(...)` + `getAuth(...)` at module top level. When `VITE_FIREBASE_*`
vars were absent from the production build, the bundle threw
`auth/invalid-api-key` during startup and the deployed site rendered a **blank
page** with no visible error. Debugging required downloading and inspecting the
deployed JS bundle.

**Change:** make Firebase client init lazy and nullable:

```ts
let cachedAuth: Auth | null = null;
export function getFirebaseAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  if (!firebaseConfig.apiKey) return null; // unconfigured ≠ crash
  cachedAuth = getAuth(initializeApp(firebaseConfig));
  return cachedAuth;
}
```

The auth provider treats `null` as "not configured" (renders logged-out state);
auth actions throw a descriptive error
(`Firebase is not configured (missing VITE_FIREBASE_* env vars)`).

**Acceptance:** building and serving the web app with zero `VITE_FIREBASE_*`
vars renders the landing page; sign-in shows a clear error instead of a blank
page.

### 3. `turbo.json` does not pass `VITE_*` env vars into builds

**Problem observed:** even with `VITE_FIREBASE_*` set in Vercel, Turborepo
stripped them from the build environment (env not declared in the task hash),
so the client bundle shipped `undefined` config. This was the second half of
the blank-page failure.

**Change:** in `turbo.json`:

```json
"build": { "dependsOn": ["^build"], "outputs": ["dist/**"], "cache": true, "env": ["VITE_*", "NODE_ENV"] }
```

**Acceptance:** `VITE_*` values set in Vercel appear in the built web bundle.

### 4. `@vitejs/plugin-react` missing from `apps/web` devDependencies

**Problem observed:** the web build passed locally (hoisted resolution) but
**failed on Vercel** with a module-not-found for `@vitejs/plugin-react`. The
first deployment of the freshly-initialized project was red. A second trap:
the latest plugin major requires a newer Vite than the starter pins, so a naive
`pnpm add -D @vitejs/plugin-react` also breaks — the version must be pinned
compatibly (e.g. `^4.3.0` with Vite 5), or Vite upgraded in lockstep.

**Change:** declare every imported package explicitly in each workspace's
`package.json`, at versions consistent with the lockfile. Then guard against
regressions: add a CI job (GitHub Actions) that runs `pnpm install
--frozen-lockfile && pnpm build` from a clean checkout.

**Acceptance:** clean-checkout CI build passes; no workspace relies on hoisting.

### 5. Shared tsconfig hijacks the API build output directory

**Problem observed:** `packages/tsconfig/nestjs.json` sets paths that resolve
relative to the shared config, so `nest build` emitted compiled output into
`packages/tsconfig/dist` instead of `apps/api/dist`. The API "built
successfully" but produced no runnable artifact where the start script and
Vercel expected it.

**Change:** never set `outDir`/`rootDir` in shared configs. Set them explicitly
in each app:

```json
{ "extends": "@morpheus/tsconfig/nestjs.json", "compilerOptions": { "outDir": "./dist", "rootDir": "./src" } }
```

Keep `mikro-orm.config.ts` inside `src/` so it compiles into `dist/` with
everything else.

**Acceptance:** `pnpm --filter api build` produces `apps/api/dist/main.js`;
`node apps/api/dist/main.js` boots.

### 6. No unified local `.env` story

**Problem observed:** three separate gaps: (a) the NestJS API never loaded any
`.env` file (no dotenv), (b) Vite looked for `.env` in `apps/web/` rather than
the repo root, (c) MikroORM's config read `process.env` at module load, before
any late dotenv call ran.

**Change:** one `.env` at the repo root serves everything:

- `apps/api/src/config/load-env.ts` — loads root `.env` via dotenv, resolved
  relative to `__dirname` (account for the compiled `dist/` location). Import
  it **first** in `main.ts` and at the top of `mikro-orm.config.ts`.
- `apps/web/vite.config.ts` — `envDir: '../../'`.
- `.env.example` at root documents every variable, server and `VITE_*` client
  vars, with real-looking placeholder formats.

**Acceptance:** `cp .env.example .env`, fill values, `pnpm dev` — both apps
pick up config with no per-app env files.

### 7. `pnpm check` fails on a fresh clone (shared package not built)

**Problem observed:** type-checking the API failed with
`@morpheus/shared not found` until `pnpm --filter @morpheus/shared build` was
run manually. Agents following the "run pnpm check after edits" rule hit this
wall immediately.

**Change:** in `turbo.json`, make the `check` (and `test`) tasks depend on
`^build`, so dependencies build automatically.

**Acceptance:** fresh clone → `pnpm install && pnpm check` passes with no
manual pre-step.

---

## P1 — Ship the validation harnesses with the starter

These were built from scratch during the run (inspired by OpenAI's harness
engineering post) and immediately caught real problems. They belong in the
starter so every derived project starts with agent-usable feedback loops.

### 8. `harness/validate-local.mjs` + `pnpm validate:local`

Playwright script that boots the web dev server (or reuses a running one),
visits each route, and fails on: console errors, page errors, failed network
requests, or an **empty `#root`** (the blank-page class of failure). Saves
full-page screenshots to `harness/artifacts/` so agents can *look* at the UI.
Exit code 0/1/2 with one-line remediation hints on every failure
(e.g. "run `pnpm exec playwright install chromium`").

### 9. `harness/validate-deployment.mjs` + `pnpm validate:deploy`

Node script that: reads Vercel credentials from the local CLI auth file +
`.vercel/project.json`; checks the latest production and staging deployments
are `READY` via the Vercel API; HTTP-smoke-checks the live URLs; treats
Vercel-SSO-protected previews as a **pass with a note** (Hobby plan default);
and runs a Playwright visual check against production (screenshot + empty-root
detection). Every failure mode prints a remediation hint, including "token may
be stale — run `npx vercel whoami`".

### 10. Wire harnesses into the agent surface

- Root `package.json`: `validate:local`, `validate:deploy` scripts; `playwright`
  as a dev dependency.
- `.agents/skills/validate-app/SKILL.md`: when to run each harness, what the
  outputs mean, and the instruction that agents should open the screenshots.
- `AGENTS.md` Quick Start + skills table entries.
- `.gitignore`: `harness/artifacts/`.
- `init-project` skill (see §11): run `validate:deploy` as the final step of
  provisioning instead of just curling the URL.

**Acceptance for 8–10:** on a fresh clone, `pnpm validate:local` passes and
produces screenshots; after a deploy, `pnpm validate:deploy` passes; breaking
the Firebase env reproduces a caught, explained failure — not a silent blank
page.

---

## P2 — `init-project` skill: provisioning preflights and playbooks

### 11. Preflight checks before provisioning

**Problem observed:** provisioning stalled repeatedly on discoverable-in-advance
issues: `gh` not installed, `gh` not authenticated (device-flow needed two
attempts), the Vercel GitHub App not installed (git connect API fails until the
user installs it), and a stale Vercel CLI token (API 403s mid-run).

**Change:** add an explicit preflight phase to the skill, before any
provisioning step:

1. `gh --version` → install via brew if missing.
2. `gh auth status` → if unauthenticated, run device flow; **print the one-time
   code prominently and keep polling** — expect the user to take minutes.
3. Vercel token freshness → `npx vercel whoami`; on 403, refresh before
   proceeding.
4. Git connect → attempt; on "GitHub App not installed", give the user the
   install URL (`https://github.com/apps/vercel`) and **poll in a background
   loop** until the connection succeeds rather than failing the run.

### 12. Document the Hobby-plan staging pattern

**Problem observed:** creating a Vercel custom environment for staging failed
with `Cannot create more than 0 custom environments` — Hobby plan doesn't
support them. The working pattern: a long-lived `staging` git branch + a
domain (`staging.<domain>`) pinned to that branch (branch-scoped Preview
deployments), with Preview-scoped env vars.

**Change:** encode this as the default staging recipe in the skill; only use
custom environments when the team is on Pro. Note that Preview deployments have
Vercel SSO deployment protection by default — harnesses and docs must treat an
SSO redirect on staging as expected, not a failure.

### 13. Domain setup runbook (`docs/RUNBOOK_DOMAINS.md`)

**Problem observed:** the DNS/TLS phase had several confusing intermediate
states that look like errors but are just propagation: "DNS zone not enabled /
cannot solve dns-01" in the Vercel dashboard *before* nameserver verification;
apex + www certs auto-issuing minutes after `nsVerifiedAt`; the **subdomain
cert not auto-issuing** and needing a forced issuance
(`POST /v7/certs {"cns":["staging.<domain>"]}`).

**Change:** a short runbook covering: registrar nameserver switch
(`ns1/ns2.vercel-dns.com`), how to check state
(`dig NS <domain>`, `dig A <domain> @ns1.vercel-dns.com`, the
`/v5/domains/<domain>` API fields `nsVerifiedAt`/`zone`), when to just wait vs.
act, forced cert issuance for stragglers, and adding redirect domains via
`POST /v10/projects/{id}/domains` with `redirect` + `redirectStatusCode`.
Also: remind that custom domains must be added to Firebase **Authorized
domains**.

### 14. Feature removal should be a clean seam

**Problem observed:** answering "no chat UI" to init meant hand-editing eight+
files across three workspaces (API module, web router, layout nav, home CTA,
login redirect, shared schema exports, web deps). Easy for an agent to miss one
reference.

**Change:** keep the chat feature strictly self-contained: one API module, one
web feature folder + route entry, one shared schema file, dependencies used
only by it. Add a removal checklist (exact files/lines) to the init skill so
removal is mechanical. Do **not** build a flag/plugin system for this — a
checklist over a well-isolated feature is enough.

---

## Suggested execution order

1. §1–7 (defect fixes) in one pass — each is small; validate with a clean-clone
   build + boot.
2. §8–10 (harnesses) — port from the yagyu.app repo
   (`harness/*.mjs`, `.agents/skills/validate-app/`), they are
   starter-agnostic except the route list.
3. §11–14 (skill + docs) — mostly prose changes in `.agents/skills/init-project/`
   and new runbook docs.

The measure of success: the next `/init-project` run reaches a green, visually
verified production deployment with **zero** of the failures listed above, and
every remaining failure mode is caught by a harness with a remediation hint
rather than discovered as a blank page or a red Vercel build.
