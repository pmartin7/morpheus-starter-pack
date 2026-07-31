# AUTH.md

Firebase Auth in this repository: who holds what, and the one invariant that
silently breaks the app when it is ignored.

Routes and their guards are listed in `ARCHITECTURE.md` § Route Map. Custom
domains are owned by `docs/RUNBOOK_DOMAINS.md`. This file owns the contract
between the browser and the API guard.

## 1) The Split

| Side                 | Owns                                                      |
| -------------------- | --------------------------------------------------------- |
| Browser (`apps/web`) | sign-up/in, the session, ID tokens, which routes render   |
| API (`apps/api`)     | verifying the token, refusing unverified, the `User` row  |
| Firebase             | accounts, the `email_verified` claim, the hosted verifier |

Client code lives in `apps/web/src/features/auth/` plus
`apps/web/src/lib/firebase.ts`; the server side is one file,
`apps/api/src/common/guards/firebase-auth.guard.ts`.

The API never trusts what the browser says about itself. Identity and
verification both come out of the signed token.

## 2) The Token-Claim Invariant

Two values look like "is this email verified". They are not the same value and
they diverge routinely:

| Value                               | Refreshed by    | Read by                          |
| ----------------------------------- | --------------- | -------------------------------- |
| `user.emailVerified` — account flag | `reload()`      | nothing, bar the gap check below |
| `email_verified` — ID token claim   | a token refresh | the API guard, `AuthProvider`    |

`reload()` moves the flag and leaves the cached ID token untouched. A token
minted before verification keeps claiming `email_verified: false` until it
expires, roughly an hour later. **The API guard reads the claim.**

So: derive verification from the claim, never from the account flag. A client
that gates on the flag renders a fully verified UI whose every API call 401s —
and because the guard is the only thing that creates the `User` row (§3), no
row is ever created either, so the failure presents as a missing database
record rather than as an auth bug.

Three sites implement the rule. Keep them that way:

- `auth-provider.tsx` derives `emailVerified` from `getIdTokenResult()` claims
  and subscribes with `onIdTokenChanged`, not `onAuthStateChanged`, so every
  token refresh re-derives it. `loading` stays `true` until the claim resolves —
  a guard that decides earlier sends a verified user to `/verify-email`.
- `refreshUser()` in `use-auth.ts` is the only reader of `user.emailVerified`,
  and only to detect the gap: flag true plus claim false forces
  `getIdTokenResult(current, true)`, which also fires `onIdTokenChanged`.
- `getToken()` returns the cached token only when its claim is `true`, and
  spends a forced refresh otherwise. Never send `user.getIdToken()` unforced.

`rg "\.emailVerified" apps/web/src` should find the one site in `refreshUser()`.
Anything more is a regression.

## 3) The Guard

`FirebaseAuthGuard` runs on every controller carrying
`@UseGuards(FirebaseAuthGuard)`, in this order:

1. no `Authorization: Bearer …` header →
   401 `Missing or invalid Authorization header`
2. `verifyIdToken` throws → 401 `Invalid or expired Firebase token`
3. `sign_in_provider === 'password'` and the claim is not `true` →
   401 `Email not verified`
4. no `email` claim → 401 `Token has no email claim`. `User.email` is unique and
   not nullable, so persisting an empty string would make the second such token
   a 500 rather than a 401
5. otherwise `getOrCreate(uid, email, name)`, and the row lands on
   `request.user` for `@CurrentUser()`

`AllExceptionsFilter` shapes every one of them identically:

```json
{
  "success": false,
  "statusCode": 401,
  "error": "UNAUTHORIZED",
  "message": "Email not verified"
}
```

Two consequences to keep in mind:

- **Step 3 is password-provider only.** Google tokens arrive with
  `email_verified: true`, so a Google sign-in reaches the API on its first
  request and never sees `/verify-email`.
- **Step 5 lives inside the guard.** Nothing else creates a `User`, so a
  request rejected at 1–4 leaves no row behind. `getOrCreate` claims the unique
  `email` column, which is exactly why verification gates it: an unverified
  sign-up could otherwise squat somebody else's address.

## 4) How the Client Finds Out

Not from the 401 — nothing in `apps/web` inspects response status for auth. The
client's job is to never make that call:

1. `signUp(email, password, displayName)` creates the account, sets the profile
   name with `updateProfile` (the guard stores `decoded['name']`, which is
   `null` without it), then sends the verification email with a `continueUrl` of
   `/verify-email` so the session survives the round trip.
2. The user stays signed in and unverified. `ProtectedRoute` requires signed in
   **and** verified and redirects to `/verify-email` otherwise; `PublicRoute`
   sends signed-in visitors to `/chat` or `/verify-email`; the nav hides the
   Chat link while unverified. Every redirect passes `replace: true`, or the
   back button strands the user on a page that immediately bounces.
3. `/verify-email` is not wrapped in either guard — it guards itself — and polls
   `refreshUser()` every **5 seconds**. Verification happens in an email client
   or another tab, which tells this one nothing; polling is what turns it into a
   redirect with no manual reload.
4. Once the claim flips, `AuthProvider` re-renders, the page redirects to
   `/chat`, and `getToken()` now hands the API a token the guard accepts.

Resend sits behind a **60 second** cooldown whose timestamp lives in
`sessionStorage` under `verify-email:last-sent-at` — not component state and not
route state, because this page unmounts the moment the claim turns verified, and
anyone who lands back on it must still be held to the cooldown.

## 5) Firebase Console Checklist

One-time manual steps. Auth is broken until they are done.

1. **Authentication → Sign-in method**: enable **Email/Password** and **Google**
   (Google requires choosing a support email).
2. **Authentication → Settings → Authorized domains**: add `localhost` and every
   domain you serve from — needed both by `signInWithPopup` and by the
   verification `continueUrl`.
3. Email templates need no edits; the hosted verification page works as shipped.

`auth/operation-not-allowed` or a popup error means step 1 or 2 is missing.

Custom domains, `staging.<domain>` included, must be added to Authorized domains
too. `docs/RUNBOOK_DOMAINS.md` § 7 owns that step and the DNS/TLS work around
it.

## 6) The Auth Emulator

`firebase.json` configures the Auth emulator on `127.0.0.1:9099`:

```bash
pnpm exec firebase emulators:start --only auth
```

Two env vars point the two halves of the app at it. Uncomment them together in
`.env` (see `.env.example`):

| Variable                           | Read by                               |
| ---------------------------------- | ------------------------------------- |
| `FIREBASE_AUTH_EMULATOR_HOST`      | Admin SDK, via `apps/api/src/main.ts` |
| `VITE_FIREBASE_AUTH_EMULATOR_HOST` | `apps/web/src/lib/firebase.ts`        |

Set one without the other and the browser and the API disagree about where
accounts live: sign-up succeeds and every API call 401s. When the API var is
set, `main.ts` initialises the Admin SDK with a bare `projectId`, because
service-account credentials are meaningless against the emulator and a
placeholder PEM throws while being parsed.

Production cannot reach an emulator, and both halves of that must stay true:

- The API **refuses to boot** when `FIREBASE_AUTH_EMULATOR_HOST` is set and
  `NODE_ENV=production`. The Admin SDK picks the variable up by itself and then
  stops verifying token signatures, so a production process that ever saw it
  would accept forged tokens.
- The browser calls `connectAuthEmulator` only when its variable is set **and**
  `import.meta.env.DEV`.

`FIREBASE_AUTH_EMULATOR_HOST` is `.optional()` in the env schema, so a normal
`.env` leaves both lines commented out.

## 7) Proving It Works

```bash
pnpm validate:auth
```

`harness/validate-auth-journey.mjs` drives the whole journey against the
emulator, needing no mailbox and no production credentials: sign up with a name,
land on `/verify-email`, mark the address verified out of band, watch the client
redirect itself, then send **the ID token the client is actually holding** —
read out of the SDK's IndexedDB rather than minted fresh — to
`GET /api/users/me` and assert 200 plus the `displayName` from sign-up.
Screenshots land in `harness/artifacts/auth-*.png`.

That last assertion is the whole point: a freshly minted token always carries
the current claim, so a UI-only check passes while the product is broken.

Prerequisites: both emulator vars, `VITE_FIREBASE_API_KEY` (any non-empty value
satisfies the emulator), `FIREBASE_PROJECT_ID` agreeing between emulator and
Admin SDK, and a reachable `NEON_DATABASE_URL` — the journey ends in a real
`User` row. Run it with full permissions; `.agents/skills/validate-app/SKILL.md`
explains why Chromium cannot run inside the agent sandbox.

## 8) Anti-Patterns

- gate UI or a guard on `user.emailVerified` rather than the token claim (§2)
- call `user.getIdToken()` unforced when the cached claim is `false`
- use `onAuthStateChanged` where verification matters — it does not fire on a
  token refresh, so the claim never re-derives
- resolve `loading` before the claim resolves; guards then route on a
  half-initialised session
- keep the resend cooldown in component or route state
- redirect without `replace: true`
- add a second source of truth for verification
