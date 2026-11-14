import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Store } from '../server/database.js';
import { createApp } from '../server/app.js';
import { digest, hashPassword } from '../server/security.js';
import { canonicalJSON } from '../server/studio-geometry.js';
import { explicitlySpecifiedPart, type StudioAIConfig } from '../server/studio-ai.js';
import type { StudioBrief } from '../shared/studio.js';

const password = 'test-studio-only-passphrase-123';
const idea = 'A simple plate for organizing small tools on my desk.';
const readyBrief = (): StudioBrief => ({
  title: 'Desk organizer plate',
  purpose: 'A small plate for holding lightweight tools on a desk.',
  requestKind: 'manufacture',
  process: 'FDM',
  material: 'PLA',
  quantity: 2,
  city: 'Test city',
  part: { kind: 'plate', width: 70, depth: 45, height: 5, hole: 10 },
  requirements: ['Use the specified dimensions in millimeters'],
  questions: [],
  assumptions: [],
  components: [],
  operations: [],
  acceptance: ['Agree the finish with the provider before printing'],
});
const request = (version: number, quality: 'standard' | 'review' = 'standard') => ({
  version,
  requestId: randomUUID(),
  message: 'Please help clarify the manufacturing brief.',
  quality,
  consent: true,
});
const publish = (version: number) => ({
  version,
  visibility: 'public',
  target_profile_id: null,
  currency: 'USD',
  budget: null,
});
const answer = (brief: StudioBrief, input = 101, output = 42) =>
  new Response(
    JSON.stringify({
      status: 'completed',
      output: [
        {
          type: 'message',
          status: 'completed',
          content: [{ type: 'output_text', text: JSON.stringify(brief) }],
        },
      ],
      usage: { input_tokens: input, output_tokens: output },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

async function fixture(ai: StudioAIConfig = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'neofab-studio-test-')),
    store = new Store(join(dir, 'openprint.sqlite'));
  const server = createApp({
    store,
    dataDir: dir,
    appUrl: 'http://test.local',
    studioAI: ai,
  }).listen(0, '127.0.0.1');
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
      const contentType = response.headers.get('Content-Type') || '';
      return {
        status: response.status,
        data: contentType.includes('application/json')
          ? await response.json()
          : Buffer.from(await response.arrayBuffer()),
        headers: response.headers,
      };
    };
  const encoded = await hashPassword(password);
  function actor(name: string) {
    const id = randomUUID(),
      token = randomBytes(32).toString('hex');
    store.run(
      'INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)',
      id,
      `${id}@test.example`,
      name,
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
  function profile(
    owner: string,
    options: {
      published?: number;
      suspended?: number;
      remote?: number;
      city?: string;
      technologies?: string[];
      kind?: string;
    } = {},
  ) {
    const id = randomUUID();
    store.run(
      `INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,remote,published,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      owner,
      'Test maker',
      options.kind || 'both',
      options.city || 'Test city',
      'Fictional test provider',
      JSON.stringify(options.technologies || ['FDM', 'CAD', 'CNC', 'LASER']),
      '["PLA"]',
      options.remote || 0,
      options.published ?? 1,
      Date.now(),
    );
    if (options.suspended) store.run('UPDATE users SET suspended=1 WHERE id=?', owner);
    return id;
  }
  const owner = actor('Owner'),
    other = actor('Other');
  return {
    dir,
    store,
    owner,
    other,
    actor,
    profile,
    guest: call(),
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
type Actor = Awaited<ReturnType<typeof fixture>>['owner'];
async function create(owner: Actor) {
  const response = await owner.call('/studio/projects', 'POST', { idea, language: 'en' });
  assert.equal(response.status, 201);
  return response.data.project as { id: string; version: number; brief: StudioBrief };
}
async function prepare(owner: Actor, brief = readyBrief()) {
  const project = await create(owner);
  const response = await owner.call(`/studio/projects/${project.id}`, 'PUT', {
    version: project.version,
    brief,
  });
  assert.equal(response.status, 200);
  return response.data.project as { id: string; version: number; brief: StudioBrief };
}
function delayedTransport() {
  const pending: { resolve: (response: Response) => void; body: Record<string, unknown> }[] = [];
  const transport = (async (_url, options) =>
    new Promise<Response>((resolve) => {
      pending.push({ resolve, body: JSON.parse(String(options?.body)) });
    })) as typeof fetch;
  async function wait(count: number) {
    for (let n = 0; n < 100 && pending.length < count; n++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(pending.length, count, 'outbound mock request arrived');
  }
  return { pending, transport, wait };
}

test('studio HTTP owner boundaries, manual skeleton, CAS and explicit confirmation history', async () => {
  const f = await fixture();
  try {
    const caps = await f.guest('/studio/capabilities');
    assert.equal(caps.status, 200);
    assert.equal(caps.data.ai.configured, false);
    assert.equal((await f.guest('/studio/projects')).status, 401);
    const fullIdea = 'a'.repeat(2990) + 'END-SOURCE';
    const boundary = await f.owner.call('/studio/projects', 'POST', {
      idea: fullIdea,
      language: 'en',
    });
    assert.equal(boundary.status, 201);
    assert.equal(boundary.data.project.brief.purpose, fullIdea);
    assert.equal(
      (await f.owner.call('/studio/projects', 'POST', { idea: fullIdea + 'x', language: 'en' }))
        .status,
      400,
    );
    const created = await create(f.owner),
      path = `/studio/projects/${created.id}`;
    assert.equal(created.brief.quantity, null);
    assert.equal(created.brief.part, null);
    assert.equal((await f.owner.call(path)).data.project.source, 'manual');
    assert.equal((await f.other.call(path)).status, 404);
    assert.equal(
      (await f.other.call(path, 'PUT', { version: 1, brief: readyBrief() })).status,
      404,
    );
    assert.equal(
      (await f.owner.call(path, 'PUT', { version: 1, brief: readyBrief() }, 'https://evil.example'))
        .status,
      403,
    );
    assert.equal((await f.owner.call(path + '/confirm', 'POST', { version: 1 })).status, 400);
    assert.equal((await f.owner.call(path + '/packet')).status, 409);
    assert.equal((await f.owner.call(path + '/assist', 'POST', request(1))).status, 503);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_ai_runs')!.n, 0);
    const save = await f.owner.call(path, 'PUT', { version: 1, brief: readyBrief() });
    assert.equal(save.data.project.version, 2);
    assert.equal(
      (await f.owner.call(path, 'PUT', { version: 1, brief: readyBrief() })).status,
      409,
    );
    assert.equal((await f.owner.call(path + '/confirm', 'POST', { version: 2 })).status, 200);
    assert.equal((await f.owner.call(path + '/confirm', 'POST', { version: 2 })).status, 200);
    const unchanged = await f.owner.call(path, 'PUT', { version: 2, brief: readyBrief() });
    assert.equal(unchanged.data.project.version, 2);
    assert.equal(unchanged.data.project.confirmed_version, 2);
    const changed = readyBrief();
    changed.assumptions = ['Assumed outdoor use; owner has not agreed'];
    const next = await f.owner.call(path, 'PUT', { version: 2, brief: changed });
    assert.equal(next.data.project.confirmed_version, null);
    assert.equal((await f.owner.call(path + '/confirm', 'POST', { version: 3 })).status, 200);
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_confirmations')!.n,
      2,
    );
    assert.deepEqual(
      (await f.owner.call(path + '/packet')).data.brief.assumptions,
      changed.assumptions,
    );
    assert.equal(
      f.store.get<{ n: number }>(
        'SELECT count(*) AS n FROM studio_revisions WHERE project_id=?',
        created.id,
      )!.n,
      3,
    );
    assert.throws(
      () =>
        f.store.run(
          'UPDATE studio_revisions SET brief=? WHERE project_id=? AND version=2',
          '{}',
          created.id,
        ),
      /immutable/,
    );
    assert.equal((await f.other.call('/studio/projects')).data.projects.length, 0);
  } finally {
    await f.close();
  }
});

test('confirmed packet locks exact STL bytes, publishes once under racing requests, and stays private', async () => {
  const f = await fixture();
  try {
    const provider = f.actor('Provider');
    const providerProfile = f.profile(provider.id);
    const hidden = f.actor('Unpublished');
    f.profile(hidden.id, { published: 0 });
    const suspended = f.actor('Suspended');
    f.profile(suspended.id, { suspended: 1 });
    const p = await prepare(f.owner),
      path = `/studio/projects/${p.id}`;
    assert.equal(
      (await f.owner.call(path + '/confirm', 'POST', { version: p.version })).status,
      200,
    );
    const packet = await f.owner.call(path + '/packet'),
      model = await f.owner.call(path + '/model.stl');
    const manifest = packet.data.manifest.find(
      (entry: { path: string }) => entry.path === 'model.stl',
    );
    assert.equal(digest(model.data), manifest.sha256);
    assert.equal(packet.data.confirmed_hash, digest(canonicalJSON(p.brief)));
    assert.equal((await f.other.call(path + '/packet')).status, 404);
    assert.equal((await f.other.call(path + '/model.stl')).status, 404);
    const matched = await f.owner.call(path + '/matches');
    assert.deepEqual(
      matched.data.matches.map((match: { profile: { user_id: string } }) => match.profile.user_id),
      [provider.id],
    );
    const results = await Promise.all([
      f.owner.call(path + '/publish', 'POST', publish(p.version)),
      f.owner.call(path + '/publish', 'POST', publish(p.version)),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    assert.equal(results[0].data.job_id, results[1].data.job_id);
    assert.equal(
      (await f.owner.call(path + '/publish', 'POST', { ...publish(p.version), currency: 'EUR' }))
        .data.code,
      'STUDIO_PUBLICATION_CHANGED',
    );
    assert.equal(
      (await f.owner.call(path + '/publish', 'POST', { ...publish(p.version), budget: 5000 })).data
        .code,
      'STUDIO_PUBLICATION_CHANGED',
    );
    assert.equal(
      (
        await f.owner.call(path + '/publish', 'POST', {
          ...publish(p.version),
          visibility: 'direct',
          target_profile_id: providerProfile,
        })
      ).data.code,
      'STUDIO_PUBLICATION_CHANGED',
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) AS n FROM jobs')!.n, 1);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) AS n FROM files')!.n, 1);
    const file = f.store.get<{ id: string; sha256: string; storage_name: string }>(
      'SELECT * FROM files',
    )!;
    assert.equal(file.sha256, manifest.sha256);
    assert.deepEqual(readFileSync(join(f.dir, 'uploads', file.storage_name)), model.data);
    assert.equal((await f.guest('/files/' + file.id)).status, 404);
    assert.equal((await provider.call('/files/' + file.id)).status, 404);
    assert.equal((await f.owner.call('/files/' + file.id)).status, 200);
    assert.equal(
      (await f.owner.call(path, 'PUT', { version: p.version, brief: readyBrief() })).status,
      409,
    );
    assert.throws(
      () => f.store.run('UPDATE studio_projects SET packet=? WHERE id=?', '{}', p.id),
      /immutable/,
    );
    assert.deepEqual((await f.owner.call(path + '/model.stl')).data, model.data);
    assert.deepEqual((await f.owner.call(path + '/packet')).data, packet.data);
  } finally {
    await f.close();
  }
});

test('multi-process BOM handoff preserves every requirement without claiming generated CAD or CAM', async () => {
  const f = await fixture();
  try {
    const brief = readyBrief();
    brief.process = 'MIXED';
    brief.part = null;
    brief.requestKind = 'design';
    brief.components = Array.from({ length: 20 }, (_, i) => ({
      name: `Furniture component ${i + 1}`,
      quantity: i + 1,
      process: i % 2 ? 'WOOD_CNC' : 'SHEET_METAL',
      material: i % 2 ? 'Plywood' : 'Steel',
      requirements: `Distinct requirement ${i + 1}: ${'A'.repeat(350)}`,
    }));
    brief.operations = ['Confirm assembly and fastening design', 'Confirm finishing and packaging'];
    brief.acceptance = ['Measure agreed dimensions', 'FINAL-ACCEPTANCE-MUST-SURVIVE'];
    const p = await prepare(f.owner, brief),
      path = `/studio/projects/${p.id}`;
    assert.equal(
      (await f.owner.call(path + '/confirm', 'POST', { version: p.version })).status,
      200,
    );
    assert.equal((await f.owner.call(path + '/model.stl')).status, 404);
    const packet = (await f.owner.call(path + '/packet')).data;
    assert.equal(packet.cam, 'not_generated');
    assert.equal(packet.geometry_scope, 'no_geometry');
    assert.equal(packet.manifest.length, 1);
    const result = await f.owner.call(path + '/publish', 'POST', publish(p.version));
    assert.equal(result.status, 200);
    const job = f.store.get<{
      description: string;
      kind: string;
      technology: string;
      file_id: string | null;
    }>('SELECT * FROM jobs WHERE id=?', result.data.job_id)!;
    assert.equal(job.kind, 'design');
    assert.equal(job.technology, 'Any');
    assert.equal(job.file_id, null);
    assert.ok(job.description.length > 6000);
    assert.ok(job.description.includes('Distinct requirement 20:'));
    assert.ok(job.description.includes('FINAL-ACCEPTANCE-MUST-SURVIVE'));
    assert.ok(job.description.includes(packet.confirmed_hash));
    const bad = readyBrief();
    bad.components = [brief.components[0]];
    const assembly = await prepare(f.owner, bad);
    assert.equal(
      (
        await f.owner.call(`/studio/projects/${assembly.id}/confirm`, 'POST', {
          version: assembly.version,
        })
      ).status,
      400,
    );
  } finally {
    await f.close();
  }
});

test('Responses request is bounded and explicit; idempotency, refusal metering and project budget survive retries', async () => {
  let calls = 0,
    outbound: Record<string, unknown> | undefined;
  const transport = (async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options?.redirect, 'error');
    outbound = JSON.parse(String(options?.body));
    if (calls === 2)
      return new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              status: 'completed',
              content: [{ type: 'refusal', refusal: 'Private provider detail never exposed' }],
            },
          ],
          usage: { input_tokens: 22, output_tokens: 7 },
        }),
      );
    const brief = readyBrief();
    brief.part = null;
    return answer(brief);
  }) as typeof fetch;
  const f = await fixture({ apiKey: 'test-key-not-real', fetch: transport, maxCallsPerProject: 2 });
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}`,
      first = request(1);
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', { ...first, consent: false })).status,
      400,
    );
    const response = await f.owner.call(path + '/assist', 'POST', first);
    assert.equal(response.status, 200);
    assert.equal(response.data.project.source, 'openai');
    assert.equal(response.data.project.confirmed_version, null);
    assert.equal(response.data.project.job_id, null);
    assert.equal(outbound?.model, 'gpt-6-luna');
    assert.equal(outbound?.store, false);
    assert.equal(outbound?.max_output_tokens, 3000);
    assert.equal((outbound?.text as { format: { strict: boolean } }).format.strict, true);
    assert.equal((await f.owner.call(path + '/assist', 'POST', first)).status, 200);
    assert.equal(calls, 1);
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', { ...first, message: 'different' })).status,
      409,
    );
    const second = request(2, 'review');
    const refused = await f.owner.call(path + '/assist', 'POST', second);
    assert.equal(refused.status, 422);
    assert.equal(refused.data.code, 'AI_REFUSAL');
    assert.ok(!JSON.stringify(refused.data).includes('Private provider'));
    assert.equal(outbound?.model, 'gpt-6.1-sol');
    assert.equal((await f.owner.call(path + '/assist', 'POST', second)).status, 422);
    assert.equal(calls, 2);
    const exhausted = await f.owner.call(path + '/assist', 'POST', request(2));
    assert.equal(exhausted.status, 429);
    assert.equal(exhausted.data.code, 'AI_PROJECT_LIMIT');
    const data = (await f.owner.call(path)).data;
    assert.equal(data.project.version, 2);
    assert.equal(data.usage.projectCalls, 2);
    assert.equal(data.usage.inputTokens, 123);
    assert.equal(data.usage.outputTokens, 49);
  } finally {
    await f.close();
  }
});

test('laser manufacture requests match workshops and retain uncertainty for quotation', async () => {
  const f = await fixture();
  try {
    const workshop = f.actor('Laser maker'),
      engineer = f.actor('CAD engineer'),
      unrelated = f.actor('FDM only');
    f.profile(workshop.id, { kind: 'studio', technologies: ['LASER'] });
    f.profile(engineer.id, { kind: 'engineer', technologies: ['CAD', 'LASER'] });
    f.profile(unrelated.id, { kind: 'studio', technologies: ['FDM'] });
    const brief = readyBrief();
    brief.process = 'LASER';
    brief.part = null;
    brief.components = [
      {
        name: 'Panel',
        quantity: null,
        process: 'LASER',
        material: 'Plywood',
        requirements: 'Confirm sheet thickness before quotation',
      },
    ];
    brief.questions = ['Which file format does the workshop need?'];
    brief.assumptions = ['Sheet thickness has not been agreed'];
    const p = await prepare(f.owner, brief),
      path = `/studio/projects/${p.id}`;
    const matches = (await f.owner.call(path + '/matches')).data.matches;
    assert.deepEqual(
      matches.map((match: { profile: { user_id: string } }) => match.profile.user_id),
      [workshop.id],
    );
    assert.equal(
      (await f.owner.call(path + '/confirm', 'POST', { version: p.version })).status,
      200,
    );
    const packet = (await f.owner.call(path + '/packet')).data;
    assert.equal(packet.confirmation_scope, 'brief_for_discussion_and_quote');
    assert.deepEqual(packet.brief.questions, brief.questions);
    assert.deepEqual(packet.brief.assumptions, brief.assumptions);
    const result = await f.owner.call(path + '/publish', 'POST', publish(p.version));
    assert.equal(result.status, 200);
    const job = f.store.get<{ kind: string; technology: string; description: string }>(
      'SELECT * FROM jobs WHERE id=?',
      result.data.job_id,
    )!;
    assert.equal(job.kind, 'print');
    assert.equal(job.technology, 'LASER');
    assert.ok(job.description.includes('Panel × to clarify'));
    assert.ok(job.description.includes(brief.questions[0]));
    assert.ok(job.description.includes(brief.assumptions[0]));
  } finally {
    await f.close();
  }
});

test('global concurrency is capped at two even when the daily budget allows more', async () => {
  const gate = delayedTransport(),
    f = await fixture({ apiKey: 'test-only', fetch: gate.transport });
  try {
    const third = f.actor('Third'),
      p1 = await create(f.owner),
      p2 = await create(f.other),
      p3 = await create(third);
    const one = f.owner.call(`/studio/projects/${p1.id}/assist`, 'POST', request(1));
    await gate.wait(1);
    const two = f.other.call(`/studio/projects/${p2.id}/assist`, 'POST', request(1));
    await gate.wait(2);
    assert.equal(
      (await third.call(`/studio/projects/${p3.id}/assist`, 'POST', request(1))).data.code,
      'AI_BUSY',
    );
    assert.equal(gate.pending.length, 2);
    const brief = readyBrief();
    brief.part = null;
    gate.pending[0].resolve(answer(brief));
    gate.pending[1].resolve(answer(brief));
    await Promise.all([one, two]);
  } finally {
    await f.close();
  }
});

test('history caps preserve old revisions, no-op confirmation, and reject extra writes before AI', async () => {
  let calls = 0;
  const f = await fixture({
    apiKey: 'test-only',
    fetch: (async () => {
      calls++;
      return answer(readyBrief());
    }) as typeof fetch,
  });
  try {
    const p = await prepare(f.owner),
      path = `/studio/projects/${p.id}`;
    assert.equal(
      (await f.owner.call(path + '/confirm', 'POST', { version: p.version })).status,
      200,
    );
    for (let version = 3; version <= 100; version++) {
      const historical = { ...readyBrief(), title: `Historical draft ${version}` };
      f.store.run(
        `INSERT INTO studio_revisions(project_id,version,brief,source,created_at) VALUES(?,?,?,'manual',?)`,
        p.id,
        version,
        canonicalJSON(historical),
        Date.now(),
      );
    }
    // Fixture deliberately leaves the current confirmed version selected, as a user viewing an older version could.
    const noOp = await f.owner.call(path, 'PUT', { version: p.version, brief: readyBrief() });
    assert.equal(noOp.status, 200);
    assert.equal(noOp.data.project.confirmed_version, p.version);
    const changed = { ...readyBrief(), title: 'A genuinely different revision' };
    assert.equal(
      (await f.owner.call(path, 'PUT', { version: p.version, brief: changed })).data.code,
      'STUDIO_REVISION_LIMIT',
    );
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', request(p.version))).data.code,
      'STUDIO_REVISION_LIMIT',
    );
    assert.equal(calls, 0);
    assert.equal(
      f.store.get<{ n: number }>(
        'SELECT count(*) AS n FROM studio_revisions WHERE project_id=?',
        p.id,
      )!.n,
      100,
    );
  } finally {
    await f.close();
  }
});

test('reservation transaction enforces one request per user, global concurrency and persistent rolling-day cap', async () => {
  const gate = delayedTransport(),
    f = await fixture({ apiKey: 'test-only', fetch: gate.transport, maxCallsPerInstanceDay: 2 });
  try {
    const third = f.actor('Third'),
      p1 = await create(f.owner),
      p2 = await create(f.other),
      p3 = await create(third),
      extra = await create(f.owner);
    const body = request(1),
      first = f.owner.call(`/studio/projects/${p1.id}/assist`, 'POST', body);
    await gate.wait(1);
    assert.equal(
      (await f.owner.call(`/studio/projects/${p1.id}/assist`, 'POST', body)).data.code,
      'AI_RUNNING',
    );
    assert.equal(
      (await f.owner.call(`/studio/projects/${extra.id}/assist`, 'POST', request(1))).data.code,
      'AI_RUNNING',
    );
    const second = f.other.call(`/studio/projects/${p2.id}/assist`, 'POST', request(1));
    await gate.wait(2);
    assert.equal(
      (await third.call(`/studio/projects/${p3.id}/assist`, 'POST', request(1))).data.code,
      'AI_INSTANCE_LIMIT',
    );
    const brief = readyBrief();
    brief.part = null;
    gate.pending[0].resolve(answer(brief));
    gate.pending[1].resolve(answer(brief));
    assert.equal((await first).status, 200);
    assert.equal((await second).status, 200);
    assert.equal(
      (await third.call(`/studio/projects/${p3.id}/assist`, 'POST', request(1))).data.code,
      'AI_INSTANCE_LIMIT',
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_ai_runs')!.n, 2);
  } finally {
    await f.close();
  }
});

test('AI stale results preserve concurrent manual edits and newly confirmed versions while recording tokens', async () => {
  const gate = delayedTransport(),
    f = await fixture({ apiKey: 'test-only', fetch: gate.transport });
  try {
    const p = await prepare(f.owner),
      path = `/studio/projects/${p.id}`;
    const first = f.owner.call(path + '/assist', 'POST', request(p.version));
    await gate.wait(1);
    const edited = readyBrief();
    edited.title = 'Owner edited the title';
    assert.equal(
      (await f.owner.call(path, 'PUT', { version: p.version, brief: edited })).status,
      200,
    );
    const aiBrief = readyBrief();
    aiBrief.title = 'AI must not overwrite this';
    aiBrief.part = null;
    gate.pending[0].resolve(answer(aiBrief, 210, 31));
    assert.equal((await first).data.code, 'STUDIO_CHANGED');
    const after = (await f.owner.call(path)).data;
    assert.equal(after.project.brief.title, edited.title);
    assert.equal(after.usage.inputTokens, 210);
    assert.equal(after.usage.runs[0].status, 'stale');
    const second = f.owner.call(path + '/assist', 'POST', request(after.project.version));
    await gate.wait(2);
    assert.equal(
      (await f.owner.call(path + '/confirm', 'POST', { version: after.project.version })).status,
      200,
    );
    gate.pending[1].resolve(answer(aiBrief));
    assert.equal((await second).data.code, 'STUDIO_CHANGED');
    assert.equal((await f.owner.call(path)).data.project.confirmed_version, after.project.version);
  } finally {
    await f.close();
  }
});

test('account closure during AI removes project contents, retains metering and never restores the draft', async () => {
  const gate = delayedTransport(),
    f = await fixture({ apiKey: 'test-only', fetch: gate.transport, maxCallsPerInstanceDay: 1 });
  try {
    const p = await create(f.owner),
      pending = f.owner.call(`/studio/projects/${p.id}/assist`, 'POST', request(1));
    await gate.wait(1);
    assert.equal(
      (await f.owner.call('/account', 'DELETE', { password, confirm: 'DELETE' })).status,
      200,
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_projects')!.n, 0);
    assert.equal(
      f.store.get<{ project_id: string | null }>('SELECT project_id FROM studio_ai_runs')!
        .project_id,
      null,
    );
    const brief = readyBrief();
    brief.part = null;
    gate.pending[0].resolve(answer(brief, 81, 33));
    assert.equal((await pending).status, 409);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) AS n FROM studio_projects')!.n, 0);
    assert.equal(
      f.store.get<{ input_tokens: number }>('SELECT input_tokens FROM studio_ai_runs')!
        .input_tokens,
      81,
    );
    const second = await create(f.other);
    assert.equal(
      (await f.other.call(`/studio/projects/${second.id}/assist`, 'POST', request(1))).data.code,
      'AI_INSTANCE_LIMIT',
    );
  } finally {
    await f.close();
  }
});

test('invented dimensions are withheld; only explicit complete supported shapes can become geometry', async () => {
  const expected = readyBrief().part!;
  assert.equal(explicitlySpecifiedPart(expected, JSON.parse(canonicalJSON(expected)), idea), true);
  assert.equal(explicitlySpecifiedPart(expected, null, idea), false);
  assert.equal(
    explicitlySpecifiedPart(
      expected,
      null,
      'plate width 70 mm, depth 45 mm, thickness 5 mm, hole diameter 10 mm',
    ),
    true,
  );
  assert.equal(explicitlySpecifiedPart(expected, null, 'plate 70 × 45 × 5 mm'), false);
  const f = await fixture({
    apiKey: 'test-only',
    fetch: (async () => answer(readyBrief())) as typeof fetch,
  });
  try {
    const p = await create(f.owner),
      result = await f.owner.call(`/studio/projects/${p.id}/assist`, 'POST', request(1));
    assert.equal(result.status, 200);
    assert.equal(result.data.project.brief.part, null);
    assert.ok(result.data.project.brief.questions.length > 0);
    assert.equal((await f.owner.call(`/studio/projects/${p.id}/model.stl`)).status, 409);
  } finally {
    await f.close();
  }
});

test('timeouts and truncated output keep conservative accounting and never silently retry', async () => {
  let calls = 0;
  const transport = (async (_url, options) => {
    calls++;
    if (calls === 1)
      return new Promise<Response>((_resolve, reject) =>
        options?.signal?.addEventListener(
          'abort',
          () => reject(new Error('test-only provider secret')),
          { once: true },
        ),
      );
    return new Response(
      JSON.stringify({
        status: 'incomplete',
        usage: { input_tokens: 12, output_tokens: 3000 },
        output: [],
      }),
    );
  }) as typeof fetch;
  const f = await fixture({
    apiKey: 'test-only',
    fetch: transport,
    timeoutMs: 20,
    maxCallsPerUserDay: 2,
  });
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}`,
      first = request(1);
    const timeout = await f.owner.call(path + '/assist', 'POST', first);
    assert.equal(timeout.status, 504);
    assert.equal(timeout.data.code, 'AI_TIMEOUT');
    assert.ok(!JSON.stringify(timeout.data).includes('secret'));
    assert.equal((await f.owner.call(path + '/assist', 'POST', first)).status, 504);
    assert.equal(calls, 1);
    const incomplete = await f.owner.call(path + '/assist', 'POST', request(1));
    assert.equal(incomplete.data.code, 'AI_INCOMPLETE');
    const extra = await create(f.owner);
    assert.equal(
      (await f.owner.call(`/studio/projects/${extra.id}/assist`, 'POST', request(1))).data.code,
      'AI_USER_LIMIT',
    );
    const data = (await f.owner.call(path)).data;
    assert.equal(data.project.version, 1);
    assert.equal(data.usage.projectCalls, 2);
    assert.equal(data.usage.outputTokens, 3000);
  } finally {
    await f.close();
  }
});

test('v1 community data migrates additively to v2 and usage survives reopening', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'neofab-migration-test-')),
    path = join(dir, 'community.sqlite');
  try {
    const v1 = new Store(path),
      owner = randomUUID();
    v1.db.exec(
      'DROP TABLE studio_ai_runs; DROP TABLE studio_confirmations; DROP TABLE studio_revisions; DROP TABLE studio_projects; PRAGMA user_version=1;',
    );
    v1.run(
      'INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)',
      owner,
      'legacy@test.example',
      'Legacy owner',
      'unchanged hash',
      1,
    );
    v1.run('INSERT INTO meta(key,value) VALUES(?,?)', 'existing', 'preserve me');
    v1.close();
    const migrated = new Store(path);
    assert.equal(migrated.get<{ user_version: number }>('PRAGMA user_version')!.user_version, 2);
    assert.equal(
      migrated.get<{ name: string }>('SELECT name FROM users WHERE id=?', owner)!.name,
      'Legacy owner',
    );
    assert.equal(
      migrated.get<{ value: string }>('SELECT value FROM meta WHERE key=?', 'existing')!.value,
      'preserve me',
    );
    migrated.run(
      `INSERT INTO studio_ai_runs(id,owner_id,project_id,request_id,request_hash,input_version,model,quality,status,created_at,input_tokens,output_tokens) VALUES(?,?,NULL,?,?,1,'test','standard','failed',?,7,11)`,
      randomUUID(),
      owner,
      randomUUID(),
      digest('request'),
      Date.now(),
    );
    migrated.close();
    const reopened = new Store(path);
    assert.equal(reopened.get<{ n: number }>('SELECT count(*) AS n FROM studio_ai_runs')!.n, 1);
    assert.deepEqual(reopened.all('PRAGMA foreign_key_check'), []);
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
