import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  openSync,
  ftruncateSync,
  closeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { SQLInputValue } from 'node:sqlite';
import { Store } from '../server/database.js';
import { createApp } from '../server/app.js';
import {
  parseCatalogImport,
  importCatalog,
  catalogPublicId,
  CATALOG_MAX_FILE_BYTES,
} from '../server/directory.js';
import { readCatalogFile, runCatalogImport } from '../scripts/catalog-import.js';
import type { CadService } from '../server/cad-runner.js';

const source = {
  sourceKey: 'fictional-catalog',
  sourceName: 'Fictional catalog',
  sourceUrl: 'https://catalog.example.test',
};
const record = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Workshop ${id}`,
  city: 'Test city',
  region: 'Fictional region',
  country: '',
  description: 'An imported directory entry, not a registered service provider.',
  technologies: ['FDM/FFF'],
  materials: ['PLA'],
  website: 'https://workshop.example.test',
  phone: '',
  address: '',
  lat: 10,
  lng: 20,
  ...extra,
});
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'openprint-directory-')),
    store = new Store(join(dir, 'openprint.sqlite'));
  const app = createApp({
    store,
    dataDir: dir,
    appUrl: 'http://test.local',
    studioAI: {},
    cad: { python: '' },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (path: string) => {
    const response = await fetch(`${base}/api${path}`);
    return { status: response.status, data: await response.json() };
  };
  const member = (
    options: {
      name?: string;
      city?: string;
      kind?: string;
      published?: number;
      suspended?: number;
      verified?: number;
      lat?: number | null;
      lng?: number | null;
      technologies?: string[];
    } = {},
  ) => {
    const id = randomUUID(),
      userId = randomUUID();
    store.run(
      'INSERT INTO users(id,email,name,password_hash,suspended,created_at) VALUES(?,?,?,?,?,?)',
      userId,
      `${userId}@example.test`,
      'Fictional member',
      'not-a-real-login',
      options.suspended ?? 0,
      Date.now(),
    );
    store.run(
      `INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,website,lat,lng,verified,published,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      userId,
      options.name ?? 'Registered workshop',
      options.kind ?? 'studio',
      options.city ?? 'Test city',
      'Fictional registered member',
      JSON.stringify(options.technologies ?? ['FDM']),
      '["PLA"]',
      '',
      options.lat === undefined ? 0 : options.lat,
      options.lng === undefined ? 0 : options.lng,
      options.verified ?? 0,
      options.published ?? 1,
      Date.now(),
    );
    return { id, userId };
  };
  return {
    dir,
    store,
    get,
    member,
    async close() {
      await (app.locals.cad as CadService).stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('directory list and map share exact filters and counts while map ignores the first-page limit', async () => {
  const f = await fixture();
  try {
    const rows = Array.from({ length: 14 }, (_, i) =>
      record(String(i), i === 13 ? { lat: null, lng: null } : {}),
    );
    importCatalog(f.store, parseCatalogImport(rows, source));
    const zero = f.member({ verified: 1, kind: 'both' });
    f.member({ kind: 'engineer', lat: null, lng: null });
    f.member({ published: 0 });
    f.member({ suspended: 1 });
    const first = await f.get('/directory?limit=12');
    assert.equal(first.status, 200);
    assert.equal(first.data.entries.length, 12);
    assert.equal(first.data.total, 16);
    assert.equal(first.data.members, 2);
    assert.equal(first.data.catalog, 14);
    assert.equal(first.data.has_more, true);
    const second = await f.get('/directory?limit=12&offset=12');
    assert.equal(second.data.entries.length, 4);
    assert.equal(second.data.has_more, false);
    const ids = [...first.data.entries, ...second.data.entries].map(
      (entry: any) => entry.profile?.id ?? entry.studio.id,
    );
    assert.equal(new Set(ids).size, 16);
    const map = await f.get('/directory/map?limit=1&offset=999999');
    assert.equal(map.data.points.length, 14);
    assert.equal(map.data.total, 16);
    assert.equal(map.data.mappable, 14);
    assert.equal(map.data.unmapped, 2);
    assert.equal(map.data.truncated, false);
    assert.ok(
      map.data.points.some(
        (point: any) => point.id === zero.id && point.lat === 0 && point.lng === 0,
      ),
    );
    for (const point of map.data.points)
      assert.deepEqual(Object.keys(point).sort(), ['city', 'id', 'lat', 'lng', 'name', 'source']);
    for (const [query, expected] of [
      ['source=catalog', 14],
      ['source=member', 2],
      ['kind=engineer', 2],
      ['kind=both', 1],
      ['kind=studio', 15],
      ['verified=1', 1],
      ['source=catalog&verified=1', 0],
      ['source=catalog&kind=engineer', 0],
    ] as const) {
      const list = await f.get('/directory?' + query),
        mapped = await f.get('/directory/map?' + query);
      assert.equal(list.data.total, expected, query);
      assert.equal(mapped.data.total, expected, query);
    }
    const oldProfiles = await f.get('/profiles?limit=200');
    assert.equal(oldProfiles.data.profiles.length, 2, 'legacy profiles API remains member-only');
  } finally {
    await f.close();
  }
});

test('Unicode and literal wildcard searches work, technology aliases are deliberate, and malformed filters are bounded', async () => {
  const f = await fixture();
  try {
    importCatalog(
      f.store,
      parseCatalogImport(
        [
          record('cyrillic', {
            name: 'Мастерская 100%_точно',
            city: 'МОСКВА',
            technologies: [
              'FDM/FFF',
              'SLA/DLP/LCD',
              'SLM/DMLS (металл)',
              'PolyJet',
              'Binder Jetting',
            ],
          }),
          record('other', {
            name: 'Other studio',
            city: 'Moscow',
            technologies: ['Custom-X', 'constructor'],
          }),
          record('slash', { name: 'Workshop \\ tools', technologies: [] }),
        ],
        source,
      ),
    );
    f.member({ name: 'мастерская участника', city: 'Москва' });
    assert.equal((await f.get('/directory?q=' + encodeURIComponent('МАСТЕРСКАЯ'))).data.total, 2);
    assert.equal((await f.get('/directory?city=' + encodeURIComponent('москва'))).data.total, 2);
    for (const query of ['%', '_', '%_'])
      assert.equal((await f.get('/directory?q=' + encodeURIComponent(query))).data.total, 1);
    assert.equal((await f.get('/directory?q=' + encodeURIComponent('\\'))).data.total, 1);
    assert.equal((await f.get('/directory?q=' + encodeURIComponent("' OR 1=1 --"))).data.total, 0);
    for (const tech of ['SLA', 'DMLS', 'PolyJet', 'Binder Jetting', 'Custom-X', 'constructor'])
      assert.equal(
        (await f.get('/directory?technology=' + encodeURIComponent(tech))).data.total,
        1,
        tech,
      );
    assert.equal((await f.get('/directory?technology=FDM')).data.total, 2);
    assert.equal(
      (await f.get('/directory?technology=FFF')).data.total,
      0,
      'unknown mappings are not invented',
    );
    for (const query of [
      'source=other',
      'verified=yes',
      'kind=owner',
      'limit=201',
      'offset=-1',
      'q=' + 'x'.repeat(101),
      'q=a&q=b',
    ])
      assert.equal((await f.get('/directory?' + query)).status, 400, query);
    assert.equal(
      (await f.get('/directory/map?limit=invalid&offset=-1')).status,
      200,
      'map never applies list pagination',
    );
  } finally {
    await f.close();
  }
});

test('directory count and records retain one read snapshot across a concurrent importer commit', async () => {
  const f = await fixture(),
    writer = new Store(f.store.path);
  const get = f.store.get.bind(f.store);
  try {
    for (const endpoint of ['/directory?limit=200', '/directory/map']) {
      importCatalog(
        writer,
        parseCatalogImport(
          Array.from({ length: 15 }, (_, i) => record(`old-${i}`)),
          source,
        ),
      );
      let committed = false;
      f.store.get = ((sql: string, ...params: SQLInputValue[]) => {
        const result = get(sql, ...params);
        if (!committed && sql.includes('count(*) total') && sql.includes('FROM filtered')) {
          committed = true;
          importCatalog(writer, parseCatalogImport([record('new')], source));
        }
        return result;
      }) as Store['get'];
      const response = await f.get(endpoint);
      assert.equal(response.status, 200);
      assert.equal(committed, true);
      assert.equal(response.data.total, 15);
      assert.equal(
        (response.data.entries ?? response.data.points).length,
        15,
        'rows remain in the counted snapshot',
      );
      f.store.get = get;
      assert.equal(
        (await f.get(endpoint)).data.total,
        1,
        'the next request observes the committed replacement',
      );
    }
  } finally {
    f.store.get = get;
    writer.close();
    await f.close();
  }
});

test('catalog import replaces only its own source with stable namespaced IDs and never creates accounts or trusts extra fields', async () => {
  const f = await fixture();
  try {
    const member = f.member();
    const privateExtra = {
      email: 'must-not-persist@example.test',
      rating: 5,
      reviews: 9999,
      hours: ['private'],
      verified: true,
      user_id: member.userId,
      source_url: 'https://untrusted-record.example',
      source_name: 'Invented authority',
      price: 'secret',
      segment: 'other',
    };
    const parsed = parseCatalogImport([record('a', privateExtra), record('b')], source);
    assert.equal((parsed.records[0] as any).email, undefined);
    const first = importCatalog(f.store, parsed);
    assert.equal(first.imported, 2);
    assert.equal(first.replaced, 0);
    const aId = catalogPublicId(source.sourceKey, 'a');
    const original = (await f.get('/directory/catalog/' + aId)).data.studio;
    assert.equal(original.source_url, source.sourceUrl);
    assert.equal(original.source_name, source.sourceName);
    assert.equal(original.country, '');
    assert.deepEqual(original.technologies, ['FDM']);
    assert.equal(JSON.stringify(original).includes('must-not-persist'), false);
    for (const key of [
      'email',
      'rating',
      'reviews',
      'hours',
      'price',
      'segment',
      'verified',
      'user_id',
      'source_id',
      'source_key',
    ])
      assert.equal(key in original, false, key);
    assert.equal(
      (await f.get('/profiles/' + aId)).status,
      404,
      'catalog entries cannot impersonate order recipients',
    );
    assert.equal((await f.get('/directory/catalog/' + member.id)).status, 404);
    assert.equal((await f.get('/directory/catalog/not-a-uuid')).status, 404);
    const otherSource = { ...source, sourceKey: 'second-source' };
    importCatalog(f.store, parseCatalogImport([record('a')], otherSource));
    assert.notEqual(catalogPublicId(otherSource.sourceKey, 'a'), aId);
    const repeated = importCatalog(
      f.store,
      parseCatalogImport([record('b'), record('a', { name: 'Renamed workshop' })], {
        ...source,
        sourceName: 'Renamed source',
      }),
    );
    assert.equal(repeated.replaced, 2);
    assert.equal((await f.get('/directory/catalog/' + aId)).data.studio.name, 'Renamed workshop');
    importCatalog(f.store, parseCatalogImport([record('a')], source));
    assert.equal(
      (await f.get('/directory/catalog/' + catalogPublicId(source.sourceKey, 'b'))).status,
      404,
    );
    assert.equal(
      (await f.get('/directory/catalog/' + catalogPublicId(otherSource.sourceKey, 'a'))).status,
      200,
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM users')!.n, 1);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM profiles')!.n, 1);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM jobs')!.n, 0);
    assert.deepEqual(f.store.all('PRAGMA foreign_key_check'), []);
  } finally {
    await f.close();
  }
});

test('invalid catalog batches and mid-transaction failures preserve every previously imported record', () => {
  const store = new Store(':memory:');
  try {
    importCatalog(store, parseCatalogImport([record('old')], source));
    const before = store.all('SELECT * FROM catalog_studios');
    const invalid = [
      [],
      [record('x'), record('x')],
      [record('x'), record('last', { lat: null })],
      [record('x', { lat: '10' })],
      [record('x', { lat: 91 })],
      [record('x', { lng: -181 })],
      [record('x', { lat: NaN })],
      [record('x', { website: 'javascript:alert(1)' })],
      [record('x', { website: 'https://user:password@example.test' })],
      [record('x', { website: 'data:text/html,x' })],
      [record('x', { website: 'https://example.test/path\nquery' })],
      [record('x', { country: 42 })],
      Array(50001).fill(record('x')),
    ];
    for (const rows of invalid) {
      assert.throws(() => importCatalog(store, parseCatalogImport(rows, source)));
      assert.deepEqual(store.all('SELECT * FROM catalog_studios'), before);
    }
    for (const badSource of [
      { ...source, sourceKey: '../unsafe' },
      { ...source, sourceUrl: 'https://user@example.test' },
    ])
      assert.throws(() => parseCatalogImport([record('x')], badSource));
    store.db.exec(
      "CREATE TRIGGER fail_catalog_test BEFORE INSERT ON catalog_studios WHEN NEW.source_id='reject' BEGIN SELECT RAISE(ABORT,'fixture rejection'); END;",
    );
    assert.throws(
      () => importCatalog(store, parseCatalogImport([record('new'), record('reject')], source)),
      /fixture rejection/,
    );
    assert.deepEqual(
      store.all('SELECT * FROM catalog_studios'),
      before,
      'DELETE and first insert both rolled back',
    );
    store.db.exec('DROP TRIGGER fail_catalog_test;');
    importCatalog(
      store,
      parseCatalogImport(
        [
          record('edge', { lat: -90, lng: 180, country: null }),
          record('zero', { lat: 0, lng: 0 }),
          record('unknown', { lat: null, lng: null }),
        ],
        source,
      ),
    );
    assert.equal(store.get<{ n: number }>('SELECT count(*) n FROM catalog_studios')!.n, 3);
  } finally {
    store.close();
  }
});

test('default CLI dry run does not create DATA_DIR; apply persists only validated allowlisted data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openprint-catalog-cli-')),
    dataDir = join(dir, 'not-created'),
    file = join(dir, 'fixture.json');
  const args = [
    '--file',
    file,
    '--source',
    source.sourceKey,
    '--source-name',
    source.sourceName,
    '--source-url',
    source.sourceUrl,
  ];
  try {
    writeFileSync(file, JSON.stringify([record('one', { email: 'excluded@example.test' })]));
    const dry = runCatalogImport(args, dataDir);
    assert.equal(dry.mode, 'dry-run');
    assert.equal(dry.databaseChanged, false);
    assert.equal(existsSync(dataDir), false);
    const cli = spawnSync(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), resolve('scripts/catalog-import.ts'), ...args],
      {
        cwd: dir,
        env: { ...process.env, DATA_DIR: dataDir },
        encoding: 'utf8',
      },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).mode, 'dry-run');
    assert.equal(existsSync(dataDir), false);
    assert.equal(runCatalogImport([...args, '--apply'], dataDir).mode, 'applied');
    const store = new Store(join(dataDir, 'openprint.sqlite'));
    try {
      assert.equal(store.get<{ n: number }>('SELECT count(*) n FROM catalog_studios')!.n, 1);
      assert.equal(store.get<{ n: number }>('SELECT count(*) n FROM users')!.n, 0);
      assert.equal(
        JSON.stringify(store.all('SELECT * FROM catalog_studios')).includes(
          'excluded@example.test',
        ),
        false,
      );
    } finally {
      store.close();
    }
    writeFileSync(file, '{ invalid JSON');
    assert.throws(() => runCatalogImport([...args, '--apply'], dataDir));
    const reopened = new Store(join(dataDir, 'openprint.sqlite'));
    assert.equal(reopened.get<{ n: number }>('SELECT count(*) n FROM catalog_studios')!.n, 1);
    reopened.close();
    assert.throws(() => readCatalogFile('relative.json'), /absolute/);
    const oversized = join(dir, 'oversized.json'),
      fd = openSync(oversized, 'w');
    ftruncateSync(fd, CATALOG_MAX_FILE_BYTES + 1);
    closeSync(fd);
    assert.throws(() => readCatalogFile(oversized), /50 MiB/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('map reports truncation explicitly above 50000 points, including registered members beyond a full catalog', async () => {
  const f = await fixture();
  try {
    importCatalog(
      f.store,
      parseCatalogImport(
        Array.from({ length: 50000 }, (_, i) =>
          record(String(i), { description: '', website: '', technologies: [], materials: [] }),
        ),
        source,
      ),
    );
    f.member();
    f.member({ lat: null, lng: null });
    const map = await f.get('/directory/map');
    assert.equal(map.status, 200);
    assert.equal(map.data.total, 50002);
    assert.equal(map.data.mappable, 50001);
    assert.equal(map.data.unmapped, 1);
    assert.equal(map.data.points.length, 50000);
    assert.equal(map.data.truncated, true);
    const memberMap = await f.get('/directory/map?source=member');
    assert.equal(memberMap.data.points.length, 1);
    assert.equal(memberMap.data.truncated, false);
  } finally {
    await f.close();
  }
});

test('v4 community data migrates to v5 without modifying existing profiles or AI accounting', async () => {
  const f = await fixture();
  try {
    const member = f.member({ verified: 1 });
    f.store.run(
      "INSERT INTO studio_ai_runs(id,owner_id,project_id,request_id,request_hash,input_version,model,quality,status,created_at,input_tokens,task) VALUES(?,?,NULL,?,?,1,'legacy','review','failed',?,17,'cad')",
      randomUUID(),
      member.userId,
      randomUUID(),
      'saved-hash',
      Date.now(),
    );
    const prior = f.store.all('SELECT * FROM profiles');
    f.store.db.exec('DROP TABLE catalog_studios; PRAGMA user_version=4;');
    const migrated = new Store(f.store.path);
    try {
      assert.equal(migrated.get<{ user_version: number }>('PRAGMA user_version')!.user_version, 5);
      assert.deepEqual(migrated.all('SELECT * FROM profiles'), prior);
      assert.equal(migrated.get<{ n: number }>('SELECT count(*) n FROM catalog_studios')!.n, 0);
      assert.equal(
        migrated.get<{ input_tokens: number }>('SELECT input_tokens FROM studio_ai_runs')!
          .input_tokens,
        17,
      );
      assert.deepEqual(migrated.all('PRAGMA foreign_key_check'), []);
    } finally {
      migrated.close();
    }
  } finally {
    await f.close();
  }
});
