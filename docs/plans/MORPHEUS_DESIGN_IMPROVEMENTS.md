# Morpheus Starter — Design Quality Improvement Plan

**Audience:** an agent working in the `morpheus-starter` repository.
**Source:** retrospective of a real `/init-project` run (yagyu.app) that shipped
with rich brand context — "clean, simple, modern, slick yet quirky and geeky,
with the spirit of the Samurai embodied" — yet deployed a UI indistinguishable
from a Bootstrap template: stock blue `#3B82F6` buttons, gray borders,
Inter-everywhere, centered hero. The brand had to be retrofitted later in a
separate `/design` session. This plan removes the causes so the next init
ships a distinctive UI on day one.

---

## Why init produced a generic design (root causes)

Each cause below maps to a numbered fix in the next section.

1. **Design is a docs-only, optional phase.** `init-project` Phase 4
   ("Customize UI*DESIGN.md") is literally marked *(optional)\_, collects only
   a hex color + two adjectives + font preferences, and its sole action is
   replacing `{PLACEHOLDER}` tokens in `docs/UI_DESIGN.md`. **No code is
   modified.** In the observed run this produced an immediate docs/code
   divergence: the doc said indigo `#4F46E5`, while `globals.css` kept
   shipping stock blue `#3B82F6`. Nothing ever reconciled them. → Fix 1, 2
2. **The starter is not actually tokenized.** Pages and primitives hardcode
   `text-gray-900`, `border-gray-200`, `bg-white`, `text-red-500` instead of
   theme tokens. Even a perfect Phase 4 that updated `@theme` values would
   have restyled almost nothing. The "design system" was cosmetic. → Fix 3
3. **Init never looks at the app.** No screenshots, no rendered check, no
   design review anywhere in the init flow. An agent that never sees the UI
   cannot notice it looks like a template. (The later `/design` session
   caught issues precisely because it screenshotted at 1280px/375px and ran
   a staff-designer review — twice.) → Fix 2, 5
4. **The design workflow exists but init doesn't invoke it.** The repo ships
   a `/design` skill with a staff-designer agent and evaluation criteria —
   exactly the machinery that later produced the good outcome — but
   `init-project` neither calls it nor borrows its structure. → Fix 2
5. **The evaluation criteria cannot fail a generic design.** All nine
   criteria in `design-evaluation-criteria.md` measure correctness
   (hierarchy, contrast, states, consistency). A stock-template page scores
   4–5 across the board. There is no axis for distinctiveness or brand
   expression, so "lame but correct" passes review. → Fix 4
6. **Brand adjectives have no conversion mechanism.** AGENTS.md captured
   "quirky, geeky, samurai spirit," but no step translates adjectives into
   palette/typography/layout decisions. Two adjectives and one hex value is
   far too little input to derive an identity from — and nothing prompts
   research into what the adjectives should _mean_ visually. → Fix 2
7. **The template's defaults are the strongest force in the room.** Centered
   hero, blue CTA, white nav: when no step forces a decision, defaults ship.
   There is no explicit rule that shipping the stock look unmodified is a
   failure. → Fix 2, 6

---

## Fixes

### Fix 1 — Make UI_DESIGN.md and `globals.css` a single system

**Change:** restructure so the token table in `docs/UI_DESIGN.md` and the
`@theme` block in `apps/web/src/styles/globals.css` always describe the same
values. Add a comment header in each pointing at the other. Any skill that
edits one must edit both (state this rule in both files and in AGENTS.md
anti-patterns: "change design tokens in globals.css without updating
UI_DESIGN.md, or vice versa").

**Acceptance:** grep for every hex value in UI_DESIGN.md finds it in
globals.css and vice versa, on a fresh clone and after a test init run.

### Fix 2 — Replace init Phase 4 with a mandatory Visual Identity phase

**Change:** rewrite `/init-project` Phase 4 from "optional docs
customization" to a required phase with this structure:

1. **Gather** (in Phase 1's AskQuestion batch): brand adjectives (3–5), any
   color/font preferences, one reference product or aesthetic the founder
   likes, and explicitly what to avoid.
2. **Research:** one or two web searches — current design trends for the
   product's category, plus any brand-authentic visual vocabulary implied by
   the adjectives (e.g. "samurai/zen" → traditional Japanese palette and _ma_,
   not cherry-blossom kitsch). Note both what to adopt and which trend-traps
   to avoid (the generic dark-mode+neon look, glassmorphism, etc.).
3. **Propose:** 2–3 named design directions (palette + type pairing + layout
   attitude), each with a one-paragraph rationale. Recommend one. If the user
   pre-answered init questions, apply the recommendation without blocking.
4. **Apply in code:** update `@theme` tokens, font loading in `index.html`,
   the brand-mark component (see Fix 6), and the landing/login pages so the
   identity is expressed in layout and copy, not just colors.
5. **Verify:** screenshot at 1280px and 375px, view the screenshots, run the
   staff-designer agent in Mode C, fix must-fix issues, re-screenshot. Reuse
   the `/design` skill's phases rather than duplicating them — Phase 4 should
   essentially be "run a condensed /design pass."

Add an explicit anti-default rule to the skill: _"Shipping the template's
stock palette, fonts, and centered-hero layout unmodified is a failed init,
regardless of how little brand context was given. Derive something specific
or ask."_

**Acceptance:** a test init run with brand adjectives produces a UI whose
tokens, fonts, and landing layout all differ from the template defaults, with
screenshots and a staff-designer verdict recorded before deploy.

### Fix 3 — Tokenize the starter completely

**Change:** remove every raw palette utility from `apps/web` pages and
primitives. `text-gray-900` → `text-ink`, `text-gray-500` → `text-ink-muted`,
`border-gray-200` → `border-border`, `bg-white` → `bg-card`/`bg-surface`,
`text-red-500` → `text-destructive`, etc. Define the full token set in
`@theme`: surface, surface-alt, card, ink, ink-muted, primary, primary-hover,
destructive, border, border-strong, plus `--font-sans`, `--font-display`,
`--font-mono`. The shipped default values can stay neutral — the point is
that init only has to edit **one file** to restyle **every screen**.

**Acceptance:** `rg "gray-|red-|blue-|bg-white" apps/web/src` returns zero
palette-utility matches; changing the token values in globals.css visibly
restyles nav, pages, buttons, inputs, and cards with no other edits.

### Fix 4 — Add a distinctiveness criterion to the design review

**Change:** add a tenth criterion to
`.agents/skills/design/references/design-evaluation-criteria.md`:

```markdown
## 10) Distinctiveness & Brand Expression

Does the design express this product's brand, or could any product ship it?
Stock template palette/type/layout unmodified scores 1. At least one
memorable, brand-specific element (mark, type voice, color story, layout
attitude) is required for ≥4.
```

Update `staff-designer.md` principles to weigh it: correctness issues still
rank first, but a generic-looking design cannot receive plain "approve" —
at best "approve with minor changes" plus concrete distinctiveness
suggestions.

**Acceptance:** running the staff-designer against the unmodified starter
screenshots produces a sub-4 distinctiveness score and does not return plain
"approve."

### Fix 5 — Screenshot capability as a first-class harness

**Change:** the retrospective run had to write a throwaway Playwright script
to capture 1280px/375px screenshots (the validate-local harness only shoots
desktop). Add `harness/design-shots.mjs` permanently: boots or reuses the dev
server, captures full-page screenshots of every route at desktop (1280) and
mobile (375) into `harness/artifacts/design-<label>-<route>-<viewport>.png`,
with a `--label` argument for before/after comparisons. Wire it as
`pnpm design:shots`. Reference it from the `/design` skill (Phase 2) and from
init Phase 4 so no future session reinvents it. Note the stale-server trap
observed in practice: the script must kill or bypass a dev server whose
module graph predates the current edits (compare a served file hash or just
always restart when `--fresh` is passed).

**Acceptance:** `pnpm design:shots --label test` produces four PNGs on a
fresh clone; the `/design` and `init-project` skills reference the command.

### Fix 6 — Give identity a home in the component tree

**Change:** ship a `apps/web/src/components/brand-mark.tsx` placeholder
component (neutral geometric SVG by default) used in the nav and login card.
Init Phase 4 replaces its contents with the product's mark. This gives the
identity a canonical code location instead of a text-only wordmark that init
predictably leaves untouched. Document in UI_DESIGN.md: the mark is an inline
SVG with path outlines only — no webfont-dependent `<text>` elements, so
rendering is platform-independent.

**Acceptance:** nav and login render the component on a fresh clone;
replacing one file changes the mark everywhere.

---

## Suggested execution order

1. Fix 3 (tokenize) — mechanical, unblocks everything else.
2. Fix 1 (docs/code lockstep) + Fix 6 (brand-mark component) — small.
3. Fix 5 (design-shots harness) — port from the yagyu.app repo history if
   available; otherwise ~60 lines of Playwright.
4. Fix 4 (criteria + staff-designer weighting) — prose.
5. Fix 2 (init Phase 4 rewrite) — depends on all of the above.

The measure of success: run `/init-project` on a scratch clone with a
made-up brand ("a banking app for pirates — playful, trustworthy, nautical")
and confirm the deployed landing page could not be mistaken for the
unmodified template, with screenshots and a staff-designer verdict produced
during init itself.
