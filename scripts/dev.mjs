import { spawn } from 'node:child_process';
const demo = process.argv.includes('--demo');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  ...(demo
    ? {
        DEMO_MODE: '1',
        DATA_DIR: '.local/demo',
        HOST: '127.0.0.1',
        APP_URL: 'http://localhost:3000',
        PORT: '3000',
        TRUST_PROXY: '0',
      }
    : {}),
};
const commands = [
  ['node', ['--import', 'tsx', '--watch', 'server/index.ts']],
  ['node', ['node_modules/vite/bin/vite.js']],
];
const processes = commands.map(([command, args]) =>
  spawn(command, args, { stdio: 'inherit', env }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1500).unref();
}
for (const child of processes) child.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
