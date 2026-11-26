import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Store } from './database.js';
import { createApp } from './app.js';
import { seedDemo } from './demo.js';
import { cleanupFiles } from './files.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const host = process.env.HOST || '127.0.0.1',
  port = Number(process.env.PORT || 3000),
  appUrl = process.env.APP_URL || 'http://localhost:3000';
const dataDir = resolve(process.env.DATA_DIR || '.local/data'),
  demo = process.env.DEMO_MODE === '1';
const mode = process.env.APP_MODE || 'catalog';
if (mode !== 'catalog' && mode !== 'community')
  throw new Error('APP_MODE must be catalog or community');
const publicUrl = new URL(appUrl);
if (
  !['http:', 'https:'].includes(publicUrl.protocol) ||
  publicUrl.username ||
  publicUrl.password ||
  publicUrl.pathname !== '/' ||
  publicUrl.search ||
  publicUrl.hash
)
  throw new Error('APP_URL must be a plain HTTP(S) origin, e.g. https://makers.example.org');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
if (
  demo &&
  (!['127.0.0.1', '::1', 'localhost'].includes(host) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(appUrl).hostname) ||
    process.env.TRUST_PROXY === '1')
)
  throw new Error(
    'Demo mode requires loopback HOST and APP_URL and no proxy. Never expose it publicly.',
  );
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const lock = join(dataDir, 'server.pid');
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, 'utf8'));
  if (pid !== process.pid)
    try {
      process.kill(pid, 0);
      throw new Error(`Another OpenPrint process (${pid}) is using this DATA_DIR.`);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error;
    }
  unlinkSync(lock);
}
writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
const release = () => {
  try {
    if (readFileSync(lock, 'utf8') === String(process.pid)) unlinkSync(lock);
  } catch {}
};
process.on('exit', release);
const store = new Store(join(dataDir, 'openprint.sqlite'));
if (demo && mode === 'community') await seedDemo(store);
else if (!demo && store.get("SELECT 1 FROM meta WHERE key='demo'"))
  throw new Error('This is a demo database. Choose a clean DATA_DIR for a real community.');
const userLimit = Number(process.env.USER_STORAGE_MB || 200) * 1024 * 1024,
  totalLimit = Number(process.env.MAX_STORAGE_MB || 1024) * 1024 * 1024;
if (!Number.isFinite(userLimit) || !Number.isFinite(totalLimit) || userLimit < 1 || totalLimit < 1)
  throw new Error('Invalid storage quota');
const app = createApp({
  store,
  dataDir,
  appUrl,
  mode,
  networkPeers: process.env.OPENPRINT_PEERS,
  mapTiles: process.env.MAP_TILES !== 'off',
  demo,
  development: process.env.NODE_ENV === 'development',
  trustProxy: process.env.TRUST_PROXY === '1',
  userLimit,
  totalLimit,
  staticDir: existsSync('dist/index.html') ? 'dist' : undefined,
});
const server = app.listen(port, host, () =>
  console.log(`OpenPrint (${mode}) ${demo ? '(local demo storage)' : ''} → ${appUrl}`),
);
server.on('error', (error) => {
  console.error(error.message);
  store.close();
  release();
  process.exit(1);
});
const cleanup = setInterval(() => {
  try {
    if (mode === 'community') cleanupFiles(store, dataDir);
  } catch (error) {
    console.error('Upload cleanup failed', error instanceof Error ? error.message : '');
  }
}, 3600000);
cleanup.unref();
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, async () => {
    clearInterval(cleanup);
    await app.locals.cad.stop();
    server.close(() => {
      store.close();
      release();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
