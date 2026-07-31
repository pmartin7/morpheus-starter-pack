#!/usr/bin/env node
/**
 * Installs the Chromium build the harnesses need, into the one location they look
 * in. Idempotent: a browser that is already there is left alone.
 *
 * Run this once per machine. Prefer it over a bare `pnpm exec playwright install`,
 * which obeys whatever PLAYWRIGHT_BROWSERS_PATH the shell happens to carry — in
 * agent sandboxes that is a per-session temp directory, so the download is thrown
 * away the moment the session ends.
 *
 * Usage: pnpm playwright:install
 */
import { BROWSERS_PATH, launchChromium } from './lib/browser.mjs';

console.log(`browsers path: ${BROWSERS_PATH}`);

try {
  const browser = await launchChromium();
  await browser.close();
  console.log('✓ Chromium is installed and launches');
} catch (err) {
  console.error(`FAIL ${err.message}`);
  process.exit(1);
}
