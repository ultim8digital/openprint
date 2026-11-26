import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { Store } from '../server/database.js';
import { configuredPeers, createNetworkRouter } from '../server/network.js';

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}
function addMaker(store: Store, name: string) {
  const id = randomUUID(),
    user = randomUUID();
  store.run(
    'INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,0)',
    user,
    user + '@example.test',
    name,
    'unused',
  );
  store.run(
    `INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,created_at)
    VALUES(?,?,?,'studio','Town','Local workshop','["FDM"]','["PLA"]',0)`,
    id,
    user,
    name,
  );
  return { id, user };
}

test('peer configuration deduplicates origins, ignores self and allows local testing', () => {
  const local = 'http://localhost:3000';
  assert.deepEqual(configuredPeers(local + ', https://B.example/,https://b.example', local), [
    'https://b.example',
  ]);
  for (const invalid of ['http://public.example', 'https://public.example/path', 'ftp://localhost'])
    assert.throws(() => configuredPeers(invalid, local));
});

test('discovery merges only opted-in home profiles, bounds peer failures and never republishes the aggregate', async (t) => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const first = addMaker(store, 'Home workshop');
  const hidden = addMaker(store, 'Hidden workshop');
  const demo = addMaker(store, 'Demo workshop');
  const suspended = addMaker(store, 'Suspended workshop');
  addMaker(store, 'Existing profile');
  store.run(
    'UPDATE profiles SET network_listed=1 WHERE id IN (?,?,?,?)',
    first.id,
    hidden.id,
    demo.id,
    suspended.id,
  );
  store.run('UPDATE profiles SET published=0 WHERE id=?', hidden.id);
  store.run('UPDATE profiles SET demo=1 WHERE id=?', demo.id);
  store.run('UPDATE users SET suspended=1 WHERE id=?', suspended.user);

  let reads = 0;
  const peer = createServer((req, res) => {
    reads++;
    assert.equal(req.url, '/api/directory/node');
    assert.equal(req.headers.cookie, undefined);
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        version: 1,
        truncated: false,
        workshops: [
          {
            id: first.id,
            name: 'Peer workshop',
            city: 'Other town',
            technologies: ['FDM'],
            lat: 0,
            lng: 0,
          },
        ],
      }),
    );
  });
  const down = createServer((_req, res) => {
    res.writeHead(503);
    res.end();
  });
  const app = express(),
    server = createServer(app);
  t.after(() =>
    Promise.all(
      [peer, down, server].map((s) => new Promise<void>((done) => s.close(() => done()))),
    ),
  );
  const [remote, offline, own] = await Promise.all([listen(peer), listen(down), listen(server)]);
  app.use('/api/directory', createNetworkRouter(store, own, remote + ',' + offline, true));
  app.use('/catalog', createNetworkRouter(store, own, '', false));
  const get = async (path: string) => (await fetch(own + path)).json();
  const [a, b] = await Promise.all([get('/api/directory/network'), get('/api/directory/network')]);
  assert.deepEqual(a, b);
  assert.equal(reads, 1);
  assert.deepEqual(
    a.nodes.map((n: { origin: string; available: boolean }) => [n.origin, n.available]),
    [
      [own, true],
      [remote, true],
      [offline, false],
    ],
  );
  assert.deepEqual(a.nodes[0].workshops, [
    {
      id: first.id,
      name: 'Home workshop',
      city: 'Town',
      technologies: ['FDM'],
      lat: null,
      lng: null,
    },
  ]);
  assert.equal(a.nodes[1].workshops[0].name, 'Peer workshop');
  assert.deepEqual((await get('/api/directory/node')).workshops, a.nodes[0].workshops);
  assert.deepEqual((await get('/catalog/node')).workshops, []);
  store.run('UPDATE profiles SET network_listed=0 WHERE id=?', first.id);
  assert.deepEqual((await get('/api/directory/node')).workshops, []);
});
