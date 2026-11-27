import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Store } from '../server/database.js';
import { createApp } from '../server/app.js';
import { importCatalog, parseCatalogImport } from '../server/directory.js';
import { publicStudioSchema, SUBMISSION_MAX_IDENTITIES } from '../server/directory-submissions.js';
import { digest } from '../server/security.js';
import type { PublicStudioInput } from '../shared/directory.js';

const key = () => randomBytes(32).toString('hex');
const studio = (extra: Partial<PublicStudioInput> = {}): PublicStudioInput => ({
  name: 'Fictional workshop',
  city: 'Москва',
  region: '',
  country: '',
  description: 'A fictional public listing for tests',
  technologies: ['FDM/FFF'],
  materials: ['PLA'],
  website: 'https://workshop.example.test',
  phone: '',
  address: 'Fictional street 1',
  lat: 0,
  lng: 0,
  ...extra,
});
const source = {
  sourceKey: 'test',
  sourceName: 'Fictional operator source',
  sourceUrl: 'https://catalog.example.test',
};
async function fixture(options: { trustProxy?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'openprint-submissions-')),
    path = join(dir, 'data.sqlite');
  let store: Store,
    app: ReturnType<typeof createApp>,
    server: ReturnType<ReturnType<typeof createApp>['listen']>,
    base: string;
  async function start() {
    store = new Store(path);
    app = createApp({
      store,
      dataDir: dir,
      appUrl: 'http://test.local',
      studioAI: {},
      cad: { python: '' },
      ...options,
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }
  async function stop() {
    await app.locals.cad?.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  }
  await start();
  const call = async (
    path: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(method !== 'GET'
          ? { Origin: 'http://test.local', 'Content-Type': 'application/json' }
          : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      data: (await response.json()) as any,
      headers: response.headers,
    };
  };
  return {
    get store() {
      return store;
    },
    call,
    create: (managementKey: string, value = studio(), headers: Record<string, string> = {}) =>
      call(
        '/directory/submissions',
        'POST',
        { management_key: managementKey, studio: value, rights_confirmed: true },
        headers,
      ),
    async restart() {
      await stop();
      await start();
    },
    async close() {
      await stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('anonymous listing is immediately public on the directory and map, with no account or secret fields', async () => {
  const f = await fixture();
  try {
    const secret = key(),
      response = await f.create(
        secret,
        studio({ technologies: ['FDM/FFF', 'SLA/DLP/LCD', 'SLM/DMLS (металл)', 'PolyJet'] }),
      );
    assert.equal(response.status, 201);
    assert.equal(response.data.replayed, false);
    const saved = response.data.studio;
    assert.equal(saved.listing_type, 'self-published');
    assert.equal(saved.version, 1);
    assert.equal(saved.source_url, '');
    assert.equal(saved.imported_at, saved.updated_at);
    assert.deepEqual(saved.technologies, ['FDM', 'SLA', 'DMLS', 'PolyJet']);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const paths = ['/directory', '/directory/map', '/directory/catalog/' + saved.id];
    for (const path of paths) {
      const publicResponse = await f.call(path);
      assert.equal(publicResponse.status, 200);
      const text = JSON.stringify(publicResponse.data);
      for (const privateValue of [
        secret,
        digest(secret),
        'key_hash',
        'initial_body_hash',
        'ip_hash',
      ])
        assert.ok(!text.includes(privateValue));
    }
    const map = (await f.call('/directory/map')).data;
    assert.equal(map.total, 1);
    assert.deepEqual(
      map.points.map((point: any) => [point.id, point.lat, point.lng]),
      [[saved.id, 0, 0]],
    );
    assert.equal((await f.call('/directory?technology=FDM')).data.total, 1);
    assert.equal((await f.call('/directory?verified=1')).data.total, 0);
    assert.equal((await f.call('/directory?kind=engineer')).data.total, 0);
    for (const table of ['users', 'profiles', 'jobs', 'reports', 'sessions'])
      assert.equal(f.store.get<{ n: number }>(`SELECT count(*) n FROM ${table}`)!.n, 0);
    assert.equal(
      f.store.get<{ key_hash: string }>('SELECT key_hash FROM directory_submissions')!.key_hash,
      digest(secret),
    );
    assert.ok(!JSON.stringify(f.store.all('SELECT * FROM directory_submissions')).includes(secret));
  } finally {
    await f.close();
  }
});

test('lost create and delete responses replay safely; deletion scrubs contact fields and never resurrects a key', async () => {
  const f = await fixture();
  try {
    const secret = key(),
      original = studio();
    const results = await Promise.all([f.create(secret, original), f.create(secret, original)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
    const id = results[0].data.studio.id,
      path = '/directory/submissions/' + id,
      headers = { 'X-Catalog-Key': secret };
    assert.equal(results[1].data.studio.id, id);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_create_usage')!.n, 1);
    const edit = await f.call(
      path,
      'PATCH',
      { studio: studio({ phone: '+1 555 0100' }), version: 1, rights_confirmed: true },
      headers,
    );
    assert.equal(edit.status, 200);
    assert.equal(edit.data.studio.version, 2);
    const replay = await f.create(secret, original);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.replayed, true);
    assert.equal(replay.data.studio.phone, '+1 555 0100');
    assert.equal(
      (await f.create(secret, studio({ name: 'Changed body' }))).data.code,
      'REQUEST_ID_REUSED',
    );
    assert.equal((await f.call(path, 'DELETE', { version: 2 }, headers)).status, 200);
    assert.equal((await f.call(path, 'DELETE', { version: 2 }, headers)).status, 200);
    assert.equal((await f.create(secret, original)).data.code, 'SUBMISSION_DELETED');
    assert.equal((await f.call(path, 'GET', undefined, headers)).status, 410);
    assert.equal(
      (
        await f.call(
          path,
          'PATCH',
          { studio: original, version: 3, rights_confirmed: true },
          headers,
        )
      ).status,
      410,
    );
    assert.equal((await f.call('/directory/catalog/' + id)).status, 404);
    assert.equal((await f.call('/directory/map')).data.total, 0);
    const row = f.store.get<any>('SELECT * FROM directory_submissions WHERE id=?', id)!;
    for (const field of Object.keys(original)) assert.equal(row[field], null, field);
    assert.equal(row.version, 3);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_create_usage')!.n, 1);
    assert.throws(() =>
      f.store.run('UPDATE directory_submissions SET deleted_at=NULL WHERE id=?', id),
    );
  } finally {
    await f.close();
  }
});

test('management requires the secret header and trusted origin; concurrent edits enforce exact versions', async () => {
  const f = await fixture();
  try {
    const secret = key(),
      created = await f.create(secret),
      id = created.data.studio.id;
    const path = '/directory/submissions/' + id,
      headers = { 'X-Catalog-Key': secret };
    for (const url of [path, path + '?management_key=' + secret]) {
      const denied = await f.call(url);
      assert.equal(denied.status, 403);
      assert.equal(denied.data.code, 'MANAGEMENT_KEY_INVALID');
      assert.equal(denied.headers.get('cache-control'), 'private, no-store');
    }
    assert.equal((await f.call(path, 'GET', undefined, { 'X-Catalog-Key': key() })).status, 403);
    const body = {
      studio: studio({ description: 'Updated fictional text' }),
      version: 1,
      rights_confirmed: true,
    };
    assert.equal(
      (await f.call(path, 'PATCH', body, { ...headers, Origin: 'https://other.example.test' })).data
        .code,
      'ORIGIN',
    );
    const raced = await Promise.all([
      f.call(path, 'PATCH', body, headers),
      f.call(path, 'PATCH', body, headers),
    ]);
    assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
    assert.equal(raced.find((r) => r.status === 409)!.data.code, 'VERSION_CONFLICT');
    assert.equal(
      (await f.call(path, 'DELETE', { version: 1 }, headers)).data.code,
      'VERSION_CONFLICT',
    );
    assert.equal((await f.call(path, 'GET', undefined, headers)).data.studio.version, 2);
    assert.equal(
      (await f.call(path, 'DELETE', { version: 2 }, { ...headers, Origin: '' })).data.code,
      'ORIGIN',
    );
  } finally {
    await f.close();
  }
});

test('Unicode exact duplicates across imports and self additions are atomic while branches and source replacement stay independent', async () => {
  const f = await fixture();
  try {
    importCatalog(
      f.store,
      parseCatalogImport(
        [{ id: 'one', ...studio({ name: 'ＳＴＵＤＩＯ', address: 'Улица 1' }) }],
        source,
      ),
    );
    const duplicate = await f.create(
      key(),
      studio({ name: 'studio', city: 'МОСКВА', address: 'улица 1' }),
    );
    assert.equal(duplicate.data.code, 'DUPLICATE_STUDIO');
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_create_usage')!.n, 0);
    const secret = key(),
      branch = studio({ name: 'studio', address: 'Улица 2' });
    const created = await f.create(secret, branch),
      id = created.data.studio.id;
    assert.equal(created.status, 201);
    const competing = await Promise.all([
      f.create(key(), studio({ name: 'Concurrent' })),
      f.create(key(), studio({ name: 'CONCURRENT' })),
    ]);
    assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
    const conflict = await f.call(
      '/directory/submissions/' + id,
      'PATCH',
      {
        studio: studio({ name: 'studio', address: 'Улица 1' }),
        version: 1,
        rights_confirmed: true,
      },
      { 'X-Catalog-Key': secret },
    );
    assert.equal(conflict.data.code, 'DUPLICATE_STUDIO');
    assert.equal((await f.call('/directory/catalog/' + id)).data.studio.version, 1);
    importCatalog(
      f.store,
      parseCatalogImport([{ id: 'two', ...studio({ name: 'Replacement import' }) }], source),
    );
    assert.equal((await f.call('/directory/catalog/' + id)).data.studio.name, 'studio');
    assert.equal((await f.call('/directory')).data.total, 3);
    const beforeRejectedImport = f.store.all('SELECT * FROM catalog_studios');
    assert.throws(
      () =>
        importCatalog(
          f.store,
          parseCatalogImport(
            [
              { id: 'valid-first', ...studio({ name: 'Valid imported row' }) },
              { id: 'duplicate-last', ...branch },
            ],
            source,
          ),
        ),
      /already|overlaps/,
    );
    assert.deepEqual(f.store.all('SELECT * FROM catalog_studios'), beforeRejectedImport);
    const imported = (await f.call('/directory')).data.entries.find(
      (entry: any) => entry.studio.listing_type === 'imported',
    ).studio;
    assert.equal(imported.version, 0);
    assert.equal(imported.updated_at, imported.imported_at);
    assert.equal(
      (
        await f.call('/directory/submissions/' + imported.id, 'GET', undefined, {
          'X-Catalog-Key': secret,
        })
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});

test('public creation rejects unsafe or incomplete input before mutation and requires explicit rights and origin', async () => {
  const f = await fixture();
  try {
    const valid = { management_key: key(), studio: studio(), rights_confirmed: true };
    const invalid = [
      { ...valid, rights_confirmed: false },
      { ...valid, management_key: key() + '\n' },
      { ...valid, management_key: 'A'.repeat(64) },
      { ...valid, email: 'private@example.test' },
      ...[
        { name: 'x' },
        { city: '' },
        { website: '', phone: '' },
        { website: '', phone: 'abc' },
        { website: 'javascript:alert(1)' },
        { website: 'https://user:pass@example.test' },
        { website: 'https://example.test/white space' },
        { lat: 91 },
        { lng: -181 },
        { lat: null },
        { lat: '0' },
        { email: 'private@example.test' },
      ].map((extra) => ({ ...valid, studio: { ...valid.studio, ...extra } })),
    ];
    for (const body of invalid) {
      const rejected = await f.call('/directory/submissions', 'POST', body);
      assert.equal(rejected.status, 400);
      assert.equal(rejected.data.code, 'VALIDATION');
      assert.ok(!JSON.stringify(rejected.data).includes(valid.management_key));
    }
    assert.equal(
      (
        await f.call('/directory/submissions', 'POST', valid, {
          Origin: 'https://evil.example.test',
        })
      ).data.code,
      'ORIGIN',
    );
    assert.equal(
      (await f.call('/directory/submissions', 'POST', valid, { Origin: '' })).data.code,
      'ORIGIN',
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_submissions')!.n, 0);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_create_usage')!.n, 0);
    assert.ok(
      !publicStudioSchema.safeParse(studio({ technologies: Array(41).fill('FDM') })).success,
    );
    assert.ok(!publicStudioSchema.safeParse(studio({ description: 'a'.repeat(4001) })).success);
    for (const phone of ['12345', '1234567890123456789', '+12+3456789', '123456 extension'])
      assert.ok(!publicStudioSchema.safeParse(studio({ phone })).success);
    assert.ok(publicStudioSchema.safeParse(studio({ phone: '+1 (555) 010-0000' })).success);
    const nullable = await f.create(
      key(),
      studio({ lat: null, lng: null, website: '', phone: '+1 555 0100' }),
    );
    assert.equal(nullable.status, 201);
    assert.equal((await f.call('/directory/map')).data.unmapped, 1);
  } finally {
    await f.close();
  }
});

test('creation quota survives deletion and process restart, hashes the real IP and expires with a bounded rolling ledger', async () => {
  const f = await fixture();
  try {
    const firstKey = key(),
      firstStudio = studio({ name: 'Quota 0' });
    const first = await f.create(firstKey, firstStudio);
    for (let i = 1; i < 5; i++)
      assert.equal((await f.create(key(), studio({ name: 'Quota ' + i }))).status, 201);
    const salt = f.store.get<{ value: string }>(
      "SELECT value FROM meta WHERE key='directory_ip_salt'",
    )!.value;
    const hashes = f.store.all<{ ip_hash: string }>(
      'SELECT DISTINCT ip_hash FROM directory_create_usage',
    );
    assert.equal(hashes.length, 1);
    assert.match(hashes[0].ip_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hashes[0].ip_hash, digest('127.0.0.1'));
    assert.equal(
      (await f.create(key(), studio({ name: 'Over quota' }), { 'X-Forwarded-For': '192.0.2.99' }))
        .data.code,
      'RATE_LIMIT',
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_submissions')!.n, 5);
    await f.restart();
    assert.equal(
      f.store.get<{ value: string }>("SELECT value FROM meta WHERE key='directory_ip_salt'")!.value,
      salt,
    );
    assert.equal((await f.create(firstKey, firstStudio)).status, 200);
    await f.call(
      '/directory/submissions/' + first.data.studio.id,
      'DELETE',
      { version: 1 },
      { 'X-Catalog-Key': firstKey },
    );
    assert.equal(
      (await f.create(key(), studio({ name: 'Still limited' }))).data.code,
      'RATE_LIMIT',
    );
    f.store.run('UPDATE directory_create_usage SET created_at=?', Date.now() - 86400001);
    assert.equal((await f.create(key(), studio({ name: 'Next day' }))).status, 201);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_create_usage')!.n, 1);
  } finally {
    await f.close();
  }
});

test('instance quota and lifetime tombstone capacity reject atomically without orphan identities', async () => {
  const f = await fixture({ trustProxy: true });
  try {
    const now = Date.now();
    f.store.transaction(() => {
      for (let i = 0; i < 200; i++) {
        const id = randomUUID();
        f.store.run(
          'INSERT INTO directory_submissions(id,key_hash,initial_body_hash,version,created_at,updated_at,deleted_at) VALUES(?,?,?,2,?,?,?)',
          id,
          key(),
          key(),
          now,
          now,
          now,
        );
        f.store.run(
          'INSERT INTO directory_create_usage(submission_id,ip_hash,created_at) VALUES(?,?,?)',
          id,
          key(),
          now,
        );
      }
    });
    assert.equal(
      (await f.create(key(), studio(), { 'X-Forwarded-For': '192.0.2.1' })).data.code,
      'RATE_LIMIT',
    );
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) n FROM directory_submissions')!.n,
      200,
    );
    f.store.run('DELETE FROM directory_create_usage');
    f.store.run(
      `WITH RECURSIVE sequence(n) AS (VALUES(201) UNION ALL SELECT n+1 FROM sequence WHERE n<?)
      INSERT INTO directory_submissions(id,key_hash,initial_body_hash,version,created_at,updated_at,deleted_at)
      SELECT printf('fixture-%d',n),lower(hex(randomblob(32))),lower(hex(randomblob(32))),2,?,?,? FROM sequence`,
      SUBMISSION_MAX_IDENTITIES,
      now,
      now,
      now,
    );
    assert.equal((await f.create(key(), studio())).data.code, 'SUBMISSION_CAPACITY');
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) n FROM directory_submissions')!.n,
      SUBMISSION_MAX_IDENTITIES,
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_create_usage')!.n, 0);
  } finally {
    await f.close();
  }
});

test('schema 5 upgrades additively to 6 and default catalog mode excludes every registered profile', async () => {
  const f = await fixture();
  try {
    importCatalog(f.store, parseCatalogImport([{ id: 'migration', ...studio() }], source));
    const owner = randomUUID(),
      profile = randomUUID();
    f.store.run(
      "INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,'Legacy owner','not-a-login',1)",
      owner,
      owner + '@example.test',
    );
    f.store.run(
      "INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,verified,lat,lng,created_at) VALUES(?,?,'Legacy verified','studio','Москва','','[]','[]',1,10,20,1)",
      profile,
      owner,
    );
    f.store.run("INSERT INTO meta(key,value) VALUES('preserved-marker','unchanged')");
    const tables = f.store.all<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT IN ('directory_submissions','directory_create_usage') ORDER BY name",
    );
    const previous = new Map(
      tables.map(({ name }) => [name, JSON.stringify(f.store.all(`SELECT * FROM "${name}"`))]),
    );
    f.store.db.exec(
      'DROP TABLE directory_create_usage; DROP TABLE directory_submissions; DROP TABLE project_request_receipts; DROP INDEX profiles_network; ALTER TABLE profiles DROP COLUMN network_listed; PRAGMA user_version=5;',
    );
    await f.restart();
    assert.equal(f.store.get<{ user_version: number }>('PRAGMA user_version')!.user_version, 8);
    for (const [table, records] of previous)
      assert.equal(JSON.stringify(f.store.all(`SELECT * FROM "${table}"`)), records, table);
    assert.deepEqual(f.store.all('PRAGMA foreign_key_check'), []);
    assert.equal(
      f.store.get<{ integrity_check: string }>('PRAGMA integrity_check')!.integrity_check,
      'ok',
    );
    const all = (await f.call('/directory')).data;
    assert.equal(all.total, 1);
    assert.equal(all.members, 0);
    assert.equal((await f.call('/directory/map')).data.total, 1);
    assert.equal((await f.call('/directory?source=member')).data.total, 0);
    assert.equal((await f.call('/directory/map?source=member')).data.total, 0);
    assert.equal((await f.call('/directory?verified=1')).data.total, 0);
    assert.equal((await f.call('/profiles')).status, 404);
  } finally {
    await f.close();
  }
});

test('management reads and writes have separate bounded per-IP throttles without changing rejected versions', async () => {
  const f = await fixture();
  try {
    const secret = key(),
      created = await f.create(secret),
      id = created.data.studio.id;
    const path = '/directory/submissions/' + id,
      headers = { 'X-Catalog-Key': secret };
    for (let version = 1; version <= 20; version++) {
      const result = await f.call(
        path,
        'PATCH',
        { studio: studio(), version, rights_confirmed: true },
        headers,
      );
      assert.equal(result.status, 200);
    }
    assert.equal(
      (
        await f.call(
          path,
          'PATCH',
          { studio: studio(), version: 21, rights_confirmed: true },
          headers,
        )
      ).data.code,
      'RATE_LIMIT',
    );
    assert.equal((await f.call(path, 'DELETE', { version: 21 }, headers)).data.code, 'RATE_LIMIT');
    for (let i = 0; i < 60; i++)
      assert.equal((await f.call(path, 'GET', undefined, headers)).status, 200);
    assert.equal((await f.call(path, 'GET', undefined, headers)).data.code, 'RATE_LIMIT');
    assert.equal((await f.call('/directory/catalog/' + id)).data.studio.version, 21);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM directory_submissions')!.n, 1);
  } finally {
    await f.close();
  }
});
