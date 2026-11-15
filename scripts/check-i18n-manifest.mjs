// Read-only verification of committed UI translation provenance. No API or cache access.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { localeCodes } from '../shared/locales.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
if (process.argv.length !== 2) throw new Error('Usage: node scripts/check-i18n-manifest.mjs');
const manifest = JSON.parse(
  await readFile(resolve(root, 'docs/i18n/ui-translation-manifest.json'), 'utf8'),
);
expect(manifest.version === 1, 'Unsupported UI translation manifest');
expect(typeof manifest.model === 'string' && manifest.model.length > 0, 'Missing model provenance');
expect(
  typeof manifest.prompt_version === 'string' && manifest.prompt_version.length > 0,
  'Missing prompt provenance',
);
const locales = localeCodes.filter((locale) => locale !== 'en' && locale !== 'ru');
expect(
  manifest.dictionary_sha256 &&
    JSON.stringify(Object.keys(manifest.dictionary_sha256).sort()) ===
      JSON.stringify([...locales].sort()),
  'UI manifest must cover exactly the 48 translated dictionaries',
);
for (const [path, expected] of [
  ['src/locales/source.json', manifest.source_sha256],
  ['scripts/i18n-reviewed.json', manifest.reviewed_sha256],
  ...locales.map((locale) => [`src/locales/${locale}.json`, manifest.dictionary_sha256[locale]]),
]) {
  expect(
    typeof expected === 'string' && /^[0-9a-f]{64}$/.test(expected),
    `${path}: invalid SHA256`,
  );
  expect(
    sha256(await readFile(resolve(root, path))) === expected,
    `${path}: manifest SHA256 mismatch`,
  );
}
console.log('UI translation manifest: source, reviewed registry and 48 dictionaries match.');
