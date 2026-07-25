# UI_DESIGN.md

Visual identity for this application. Source of truth for colors, typography,
spacing, and component patterns.

> **Lockstep rule:** the token table below and the `@theme` block in
> `apps/web/src/styles/globals.css` always describe the same values. Any skill
> or edit that changes one MUST change the other in the same pass. Grep for
> every hex value in this file — each must appear in `globals.css`, and vice
> versa.

## 1) Design North Star

- clean and modern
- mobile-first
- content over chrome
- every element earns its place
- {BRAND_ADJECTIVE_1}, {BRAND_ADJECTIVE_2} (set by init-project)

## 2) Design Tokens

All UI code uses these tokens (as Tailwind utilities: `text-ink`, `bg-card`,
`border-border`, …). Raw palette utilities (`text-gray-900`, `bg-white`,
`text-red-500`, …) are forbidden — restyling the app must only ever require
editing the token values in `globals.css`.

| Token              | Value   | Usage                             |
| ------------------ | ------- | --------------------------------- |
| primary            | #3B82F6 | interactive elements only         |
| primary-hover      | #2563EB | hover state of primary elements   |
| primary-foreground | #FFFFFF | text/icons on primary backgrounds |
| surface            | #FAFAFA | page background                   |
| surface-alt        | #F1F5F9 | section alternation, subtle fills |
| card               | #FFFFFF | cards, nav, elevated surfaces     |
| ink                | #1A1B1E | body text, headings               |
| ink-muted          | #64748B | metadata, captions, placeholders  |
| border             | #E5E7EB | default borders and dividers      |
| border-strong      | #D1D5DB | emphasized borders                |
| destructive        | #EF4444 | error states, destructive actions |

Primary color is for interactive elements only — never backgrounds, never body
text.

## 3) Typography

Font tokens in `globals.css` (same lockstep rule as colors):

| Token          | Font             | Use                                      |
| -------------- | ---------------- | ---------------------------------------- |
| --font-sans    | Inter            | body, nav, buttons, metadata, all chrome |
| --font-display | Inter            | headings, hero copy                      |
| --font-mono    | system monospace | code, technical values                   |

V1 uses Inter for sans and display. Init-project sets product-specific fonts
(update the tokens **and** the `<link>` font loading in `apps/web/index.html`).

Minimum 14px for body text on mobile.

## 4) Brand Mark

The product mark lives in `apps/web/src/components/brand-mark.tsx` and is
rendered in the nav and on the login page. It is an inline SVG with path
outlines only — no webfont-dependent `<text>` elements, so rendering is
platform-independent. The starter ships a neutral geometric placeholder;
init-project replaces the SVG contents with the product's mark. Replacing that
one file changes the mark everywhere.

## 5) Spacing

8px base grid. Major section gaps: 48-64px. Component internal padding: 16-24px.
Mobile margins: 16px. Desktop margins: 24-32px.

## 6) Components

shadcn-style primitives only (cva + Radix Slot). Do not add a second component
library. See `apps/web/src/components/ui/` for available primitives.

## 7) Responsive

Mobile-first utility classes. Breakpoints: sm (640px), md (768px), lg (1024px).
Max layout width: 1200px.
