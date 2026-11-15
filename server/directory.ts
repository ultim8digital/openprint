import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Store } from './database.js';
import { ensure } from './security.js';
import type { Profile } from '../shared/types.js';
import type {
  CatalogStudio,
  DirectoryResponse,
  DirectoryMapResponse,
} from '../shared/directory.js';

export const CATALOG_MAX_ROWS = 50000;
export const CATALOG_MAX_FILE_BYTES = 50 * 1024 * 1024;
const technologyAliases: Record<string, string> = {
  'FDM/FFF': 'FDM',
  'SLA/DLP/LCD': 'SLA',
  'SLM/DMLS (металл)': 'DMLS',
};
export const normalizeCatalogTechnology = (value: string) =>
  Object.hasOwn(technologyAliases, value) ? technologyAliases[value] : value;
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  text(max)
    .nullish()
    .transform((value) => value ?? '');
export function safeHttpURL(value: string) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !/[\u0000-\u0020\u007f<>"'\\]/u.test(value)
    );
  } catch {
    return false;
  }
}
const webURL = text(2048).refine(
  (value) => !value || safeHttpURL(value),
  'Use an HTTP(S) URL without credentials',
);
const sourceSchema = z
  .object({
    sourceKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$(?![\s\S])/),
    sourceName: text(120).min(1),
    sourceUrl: webURL,
  })
  .strict();
const importRecordSchema = z
  .object({
    id: text(200)
      .min(1)
      .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), 'Invalid source ID'),
    name: text(200).min(1),
    city: optionalText(120),
    region: optionalText(160),
    country: optionalText(80),
    description: optionalText(4000),
    technologies: z
      .array(text(100).min(1))
      .max(40)
      .nullish()
      .transform((items) => [...new Set((items ?? []).map(normalizeCatalogTechnology))]),
    materials: z
      .array(text(100).min(1))
      .max(50)
      .nullish()
      .transform((items) => [...new Set(items ?? [])]),
    website: webURL.nullish().transform((value) => value ?? ''),
    phone: optionalText(100),
    address: optionalText(500),
    lat: z
      .number()
      .finite()
      .min(-90)
      .max(90)
      .nullish()
      .transform((value) => value ?? null),
    lng: z
      .number()
      .finite()
      .min(-180)
      .max(180)
      .nullish()
      .transform((value) => value ?? null),
  })
  .refine((row) => (row.lat === null) === (row.lng === null), {
    message: 'Coordinates must be a numeric pair or both absent',
    path: ['lat'],
  });

export type CatalogImportSource = z.infer<typeof sourceSchema>;
export type ParsedCatalogImport = {
  source: CatalogImportSource;
  records: z.infer<typeof importRecordSchema>[];
};
/** All unknown record fields are stripped. No original payload is saved or logged. */
export function parseCatalogImport(raw: unknown, source: CatalogImportSource): ParsedCatalogImport {
  const parsedSource = sourceSchema.parse(source);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > CATALOG_MAX_ROWS)
    throw new Error('Catalog import requires between 1 and 50000 records');
  const records = z.array(importRecordSchema).min(1).max(CATALOG_MAX_ROWS).parse(raw);
  const ids = new Set<string>();
  for (const row of records) {
    if (ids.has(row.id)) throw new Error('Duplicate source record ID in catalog import');
    ids.add(row.id);
  }
  return { source: parsedSource, records };
}
/** RFC 4122 UUIDv5: public identity follows source namespace + source record ID, never display metadata. */
export function catalogPublicId(sourceKey: string, sourceId: string) {
  const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1')
    .update(namespace)
    .update(JSON.stringify(['openprint/catalog', sourceKey, sourceId]))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function importCatalog(store: Store, input: ParsedCatalogImport) {
  // Revalidate at the mutation boundary too, including callers that did not use the parser.
  const parsed = parseCatalogImport(input.records, input.source),
    now = Date.now();
  return store.transaction(() => {
    const replaced = store.get<{ n: number }>(
      'SELECT count(*) n FROM catalog_studios WHERE source_key=?',
      parsed.source.sourceKey,
    )!.n;
    // Importing a source must not introduce an active self-published duplicate either.
    for (const row of parsed.records)
      ensure(
        !store.get(
          `SELECT 1 FROM directory_submissions WHERE deleted_at IS NULL AND
        unicode_fold(name)=unicode_fold(?) AND unicode_fold(city)=unicode_fold(?) AND unicode_fold(address)=unicode_fold(?) LIMIT 1`,
          row.name,
          row.city,
          row.address,
        ),
        409,
        'DUPLICATE_STUDIO',
        'Import overlaps a self-published workshop / Импорт содержит уже добавленную мастерскую',
      );
    store.run('DELETE FROM catalog_studios WHERE source_key=?', parsed.source.sourceKey);
    const insert = store.db.prepare(
      `INSERT INTO catalog_studios(id,source_key,source_id,name,city,region,country,description,technologies,materials,website,phone,address,lat,lng,source_name,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const row of parsed.records)
      insert.run(
        catalogPublicId(parsed.source.sourceKey, row.id),
        parsed.source.sourceKey,
        row.id,
        row.name,
        row.city,
        row.region,
        row.country,
        row.description,
        JSON.stringify(row.technologies),
        JSON.stringify(row.materials),
        row.website,
        row.phone,
        row.address,
        row.lat,
        row.lng,
        parsed.source.sourceName,
        parsed.source.sourceUrl,
        now,
      );
    const mappable = parsed.records.filter((row) => row.lat !== null).length;
    return {
      source: parsed.source.sourceKey,
      imported: parsed.records.length,
      mappable,
      unmapped: parsed.records.length - mappable,
      replaced,
    };
  });
}

export type CatalogRow = Omit<CatalogStudio, 'technologies' | 'materials'> & {
  technologies: string;
  materials: string;
};
export function catalogObject(row: CatalogRow): CatalogStudio {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    region: row.region,
    country: row.country,
    description: row.description,
    technologies: JSON.parse(row.technologies),
    materials: JSON.parse(row.materials),
    website: row.website,
    phone: row.phone,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    source_name: row.source_name,
    source_url: row.source_url,
    imported_at: row.imported_at,
    listing_type: row.listing_type,
    version: row.version,
    updated_at: row.updated_at,
  };
}

/** Public projection shared by public detail and management responses; never selects key hashes. */
export function readCatalogStudio(store: Store, id: string): CatalogStudio | undefined {
  const row = store.get<CatalogRow>(
    `SELECT id,name,city,region,country,description,technologies,materials,
    website,phone,address,lat,lng,source_name,source_url,imported_at,
    'imported' listing_type,0 version,imported_at updated_at FROM catalog_studios WHERE id=?
    UNION ALL
    SELECT id,name,city,region,country,description,technologies,materials,website,phone,address,lat,lng,
    'Self-published / Добавлено самостоятельно','',created_at,'self-published',version,updated_at
    FROM directory_submissions WHERE id=? AND deleted_at IS NULL`,
    id,
    id,
  );
  return row ? catalogObject(row) : undefined;
}

type DirectoryRow = CatalogRow & {
  source: 'member' | 'catalog';
  user_id: string;
  kind: Profile['kind'];
  remote: number;
  verified: number;
  demo: number;
  created_at: number;
};
function memberObject(row: DirectoryRow): Profile {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    kind: row.kind,
    city: row.city,
    description: row.description,
    technologies: JSON.parse(row.technologies),
    materials: JSON.parse(row.materials),
    website: row.website,
    lat: row.lat,
    lng: row.lng,
    verified: !!row.verified,
    remote: !!row.remote,
    demo: !!row.demo,
  };
}
const querySchema = z.object({
  q: text(100).default(''),
  city: text(100).default(''),
  technology: text(100).default(''),
  kind: z.enum(['', 'studio', 'engineer', 'both']).default(''),
  verified: z.enum(['', '0', '1']).default('0'),
  source: z.enum(['all', 'member', 'catalog']).default('all'),
});
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(24),
  offset: z.coerce.number().int().min(0).max(10000000).default(0),
});
function directoryFilter(query: unknown, catalogOnly = false) {
  const q = querySchema.parse(query);
  const cte = `WITH directory AS (
    SELECT 'member' source,p.id,p.name,p.city,p.description,p.technologies,p.materials,p.website,p.lat,p.lng,
      p.user_id,p.kind,p.remote,p.verified,p.demo,p.created_at,
      '' region,'' country,'' phone,'' address,'' source_name,'' source_url,0 imported_at,
      'imported' listing_type,0 version,p.created_at updated_at
      FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.published=1 AND u.suspended=0 ${catalogOnly ? 'AND 1=0' : ''}
    UNION ALL
    SELECT 'catalog',c.id,c.name,c.city,c.description,c.technologies,c.materials,c.website,c.lat,c.lng,
      '', 'studio',0,0,0,c.imported_at,c.region,c.country,c.phone,c.address,c.source_name,c.source_url,c.imported_at,
      'imported',0,c.imported_at FROM catalog_studios c
    UNION ALL
    SELECT 'catalog',s.id,s.name,s.city,s.description,s.technologies,s.materials,s.website,s.lat,s.lng,
      '', 'studio',0,0,0,s.created_at,s.region,s.country,s.phone,s.address,
      'Self-published / Добавлено самостоятельно','',s.created_at,'self-published',s.version,s.updated_at
      FROM directory_submissions s WHERE s.deleted_at IS NULL
  ), filtered AS (SELECT * FROM directory WHERE
    (?='all' OR source=?) AND
    (?='' OR instr(unicode_fold(name),unicode_fold(?))>0 OR instr(unicode_fold(city),unicode_fold(?))>0 OR instr(unicode_fold(description),unicode_fold(?))>0) AND
    (?='' OR instr(unicode_fold(city),unicode_fold(?))>0) AND
    (?='' OR EXISTS(SELECT 1 FROM json_each(technologies) WHERE value=?)) AND
    (?='' OR kind=? OR (kind='both' AND ? IN ('studio','engineer'))) AND (?=0 OR verified=1)
  )`;
  return {
    cte,
    params: [
      q.source,
      q.source,
      q.q,
      q.q,
      q.q,
      q.q,
      q.city,
      q.city,
      q.technology,
      normalizeCatalogTechnology(q.technology),
      q.kind,
      q.kind,
      q.kind,
      q.verified === '1' ? 1 : 0,
    ],
  };
}
const mappableSQL =
  'lat IS NOT NULL AND lng IS NOT NULL AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180';
/** Keep counts and records consistent while an external import commits in WAL mode. */
function readSnapshot<T>(store: Store, read: () => T): T {
  store.db.exec('BEGIN');
  try {
    const result = read();
    store.db.exec('COMMIT');
    return result;
  } catch (error) {
    store.db.exec('ROLLBACK');
    throw error;
  }
}
export function createDirectoryRouter(store: Store, options: { catalogOnly?: boolean } = {}) {
  const router = Router();
  router.get('/directory', (req, res) => {
    const { cte, params } = directoryFilter(req.query, options.catalogOnly),
      page = pageSchema.parse(req.query);
    const response = readSnapshot(store, () => {
      const counts = store.get<{ total: number; members: number; catalog: number }>(
        `${cte}
      SELECT count(*) total,COALESCE(sum(CASE WHEN source='member' THEN 1 ELSE 0 END),0) members,
        COALESCE(sum(CASE WHEN source='catalog' THEN 1 ELSE 0 END),0) catalog FROM filtered`,
        ...params,
      )!;
      const rows = store.all<DirectoryRow>(
        `${cte} SELECT * FROM filtered
      ORDER BY verified DESC,source DESC,unicode_fold(name),id LIMIT ? OFFSET ?`,
        ...params,
        page.limit,
        page.offset,
      );
      return {
        ...counts,
        entries: rows.map((row) =>
          row.source === 'member'
            ? { source: 'member' as const, profile: memberObject(row) }
            : { source: 'catalog' as const, studio: catalogObject(row) },
        ),
        has_more: page.offset + rows.length < counts.total,
      } satisfies DirectoryResponse;
    });
    res.json(response);
  });
  router.get('/directory/map', (req, res) => {
    const { cte, params } = directoryFilter(req.query, options.catalogOnly);
    const response = readSnapshot(store, () => {
      const counts = store.get<{ total: number; mappable: number }>(
        `${cte} SELECT count(*) total,
      COALESCE(sum(CASE WHEN ${mappableSQL} THEN 1 ELSE 0 END),0) mappable FROM filtered`,
        ...params,
      )!;
      const points = store.all<DirectoryMapResponse['points'][number]>(
        `${cte}
      SELECT id,source,name,city,lat,lng FROM filtered WHERE ${mappableSQL}
      ORDER BY source,id LIMIT ?`,
        ...params,
        CATALOG_MAX_ROWS,
      );
      return {
        points,
        ...counts,
        unmapped: counts.total - counts.mappable,
        truncated: counts.mappable > points.length,
      } satisfies DirectoryMapResponse;
    });
    res.json(response);
  });
  router.get('/directory/catalog/:id', (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.id);
    const studio = parsed.success ? readCatalogStudio(store, parsed.data) : undefined;
    ensure(studio, 404, 'NOT_FOUND', 'Catalog workshop not found / Мастерская каталога не найдена');
    res.json({ studio });
  });
  return router;
}
