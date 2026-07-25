# add-logs

Insert structured logging at specified locations following docs/LOGGING.md conventions.

Read AGENTS.md and docs/LOGGING.md before starting.

## Step 1 — Clarify

Ask:

1. Where should logs be added? (file paths or feature description)
2. What events need to be logged? (or: "follow LOGGING.md conventions")
3. API (nestjs-pino) or web (pino/browser)?

## Step 2 — Read

Read:

- `docs/LOGGING.md` — levels, what to log, what not to log, required context fields
- The target files

## Step 3 — Add Logs

Follow LOGGING.md conventions:

- Use `this.logger` (injected PinoLogger) in NestJS services/guards
- Use the `logger` from `src/lib/logger.ts` in web code
- Log at appropriate levels (info for success, warn for degraded, error for failures)
- Include required context fields: requestId, userId, entityId where available
- Never log secrets, tokens, or full payloads

## Step 4 — Report

List every log statement added with:

- File path
- Log level
- Event description
- Context fields included
