# create-pr-description

Generates a pull request description from git diff and conversation context.

## Phase 1 — Gather Evidence

Run these commands:

```bash
git branch --show-current
git log main..HEAD --oneline
git diff main..HEAD --stat
git diff main..HEAD
```

Read the output to understand:

- What files changed
- How many lines changed
- The commit history

## Phase 2 — Read Context

Read the current conversation to understand the intent behind the changes (what problem was being solved, what approach was chosen).

## Phase 3 — Draft and Write

Write the PR description to `.agents/tmp/pr-description.md`:

```markdown
## Description

[1–2 sentences: what this PR does and why]

## Overview

[3–5 bullet points: the key changes made]

## Changes

[File-by-file summary: path → what changed]

## Test plan

- [ ] pnpm check passes
- [ ] [specific behaviour to verify manually]
- [ ] [specific behaviour to verify manually]
```

Report the path to the file and print the description to the user.
