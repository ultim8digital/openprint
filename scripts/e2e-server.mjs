import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = mkdtempSync(join(tmpdir(), 'openprint-e2e-'));
if (process.env.E2E_DIRECTORY_FIXTURE === '1') {
  // Synthetic operator-imported records only; never read the operator's real catalogue.
  const { Store } = await import('../build/server/database.js');
  const { parseCatalogImport, importCatalog } = await import('../build/server/directory.js');
  const store = new Store(join(dir, 'openprint.sqlite'));
  try {
    importCatalog(
      store,
      parseCatalogImport(
        Array.from({ length: 14 }, (_, i) => ({
          id: `fixture-${i + 1}`,
          name: `Fixture Catalog ${String(i + 1).padStart(2, '0')}`,
          city: 'Fixture City',
          region: 'Fixture Region',
          country: 'ZZ',
          description: 'Synthetic catalogue fixture for browser tests.',
          lat: i === 13 ? null : i === 0 ? 0 : i === 12 ? 89 : 11 + i,
          lng: i === 13 ? null : i === 0 ? 0 : 21 + i,
          technologies: [i === 1 ? 'CNC' : 'FDM'],
          materials: ['PLA'],
          website: 'https://studio.example.org',
          phone: '+15550100000',
          address: 'Example address',
        })),
        {
          sourceKey: 'e2e-fixture',
          sourceName: 'E2E fixture',
          sourceUrl: 'https://catalog.example.org',
        },
      ),
    );
  } finally {
    store.close();
  }
}
const child = spawn(process.execPath, ['build/server/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    DEMO_MODE: '1',
    DATA_DIR: dir,
    HOST: '127.0.0.1',
    PORT: '3012',
    APP_URL: 'http://127.0.0.1:3012',
    TRUST_PROXY: '0',
    // Browser tests must never spend an operator's API balance.
    OPENAI_API_KEY: '',
  },
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  child.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(code || 0);
});
