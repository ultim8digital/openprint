import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import {
  localeCodes,
  LOCALES,
  localeTag,
  localeDirection,
  normalizeLocale,
} from '../shared/locales.js';
import { messageId, interpolate } from '../shared/messages.js';
import { studioCreateSchema } from '../shared/studio.js';
import { createTranslator } from '../server/i18n.js';
import { Store } from '../server/database.js';

type Message = { id: string; ru: string; en: string; refs: string[] };
const source = JSON.parse(
  readFileSync(new URL('../src/locales/source.json', import.meta.url), 'utf8'),
).messages as Message[];
const placeholders = (value: string) =>
  [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();

test('50 app locales preserve legacy preferences and have valid formatting and direction metadata', () => {
  assert.equal(localeCodes.length, 50);
  assert.equal(new Set(localeCodes).size, 50);
  assert.deepEqual(
    LOCALES.filter((locale) => locale.dir === 'rtl')
      .map((locale) => locale.code)
      .sort(),
    ['ar-SA', 'he', 'ur-PK'],
  );
  for (const locale of localeCodes) {
    assert.equal(normalizeLocale(locale), locale);
    assert.equal(Intl.NumberFormat.supportedLocalesOf([localeTag(locale)]).length, 1);
    assert.equal(Intl.DateTimeFormat.supportedLocalesOf([localeTag(locale)]).length, 1);
    assert.doesNotThrow(() => new Intl.NumberFormat(localeTag(locale)).format(1234.5));
    assert.doesNotThrow(() => new Intl.DateTimeFormat(localeTag(locale)).format(0));
    assert.ok(['ltr', 'rtl'].includes(localeDirection(locale)));
    assert.equal(
      studioCreateSchema.safeParse({
        language: locale,
        idea: 'A custom enclosure for a small sensor.',
      }).success,
      true,
    );
  }
  for (const [alias, expected] of Object.entries({
    'en-US': 'en',
    EN_us: 'en',
    de: 'de-DE',
    'zh-TW': 'zh-Hant',
    'zh-CN': 'zh-Hans',
    nb: 'no',
    ar: 'ar-SA',
  }))
    assert.equal(normalizeLocale(alias), expected);
  for (const invalid of ['', '../../en', 'javascript:alert(1)', 'unknown', null, 1])
    assert.equal(normalizeLocale(invalid), null);
  assert.equal(
    studioCreateSchema.safeParse({
      language: '../../en',
      idea: 'A custom enclosure for a small sensor.',
    }).success,
    false,
  );
});

test('every shipped locale has every source message and preserves interpolation tokens', () => {
  const ids = source.map((message) => message.id).sort();
  assert.ok(ids.length > 1000);
  assert.equal(new Set(ids).size, ids.length);
  for (const message of source) {
    assert.equal(messageId(message.ru, message.en), message.id);
    assert.deepEqual(placeholders(message.ru), placeholders(message.en));
  }
  for (const locale of localeCodes.filter((code) => code !== 'ru' && code !== 'en')) {
    const dictionary = JSON.parse(
      readFileSync(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>;
    assert.deepEqual(Object.keys(dictionary).sort(), ids, `${locale}: exact source coverage`);
    for (const message of source) {
      assert.equal(typeof dictionary[message.id], 'string', `${locale}/${message.id}`);
      assert.ok(dictionary[message.id].trim(), `${locale}/${message.id}: empty translation`);
      assert.deepEqual(
        placeholders(dictionary[message.id]),
        placeholders(message.en),
        `${locale}/${message.id}: placeholders`,
      );
      assert.ok(
        !/\uFFFD/.test(dictionary[message.id]),
        `${locale}/${message.id}: replacement character`,
      );
    }
    const t = createTranslator(locale);
    const sample = source.find((message) => message.en === 'Specify the quantity.');
    assert.ok(sample);
    assert.equal(
      t(sample.ru, sample.en),
      dictionary[sample.id],
      `${locale}: server uses same reviewed dictionary`,
    );
  }
});

test('reviewed translation corrections match their exact source and shipped dictionary', () => {
  const registry = JSON.parse(
    readFileSync(new URL('../scripts/i18n-reviewed.json', import.meta.url), 'utf8'),
  ) as {
    version: number;
    entries: { locale: string; id: string; ru: string; en: string; text: string; reason: string }[];
  };
  assert.equal(registry.version, 1);
  assert.ok(registry.entries.length > 0);
  const seen = new Set<string>();
  for (const entry of registry.entries) {
    const identity = `${entry.locale}/${entry.id}`;
    assert.equal(seen.has(identity), false, `duplicate review: ${identity}`);
    seen.add(identity);
    assert.ok(localeCodes.some((locale) => locale === entry.locale));
    const message = source.find(({ id }) => id === entry.id);
    assert.ok(message, `unknown review source: ${identity}`);
    assert.equal(entry.ru, message.ru, `changed review source: ${identity}`);
    assert.equal(entry.en, message.en, `changed review source: ${identity}`);
    assert.ok(entry.reason.trim());
    const dictionary = JSON.parse(
      readFileSync(new URL(`../src/locales/${entry.locale}.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>;
    assert.equal(dictionary[entry.id], entry.text, `unapplied review: ${identity}`);
  }
});

test('message IDs distinguish equal English labels and interpolation is literal and bounded', () => {
  assert.notEqual(
    messageId('Открыть запрос', 'Open request'),
    messageId('Открытый запрос', 'Open request'),
  );
  assert.equal(
    interpolate('Hello {name}; {count}; {missing}', { name: '$&<script>', count: 4 }),
    'Hello $&<script>; 4; {missing}',
  );
  assert.equal(interpolate('{constructor} {toString}', {}), '{constructor} {toString}');
});

test('v6 language migration preserves parent and immutable child history without cascading deletes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openprint-locale-migration-'));
  const path = join(dir, 'test.sqlite');
  let store: Store | undefined;
  try {
    store = new Store(path);
    store.run(
      "INSERT INTO users(id,email,name,password_hash,created_at) VALUES('owner','owner@example.test','Owner','test-only',1)",
    );
    store.run(
      "INSERT INTO studio_projects(id,owner_id,idea,language,brief,version,source,created_at,updated_at) VALUES('project','owner','A retained private brief','ru','{}',1,'manual',1,1)",
    );
    store.run(
      "INSERT INTO studio_revisions(project_id,version,brief,source,created_at) VALUES('project',1,'{}','manual',1)",
    );
    store.run(
      "INSERT INTO studio_confirmations(project_id,version,brief_hash,confirmed_at) VALUES('project',1,'unchanged-hash',1)",
    );
    store.close();
    store = undefined;
    // Recreate the actual pre-localization language CHECK, retaining a parent and children.
    const legacy = new DatabaseSync(path);
    try {
      const schema = (
        legacy
          .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='studio_projects'")
          .get() as { sql: string }
      ).sql;
      legacy.exec('PRAGMA foreign_keys=OFF; BEGIN');
      legacy.exec(
        schema
          .replace(/CREATE TABLE "?studio_projects"?/, 'CREATE TABLE legacy_projects')
          .replace(/language IN \([^)]*\)/, "language IN ('ru','en')"),
      );
      legacy.exec(
        'INSERT INTO legacy_projects SELECT * FROM studio_projects; DROP TABLE studio_projects; ALTER TABLE legacy_projects RENAME TO studio_projects; DROP TABLE project_request_receipts; DROP INDEX profiles_network; ALTER TABLE profiles DROP COLUMN network_listed; PRAGMA user_version=6; COMMIT',
      );
      assert.throws(() => legacy.prepare("UPDATE studio_projects SET language='ja'").run());
    } finally {
      legacy.close();
    }
    store = new Store(path);
    assert.equal(store.get<{ user_version: number }>('PRAGMA user_version')?.user_version, 8);
    assert.equal(
      store.get<{ language: string }>("SELECT language FROM studio_projects WHERE id='project'")
        ?.language,
      'ru',
    );
    assert.equal(
      store.get<{ brief_hash: string }>('SELECT brief_hash FROM studio_confirmations')?.brief_hash,
      'unchanged-hash',
    );
    assert.equal(store.get<{ n: number }>('SELECT count(*) n FROM studio_revisions')?.n, 1);
    assert.deepEqual(store.all('PRAGMA foreign_key_check'), []);
    assert.throws(() => store!.run("UPDATE studio_revisions SET brief='[]'"));
    store.run("UPDATE studio_projects SET language='ja'");
    assert.throws(() => store!.run("UPDATE studio_projects SET language='unsupported'"));
    assert.throws(() => store!.run("DELETE FROM users WHERE id='owner'"));
    store.close();
    store = new Store(path);
    assert.equal(
      store.get<{ language: string }>('SELECT language FROM studio_projects')?.language,
      'ja',
    );
  } finally {
    store?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
