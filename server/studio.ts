import { cadChecks, cadSnapshot, latestCadRevision } from './cad-data.js';
import { Router, type Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  studioCreateSchema,
  studioSaveSchema,
  type StudioBrief,
  type StudioCapabilities,
  type StudioMatch,
  type StudioProject,
  type StudioUsage,
} from '../shared/studio.js';
import { currencies } from '../shared/types.js';
import { Store } from './database.js';
import { assertDaily, blocked, profileObject, type ProfileRow } from './domain.js';
import { uploadDirectory, validateModel } from './files.js';
import { ensure, event, HttpError, notify, requireUser, digest } from './security.js';
import {
  resolveStudioAIConfig,
  requestStudioBrief,
  studioAIInput,
  StudioAIError,
  type StudioAIConfig,
} from './studio-ai.js';
import {
  canonicalJSON,
  studioChecks,
  studioPacket,
  templateSTL,
  validTemplate,
} from './studio-geometry.js';

export type ProjectRow = {
  id: string;
  owner_id: string;
  idea: string;
  language: 'ru' | 'en';
  brief: string;
  version: number;
  confirmed_version: number | null;
  confirmed_hash: string | null;
  source: 'manual' | 'openai';
  job_id: string | null;
  file_id: string | null;
  packet: string | null;
  model_stl: Uint8Array | null;
  created_at: number;
  updated_at: number;
};
type RunRow = {
  id: string;
  owner_id: string;
  project_id: string | null;
  request_id: string;
  request_hash: string;
  input_version: number;
  model: string;
  quality: 'standard' | 'review';
  status: 'running' | 'complete' | 'failed' | 'stale';
  input_tokens: number;
  output_tokens: number;
  result_version: number | null;
  error_code: string | null;
  created_at: number;
  finished_at: number | null;
};
type StudioOptions = {
  store: Store;
  dataDir: string;
  ai?: StudioAIConfig;
  userLimit?: number;
  totalLimit?: number;
};
const versionSchema = z.object({ version: z.number().int().min(1) }).strict();
const assistSchema = versionSchema
  .extend({
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(2000),
    quality: z.enum(['standard', 'review']),
    consent: z.literal(true),
  })
  .strict();
const publishSchema = versionSchema
  .extend({
    visibility: z.enum(['public', 'direct']),
    target_profile_id: z.string().uuid().nullable(),
    currency: z.enum(currencies),
    budget: z.number().int().min(1).max(100000000).nullable(),
  })
  .strict()
  .refine(
    (v) => (v.visibility === 'public' ? v.target_profile_id === null : !!v.target_profile_id),
    'Choose a target for direct requests only',
  );
const id = (req: Request) => z.string().uuid().parse(req.params.id);
const processes: StudioCapabilities['processes'] = [
  { id: 'FDM', ru: '3D-печать FDM', en: 'FDM 3D printing', status: 'template' },
  { id: 'SLA', ru: 'Фотополимерная печать SLA', en: 'SLA resin printing', status: 'brief' },
  { id: 'SLS', ru: 'Порошковая печать SLS', en: 'SLS powder printing', status: 'brief' },
  { id: 'MJF', ru: 'Порошковая печать MJF', en: 'MJF powder printing', status: 'brief' },
  { id: 'DMLS', ru: 'Печать металлом DMLS', en: 'DMLS metal printing', status: 'brief' },
  { id: 'LASER', ru: 'Лазерная резка', en: 'Laser cutting', status: 'brief' },
  { id: 'CNC', ru: 'Фрезерная обработка CNC', en: 'CNC milling', status: 'brief' },
  { id: 'CNC_TURNING', ru: 'Токарная обработка CNC', en: 'CNC turning', status: 'brief' },
  { id: 'WOOD_CNC', ru: 'Обработка дерева CNC', en: 'CNC woodworking', status: 'brief' },
  { id: 'WATERJET', ru: 'Гидроабразивная резка', en: 'Waterjet cutting', status: 'brief' },
  { id: 'PLASMA', ru: 'Плазменная резка', en: 'Plasma cutting', status: 'brief' },
  { id: 'SHEET_METAL', ru: 'Листовой металл', en: 'Sheet metal', status: 'brief' },
  {
    id: 'MIXED',
    ru: 'Несколько технологий / сборка',
    en: 'Multiple processes / assembly',
    status: 'brief',
  },
  { id: 'UNSURE', ru: 'Подобрать технологию', en: 'Help choosing a process', status: 'brief' },
];

function projectChecks(store: Store, row: ProjectRow) {
  const checks = studioChecks(briefOf(row));
  return latestCadRevision(store, row.id)?.spec
    ? [...checks.filter((c) => c.code !== 'brief_only'), ...cadChecks(store, row.id, row.version)]
    : checks;
}
function confirmationHash(store: Store, row: ProjectRow) {
  const cad = cadSnapshot(store, row.id, row.version);
  return digest(canonicalJSON(cad ? { brief: briefOf(row), cad } : briefOf(row)));
}
function briefOf(row: ProjectRow): StudioBrief {
  return JSON.parse(row.brief);
}
export function projectObject(store: Store, row: ProjectRow): StudioProject {
  return {
    id: row.id,
    idea: row.idea,
    language: row.language,
    brief: briefOf(row),
    version: row.version,
    confirmed_version: row.confirmed_version,
    confirmed_hash: row.confirmed_hash,
    source: row.source,
    job_id: row.job_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    checks: projectChecks(store, row),
  };
}
export function owned(store: Store, projectId: string, owner: string) {
  const row = store.get<ProjectRow>(
    'SELECT * FROM studio_projects WHERE id=? AND owner_id=?',
    projectId,
    owner,
  );
  ensure(row, 404, 'NOT_FOUND', 'Studio project not found / Проект студии не найден');
  return row;
}
export function editable(row: ProjectRow, version: number) {
  ensure(
    !row.job_id,
    409,
    'STUDIO_PUBLISHED',
    'This brief is already published and frozen / ТЗ опубликовано и зафиксировано',
  );
  ensure(
    row.version === version,
    409,
    'STUDIO_CHANGED',
    'The brief changed. Reload before continuing / ТЗ изменилось. Обновите страницу',
  );
}
function confirmed(store: Store, row: ProjectRow) {
  ensure(
    row.confirmed_version === row.version && row.confirmed_hash && row.packet,
    409,
    'STUDIO_UNCONFIRMED',
    'Review and confirm this version first / Сначала проверьте и подтвердите эту версию',
  );
  ensure(
    row.confirmed_hash === confirmationHash(store, row),
    409,
    'STUDIO_CHANGED',
    'Confirmed brief does not match / Подтверждённое ТЗ не совпадает',
  );
}
export function assertHistoryCapacity(
  store: Store,
  ownerId: string,
  projectId: string | null,
  addedBytes: number,
) {
  if (projectId)
    ensure(
      store.get<{ n: number }>(
        'SELECT count(*) AS n FROM studio_revisions WHERE project_id=?',
        projectId,
      )!.n < 100,
      429,
      'STUDIO_REVISION_LIMIT',
      'Maximum 100 saved revisions per studio project / Не более 100 сохранённых версий проекта студии',
    );
  const ownerBytes = store.get<{ n: number }>(
    'SELECT COALESCE(sum(length(CAST(r.brief AS BLOB))),0) AS n FROM studio_revisions r JOIN studio_projects p ON p.id=r.project_id WHERE p.owner_id=?',
    ownerId,
  )!.n;
  const totalBytes = store.get<{ n: number }>(
    'SELECT COALESCE(sum(length(CAST(brief AS BLOB))),0) AS n FROM studio_revisions',
  )!.n;
  ensure(
    ownerBytes + addedBytes <= 20 * 1024 * 1024 && totalBytes + addedBytes <= 200 * 1024 * 1024,
    413,
    'STUDIO_STORAGE_LIMIT',
    'Studio history quota reached (20 MiB per account, 200 MiB per instance) / Достигнут лимит истории студии (20 МиБ на аккаунт, 200 МиБ на сервер)',
  );
}
export function revise(
  store: Store,
  row: ProjectRow,
  brief: StudioBrief,
  source: 'manual' | 'openai',
  force = false,
) {
  ensure(
    !brief.part || !latestCadRevision(store, row.id)?.spec,
    409,
    'CAD_TEMPLATE_CONFLICT',
    'Remove CAD before adding a simple template / Удалите CAD перед добавлением простого шаблона',
  );
  const value = canonicalJSON(brief);
  if (!force && value === canonicalJSON(briefOf(row))) return row.version;
  assertHistoryCapacity(store, row.owner_id, row.id, Buffer.byteLength(value));
  const version = row.version + 1,
    now = Date.now();
  const result = store.run(
    `UPDATE studio_projects SET brief=?,version=?,source=?,confirmed_version=NULL,confirmed_hash=NULL,packet=NULL,model_stl=NULL,updated_at=? WHERE id=? AND version=? AND job_id IS NULL`,
    value,
    version,
    source,
    now,
    row.id,
    row.version,
  );
  ensure(result.changes === 1, 409, 'STUDIO_CHANGED', 'The brief changed / ТЗ изменилось');
  store.run(
    'INSERT INTO studio_revisions(project_id,version,brief,source,created_at) VALUES(?,?,?,?,?)',
    row.id,
    version,
    value,
    source,
    now,
  );
  return version;
}
function usage(store: Store, projectId: string): StudioUsage {
  const totals = store.get<{ calls: number; input: number; output: number }>(
    'SELECT count(*) AS calls,COALESCE(sum(input_tokens),0) AS input,COALESCE(sum(output_tokens),0) AS output FROM studio_ai_runs WHERE project_id=?',
    projectId,
  )!;
  return {
    projectCalls: totals.calls,
    inputTokens: totals.input,
    outputTokens: totals.output,
    runs: store.all(
      'SELECT id,model,status,created_at,input_tokens,output_tokens FROM studio_ai_runs WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 20',
      projectId,
    ) as StudioUsage['runs'],
  };
}

/** A bounded discovery aid, using only published profile declarations; no price/availability guesses. */
function matches(store: Store, row: ProjectRow) {
  const brief = briefOf(row),
    design = brief.requestKind === 'design',
    normalize = (s: string) => s.normalize('NFKC').toLowerCase().trim();
  const wanted = [
    ...new Set(
      (brief.process === 'MIXED' ? brief.components.map((c) => c.process) : [brief.process]).filter(
        (p) => !['UNSURE', 'MIXED'].includes(p),
      ),
    ),
  ];
  const candidates = store.all<ProfileRow>(
    `SELECT p.* FROM profiles p JOIN users u ON u.id=p.user_id
    WHERE p.published=1 AND u.suspended=0 AND p.user_id<>?
    AND (?='' OR unicode_fold(p.city)=unicode_fold(?) OR p.remote=1)
    AND (CASE WHEN ?=1 THEN p.kind IN ('engineer','both') ELSE p.kind IN ('studio','both') END)
    AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.owner_id=? AND b.blocked_id=p.user_id) OR (b.owner_id=p.user_id AND b.blocked_id=?))
    ORDER BY p.verified DESC,p.created_at DESC,p.id LIMIT 201`,
    row.owner_id,
    brief.city,
    brief.city,
    design ? 1 : 0,
    row.owner_id,
    row.owner_id,
  );
  const result: StudioMatch[] = [];
  for (const candidate of candidates.slice(0, 200)) {
    const profile = profileObject(candidate),
      reasons: string[] = [];
    const covered = wanted.filter((p) => profile.technologies.includes(p));
    if (wanted.length && covered.length === 0 && !(design && profile.technologies.includes('CAD')))
      continue;
    let score = 0;
    if (covered.length) {
      score += (30 * covered.length) / Math.max(wanted.length, 1);
      reasons.push(
        `${row.language === 'ru' ? 'В профиле указаны' : 'Listed capabilities'}: ${covered.join(', ')}`,
      );
    }
    if (design && profile.technologies.includes('CAD')) {
      score += 20;
      reasons.push(row.language === 'ru' ? 'Проектирование CAD' : 'CAD design');
    }
    if (brief.city && normalize(profile.city) === normalize(brief.city)) {
      score += 30;
      reasons.push(row.language === 'ru' ? 'В вашем городе' : 'In your city');
    } else if (profile.remote) {
      score += 10;
      reasons.push(
        row.language === 'ru' ? 'Принимает удалённые заказы' : 'Accepts remote projects',
      );
    }
    if (
      brief.material &&
      profile.materials.some((m) => normalize(m) === normalize(brief.material))
    ) {
      score += 10;
      reasons.push(
        row.language === 'ru' ? 'Материал указан в профиле' : 'Material listed in profile',
      );
    }
    if (profile.verified) {
      score += 5;
      reasons.push(
        row.language === 'ru' ? 'Профиль просмотрен модератором' : 'Profile reviewed by moderator',
      );
    }
    result.push({ profile, score: Math.round(score), reasons });
  }
  return {
    matches: result
      .sort((a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id))
      .slice(0, 12),
    candidate_limit: 200,
    has_more_candidates: candidates.length > 200,
  };
}
function detail(store: Store, row: ProjectRow) {
  return {
    project: projectObject(store, row),
    usage: usage(store, row.id),
    ...matches(store, row),
  };
}
function skeleton(idea: string, language: 'ru' | 'en'): StudioBrief {
  return {
    title: idea.slice(0, 120),
    purpose: idea,
    requestKind: 'design',
    process: 'UNSURE',
    material: '',
    quantity: null,
    city: '',
    part: null,
    requirements: [],
    assumptions: [],
    components: [],
    operations: [],
    acceptance: [],
    questions:
      language === 'ru'
        ? [
            'Какие размеры и условия использования важны?',
            'Сколько изделий нужно и куда их доставить?',
            'Какие материал, технология и критерии приёмки требуются?',
          ]
        : [
            'Which dimensions and conditions of use matter?',
            'How many items are needed, and where should they be delivered?',
            'Which material, process and acceptance criteria are required?',
          ],
  };
}
function handoffDescription(row: ProjectRow, brief: StudioBrief) {
  const ru = row.language === 'ru',
    heading = (a: string, b: string) => (ru ? a : b);
  const lines = [
    `${heading('ТЗ Neofab', 'Neofab brief')} · v${row.version} · SHA-256 ${row.confirmed_hash}`,
    brief.purpose,
    `${heading('Тип запроса', 'Request type')}: ${brief.requestKind}`,
    `${heading('Технология', 'Process')}: ${brief.process}`,
    `${heading('Материал', 'Material')}: ${brief.material || heading('согласовать с исполнителем', 'to agree with provider')}`,
    `${heading('Количество изделий', 'Product quantity')}: ${brief.quantity}`,
    `${heading('Город / доставка', 'City / delivery')}: ${brief.city}`,
    ...brief.requirements.map((text) => `${heading('Требование', 'Requirement')}: ${text}`),
    ...(brief.part
      ? [
          `${heading('Шаблон детали, мм', 'Part template, mm')}: ${brief.part.kind}; X=${brief.part.width}; Y=${brief.part.depth}; Z=${brief.part.height}; Ø=${brief.part.hole}`,
        ]
      : []),
    ...(brief.components.length
      ? [
          heading('Состав одного изделия (BOM):', 'Components per product (BOM):'),
          ...brief.components.map(
            (c, index) =>
              `${index + 1}. ${c.name} × ${c.quantity ?? heading('уточнить', 'to clarify')}; ${c.process}; ${c.material || '—'}; ${c.requirements}`,
          ),
        ]
      : []),
    ...brief.operations.map(
      (text, index) => `${heading('Операция', 'Operation')} ${index + 1}: ${text}`,
    ),
    ...brief.acceptance.map((text) => `${heading('Приёмка', 'Acceptance')}: ${text}`),
    ...brief.questions.map((text) => `${heading('Открытый вопрос', 'Open question')}: ${text}`),
    ...brief.assumptions.map(
      (text) => `${heading('Неподтверждённое предположение', 'Unconfirmed assumption')}: ${text}`,
    ),
    heading(
      'Требуется подтверждение исполнителем технологии, материала, допусков и подготовки оборудования. CAM и G-code отсутствуют.',
      'The provider must confirm process, material, tolerances and machine setup. CAM and G-code are not included.',
    ),
    JSON.parse(row.packet || '{}').cad
      ? heading(
          'Приложен версионный комплект CAD: STEP, STL, BOM и отчёт. Доступ выдаётся исполнителю отдельно; прямой адресат получает его сразу.',
          'A versioned CAD package includes STEP, STL, BOM and a report. Access is granted separately; a direct recipient receives it immediately.',
        )
      : brief.part
        ? heading(
            'Приложена геометрия одного параметрического шаблона, без проверки в слайсере.',
            'Attached geometry is one parametric template, without slicer verification.',
          )
        : heading(
            'Готовой CAD-модели в пакете нет. Требуется согласовать исходные файлы или проектирование.',
            'The packet contains no completed CAD model. Agree on source files or design work.',
          ),
  ];
  const value = lines.join('\n\n');
  ensure(
    value.length <= 48000,
    400,
    'HANDOFF_TOO_LONG',
    'Manufacturing handoff exceeds 48,000 characters. Shorten it explicitly / ТЗ превышает 48 000 символов. Сократите его вручную',
  );
  return value;
}

export function createStudioRouter(options: StudioOptions) {
  const { store, dataDir } = options,
    ai = resolveStudioAIConfig(options.ai),
    router = Router();
  router.get('/capabilities', (_req, res) => {
    res.json({
      ai: {
        configured: !!ai.apiKey,
        model: ai.model,
        reviewModel: ai.reviewModel,
        maxCallsPerProject: ai.maxCallsPerProject,
        maxCallsPerUserDay: ai.maxCallsPerUserDay,
        maxCallsPerInstanceDay: ai.maxCallsPerInstanceDay,
        maxOutputTokens: ai.maxOutputTokens,
      },
      processes,
    } satisfies StudioCapabilities);
  });
  router.get('/projects', (req, res) => {
    const user = requireUser(store, req);
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit),
      offset = z.coerce.number().int().min(0).max(10000).default(0).parse(req.query.offset);
    const rows = store.all<ProjectRow>(
      'SELECT * FROM studio_projects WHERE owner_id=? ORDER BY updated_at DESC,id LIMIT ? OFFSET ?',
      user.id,
      limit + 1,
      offset,
    );
    res.json({
      projects: rows.slice(0, limit).map((row) => projectObject(store, row)),
      has_more: rows.length > limit,
    });
  });
  router.post('/projects', (req, res) => {
    const user = requireUser(store, req),
      body = studioCreateSchema.parse(req.body),
      projectId = randomUUID(),
      now = Date.now();
    const brief = canonicalJSON(skeleton(body.idea, body.language));
    store.transaction(() => {
      assertDaily(store, user.id, 'studio.created', 20);
      const count = store.get<{ n: number }>(
        'SELECT count(*) AS n FROM studio_projects WHERE owner_id=?',
        user.id,
      )!.n;
      ensure(
        count < 200,
        429,
        'STUDIO_PROJECT_LIMIT',
        'Maximum 200 studio projects per account / Не более 200 проектов студии на аккаунт',
      );
      assertHistoryCapacity(store, user.id, null, Buffer.byteLength(brief));
      store.run(
        `INSERT INTO studio_projects(id,owner_id,idea,language,brief,version,source,created_at,updated_at) VALUES(?,?,?,?,?,1,'manual',?,?)`,
        projectId,
        user.id,
        body.idea,
        body.language,
        brief,
        now,
        now,
      );
      store.run(
        `INSERT INTO studio_revisions(project_id,version,brief,source,created_at) VALUES(?,1,?,'manual',?)`,
        projectId,
        brief,
        now,
      );
      event(store, user.id, 'studio.created', projectId);
    });
    res.status(201).json(detail(store, owned(store, projectId, user.id)));
  });
  router.get('/projects/:id', (req, res) => {
    const user = requireUser(store, req);
    res.json(detail(store, owned(store, id(req), user.id)));
  });
  router.get('/projects/:id/matches', (req, res) => {
    const user = requireUser(store, req);
    res.json(matches(store, owned(store, id(req), user.id)));
  });
  router.put('/projects/:id', (req, res) => {
    const user = requireUser(store, req),
      body = studioSaveSchema.parse(req.body),
      projectId = id(req);
    store.transaction(() => {
      const row = owned(store, projectId, user.id);
      editable(row, body.version);
      revise(store, row, body.brief, 'manual');
    });
    res.json(detail(store, owned(store, projectId, user.id)));
  });
  router.post('/projects/:id/confirm', (req, res) => {
    const user = requireUser(store, req),
      body = versionSchema.parse(req.body),
      projectId = id(req);
    store.transaction(() => {
      const row = owned(store, projectId, user.id);
      ensure(
        row.version === body.version,
        409,
        'STUDIO_CHANGED',
        'The brief changed / ТЗ изменилось',
      );
      if (row.confirmed_version === row.version) {
        confirmed(store, row);
        return;
      }
      editable(row, body.version);
      const brief = briefOf(row),
        checks = projectChecks(store, row);
      ensure(
        !checks.some((check) => check.level === 'required'),
        400,
        'STUDIO_INCOMPLETE',
        'Specify quantity and location and resolve template checks before confirming the brief / До подтверждения ТЗ заполните количество и город и проверьте шаблон',
      );
      const model = templateSTL(brief),
        basePacket = studioPacket(row.id, row.version, brief, model),
        cad = cadSnapshot(store, row.id, row.version),
        packet = cad
          ? {
              ...basePacket,
              schema_version: 'neofab-packet/2',
              confirmed_hash: confirmationHash(store, row),
              checks,
              cad,
              geometry_scope: 'declarative_cad',
              manifest: [
                ...basePacket.manifest,
                ...cad.artifacts.map((a) => ({
                  path: 'cad/' + a.name,
                  bytes: a.size,
                  sha256: a.sha256,
                })),
              ],
            }
          : basePacket;
      store.run(
        'INSERT INTO studio_confirmations(project_id,version,brief_hash,confirmed_at) VALUES(?,?,?,?)',
        row.id,
        row.version,
        packet.confirmed_hash,
        Date.now(),
      );
      store.run(
        'UPDATE studio_projects SET confirmed_version=version,confirmed_hash=?,packet=?,model_stl=?,updated_at=? WHERE id=?',
        packet.confirmed_hash,
        JSON.stringify(packet),
        model,
        Date.now(),
        row.id,
      );
      event(store, user.id, 'studio.confirmed', row.id, String(row.version));
    });
    res.json(detail(store, owned(store, projectId, user.id)));
  });
  router.get('/projects/:id/packet', (req, res) => {
    const user = requireUser(store, req),
      row = owned(store, id(req), user.id);
    confirmed(store, row);
    res
      .set('Content-Disposition', `attachment; filename="neofab-${row.id}-v${row.version}.json"`)
      .json(JSON.parse(row.packet!));
  });
  router.get('/projects/:id/model.stl', (req, res) => {
    const user = requireUser(store, req),
      row = owned(store, id(req), user.id);
    confirmed(store, row);
    ensure(
      row.model_stl,
      404,
      'NO_MODEL',
      'This brief has no generated model / В этом ТЗ нет сгенерированной модели',
    );
    const bytes = Buffer.from(row.model_stl),
      packet = JSON.parse(row.packet!) as ReturnType<typeof studioPacket>;
    ensure(
      packet.manifest.some((file) => file.path === 'model.stl' && file.sha256 === digest(bytes)),
      409,
      'MODEL_INTEGRITY',
      'Model integrity check failed / Контроль целостности модели не пройден',
    );
    res
      .set({
        'Content-Type': 'model/stl',
        'Content-Disposition': `attachment; filename="neofab-${row.id}-v${row.version}.stl"`,
        'X-Content-SHA256': digest(bytes),
      })
      .send(bytes);
  });
  router.post('/projects/:id/assist', async (req, res) => {
    const user = requireUser(store, req),
      body = assistSchema.parse(req.body),
      projectId = id(req),
      now = Date.now();
    const requestHash = digest(canonicalJSON(body));
    const reservation = store.transaction(() => {
      const row = owned(store, projectId, user.id);
      // Expired/unknown outcomes still consume a call. The same request ID can never rerun.
      store.run(
        `UPDATE studio_ai_runs SET status='failed',error_code='AI_INTERRUPTED',finished_at=? WHERE status='running' AND created_at<?`,
        now,
        now - ai.timeoutMs - 60000,
      );
      const prior = store.get<RunRow>(
        'SELECT * FROM studio_ai_runs WHERE owner_id=? AND project_id=? AND request_id=?',
        user.id,
        projectId,
        body.requestId,
      );
      if (prior) {
        ensure(
          prior.request_hash === requestHash,
          409,
          'AI_REQUEST_CHANGED',
          'This request ID was used for different input / Этот идентификатор уже использован для другого запроса',
        );
        return { row, run: prior, replay: true, input: '' };
      }
      editable(row, body.version);
      if (!ai.apiKey) throw new StudioAIError('AI_DISABLED');
      const input = studioAIInput(row.idea, briefOf(row), row.language, body.message);
      assertHistoryCapacity(store, user.id, row.id, 0);
      const count = (where: string, ...params: (string | number)[]) =>
        store.get<{ n: number }>(
          `SELECT count(*) AS n FROM studio_ai_runs WHERE ${where}`,
          ...params,
        )!.n;
      ensure(
        count('project_id=?', row.id) < ai.maxCallsPerProject,
        429,
        'AI_PROJECT_LIMIT',
        'Project AI call limit reached / Достигнут лимит ИИ для проекта',
      );
      ensure(
        count('owner_id=? AND created_at>?', user.id, now - 86400000) < ai.maxCallsPerUserDay,
        429,
        'AI_USER_LIMIT',
        'Your 24-hour AI call limit is reached / Достигнут ваш лимит ИИ за 24 часа',
      );
      ensure(
        count('created_at>?', now - 86400000) < ai.maxCallsPerInstanceDay,
        429,
        'AI_INSTANCE_LIMIT',
        'Community AI call limit reached for 24 hours / Достигнут лимит ИИ сообщества за 24 часа',
      );
      ensure(
        count("owner_id=? AND status='running'", user.id) === 0,
        409,
        'AI_RUNNING',
        'One AI request is already running for your account / Один запрос ИИ для вашего аккаунта уже выполняется',
      );
      ensure(
        count("status='running'") < 2,
        429,
        'AI_BUSY',
        'Two AI requests are already running. Try later / Уже выполняются два запроса ИИ. Повторите позже',
      );
      const runId = randomUUID(),
        model = body.quality === 'review' ? ai.reviewModel : ai.model;
      store.run(
        `INSERT INTO studio_ai_runs(id,owner_id,project_id,request_id,request_hash,input_version,model,quality,status,created_at) VALUES(?,?,?,?,?,?,?,?,'running',?)`,
        runId,
        user.id,
        row.id,
        body.requestId,
        requestHash,
        row.version,
        model,
        body.quality,
        now,
      );
      return {
        row,
        run: store.get<RunRow>('SELECT * FROM studio_ai_runs WHERE id=?', runId)!,
        replay: false,
        input,
      };
    });
    if (reservation.replay) {
      const run = reservation.run;
      if (run.status === 'failed')
        throw new StudioAIError(run.error_code || 'AI_PROVIDER', {
          inputTokens: run.input_tokens,
          outputTokens: run.output_tokens,
        });
      ensure(
        run.status !== 'running',
        409,
        'AI_RUNNING',
        'This request is already running / Этот запрос уже выполняется',
      );
      ensure(
        run.status !== 'stale',
        409,
        'STUDIO_CHANGED',
        'AI finished after the brief changed; its usage was recorded without replacing your work / ИИ завершил работу после изменения ТЗ; расход учтён, ваши правки сохранены',
      );
      res.json({ ...detail(store, owned(store, projectId, user.id)), replayed: true });
      return;
    }
    let result: Awaited<ReturnType<typeof requestStudioBrief>>;
    try {
      result = await requestStudioBrief(ai, {
        model: reservation.run.model,
        input: reservation.input,
        previous: briefOf(reservation.row),
        explicitText: `${reservation.row.idea}\n${body.message}`,
        language: reservation.row.language,
      });
    } catch (error) {
      const failure = error instanceof StudioAIError ? error : new StudioAIError('AI_PROVIDER');
      store.run(
        `UPDATE studio_ai_runs SET status='failed',error_code=?,input_tokens=?,output_tokens=?,finished_at=? WHERE id=?`,
        failure.code,
        failure.usage.inputTokens,
        failure.usage.outputTokens,
        Date.now(),
        reservation.run.id,
      );
      throw failure;
    }
    let outcome: string;
    try {
      outcome = store.transaction(() => {
        const run = store.get<RunRow>(
          'SELECT * FROM studio_ai_runs WHERE id=?',
          reservation.run.id,
        );
        store.run(
          'UPDATE studio_ai_runs SET input_tokens=?,output_tokens=?,finished_at=? WHERE id=?',
          result.usage.inputTokens,
          result.usage.outputTokens,
          Date.now(),
          reservation.run.id,
        );
        if (!run || run.status !== 'running') return 'interrupted';
        const current = store.get<ProjectRow>(
            'SELECT * FROM studio_projects WHERE id=? AND owner_id=?',
            projectId,
            user.id,
          ),
          active = store.get<{ suspended: number }>(
            'SELECT suspended FROM users WHERE id=?',
            user.id,
          );
        if (
          !current ||
          !active ||
          active.suspended ||
          current.version !== body.version ||
          current.job_id ||
          current.confirmed_version !== reservation.row.confirmed_version ||
          current.confirmed_hash !== reservation.row.confirmed_hash
        ) {
          store.run(
            `UPDATE studio_ai_runs SET status='stale',error_code='STUDIO_CHANGED' WHERE id=?`,
            run.id,
          );
          return 'stale';
        }
        const version = revise(store, current, result.brief, 'openai');
        store.run(
          `UPDATE studio_ai_runs SET status='complete',result_version=? WHERE id=?`,
          version,
          run.id,
        );
        return 'complete';
      });
    } catch {
      // A concurrent write can consume history capacity after reservation. Keep the paid usage even if applying the result rolls back.
      store.run(
        `UPDATE studio_ai_runs SET status='failed',error_code='AI_NOT_APPLIED',input_tokens=?,output_tokens=?,finished_at=? WHERE id=?`,
        result.usage.inputTokens,
        result.usage.outputTokens,
        Date.now(),
        reservation.run.id,
      );
      throw new StudioAIError('AI_NOT_APPLIED', result.usage);
    }
    if (outcome === 'interrupted') throw new StudioAIError('AI_INTERRUPTED', result.usage);
    ensure(
      outcome === 'complete',
      409,
      'STUDIO_CHANGED',
      'Your brief changed while AI was running. Usage was recorded; your edits were preserved / ТЗ изменилось во время работы ИИ. Расход учтён; ваши правки сохранены',
    );
    res.json(detail(store, owned(store, projectId, user.id)));
  });
  router.post('/projects/:id/publish', (req, res) => {
    const user = requireUser(store, req),
      body = publishSchema.parse(req.body),
      projectId = id(req);
    let createdPath: string | undefined;
    try {
      const jobId = store.transaction(() => {
        const row = owned(store, projectId, user.id);
        ensure(
          row.version === body.version,
          409,
          'STUDIO_CHANGED',
          'The brief changed / ТЗ изменилось',
        );
        if (row.job_id) {
          const published = store.get<{
            visibility: string;
            target_profile_id: string | null;
            currency: string;
            budget: number | null;
          }>(
            'SELECT visibility,target_profile_id,currency,budget FROM jobs WHERE id=?',
            row.job_id,
          );
          ensure(
            published &&
              published.visibility === body.visibility &&
              published.target_profile_id === body.target_profile_id &&
              published.currency === body.currency &&
              published.budget === body.budget,
            409,
            'STUDIO_PUBLICATION_CHANGED',
            'This version is already published with different visibility, provider or budget / Эта версия уже опубликована с другими настройками доступа, исполнителем или бюджетом',
          );
          return row.job_id;
        }
        confirmed(store, row);
        const brief = briefOf(row),
          description = handoffDescription(row, brief),
          kind = brief.requestKind === 'manufacture' ? 'print' : 'design';
        assertDaily(store, user.id, 'job.created', 20);
        const target = body.target_profile_id
          ? store.get<{ user_id: string; kind: string }>(
              'SELECT p.user_id,p.kind FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.published=1 AND u.suspended=0',
              body.target_profile_id,
            )
          : undefined;
        if (body.target_profile_id)
          ensure(
            target &&
              target.user_id !== user.id &&
              !blocked(store, user.id, target.user_id) &&
              (kind === 'design' ? target.kind !== 'studio' : target.kind !== 'engineer'),
            400,
            'TARGET_INVALID',
            'Choose an available provider with the required role / Выберите доступного исполнителя с подходящей ролью',
          );
        let fileId: string | null = null;
        if (row.model_stl) {
          const bytes = Buffer.from(row.model_stl),
            packet = JSON.parse(row.packet!) as ReturnType<typeof studioPacket>;
          ensure(
            packet.manifest.some(
              (file) => file.path === 'model.stl' && file.sha256 === digest(bytes),
            ),
            409,
            'MODEL_INTEGRITY',
            'Model integrity check failed / Контроль целостности модели не пройден',
          );
          validateModel('model.stl', bytes);
          const ownSize = store.get<{ n: number }>(
            'SELECT COALESCE(sum(size),0) AS n FROM files WHERE owner_id=?',
            user.id,
          )!.n;
          const totalSize = store.get<{ n: number }>(
            'SELECT COALESCE(sum(size),0) AS n FROM files',
          )!.n;
          ensure(
            ownSize + bytes.length <= (options.userLimit ?? 200 * 1024 * 1024) &&
              totalSize + bytes.length <= (options.totalLimit ?? 1024 * 1024 * 1024),
            413,
            'STORAGE_LIMIT',
            'Storage quota reached / Недостаточно места в хранилище',
          );
          fileId = randomUUID();
          const storageName = `${fileId}.stl`,
            directory = uploadDirectory(dataDir);
          mkdirSync(directory, { recursive: true, mode: 0o700 });
          const destination = join(directory, storageName);
          writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 });
          createdPath = destination;
          store.run(
            'INSERT INTO files(id,owner_id,name,storage_name,size,sha256,created_at) VALUES(?,?,?,?,?,?,?)',
            fileId,
            user.id,
            `neofab-${row.id}-v${row.version}.stl`,
            storageName,
            bytes.length,
            digest(bytes),
            Date.now(),
          );
        }
        const jobId = randomUUID(),
          technology = ['MIXED', 'UNSURE'].includes(brief.process) ? 'Any' : brief.process;
        store.run(
          `INSERT INTO jobs(id,owner_id,title,description,kind,city,technology,material,quantity,currency,budget,visibility,target_profile_id,file_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          jobId,
          user.id,
          brief.title,
          description,
          kind,
          brief.city,
          technology,
          brief.material || 'Any',
          brief.quantity!,
          body.currency,
          body.budget,
          body.visibility,
          body.target_profile_id,
          fileId,
          Date.now(),
        );
        const cad = cadSnapshot(store, row.id, row.version);
        if (cad) {
          store.run(
            'INSERT INTO studio_cad_handoffs(job_id,build_id,packet,created_at) VALUES(?,?,?,?)',
            jobId,
            cad.build_id,
            row.packet!,
            Date.now(),
          );
          if (target)
            store.run(
              'INSERT INTO studio_cad_grants(job_id,provider_id,created_at) VALUES(?,?,?)',
              jobId,
              target.user_id,
              Date.now(),
            );
        }
        store.run(
          'UPDATE studio_projects SET job_id=?,file_id=?,updated_at=? WHERE id=? AND job_id IS NULL',
          jobId,
          fileId,
          Date.now(),
          row.id,
        );
        if (target)
          notify(store, target.user_id, `job.direct|${brief.title}`, `/projects/${jobId}`);
        event(store, user.id, 'job.created', jobId);
        event(store, user.id, 'studio.published', row.id, `${row.version}:${row.confirmed_hash}`);
        return jobId;
      });
      createdPath = undefined; // The transaction committed; response errors must not remove a published artifact.
      res.json({ job_id: jobId, project: projectObject(store, owned(store, projectId, user.id)) });
    } catch (error) {
      if (createdPath) {
        try {
          unlinkSync(createdPath);
        } catch {
          /* DB rollback leaves no file reference. */
        }
      }
      throw error;
    }
  });
  return router;
}
