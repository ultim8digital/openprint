import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Store } from '../server/database.js';
import { createApp } from '../server/app.js';
import {
  CadService,
  type CadExecutor,
  type CadOptions,
  type CadOutput,
  validateCadOutput,
} from '../server/cad-runner.js';
import { digest, hashPassword } from '../server/security.js';
import { canonicalJSON } from '../server/studio-geometry.js';
import { backupCommunity } from '../scripts/backup.js';
import {
  cadSpecSchema,
  sampleCadSpec,
  type CadSpec,
  type CadState,
  type CadBuild,
} from '../shared/cad.js';
import type { StudioBrief, StudioProject } from '../shared/studio.js';

const password = 'cad-tests-only-long-passphrase';
const brief = (): StudioBrief => ({
  title: 'A CAD plate for a workshop',
  purpose: 'A drawing and geometry package for an individual workshop plate.',
  requestKind: 'manufacture',
  process: 'CNC',
  material: 'To be agreed',
  quantity: 1,
  city: 'Test city',
  part: null,
  requirements: ['Review material, loads and the process before manufacturing'],
  questions: ['Which manufacturing tolerances can the provider offer?'],
  assumptions: [],
  components: [],
  operations: [],
  acceptance: ['Agree inspection dimensions before manufacture'],
});
const publication = (version: number, target: string | null = null) => ({
  version,
  visibility: target ? 'direct' : 'public',
  target_profile_id: target,
  currency: 'USD',
  budget: null,
});

// These are transport fixtures, not geometry proof. Native CadQuery is checked separately.
function storedZip(files: CadOutput) {
  let offset = 0;
  const local: Buffer[] = [],
    central: Buffer[] = [];
  for (const file of files) {
    let crc = 0xffffffff;
    for (const byte of file.content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const name = Buffer.from(file.name),
      header = Buffer.alloc(30),
      directory = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(file.content.length, 18);
    header.writeUInt32LE(file.content.length, 22);
    header.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(file.content.length, 20);
    directory.writeUInt32LE(file.content.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, file.content);
    central.push(directory, name);
    offset += header.length + name.length + file.content.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
function outputFor(spec: CadSpec): CadOutput {
  const parts = [...(spec.operations.length ? [{ id: 'body', ...spec }] : []), ...spec.components];
  const stl = Buffer.alloc(134);
  stl.writeUInt32LE(1, 80);
  stl.writeFloatLE(1, 108);
  stl.writeFloatLE(1, 124);
  const files: CadOutput = [];
  const add = (name: string, content: unknown) =>
    files.push({
      name,
      content: Buffer.isBuffer(content) ? content : Buffer.from(JSON.stringify(content)),
    });
  add('model.step', Buffer.from('ISO-10303-21;\nHEADER;ENDSEC;DATA;ENDSEC;END-ISO-10303-21;\n'));
  add('model.stl', stl);
  for (const part of parts) {
    add(`parts/${part.id}/${part.id}.step`, files[0].content);
    add(`parts/${part.id}/${part.id}.stl`, stl);
  }
  add('spec.json', spec);
  add('report.json', {
    schema_version: 'neofab-cad-report/1',
    compiler_version: '1.0.0',
    passed: true,
    verification_scope: 'geometry_only',
    manufacturing_release: 'requires_engineer_review',
    checks: [
      {
        code: 'brep',
        name: 'Fixture geometry check',
        passed: true,
        detail: 'Injected transport fixture; no kernel was run',
      },
    ],
    warnings: ['Transport fixture only'],
    bounds_mm: [80, 50, 6],
    volume_mm3: 100,
    solids: parts.length,
    components: parts.map((part) => ({
      id: part.id,
      name: part.name,
      material: part.material,
      process: part.process,
      quantity: 1,
      bounds_mm: [80, 50, 6],
      volume_mm3: 100,
    })),
    operations: parts.map((part) => ({
      component: part.id,
      operations: part.operations.map((op) => ({
        id: op.id,
        type: op.type,
        volume_before: 100,
        volume_after: 100,
      })),
    })),
  });
  add('mesh.json', {
    schema_version: 'neofab-cad-mesh/1',
    units: 'mm',
    vertices: parts.flatMap(() => [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ]),
    triangles: parts.map((_, i) => [i * 3, i * 3 + 1, i * 3 + 2]),
    groups: parts.map((part, i) => ({
      id: part.id,
      name: part.name,
      start: i,
      count: 1,
      center: [0, 0, 0],
    })),
    bounds: [80, 50, 6],
  });
  add(
    'bom.csv',
    Buffer.from(
      'id,name,quantity,material,process\n' +
        parts.map((part) => `${part.id},Fixture,1,Unknown,CNC`).join('\n'),
    ),
  );
  add('parts.zip', storedZip(files));
  add('manifest.json', {
    schema_version: 'neofab-cad-manifest/1',
    artifacts: files.map((file) => ({
      path: file.name,
      size: file.content.length,
      sha256: digest(file.content),
    })),
  });
  return files;
}
function controlledExecutor() {
  const pending: { spec: CadSpec; signal: AbortSignal; finish: (files?: CadOutput) => void }[] = [];
  const executor: CadExecutor = (spec, signal) =>
    new Promise((resolve, reject) => {
      const abort = () => reject(new Error('CAD_CANCELLED'));
      signal.addEventListener('abort', abort, { once: true });
      pending.push({
        spec,
        signal,
        finish: (files = outputFor(spec)) => {
          signal.removeEventListener('abort', abort);
          resolve(files);
        },
      });
    });
  return { executor, pending };
}
async function fixture(options: CadOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'neofab-cad-test-')),
    store = new Store(join(dir, 'openprint.sqlite'));
  const app = createApp({
    store,
    dataDir: dir,
    appUrl: 'http://test.local',
    cad: { python: '', executor: async (spec) => outputFor(spec), ...options },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call =
    (cookie = '') =>
    async (path: string, method = 'GET', body?: unknown, origin = 'http://test.local') => {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        data: (response.headers.get('Content-Type') || '').includes('application/json')
          ? await response.json()
          : Buffer.from(await response.arrayBuffer()),
        headers: response.headers,
      };
    };
  const encoded = await hashPassword(password);
  function actor() {
    const id = randomUUID(),
      token = randomBytes(32).toString('hex');
    store.run(
      'INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)',
      id,
      `${id}@test.example`,
      'CAD participant',
      encoded,
      Date.now(),
    );
    store.run(
      'INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
      digest(token),
      id,
      Date.now() + 86400000,
      Date.now(),
    );
    return { id, call: call(`openprint_session=${token}`) };
  }
  function profile(userId: string) {
    const id = randomUUID();
    store.run(
      "INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,remote,created_at) VALUES(?,?,?,'both',?,?,?, ?,1,?)",
      id,
      userId,
      'CAD test provider',
      'Test city',
      'Fictional provider for transport tests',
      '["CNC","CAD"]',
      '["Any"]',
      Date.now(),
    );
    return id;
  }
  return {
    dir,
    store,
    app,
    owner: actor(),
    other: actor(),
    actor,
    profile,
    guest: call(),
    async close() {
      await (app.locals.cad as CadService).stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Actor = Fixture['owner'];
async function project(owner: Actor) {
  const created = await owner.call('/studio/projects', 'POST', {
    idea: 'Prepare a CAD package for an individual workshop plate.',
    language: 'en',
  });
  assert.equal(created.status, 201);
  const saved = await owner.call(`/studio/projects/${created.data.project.id}`, 'PUT', {
    version: created.data.project.version,
    brief: brief(),
  });
  assert.equal(saved.status, 200);
  return saved.data.project as StudioProject;
}
async function design(owner: Actor) {
  const created = await project(owner);
  const saved = await owner.call(`/studio/projects/${created.id}/cad`, 'PUT', {
    version: created.version,
    spec: sampleCadSpec('plate'),
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  return saved.data.project as StudioProject;
}
async function build(owner: Actor, current: StudioProject, requestId = randomUUID()) {
  const response = await owner.call(`/studio/projects/${current.id}/cad/build`, 'POST', {
    version: current.version,
    requestId,
  });
  assert.ok(
    response.status === 200 || response.status === 201 || response.status === 202,
    JSON.stringify(response.data),
  );
  return response.data.build as CadBuild;
}
async function finished(owner: Actor, projectId: string, buildId: string) {
  for (let i = 0; i < 150; i++) {
    const response = await owner.call(`/studio/projects/${projectId}/cad`);
    assert.equal(response.status, 200);
    const value = (response.data as CadState).builds.find((item) => item.id === buildId);
    if (value && ['succeeded', 'failed'].includes(value.status)) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('CAD build did not finish');
}
async function confirmed(owner: Actor, current: StudioProject) {
  const result = await build(owner, current);
  assert.equal((await finished(owner, current.id, result.id)).status, 'succeeded');
  const response = await owner.call(`/studio/projects/${current.id}/confirm`, 'POST', {
    version: current.version,
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return { project: response.data.project as StudioProject, build: result };
}

test('CAD schema rejects executable extras, ambiguous instances, unsafe IDs and self-crossing polygons', () => {
  assert.equal(cadSpecSchema.safeParse(sampleCadSpec('plate')).success, true);
  assert.equal(cadSpecSchema.safeParse(sampleCadSpec('shelf')).success, true);
  const extra = { ...sampleCadSpec('plate'), source: 'import os' };
  assert.equal(cadSpecSchema.safeParse(extra).success, false);
  const duplicate = sampleCadSpec('shelf');
  duplicate.components[1].id = duplicate.components[0].id;
  assert.equal(cadSpecSchema.safeParse(duplicate).success, false);
  const unsafe = sampleCadSpec('shelf');
  unsafe.components[0].id = '../../other';
  assert.equal(cadSpecSchema.safeParse(unsafe).success, false);
  unsafe.components[0].id = 'part\n';
  assert.equal(cadSpecSchema.safeParse(unsafe).success, false);
  const polygon = sampleCadSpec('plate');
  polygon.operations = [
    {
      id: 'crossed',
      type: 'extrude',
      mode: 'add',
      points: [
        [0, 0],
        [10, 10],
        [0, 10],
        [10, 0],
      ],
      plane: 'XY',
      distance: 5,
      at: [0, 0, 0],
    },
  ];
  assert.equal(cadSpecSchema.safeParse(polygon).success, false);
  const tooMany = sampleCadSpec('shelf');
  tooMany.components = Array.from({ length: 24 }, (_, i) => ({
    ...tooMany.components[0],
    id: `part_${i}`,
  }));
  tooMany.operations = sampleCadSpec('plate').operations;
  assert.equal(cadSpecSchema.safeParse(tooMany).success, false);
});

test('CAD input is private, origin-protected and CAS-bound; identical saves and replay do not rebuild', async () => {
  let calls = 0;
  const f = await fixture({
    executor: async (spec) => {
      calls++;
      return outputFor(spec);
    },
  });
  try {
    const p = await project(f.owner),
      endpoint = `/studio/projects/${p.id}/cad`,
      spec = sampleCadSpec('plate');
    assert.equal((await f.guest(endpoint)).status, 401);
    assert.equal((await f.other.call(endpoint)).status, 404);
    assert.equal(
      (await f.owner.call(endpoint, 'PUT', { version: p.version, spec }, 'http://evil.invalid'))
        .status,
      403,
    );
    const changed = await f.owner.call(endpoint, 'PUT', { version: p.version, spec });
    assert.equal(changed.status, 200);
    assert.equal(changed.data.project.version, p.version + 1);
    const conflictingTemplate = await f.owner.call(`/studio/projects/${p.id}`, 'PUT', {
      version: changed.data.project.version,
      brief: {
        ...p.brief,
        process: 'FDM',
        part: { kind: 'plate', width: 70, depth: 45, height: 5, hole: 10 },
      },
    });
    assert.equal(conflictingTemplate.status, 409);
    assert.equal(conflictingTemplate.data.code, 'CAD_TEMPLATE_CONFLICT');
    assert.equal((await f.owner.call(endpoint, 'PUT', { version: p.version, spec })).status, 409);
    const same = await f.owner.call(endpoint, 'PUT', {
      version: changed.data.project.version,
      spec,
    });
    assert.equal(same.status, 200);
    assert.equal(same.data.project.version, changed.data.project.version);
    const requestId = randomUUID(),
      run = await build(f.owner, changed.data.project, requestId);
    assert.equal((await finished(f.owner, p.id, run.id)).status, 'succeeded');
    const replay = await build(f.owner, changed.data.project, requestId);
    assert.equal(replay.id, run.id);
    assert.equal(calls, 1);
    assert.equal(
      (await f.other.call(`${endpoint}/builds/${run.id}/artifacts/model.step`)).status,
      404,
    );
    const step = await f.owner.call(`${endpoint}/builds/${run.id}/artifacts/model.step`);
    assert.equal(step.status, 200);
    assert.equal(step.headers.get('X-Content-SHA256'), digest(step.data));
    const rejected = await f.owner.call(`${endpoint}/build`, 'POST', {
      version: p.version,
      requestId,
    });
    assert.equal(rejected.status, 409);
  } finally {
    await f.close();
  }
});

test('CAD handoff freezes exact artifacts; a named provider can receive and lose quotation access', async () => {
  const f = await fixture();
  try {
    const p = await design(f.owner),
      done = await confirmed(f.owner, p);
    const packet = await f.owner.call(`/studio/projects/${p.id}/packet`);
    assert.equal(packet.data.schema_version, 'neofab-packet/2');
    assert.equal(packet.data.cad.build_id, done.build.id);
    const published = await f.owner.call(
      `/studio/projects/${p.id}/publish`,
      'POST',
      publication(p.version),
    );
    assert.equal(published.status, 200);
    const jobId = published.data.job_id,
      provider = f.actor();
    f.profile(provider.id);
    const filePath = `/jobs/${jobId}/cad/artifacts/model.step`;
    assert.ok([403, 404].includes((await provider.call(filePath)).status));
    assert.ok([401, 403, 404].includes((await f.guest(filePath)).status));
    assert.equal((await provider.call(`/projects/${jobId}/conversation`, 'POST', {})).status, 201);
    assert.equal(
      (
        await provider.call(`/jobs/${jobId}/cad/grants`, 'POST', {
          provider_id: provider.id,
          allow: true,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.owner.call(`/jobs/${jobId}/cad/grants`, 'POST', {
          provider_id: provider.id,
          allow: true,
        })
      ).status,
      200,
    );
    const shared = await provider.call(filePath);
    assert.equal(shared.status, 200);
    const expected = packet.data.cad.artifacts.find(
      (item: { name: string }) => item.name === 'model.step',
    );
    assert.equal(digest(shared.data), expected.sha256);
    assert.ok([403, 404].includes((await f.other.call(filePath)).status));
    // Revocation must remain possible when a formerly eligible provider hides their profile.
    f.store.run('UPDATE profiles SET published=0 WHERE user_id=?', provider.id);
    assert.equal(
      (
        await f.owner.call(`/jobs/${jobId}/cad/grants`, 'POST', {
          provider_id: provider.id,
          allow: false,
        })
      ).status,
      200,
    );
    assert.ok([403, 404].includes((await provider.call(filePath)).status));
    f.store.run('UPDATE profiles SET published=1 WHERE user_id=?', provider.id);
    const offered = await provider.call(`/projects/${jobId}/offers`, 'POST', {
      price: 10000,
      days: 7,
      note: 'Quote with agreed CAD package and inspection requirements.',
    });
    assert.equal(offered.status, 201);
    const accepted = await f.owner.call(`/projects/${jobId}/accept`, 'POST', {
      offer_id: offered.data.offer.id,
      revision: offered.data.offer.revision,
      version: 1,
    });
    assert.equal(accepted.status, 200);
    assert.equal((await provider.call(filePath)).status, 200);
    assert.equal(
      (
        await f.owner.call(`/jobs/${jobId}/cad/grants`, 'POST', {
          provider_id: provider.id,
          allow: false,
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.owner.call(`/studio/projects/${p.id}/cad`, 'DELETE', { version: p.version })).status,
      409,
    );
    assert.equal(
      (
        await f.owner.call(`/studio/projects/${p.id}/cad/build`, 'POST', {
          version: p.version,
          requestId: randomUUID(),
        })
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

test('CAD direct publication grants only its recipient, and exported history includes the exact revision', async () => {
  const f = await fixture();
  try {
    const p = await design(f.owner);
    await confirmed(f.owner, p);
    const target = f.profile(f.other.id);
    const published = await f.owner.call(
      `/studio/projects/${p.id}/publish`,
      'POST',
      publication(p.version, target),
    );
    assert.equal(published.status, 200);
    const download = await f.other.call(
      `/jobs/${published.data.job_id}/cad/artifacts/${encodeURIComponent('parts/body/body.step')}`,
    );
    assert.equal(download.status, 200);
    const exported = await f.owner.call('/account/export');
    assert.equal(exported.status, 200);
    assert.ok(JSON.stringify(exported.data).includes('neofab-cad/1'));
    assert.ok(
      JSON.stringify(exported.data).includes(digest(canonicalJSON(sampleCadSpec('plate')))),
    );
  } finally {
    await f.close();
  }
});

test('a completed old CAD build cannot satisfy confirmation after the brief changes', async () => {
  const delayed = controlledExecutor(),
    f = await fixture({ executor: delayed.executor });
  try {
    const p = await design(f.owner),
      run = await build(f.owner, p);
    assert.equal(delayed.pending.length, 1);
    const changed = await f.owner.call(`/studio/projects/${p.id}`, 'PUT', {
      version: p.version,
      brief: { ...p.brief, material: 'Owner changed the material' },
    });
    assert.equal(changed.status, 200);
    delayed.pending[0].finish();
    assert.equal((await finished(f.owner, p.id, run.id)).status, 'succeeded');
    const response = await f.owner.call(`/studio/projects/${p.id}/confirm`, 'POST', {
      version: changed.data.project.version,
    });
    assert.ok([400, 409].includes(response.status));
    const current = await f.owner.call(`/studio/projects/${p.id}`);
    assert.equal(current.data.project.confirmed_version, null);
    assert.equal(current.data.project.brief.material, 'Owner changed the material');
    const cleared = await f.owner.call(`/studio/projects/${p.id}/cad`, 'DELETE', {
      version: current.data.project.version,
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.project.version, current.data.project.version + 1);
    assert.equal(cleared.data.cad.revision, null);
    assert.equal(
      (
        await f.owner.call(`/studio/projects/${p.id}/confirm`, 'POST', {
          version: cleared.data.project.version,
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test('editing confirmed CAD creates a new review boundary while retaining historical artifacts', async () => {
  const f = await fixture();
  try {
    const p = await design(f.owner),
      original = await confirmed(f.owner, p);
    const originalPacket = await f.owner.call(`/studio/projects/${p.id}/packet`);
    const changedSpec = sampleCadSpec('plate');
    changedSpec.name = 'Owner revised the plate design';
    const edited = await f.owner.call(`/studio/projects/${p.id}/cad`, 'PUT', {
      version: p.version,
      spec: changedSpec,
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.project.version, p.version + 1);
    assert.equal(edited.data.project.confirmed_version, null);
    assert.equal((await f.owner.call(`/studio/projects/${p.id}/packet`)).status, 409);
    assert.equal(
      (await f.owner.call(`/studio/projects/${p.id}/confirm`, 'POST', { version: p.version }))
        .status,
      409,
    );
    assert.equal(
      (
        await f.owner.call(
          `/studio/projects/${p.id}/cad/builds/${original.build.id}/artifacts/model.step`,
        )
      ).status,
      200,
    );
    const revised = await confirmed(f.owner, edited.data.project);
    const revisedPacket = await f.owner.call(`/studio/projects/${p.id}/packet`);
    assert.notEqual(revisedPacket.data.confirmed_hash, originalPacket.data.confirmed_hash);
    assert.notEqual(revised.build.id, original.build.id);
    assert.equal(
      f.store.get<{ n: number }>(
        'SELECT count(*) AS n FROM studio_confirmations WHERE project_id=?',
        p.id,
      )!.n,
      2,
    );
    assert.equal(
      f.store.get<{ n: number }>(
        'SELECT count(*) AS n FROM studio_cad_revisions WHERE project_id=?',
        p.id,
      )!.n,
      2,
    );
  } finally {
    await f.close();
  }
});

test('CAD cancellation, timeout and persistent attempt quotas stop repeated work', async () => {
  const delayed = controlledExecutor(),
    f = await fixture({ executor: delayed.executor, maxBuildsPerProject: 1 });
  try {
    const p = await design(f.owner),
      run = await build(f.owner, p);
    assert.equal(
      (await f.owner.call(`/studio/projects/${p.id}/cad/builds/${run.id}/cancel`, 'POST', {}))
        .status,
      200,
    );
    const stopped = await finished(f.owner, p.id, run.id);
    assert.equal(stopped.status, 'failed');
    assert.equal(stopped.error_code, 'CAD_CANCELLED');
    assert.equal(delayed.pending[0].signal.aborted, true);
    assert.equal(
      (
        await f.owner.call(`/studio/projects/${p.id}/cad/build`, 'POST', {
          version: p.version,
          requestId: randomUUID(),
        })
      ).status,
      429,
    );
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_cad_artifacts')!.n,
      0,
    );
  } finally {
    await f.close();
  }
  const timed = controlledExecutor(),
    t = await fixture({ executor: timed.executor, timeoutMs: 30 });
  try {
    const p = await design(t.owner),
      run = await build(t.owner, p);
    const result = await finished(t.owner, p.id, run.id);
    assert.equal(result.status, 'failed');
    assert.equal(result.error_code, 'CAD_TIMEOUT');
  } finally {
    await t.close();
  }
});

test('CAD rejects a missing artifact, a changed specification and a preview with different component IDs', async () => {
  const spec = sampleCadSpec('plate');
  assert.doesNotThrow(() => validateCadOutput(spec, outputFor(spec)));
  assert.throws(() =>
    validateCadOutput(
      spec,
      outputFor(spec).filter((file) => file.name !== 'model.step'),
    ),
  );
  const altered = outputFor(spec),
    model = altered.find((file) => file.name === 'model.step')!;
  model.content = Buffer.concat([model.content, Buffer.from('tampered')]);
  assert.throws(() => validateCadOutput(spec, altered));
  const different = sampleCadSpec('plate');
  different.name = 'A different specification';
  assert.throws(() => validateCadOutput(spec, outputFor(different)));
  const badPreview = outputFor(spec),
    mesh = badPreview.find((file) => file.name === 'mesh.json')!;
  const data = JSON.parse(mesh.content.toString());
  data.groups[0].id = 'other_component';
  mesh.content = Buffer.from(JSON.stringify(data));
  const manifest = badPreview.find((file) => file.name === 'manifest.json')!;
  const declared = JSON.parse(manifest.content.toString());
  const item = declared.artifacts.find(
    (artifact: { path: string }) => artifact.path === 'mesh.json',
  );
  item.size = mesh.content.length;
  item.sha256 = digest(mesh.content);
  manifest.content = Buffer.from(JSON.stringify(declared));
  assert.throws(() => validateCadOutput(spec, badPreview));
  const f = await fixture({
    executor: async (value) => outputFor(value).filter((file) => file.name !== 'model.step'),
  });
  try {
    const p = await design(f.owner),
      run = await build(f.owner, p);
    assert.equal((await finished(f.owner, p.id, run.id)).status, 'failed');
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_cad_artifacts')!.n,
      0,
    );
  } finally {
    await f.close();
  }
});

test('CAD reserves bounded storage before compute and does not resurrect deleted account data', async () => {
  let calls = 0;
  const limited = await fixture({
    executor: async (spec) => {
      calls++;
      return outputFor(spec);
    },
    userStorageBytes: 1024,
  });
  try {
    const p = await design(limited.owner);
    assert.equal(
      (
        await limited.owner.call(`/studio/projects/${p.id}/cad/build`, 'POST', {
          version: p.version,
          requestId: randomUUID(),
        })
      ).status,
      413,
    );
    assert.equal(calls, 0);
  } finally {
    await limited.close();
  }
  const delayed = controlledExecutor(),
    f = await fixture({ executor: delayed.executor, maxBuildsPerInstanceDay: 1 });
  try {
    const p = await design(f.owner);
    await build(f.owner, p);
    assert.equal(
      (await f.owner.call('/account', 'DELETE', { password, confirm: 'DELETE' })).status,
      200,
    );
    delayed.pending[0].finish();
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_cad_revisions')!.n,
      0,
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_cad_builds')!.n, 0);
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_cad_artifacts')!.n,
      0,
    );
    const next = await design(f.other);
    assert.equal(
      (
        await f.other.call(`/studio/projects/${next.id}/cad/build`, 'POST', {
          version: next.version,
          requestId: randomUUID(),
        })
      ).status,
      429,
      'Account deletion must not erase daily instance compute reservations',
    );
  } finally {
    await f.close();
  }
});

test('CAD restart marks interrupted work failed and SQLite backup preserves artifact bytes', async () => {
  const f = await fixture();
  let backup = '';
  try {
    const p = await design(f.owner),
      run = await build(f.owner, p);
    assert.equal((await finished(f.owner, p.id, run.id)).status, 'succeeded');
    const queuedProject = await design(f.other);
    await (f.app.locals.cad as CadService).stop();
    const revision = f.store.get<{ id: string }>(
      'SELECT id FROM studio_cad_revisions WHERE project_id=?',
      p.id,
    )!;
    const interrupted = randomUUID();
    f.store.run(
      "INSERT INTO studio_cad_builds(id,owner_id,project_id,revision_id,project_version,request_id,status,created_at) VALUES(?,?,?,?,?,?,'running',?)",
      interrupted,
      f.owner.id,
      p.id,
      revision.id,
      p.version,
      randomUUID(),
      Date.now(),
    );
    const queuedRevision = f.store.get<{ id: string }>(
      'SELECT id FROM studio_cad_revisions WHERE project_id=?',
      queuedProject.id,
    )!;
    const queued = randomUUID();
    f.store.run(
      "INSERT INTO studio_cad_builds(id,owner_id,project_id,revision_id,project_version,request_id,status,created_at) VALUES(?,?,?,?,?,?,'queued',?)",
      queued,
      f.other.id,
      queuedProject.id,
      queuedRevision.id,
      queuedProject.version,
      randomUUID(),
      Date.now(),
    );
    let resumed = 0;
    const restarted = new CadService(f.store, f.dir, {
      python: '',
      executor: async (spec) => {
        resumed++;
        return outputFor(spec);
      },
    });
    assert.equal(
      f.store.get<{ error_code: string }>(
        'SELECT error_code FROM studio_cad_builds WHERE id=?',
        interrupted,
      )!.error_code,
      'CAD_INTERRUPTED',
    );
    assert.equal((await finished(f.other, queuedProject.id, queued)).status, 'succeeded');
    assert.equal(resumed, 1);
    await restarted.stop();
    backup = `${f.dir}-backup`;
    backupCommunity(f.dir, backup);
    const snapshot = new Store(join(backup, 'openprint.sqlite'));
    try {
      const original = f.store.get<{ content: Uint8Array; sha256: string }>(
        'SELECT content,sha256 FROM studio_cad_artifacts WHERE build_id=? AND name=?',
        run.id,
        'model.step',
      )!;
      const restored = snapshot.get<{ content: Uint8Array; sha256: string }>(
        'SELECT content,sha256 FROM studio_cad_artifacts WHERE build_id=? AND name=?',
        run.id,
        'model.step',
      )!;
      assert.equal(digest(Buffer.from(restored.content)), original.sha256);
      assert.deepEqual(Buffer.from(restored.content), Buffer.from(original.content));
      assert.deepEqual(snapshot.all('PRAGMA foreign_key_check'), []);
      assert.ok(readFileSync(join(backup, 'manifest.json')).length > 0);
    } finally {
      snapshot.close();
    }
  } finally {
    await f.close();
    if (backup) rmSync(backup, { recursive: true, force: true });
  }
});

test('v2 Studio revisions and confirmations survive migration to CAD schema v4 and reopening', () => {
  const dir = mkdtempSync(join(tmpdir(), 'neofab-cad-migration-')),
    path = join(dir, 'openprint.sqlite');
  try {
    const v2 = new Store(path),
      owner = randomUUID(),
      projectId = randomUUID();
    v2.db.exec(
      'DROP TABLE studio_cad_proposals; DROP TRIGGER studio_ai_task_immutable; ALTER TABLE studio_ai_runs DROP COLUMN task; DROP TABLE studio_cad_grants; DROP TABLE studio_cad_handoffs; DROP TABLE studio_cad_artifacts; DROP TABLE studio_cad_builds; DROP TABLE studio_cad_revisions; DROP INDEX events_action_time; PRAGMA user_version=2;',
    );
    v2.run(
      'INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)',
      owner,
      'legacy-cad@test.example',
      'Legacy CAD owner',
      'preserved hash',
      1,
    );
    const body = canonicalJSON(brief()),
      hash = digest(body);
    v2.run(
      "INSERT INTO studio_projects(id,owner_id,idea,language,brief,version,confirmed_version,confirmed_hash,source,packet,created_at,updated_at) VALUES(?,?,?,'en',?,1,1,?,'manual',?,1,1)",
      projectId,
      owner,
      'Existing confirmed brief before CAD integration',
      body,
      hash,
      JSON.stringify({ preserved: true }),
    );
    v2.run(
      "INSERT INTO studio_revisions(project_id,version,brief,source,created_at) VALUES(?,1,?,'manual',1)",
      projectId,
      body,
    );
    v2.run(
      'INSERT INTO studio_confirmations(project_id,version,brief_hash,confirmed_at) VALUES(?,1,?,1)',
      projectId,
      hash,
    );
    v2.close();
    const migrated = new Store(path);
    assert.equal(migrated.get<{ user_version: number }>('PRAGMA user_version')!.user_version, 4);
    assert.equal(
      migrated.get<{ confirmed_hash: string }>(
        'SELECT confirmed_hash FROM studio_projects WHERE id=?',
        projectId,
      )!.confirmed_hash,
      hash,
    );
    assert.equal(
      migrated.get<{ n: number }>('SELECT count(*) AS n FROM studio_confirmations')!.n,
      1,
    );
    assert.deepEqual(migrated.all('PRAGMA foreign_key_check'), []);
    migrated.close();
    const reopened = new Store(path);
    assert.equal(reopened.get<{ n: number }>('SELECT count(*) AS n FROM studio_revisions')!.n, 1);
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
