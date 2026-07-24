// Local validation harness.
//
// Boots the web dev server (or reuses one already running on :5173), visits
// each route with Playwright, and fails on console errors, page errors,
// failed network requests, or an empty #root (the blank-page failure class).
// Full-page screenshots for every route are written to harness/artifacts/.
//
// Exit codes: 0 = all pass, 1 = validation failures, 2 = harness/environment error.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Routes to validate. Update this list per-project as routes are added/removed.
const ROUTES = ['/', '/login', '/chat'];

// Override with PORT=5174 when another project already occupies :5173 —
// otherwise the harness would happily validate the wrong app.
const PORT = process.env.PORT ?? '5173';
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_BOOT_TIMEOUT_MS = 60_000;
const PAGE_LOAD_TIMEOUT_MS = 30_000;

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(HARNESS_DIR, 'artifacts');
const REPO_ROOT = path.resolve(HARNESS_DIR, '..');

function routeSlug(route) {
  if (route === '/') return 'home';
  return route.replace(/^\//, '').replace(/\//g, '-');
}

function isFavicon(url) {
  return url.includes('favicon');
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

async function startDevServer() {
  console.log(`Dev server not detected at ${BASE_URL}; starting it...`);
  const child = spawn('pnpm', ['--filter', '@morpheus/web', 'dev', '--port', PORT, '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: true,
  });
  child.on('error', () => {
    // Surfaced by the reachability timeout below.
  });

  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isServerReachable()) return child;
    await sleep(500);
  }

  stopDevServer(child);
  console.error(`FAIL: dev server did not become reachable at ${BASE_URL} within ${SERVER_BOOT_TIMEOUT_MS / 1000}s`);
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
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('FAIL: playwright is not installed');
    console.error('hint: run pnpm install, then pnpm exec playwright install chromium');
    process.exit(2);
  }
  try {
    return await chromium.launch();
  } catch (err) {
    console.error(`FAIL: could not launch chromium: ${err.message}`);
    console.error(
      'hint: run pnpm exec playwright install chromium — in the SAME permission context as this harness (sandboxed runners use per-profile browser caches)',
    );
    process.exit(2);
  }
}

async function validateRoute(browser, route) {
  const failures = [];
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    failures.push({
      problem: `console error: ${msg.text()}`,
      hint: 'hint: open the route in a browser and check the devtools console',
    });
  });
  page.on('pageerror', (err) => {
    failures.push({
      problem: `page error: ${err.message}`,
      hint: 'hint: likely an uncaught exception; check the stack trace in a browser',
    });
  });
  page.on('requestfailed', (req) => {
    if (isFavicon(req.url())) return;
    failures.push({
      problem: `request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`,
      hint: 'hint: check that the API (:3000) is running and VITE_* env vars point at it',
    });
  });
  page.on('response', (res) => {
    if (res.status() < 400 || isFavicon(res.url())) return;
    failures.push({
      problem: `HTTP ${res.status()} from ${res.url()}`,
      hint: 'hint: check that the API (:3000) is running and the endpoint exists',
    });
  });

  const url = `${BASE_URL}${route}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_LOAD_TIMEOUT_MS });
  } catch (err) {
    failures.push({
      problem: `navigation to ${url} failed: ${err.message}`,
      hint: 'hint: run pnpm dev manually and check for errors',
    });
  }

  const rootHtml = await page
    .$eval('#root', (el) => el.innerHTML)
    .catch(() => null);
  if (rootHtml === null || rootHtml.trim() === '') {
    failures.push({
      problem: '#root is empty (blank page)',
      hint: 'hint: likely a module-load crash; check VITE_* env vars and the console errors above',
    });
  }

  const screenshotPath = path.join(ARTIFACTS_DIR, `local-${routeSlug(route)}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();

  return { route, failures, screenshotPath };
}

function printSummary(results) {
  console.log('\n=== Local validation summary ===');
  for (const { route, failures, screenshotPath } of results) {
    const status = failures.length === 0 ? 'PASS' : 'FAIL';
    console.log(`${status}  ${route}  (screenshot: ${screenshotPath})`);
    for (const { problem, hint } of failures) {
      console.log(`      - ${problem}`);
      console.log(`        ${hint}`);
    }
  }
  console.log(`\nScreenshots written to ${ARTIFACTS_DIR}`);
  console.log('Agents: open and visually inspect the screenshots before declaring the app working.');
}

async function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const reusing = await isServerReachable();
  let devServer = null;
  if (reusing) {
    console.log(`Reusing dev server already running at ${BASE_URL}`);
  } else {
    devServer = await startDevServer();
    console.log(`Dev server is up at ${BASE_URL}`);
  }

  const browser = await launchBrowser();
  const results = [];
  for (const route of ROUTES) {
    console.log(`Checking ${route} ...`);
    results.push(await validateRoute(browser, route));
  }
  await browser.close();
  stopDevServer(devServer);

  printSummary(results);
  const failed = results.some((r) => r.failures.length > 0);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`FAIL: harness error: ${err.message}`);
  console.error('hint: re-run with the dev server already running (pnpm dev) to isolate the problem');
  process.exit(2);
});
