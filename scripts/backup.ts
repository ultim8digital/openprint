import { existsSync, readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../server/database.js';
import { digest } from '../server/security.js';
import type { FileRow } from '../server/files.js';

export function backupCommunity(dataDir: string, destination: string) {
  dataDir = resolve(dataDir);
  destination = resolve(destination);
  if (!relative(dataDir, destination).startsWith('..'))
    throw new Error('Backup destination must be outside DATA_DIR');
  const lock = join(dataDir, 'server.pid');
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    if (pid !== process.pid)
      try {
        process.kill(pid, 0);
        throw new Error('Stop OpenPrint before taking a consistent database + files backup.');
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error;
      }
  }
  if (existsSync(destination))
    throw new Error('Destination already exists; choose a new directory');
  if (!existsSync(join(dataDir, 'openprint.sqlite'))) throw new Error('No database found');
  mkdirSync(join(destination, 'uploads'), { recursive: true, mode: 0o700 });
  const store = new Store(join(dataDir, 'openprint.sqlite'));
  try {
    store.run('VACUUM INTO ?', join(destination, 'openprint.sqlite'));
  } finally {
    store.close();
  }
  const snapshot = new Store(join(destination, 'openprint.sqlite'));
  try {
    const integrity = snapshot.get<{ integrity_check: string }>('PRAGMA integrity_check')!;
    if (integrity.integrity_check !== 'ok' || snapshot.all('PRAGMA foreign_key_check').length)
      throw new Error('Database integrity check failed');
    const files = snapshot.all<FileRow>('SELECT * FROM files');
    for (const file of files) {
      const source = join(dataDir, 'uploads', file.storage_name);
      if (!existsSync(source) || digest(readFileSync(source)) !== file.sha256)
        throw new Error(`Missing or corrupted upload: ${file.id}`);
      copyFileSync(source, join(destination, 'uploads', file.storage_name));
    }
    writeFileSync(
      join(destination, 'manifest.json'),
      JSON.stringify(
        {
          version: 1,
          created_at: new Date().toISOString(),
          files: files.map((f) => ({ name: f.storage_name, size: f.size, sha256: f.sha256 })),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    return { files: files.length, destination };
  } finally {
    snapshot.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const destination =
    process.argv[2] || `.local/backups/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  console.log(backupCommunity(process.env.DATA_DIR || '.local/data', destination));
}
