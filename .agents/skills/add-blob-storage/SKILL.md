# add-blob-storage

Wires Vercel Blob file storage into the app. Adds upload endpoint, File entity, and auth protection.

Read AGENTS.md and ARCHITECTURE.md before starting.

## Step 1 — Install

```bash
pnpm --filter=@morpheus/api add @vercel/blob
```

## Step 2 — Add Env Var

`BLOB_READ_WRITE_TOKEN` is already in the env schema (optional). Make it required:

Update `packages/shared/src/schemas/env.ts`:

```typescript
BLOB_READ_WRITE_TOKEN: z.string().min(1),
```

Add to `.env.example`:

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

## Step 3 — Create File Entity

Create `apps/api/src/upload/entities/file.entity.ts`:

- Extends BaseEntity
- `url` (string) — Vercel Blob URL
- `filename` (string)
- `contentType` (string)
- `size` (number)
- `@ManyToOne(() => User) uploadedBy`

## Step 4 — Create UploadService

Create `apps/api/src/upload/upload.service.ts`:

- `upload(user, file: Express.Multer.File)`: put to Vercel Blob, persist File entity, return URL
- `getFiles(user)`: list user's uploaded files

## Step 5 — Create UploadModule

Create `apps/api/src/upload/upload.module.ts` with controller `POST /api/upload` (multipart/form-data, protected by FirebaseAuthGuard).

## Step 6 — Update Docs

Update `ARCHITECTURE.md`:

- Add File entity to entity model
- Add upload flow to data flow section
