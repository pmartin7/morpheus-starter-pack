---
name: validate-app
description: Runs the validation harnesses (Playwright route checks, the auth-journey
  check, deployment smoke checks, docs sync) that prove the app actually works.
  Use after local changes to web code, after touching auth, or after a
  deployment, instead of eyeballing terminal output.
---

# validate-app

Runs the validation harnesses that prove the app actually works — locally and
in deployment. Use these instead of eyeballing terminal output.

## Chromium and the agent sandbox

Read this before debugging a browser failure, or you will waste a 150MB download.

Every Playwright harness goes through `harness/lib/browser.mjs`, which pins
`PLAYWRIGHT_BROWSERS_PATH` to Playwright's platform default (the sandbox otherwise
points it at a per-session temp dir) and sets
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` on Apple Silicon (the sandbox blocks `sysctl`,
so `os.cpus()` is empty and Playwright wrongly resolves `mac-x64`).

What remains, and cannot be fixed from the repo: Chromium itself segfaults inside
the agent sandbox. So:

- run `pnpm validate:local` / `pnpm validate:auth` / `pnpm validate:deploy` with
  **full permissions**
- `SIGSEGV` or "browser has been closed" means wrong permissions, not a missing
  browser. The harness says so. Do not reinstall.
- install once per machine with `pnpm playwright:install`

## When to run which

| Harness    | Command                | Run when                                                                         |
| ---------- | ---------------------- | -------------------------------------------------------------------------------- |
| Local      | `pnpm validate:local`  | After local changes to web code, before finishing any task that touches the app  |
| Auth       | `pnpm validate:auth`   | After touching auth, route guards, the API guard, or the sign-up flow            |
| Deployment | `pnpm validate:deploy` | After a deployment (production or staging), or when asked to verify the live app |
| Docs sync  | `pnpm docs:check`      | Already inside `pnpm check`; run alone when reconciling docs after a change      |

## What each harness does

**validate:local** boots the web dev server on :5173 (or reuses one already
running), visits every route in the list at the top of
`harness/validate-local.mjs` with Playwright, and fails on console errors,
page errors, failed network requests, or an empty `#root` (blank page). It
writes a full-page screenshot per route to `harness/artifacts/`
(`local-home.png`, `local-login.png`, ...).

**validate:auth** drives the whole signed-in-unverified journey against the
Firebase Auth emulator, so it needs no real mailbox: sign up with a name, land on
`/verify-email`, mark the address verified through the emulator's admin API, and
assert the client redirects itself without a reload. It then sends **the ID token
the client is actually holding** to `GET /api/users/me` and asserts a 200 whose
`displayName` matches the sign-up. That last assertion is the point: verification
must be read from the token's `email_verified` claim, never from
`user.emailVerified`, and only a real API response catches the difference. See
`docs/AUTH.md`. Prerequisites (exit `2` if absent): a `.env` with both
`FIREBASE_AUTH_EMULATOR_HOST` and `VITE_FIREBASE_AUTH_EMULATOR_HOST`, a reachable
`NEON_DATABASE_URL`, and `firebase-tools` installed.

**validate:deploy** reads Vercel credentials (CLI auth file or `VERCEL_TOKEN`)
and `.vercel/project.json`, checks the latest production deployment — and the
latest `staging` branch preview if one exists — is `READY`, HTTP-smoke-checks
the live URLs, and runs a Playwright blank-page check against production,
writing `harness/artifacts/deploy-production.png`. A missing staging
deployment is a note, not a failure.

**docs:check** needs no browser. It extracts the routes from
`apps/web/src/app/router.tsx`, the entity classes from `apps/api`, and the
required vars from the Zod env schema, and fails when `ARCHITECTURE.md` or
`.env.example` disagrees with any of them. It cannot see a rewritten flow or a
new invariant, so it is a floor rather than a to-do list — see
`.agents/rules/documentation-currency.mdc`.

## Exit codes

- `0` — all checks passed
- `1` — validation failures (the app is broken; read the per-route/per-check FAIL lines)
- `2` — harness or environment error (Playwright not installed, dev server would not boot, missing/stale Vercel credentials)

Every failure line is followed by a one-line `hint:` with the fix.

## Screenshots

Screenshots land in `harness/artifacts/`. You SHOULD open and look at them —
a passing exit code proves the page rendered something, not that it rendered
the right thing.

## Common remediation

- Chromium missing → `pnpm playwright:install`
- `validate:auth` exits 2 on a missing emulator var → uncomment both
  `FIREBASE_AUTH_EMULATOR_HOST` and `VITE_FIREBASE_AUTH_EMULATOR_HOST` in `.env`
- `validate:auth` fails at the `GET /api/users/me` step → the client is holding a
  token whose claim is stale; do not touch the API guard, fix the claim refresh
- Not linked to Vercel / no credentials → `npx vercel login` then `npx vercel link`
- API returns 401/403 (stale token) → `npx vercel whoami`
- Preview URL redirects to Vercel SSO → expected on Hobby plan deployment protection; the harness reports it as a pass-with-note, not a failure
- Empty `#root` → likely a module-load crash; check `VITE_*` env vars and the console errors printed above
