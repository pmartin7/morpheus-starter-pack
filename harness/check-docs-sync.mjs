#!/usr/bin/env node
/**
 * Documentation-currency harness.
 *
 * Docs rot silently: nothing breaks when a new route or entity never reaches
 * ARCHITECTURE.md, so every future agent inherits a wrong map. This asserts the
 * few facts that are cheap to extract from source and expensive to get wrong.
 *
 * Checks:
 *   1. web routes in apps/web/src/app/router.tsx == ARCHITECTURE.md route map
 *   2. API entity classes == ARCHITECTURE.md entity model
 *   3. required env vars in the Zod env schema == .env.example keys
 *
 * Usage: node harness/check-docs-sync.mjs
 * Exit codes: 0 = docs match the code, 1 = drift found, 2 = harness could not run.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHITECTURE = join(ROOT, 'ARCHITECTURE.md');

function read(path) {
  return readFileSync(path, 'utf8');
}

/**
 * Body of the section whose heading contains `title`, up to the next heading.
 * Matched loosely so renaming or re-levelling a heading does not break the check.
 */
function section(markdown, title) {
  const heading = new RegExp(`^#{2,4} .*${title}.*$`, 'm');
  const match = heading.exec(markdown);
  if (match === null) return null;
  const rest = markdown.slice(match.index + match[0].length);
  const end = rest.search(/^#{1,4} /m);
  return end === -1 ? rest : rest.slice(0, end);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function difference(a, b) {
  return [...a].filter((item) => !b.has(item)).sort();
}

const failures = [];

function compare(label, fromCode, fromDocs, hint) {
  const missing = difference(fromCode, fromDocs);
  const stale = difference(fromDocs, fromCode);
  if (missing.length === 0 && stale.length === 0) {
    console.log(`PASS ${label} (${fromCode.size} in sync)`);
    return;
  }
  console.log(`FAIL ${label}`);
  if (missing.length > 0) console.log(`     - in code, missing from docs: ${missing.join(', ')}`);
  if (stale.length > 0) console.log(`     - in docs, absent from code: ${stale.join(', ')}`);
  console.log(`     hint: ${hint}`);
  failures.push(label);
}

function checkRoutes(architecture) {
  const router = read(join(ROOT, 'apps/web/src/app/router.tsx'));
  const code = new Set([...router.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]));

  const body = section(architecture, 'Route Map');
  if (body === null) {
    console.log('FAIL web routes\n     - ARCHITECTURE.md has no "Route Map" section');
    failures.push('web routes');
    return;
  }
  // First table cell of each row, e.g. "| /verify-email | ... |"
  const docs = new Set(
    [...body.matchAll(/^\|\s*(\/[^\s|]*)\s*\|/gm)].map((m) => m[1].replace(/`/g, '')),
  );

  compare('web routes', code, docs, 'update the Route Map table in ARCHITECTURE.md');
}

function checkEntities(architecture) {
  const entityDir = join(ROOT, 'apps/api/src');
  const code = new Set(
    walk(entityDir)
      .filter((path) => path.endsWith('.entity.ts'))
      .flatMap((path) => [...read(path).matchAll(/export class (\w+) extends BaseEntity/g)])
      .map((m) => m[1]),
  );

  const body = section(architecture, 'Entity Model');
  if (body === null) {
    console.log('FAIL API entities\n     - ARCHITECTURE.md has no "Entity Model" section');
    failures.push('API entities');
    return;
  }
  // The entity model is prose-ish, so only assert presence rather than parsing it
  const documented = new Set([...code].filter((name) => new RegExp(`\\b${name}\\b`).test(body)));

  compare(
    'API entities',
    code,
    documented,
    'add the entity to the Entity Model in ARCHITECTURE.md',
  );
}

function checkEnvExample() {
  const examplePath = join(ROOT, '.env.example');
  if (!existsSync(examplePath)) {
    console.log(`SKIP env vars (no .env.example)`);
    return;
  }
  const schema = read(join(ROOT, 'packages/shared/src/schemas/env.ts'));
  const body = schema.slice(schema.indexOf('z.object('));
  // Optional and defaulted vars need no entry: the app boots without them
  const required = new Set(
    [...body.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):\s*z[\s\S]*?(?=\n\s{2}[A-Z]|\n\}\))/gm)]
      .filter(([declaration]) => !/\.optional\(\)|\.default\(/.test(declaration))
      .map(([, name]) => name),
  );

  const example = read(examplePath);
  const documented = new Set(
    [...required].filter((name) => new RegExp(`^${name}=`, 'm').test(example)),
  );

  compare('env vars', required, documented, 'add the variable to .env.example');
}

function main() {
  const architecture = read(ARCHITECTURE);
  checkRoutes(architecture);
  checkEntities(architecture);
  checkEnvExample();

  console.log(
    failures.length === 0
      ? '\n✓ documentation is in sync with the code'
      : `\n✗ documentation drift in: ${failures.join(', ')}. Update the docs, then re-run: pnpm docs:check`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

try {
  main();
} catch (err) {
  console.error(`FAIL harness: ${err.message}`);
  process.exit(2);
}
