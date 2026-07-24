# Morpheus starter: auth-flow improvements

Lessons learned building a combined sign-in/sign-up flow (Google SSO +
email/password + email verification) on a project scaffolded from
morpheus-starter-pack. Written for an agent working **in the morpheus repo**
to improve the `/init` scaffold. Each item is independent; apply in order.

## Context

The scaffold shipped sign-in only. Adding sign-up required touching
`use-auth.ts`, `login.tsx`, `router.tsx`, and adding a post-auth page. Several
scaffold decisions made that harder than necessary, and a few runtime pitfalls
were discovered that the scaffold should encode so every downstream project
doesn't rediscover them.

## 1) Scaffold the full auth surface, not sign-in only

The starter's `use-auth.ts` exposed only `signIn` / `signOut`, while its README
told users to enable both Email/Password **and Google** providers in Firebase
Console — a code/docs mismatch. Either scaffold what the docs promise or trim
the docs. Recommended: scaffold all three flows in `use-auth.ts`:

- `signIn(email, password)` — after `signInWithEmailAndPassword`, if
  `user.emailVerified` is false: sign out, then throw a coded error
  (e.g. `email-not-verified`). Google accounts always arrive verified, so this
  single check covers both providers.
- `signUp(email, password)` — `createUserWithEmailAndPassword` →
  `sendEmailVerification(user, { url: origin + '/login' })` → `signOut`
  **in a `finally` block**: a failed email send must not strand a signed-in
  unverified user.
- `signInWithGoogle()` — `GoogleAuthProvider` + `signInWithPopup`, called
  directly from the click handler (user gesture avoids popup blockers). No
  `signInWithRedirect` fallback (YAGNI).

## 2) Login page: single page with a mode toggle, and two hard rules

One `/login` route with `mode: 'signin' | 'signup' | 'check-email'` state beats
separate routes for a starter. Two non-obvious rules the scaffold should encode
(as code, or at minimum comments):

- **Never auto-redirect on auth state from the login page.** Sign-up
  transiently authenticates before `signUp` signs back out; a `user`-watching
  redirect effect destroys the check-email confirmation state. Navigate only
  imperatively in submit handlers.
- **Swallow popup dismissals silently.** `auth/popup-closed-by-user` and
  `auth/cancelled-popup-request` are user actions, not errors — show nothing.

Also include a small Firebase error-code → friendly-message mapping function in
the page (`auth/email-already-in-use`, `auth/weak-password`,
`auth/invalid-credential`, plus the custom `email-not-verified`). No separate
file needed.

## 3) Don't ship dead scaffolding — wire ProtectedRoute to a real page

The starter shipped a `ProtectedRoute` component that no route used, and
sign-in navigated to `/` (the public landing page) — there was no authenticated
destination at all. Scaffold a minimal protected page (e.g. `/welcome`) wrapped
in `ProtectedRoute` so the guard is exercised from day one and successful auth
has somewhere to land.

## 4) Document the manual Firebase Console checklist in /init output

Code cannot do these; `/init` should print them as a post-setup checklist:

1. Authentication → Sign-in method: enable **Email/Password** and **Google**
   (Google requires picking a support email).
2. Authentication → Settings → Authorized domains: `localhost` + production
   domain (required for `signInWithPopup` and the verification `continueUrl`).
3. No email-template changes needed — Firebase's hosted verification page works
   out of the box when `sendEmailVerification` passes a `continueUrl`.

Misconfiguration surfaces as `auth/operation-not-allowed` or popup errors;
mention that in the checklist.

## 5) API guard: leave email_verified unenforced, but say so

The NestJS `FirebaseAuthGuard` verifies the JWT and getOrCreates a user without
checking `decoded.email_verified`. That is fine while no authenticated API
surface exists, but it's an invisible decision. Add one comment in the guard:
enforce `email_verified` for password-provider tokens when the first real
authenticated endpoint ships.

## 6) Validation harness: make first-run succeed

Two exit-code-2 ("harness could not run") failures hit on first use:

- **Playwright browsers not installed.** `/init` should run
  `pnpm exec playwright install chromium` (or the harness should offer to). On
  sandboxed agent runners, note that the browser cache path can differ per
  sandbox profile — installing and running in the same permission context
  avoids a missing-executable error even right after a successful install.
- **Stale Vercel token.** The `validate:deploy` remediation message
  ("run `npx vercel whoami`") worked verbatim — keep remediation messages that
  precise everywhere in the harness.

Also keep the exit-code contract (0 pass / 1 app failure / 2 harness failure)
— it let the agent correctly avoid treating harness issues as app bugs.

## 7) Minor UI kit gaps (optional)

Auth UI needed an "or" divider and a Google logo; `components/ui` only had
button/input/card. Both were trivial to inline, so this is optional — but if
the scaffold ships the full auth page (item 1–2), include them in it.

## Acceptance for the morpheus agent

- `/init` output includes the Firebase Console checklist (item 4).
- Scaffolded app: sign-in, sign-up with verification, Google SSO all work
  against a configured Firebase project; `/welcome` (or equivalent) is behind
  `ProtectedRoute`; unauthenticated visits redirect to `/login`.
- `pnpm check` and `pnpm validate:local` pass on a fresh scaffold, including
  first-run Playwright setup.
