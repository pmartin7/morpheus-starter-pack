// Design screenshot harness.
//
// Permanent harness for design work: boots the web dev server (or reuses one
// already running on :5173), and captures full-page screenshots of every route
// at desktop (1280px) and mobile (375px) viewports into harness/artifacts/,
// named design-<label>-<route>-<viewport>.png for before/after comparisons.
//
// Usage:
//   node harness/design-shots.mjs --label <label> [--fresh]
//   pnpm design:shots --label <label>
//
// --label names the screenshot set (e.g. "before", "after"); defaults to "shots".
// --fresh kills any server already on the port and boots a new one (see below).
//
// Exit codes: 0 = all shots captured, 1 = some shots failed, 2 = harness/environment error.

import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launchChromium } from './lib/browser.mjs';

// Routes to validate. Update this list per-project as routes are added/removed.
const ROUTES = ['/', '/login', '/chat', '/verify-email'];

// Override with PORT=5174 when another project already occupies :5173 —
// otherwise the harness would happily screenshot the wrong app.
const PORT = process.env.PORT ?? '5173';
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_BOOT_TIMEOUT_MS = 60_000;
const SERVER_KILL_TIMEOUT_MS = 5_000;
const PAGE_LOAD_TIMEOUT_MS = 30_000;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(HARNESS_DIR, 'artifacts');
const REPO_ROOT = path.resolve(HARNESS_DIR, '..');

function parseArgs(argv) {
  const args = { label: 'shots', fresh: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--label') {
      args.label = argv[i + 1] ?? args.label;
      i++;
    } else if (argv[i] === '--fresh') {
      args.fresh = true;
    }
  }
  return args;
}

function routeSlug(route) {
  if (route === '/') return 'home';
  return route.replace(/^\//, '').replace(/\//g, '-');
}

async function isServerReachable() {
  try {
    await fetch(BASE_URL);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The stale-server trap: a dev server that was started before the current
// edits can serve a module graph that predates them, so screenshots would show
// old code — this produced misleading before/after comparisons in practice.
// --fresh kills whatever is listening on the port and boots a new server.
async function killServerOnPort() {
  console.log(`--fresh: killing whatever is listening on :${PORT}...`);
  let pids = [];
  try {
    // -sTCP:LISTEN targets only the listener — a plain `lsof -ti :PORT` also
    // matches this harness's own keep-alive fetch connection, and killing
    // that pid would SIGTERM ourselves.
    pids = execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map(Number)
      .filter((pid) => pid !== process.pid);
  } catch {
    // lsof exits non-zero when nothing is listening; nothing to kill.
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process may already be gone.
    }
  }

  const deadline = Date.now() + SERVER_KILL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!(await isServerReachable())) return;
    await sleep(250);
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Process may already be gone.
    }
  }
  while (await isServerReachable()) {
    await sleep(250);
  }
}

async function startDevServer() {
  console.log(`Dev server not detected at ${BASE_URL}; starting it...`);
  const child = spawn(
    'pnpm',
    ['--filter', '@morpheus/web', 'dev', '--port', PORT, '--strictPort'],
    {
      cwd: REPO_ROOT,
      stdio: 'ignore',
      detached: true,
    },
  );
  child.on('error', () => {
    // Surfaced by the reachability timeout below.
  });

  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isServerReachable()) return child;
    await sleep(500);
  }

  stopDevServer(child);
  console.error(
    `FAIL: dev server did not become reachable at ${BASE_URL} within ${SERVER_BOOT_TIMEOUT_MS / 1000}s`,
  );
  console.error('hint: run pnpm dev manually and check for errors');
  process.exit(2);
}

function stopDevServer(child) {
  if (!child || child.killed) return;
  try {
    // Negative pid kills the whole process group (pnpm + vite).
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

async function launchBrowser() {
  try {
    return await launchChromium();
  } catch (err) {
    console.error('FAIL: could not launch chromium');
    console.error(`hint: ${err.message}`);
    process.exit(2);
  }
}

async function captureShot(browser, route, viewport, label) {
  const screenshotPath = path.join(
    ARTIFACTS_DIR,
    `design-${label}-${routeSlug(route)}-${viewport.name}.png`,
  );
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });

  const url = `${BASE_URL}${route}`;
  let failure = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_LOAD_TIMEOUT_MS });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (err) {
    failure = `${route} @ ${viewport.name}: ${err.message}`;
  }
  await page.close();

  return { route, viewport: viewport.name, screenshotPath, failure };
}

function printSummary(results, label) {
  console.log(`\n=== Design shots summary (label: ${label}) ===`);
  for (const { route, viewport, screenshotPath, failure } of results) {
    const status = failure === null ? 'PASS' : 'FAIL';
    console.log(`${status}  ${route}  [${viewport}]  ${screenshotPath}`);
    if (failure !== null) {
      console.log(`      - ${failure}`);
      console.log('        hint: run pnpm dev manually and check for errors');
    }
  }
  console.log(`\nScreenshots written to ${ARTIFACTS_DIR}`);
  console.log(
    'Agents: open and visually inspect the screenshots — do not trust a design change sight-unseen.',
  );
}

async function main() {
  const { label, fresh } = parseArgs(process.argv.slice(2));
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  let devServer = null;
  if (fresh) {
    if (await isServerReachable()) {
      await killServerOnPort();
    }
    devServer = await startDevServer();
    console.log(`Dev server is up at ${BASE_URL}`);
  } else if (await isServerReachable()) {
    console.log(`Reusing dev server already running at ${BASE_URL}`);
  } else {
    devServer = await startDevServer();
    console.log(`Dev server is up at ${BASE_URL}`);
  }

  const browser = await launchBrowser();
  const results = [];
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      console.log(`Capturing ${route} [${viewport.name}] ...`);
      results.push(await captureShot(browser, route, viewport, label));
    }
  }
  await browser.close();
  stopDevServer(devServer);

  printSummary(results, label);
  const failed = results.some((r) => r.failure !== null);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`FAIL: harness error: ${err.message}`);
  console.error(
    'hint: re-run with the dev server already running (pnpm dev) to isolate the problem',
  );
  process.exit(2);
});
