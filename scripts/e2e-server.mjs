import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = mkdtempSync(join(tmpdir(), 'openprint-e2e-'));
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
