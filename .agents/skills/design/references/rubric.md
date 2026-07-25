# Design Evaluation Criteria

Score 1–5 on each criterion.

## 1) Visual Hierarchy

Is the most important information the most prominent? Does the eye know where to go?

## 2) Consistency with Design System

Do colors, typography, and spacing match `docs/UI_DESIGN.md`? No ad-hoc values.

## 3) Mobile Layout

Does the layout work at 375px? No horizontal overflow. Tap targets ≥ 44px.

## 4) Interaction States

Are all states handled: default, hover/focus, loading, empty, error?

## 5) Accessibility

Sufficient color contrast (≥ 4.5:1 for body text). Keyboard navigable. Semantic HTML.

## 6) Content Clarity

Is the copy clear and concise? No jargon. Action labels describe the action.

## 7) Whitespace

Is whitespace used intentionally? No cramped sections. No excessive padding.

## 8) Component Reuse

Are shadcn-style primitives used? No new component library introduced.

## 9) Performance Perception

Does the design account for loading states? No layout shift on data load.

## 10) Distinctiveness & Brand Expression

Does the design express this product's brand, or could any product ship it?
Stock template palette/type/layout unmodified scores 1. At least one
memorable, brand-specific element (mark, type voice, color story, layout
attitude) is required for ≥4.
