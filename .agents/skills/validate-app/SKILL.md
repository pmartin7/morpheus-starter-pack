---
name: validate-app
description: Runs the local and deployment validation harnesses (Playwright route checks,
  deployment smoke checks) that prove the app actually works. Use after local
  changes to web code or after a deployment, instead of eyeballing terminal
  output.
---

# validate-app

Runs the validation harnesses that prove the app actually works — locally and
in deployment. Use these instead of eyeballing terminal output.

## When to run which

| Harness    | Command                | Run when                                                                         |
| ---------- | ---------------------- | -------------------------------------------------------------------------------- |
| Local      | `pnpm validate:local`  | After local changes to web code, before finishing any task that touches the app  |
| Deployment | `pnpm validate:deploy` | After a deployment (production or staging), or when asked to verify the live app |

## What each harness does

**validate:local** boots the web dev server on :5173 (or reuses one already
running), visits every route in the list at the top of
`harness/validate-local.mjs` with Playwright, and fails on console errors,
page errors, failed network requests, or an empty `#root` (blank page). It
writes a full-page screenshot per route to `harness/artifacts/`
(`local-home.png`, `local-login.png`, ...).

**validate:deploy** reads Vercel credentials (CLI auth file or `VERCEL_TOKEN`)
and `.vercel/project.json`, checks the latest production deployment — and the
latest `staging` branch preview if one exists — is `READY`, HTTP-smoke-checks
the live URLs, and runs a Playwright blank-page check against production,
writing `harness/artifacts/deploy-production.png`. A missing staging
deployment is a note, not a failure.

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

- Chromium missing → `pnpm exec playwright install chromium`
- Not linked to Vercel / no credentials → `npx vercel login` then `npx vercel link`
- API returns 401/403 (stale token) → `npx vercel whoami`
- Preview URL redirects to Vercel SSO → expected on Hobby plan deployment protection; the harness reports it as a pass-with-note, not a failure
- Empty `#root` → likely a module-load crash; check `VITE_*` env vars and the console errors printed above
