#!/usr/bin/env node
// Render committed README source/translation blocks only. No API or private cache access.
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { localeCodes } from '../shared/locales.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const translatedLocales = localeCodes.filter((locale) => locale !== 'en' && locale !== 'ru');
const tokenPattern = /\{[A-Z][A-Z_]*\}/g;
const linkPattern = /\[([^\[\]\n]+)\]\((\{[A-Z][A-Z_]*\})\)/g;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sorted = (items) => [...items].sort();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tokens = (text) => sorted(text.match(tokenPattern) ?? []);
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const translated = (block) => ['heading', 'paragraph', 'bullet'].includes(block.kind);

/** Translations may change prose, but cannot add executable/link/section syntax. */
export function validateTranslation(block, text, label = block.id) {
  check(
    typeof text === 'string' && text.trim().length > 0 && text.length <= 12000,
    `${label}: empty or oversized text`,
  );
  check(
    !/[\r\n\u0000-\u001f\u007f\ufffd]/u.test(text),
    `${label}: unexpected line break or control character`,
  );
  check(equal(tokens(block.en), tokens(text)), `${label}: placeholder count mismatch`);
  check(!/[{}]/.test(text.replace(tokenPattern, '')), `${label}: malformed placeholder`);
  const links = (value) => sorted([...value.matchAll(linkPattern)].map((match) => match[2]));
  check(equal(links(block.en), links(text)), `${label}: link target or structure mismatch`);
  check(!/!\[/.test(text), `${label}: unexpected image syntax`);
  for (const match of text.matchAll(linkPattern)) {
    check(!/[<>`\\|]/.test(match[1]), `${label}: unexpected link-label syntax`);
  }
  const prose = text.replace(linkPattern, '').replace(tokenPattern, '');
  check(!/[<>`\[\]\\|]/.test(prose), `${label}: unexpected Markdown or HTML syntax`);
  check(
    !/(?:https?:\/\/|www\.|javascript:|data:|mailto:)/i.test(prose),
    `${label}: unexpected URL`,
  );
  check(
    !/^\s*(?:#{1,6}\s|[-+*>]\s|\d+[.)]\s|---|___|~~~)/u.test(prose),
    `${label}: unexpected block syntax`,
  );
  check(
    (text.match(/\*/g) ?? []).length === (block.en.match(/\*/g) ?? []).length,
    `${label}: emphasis mismatch`,
  );
}

function validateSource(source) {
  check(
    object(source) && source.version === 1 && source.sourceLocale === 'en',
    'Unsupported README source',
  );
  check(
    object(source.protected) && Array.isArray(source.relativeLinks) && Array.isArray(source.blocks),
    'Invalid README source structure',
  );
  check(source.blocks.length > 0 && source.blocks.length <= 500, 'Invalid README block count');
  check(
    new Set(source.blocks.map((block) => block.id)).size === source.blocks.length,
    'Duplicate source block ID',
  );
  for (const [key, value] of Object.entries(source.protected)) {
    check(
      /^[A-Z][A-Z_]*$/.test(key) && typeof value === 'string' && value.length > 0,
      'Invalid protected value',
    );
  }
  check(
    new Set(source.relativeLinks).size === source.relativeLinks.length,
    'Duplicate relative link token',
  );
  for (const key of source.relativeLinks) {
    check(Object.hasOwn(source.protected, key), `Unknown relative link: ${key}`);
    const target = source.protected[key];
    check(
      !/[:?#\\]/.test(target) && !target.startsWith('/') && !target.split('/').includes('..'),
      `Unsafe relative link: ${key}`,
    );
  }
  for (const block of source.blocks) {
    check(
      /^[a-z][a-z0-9_]*$/.test(block.id) &&
        ['heading', 'paragraph', 'bullet', 'code', 'navigation'].includes(block.kind),
      'Invalid source block',
    );
    check(
      typeof block.en === 'string' && typeof block.ru === 'string',
      `${block.id}: missing authored source`,
    );
    for (const token of [...tokens(block.en), ...tokens(block.ru)]) {
      check(
        Object.hasOwn(source.protected, token.slice(1, -1)),
        `${block.id}: unknown protected token`,
      );
    }
    if (translated(block)) {
      validateTranslation(block, block.en, `${block.id}/en`);
      validateTranslation(block, block.ru, `${block.id}/ru`);
    } else {
      check(block.en === block.ru, `${block.id}: shared code/navigation must be identical`);
    }
    if (block.kind === 'heading')
      check(
        Number.isInteger(block.level) && block.level >= 2 && block.level <= 6,
        `${block.id}: invalid heading level`,
      );
    if (block.kind === 'code')
      check(/^[a-z]+$/.test(block.language ?? ''), `${block.id}: invalid code language`);
  }
}

function validateDictionary(source, dictionary, locale) {
  check(object(dictionary), `${locale}: invalid dictionary`);
  const ids = source.blocks.filter(translated).map((block) => block.id);
  check(
    equal(sorted(Object.keys(dictionary)), sorted(ids)),
    `${locale}: translation IDs do not exactly match source`,
  );
  for (const block of source.blocks.filter(translated))
    validateTranslation(block, dictionary[block.id], `${locale}/${block.id}`);
}

function validateReviewed(source, reviewed, dictionaries) {
  check(
    object(reviewed) && reviewed.version === 1 && Array.isArray(reviewed.entries),
    'Invalid README reviewed registry',
  );
  const blocks = new Map(source.blocks.filter(translated).map((block) => [block.id, block]));
  const seen = new Set();
  for (const entry of reviewed.entries) {
    check(object(entry), 'Invalid README reviewed entry');
    const label = `${entry.locale}/${entry.id}`;
    check(translatedLocales.includes(entry.locale), `${label}: unsupported reviewed locale`);
    check(!seen.has(label), `${label}: duplicate reviewed entry`);
    seen.add(label);
    const block = blocks.get(entry.id);
    check(block, `${label}: unknown reviewed block`);
    check(
      entry.en === block.en && entry.ru === block.ru,
      `${label}: reviewed entry does not match the exact source`,
    );
    validateTranslation(block, entry.text, label);
    check(
      dictionaries.get(entry.locale)?.[entry.id] === entry.text,
      `${label}: reviewed correction is missing from the dictionary`,
    );
  }
  return reviewed.entries.length;
}

export function renderMarkdown(source, locale, dictionary = {}) {
  const prefix = locale === 'en' ? '' : '../../';
  const local = new Set(source.relativeLinks);
  const chunks = [];
  let previousKind = '';
  for (const block of source.blocks) {
    let text =
      translated(block) && !['en', 'ru'].includes(locale)
        ? dictionary[block.id]
        : block[locale === 'ru' ? 'ru' : 'en'];
    text = text.replace(tokenPattern, (token) => {
      const key = token.slice(1, -1);
      return (local.has(key) ? prefix : '') + source.protected[key];
    });
    if (block.kind === 'heading') text = '#'.repeat(block.level) + ' ' + text;
    if (block.kind === 'bullet') text = '- ' + text;
    if (block.kind === 'code') text = '```' + block.language + '\n' + text + '\n```';
    if (block.kind === 'bullet' && previousKind === 'bullet')
      chunks[chunks.length - 1] += '\n' + text;
    else chunks.push(text);
    previousKind = block.kind;
  }
  return chunks.join('\n\n') + '\n';
}

async function validateLinks(markdown, path, planned) {
  for (const match of markdown.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
    const destination = match[1];
    if (/^https:\/\//.test(destination)) continue;
    check(!/^[a-z][a-z0-9+.-]*:/i.test(destination), `${path}: unsupported link protocol`);
    const target = resolve(root, dirname(path), destination);
    check(target.startsWith(root + sep), `${path}: local link leaves repository`);
    if (!planned.has(relative(root, target))) {
      try {
        await access(target);
      } catch {
        throw new Error(`${path}: missing local link ${destination}`);
      }
    }
  }
}

async function selfTest() {
  const assert = await import('node:assert/strict');
  const block = {
    id: 'sample',
    kind: 'paragraph',
    en: 'Read [the guide]({GUIDE}) with **care**.',
    ru: 'Читайте [руководство]({GUIDE}) **внимательно**.',
  };
  validateTranslation(block, 'Читайте [руководство]({GUIDE}) **внимательно**.');
  for (const bad of [
    'Read [guide](https://example.org) with **care**.',
    'Read [guide]({GUIDE}) with **care**.\n# Added',
    'Read [guide]({GUIDE}) with **care**. <script>x</script>',
    'Read [guide]({GUIDE}) with **care**. {GUIDE}',
    'Read [guide]({GUIDE}) with **care**. `curl x`',
    'Read [guide]({GUIDE}) with **care**. ![x](https://example.org)',
    'Read ![guide]({GUIDE}) with **care**.',
    'Read [<script>x</script>]({GUIDE}) with **care**.',
  ]) {
    assert.throws(() => validateTranslation(block, bad));
  }
  const source = {
    protected: { GUIDE: 'docs/guide.md' },
    relativeLinks: ['GUIDE'],
    blocks: [
      block,
      {
        id: 'commands',
        kind: 'code',
        language: 'sh',
        en: 'npm ci\nnpm start',
        ru: 'npm ci\nnpm start',
      },
    ],
  };
  const output = renderMarkdown(source, 'ru');
  assert.ok(output.includes('```sh\nnpm ci\nnpm start\n```'));
  assert.ok(output.includes('[руководство](../../docs/guide.md)'));
  assert.throws(() => validateDictionary(source, { wrong: 'x' }, 'pl'));
  assert.throws(() => validateDictionary(source, { sample: '' }, 'pl'));
  const correction = { locale: 'pl', id: block.id, en: block.en, ru: block.ru, text: block.ru };
  const reviewed = { version: 1, entries: [correction] };
  const dictionaries = new Map([['pl', { sample: block.ru }]]);
  assert.equal(validateReviewed(source, reviewed, dictionaries), 1);
  assert.throws(() =>
    validateReviewed(source, { version: 1, entries: [correction, correction] }, dictionaries),
  );
  assert.throws(() =>
    validateReviewed(
      source,
      { version: 1, entries: [{ ...correction, en: 'outdated source' }] },
      dictionaries,
    ),
  );
  assert.throws(() => validateReviewed(source, reviewed, new Map([['pl', { sample: block.en }]])));
  console.log(
    'README renderer self-check passed: translation boundaries, exact IDs, unchanged commands and applied source-bound corrections.',
  );
}

async function main() {
  const args = process.argv.slice(2);
  check(
    args.every((arg) => ['--check', '--self-test'].includes(arg)),
    'Usage: node scripts/render-readmes.mjs [--check | --self-test]',
  );
  if (args.includes('--self-test')) return selfTest();
  const checkOnly = args.includes('--check');
  const sourceBytes = await readFile(resolve(root, 'docs/readme/source.json'));
  const source = JSON.parse(sourceBytes);
  validateSource(source);
  const dictionaryDirectory = resolve(root, 'docs/readme/locales');
  const dictionaryFiles = (await readdir(dictionaryDirectory)).filter((name) =>
    name.endsWith('.json'),
  );
  check(
    equal(sorted(dictionaryFiles), sorted(translatedLocales.map((locale) => `${locale}.json`))),
    'README dictionary files do not exactly match the 48 translated locales',
  );
  const dictionaries = new Map();
  const hashes = {};
  for (const locale of translatedLocales) {
    const bytes = await readFile(resolve(dictionaryDirectory, `${locale}.json`));
    const dictionary = JSON.parse(bytes);
    validateDictionary(source, dictionary, locale);
    dictionaries.set(locale, dictionary);
    hashes[locale] = sha256(bytes);
  }
  let reviewedBytes;
  let reviewedCount = 0;
  try {
    reviewedBytes = await readFile(resolve(root, 'scripts/readme-i18n-reviewed.json'));
    reviewedCount = validateReviewed(source, JSON.parse(reviewedBytes), dictionaries);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile(resolve(root, 'docs/readme/translation-manifest.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (manifest) {
    check(
      manifest.version === 1 && manifest.source_sha256 === sha256(sourceBytes),
      'README manifest source hash mismatch',
    );
    check(
      object(manifest.dictionary_sha256) &&
        equal(sorted(Object.keys(manifest.dictionary_sha256)), sorted(translatedLocales)),
      'README manifest locale coverage mismatch',
    );
    for (const locale of translatedLocales)
      check(
        manifest.dictionary_sha256[locale] === hashes[locale],
        `${locale}: README manifest dictionary hash mismatch`,
      );
    if (Object.hasOwn(manifest, 'reviewed_sha256'))
      check(
        reviewedBytes && manifest.reviewed_sha256 === sha256(reviewedBytes),
        'README manifest reviewed registry hash mismatch',
      );
  }
  const prettier = (await resolveConfig(resolve(root, 'README.md'))) ?? {};
  const outputs = new Map();
  for (const locale of localeCodes) {
    const path = locale === 'en' ? 'README.md' : `docs/readme/README.${locale}.md`;
    outputs.set(
      path,
      await format(renderMarkdown(source, locale, dictionaries.get(locale)), {
        ...prettier,
        parser: 'markdown',
      }),
    );
  }
  outputs.set(
    'README.en.md',
    await format(
      '# OpenPrint\n\nThe complete English README is maintained in [README.md](README.md).\n\n[All README translations](docs/i18n/README.md)\n',
      { ...prettier, parser: 'markdown' },
    ),
  );
  const planned = new Set(outputs.keys());
  for (const [path, markdown] of outputs) await validateLinks(markdown, path, planned);
  const index = await readFile(resolve(root, 'docs/i18n/README.md'), 'utf8');
  await validateLinks(index, 'docs/i18n/README.md', planned);
  for (const locale of localeCodes)
    check(
      index.includes(locale === 'en' ? '(../../README.md)' : `(../readme/README.${locale}.md)`),
      `${locale}: missing README index link`,
    );
  const differences = [];
  for (const [path, markdown] of outputs) {
    if (checkOnly) {
      let saved = null;
      try {
        saved = await readFile(resolve(root, path), 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (saved !== markdown) differences.push(path);
    } else {
      await mkdir(resolve(root, dirname(path)), { recursive: true });
      await writeFile(resolve(root, path), markdown);
    }
  }
  check(
    differences.length === 0,
    `README output differs; run node scripts/render-readmes.mjs: ${differences.join(', ')}`,
  );
  console.log(
    `README ${checkOnly ? 'check' : 'render'} passed: ${localeCodes.length} full editions, ${source.blocks.filter(translated).length} translated blocks each, identical commands, valid local links, ${reviewedCount} applied source-bound corrections${manifest ? ', source/dictionary provenance hashes' : ''}.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
