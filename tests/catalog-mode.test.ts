import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Store } from '../server/database.js';
import { createApp } from '../server/app.js';
import { importCatalog, parseCatalogImport } from '../server/directory.js';
import { digest } from '../server/security.js';
import { canonicalJSON } from '../server/studio-geometry.js';
import { sampleCadSpec } from '../shared/cad.js';
import type { StudioBrief } from '../shared/studio.js';

type AppOptions = Parameters<typeof createApp>[0];
const publicStudio = {
  name: 'Fictional public workshop',
  city: 'Test city',
  region: '',
  country: '',
  description: 'A fictional studio used only by automated tests.',
  technologies: ['FDM'],
  materials: ['PLA'],
  website: 'https://workshop.example.test',
  phone: '',
  address: 'Test street 1',
  lat: 0,
  lng: 0,
};
function seedIdentity(store: Store, role: 'admin' | 'member' = 'member') {
  const id = randomUUID(),
    profile = randomUUID(),
    token = randomBytes(32).toString('hex');
  store.run(
    'INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    id,
    `${id}@example.test`,
    'Existing member',
    'unused-test-password',
    role,
    Date.now(),
  );
  store.run(
    'INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
    digest(token),
    id,
    Date.now() + 86400000,
    Date.now(),
  );
  store.run(
    `INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,lat,lng,created_at)
     VALUES(?,?,?,'studio',?,?,'["FDM"]','["PLA"]',0,0,?)`,
    profile,
    id,
    'Existing registered workshop',
    'Test city',
    'Existing member profile',
    Date.now(),
  );
  return { id, profile, headers: { Cookie: `openprint_session=${token}` } };
}
function seedProject(store: Store, owner: string) {
  const id = randomUUID(),
    revision = randomUUID(),
    now = Date.now();
  const brief: StudioBrief = {
    title: 'Private workshop fixture',
    purpose: 'A private fixture retained across application modes.',
    requestKind: 'manufacture',
    process: 'CNC',
    material: 'Aluminum',
    quantity: 1,
    city: 'Test city',
    part: null,
    requirements: [],
    questions: [],
    assumptions: [],
    components: [],
    operations: [],
    acceptance: [],
  };
  const encoded = canonicalJSON(brief),
    spec = canonicalJSON(sampleCadSpec('plate'));
  store.run(
    `INSERT INTO studio_projects(id,owner_id,idea,language,brief,version,source,created_at,updated_at)
     VALUES(?,?,?,'en',?,1,'manual',?,?)`,
    id,
    owner,
    brief.purpose,
    encoded,
    now,
    now,
  );
  store.run(
    `INSERT INTO studio_revisions(project_id,version,brief,source,created_at) VALUES(?,1,?,'manual',?)`,
    id,
    encoded,
    now,
  );
  store.run(
    `INSERT INTO studio_cad_revisions(id,project_id,number,project_version,spec,sha256,created_at)
     VALUES(?,?,1,1,?,?,?)`,
    revision,
    id,
    spec,
    digest(spec),
    now,
  );
  return { id, revision, brief };
}
function importFixture(store: Store) {
  importCatalog(
    store,
    parseCatalogImport([{ id: 'fixture', ...publicStudio }], {
      sourceKey: 'fixture',
      sourceName: 'Fictional test source',
      sourceUrl: 'https://catalog.example.test',
    }),
  );
}
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'openprint-catalog-mode-'));
  let store = new Store(join(dir, 'openprint.sqlite'));
  let app: ReturnType<typeof createApp> | undefined;
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
  let base = '';
  async function stop() {
    await app?.locals.cad.stop();
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    app = undefined;
  }
  async function start(options: Partial<AppOptions> = {}) {
    app = createApp({
      store,
      dataDir: dir,
      appUrl: 'http://test.local',
      studioAI: {},
      cad: { python: '' },
      ...options,
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }
  return {
    dir,
    get store() {
      return store;
    },
    start,
    stop,
    async restart(options: Partial<AppOptions>) {
      await stop();
      store.close();
      store = new Store(join(dir, 'openprint.sqlite'));
      await start(options);
    },
    async call(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
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
      return { status: response.status, data: (await response.json()) as any };
    },
    async close() {
      await stop();
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('the default app is a public catalog even with a valid admin session and old demo data', async () => {
  const f = await fixture();
  try {
    const admin = seedIdentity(f.store, 'admin'),
      project = seedProject(f.store, admin.id);
    f.store.run("INSERT INTO meta(key,value) VALUES('demo','1')");
    importFixture(f.store);
    await f.start({ demo: true });
    assert.equal((await f.call('/health')).data.mode, 'catalog');
    const bootstrap = (await f.call('/bootstrap', 'GET', undefined, admin.headers)).data;
    assert.equal(bootstrap.mode, 'catalog');
    assert.equal(bootstrap.user, null);
    assert.equal(bootstrap.profile, null);
    assert.equal(bootstrap.demo, false);
    assert.deepEqual(bootstrap.demoUsers, []);
    assert.equal(bootstrap.unread, 0);
    assert.deepEqual(bootstrap.stats, { profiles: 0, projects: 0, models: 0, completed: 0 });
    for (const [method, path] of [
      ['POST', '/auth/register'],
      ['POST', '/auth/login'],
      ['POST', '/auth/demo'],
      ['GET', '/admin'],
      ['POST', `/admin/profiles/${admin.profile}`],
      ['GET', '/account/export'],
      ['DELETE', '/account'],
      ['GET', '/dashboard'],
      ['GET', '/projects'],
      ['GET', `/projects/${randomUUID()}`],
      ['POST', '/files'],
      ['GET', `/files/${randomUUID()}`],
      ['GET', '/profiles'],
      ['GET', '/models'],
      ['GET', '/studio/capabilities'],
      ['GET', `/studio/projects/${project.id}`],
      ['POST', `/studio/projects/${project.id}/assist`],
      ['POST', `/studio/projects/${project.id}/cad/build`],
      ['POST', `/studio/projects/${project.id}/cad/assist`],
      ['GET', `/jobs/${randomUUID()}/cad/packet`],
    ]) {
      const response = await f.call(
        path!,
        method!,
        method === 'GET' ? undefined : {},
        admin.headers,
      );
      assert.equal(response.status, 404, `${method} ${path}`);
      assert.equal(response.data.code, 'NOT_FOUND');
    }
    const directory = (await f.call('/directory')).data;
    assert.equal(directory.total, 1);
    assert.equal(directory.members, 0);
    assert.equal(directory.catalog, 1);
    const map = (await f.call('/directory/map')).data;
    assert.equal(map.total, 1);
    assert.deepEqual(
      map.points.map((point: { source: string }) => point.source),
      ['catalog'],
    );
    assert.equal((await f.call('/directory?source=member')).data.total, 0);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM users')!.n, 1);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM sessions')!.n, 1);
  } finally {
    await f.close();
  }
});

test('catalog mode allows anonymous publication and key management without creating an account', async () => {
  const f = await fixture();
  try {
    await f.start();
    const key = randomBytes(32).toString('hex');
    const body = { management_key: key, studio: publicStudio, rights_confirmed: true };
    assert.equal(
      (
        await f.call('/directory/submissions', 'POST', body, {
          Origin: 'https://foreign.example.test',
        })
      ).status,
      403,
    );
    const created = await f.call('/directory/submissions', 'POST', body);
    assert.equal(created.status, 201);
    const id = created.data.studio.id;
    assert.equal((await f.call(`/directory/catalog/${id}`)).status, 200);
    assert.equal((await f.call('/directory/map')).data.total, 1);
    assert.equal((await f.call(`/directory/submissions/${id}`)).status, 403);
    const updated = await f.call(
      `/directory/submissions/${id}`,
      'PATCH',
      {
        version: 1,
        rights_confirmed: true,
        studio: { ...publicStudio, description: 'Updated public workshop description.' },
      },
      { 'X-Catalog-Key': key },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.data.studio.version, 2);
    assert.equal(
      (
        await f.call(
          `/directory/submissions/${id}`,
          'DELETE',
          { version: 2 },
          { 'X-Catalog-Key': key },
        )
      ).status,
      200,
    );
    assert.equal((await f.call('/directory')).data.total, 0);
    for (const table of ['users', 'profiles', 'sessions', 'jobs'])
      assert.equal(f.store.get<{ n: number }>(`SELECT count(*) n FROM ${table}`)!.n, 0);
  } finally {
    await f.close();
  }
});

test('catalog startup and shutdown preserve private queued and running CAD work and its files', async () => {
  const f = await fixture();
  try {
    const owner = seedIdentity(f.store),
      project = seedProject(f.store, owner.id);
    for (const status of ['queued', 'running'])
      f.store.run(
        `INSERT INTO studio_cad_builds(id,owner_id,project_id,revision_id,project_version,request_id,status,created_at)
       VALUES(?,?,?,?,1,?,?,?)`,
        randomUUID(),
        owner.id,
        project.id,
        project.revision,
        randomUUID(),
        status,
        Date.now(),
      );
    const before = f.store.all('SELECT * FROM studio_cad_builds ORDER BY id');
    const work = join(f.dir, 'cad-work');
    mkdirSync(work);
    writeFileSync(
      join(work, 'private-work.txt'),
      'Existing private work must survive catalog startup.',
    );
    let executions = 0;
    await f.start({
      cad: {
        python: '',
        executor: async () => {
          executions++;
          return [];
        },
      },
    });
    await f.call('/health');
    await f.stop();
    assert.equal(executions, 0);
    assert.deepEqual(f.store.all('SELECT * FROM studio_cad_builds ORDER BY id'), before);
    assert.equal(
      readFileSync(join(work, 'private-work.txt'), 'utf8'),
      'Existing private work must survive catalog startup.',
    );
  } finally {
    await f.close();
  }
});

test('explicit community mode restores existing private access with the same catalog and original permissions', async () => {
  const f = await fixture();
  try {
    const owner = seedIdentity(f.store, 'admin'),
      other = seedIdentity(f.store),
      project = seedProject(f.store, owner.id);
    importFixture(f.store);
    const before = {
      projects: f.store.all('SELECT * FROM studio_projects'),
      history: f.store.all('SELECT * FROM studio_revisions'),
      cad: f.store.all('SELECT * FROM studio_cad_revisions'),
      users: f.store.all('SELECT * FROM users ORDER BY id'),
    };
    await f.start();
    const catalog = (await f.call('/directory?source=catalog')).data;
    assert.equal(
      (await f.call(`/studio/projects/${project.id}`, 'GET', undefined, owner.headers)).status,
      404,
    );
    await f.restart({ mode: 'community' });
    const bootstrap = (await f.call('/bootstrap', 'GET', undefined, owner.headers)).data;
    assert.equal(bootstrap.mode, 'community');
    assert.equal(bootstrap.user.id, owner.id);
    assert.equal(bootstrap.user.role, 'admin');
    assert.equal(bootstrap.profile.id, owner.profile);
    const owned = await f.call(`/studio/projects/${project.id}`, 'GET', undefined, owner.headers);
    assert.equal(owned.status, 200);
    assert.deepEqual(owned.data.project.brief, project.brief);
    assert.equal((await f.call(`/studio/projects/${project.id}`)).status, 401);
    assert.equal(
      (await f.call(`/studio/projects/${project.id}`, 'GET', undefined, other.headers)).status,
      404,
    );
    assert.equal((await f.call('/admin', 'GET', undefined, other.headers)).status, 403);
    assert.equal((await f.call('/admin', 'GET', undefined, owner.headers)).status, 200);
    assert.deepEqual((await f.call('/directory?source=catalog')).data, catalog);
    assert.equal((await f.call('/directory?source=member')).data.total, 2);
    assert.deepEqual(
      {
        projects: f.store.all('SELECT * FROM studio_projects'),
        history: f.store.all('SELECT * FROM studio_revisions'),
        cad: f.store.all('SELECT * FROM studio_cad_revisions'),
        users: f.store.all('SELECT * FROM users ORDER BY id'),
      },
      before,
    );
  } finally {
    await f.close();
  }
});
