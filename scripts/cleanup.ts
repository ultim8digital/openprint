import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Store } from '../server/database.js';
import { cleanupFiles } from '../server/files.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const dataDir = resolve(process.env.DATA_DIR || '.local/data');
const store = new Store(join(dataDir, 'openprint.sqlite'));
console.log({ removed: cleanupFiles(store, dataDir) });
store.close();
