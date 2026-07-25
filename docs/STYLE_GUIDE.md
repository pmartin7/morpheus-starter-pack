# STYLE_GUIDE.md

Cross-cutting code conventions for this repository.

## 1) Guiding Philosophy

- explicit over implicit
- simple over abstract
- flat over nested
- readable over clever
- one pattern per concern
- YAGNI: no abstractions for hypothetical futures

## 2) Exports

Named exports only. No default exports.

## 3) TypeScript

- strict mode
- explicit return types on public functions
- prefer `type` for unions/computed types
- prefer `interface` for object shapes
- use `satisfies` when preserving literal inference matters
- no `any` unless localized and unavoidable

## 4) Naming

| Kind                | Convention           | Example            |
| ------------------- | -------------------- | ------------------ |
| files               | kebab-case           | `user.service.ts`  |
| components          | PascalCase           | `ChatInput`        |
| hooks               | `use-*`              | `use-auth.ts`      |
| schemas             | `*Schema`            | `CreateUserSchema` |
| constants           | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`  |
| variables/functions | camelCase            | `getOrCreate`      |

## 5) Imports

Order: (1) third-party, (2) `@morpheus/` packages, (3) `@/` aliases, (4) relative.
Prefer `@/` aliases for app code. No deep `../../../` chains.
Cross-app types: import from `@morpheus/shared`.

## 6) React

- functional components only
- never define components inside components
- extract non-trivial logic into hooks
- keep route files thin (compose features, don't implement logic)
- prefer composition over prop explosion

## 7) Validation

Zod is the single validation system. See Golden Principle #2 in AGENTS.md.
No class-validator, no class-transformer.

- schema names end in `Schema`
- co-export inferred types: `type CreateUser = z.infer<typeof CreateUserSchema>`
- use `safeParse` for external data
- use `.parse` only when input is already guaranteed

## 8) NestJS Conventions

- controllers: thin, validate input via ZodValidationPipe, delegate to services
- services: own business logic, inject EntityManager
- guards: cross-cutting auth concerns
- modules: register entities, provide services, export what others need
- no class-validator decorators on DTOs — Zod schemas in @morpheus/shared

## 9) Monorepo Rules

- `packages/shared` is the only cross-app runtime package
- `packages/shared` must stay runtime-agnostic: it runs in both browser and
  Node, so no Node-only APIs (`Buffer`, `crypto`, `fs`, …)
- packages must build (tsc) before consuming apps
- never import from `apps/api` in `apps/web` or vice versa
- shared types live in `@morpheus/shared`, not duplicated per app

## 10) Formatting

Prettier (`.prettierrc`) is enforced mechanically — never hand-format or debate
style:

- editor: format-on-save via committed `.vscode/settings.json`
- pre-commit: husky + lint-staged run `eslint --fix` + `prettier --write` on
  staged files
- CI: `pnpm format:check` fails the build on unformatted files
- manual fix-up: `pnpm format`

ESLint owns correctness rules only; `eslint-config-prettier` disables anything
stylistic that would conflict with Prettier.
