# add-vector-store

Wires Turbopuffer vector search into the app. Adds embedding generation via Vercel AI SDK and upsert/query endpoints.

Read AGENTS.md and ARCHITECTURE.md before starting.

## Step 1 — Install

```bash
pnpm --filter=@morpheus/api add @turbopuffer/client
```

## Step 2 — Add Env Var

Add to `packages/shared/src/schemas/env.ts`:

```typescript
TURBOPUFFER_API_KEY: z.string().min(1),
TURBOPUFFER_NAMESPACE: z.string().default('default'),
```

Add to `.env.example`:

```
TURBOPUFFER_API_KEY=tpuf_...
TURBOPUFFER_NAMESPACE=my-namespace
```

## Step 3 — Create VectorService

Create `apps/api/src/vector/vector.service.ts`:

- `upsert(id, text, metadata)`: generate embedding via `embedMany()` from Vercel AI SDK, upsert to Turbopuffer
- `query(text, topK)`: generate query embedding, query Turbopuffer, return results with scores

## Step 4 — Create VectorModule

Create `apps/api/src/vector/vector.module.ts`:

- Provides VectorService, exports VectorService
- Import in AppModule

## Step 5 — Add Endpoints

Add to the relevant module's controller:

- `POST /api/vector/upsert` — upsert a document
- `POST /api/vector/query` — semantic search

Both protected by FirebaseAuthGuard.

## Step 6 — Update Docs

Update `ARCHITECTURE.md`:

- Add VectorService to the data flow section
- Note: embeddings generated via Vercel AI SDK, stored in Turbopuffer
