import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Store } from '../server/database.js';
import { createApp } from '../server/app.js';
import { digest, hashPassword } from '../server/security.js';
import { canonicalJSON } from '../server/studio-geometry.js';
import { cadProposalProviderSchema, cadAIInput } from '../server/cad-ai.js';
import { resolveStudioAIConfig, type StudioAIConfig } from '../server/studio-ai.js';
import type { CadOptions, CadService } from '../server/cad-runner.js';
import { cadSpecSchema, sampleCadSpec, type CadSpec } from '../shared/cad.js';
import type { CadProposal } from '../shared/cad-ai.js';
import type { StudioBrief, StudioProject } from '../shared/studio.js';

const password = 'cad-ai-tests-only-long-passphrase';
const idea =
  'A CNC plate with width 80 mm, depth 50 mm and thickness 6 mm; clarify holes before building.';
const brief = (): StudioBrief => ({
  title: 'Workshop plate for quotation',
  purpose: idea,
  requestKind: 'design',
  process: 'CNC',
  material: '',
  quantity: 1,
  city: 'Fictional city',
  part: null,
  requirements: [],
  questions: ['Which material is suitable?'],
  assumptions: [],
  components: [],
  operations: [],
  acceptance: [],
});
const proposal = (spec: CadSpec | null = sampleCadSpec('plate')) => ({
  summary: 'A plate proposed for explicit dimensional review.',
  questions: ['Which material is suitable?'],
  spec,
});
const request = (version: number) => ({
  version,
  requestId: randomUUID(),
  message: 'Use the saved requirements and explain missing dimensions.',
  consent: true,
});
const briefRequest = (version: number) => ({ ...request(version), quality: 'standard' });
function answer(value: unknown, input = 123, output = 456) {
  return new Response(
    JSON.stringify({
      status: 'completed',
      output: [
        {
          type: 'message',
          status: 'completed',
          content: [{ type: 'output_text', text: JSON.stringify(value) }],
        },
      ],
      usage: { input_tokens: input, output_tokens: output },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
async function fixture(ai: StudioAIConfig = {}, cad: CadOptions = { python: '' }) {
  const dir = mkdtempSync(join(tmpdir(), 'neofab-cad-ai-')),
    store = new Store(join(dir, 'community.sqlite'));
  const app = createApp({ store, dataDir: dir, appUrl: 'http://test.local', studioAI: ai, cad });
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
        headers: response.headers,
        data: response.headers.get('Content-Type')?.includes('application/json')
          ? await response.json()
          : Buffer.from(await response.arrayBuffer()),
      };
    };
  const hash = await hashPassword(password);
  function actor() {
    const id = randomUUID(),
      token = randomBytes(32).toString('hex');
    store.run(
      'INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)',
      id,
      `${id}@example.test`,
      'Fictional actor',
      hash,
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
  return {
    dir,
    store,
    owner: actor(),
    other: actor(),
    actor,
    guest: call(),
    async close() {
      await (app.locals.cad as CadService).stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
type Actor = Awaited<ReturnType<typeof fixture>>['owner'];
async function create(actor: Actor) {
  const created = await actor.call('/studio/projects', 'POST', { idea, language: 'en' });
  assert.equal(created.status, 201);
  const saved = await actor.call(`/studio/projects/${created.data.project.id}`, 'PUT', {
    version: 1,
    brief: brief(),
  });
  assert.equal(saved.status, 200);
  return saved.data.project as StudioProject;
}
function delayed() {
  const pending: { body: any; resolve: (value: Response) => void }[] = [];
  const fetch = (async (_url, options) =>
    new Promise<Response>((resolve) => {
      pending.push({ body: JSON.parse(String(options?.body)), resolve });
    })) as typeof globalThis.fetch;
  async function wait(count: number) {
    for (let i = 0; i < 100 && pending.length < count; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(pending.length, count);
  }
  return { pending, fetch, wait };
}

test('CAD AI capabilities, ownership, Origin, explicit consent and legacy-template guard precede paid work', async () => {
  const f = await fixture();
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}/cad`;
    assert.equal((await f.guest(path + '/proposals')).status, 401);
    assert.equal((await f.other.call(path + '/proposals')).status, 404);
    const caps = await f.owner.call(path + '/proposals');
    assert.equal(caps.data.ai.configured, false);
    assert.equal(caps.data.ai.model, 'gpt-6.1-sol');
    assert.deepEqual(caps.data.proposals, []);
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', request(p.version))).data.code,
      'AI_DISABLED',
    );
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', request(p.version), 'https://other.example'))
        .status,
      403,
    );
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', { ...request(p.version), consent: false }))
        .status,
      400,
    );
    assert.equal(
      (
        await f.owner.call(path + '/assist', 'POST', {
          ...request(p.version),
          model: 'chosen-by-client',
        })
      ).status,
      400,
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM studio_ai_runs')!.n, 0);
  } finally {
    await f.close();
  }
  const configured = await fixture({
    apiKey: 'fictional',
    fetch: async () => {
      throw new Error('Must not call');
    },
  });
  try {
    const p = await create(configured.owner),
      path = `/studio/projects/${p.id}`;
    const saved = await configured.owner.call(path, 'PUT', {
      version: p.version,
      brief: { ...brief(), part: { kind: 'block', width: 20, depth: 20, height: 20, hole: 0 } },
    });
    assert.equal(
      (
        await configured.owner.call(
          path + '/cad/assist',
          'POST',
          request(saved.data.project.version),
        )
      ).data.code,
      'CAD_TEMPLATE_CONFLICT',
    );
    assert.equal(
      configured.store.get<{ n: number }>('SELECT count(*) n FROM studio_ai_runs')!.n,
      0,
    );
  } finally {
    await configured.close();
  }
});

test('CAD structured request uses the server model and supported tuple projection, then stores a private immutable proposal only', async () => {
  const calls: { url: string; options: RequestInit; body: any }[] = [];
  const f = await fixture({
    apiKey: 'fictional-key',
    model: 'brief-model',
    reviewModel: 'review-model',
    cadModel: 'cad-model',
    cadMaxOutputTokens: 9000,
    fetch: (async (url, options) => {
      calls.push({ url: String(url), options: options!, body: JSON.parse(String(options!.body)) });
      return answer(proposal());
    }) as typeof fetch,
  });
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}`,
      body = request(p.version);
    const received = await f.owner.call(path + '/cad/assist', 'POST', body);
    assert.equal(received.status, 200);
    assert.equal(calls.length, 1);
    const sent = calls[0];
    assert.equal(sent.url, 'https://api.openai.com/v1/responses');
    assert.equal(sent.options.redirect, 'error');
    assert.equal(sent.body.model, 'cad-model');
    assert.equal(sent.body.store, false);
    assert.equal(sent.body.max_output_tokens, 9000);
    assert.equal(sent.body.tools, undefined);
    assert.equal(sent.body.reasoning, undefined);
    assert.equal(sent.body.text.format.strict, true);
    let identifiers = 0;
    const schema = sent.body.text.format.schema,
      walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        assert.equal('prefixItems' in node, false);
        assert.equal('oneOf' in node, false);
        assert.notEqual(node.items, false);
        if (node.type === 'object') {
          assert.equal(node.additionalProperties, false);
          assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
          if (node.properties.id) {
            identifiers++;
            assert.equal(node.properties.id.pattern, '^[A-Za-z][A-Za-z0-9_-]{0,39}$');
          }
        }
        Object.values(node).forEach(walk);
      };
    walk(schema);
    assert.ok(identifiers > 0);
    const invalidLocalSpec = sampleCadSpec('plate');
    invalidLocalSpec.operations[0].id += '\n';
    assert.equal(cadSpecSchema.safeParse(invalidLocalSpec).success, false);
    assert.match(JSON.stringify(schema), /"minItems":3,"maxItems":3/);
    const input = JSON.parse(sent.body.input[0].content[0].text);
    assert.deepEqual(Object.keys(input).sort(), [
      'idea',
      'language',
      'message',
      'saved_brief',
      'saved_cad',
    ]);
    assert.equal(input.saved_cad, null);
    assert.equal(input.idea, idea);
    const result = received.data.proposals[0] as CadProposal;
    assert.equal(result.input_version, p.version);
    assert.equal(result.model, 'cad-model');
    assert.equal(result.stale, false);
    assert.equal(result.applied_version, null);
    assert.ok(result.spec!.assumptions.includes('Open question: Which material is suitable?'));
    assert.ok(result.spec!.assumptions.some((x) => x.startsWith('AI CAD proposal;')));
    for (const table of [
      'studio_cad_revisions',
      'studio_cad_builds',
      'studio_confirmations',
      'jobs',
    ])
      assert.equal(f.store.get<{ n: number }>(`SELECT count(*) n FROM ${table}`)!.n, 0);
    assert.equal((await f.owner.call(path)).data.project.version, p.version);
    assert.equal(received.data.usage.projectCalls, 1);
    assert.equal(received.data.usage.outputTokens, 456);
    assert.equal(received.data.usage.runs[0].task, 'cad');
    assert.throws(
      () =>
        f.store.run('UPDATE studio_cad_proposals SET summary=? WHERE id=?', 'Changed', result.id),
      /immutable/,
    );
    assert.throws(
      () => f.store.run("UPDATE studio_ai_runs SET task='brief' WHERE id=?", result.run_id),
      /immutable/,
    );
    assert.equal((await f.owner.call(path + '/cad/assist', 'POST', body)).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(
      (await f.owner.call(path + '/cad/assist', 'POST', { ...body, message: 'Different text' }))
        .data.code,
      'AI_REQUEST_CHANGED',
    );
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', { ...body, quality: 'review' })).data.code,
      'AI_REQUEST_CHANGED',
    );
  } finally {
    await f.close();
  }
});

test('explicit proposal application shares CAD save, invalidates confirmation, preserves questions, and replays without another revision', async () => {
  const f = await fixture({ apiKey: 'fictional', fetch: async () => answer(proposal()) });
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}`;
    assert.equal(
      (await f.owner.call(path + '/confirm', 'POST', { version: p.version })).status,
      200,
    );
    const result = await f.owner.call(path + '/cad/assist', 'POST', request(p.version)),
      draft = result.data.proposals[0];
    const applyPath = `${path}/cad/proposals/${draft.id}/apply`,
      body = { version: p.version, reviewed: true };
    assert.equal((await f.other.call(applyPath, 'POST', body)).status, 404);
    assert.equal(
      (await f.owner.call(applyPath, 'POST', { version: p.version, reviewed: false })).status,
      400,
    );
    assert.equal(
      (await f.owner.call(applyPath, 'POST', body, 'https://wrong.example')).status,
      403,
    );
    const applied = await f.owner.call(applyPath, 'POST', body);
    assert.equal(applied.status, 200);
    assert.equal(applied.data.project.version, p.version + 1);
    assert.equal(applied.data.project.confirmed_hash, null);
    assert.equal(applied.data.project.source, 'openai');
    assert.deepEqual(applied.data.cad.revision.spec, draft.spec);
    assert.equal(applied.data.cad.revision.sha256, digest(canonicalJSON(draft.spec)));
    assert.deepEqual(applied.data.cad.builds, []);
    assert.equal(
      (await f.owner.call(path + '/confirm', 'POST', { version: p.version + 1 })).data.code,
      'STUDIO_INCOMPLETE',
    );
    assert.equal((await f.owner.call(applyPath, 'POST', body)).status, 200);
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM studio_cad_revisions')!.n, 1);
    const listed = (await f.owner.call(path + '/cad/proposals')).data.proposals[0];
    assert.equal(listed.applied_version, p.version + 1);
    assert.equal(listed.stale, false);
    const exported = (await f.owner.call('/account/export')).data;
    assert.equal(exported.cad_proposals.length, 1);
    assert.equal(exported.studio_ai_usage[0].task, 'cad');
    assert.deepEqual(JSON.parse(exported.cad_proposals[0].spec), draft.spec);
  } finally {
    await f.close();
  }
});

test('question-only output is useful without geometry; invalid schemas, refusals and incomplete output retain usage without mutation', async () => {
  const cases = [
    { value: proposal(null), code: null },
    { value: { ...proposal(null), questions: [] }, code: 'AI_INVALID' },
    { value: { ...proposal(), executable: 'forbidden' }, code: 'AI_INVALID' },
    {
      value: {
        ...proposal(),
        spec: {
          ...sampleCadSpec('plate'),
          operations: [...sampleCadSpec('plate').operations, sampleCadSpec('plate').operations[0]],
        },
      },
      code: 'AI_INVALID',
    },
    {
      response: () =>
        new Response(
          JSON.stringify({
            status: 'completed',
            output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }],
            usage: { input_tokens: 123, output_tokens: 456 },
          }),
        ),
      code: 'AI_REFUSAL',
    },
    {
      response: () =>
        new Response(
          JSON.stringify({
            status: 'incomplete',
            usage: { input_tokens: 123, output_tokens: 456 },
          }),
        ),
      code: 'AI_INCOMPLETE',
    },
  ];
  for (const sample of cases) {
    let calls = 0;
    const f = await fixture({
      apiKey: 'fictional',
      fetch: async () => {
        calls++;
        return sample.response ? sample.response() : answer(sample.value);
      },
    });
    try {
      const p = await create(f.owner),
        path = `/studio/projects/${p.id}/cad`,
        body = request(p.version);
      const result = await f.owner.call(path + '/assist', 'POST', body);
      if (sample.code) {
        assert.equal(result.data.code, sample.code);
        assert.deepEqual((await f.owner.call(path + '/proposals')).data.proposals, []);
        assert.equal((await f.owner.call(path + '/assist', 'POST', body)).data.code, sample.code);
      } else {
        assert.equal(result.status, 200);
        assert.equal(result.data.proposals[0].spec, null);
        assert.equal(
          (
            await f.owner.call(`${path}/proposals/${result.data.proposals[0].id}/apply`, 'POST', {
              version: p.version,
              reviewed: true,
            })
          ).data.code,
          'CAD_PROPOSAL_EMPTY',
        );
      }
      assert.equal(calls, 1);
      const state = (await f.owner.call(path + '/proposals')).data;
      assert.equal(state.usage.projectCalls, 1);
      assert.equal(state.usage.inputTokens, 123);
      assert.equal(state.usage.outputTokens, 456);
      assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM studio_cad_revisions')!.n, 0);
    } finally {
      await f.close();
    }
  }
});

test('late proposals survive as stale history after edits, CAD detachment or same-version confirmation; replay never starts again', async () => {
  for (const change of ['brief', 'confirmation', 'cad-detach'] as const) {
    const d = delayed(),
      f = await fixture({ apiKey: 'fictional', fetch: d.fetch });
    try {
      let p = await create(f.owner);
      const path = `/studio/projects/${p.id}`;
      if (change === 'cad-detach')
        p = (
          await f.owner.call(path + '/cad', 'PUT', {
            version: p.version,
            spec: sampleCadSpec('plate'),
          })
        ).data.project;
      const body = request(p.version),
        pending = f.owner.call(path + '/cad/assist', 'POST', body);
      await d.wait(1);
      if (change === 'brief')
        assert.equal(
          (
            await f.owner.call(path, 'PUT', {
              version: p.version,
              brief: { ...p.brief, title: 'New manual title must remain' },
            })
          ).status,
          200,
        );
      if (change === 'confirmation')
        assert.equal(
          (await f.owner.call(path + '/confirm', 'POST', { version: p.version })).status,
          200,
        );
      if (change === 'cad-detach')
        assert.equal(
          (await f.owner.call(path + '/cad', 'DELETE', { version: p.version })).status,
          200,
        );
      d.pending[0].resolve(answer(proposal()));
      const result = await pending;
      assert.equal(result.status, 200);
      assert.equal(result.data.proposals[0].stale, true);
      const current = (await f.owner.call(path)).data.project;
      assert.equal(
        (
          await f.owner.call(`${path}/cad/proposals/${result.data.proposals[0].id}/apply`, 'POST', {
            version: current.version,
            reviewed: true,
          })
        ).data.code,
        'CAD_PROPOSAL_STALE',
      );
      assert.equal((await f.owner.call(path + '/cad/assist', 'POST', body)).status, 200);
      assert.equal(d.pending.length, 1);
      assert.equal(
        (await f.owner.call(path + '/cad/proposals')).data.usage.runs[0].status,
        'stale',
      );
    } finally {
      await f.close();
    }
  }
});

test('brief and CAD share project and user quotas, task-bound request IDs, and both concurrency slots', async () => {
  const d = delayed(),
    f = await fixture({
      apiKey: 'fictional',
      maxCallsPerProject: 2,
      maxCallsPerUserDay: 2,
      maxCallsPerInstanceDay: 10,
      fetch: d.fetch,
    });
  try {
    const p = await create(f.owner),
      second = await create(f.other),
      thirdActor = f.actor(),
      third = await create(thirdActor);
    const path = `/studio/projects/${p.id}`,
      body = request(p.version);
    const one = f.owner.call(path + '/cad/assist', 'POST', body);
    await d.wait(1);
    assert.equal(
      (await f.owner.call(path + '/assist', 'POST', briefRequest(p.version))).data.code,
      'AI_RUNNING',
    );
    assert.equal((await f.owner.call(path + '/cad/assist', 'POST', body)).data.code, 'AI_RUNNING');
    const two = f.other.call(
      `/studio/projects/${second.id}/assist`,
      'POST',
      briefRequest(second.version),
    );
    await d.wait(2);
    assert.equal(
      (
        await thirdActor.call(
          `/studio/projects/${third.id}/cad/assist`,
          'POST',
          request(third.version),
        )
      ).data.code,
      'AI_BUSY',
    );
    d.pending[0].resolve(answer(proposal()));
    d.pending[1].resolve(answer(brief()));
    assert.equal((await one).status, 200);
    assert.equal((await two).status, 200);
    const another = f.owner.call(path + '/assist', 'POST', briefRequest(p.version));
    await d.wait(3);
    d.pending[2].resolve(answer(brief()));
    assert.equal((await another).status, 200);
    assert.equal(
      (await f.owner.call(path + '/cad/assist', 'POST', request(p.version))).data.code,
      'AI_PROJECT_LIMIT',
    );
    const extra = await create(f.owner);
    assert.equal(
      (
        await f.owner.call(
          `/studio/projects/${extra.id}/cad/assist`,
          'POST',
          request(extra.version),
        )
      ).data.code,
      'AI_USER_LIMIT',
    );
    const usage = (await f.owner.call(path + '/cad/proposals')).data.usage;
    assert.equal(usage.projectCalls, 2);
    assert.deepEqual(usage.runs.map((x: any) => x.task).sort(), ['brief', 'cad']);
    assert.equal((await f.owner.call(path + '/cad/assist', 'POST', body)).status, 200);
    assert.equal(d.pending.length, 3);
  } finally {
    await f.close();
  }
});

test('account closure removes completed and in-flight CAD proposal content while the shared instance attempt ledger survives', async () => {
  const d = delayed(),
    f = await fixture({ apiKey: 'fictional', maxCallsPerInstanceDay: 2, fetch: d.fetch });
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}/cad`;
    const first = f.owner.call(path + '/assist', 'POST', request(p.version));
    await d.wait(1);
    d.pending[0].resolve(answer(proposal()));
    assert.equal((await first).status, 200);
    const second = f.owner.call(path + '/assist', 'POST', request(p.version));
    await d.wait(2);
    assert.equal(
      (await f.owner.call('/account', 'DELETE', { password, confirm: 'DELETE' })).status,
      200,
    );
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM studio_cad_proposals')!.n, 0);
    d.pending[1].resolve(answer(proposal()));
    assert.equal((await second).data.code, 'STUDIO_CHANGED');
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM studio_cad_proposals')!.n, 0);
    assert.equal(
      f.store.get<{ n: number }>('SELECT count(*) n FROM studio_ai_runs WHERE project_id IS NULL')!
        .n,
      2,
    );
    assert.equal(
      f.store.get<{ n: number }>('SELECT sum(output_tokens) n FROM studio_ai_runs')!.n,
      912,
    );
    const other = await create(f.other);
    assert.equal(
      (
        await f.other.call(
          `/studio/projects/${other.id}/assist`,
          'POST',
          briefRequest(other.version),
        )
      ).data.code,
      'AI_INSTANCE_LIMIT',
    );
  } finally {
    await f.close();
  }
});

test('timed-out and oversized CAD responses are counted once and never silently retried', async () => {
  for (const timeout of [true, false]) {
    let calls = 0;
    const f = await fixture({
      apiKey: 'fictional',
      timeoutMs: 10,
      fetch: (async (_url, options) => {
        calls++;
        if (!timeout) return new Response('x'.repeat(512 * 1024 + 1));
        return new Promise<Response>((_resolve, reject) =>
          options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          }),
        );
      }) as typeof fetch,
    });
    try {
      const p = await create(f.owner),
        path = `/studio/projects/${p.id}/cad`,
        body = request(p.version);
      const code = timeout ? 'AI_TIMEOUT' : 'AI_INVALID';
      assert.equal((await f.owner.call(path + '/assist', 'POST', body)).data.code, code);
      assert.equal((await f.owner.call(path + '/assist', 'POST', body)).data.code, code);
      assert.equal(calls, 1);
      assert.equal((await f.owner.call(path + '/proposals')).data.usage.projectCalls, 1);
    } finally {
      await f.close();
    }
  }
});

test('proposal apply observes existing CAD/history capacity instead of bypassing manual save limits', async () => {
  const f = await fixture({ apiKey: 'fictional', fetch: async () => answer(proposal()) });
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}`,
      result = await f.owner.call(path + '/cad/assist', 'POST', request(p.version));
    for (let i = 3; i <= 100; i++)
      f.store.run(
        "INSERT INTO studio_revisions(project_id,version,brief,source,created_at) VALUES(?,?,?,'manual',?)",
        p.id,
        i,
        canonicalJSON(brief()),
        Date.now(),
      );
    const response = await f.owner.call(
      `${path}/cad/proposals/${result.data.proposals[0].id}/apply`,
      'POST',
      { version: p.version, reviewed: true },
    );
    assert.equal(response.data.code, 'STUDIO_REVISION_LIMIT');
    assert.equal(f.store.get<{ n: number }>('SELECT count(*) n FROM studio_cad_revisions')!.n, 0);
    assert.equal(
      (await f.owner.call(path + '/cad/proposals')).data.proposals[0].applied_version,
      null,
    );
  } finally {
    await f.close();
  }
});

test('v3 CAD history migrates additively to v4 and existing AI usage defaults to brief', async () => {
  const f = await fixture();
  try {
    const p = await create(f.owner),
      path = `/studio/projects/${p.id}`;
    assert.equal(
      (
        await f.owner.call(path + '/cad', 'PUT', {
          version: p.version,
          spec: sampleCadSpec('plate'),
        })
      ).status,
      200,
    );
    f.store.run(
      "INSERT INTO studio_ai_runs(id,owner_id,project_id,request_id,request_hash,input_version,model,quality,status,created_at,input_tokens) VALUES(?,?,?,?,?,?,'legacy','standard','complete',?,15)",
      randomUUID(),
      f.owner.id,
      p.id,
      randomUUID(),
      digest('legacy'),
      p.version,
      Date.now(),
    );
    f.store.db.exec(
      'DROP TABLE studio_cad_proposals; DROP TRIGGER studio_ai_task_immutable; ALTER TABLE studio_ai_runs DROP COLUMN task; PRAGMA user_version=3;',
    );
    const migrated = new Store(f.store.path);
    try {
      assert.equal(migrated.get<{ user_version: number }>('PRAGMA user_version')!.user_version, 4);
      assert.equal(
        migrated.get<{ task: string }>('SELECT task FROM studio_ai_runs')!.task,
        'brief',
      );
      assert.equal(
        migrated.get<{ n: number }>('SELECT count(*) n FROM studio_cad_revisions')!.n,
        1,
      );
      assert.equal(
        migrated.get<{ n: number }>('SELECT sum(input_tokens) n FROM studio_ai_runs')!.n,
        15,
      );
      assert.deepEqual(migrated.all('PRAGMA foreign_key_check'), []);
    } finally {
      migrated.close();
    }
  } finally {
    await f.close();
  }
});

test('AI output/token caps and serialized input are bounded without relying on provider trust', () => {
  const ai = resolveStudioAIConfig({ reviewModel: 'configured-review', cadMaxOutputTokens: 50000 });
  assert.equal(ai.cadModel, 'configured-review');
  assert.equal(ai.cadMaxOutputTokens, 16000);
  assert.equal(resolveStudioAIConfig({}).cadMaxOutputTokens, 8000);
  assert.equal(resolveStudioAIConfig({}).maxOutputTokens, 3000);
  assert.throws(
    () =>
      cadAIInput({
        idea: 'x'.repeat(120001),
        brief: brief(),
        language: 'en',
        spec: null,
        message: 'test',
      }),
    /too long/,
  );
  assert.equal(cadProposalProviderSchema().type, 'object');
});

test(
  'reviewed AI proposal builds with actual CadQuery and preserves the exact applied specification in its artifacts',
  { skip: !process.env.CAD_PYTHON },
  async () => {
    const f = await fixture(
      { apiKey: 'fictional', fetch: async () => answer(proposal()) },
      { python: process.env.CAD_PYTHON },
    );
    try {
      const p = await create(f.owner),
        path = `/studio/projects/${p.id}`,
        result = await f.owner.call(path + '/cad/assist', 'POST', request(p.version));
      const applied = await f.owner.call(
        `${path}/cad/proposals/${result.data.proposals[0].id}/apply`,
        'POST',
        { version: p.version, reviewed: true },
      );
      assert.equal(applied.status, 200);
      const built = await f.owner.call(path + '/cad/build', 'POST', {
        version: applied.data.project.version,
        requestId: randomUUID(),
      });
      assert.equal(built.status, 202);
      let state = (await f.owner.call(path + '/cad')).data;
      for (let i = 0; i < 600 && !['succeeded', 'failed'].includes(state.builds[0].status); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        state = (await f.owner.call(path + '/cad')).data;
      }
      assert.equal(state.builds[0].status, 'succeeded', JSON.stringify(state.builds[0]));
      const specFile = await f.owner.call(
        `${path}/cad/builds/${built.data.build.id}/artifacts/spec.json`,
      );
      assert.deepEqual(specFile.data, applied.data.cad.revision.spec);
      assert.equal(state.builds[0].report.verification_scope, 'geometry_only');
      assert.ok(
        state.builds[0].report.warnings.includes('Open question: Which material is suitable?'),
      );
      assert.ok(
        Math.abs(state.builds[0].report.volume_mm3 - (80 * 50 * 6 - 2 * Math.PI * 2.5 * 2.5 * 6)) <
          0.01,
      );
      assert.equal((await f.owner.call(path)).data.project.confirmed_version, null);
      assert.equal(
        (await f.owner.call(path + '/confirm', 'POST', { version: applied.data.project.version }))
          .status,
        200,
      );
      const packet = (await f.owner.call(path + '/packet')).data;
      assert.equal(packet.cad.spec_sha256, digest(canonicalJSON(applied.data.cad.revision.spec)));
      assert.equal(packet.cad.build_id, built.data.build.id);
      assert.ok(
        packet.manifest.some(
          (file: any) =>
            file.path === 'cad/spec.json' &&
            file.sha256 === specFile.headers.get('X-Content-SHA256'),
        ),
      );
    } finally {
      await f.close();
    }
  },
);
