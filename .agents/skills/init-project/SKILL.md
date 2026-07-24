# init-project

Conversational setup wizard. Transforms a bare morpheus-starter clone into a configured, deployed product in one agent session.

Read AGENTS.md and ARCHITECTURE.md before starting.

## Phase 1 — Gather Product Context

Use the AskQuestion tool to collect:

1. Product name (used for GitHub repo name, display name in app)
2. One-sentence product description (used in AGENTS.md Product Context)
3. Target user (who uses this — developer, consumer, business team?)
4. Does the app need AI chat? (yes/no — if no, run Phase 5 removal checklist)
5. AI provider preference (Anthropic / OpenAI / both)
6. File upload needed? (yes/no — determines whether to run add-blob-storage)
7. Vector search needed? (yes/no — determines whether to run add-vector-store)
8. GitHub account confirmed + Vercel account confirmed? (prerequisite check)

## Phase 2 — Generate AGENTS.md

Rewrite `AGENTS.md` with:
- Section 1 (Product Context): product description, target user, domain glossary (5–10 key terms), editorial positioning
- Keep all other sections exactly as-is

## Phase 3 — Generate ARCHITECTURE.md

Rewrite `ARCHITECTURE.md` with:
- Route map updated for the product's actual pages
- Entity model updated if product needs additional entities
- Data flow section updated for the actual features
- Keep deployment and key invariants sections as-is

If chat is being removed (Phase 5), drop the `/chat` route from the route map,
the `Conversation` and `Message` entities from the entity model, and the Chat
line from the data flow section.

## Phase 4 — Customize UI_DESIGN.md (optional)

If the founder wants brand customization, ask for:
- Primary brand color (hex)
- Two brand adjectives (e.g. "precise, minimal")
- Any font preferences

Update `docs/UI_DESIGN.md` with the provided values, replacing {PLACEHOLDER} tokens.

## Phase 5 — Remove the Chat Feature (only if Phase 1 answered "no")

The chat feature is deliberately self-contained: one API module, one web
feature folder + route entry, one shared schema file, and dependencies used
only by it. Removal is mechanical — work through this checklist exactly. Do
**not** build a flag or plugin system for this; the checklist over a
well-isolated feature is enough.

**Delete entirely:**

- `apps/api/src/chat/` — controller, service, module, and
  `entities/conversation.entity.ts` + `entities/message.entity.ts`
- `apps/api/src/ai/` — `ai.module.ts` + `ai.service.ts`. This module is only
  consumed by chat; grep for `AiService` first to confirm nothing else was
  added that uses it
- `packages/shared/src/schemas/chat.ts`
- `apps/web/src/features/chat/` — entire folder
- `apps/web/src/pages/chat.tsx`

**Edit:**

- `apps/api/src/app.module.ts` — remove the `ChatModule` and `AiModule` import
  lines and both entries from the `imports` array
- `packages/shared/src/index.ts` — remove `export * from './schemas/chat.js';`
- `apps/web/src/app/router.tsx` — remove
  `import { ChatPage } from '../pages/chat.js';` and the
  `{ path: '/chat', element: <ChatPage /> }` route
- `apps/web/src/app/layout.tsx` — remove the `<Link to="/chat">` nav link in
  the signed-in branch
- `apps/web/src/pages/home.tsx` — the signed-in CTA links to `/chat` ("Open
  Chat"); repoint it at a product-appropriate page
- `apps/web/src/pages/login.tsx` — change the post-login `navigate('/chat')`
  to `navigate('/')`

**Dependencies:**

- `apps/web/package.json` — remove `@ai-sdk/react`
- `apps/api/package.json` — remove `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`

**Environment:**

- `packages/shared/src/schemas/env.ts` — remove `DEFAULT_AI_MODEL`,
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. `DEFAULT_AI_MODEL` is a required
  field, so leaving it in the schema breaks boot once the var is gone
- `.env.example` — remove the "AI Providers" block and the `DEFAULT_AI_MODEL`
  lines
- Skip the AI-related `vercel env add` lines in Phase 7

**Docs:**

- `ARCHITECTURE.md` — the Phase 3 rewrite must reflect the removal: no `/chat`
  route, no `Conversation`/`Message` entities, no Chat data-flow line

**Finish:** run `pnpm install` (prunes the lockfile), then `pnpm check`.

## Phase 6 — Preflight Checks

Run these before any provisioning step. Each one catches a failure that
otherwise stalls provisioning midway.

1. **GitHub CLI installed** — `gh --version`. If missing:
   `brew install gh`.
2. **GitHub CLI authenticated** — `gh auth status`. If unauthenticated, run
   `gh auth login` (device flow). Print the one-time code **prominently** to
   the user and keep polling for completion — expect the user to take several
   minutes to finish the browser flow. Do not fail fast.
3. **Vercel token fresh** — `npx vercel whoami`. On a 403 or any auth error,
   re-authenticate with `npx vercel login` before proceeding. A stale token
   otherwise surfaces as confusing API 403s mid-run.
4. **Vercel ↔ GitHub git connection** — when linking the repo to the Vercel
   project, attempt the git connection. If the API fails with "GitHub App not
   installed", give the user the install URL
   <https://github.com/apps/vercel>, then poll in a background loop until the
   connection succeeds. Do not fail the run — installation is a one-time
   browser action on the user's side.

## Phase 7 — Provision Infrastructure

Run these shell commands in sequence. Stop and report if any fails.

```bash
# Create GitHub repo
gh repo create {PROJECT_NAME} --public --source=. --remote=origin --push

# Install dependencies
pnpm install

# Link to Vercel
vercel link

# Add environment secrets
vercel env add NEON_DATABASE_URL production
vercel env add FIREBASE_PROJECT_ID production
vercel env add FIREBASE_PRIVATE_KEY production
vercel env add FIREBASE_CLIENT_EMAIL production
vercel env add DEFAULT_AI_MODEL production        # skip if chat removed
vercel env add ANTHROPIC_API_KEY production       # if anthropic
vercel env add OPENAI_API_KEY production          # if openai

# Run initial migration
pnpm migrate:up

# Push and deploy
git add .
git commit -m "feat: init project — {PROJECT_NAME}"
git push
vercel deploy --prod

# Validate the deployment — the final provisioning step.
# Do not proceed to handoff until this passes.
pnpm validate:deploy
```

`pnpm validate:deploy` runs the deployment validation harness: it checks the
latest deployments are READY, smoke-checks the live URLs, and runs a visual
check against production. If it fails, follow its remediation hints, fix, and
redeploy — a printed URL is not a verified deployment.

If the founder wants a custom domain, follow `docs/RUNBOOK_DOMAINS.md` — it
covers nameserver switch, propagation states that look like errors but aren't,
forced cert issuance for subdomains, redirect domains, and the Firebase
Authorized-domains step.

### Staging (Hobby plan default)

Do **not** create a Vercel custom environment for staging on the Hobby plan —
it fails with `Cannot create more than 0 custom environments`. Custom
environments are Pro-only; use them only when the team is on Pro.

The default staging recipe:

1. Create a long-lived `staging` git branch and push it:
   `git branch staging && git push -u origin staging`
2. Add a `staging.<domain>` domain to the Vercel project pinned to the
   `staging` branch — this gives branch-scoped Preview deployments a stable
   URL.
3. Scope staging env vars to the Preview environment:
   `vercel env add <NAME> preview`

Preview deployments have Vercel SSO deployment protection enabled by default,
so an SSO redirect on the staging URL is **expected** — harnesses and docs
treat it as a pass with a note, not a failure.

## Phase 8 — Handoff

Only after `pnpm validate:deploy` passes, print:

1. Live URL from Vercel
2. GitHub repo URL
3. List of available skills with triggers (from AGENTS.md section 9)
4. Next suggested action: "Run /research-feature to plan your first feature"
