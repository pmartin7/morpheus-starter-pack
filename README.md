# Morpheus Starter Pack

**Ship your AI product in a weekend, not a quarter.**

Morpheus is a public GitHub repository that gives startup founders a production-grade
full-stack application skeleton — complete with AI chat, authentication, a database,
and an autonomous agent-powered development environment — so you can go from idea to
deployed prototype in a single sitting.

Fork it. Run one command. Answer a few questions. You're live.

---

## Table of Contents

- [Why Morpheus Exists](#why-morpheus-exists)
- [What You Get](#what-you-get)
- [How to Use Morpheus](#how-to-use-morpheus)
- [The Thesis](#the-thesis)
- [Prerequisites](#prerequisites)
- [Getting Started with Cursor](#getting-started-with-cursor)
- [Getting Started with Codex](#getting-started-with-codex)
- [What Happens During Init](#what-happens-during-init)
- [After Init: Your Development Loop](#after-init-your-development-loop)
- [Available Skills (Agent Commands)](#available-skills-agent-commands)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Optional Add-ons](#optional-add-ons)
- [FAQ](#faq)

---

## Why Morpheus Exists

Most founders who "vibe code" — building with AI assistants rather than writing every
line by hand — hit the same wall: the AI produces code that works in isolation but
collapses under its own weight. No structure. No conventions. No validation. Three
weeks in, the codebase is a maze of inconsistent patterns, duplicate logic, and
mysterious bugs that the AI can't fix because it can't understand the mess it created.

Morpheus solves this by giving you the scaffolding, guardrails, and agent harness
**before** you write a single line of product code. It's the difference between
building on a foundation and building on sand.

---

## What You Get

**A running application** with:

- AI chat interface (streaming responses via SSE)
- Firebase authentication (email/password + Google sign-in)
- REST API with user management and chat persistence
- Postgres database with migration support
- Auto-deploy to Vercel on every `git push`

**An agent operating system** with:

- 11 agent skills (research, plan, build, test, design, debug, and more)
- 4 specialist agent roles (staff engineer, AI engineer, bug fixer, designer)
- Documentation that agents can read and follow (architecture, style guide, testing
  conventions, logging rules, UI design system)
- Mechanical validation (`pnpm check` / `pnpm validate`) that catches mistakes
  before they ship
- Evaluation rubrics that keep agent output high-quality

**A tech stack optimized for prototyping at speed:**

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript + Tailwind v4 + shadcn/ui |
| Backend | NestJS + MikroORM + Neon Postgres |
| Auth | Firebase Auth |
| AI | Vercel AI SDK (Anthropic Claude or OpenAI) |
| Testing | Vitest |
| Logging | Pino (structured JSON) |
| Deploy | Vercel (automatic on push) |
| Monorepo | Turborepo + pnpm workspaces |

---

## How to Use Morpheus

You don't write most of the code here — you direct an AI agent that does. This
section gives you the mental model and the habits that make that work well.

### The mental model

Four pieces work together:

1. **Skills** are playbooks. Each one is a step-by-step workflow the agent
   follows for a specific job: researching a feature, planning it, building it,
   writing tests, fixing a bug, reviewing a design. You invoke a skill by typing
   its command in chat (e.g. `/research-feature`), and the agent runs the
   playbook instead of improvising.
2. **Agents** are specialists. Four expert roles live in `.agents/agents/`, and
   skills call on them automatically at review checkpoints — you never invoke
   them directly:
   - **Staff Engineer** — an opinionated technical reviewer. When you research a
     feature, it scores the options and picks a winner; when you plan one, it
     audits the plan for unneeded complexity and design bugs before you build.
   - **AI Engineer** — an AI-stack auditor. When a plan or build touches
     prompts, model calls, or retrieval, it reviews for token efficiency,
     output quality, and latency — and makes the judgement call when those
     three conflict.
   - **Bug Fixer Ninja** — a surgical diagnostician. The `/fix-bug` skill hands
     it your symptoms and a set of hypotheses; it reads the code, confirms or
     refutes each one with evidence, and proposes the minimal fix.
   - **Staff Designer** — a senior product designer. The `/design` skill sends
     it screenshots of your pages (desktop and mobile); it reviews them against
     the design system and returns concrete, actionable fixes.
3. **Docs** are the agent's memory. `AGENTS.md`, `ARCHITECTURE.md`, and `docs/`
   hold every convention and decision. Agents read them before acting — which is
   why keeping them accurate matters more than in a human-only codebase.
4. **Validation** is the safety net. `pnpm check` (lint + types) and
   `pnpm validate` (+ tests) run after every change, so mistakes are caught in
   seconds rather than discovered in production.

### The core loop

For any feature of real size, chain the four core skills:

```
/research-feature → /plan-feature → /build-plan → /generate-test
```

Research explores your codebase and proposes 2-3 approaches (with a Staff
Engineer verdict). Plan turns the winner into a file-by-file implementation
plan (audited again). Build implements it. Test writes tests in an independent
pass, so the tests check behavior rather than mirroring the implementation.

Small tweaks — copy changes, a new button, a config flag — don't need the
ceremony. Just describe them in chat and let the agent edit directly.

### Best practices

- **Describe behavior, not implementation.** "Users can update their display
  name" beats "create a PATCH endpoint with a Zod schema." The skills and docs
  already encode *how* things are built here; your job is to say *what*.
- **Match the ceremony to the change.** Multi-file features get the full
  research → plan → build → test loop. One-file tweaks go straight to chat.
  When in doubt, start with `/research-feature` — it's cheap and it thinks
  before you commit.
- **One task per conversation.** Agents do their best work with a focused
  context. Finish (or abandon) one feature before starting the next, and start
  a fresh chat for unrelated work.
- **Report bugs as symptoms, not diagnoses.** Give `/fix-bug` what you saw,
  what you expected, and how to reproduce it. Let the Bug Fixer Ninja find the
  cause — pre-diagnosing sends it down your rabbit hole instead of the right one.
- **Run `/design` whenever the UI changes.** It screenshots every route at
  desktop and mobile widths and has the Staff Designer review them — catching
  the visual regressions that lint and types never will.
- **Never skip validation.** If the agent didn't run `pnpm check`, ask for it.
  A green check after every change is what keeps an AI-built codebase from
  quietly rotting.
- **Keep the docs truthful.** When your product or conventions change, update
  `AGENTS.md` and `ARCHITECTURE.md` (or ask the agent to). Stale docs are worse
  than none — every future agent inherits the error.

The full command list, including utilities and optional add-ons, is in
[Available Skills](#available-skills-agent-commands).

---

## The Thesis

### Agents amplify patterns

AI coding agents don't invent architecture — they replicate whatever patterns they
find. If your repo has inconsistent conventions, the agent will produce more
inconsistency. If it has clean, documented patterns, the agent will follow them.

Morpheus gives agents a single canonical pattern for every concern: one validation
system (Zod), one component style (shadcn), one logging library (Pino), one test
runner (Vitest), one way to define entities, one way to handle auth. Agents don't
have to guess. They read the docs, follow the pattern, and produce code that fits.

### Repository knowledge is the system of record

Anything an agent can't access in its working context doesn't exist. No Slack
threads, no Google Docs, no "I told it last week." Every convention, every
architectural decision, every style rule lives in versioned markdown files that
agents read before they act.

### Mechanical enforcement over documentation

Rules that can be checked by a machine should be checked by a machine. `pnpm check`
runs linting and type-checking. `pnpm validate` adds tests. Agents run these
commands after every change. A broken build gets caught in seconds, not days.

### YAGNI, relentlessly

Morpheus includes exactly what you need to ship a working AI product prototype. No admin
panels, no role-based access control, no pagination, no dark mode, no
internationalization. Those are real features for real products — add them when you
need them, using the agent skills that are already wired up.

### Progressive disclosure for agents

Agents start at `AGENTS.md` (a table of contents, not an encyclopedia), then read
only the docs relevant to their task. No agent needs more than 2-3 documents to
operate. This keeps context windows focused and output quality high.

---

## Prerequisites

You'll need the following accounts and tools set up before running init.

### Accounts (all have free tiers)

| Service | What it's for | Sign up |
|---------|--------------|---------|
| **GitHub** | Code hosting | [github.com](https://github.com) |
| **Vercel** | Hosting and deployment | [vercel.com](https://vercel.com) — connect your GitHub account |
| **Neon** | Postgres database | [neon.tech](https://neon.tech) — create a project, copy the connection string |
| **Firebase** | Authentication | [console.firebase.google.com](https://console.firebase.google.com) — create a project, enable Email/Password + Google sign-in |
| **Anthropic** or **OpenAI** | AI model provider | [console.anthropic.com](https://console.anthropic.com) or [platform.openai.com](https://platform.openai.com) — get an API key |

### Tools (install on your machine)

| Tool | Install |
|------|---------|
| **Node.js** (v20+) | [nodejs.org](https://nodejs.org) or `brew install node` |
| **pnpm** | `npm install -g pnpm` |
| **Git** | Comes with macOS; Windows: [git-scm.com](https://git-scm.com) |
| **GitHub CLI** | `brew install gh` then `gh auth login` |
| **Vercel CLI** | `npm install -g vercel` then `vercel login` |

### AI coding environment (pick one)

| Tool | Best for | Cost |
|------|----------|------|
| **Cursor** | Interactive development — you watch the agent work, approve changes, steer direction in real time | Free tier available; Pro $20/mo |
| **Codex** | Autonomous tasks — you describe what you want, walk away, come back to a pull request | Requires OpenAI API credits |

---

## Getting Started with Cursor

Cursor is an AI-powered code editor. You'll interact with it conversationally —
type commands in the chat panel, and the agent reads your codebase, writes code,
runs tests, and asks you questions when it needs input.

### Step 1: Fork and clone

1. Go to the Morpheus repository on GitHub
2. Click **Fork** (top right) to create your own copy
3. Open a terminal and clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/morpheus-starter.git
cd morpheus-starter
```

### Step 2: Open in Cursor

1. Download Cursor from [cursor.com](https://cursor.com) if you haven't already
2. Open Cursor
3. **File → Open Folder** → select the `morpheus-starter` folder you just cloned
4. Cursor will detect the project's agent configuration automatically

### Step 3: Run the init skill

1. Open the Cursor chat panel (Cmd+L on Mac, Ctrl+L on Windows)
2. Make sure you're in **Agent mode** (check the mode selector at the bottom of
   the chat panel)
3. Type this command and press Enter:

```
/init-project
```

4. The agent will ask you 5-8 questions about your product:
   - What does your product do?
   - Who is your target user?
   - Do you need AI chat? (yes — it's pre-wired)
   - Which AI provider? (Anthropic Claude or OpenAI)
   - Do you need file uploads?
   - Do you need vector search?
   - What's your project name?
   - Confirm you have GitHub + Vercel accounts ready

5. Answer each question. The agent will then:
   - Generate your `AGENTS.md` and `ARCHITECTURE.md` with your product context
   - Optionally customize your UI colors and fonts
   - Create your GitHub repository
   - Install all dependencies
   - Run your first database migration
   - Configure Vercel environment variables
   - Deploy your app
   - Print your live URL

**That's it. Your app is live.**

### Step 4: Start building

Now you have a deployed app with auth, chat, and a database. To add features,
use the agent skills described in [Available Skills](#available-skills-agent-commands).

For example, to add a new feature:

```
/research-feature I want to add a document upload feature where users can upload
PDFs and the AI can answer questions about them
```

The agent will research approaches, present options, and guide you through
implementation — all while following the conventions already in your codebase.

---

## Getting Started with Codex

OpenAI Codex is an autonomous coding agent that runs in the cloud. You give it a
task, it works independently, and delivers the result as a set of file changes (or
a pull request). It's best for well-defined tasks where you don't need to steer
in real time.

### Step 1: Fork and clone

Same as the Cursor workflow:

```bash
# Fork the repo on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/morpheus-starter.git
cd morpheus-starter
```

### Step 2: Initial setup (manual, one-time)

Because Codex runs autonomously without the interactive question-and-answer flow
that the `init-project` skill uses in Cursor, you'll do the initial configuration
manually. This takes about 10 minutes.

**Install dependencies:**

```bash
pnpm install
```

**Set up environment variables:**

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in your values:

```bash
# Database (from Neon dashboard)
NEON_DATABASE_URL=postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/dbname?sslmode=require

# Firebase (from Firebase console → Project Settings → Service Accounts)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Firebase client config (from Firebase console → Project Settings → General → Your apps)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id

# AI provider (pick one or both)
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# Model to use (format: provider:model-id)
DEFAULT_AI_MODEL=anthropic:claude-3-5-sonnet-20241022

# Node environment
NODE_ENV=development
```

**Run the database migration:**

```bash
pnpm migrate:up
```

**Verify everything works locally:**

```bash
pnpm dev
```

Open `http://localhost:5173` in your browser. You should see the landing page.

**Connect to Vercel and deploy:**

```bash
vercel link
vercel env add NEON_DATABASE_URL
# (repeat for each env var)
vercel deploy --prod
```

**Push to GitHub to enable auto-deploy:**

```bash
git add -A && git commit -m "Initial configuration" && git push
```

From this point on, every `git push` to `main` triggers an automatic Vercel
deployment.

**Update AGENTS.md and ARCHITECTURE.md:**

Open `AGENTS.md` in your text editor. Replace the placeholder "Product Context"
section with a description of your product, your target users, and your domain
terms. Do the same for `ARCHITECTURE.md` — update the route map and entity model
to match your product. These files are what the AI agents read to understand your
project, so accuracy matters.

### Step 3: Use Codex for feature development

With the repo configured and deployed, you can now use Codex to build features
autonomously. Open the Codex interface (via OpenAI's dashboard or CLI) and point
it at your repository.

**Example task:**

> Add a /settings page where users can update their display name. Follow the
> conventions in AGENTS.md and docs/STYLE_GUIDE.md. Run pnpm check when done.

Codex will:
1. Read `AGENTS.md` to understand the project
2. Read the relevant docs (style guide, architecture)
3. Implement the feature following established patterns
4. Run `pnpm check` to validate
5. Deliver the changes for your review

**Tips for effective Codex prompts:**

- Always tell it to read `AGENTS.md` first (or reference it)
- Mention which docs are relevant (e.g., "follow docs/STYLE_GUIDE.md")
- Ask it to run `pnpm check` or `pnpm validate` when done
- Be specific about behavior, not implementation ("users can update their name"
  not "create a PATCH endpoint with a Zod schema")
- For complex features, break them into smaller tasks

### Codex setup file (AGENTS.md)

Codex uses `AGENTS.md` at the repository root as its primary instruction file.
This is already included and pre-configured in the starter pack. After you
customize it with your product context (Step 2 above), Codex will understand
your project's architecture, conventions, and constraints automatically.

---

## What Happens During Init

The `init-project` skill (Cursor) or manual setup (Codex) configures these pieces:

| Step | What | Why |
|------|------|-----|
| Product questions | Captures your product's purpose, users, and needs | Agents need context to make good decisions |
| `AGENTS.md` generation | Creates the master agent instruction file | Every agent reads this first |
| `ARCHITECTURE.md` generation | Documents routes, entities, data flows | Agents need to know where things live |
| `pnpm install` | Installs all dependencies | Required to build and run |
| Database migration | Creates User, Conversation, Message tables | The app needs a schema to function |
| Vercel linking + env vars | Connects your repo to Vercel hosting | Enables auto-deploy on push |
| First deploy | Ships your app to a live URL | You're live from minute one |

---

## After Init: Your Development Loop

The day-to-day workflow follows a consistent pattern, whether you're using Cursor
or Codex:

```
Think about what you want to build
        ↓
/research-feature  (explore options, get staff review)
        ↓
/plan-feature      (detailed implementation plan)
        ↓
/build-plan        (agent implements the plan)
        ↓
/generate-test     (separate agent writes tests)
        ↓
git push           (auto-deploys to Vercel)
        ↓
Repeat
```

You don't have to use every step for every change. Small tweaks can go straight
to implementation. But for anything that touches multiple files or introduces a
new concept, the research → plan → build → test cycle keeps the codebase clean.

**Key commands to remember:**

```bash
pnpm dev          # Start local development (web + API)
pnpm check        # Lint + type-check (run after every change)
pnpm validate     # Lint + type-check + tests (run before shipping)
pnpm test         # Run tests only
pnpm build        # Production build
```

---

## Available Skills (Agent Commands)

Type these in the Cursor chat panel. For Codex, include the skill name and
purpose in your task description.

### Core workflow

| Command | What it does |
|---------|-------------|
| `/init-project` | One-time setup wizard — configures your app and deploys it |
| `/research-feature` | Researches a feature idea — explores the codebase, proposes 2-3 options, gets staff-level review |
| `/plan-feature` | Creates a detailed implementation plan from research |
| `/build-plan` | Implements a plan — builds in dependency order, validates with `pnpm check` |
| `/fix-bug` | Diagnoses a bug — forms hypotheses, tests them against code, recommends a fix |
| `/generate-test` | Writes tests for existing code — runs independently from the implementer |
| `/design` | Reviews or proposes UI design — takes browser screenshots, checks against design system |

### Utilities

| Command | What it does |
|---------|-------------|
| `/add-logs` | Adds structured logging at specific locations following logging conventions |
| `/create-pr` | Generates a PR description from your git diff and conversation history |

### Add-ons (optional integrations)

| Command | What it does |
|---------|-------------|
| `/add-vector-store` | Wires up Turbopuffer for vector search (e.g., semantic search over chat history) |
| `/add-blob-storage` | Wires up Vercel Blob for file uploads (e.g., PDF upload and processing) |

---

## Architecture at a Glance

```
morpheus-starter/
├── apps/
│   ├── web/                 Vite + React SPA (port 5173)
│   │   ├── src/
│   │   │   ├── app/         Router, providers, layout
│   │   │   ├── features/    Auth, chat (feature-based folders)
│   │   │   ├── components/  Shared UI primitives (shadcn-style)
│   │   │   ├── lib/         Firebase, API client, logger, utilities
│   │   │   ├── pages/       Route-level pages (thin shells)
│   │   │   └── styles/      Tailwind v4 theme (globals.css)
│   │   └── index.html
│   │
│   └── api/                 NestJS REST API (port 3000)
│       ├── src/
│       │   ├── common/      Base entity, auth guard, Zod pipe, filters
│       │   ├── users/       User entity + service + controller
│       │   ├── chat/        Conversation/Message entities + service + controller
│       │   ├── ai/          Vercel AI SDK integration (streaming)
│       │   ├── health/      Health check endpoint
│       │   └── config/      Env validation, MikroORM config
│       ├── migrations/      MikroORM database migrations
│       └── vercel.json      Serverless function routing
│
├── packages/
│   ├── shared/              Zod schemas + TypeScript types (cross-app contract)
│   ├── tsconfig/            Shared TypeScript configs
│   └── eslint-config/       Shared ESLint configs
│
├── docs/                    Agent-readable documentation
│   ├── STYLE_GUIDE.md       Code conventions
│   ├── TESTING.md           Test philosophy and setup
│   ├── LOGGING.md           Logging rules and levels
│   └── UI_DESIGN.md         Visual identity and component patterns
│
├── .agents/                 Agent OS — source of truth
│   ├── skills/              Agent skill definitions (11 skills)
│   ├── rules/               Always-on agent rules
│   ├── agents/              Specialist agent role definitions
│   └── tmp/                 Agent scratch space
│
├── .cursor/
│   ├── skills/              → symlink to .agents/skills/
│   └── rules/               → symlink to .agents/rules/
│
├── AGENTS.md                Agent entry point (table of contents)
├── ARCHITECTURE.md          System topology and data flows
├── turbo.json               Turborepo task pipeline
└── pnpm-workspace.yaml      Monorepo workspace config
```

### Data flows

**Authentication:**
Browser → Firebase SDK → JWT → API auth guard → verify token → sync user to Postgres

**Chat streaming:**
Browser → `useChat` hook → `POST /api/chat/send` → AI SDK `streamText` → SSE back to client

**Deployment:**
`git push` to `main` → Vercel detects push → builds monorepo → deploys web (static) + API (serverless function)

---

## Optional Add-ons

These are not included by default. Add them when your product needs them.

### Vector search (Turbopuffer)

If your product needs semantic search — finding similar content, answering
questions about documents, searching chat history by meaning — run:

```
/add-vector-store
```

This wires up [Turbopuffer](https://turbopuffer.com) (managed vector database)
with embedding generation via the Vercel AI SDK.

### File uploads (Vercel Blob)

If your product needs file storage — user uploads, document processing, image
handling — run:

```
/add-blob-storage
```

This wires up [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) with
upload endpoints and a File entity in the database.

---

## FAQ

**Q: Do I need to know how to code?**

Not really. Morpheus is designed for founders who work primarily through AI coding
assistants. You describe what you want in plain English, and the agent implements
it. That said, you'll benefit from understanding basic concepts like "database,"
"API," and "deploy" — the same way you'd benefit from understanding "equity" and
"cap table" even if your lawyer handles the paperwork.

**Q: How much does this cost to run?**

All services have free tiers that are generous enough for prototyping:
- **Vercel**: free tier includes automatic deploys
- **Neon Postgres**: free tier includes 0.5 GB storage, scales to zero
- **Firebase Auth**: free for up to 50k monthly active users
- **Anthropic/OpenAI**: pay-per-use; a day of active development costs ~$5-20 in API calls
- **Cursor**: free tier available; Pro is $20/month
- **Codex**: uses OpenAI API credits

**Q: Can I switch from Cursor to Codex (or vice versa)?**

Yes. The agent operating system (AGENTS.md, docs, skills) works with both.
Cursor is better for interactive exploration and real-time steering. Codex is
better for well-defined autonomous tasks. Many founders use both: Cursor for
exploring and designing, Codex for executing.

**Q: What if the agent breaks something?**

Every change goes through `pnpm check` (lint + type-check) before it's
considered done. If tests exist, `pnpm validate` runs those too. And because
everything is in Git, you can always roll back:

```bash
git log --oneline        # see recent commits
git revert HEAD          # undo the last commit
```

**Q: Can I deploy somewhere other than Vercel?**

The starter pack is optimized for Vercel because it's the simplest path from
`git push` to live URL. You could adapt it to other platforms (Cloudflare,
Railway, Fly.io), but you'd need to change the deployment configuration
yourself — or ask the agent to help.

**Q: What if I don't need AI chat?**

The init-project skill asks whether you need AI chat. If you say no, the chat
module and AI integration are excluded from your generated architecture docs,
though the code remains in the repo (unused code gets tree-shaken in production
builds, or you can ask the agent to remove it).

**Q: How do I add a new database table?**

Ask the agent:

```
/research-feature I need to track user projects. Each project has a name,
description, and belongs to a user. Research the best approach.
```

It will create a new entity extending `BaseEntity`, add a MikroORM migration,
create a service and controller, and wire everything up following the existing
patterns.

**Q: What's the difference between "skills" and "agents"?**

**Skills** are workflows — step-by-step instructions for accomplishing a task
(like "research a feature" or "write tests"). **Agents** are specialist roles
(like "staff engineer" or "bug fixer") that skills delegate to for expert
evaluation. Think of skills as the playbook and agents as the specialists on
the team.

---

## Credits

Morpheus was built by [Pierre Martin](https://pierre-martin.com), drawing on patterns
proven across production deployments at companies building with AI. The agent
operating system is informed by [OpenAI's harness engineering](https://openai.com/index/harness-engineering/)
principles and years of running autonomous coding workflows.

---

*Fork it. Init it. Ship it.*
