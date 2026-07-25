# Morpheus Starter Pack — DevOps & Tooling Upgrade Plan

Status: ready to implement. Target repository: `morpheus-starter` (the template
repo), **not** this project. This plan is self-contained: a coding agent with
access to the starter repo can implement it without any other context.

## 1. Summary

The Yagyu project (hydrated from this starter) had to hand-build four pieces of
infrastructure that every downstream project will need identically:

1. GitHub Actions CI/CD (format + lint + type-check + test, and per-environment
   database migrations)
2. A dev → staging → production environment topology across git, Neon Postgres
   branches, Vercel, and GitHub environments
3. An enforced formatting toolchain (format-on-save, pre-commit, CI gate)
4. Fixes for latent template bugs discovered along the way (turbo task graph,
   Neon SSL, missing lint coverage)

Fold all of it back into the template so `init-project` delivers a repo where
CI, migrations, environments, and formatting work on the first push.

## 2. Design Decisions (already validated in production)

- **Environment topology.** One Neon project, three DB branches mirroring git:
  `production` (root) ← `staging` (child) ← `dev` (child). Local dev uses the
  `dev` branch with a **direct** connection string; Vercel runtime uses
  **pooled** (`-pooler`) strings; migrations always use direct strings. GitHub
  environments `production`/`staging` each hold their own `NEON_DATABASE_URL`
  secret.
- **Migrations run in CI, not at deploy time.** A dedicated workflow applies
  MikroORM migrations on push to `staging`/`main`, concurrency-guarded per
  environment so two migrations never race on the same database.
- **Prettier is enforced mechanically at three layers** (editor, pre-commit,
  CI). ESLint owns correctness only; `eslint-config-prettier` disables
  conflicting stylistic rules. No `eslint-plugin-prettier` (slower, discouraged
  by Prettier docs).
- **`vitest run --passWithNoTests`** in every package: the starter ships with
  zero tests, and vitest fails on an empty suite by default — CI must be green
  on the very first push.
- **lint-staged uses per-package configs** so `eslint --fix` runs with each
  package's own flat config (ESLint resolves config relative to cwd; lint-staged
  runs tasks from the directory of the config file that matched).

## 3. File-by-File Changes

### 3.1 `.github/workflows/ci.yml` — NEW

```yaml
name: CI

on:
  push:
    branches: [staging, main]
  pull_request:
    branches: [staging, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Format check
        run: pnpm format:check

      - name: Lint and type-check
        run: pnpm check

      - name: Tests
        run: pnpm test
```

### 3.2 `.github/workflows/migrate.yml` — NEW

```yaml
name: Migrate database

on:
  push:
    branches: [staging, main]

# Never run two migrations for the same environment at once; queue instead.
concurrency:
  group: migrate-${{ github.ref_name }}
  cancel-in-progress: false

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'production' || 'staging' }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # MikroORM discovers entities from dist at runtime; go through turbo so
      # workspace dependencies (@morpheus/shared) are built first
      - run: pnpm build --filter=@morpheus/api

      - name: Run pending migrations
        env:
          NEON_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: pnpm migrate:up
```

### 3.3 `turbo.json` — FIX (latent template bug)

`type-check` and `test` resolve `@morpheus/shared` from its built `dist`
output, which does not exist on a fresh checkout. Add the missing dependency:

```json
"type-check": {
  "dependsOn": ["^build"],
  "cache": true
},
"test": {
  "dependsOn": ["^build"],
  "cache": true,
  "outputs": ["coverage/**"]
}
```

### 3.4 Root `package.json` — formatting scripts, husky, lint-staged

Add scripts:

```json
"format": "prettier --write .",
"format:check": "prettier --check .",
"prepare": "husky"
```

Add root lint-staged config (catch-all for non-TS files; nested package configs
take precedence for their files):

```json
"lint-staged": {
  "*": "prettier --write --ignore-unknown"
}
```

Add devDependencies: `"husky": "^9.1.7"`, `"lint-staged": "^16.2.7"`
(prettier is already a root devDependency).

### 3.5 `.husky/pre-commit` — NEW

```
pnpm exec lint-staged
```

(husky v9 style: no shebang/husky.sh boilerplate. The `prepare` script installs
the hook on `pnpm install`.)

### 3.6 `.prettierignore` — NEW

```
pnpm-lock.yaml
dist
coverage
.turbo
.vercel
harness/artifacts
apps/api/migrations/.snapshot-*.json
```

### 3.7 `.vscode/settings.json` — NEW (committed)

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### 3.8 `.vscode/extensions.json` — NEW

```json
{
  "recommendations": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint"]
}
```

### 3.9 `packages/eslint-config` — Prettier interop

- `package.json` dependencies: add `"eslint-config-prettier": "^10.1.8"`.
- `base.js`: import it and append as the **last** config entry:

```js
import eslintConfigPrettier from 'eslint-config-prettier';
// ... existing tseslint.config(...) entries ...
// Must stay last: disables stylistic rules that conflict with Prettier
eslintConfigPrettier,
```

`react.js` and `nestjs.js` extend `base.js` and only add non-stylistic rules,
so appending in base covers all packages.

### 3.10 `packages/shared` — lint coverage (gap in current template)

- `package.json` scripts: add `"lint": "eslint src"`.
- `package.json` devDependencies: add `"@morpheus/eslint-config": "workspace:*"`
  and `"eslint": "^9.0.0"`.
- New file `eslint.config.mjs`:

```js
import baseConfig from '@morpheus/eslint-config/base.js';

export default baseConfig;
```

### 3.11 All three packages — vitest and lint-staged

In `apps/web`, `apps/api`, `packages/shared` `package.json`:

- Change test script to `"test": "vitest run --passWithNoTests"`.
- Add lint-staged config:
  - `apps/web`: `"lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"] }`
  - `apps/api`: `"lint-staged": { "*.ts": ["eslint --fix", "prettier --write"] }`
  - `packages/shared`: `"lint-staged": { "*.ts": ["eslint --fix", "prettier --write"] }`

### 3.12 `apps/api/mikro-orm.config.ts` — Neon SSL fix

MikroORM drops query params from `clientUrl`, so `sslmode=require` never
reaches the pg driver and Neon rejects the connection. Template must ship:

```ts
const clientUrl = process.env['NEON_DATABASE_URL'];

export default defineConfig({
  clientUrl,
  // MikroORM drops query params from clientUrl, so sslmode=require must be
  // passed to the pg driver explicitly or Neon rejects the connection.
  driverOptions: clientUrl?.includes('sslmode=require') ? { connection: { ssl: true } } : undefined,
  // ... rest unchanged
});
```

Also add `"@mikro-orm/cli"` to `apps/api` devDependencies (same version range
as the other `@mikro-orm/*` packages) — without it, `pnpm migrate:create` /
`migrate:up` fail with `mikro-orm: command not found`.

### 3.13 `ARCHITECTURE.md` template — Environments section

Replace the current "Deployment" block in the pre-init placeholder with:

```markdown
### Deployment & Environments

One Neon Postgres project with three database branches mirroring the git flow:

| Git branch | Vercel environment | Neon branch  | GitHub environment |
| ---------- | ------------------ | ------------ | ------------------ |
| `main`     | Production         | `production` | `production`       |
| `staging`  | Preview (staging)  | `staging`    | `staging`          |
| local dev  | —                  | `dev`        | —                  |

- Local dev: `.env` `NEON_DATABASE_URL` → Neon `dev` branch (direct URL).
- Vercel runtime uses pooled (`-pooler`) connection strings; migrations use
  direct URLs.
- `.github/workflows/ci.yml` — format + lint + type-check + tests on push/PR
  to `staging`/`main`.
- `.github/workflows/migrate.yml` — applies MikroORM migrations using the
  matching GitHub environment's `NEON_DATABASE_URL` secret.
- Flow: local (`dev` branch) → merge to `staging` → merge to `main`.
```

### 3.14 `AGENTS.md` template — quick start + structure

- Repository structure block: add
  `.github/workflows/ CI (format+lint+type-check+test) + DB migration pipelines`
  and `.husky/ Pre-commit hook (lint-staged: eslint --fix + prettier)`.
- Quick start block: add
  `pnpm format # prettier --write (also runs on save + pre-commit + CI check)`.

### 3.15 `docs/STYLE_GUIDE.md` template — two additions

Monorepo rules section, add:

```markdown
- `packages/shared` must stay runtime-agnostic: it runs in both browser and
  Node, so no Node-only APIs (`Buffer`, `crypto`, `fs`, …)
```

New final section:

```markdown
## Formatting

Prettier (`.prettierrc`) is enforced mechanically — never hand-format or debate
style:

- editor: format-on-save via committed `.vscode/settings.json`
- pre-commit: husky + lint-staged run `eslint --fix` + `prettier --write` on
  staged files
- CI: `pnpm format:check` fails the build on unformatted files
- manual fix-up: `pnpm format`

ESLint owns correctness rules only; `eslint-config-prettier` disables anything
stylistic that would conflict with Prettier.
```

### 3.16 `.agents/skills/init-project/SKILL.md` — extend Phase 5 with environment setup

After the existing `vercel link` / `vercel env add` steps, add an
"Environment topology" step (skip gracefully if the founder declines staging):

1. **Git**: create and push a `staging` branch from `main`.
2. **Neon** (via `neon` CLI or MCP): in the founder's project, create branch
   `staging` (parent: `production`) and `dev` (parent: `staging`). Write the
   `dev` branch **direct** connection string into local `.env` as
   `NEON_DATABASE_URL`.
3. **GitHub**: create environments and secrets —
   `gh api repos/{owner}/{repo}/environments/staging -X PUT` (same for
   `production`), then
   `gh secret set NEON_DATABASE_URL --env staging --body "<staging direct URL>"`
   (same for `production` with the production direct URL).
4. **Vercel**: `vercel env add NEON_DATABASE_URL production` with the
   production **pooled** URL; `vercel env add NEON_DATABASE_URL preview staging`
   with the staging **pooled** URL (scoped to the `staging` git branch).
5. First push to `main`/`staging` runs CI + the initial migration
   automatically — tell the founder to verify with `gh run list`.

Also update Phase 5's initial-migration step: the migration is generated
locally (against the `dev` branch) and committed; staging/production get it
via the workflow, **not** by running `migrate:up` against them manually.

## 4. Validation (implementing agent must run all)

1. `pnpm install` — verify husky installs the hook
   (`git config core.hooksPath` → `.husky/_`).
2. `rm -rf packages/shared/dist apps/api/dist && pnpm check --force` — must
   pass (proves the turbo `^build` fix works from a clean state).
3. `pnpm build --filter=@morpheus/api --force` — must build shared first.
4. `pnpm format && pnpm format:check` — establish the baseline, then verify
   it is clean.
5. `pnpm validate` — all tasks green (tests pass with no test files).
6. Commit once with the hook active and confirm lint-staged runs.

## 5. Risks & Notes

- **eslint peer resolution**: with `eslint-config-prettier` added, pnpm may
  auto-install eslint 10 to satisfy the config package's `eslint >=9` peer
  range while apps pin `^9`. Harmless warnings today; pin the peer range to
  `^9` if it becomes noisy.
- **Baseline format commit**: run `pnpm format` once in the template so
  downstream projects never inherit a dirty baseline.
- **Vercel env timing**: env vars are snapshotted per deployment — vars added
  after a push do not apply until the next deployment. The init-project skill
  should set env vars **before** the first push.
- **Wildcard OAuth/preview URLs**: random Vercel preview URLs can never be
  OAuth origins; the stable staging domain is the place to test OAuth flows.
  Worth a line in the template ARCHITECTURE.md if the product uses OAuth.
