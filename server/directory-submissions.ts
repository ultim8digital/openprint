import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { PublicStudioInput } from '../shared/directory.js';
import type { Store } from './database.js';
import { normalizeCatalogTechnology, readCatalogStudio, safeHttpURL } from './directory.js';
import { digest, ensure, rateLimiter } from './security.js';

export const SUBMISSION_MAX_IDENTITIES = 50000;
export const SUBMISSION_CREATES_PER_IP_DAY = 5;
export const SUBMISSION_CREATES_PER_DAY = 200;
const DAY = 86400000;
const string = (max: number) => z.string().trim().max(max);
export const publicStudioSchema = z
  .object({
    name: string(200).min(2),
    city: string(120).min(2),
    region: string(160),
    country: string(80),
    description: string(4000),
    technologies: z
      .array(string(100).min(1))
      .max(40)
      .transform((items) => [...new Set(items.map(normalizeCatalogTechnology))]),
    materials: z
      .array(string(100).min(1))
      .max(50)
      .transform((items) => [...new Set(items)]),
    website: string(2048).refine(
      (value) => !value || safeHttpURL(value),
      'Use an HTTP(S) URL without credentials',
    ),
    phone: string(100).refine(
      (value) => !value || /^\+?\d{6,18}$/.test(value.replace(/[\s().-]/g, '')),
      'Use 6–18 phone digits, optionally +, spaces, parentheses, dots or hyphens / Укажите телефон: 6–18 цифр, допустимы +, пробелы, скобки, точки и дефисы',
    ),
    address: string(500),
    lat: z.number().finite().min(-90).max(90).nullable(),
    lng: z.number().finite().min(-180).max(180).nullable(),
  })
  .strict()
  .refine((studio) => !!studio.website || !!studio.phone, {
    message: 'Provide a website or phone / Укажите сайт или телефон',
    path: ['website'],
  })
  .refine((studio) => (studio.lat === null) === (studio.lng === null), {
    message: 'Coordinates must be a pair or both empty / Укажите обе координаты',
    path: ['lat'],
  });
const keySchema = z.string().regex(/^[a-f0-9]{64}$(?![\s\S])/);
const versionSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER - 1);
const createSchema = z
  .object({
    management_key: keySchema,
    studio: publicStudioSchema,
    rights_confirmed: z.literal(true),
  })
  .strict();
const updateSchema = z
  .object({
    studio: publicStudioSchema,
    version: versionSchema,
    rights_confirmed: z.literal(true),
  })
  .strict();
const deleteSchema = z.object({ version: versionSchema }).strict();
type Identity = {
  id: string;
  key_hash: string;
  initial_body_hash: string;
  version: number;
  deleted_at: number | null;
};
const identitySQL =
  'SELECT id,key_hash,initial_body_hash,version,deleted_at FROM directory_submissions';
const publicColumns = [
  'name',
  'city',
  'region',
  'country',
  'description',
  'technologies',
  'materials',
  'website',
  'phone',
  'address',
  'lat',
  'lng',
] as const;
function publicValues(studio: PublicStudioInput) {
  return publicColumns.map((key) =>
    key === 'technologies' || key === 'materials' ? JSON.stringify(studio[key]) : studio[key],
  );
}
function active(row: Identity) {
  ensure(
    row.deleted_at === null,
    410,
    'SUBMISSION_DELETED',
    'This listing was deleted / Эта карточка удалена',
  );
}
function exactVersion(row: Identity, version: number) {
  ensure(
    row.version === version,
    409,
    'VERSION_CONFLICT',
    'The listing changed. Reload it before editing / Карточка изменилась, загрузите её заново',
  );
}
function managed(store: Store, req: Request): Identity {
  const key = keySchema.safeParse(req.get('X-Catalog-Key'));
  const id = z.string().uuid().safeParse(req.params.id);
  // Authentication uses a fixed-length, high-entropy hash lookup, never a public identifier alone.
  const row =
    key.success && id.success
      ? store.get<Identity>(`${identitySQL} WHERE id=? AND key_hash=?`, id.data, digest(key.data))
      : undefined;
  ensure(
    row,
    403,
    'MANAGEMENT_KEY_INVALID',
    'A valid management key is required / Нужен действующий ключ управления',
  );
  return row;
}
function rejectDuplicate(store: Store, studio: PublicStudioInput, excludingId = '') {
  const match = store.get(
    `SELECT 1 FROM catalog_studios WHERE
    unicode_fold(name)=unicode_fold(?) AND unicode_fold(city)=unicode_fold(?) AND unicode_fold(address)=unicode_fold(?)
    UNION ALL SELECT 1 FROM directory_submissions WHERE deleted_at IS NULL AND id<>? AND
    unicode_fold(name)=unicode_fold(?) AND unicode_fold(city)=unicode_fold(?) AND unicode_fold(address)=unicode_fold(?) LIMIT 1`,
    studio.name,
    studio.city,
    studio.address,
    excludingId,
    studio.name,
    studio.city,
    studio.address,
  );
  ensure(
    !match,
    409,
    'DUPLICATE_STUDIO',
    'This workshop is already in the directory / Такая мастерская уже есть в каталоге',
  );
}
function reserveCreate(store: Store, req: Request, id: string, now: number) {
  // Only successful creates enter this ledger. The transaction rolls back quota on any failure.
  store.run('DELETE FROM directory_create_usage WHERE created_at<=?', now - DAY);
  store.run(
    "INSERT OR IGNORE INTO meta(key,value) VALUES('directory_ip_salt',?)",
    randomBytes(32).toString('hex'),
  );
  const salt = store.get<{ value: string }>(
    "SELECT value FROM meta WHERE key='directory_ip_salt'",
  )!.value;
  const ip = (req.ip || req.socket.remoteAddress || 'unknown')
    .toLowerCase()
    .replace(/^::ffff:/, '');
  const hash = createHmac('sha256', salt).update(ip).digest('hex');
  const counts = store.get<{ total: number; ip: number }>(
    'SELECT count(*) total,COALESCE(sum(CASE WHEN ip_hash=? THEN 1 ELSE 0 END),0) ip FROM directory_create_usage',
    hash,
  )!;
  ensure(
    counts.ip < SUBMISSION_CREATES_PER_IP_DAY && counts.total < SUBMISSION_CREATES_PER_DAY,
    429,
    'RATE_LIMIT',
    'Publication limit reached. Try again later / Лимит публикаций исчерпан, повторите позже',
  );
  store.run(
    'INSERT INTO directory_create_usage(submission_id,ip_hash,created_at) VALUES(?,?,?)',
    id,
    hash,
    now,
  );
}

/** No account or moderation step: possession of the client-created secret controls this listing only. */
export function createDirectorySubmissionsRouter(store: Store) {
  const router = Router(),
    throttle = rateLimiter();
  router.use('/directory/submissions', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.post('/directory/submissions', throttle('directory-create', 20), (req, res) => {
    const body = createSchema.parse(req.body),
      keyHash = digest(body.management_key),
      bodyHash = digest(JSON.stringify(body.studio));
    const result = store.transaction(() => {
      const previous = store.get<Identity>(`${identitySQL} WHERE key_hash=?`, keyHash);
      if (previous) {
        active(previous);
        ensure(
          previous.initial_body_hash === bodyHash,
          409,
          'REQUEST_ID_REUSED',
          'This key was used for different initial data / Этот ключ уже использован с другими исходными данными',
        );
        return { created: false, studio: readCatalogStudio(store, previous.id)! };
      }
      ensure(
        store.get<{ n: number }>('SELECT count(*) n FROM directory_submissions')!.n <
          SUBMISSION_MAX_IDENTITIES,
        429,
        'SUBMISSION_CAPACITY',
        'Directory submission capacity reached / Достигнут лимит самостоятельных карточек',
      );
      rejectDuplicate(store, body.studio);
      const id = randomUUID(),
        now = Date.now();
      store.run(
        `INSERT INTO directory_submissions(id,key_hash,initial_body_hash,${publicColumns.join(',')},version,created_at,updated_at)
        VALUES(?,?,?,${publicColumns.map(() => '?').join(',')},1,?,?)`,
        id,
        keyHash,
        bodyHash,
        ...publicValues(body.studio),
        now,
        now,
      );
      reserveCreate(store, req, id, now);
      return { created: true, studio: readCatalogStudio(store, id)! };
    });
    res
      .status(result.created ? 201 : 200)
      .json({ studio: result.studio, replayed: !result.created });
  });
  router.get(
    '/directory/submissions/:id',
    throttle('directory-management-read', 60),
    (req, res) => {
      const row = managed(store, req);
      active(row);
      res.json({ studio: readCatalogStudio(store, row.id)! });
    },
  );
  const edits = throttle('directory-management-write', 20);
  router.patch('/directory/submissions/:id', edits, (req, res) => {
    const body = updateSchema.parse(req.body);
    const studio = store.transaction(() => {
      const row = managed(store, req);
      active(row);
      exactVersion(row, body.version);
      rejectDuplicate(store, body.studio, row.id);
      store.run(
        `UPDATE directory_submissions SET ${publicColumns.map((column) => `${column}=?`).join(',')},version=version+1,updated_at=? WHERE id=?`,
        ...publicValues(body.studio),
        Date.now(),
        row.id,
      );
      return readCatalogStudio(store, row.id)!;
    });
    res.json({ studio });
  });
  router.delete('/directory/submissions/:id', edits, (req, res) => {
    const body = deleteSchema.parse(req.body);
    store.transaction(() => {
      const row = managed(store, req);
      if (row.deleted_at !== null) {
        // A lost DELETE response can safely be retried with the original version.
        ensure(
          body.version === row.version - 1,
          409,
          'VERSION_CONFLICT',
          'Deletion version changed / Версия удаления изменилась',
        );
        return;
      }
      exactVersion(row, body.version);
      const now = Date.now();
      store.run(
        `UPDATE directory_submissions SET ${publicColumns.map((column) => `${column}=NULL`).join(',')},version=version+1,updated_at=?,deleted_at=? WHERE id=?`,
        now,
        now,
        row.id,
      );
    });
    res.json({ deleted: true });
  });
  return router;
}
