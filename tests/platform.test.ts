import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../server/database.js';
import { createApp } from '../server/app.js';
import { digest } from '../server/security.js';
import { cleanupFiles } from '../server/files.js';
import { backupCommunity } from '../scripts/backup.js';
import type { AddressInfo } from 'node:net';

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'openprint-test-')),
    store = new Store(join(dir, 'openprint.sqlite'));
  const server = createApp({
    store,
    dataDir: dir,
    appUrl: 'http://test.local',
    userLimit: 1024 * 1024,
    totalLimit: 3 * 1024 * 1024,
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  function client() {
    let cookie = '';
    return {
      async call(
        path: string,
        method = 'GET',
        body?: unknown,
        origin = 'http://test.local',
        extra: Record<string, string> = {},
      ) {
        const raw = body instanceof Buffer;
        const response = await fetch(base + '/api' + path, {
          method,
          headers: {
            Origin: origin,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body
              ? { 'Content-Type': raw ? 'application/octet-stream' : 'application/json' }
              : {}),
            ...extra,
          },
          body: body ? (raw ? (body as Buffer) : JSON.stringify(body)) : undefined,
        });
        for (const value of response.headers.getSetCookie()) {
          const match = value.match(/openprint_session=([a-f0-9]{64})/);
          if (match) cookie = `openprint_session=${match[1]}`;
        }
        const content = response.headers.get('content-type') || '';
        return {
          status: response.status,
          data: content.includes('application/json')
            ? await response.json()
            : await response.arrayBuffer(),
          headers: response.headers,
        };
      },
      cookie: () => cookie,
    };
  }
  const customer = client(),
    provider = client(),
    other = client(),
    guest = client();
  for (const [c, name] of [
    [customer, 'Customer'],
    [provider, 'Workshop'],
    [other, 'Other workshop'],
  ] as const)
    assert.equal(
      (
        await c.call('/auth/register', 'POST', {
          name,
          email: name.replaceAll(' ', '') + '@test.example',
          password: 'test-only-passphrase-123',
        })
      ).status,
      201,
    );
  for (const c of [provider, other])
    assert.equal(
      (
        await c.call('/profile', 'PUT', {
          name: c === provider ? 'Test workshop' : 'Other workshop',
          kind: 'both',
          city: 'Test city',
          description: 'A fictional workshop for an isolated integration test.',
          technologies: ['FDM', 'CAD'],
          materials: ['PLA', 'Any'],
          website: '',
          remote: true,
        })
      ).status,
      200,
    );
  const createJob = async (
    visibility = 'public',
    target_profile_id: string | null = null,
    file_id: string | null = null,
  ) => {
    const result = await customer.call('/projects', 'POST', {
      title: 'A test enclosure',
      description: 'Print a 70 by 45 by 20 mm enclosure, with a removable lid and USB opening.',
      kind: 'print',
      city: 'Test city',
      technology: 'FDM',
      material: 'PLA',
      quantity: 2,
      currency: 'EUR',
      budget: 5000,
      deadline: '',
      visibility,
      target_profile_id,
      file_id,
    });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data.id as string;
  };
  const dispose = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  };
  return { dir, store, server, customer, provider, other, guest, createJob, dispose };
}

test('real sessions, server roles, logout, CSRF and JSON enforcement', async () => {
  const f = await fixture();
  try {
    const me = await f.customer.call('/bootstrap');
    assert.equal(me.data.user.name, 'Customer');
    assert.equal(me.data.user.role, 'member');
    assert.equal((await f.customer.call('/admin')).status, 403);
    assert.equal((await f.guest.call('/projects', 'POST', {})).status, 401);
    assert.equal(
      (await f.customer.call('/auth/logout', 'POST', {}, 'https://evil.example')).status,
      403,
    );
    const token = f.customer.cookie().split('=')[1];
    assert.ok(!f.store.get('SELECT 1 FROM sessions WHERE token_hash=?', token));
    assert.ok(f.store.get('SELECT 1 FROM sessions WHERE token_hash=?', digest(token)));
    assert.equal((await f.customer.call('/auth/logout', 'POST', {})).status, 200);
    assert.equal((await f.customer.call('/dashboard')).status, 401);
    assert.equal(
      (await f.guest.call('/auth/demo', 'POST', { user_id: me.data.user.id })).status,
      404,
    );
  } finally {
    await f.dispose();
  }
});

test('directory and project search match Cyrillic city names regardless of case', async () => {
  const f = await fixture();
  try {
    const profile = (await f.provider.call('/bootstrap')).data.profile;
    f.store.run('UPDATE profiles SET city=? WHERE id=?', 'Москва', profile.id);
    const makers = await f.guest.call('/profiles?q=' + encodeURIComponent('мОСкВА'));
    assert.equal(makers.data.profiles.length, 1);
    assert.equal(makers.data.profiles[0].id, profile.id);
    const job = await f.createJob();
    f.store.run('UPDATE jobs SET city=? WHERE id=?', 'Казань', job);
    const projects = await f.guest.call('/projects?city=' + encodeURIComponent('кАЗАНЬ'));
    assert.equal(projects.data.projects[0].id, job);
  } finally {
    await f.dispose();
  }
});

test('immutable offer revisions reject stale acceptance and preserve one exact agreement', async () => {
  const f = await fixture();
  try {
    const job = await f.createJob();
    const first = (
      await f.provider.call(`/projects/${job}/offers`, 'POST', {
        price: 3500,
        days: 3,
        note: 'Two enclosures, shipping excluded.',
      })
    ).data.offer;
    const second = (
      await f.provider.call(`/projects/${job}/offers`, 'POST', {
        price: 4200,
        days: 4,
        note: 'Two enclosures including a tolerance test.',
      })
    ).data.offer;
    const rival = (
      await f.other.call(`/projects/${job}/offers`, 'POST', {
        price: 4000,
        days: 5,
        note: 'Two parts and basic post processing.',
      })
    ).data.offer;
    assert.equal(second.revision, 2);
    assert.throws(
      () => f.store.run('UPDATE offers SET price=? WHERE id=?', 9999, first.id),
      /immutable/,
    );
    const stale = await f.customer.call(`/projects/${job}/accept`, 'POST', {
      offer_id: first.id,
      revision: 1,
      version: 1,
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.code, 'OFFER_STALE');
    assert.equal(
      (
        await f.other.call(`/projects/${job}/accept`, 'POST', {
          offer_id: second.id,
          revision: 2,
          version: 1,
        })
      ).status,
      403,
    );
    const accepted = await f.customer.call(`/projects/${job}/accept`, 'POST', {
      offer_id: second.id,
      revision: 2,
      version: 1,
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.terms.price, 4200);
    assert.equal(accepted.data.terms.currency, 'EUR');
    assert.equal(
      (
        await f.customer.call(`/projects/${job}/accept`, 'POST', {
          offer_id: rival.id,
          revision: 1,
          version: 1,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.provider.call(`/projects/${job}/offers`, 'POST', {
          price: 9999,
          days: 1,
          note: 'A late invalid revision',
        })
      ).status,
      409,
    );
    assert.throws(
      () => f.store.run('UPDATE jobs SET accepted_terms=? WHERE id=?', '{}', job),
      /immutable/,
    );
    const detail = (await f.customer.call(`/projects/${job}`)).data;
    assert.equal(detail.job.accepted_terms.price, 4200);
    assert.equal(detail.job.status, 'assigned');
    const publicDetail = (await f.guest.call(`/projects/${job}`)).data;
    assert.equal(publicDetail.job.accepted_terms, null);
    assert.deepEqual(publicDetail.offers, []);
  } finally {
    await f.dispose();
  }
});

test('concurrent acceptance produces one winner and one conflict', async () => {
  const f = await fixture();
  try {
    const job = await f.createJob();
    const offers = [];
    for (const client of [f.provider, f.other])
      offers.push(
        (
          await client.call(`/projects/${job}/offers`, 'POST', {
            price: 2000,
            days: 2,
            note: 'A small test order with agreed dimensions.',
          })
        ).data.offer,
      );
    const responses = await Promise.all(
      offers.map((offer) =>
        f.customer.call(`/projects/${job}/accept`, 'POST', {
          offer_id: offer.id,
          revision: 1,
          version: 1,
        }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      f.store.get<{ n: number }>(
        "SELECT count(*) AS n FROM offers WHERE job_id=? AND status='accepted'",
        job,
      )!.n,
      1,
    );
  } finally {
    await f.dispose();
  }
});

test('private briefs, attachments, selected-provider access and two-party completion', async () => {
  const f = await fixture();
  try {
    const uploaded = await f.customer.call(
      '/files',
      'POST',
      Buffer.from(
        'solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test',
      ),
      undefined,
      { 'X-File-Name': 'model.stl' },
    );
    assert.equal(uploaded.status, 201);
    const file = uploaded.data.file.id,
      profile = (await f.provider.call('/bootstrap')).data.profile;
    const job = await f.createJob('direct', profile.id, file);
    assert.equal((await f.guest.call(`/projects/${job}`)).status, 404);
    assert.equal((await f.other.call(`/projects/${job}`)).status, 404);
    assert.equal((await f.provider.call(`/files/${file}`)).status, 404);
    const offer = (
      await f.provider.call(`/projects/${job}/offers`, 'POST', {
        price: 1000,
        days: 1,
        note: 'Private part with delivery after confirmation.',
      })
    ).data.offer;
    assert.equal(
      (
        await f.other.call(`/projects/${job}/offers`, 'POST', {
          price: 1000,
          days: 1,
          note: 'Should never be accepted.',
        })
      ).status,
      404,
    );
    await f.customer.call(`/projects/${job}/accept`, 'POST', {
      offer_id: offer.id,
      revision: 1,
      version: 1,
    });
    assert.equal((await f.provider.call(`/files/${file}`)).status, 200);
    assert.equal((await f.other.call(`/files/${file}`)).status, 404);
    assert.equal(
      (await f.provider.call(`/projects/${job}/status`, 'POST', { action: 'complete' })).status,
      409,
    );
    assert.equal(
      (await f.customer.call(`/projects/${job}/status`, 'POST', { action: 'complete' })).status,
      409,
    );
    assert.equal(
      (await f.provider.call(`/projects/${job}/status`, 'POST', { action: 'deliver' })).status,
      200,
    );
    assert.equal(
      (await f.customer.call(`/projects/${job}/status`, 'POST', { action: 'complete' })).status,
      200,
    );
  } finally {
    await f.dispose();
  }
});

test('messages paginate beyond 500 and read cursors never mark unseen future messages', async () => {
  const f = await fixture();
  try {
    const job = await f.createJob(),
      offer = (
        await f.provider.call(`/projects/${job}/offers`, 'POST', {
          price: 1000,
          days: 1,
          note: 'A proposal to create a conversation.',
        })
      ).data.offer;
    for (let i = 0; i < 512; i++)
      f.store.run(
        'INSERT INTO messages(conversation_id,author_id,body,created_at) VALUES(?,?,?,?)',
        offer.conversation_id,
        offer.provider_id,
        `Message ${i}`,
        Date.now(),
      );
    assert.equal(
      (await f.other.call(`/conversations/${offer.conversation_id}/messages`)).status,
      404,
    );
    const latest = (await f.customer.call(`/conversations/${offer.conversation_id}/messages`)).data;
    assert.equal(latest.messages.length, 50);
    assert.equal(latest.messages.at(-1).body, 'Message 511');
    assert.equal(latest.has_more, true);
    const older = (
      await f.customer.call(
        `/conversations/${offer.conversation_id}/messages?before=${latest.messages[0].id}`,
      )
    ).data;
    assert.equal(older.messages.at(-1).body, 'Message 461');
    const cursor = latest.messages.at(-2).id;
    assert.equal(
      (
        await f.customer.call(`/conversations/${offer.conversation_id}/read`, 'POST', {
          through: cursor,
        })
      ).status,
      200,
    );
    const dashboard = (await f.customer.call('/dashboard')).data;
    assert.equal(dashboard.conversations[0].unread, 1);
    await f.customer.call('/blocks', 'POST', { user_id: offer.provider_id, blocked: true });
    assert.equal(
      (
        await f.provider.call(`/conversations/${offer.conversation_id}/messages`, 'POST', {
          body: 'blocked message',
        })
      ).status,
      403,
    );
  } finally {
    await f.dispose();
  }
});

test('model publication requires explicit rights and moderator approval', async () => {
  const f = await fixture();
  try {
    const up = await f.provider.call(
      '/files',
      'POST',
      Buffer.from('ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;'),
      undefined,
      { 'X-File-Name': 'part.step' },
    );
    assert.equal(up.status, 201);
    const model = {
      title: 'Original test model',
      description: 'An original design, published for reuse with attribution.',
      category: 'parts',
      license: 'CC-BY-4.0',
      attribution: 'Test maker',
      file_id: up.data.file.id,
      rights: true,
    };
    assert.equal((await f.other.call('/models', 'POST', model)).status, 400);
    const created = await f.provider.call('/models', 'POST', model);
    assert.equal(created.status, 201);
    assert.equal((await f.guest.call('/models')).data.models.length, 0);
    assert.equal((await f.guest.call(`/files/${up.data.file.id}`)).status, 404);
    const user = (await f.customer.call('/bootstrap')).data.user;
    f.store.run("UPDATE users SET role='admin' WHERE id=?", user.id);
    assert.equal(
      (await f.customer.call(`/admin/models/${created.data.id}`, 'POST', { published: true }))
        .status,
      200,
    );
    assert.equal((await f.guest.call('/models')).data.models[0].license, 'CC-BY-4.0');
    assert.equal((await f.guest.call(`/files/${up.data.file.id}`)).status, 200);
  } finally {
    await f.dispose();
  }
});

test('one-use recovery tokens revoke old sessions and cannot be replayed', async () => {
  const f = await fixture();
  try {
    const user = (await f.customer.call('/bootstrap')).data.user,
      token = 'ab'.repeat(32);
    f.store.run(
      'INSERT INTO reset_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)',
      digest(token),
      user.id,
      Date.now() + 60000,
    );
    assert.equal(
      (
        await f.guest.call('/auth/recover', 'POST', {
          token,
          password: 'a-new-test-passphrase-123',
        })
      ).status,
      200,
    );
    assert.equal((await f.customer.call('/dashboard')).status, 401);
    assert.equal(
      (await f.guest.call('/auth/recover', 'POST', { token, password: 'another-test-passphrase' }))
        .status,
      400,
    );
  } finally {
    await f.dispose();
  }
});

test('moderation removes a project without exposing a private brief to an unrelated profile', async () => {
  const f = await fixture();
  try {
    const job = await f.createJob();
    await f.provider.call('/reports', 'POST', {
      kind: 'job',
      target_id: job,
      reason: 'Test report with sufficient detail.',
    });
    const admin = (await f.customer.call('/bootstrap')).data.user;
    f.store.run("UPDATE users SET role='admin' WHERE id=?", admin.id);
    const report = (await f.customer.call('/admin')).data.reports[0];
    assert.equal(
      (
        await f.customer.call(`/admin/reports/${report.id}`, 'POST', {
          resolution: 'Removed after moderation review.',
          hide: true,
        })
      ).status,
      200,
    );
    assert.equal((await f.guest.call(`/projects/${job}`)).status, 404);
    assert.equal((await f.provider.call(`/projects/${job}`)).status, 404);
    assert.equal((await f.customer.call(`/projects/${job}`)).status, 200);
    assert.equal((await f.guest.call('/projects')).data.projects.length, 0);
  } finally {
    await f.dispose();
  }
});

test('administrator promotion happens only when a CLI-issued token is redeemed, revoking old sessions', async () => {
  const f = await fixture();
  try {
    const user = (await f.customer.call('/bootstrap')).data.user,
      token = 'cd'.repeat(32);
    f.store.run(
      'INSERT INTO reset_tokens(token_hash,user_id,expires_at,promote_admin) VALUES(?,?,?,1)',
      digest(token),
      user.id,
      Date.now() + 60000,
    );
    assert.equal((await f.customer.call('/bootstrap')).data.user.role, 'member');
    assert.equal((await f.customer.call('/admin')).status, 403);
    assert.equal(
      (
        await f.guest.call('/auth/recover', 'POST', {
          token,
          password: 'admin-test-only-passphrase',
        })
      ).status,
      200,
    );
    assert.equal((await f.customer.call('/dashboard')).status, 401);
    assert.equal((await f.guest.call('/bootstrap')).data.user.role, 'admin');
    assert.equal((await f.guest.call('/admin')).status, 200);
  } finally {
    await f.dispose();
  }
});

test('account removal rejects active agreements and anonymizes completed history while revoking sessions', async () => {
  const f = await fixture();
  try {
    const job = await f.createJob(),
      offer = (
        await f.provider.call(`/projects/${job}/offers`, 'POST', {
          price: 1000,
          days: 1,
          note: 'A small project with retained agreed terms.',
        })
      ).data.offer;
    await f.customer.call(`/projects/${job}/accept`, 'POST', {
      offer_id: offer.id,
      revision: 1,
      version: 1,
    });
    assert.equal(
      (
        await f.customer.call('/account', 'DELETE', {
          password: 'test-only-passphrase-123',
          confirm: 'DELETE',
        })
      ).status,
      409,
    );
    await f.provider.call(`/projects/${job}/status`, 'POST', { action: 'deliver' });
    await f.customer.call(`/projects/${job}/status`, 'POST', { action: 'complete' });
    const user = (await f.customer.call('/bootstrap')).data.user;
    assert.equal(
      (
        await f.customer.call('/account', 'DELETE', {
          password: 'test-only-passphrase-123',
          confirm: 'DELETE',
        })
      ).status,
      200,
    );
    assert.equal((await f.customer.call('/dashboard')).status, 401);
    const row = f.store.get<{ email: string; name: string; suspended: number }>(
      'SELECT email,name,suspended FROM users WHERE id=?',
      user.id,
    )!;
    assert.equal(row.suspended, 1);
    assert.ok(row.email.endsWith('@deleted.invalid'));
    assert.equal(row.name, 'Deleted participant');
    const history = (await f.provider.call(`/projects/${job}`)).data.job;
    assert.equal(history.title, 'Archived project');
    assert.equal(history.accepted_terms.price, 1000);
  } finally {
    await f.dispose();
  }
});

test('file validation, quotas, ownership, cleanup, backup and restore', async () => {
  const f = await fixture();
  let disposed = false;
  const backup = mkdtempSync(join(tmpdir(), 'openprint-backup-'));
  const destination = join(backup, 'snapshot');
  try {
    assert.equal(
      (
        await f.customer.call(
          '/files',
          'POST',
          Buffer.from('<script>alert(1)</script>'),
          undefined,
          { 'X-File-Name': 'fake.stl' },
        )
      ).status,
      400,
    );
    const data = Buffer.from('ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;');
    const up = (
      await f.customer.call('/files', 'POST', data, undefined, { 'X-File-Name': 'part.step' })
    ).data.file;
    const row = f.store.get<{ storage_name: string }>(
      'SELECT storage_name FROM files WHERE id=?',
      up.id,
    )!;
    await f.createJob('public', null, up.id);
    f.store.run('UPDATE files SET created_at=? WHERE id=?', Date.now() - 2 * 86400000, up.id);
    assert.equal(cleanupFiles(f.store, f.dir), 0);
    const exported = (await f.customer.call('/account/export')).data;
    assert.ok(!JSON.stringify(exported).includes('password_hash'));
    assert.equal(exported.files.length, 1);
    await new Promise<void>((resolve) => f.server.close(() => resolve()));
    f.store.close();
    disposed = true;
    const result = backupCommunity(f.dir, destination);
    assert.equal(result.files, 1);
    const restored = new Store(join(destination, 'openprint.sqlite'));
    assert.equal(restored.get<{ n: number }>('SELECT count(*) AS n FROM jobs')!.n, 1);
    restored.close();
    assert.deepEqual(readFileSync(join(destination, 'uploads', row.storage_name)), data);
    writeFileSync(join(f.dir, 'uploads', row.storage_name), 'corrupted');
    assert.throws(() => backupCommunity(f.dir, join(backup, 'corrupt')), /corrupted/);
  } finally {
    if (!disposed) await f.dispose();
    else rmSync(f.dir, { recursive: true, force: true });
    rmSync(backup, { recursive: true, force: true });
  }
});
