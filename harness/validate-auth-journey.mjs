#!/usr/bin/env node
// Auth-journey harness.
//
// Drives the whole signed-in-unverified flow against the Firebase Auth
// emulator, so it needs no real mailbox and no production credentials:
//
//   1. sign up with email, password and a display name
//   2. the app lands on /verify-email while the account is unverified
//   3. the email is marked verified out-of-band (as clicking the link would)
//   4. the client redirects itself within the poll interval, with no reload
//   5. the ID token the client is holding is accepted by the API, and the User
//      row it created carries the display name from step 1
//
// Step 5 is the point of this harness. Verification state must be read from the
// ID token's email_verified claim, never from the account's emailVerified flag:
// reload() refreshes the flag but leaves the cached token alone, and the API
// reads the claim. A client that gates on the flag renders a fully verified UI
// whose every API call 401s. Only an assertion on a real API response catches
// that; a UI-only test passes while the product is broken.
//
// Usage: pnpm validate:auth   (needs full permissions — Chromium segfaults in
// the agent sandbox; see .agents/skills/validate-app/SKILL.md)
//
// Exit codes: 0 = journey works, 1 = validation failures, 2 = harness/environment error.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './lib/browser.mjs';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(HARNESS_DIR, 'artifacts');
const REPO_ROOT = path.resolve(HARNESS_DIR, '..');

const WEB_PORT = process.env.PORT ?? '5173';
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const BOOT_TIMEOUT_MS = 90_000;
const PAGE_LOAD_TIMEOUT_MS = 30_000;
// The verification page polls every 5s; allow three intervals before failing so
// a slow token refresh reads as slow rather than broken.
const REDIRECT_TIMEOUT_MS = 20_000;

const PASSWORD = 'harness-password-1234';
const DISPLAY_NAME = 'Harness Tester';

const failures = [];
const startedProcesses = [];

function pass(label) {
  console.log(`PASS  ${label}`);
}

function fail(label, hint) {
  console.log(`FAIL  ${label}`);
  console.log(`      hint: ${hint}`);
  failures.push(label);
}

function exitEnvError(message, hint) {
  console.error(`FAIL  harness cannot run: ${message}`);
  console.error(`      hint: ${hint}`);
  stopAll();
  process.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Minimal .env reader: the harnesses are dependency-free plain Node, and the
// apps load this same file through their own dotenv/Vite paths.
function readDotEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) {
    exitEnvError('no .env at the repo root', 'copy .env.example to .env and fill it in');
  }
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function requireEnv(env, name, hint) {
  const value = process.env[name] ?? env[name];
  if (!value) exitEnvError(`${name} is not set`, hint);
  return value;
}

async function isReachable(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilReachable(url, label) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isReachable(url)) return;
    await sleep(500);
  }
  exitEnvError(
    `${label} did not become reachable at ${url} within ${BOOT_TIMEOUT_MS / 1000}s`,
    `start it manually and re-run this harness to see its own error output`,
  );
}

function startProcess(label, command, args, env) {
  console.log(`Starting ${label} ...`);
  const child = spawn(command, args, {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, ...env },
  });
  child.on('error', () => {
    // Surfaced by the reachability timeout instead.
  });
  startedProcesses.push(child);
  return child;
}

function stopAll() {
  for (const child of startedProcesses) {
    if (child.killed) continue;
    try {
      // Negative pid kills the whole process group (pnpm + the server itself).
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

async function ensureEmulator(emulatorHost, projectId) {
  const url = `http://${emulatorHost}/`;
  if (await isReachable(url)) {
    console.log(`Reusing auth emulator already running at ${url}`);
    return;
  }
  if (!existsSync(path.join(REPO_ROOT, 'firebase.json'))) {
    exitEnvError('no firebase.json at the repo root', 'the auth emulator needs its config file');
  }
  startProcess(
    'Firebase Auth emulator',
    'pnpm',
    ['exec', 'firebase', 'emulators:start', '--only', 'auth', '--project', projectId],
    // The CLI's update check writes to ~/.config and aborts the whole command
    // when it cannot — which is every run under a restricted sandbox.
    { NO_UPDATE_NOTIFIER: '1', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' },
  );
  await waitUntilReachable(url, 'auth emulator');
  console.log(`Auth emulator is up at ${url}`);
}

async function ensureApi() {
  if (await isReachable(`${API_URL}/api/health`)) {
    console.log(`Reusing API already running at ${API_URL}`);
    return;
  }
  startProcess('API', 'pnpm', ['--filter', '@morpheus/api', 'dev']);
  await waitUntilReachable(`${API_URL}/api/health`, 'API');
  console.log(`API is up at ${API_URL}`);
}

async function ensureWeb() {
  if (await isReachable(WEB_URL)) {
    console.log(`Reusing web dev server already running at ${WEB_URL}`);
    return;
  }
  startProcess('web dev server', 'pnpm', [
    '--filter',
    '@morpheus/web',
    'dev',
    '--port',
    WEB_PORT,
    '--strictPort',
  ]);
  await waitUntilReachable(WEB_URL, 'web dev server');
  console.log(`Web dev server is up at ${WEB_URL}`);
}

// The emulator accepts "owner" as an admin bearer token on its privileged
// endpoints — that is how it lets a test mark an email verified without a
// mailbox.
async function emulatorAdmin(emulatorHost, pathname, body) {
  const res = await fetch(`http://${emulatorHost}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer owner',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    exitEnvError(
      `auth emulator returned ${res.status} for ${pathname}`,
      'restart the emulator: pnpm exec firebase emulators:start --only auth',
    );
  }
  return res.json();
}

async function markEmailVerified(emulatorHost, projectId, email) {
  const { userInfo = [] } = await emulatorAdmin(
    emulatorHost,
    `/emulator/v1/projects/${projectId}/accounts`,
  );
  const account = userInfo.find((user) => user.email === email);
  if (!account) {
    exitEnvError(
      `the emulator has no account for ${email} after sign-up`,
      'sign-up did not reach the emulator — check VITE_FIREBASE_AUTH_EMULATOR_HOST',
    );
  }
  await emulatorAdmin(
    emulatorHost,
    `/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    { localId: account.localId, emailVerified: true },
  );
  return account.localId;
}

// Reads the ID token out of the Firebase SDK's own persistence rather than
// minting a fresh one. A freshly minted token always carries the current claim,
// so it would pass even when the client is holding a stale one — which is the
// exact bug this harness exists to catch.
async function readClientIdToken(page) {
  return page.evaluate(async () => {
    const open = () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('firebaseLocalStorageDb');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    let db;
    try {
      db = await open();
    } catch {
      return null;
    }
    if (!db.objectStoreNames.contains('firebaseLocalStorage')) return null;
    const entries = await new Promise((resolve, reject) => {
      const all = db
        .transaction('firebaseLocalStorage', 'readonly')
        .objectStore('firebaseLocalStorage')
        .getAll();
      all.onsuccess = () => resolve(all.result);
      all.onerror = () => reject(all.error);
    });
    for (const entry of entries) {
      const token = entry?.value?.stsTokenManager?.accessToken;
      if (typeof token === 'string' && token.length > 0) return token;
    }
    return null;
  });
}

async function screenshot(page, name) {
  const file = path.join(ARTIFACTS_DIR, `auth-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`      screenshot: ${file}`);
}

async function signUp(page, email) {
  await page.goto(`${WEB_URL}/login`, {
    waitUntil: 'networkidle',
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });
  await page
    .getByRole('button', { name: /sign up/i })
    .last()
    .click();
  await page.getByPlaceholder(/name/i).fill(DISPLAY_NAME);
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(PASSWORD);
  await screenshot(page, 'signup-form');
  await page.getByRole('button', { name: /sign up|creating account/i }).click();
}

async function runJourney(page, emulatorHost, projectId, email) {
  await signUp(page, email);

  try {
    await page.waitForURL(/\/verify-email$/, { timeout: PAGE_LOAD_TIMEOUT_MS });
    pass('sign-up lands on /verify-email while unverified');
  } catch {
    fail(
      `sign-up did not land on /verify-email (still at ${page.url()})`,
      'ProtectedRoute must send signed-in-but-unverified users to the verification page',
    );
  }
  await screenshot(page, 'verify-pending');

  await markEmailVerified(emulatorHost, projectId, email);
  console.log(`Marked ${email} verified in the emulator; waiting for the client to notice ...`);

  try {
    await page.waitForURL((url) => !url.pathname.endsWith('/verify-email'), {
      timeout: REDIRECT_TIMEOUT_MS,
    });
    pass('client redirects itself after verification, with no reload');
  } catch {
    fail(
      `client stayed on /verify-email for ${REDIRECT_TIMEOUT_MS / 1000}s after verification`,
      'the page must poll refreshUser(), which forces getIdToken(true) so the claim updates',
    );
  }
  await screenshot(page, 'verified');

  const token = await readClientIdToken(page);
  if (!token) {
    fail(
      'could not read the ID token the client is holding',
      'the Firebase SDK stores it in IndexedDB (firebaseLocalStorageDb); confirm the user is signed in',
    );
    return;
  }

  const res = await fetch(`${API_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) {
    const body = await res.text();
    fail(
      `GET /api/users/me with the client's own token → HTTP ${res.status} (${body.slice(0, 200)})`,
      'the client is holding a token whose email_verified claim is still false — derive verification from the claim and force getIdToken(true), never from user.emailVerified',
    );
    return;
  }
  pass('API accepts the token the client is holding (GET /api/users/me → 200)');

  const payload = await res.json();
  const user = payload?.data ?? payload;
  if (user?.displayName === DISPLAY_NAME) {
    pass(`the created User row carries displayName "${DISPLAY_NAME}"`);
  } else {
    fail(
      `User row displayName is ${JSON.stringify(user?.displayName)}, expected ${JSON.stringify(DISPLAY_NAME)}`,
      'signUp must call updateProfile before the first API call, or the guard reads decoded.name as undefined',
    );
  }
}

async function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const env = readDotEnv();
  const emulatorHost = requireEnv(
    env,
    'FIREBASE_AUTH_EMULATOR_HOST',
    'uncomment FIREBASE_AUTH_EMULATOR_HOST in .env (see .env.example) so the API trusts the emulator',
  );
  requireEnv(
    env,
    'VITE_FIREBASE_AUTH_EMULATOR_HOST',
    'uncomment VITE_FIREBASE_AUTH_EMULATOR_HOST in .env so the browser talks to the emulator too',
  );
  requireEnv(
    env,
    'VITE_FIREBASE_API_KEY',
    'any non-empty value works against the emulator, but the client SDK refuses to initialise without one',
  );
  requireEnv(
    env,
    'NEON_DATABASE_URL',
    'the API creates the User row in Postgres, so this journey needs a reachable database',
  );
  const projectId = requireEnv(
    env,
    'FIREBASE_PROJECT_ID',
    'the emulator and the Admin SDK must agree on the project id',
  );

  await ensureEmulator(emulatorHost, projectId);
  await ensureApi();
  await ensureWeb();

  const browser = await launchChromium();
  const page = await browser.newPage();
  page.on('pageerror', (err) => {
    fail(
      `page error: ${err.message}`,
      'an uncaught exception broke the flow; open the route manually',
    );
  });

  // A fresh address per run keeps the emulator's accounts from colliding across
  // runs without needing to clear its state.
  const email = `harness-${Date.now()}@example.com`;
  try {
    await runJourney(page, emulatorHost, projectId, email);
  } finally {
    await browser.close();
    stopAll();
  }

  console.log('\n=== Auth journey summary ===');
  console.log(
    failures.length === 0
      ? `PASS  the whole journey works (account: ${email})`
      : `FAIL  ${failures.length} check(s) failed: ${failures.join(', ')}`,
  );
  console.log(`\nScreenshots written to ${ARTIFACTS_DIR}`);
  console.log('Agents: open the screenshots before declaring auth working.');
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  stopAll();
  console.error(`FAIL  harness error: ${err.message}`);
  console.error('      hint: run pnpm dev and the emulator manually, then re-run to isolate it');
  process.exit(2);
});
