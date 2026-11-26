import { Router } from 'express';
import { z } from 'zod';
import type { NetworkWorkshop, WorkshopFeed, WorkshopNode } from '../shared/network.js';
import type { Store } from './database.js';

const maxWorkshops = 250;
const maxBytes = 512 * 1024;
const feedSchema = z.object({
  version: z.literal(1),
  truncated: z.boolean(),
  workshops: z
    .array(
      z
        .object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(100),
          city: z.string().trim().min(1).max(80),
          technologies: z.array(z.string().trim().min(1).max(32)).max(40),
          lat: z.number().min(-90).max(90).nullable(),
          lng: z.number().min(-180).max(180).nullable(),
        })
        .refine((p) => (p.lat === null) === (p.lng === null)),
    )
    .max(maxWorkshops),
});

export function configuredPeers(config: string, ownOrigin: string) {
  const origins = new Set<string>();
  for (const entry of config
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const url = new URL(entry);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.href !== url.origin + '/'
    ) {
      throw new Error('OPENPRINT_PEERS requires plain HTTPS origins (HTTP is allowed on loopback)');
    }
    if (url.origin !== ownOrigin) origins.add(url.origin);
  }
  if (origins.size > 12) throw new Error('OPENPRINT_PEERS supports at most 12 peer origins');
  return [...origins];
}

function localFeed(store: Store, advertise: boolean): WorkshopFeed {
  const rows = advertise
    ? store.all<Omit<NetworkWorkshop, 'technologies'> & { technologies: string }>(
        `SELECT p.id,p.name,p.city,p.technologies,p.lat,p.lng FROM profiles p JOIN users u ON u.id=p.user_id
     WHERE p.network_listed=1 AND p.published=1 AND p.demo=0 AND u.suspended=0 ORDER BY p.id LIMIT ?`,
        maxWorkshops + 1,
      )
    : [];
  return {
    version: 1,
    workshops: rows
      .slice(0, maxWorkshops)
      .map((row) => ({ ...row, technologies: JSON.parse(row.technologies) })),
    truncated: rows.length > maxWorkshops,
  };
}

async function peerNode(origin: string): Promise<WorkshopNode> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 4000);
  try {
    // Only a fixed path on an operator-configured origin. Never forward a visitor's headers.
    const response = await fetch(origin + '/api/directory/node', {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: abort.signal,
    });
    if (
      !response.ok ||
      !response.body ||
      !response.headers.get('content-type')?.startsWith('application/json')
    )
      throw new Error('Peer feed unavailable');
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > maxBytes) throw new Error('Peer feed exceeds size limit');
      chunks.push(chunk.value);
    }
    const feed = feedSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (new Set(feed.workshops.map((p) => p.id)).size !== feed.workshops.length)
      throw new Error('Duplicate workshop ID');
    return { origin, available: true, truncated: feed.truncated, workshops: feed.workshops };
  } catch {
    return { origin, available: false, truncated: false, workshops: [] };
  } finally {
    abort.abort();
    clearTimeout(timer);
  }
}

export function createNetworkRouter(
  store: Store,
  origin: string,
  peers: string,
  advertise: boolean,
) {
  const router = Router();
  const origins = configuredPeers(peers, origin);
  let cached: Promise<WorkshopNode[]> | undefined;
  let expires = 0;

  router.get('/node', (_req, res) => res.json(localFeed(store, advertise)));
  router.get('/network', async (_req, res) => {
    if (!cached || Date.now() >= expires) {
      expires = Date.now() + 30_000;
      cached = Promise.all(origins.map(peerNode));
    }
    const peers = await cached;
    const local = localFeed(store, advertise);
    res.json({
      nodes: [
        { origin, available: true, truncated: local.truncated, workshops: local.workshops },
        ...peers,
      ],
    });
  });
  return router;
}
