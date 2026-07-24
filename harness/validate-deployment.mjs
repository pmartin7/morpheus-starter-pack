// Deployment validation harness.
//
// Checks the latest Vercel deployments (production + optional staging preview):
// deployment state must be READY, live URLs must respond 2xx/3xx, and the
// production page must render a non-empty #root (verified via Playwright,
// screenshot saved to harness/artifacts/deploy-production.png).
//
// Vercel-SSO-protected previews (Hobby plan default) are a pass-with-note.
//
// Exit codes: 0 = all pass, 1 = validation failures, 2 = harness/environment error.

import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://api.vercel.com';
const STAGING_BRANCH = 'staging';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(HARNESS_DIR, 'artifacts');
const REPO_ROOT = path.resolve(HARNESS_DIR, '..');

function exitEnvError(message, hint) {
  console.error(`FAIL: ${message}`);
  console.error(hint);
  process.exit(2);
}

function readVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;

  const home = os.homedir();
  const authPaths = [
    path.join(home, 'Library', 'Application Support', 'com.vercel.cli', 'auth.json'),
    path.join(home, '.local', 'share', 'com.vercel.cli', 'auth.json'),
    path.join(home, '.vercel', 'auth.json'),
  ];
  for (const authPath of authPaths) {
    if (!existsSync(authPath)) continue;
    try {
      const { token } = JSON.parse(readFileSync(authPath, 'utf8'));
      if (token) return token;
    } catch {
      // Malformed file; try the next location.
    }
  }
  exitEnvError(
    'no Vercel token found (checked VERCEL_TOKEN and CLI auth files)',
    'hint: run npx vercel login',
  );
}

function readProjectConfig() {
  const projectPath = path.join(REPO_ROOT, '.vercel', 'project.json');
  if (!existsSync(projectPath)) {
    exitEnvError('.vercel/project.json not found at repo root', 'hint: run npx vercel link');
  }
  const { projectId, orgId } = JSON.parse(readFileSync(projectPath, 'utf8'));
  if (!projectId || !orgId) {
    exitEnvError('.vercel/project.json is missing projectId/orgId', 'hint: run npx vercel link');
  }
  return { projectId, orgId };
}

async function vercelApi(token, pathname) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    exitEnvError(
      `Vercel API returned ${res.status} for ${pathname}`,
      'hint: token may be stale — run npx vercel whoami',
    );
  }
  if (!res.ok) {
    exitEnvError(
      `Vercel API returned ${res.status} for ${pathname}`,
      'hint: check https://vercel-status.com and retry',
    );
  }
  return res.json();
}

async function fetchLatestDeployment(token, projectId, { target, branch } = {}) {
  const params = new URLSearchParams({ projectId, limit: '1' });
  if (target) params.set('target', target);
  if (branch) params.set('meta-githubCommitRef', branch);
  const data = await vercelApi(token, `/v6/deployments?${params}`);
  return data.deployments?.[0] ?? null;
}

// Returns a failure object or null if the deployment state is acceptable.
function checkDeploymentState(label, deployment) {
  const url = `https://${deployment.url}`;
  if (deployment.state === 'READY') return null;
  if (deployment.state === 'ERROR' || deployment.state === 'CANCELED') {
    return {
      problem: `${label} deployment is ${deployment.state} (${url})`,
      hint: 'hint: open the Vercel dashboard and check the build logs for this deployment',
    };
  }
  return {
    problem: `${label} deployment is ${deployment.state}, not READY (${url})`,
    hint: 'hint: the deployment may still be building — wait and re-run',
  };
}

function isVercelSsoRedirect(location) {
  if (!location) return false;
  return location.includes('vercel.com/sso-api') || location.includes('vercel.com/login');
}

// Returns { failure } or { note } or {} on plain pass.
async function smokeCheck(label, url) {
  let res;
  try {
    res = await fetch(url, { redirect: 'manual' });
  } catch (err) {
    return {
      failure: {
        problem: `${label}: GET ${url} failed: ${err.message}`,
        hint: 'hint: check DNS/network and that the deployment URL is correct',
      },
    };
  }

  if (res.status >= 300 && res.status < 400 && isVercelSsoRedirect(res.headers.get('location'))) {
    return { note: `${label} is protected by Vercel SSO (Hobby plan default); not a failure` };
  }
  if (res.status === 401) {
    return { note: `${label} returned 401 — likely Vercel deployment protection/SSO; not a failure` };
  }
  if (res.status >= 200 && res.status < 400) {
    console.log(`PASS  ${label} smoke check: ${url} → ${res.status}`);
    return {};
  }
  return {
    failure: {
      problem: `${label}: GET ${url} → HTTP ${res.status}`,
      hint: 'hint: open the Vercel dashboard and check the deployment logs',
    },
  };
}

// Returns a failure object or null on pass.
async function visualCheckProduction(url) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    exitEnvError('playwright is not installed', 'hint: run pnpm install, then pnpm exec playwright install chromium');
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    exitEnvError(`could not launch chromium: ${err.message}`, 'hint: run pnpm exec playwright install chromium');
  }

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  const rootHtml = await page.$eval('#root', (el) => el.innerHTML).catch(() => null);
  const screenshotPath = path.join(ARTIFACTS_DIR, 'deploy-production.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  console.log(`Screenshot written to ${screenshotPath}`);
  if (rootHtml === null || rootHtml.trim() === '') {
    return {
      problem: `production page #root is empty (blank page) at ${url}`,
      hint: 'hint: likely a module-load crash; check VITE_* env vars in the Vercel project settings',
    };
  }
  return null;
}

function printSummary(failures, notes) {
  console.log('\n=== Deployment validation summary ===');
  for (const note of notes) console.log(`NOTE  ${note}`);
  for (const { problem, hint } of failures) {
    console.log(`FAIL  ${problem}`);
    console.log(`      ${hint}`);
  }
  if (failures.length === 0) console.log('PASS  all deployment checks passed');
  console.log(`\nScreenshots written to ${ARTIFACTS_DIR}`);
  console.log('Agents: open and visually inspect the screenshots before declaring the deployment healthy.');
}

async function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const token = readVercelToken();
  const { projectId } = readProjectConfig();

  const failures = [];
  const notes = [];

  const production = await fetchLatestDeployment(token, projectId, { target: 'production' });
  if (!production) {
    failures.push({
      problem: 'no production deployment found for this project',
      hint: 'hint: deploy with npx vercel --prod, or check the Vercel dashboard',
    });
  }

  const staging = await fetchLatestDeployment(token, projectId, {
    target: 'preview',
    branch: STAGING_BRANCH,
  });
  if (!staging) {
    notes.push(`no staging (${STAGING_BRANCH} branch) preview deployment found; skipping — not a failure`);
  }

  for (const [label, deployment] of [['production', production], ['staging', staging]]) {
    if (!deployment) continue;
    const stateFailure = checkDeploymentState(label, deployment);
    if (stateFailure) {
      failures.push(stateFailure);
      continue;
    }
    console.log(`PASS  ${label} deployment is READY: https://${deployment.url}`);
    const { failure, note } = await smokeCheck(label, `https://${deployment.url}`);
    if (failure) failures.push(failure);
    if (note) notes.push(note);
  }

  if (production?.state === 'READY') {
    const visualFailure = await visualCheckProduction(`https://${production.url}`);
    if (visualFailure) failures.push(visualFailure);
  }

  printSummary(failures, notes);
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`FAIL: harness error: ${err.message}`);
  console.error('hint: check network access to api.vercel.com and re-run');
  process.exit(2);
});
