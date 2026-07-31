/**
 * Shared Chromium launcher for the harnesses.
 *
 * Two agent-sandbox quirks otherwise make every harness run re-download ~150MB
 * of Chromium, and this module exists to neutralise both:
 *
 *  1. The sandbox points PLAYWRIGHT_BROWSERS_PATH at a per-session temp
 *     directory, so nothing installed ever survives the session. We pin it back
 *     to Playwright's own platform default, which one `playwright install`
 *     populates for good and which CI can cache.
 *  2. The sandbox blocks sysctl, so `os.cpus()` returns [] — and Playwright
 *     detects Apple Silicon with `cpus().some(c => c.model.includes('Apple'))`.
 *     With no CPUs it concludes mac-x64 and hunts for an x64 build that never
 *     matches the arm64 one on disk. PLAYWRIGHT_HOST_PLATFORM_OVERRIDE is
 *     Playwright's own escape hatch for exactly this.
 */
import { execFileSync } from 'node:child_process';
import { cpus, homedir, release } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function defaultBrowsersPath() {
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'ms-playwright');
  if (process.platform === 'win32') {
    return join(
      process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local'),
      'ms-playwright',
    );
  }
  return join(process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache'), 'ms-playwright');
}

/**
 * The hostPlatform string Playwright would compute if it could see the CPU.
 * Mirrors calculatePlatform() in playwright-core's hostPlatform.ts; returns null
 * when Playwright's own detection is already correct.
 */
function appleSiliconOverride() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return null;
  if (cpus().some((cpu) => cpu.model.includes('Apple'))) return null;
  const major = Number(release().split('.')[0]);
  if (major < 20) return null;
  const LAST_STABLE_MACOS_MAJOR = 26;
  return major < 25
    ? `mac${major - 9}-arm64`
    : `mac${Math.min(major + 1, LAST_STABLE_MACOS_MAJOR)}-arm64`;
}

export const BROWSERS_PATH = process.env['MORPHEUS_BROWSERS_PATH'] || defaultBrowsersPath();

function applyEnv() {
  process.env['PLAYWRIGHT_BROWSERS_PATH'] = BROWSERS_PATH;
  const override = appleSiliconOverride();
  if (override && !process.env['PLAYWRIGHT_HOST_PLATFORM_OVERRIDE']) {
    process.env['PLAYWRIGHT_HOST_PLATFORM_OVERRIDE'] = override;
  }
}

function install() {
  console.log(`… installing Chromium once into ${BROWSERS_PATH}`);
  execFileSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

/**
 * Returns a launched Chromium, installing it first if this machine has none.
 * Throws with actionable remediation when neither launch nor install works.
 */
export async function launchChromium(options = {}) {
  applyEnv();

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('playwright is not installed. Remediation: run `pnpm install`.');
  }

  try {
    return await chromium.launch(options);
  } catch (err) {
    // Chromium starts but is killed by the agent sandbox's syscall filter. No
    // amount of reinstalling fixes this; the harness has to run unsandboxed.
    if (/SIGSEGV|browser has been closed|kill EPERM/.test(err.message)) {
      throw new Error(
        'Chromium crashed on launch (SIGSEGV). It cannot run inside the agent sandbox. ' +
          'Remediation: re-run this harness with full permissions — do NOT reinstall the browser.',
      );
    }
    if (!/Executable doesn't exist|Please run the following command/.test(err.message)) throw err;
    try {
      install();
    } catch {
      throw new Error(
        `Chromium is missing from ${BROWSERS_PATH} and the automatic install failed. ` +
          'Remediation: run `pnpm playwright:install` with full permissions (the download ' +
          'needs network access the sandbox blocks).',
      );
    }
    return chromium.launch(options);
  }
}
