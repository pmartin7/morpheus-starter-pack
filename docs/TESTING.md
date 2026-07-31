# TESTING.md

Testing conventions for this repository.

## 1) Framework

Vitest for all apps and packages. One test runner, one config pattern.

| App             | Plugin                           | Environment |
| --------------- | -------------------------------- | ----------- |
| apps/api        | unplugin-swc (decorator support) | node        |
| apps/web        | —                                | jsdom       |
| packages/shared | —                                | node        |

Commands:

- `pnpm test` — all tests
- `pnpm --filter=@morpheus/api test` — API tests only (the filter has to precede
  the script name)
- `pnpm validate` — lint + type-check + tests

## 2) Philosophy

Test behavior, not implementation. Priorities:

1. Zod schema validation boundaries
2. Auth guard logic (token verification, user sync)
3. Service business logic (CRUD, ownership checks)
4. API contract (request shape → response shape)
5. Critical UI behavior (auth redirects, streaming state)

Do not over-test: NestJS decorator wiring, static markup, Tailwind classes.

## 3) Separate-Agent Workflow

Two-pass approach:

- Pass A: implement the feature
- Pass B: a separate agent writes tests via `write-tests` skill

Why: reduces "code shaped to satisfy tests" anti-pattern, improves independent
verification. This is the sub-agent pattern from
[Anthropic's context engineering guidance](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):
a fresh context window prevents the tester from inheriting the implementer's
assumptions.

## 4) File Placement

Colocate unit tests with source: `*.test.ts` / `*.test.tsx`.
Shared fixtures/helpers go under `src/test/` in each app.

## 5) Test Style

AAA pattern: Arrange, Act, Assert. One assert cluster per `it` block.
`vi.clearAllMocks()` in `beforeEach`. No shared mutable state.

## 6) Mocks

Mock at boundaries only:

- Firebase Admin SDK (`verifyIdToken`)
- Vercel AI SDK (`streamText`)
- MikroORM EntityManager (`find`, `create`, `flush`)

Prefer light fixtures over heavy mocks. Pure function tests first.

## 7) API Tests (NestJS)

Use `@nestjs/testing` `Test.createTestingModule()`:

```typescript
const module = await Test.createTestingModule({
  providers: [UsersService, { provide: EntityManager, useValue: mockEm }],
}).compile();
```

## 8) Web Tests (React)

Use `@testing-library/react` with jsdom. Assert on visible behavior:
screen queries, user events, navigation. No snapshot tests.

## 9) Worked Examples

Copy from these three rather than starting from scratch. One per package, one per
priority class, each written to be read as a template:

| File                                                     | Shows                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/schemas/env.test.ts`                | a Zod boundary: fresh fixture per test, plus the failure naming the missing variable                       |
| `apps/api/src/common/guards/firebase-auth.guard.test.ts` | `verifyIdToken` mocked at the boundary, a hand-built `ExecutionContext`, `onModuleInit` for `ModuleRef` DI |
| `apps/web/src/features/auth/protected-route.test.tsx`    | a redirect matrix asserted through `MemoryRouter` + a real `AuthContext.Provider`, not on mock calls       |

The `test` script in these three packages is plain `vitest run`: an empty suite
must fail. Keep `--passWithNoTests` only in a package that legitimately has none.

Note `packages/shared/tsconfig.json` excludes `**/*.test.ts` so tests stay out of
`dist` — `pnpm type-check` there does not check them, but `vitest` does.

## 10) Definition of Done

1. implementation complete
2. tests added in separate pass
3. `pnpm validate` passes
4. docs updated if patterns changed
