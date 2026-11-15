import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const specDir = join(root, 'tests/e2e');
const allSpecs = readdirSync(specDir)
  .filter((name) => name.endsWith('.spec.ts'))
  .sort();
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'Usage: npm run test:e2e -- [cad.spec.ts studio.spec.ts ...]\n' +
      'Runs exact spec files with a fresh server and database for each, then merges the report.\n' +
      'For other Playwright options, use npx playwright test <single-spec> <options>.',
  );
  process.exit(0);
}
const selected = args.length ? [...new Set(args.map((arg) => basename(arg)))] : allSpecs;
for (const arg of args) {
  const name = basename(arg);
  if (!allSpecs.includes(name) || (arg !== name && resolve(root, arg) !== join(specDir, name))) {
    console.error(`Expected an exact E2E spec filename, received: ${arg}`);
    process.exit(2);
  }
}
if (!selected.length) throw new Error('No E2E spec files found');

const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const blobs = join(root, '.local/e2e-blobs', randomUUID());
const resultsDir = join(root, 'test-results');
const reportDir = join(root, 'playwright-report');
mkdirSync(blobs, { recursive: true });
rmSync(resultsDir, { recursive: true, force: true });
rmSync(reportDir, { recursive: true, force: true });

let active;
let interrupted = 0;
let shutdownTimer;
function stop(signal) {
  if (interrupted) return;
  interrupted = signal === 'SIGINT' ? 130 : 143;
  // Playwright's SIGINT handler tears down its workers and webServer before exit.
  active?.kill('SIGINT');
  shutdownTimer = setTimeout(() => active?.kill('SIGTERM'), 15000);
  shutdownTimer.unref();
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

async function run(commandArgs, env = {}) {
  return await new Promise((resolveExit) => {
    const child = spawn(process.execPath, [cli, ...commandArgs], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    active = child;
    child.on('error', (error) => console.error(error.message));
    child.once('close', (code) => {
      active = undefined;
      clearTimeout(shutdownTimer);
      resolveExit(code ?? 1);
    });
  });
}

const outcomes = [];
for (const spec of selected) {
  if (interrupted) break;
  const group = spec.replace(/\.spec\.ts$/, '');
  const blobFile = join(blobs, `${group}.zip`);
  console.log(`\nE2E ${spec}: fresh server and database`);
  // Playwright file filters are regular expressions; match only this full filename.
  const filter = relative(root, join(specDir, spec)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
  const code = await run(
    [
      'test',
      filter,
      '--forbid-only',
      '--reporter=list,blob',
      `--output=${join(resultsDir, group)}`,
    ],
    {
      PLAYWRIGHT_BLOB_OUTPUT_FILE: blobFile,
      E2E_DIRECTORY_FIXTURE: spec === 'directory.spec.ts' ? '1' : '0',
      E2E_CATALOG_MODE: ['catalog-submit.spec.ts', 'i18n.spec.ts'].includes(spec) ? '1' : '0',
    },
  );
  outcomes.push({ spec, code: code || (existsSync(blobFile) ? 0 : 1) });
}

let mergeCode = 0;
if (!interrupted && readdirSync(blobs).some((name) => name.endsWith('.zip'))) {
  mergeCode = await run(['merge-reports', '--reporter=html', blobs], {
    PLAYWRIGHT_HTML_OUTPUT_DIR: reportDir,
    PLAYWRIGHT_HTML_OPEN: 'never',
  });
}
for (const outcome of outcomes) {
  console.log(`${outcome.code === 0 ? 'PASS' : 'FAIL'} ${outcome.spec}`);
}
process.exitCode = interrupted || (mergeCode || outcomes.some(({ code }) => code !== 0) ? 1 : 0);
