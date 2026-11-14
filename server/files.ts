import { existsSync, mkdirSync, unlinkSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Store } from './database.js';
import { ensure, digest } from './security.js';

export type FileRow = {
  id: string;
  owner_id: string;
  name: string;
  storage_name: string;
  size: number;
  sha256: string;
  created_at: number;
};
export const uploadDirectory = (dataDir: string) => join(resolve(dataDir), 'uploads');
export function validateModel(name: string, data: Buffer) {
  const ext = extname(name).toLowerCase();
  ensure(
    ['.stl', '.obj', '.step', '.stp', '.glb', '.3mf'].includes(ext),
    400,
    'FILE_TYPE',
    'Supported: STL, OBJ, STEP, GLB, 3MF',
  );
  ensure(
    data.length > 0 && data.length <= 20 * 1024 * 1024,
    400,
    'FILE_SIZE',
    'Maximum file size: 20 MB / Максимальный размер файла: 20 МБ',
  );
  const prefix = data.subarray(0, 4096).toString('utf8');
  if (ext === '.stl') {
    const binary =
      data.length >= 84 &&
      data.readUInt32LE(80) > 0 &&
      data.readUInt32LE(80) <= 500000 &&
      84 + data.readUInt32LE(80) * 50 === data.length;
    ensure(
      binary || /^\s*solid[\s\S]*facet\s+normal/i.test(prefix),
      400,
      'FILE_INVALID',
      'Invalid STL / Некорректный STL',
    );
  }
  if (ext === '.obj')
    ensure(
      /(^|\n)\s*v\s+-?[\d.]/.test(prefix) && !data.includes(0),
      400,
      'FILE_INVALID',
      'Invalid OBJ / Некорректный OBJ',
    );
  if (ext === '.glb')
    ensure(
      data.length >= 20 &&
        data.toString('ascii', 0, 4) === 'glTF' &&
        data.readUInt32LE(4) === 2 &&
        data.readUInt32LE(8) === data.length,
      400,
      'FILE_INVALID',
      'Invalid GLB',
    );
  if (ext === '.3mf')
    ensure(
      data.length > 4 && data[0] === 0x50 && data[1] === 0x4b,
      400,
      'FILE_INVALID',
      'Invalid 3MF',
    );
  if (ext === '.step' || ext === '.stp')
    ensure(/ISO-10303-21/i.test(prefix), 400, 'FILE_INVALID', 'Invalid STEP');
  return ext;
}
export function saveUpload(
  store: Store,
  dataDir: string,
  ownerId: string,
  originalName: string,
  data: Buffer,
  userLimit: number,
  totalLimit: number,
) {
  const name = originalName
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
    .slice(-160);
  const ext = validateModel(name, data);
  const id = randomUUID(),
    storageName = `${id}${ext}`;
  const dir = uploadDirectory(dataDir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return store.transaction(() => {
    const own =
      store.get<{ n: number }>(
        'SELECT COALESCE(sum(size),0) AS n FROM files WHERE owner_id=?',
        ownerId,
      )?.n ?? 0;
    const total = store.get<{ n: number }>('SELECT COALESCE(sum(size),0) AS n FROM files')?.n ?? 0;
    ensure(
      own + data.length <= userLimit && total + data.length <= totalLimit,
      413,
      'STORAGE_LIMIT',
      'Storage quota reached / Недостаточно места в хранилище',
    );
    const path = join(dir, storageName);
    try {
      writeFileSync(path, data, { flag: 'wx', mode: 0o600 });
      store.run(
        'INSERT INTO files(id,owner_id,name,storage_name,size,sha256,created_at) VALUES(?,?,?,?,?,?,?)',
        id,
        ownerId,
        name,
        storageName,
        data.length,
        digest(data),
        Date.now(),
      );
      return { id, name, size: data.length };
    } catch (error) {
      if (existsSync(path)) unlinkSync(path);
      throw error;
    }
  });
}
export function canReadFile(store: Store, file: FileRow, userId?: string) {
  if (file.owner_id === userId) return true;
  if (store.get('SELECT 1 FROM models WHERE file_id=? AND published=1', file.id)) return true;
  return !!(
    userId &&
    store.get(
      'SELECT 1 FROM jobs j JOIN offers f ON f.id=j.accepted_offer_id WHERE j.file_id=? AND f.provider_id=?',
      file.id,
      userId,
    )
  );
}
/** Referenced files never expire. Delete only unreferenced uploads older than 24h. */
export function cleanupFiles(store: Store, dataDir: string) {
  const dir = uploadDirectory(dataDir);
  const files = store.all<FileRow>(
    'SELECT f.* FROM files f WHERE f.created_at<? AND NOT EXISTS(SELECT 1 FROM jobs WHERE file_id=f.id) AND NOT EXISTS(SELECT 1 FROM models WHERE file_id=f.id)',
    Date.now() - 86400000,
  );
  let removed = 0;
  for (const file of files) {
    const path = join(dir, file.storage_name);
    if (existsSync(path)) unlinkSync(path);
    store.run('DELETE FROM files WHERE id=?', file.id);
    removed++;
  }
  if (existsSync(dir))
    for (const name of readdirSync(dir)) {
      if (!/^[a-f0-9-]{36}\.(stl|obj|step|stp|glb|3mf)$/.test(name)) continue;
      const path = join(dir, name);
      if (
        !store.get('SELECT 1 FROM files WHERE storage_name=?', name) &&
        statSync(path).mtimeMs < Date.now() - 86400000
      ) {
        unlinkSync(path);
        removed++;
      }
    }
  store.run('DELETE FROM sessions WHERE expires_at<?', Date.now());
  store.run('DELETE FROM reset_tokens WHERE expires_at<?', Date.now());
  return removed;
}
