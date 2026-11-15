import { existsSync, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Store } from '../server/database.js';
import { CATALOG_MAX_FILE_BYTES, parseCatalogImport, importCatalog } from '../server/directory.js';

export function readCatalogFile(path: string): unknown {
  if (!isAbsolute(path)) throw new Error('--file must be an absolute path');
  const fd = openSync(path, 'r');
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > CATALOG_MAX_FILE_BYTES)
      throw new Error('Catalog input must be a regular file of at most 50 MiB');
    const chunks: Buffer[] = [],
      buffer = Buffer.alloc(65536);
    let bytes = 0;
    while (true) {
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      bytes += count;
      if (bytes > CATALOG_MAX_FILE_BYTES) throw new Error('Catalog input exceeds 50 MiB');
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    closeSync(fd);
  }
}
export function runCatalogImport(argv: string[], dataDir = process.env.DATA_DIR || '.local/data') {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      file: { type: 'string' },
      source: { type: 'string' },
      'source-name': { type: 'string' },
      'source-url': { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  if (!values.file || !values.source || !values['source-name'] || !values['source-url'])
    throw new Error(
      'Usage: catalog-import --file /absolute/catalog.json --source source-key --source-name Name --source-url https://source.example [--apply]',
    );
  const parsed = parseCatalogImport(readCatalogFile(values.file), {
    sourceKey: values.source,
    sourceName: values['source-name'],
    sourceUrl: values['source-url'],
  });
  const mappable = parsed.records.filter((row) => row.lat !== null).length;
  if (!values.apply)
    return {
      mode: 'dry-run',
      source: parsed.source.sourceKey,
      rows: parsed.records.length,
      mappable,
      unmapped: parsed.records.length - mappable,
      databaseChanged: false,
    };
  const store = new Store(join(resolve(dataDir), 'openprint.sqlite'));
  try {
    return { mode: 'applied', ...importCatalog(store, parsed), databaseChanged: true };
  } finally {
    store.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (existsSync('.env')) process.loadEnvFile('.env');
    console.log(JSON.stringify(runCatalogImport(process.argv.slice(2)), null, 2));
  } catch (error) {
    // Do not echo record values, original payloads or filesystem error paths.
    console.error(
      error instanceof Error && error.name === 'ZodError'
        ? 'Catalog validation failed. Check field types, lengths, coordinates and HTTP(S) URLs; no import was applied.'
        : error instanceof Error && error.message.startsWith('Usage:')
          ? error.message
          : 'Catalog import failed. Check the source file and options; no partial replacement was applied.',
    );
    process.exitCode = 1;
  }
}
