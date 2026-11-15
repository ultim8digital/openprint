import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './database.js';
import { cadSpecSchema, type CadState } from '../shared/cad.js';
import { requireUser, ensure, event, digest } from './security.js';
import { assignedTo, blocked, visibleJob } from './domain.js';
import { owned, editable, revise, projectObject, type ProjectRow } from './studio.js';
import { canonicalJSON } from './studio-geometry.js';
import { CadService, CAD_MAX_BYTES } from './cad-runner.js';
import {
  cadRevision,
  latestCadRevision,
  cadBuild,
  currentCadBuild,
  type CadBuildRow,
} from './cad-data.js';
const id = (req: Request, name = 'id') => z.string().uuid().parse(req.params[name]);
const versionSchema = z.object({ version: z.number().int().positive() }).strict();
const buildSchema = versionSchema.extend({ requestId: z.string().uuid() }).strict();
const saveSchema = versionSchema.extend({ spec: cadSpecSchema }).strict();
function state(service: CadService, projectId: string): CadState {
  return {
    capabilities: service.capabilities,
    revision: cadRevision(latestCadRevision(service.store, projectId)),
    builds: service.store
      .all<CadBuildRow>(
        'SELECT * FROM studio_cad_builds WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 30',
        projectId,
      )
      .map((row) => cadBuild(service.store, row)),
  };
}
function ownedBuild(store: Store, projectId: string, buildId: string) {
  const row = store.get<CadBuildRow>(
    'SELECT * FROM studio_cad_builds WHERE id=? AND project_id=?',
    buildId,
    projectId,
  );
  ensure(row, 404, 'NOT_FOUND', 'CAD build not found / Сборка CAD не найдена');
  return row;
}
function artifact(store: Store, buildId: string, name: unknown, res: Response) {
  ensure(typeof name === 'string' && name.length <= 140, 404, 'NOT_FOUND', 'Artifact not found');
  const file = store.get<{ size: number; sha256: string; content: Uint8Array }>(
    'SELECT size,sha256,content FROM studio_cad_artifacts WHERE build_id=? AND name=?',
    buildId,
    name,
  );
  ensure(file, 404, 'NOT_FOUND', 'CAD artifact not found / Файл CAD не найден');
  const bytes = Buffer.from(file.content);
  ensure(digest(bytes) === file.sha256, 500, 'CAD_INTEGRITY', 'Artifact integrity check failed');
  const types: Record<string, string> = {
    step: 'application/step',
    stl: 'model/stl',
    json: 'application/json',
    zip: 'application/zip',
    csv: 'text/csv; charset=utf-8',
  };
  res
    .set('X-Content-SHA256', file.sha256)
    .attachment(name.replaceAll('/', '-'))
    .type(types[name.split('.').at(-1)!] ?? 'application/octet-stream')
    .send(bytes);
}
function grantAccess(store: Store, jobId: string, user: ReturnType<typeof requireUser>) {
  const job = visibleJob(store, jobId, user);
  const owner = job.owner_id === user.id;
  const allowed =
    owner ||
    assignedTo(store, job, user.id) ||
    (!blocked(store, job.owner_id, user.id) &&
      !!store.get(
        'SELECT 1 FROM studio_cad_grants WHERE job_id=? AND provider_id=?',
        jobId,
        user.id,
      ));
  return { job, owner, allowed };
}
export function createCadRouter(service: CadService) {
  const store = service.store,
    router = Router();
  router.get('/studio/projects/:id/cad', (req, res) => {
    const user = requireUser(store, req),
      project = owned(store, id(req), user.id);
    res.json(state(service, project.id));
  });
  const save = (req: Request, res: Response, detach: boolean) => {
    const user = requireUser(store, req),
      body = detach ? versionSchema.parse(req.body) : saveSchema.parse(req.body),
      projectId = id(req);
    store.transaction(() => {
      const project = owned(store, projectId, user.id);
      editable(project, body.version);
      const current = latestCadRevision(store, projectId);
      const spec = 'spec' in body ? canonicalJSON(body.spec) : null;
      if ((current?.spec ?? null) === spec) return;
      ensure(
        !spec || !JSON.parse(project.brief).part,
        409,
        'CAD_TEMPLATE_CONFLICT',
        'Remove and save the simple template before attaching CAD / Сначала удалите и сохраните простой шаблон',
      );
      const ownBytes = store.get<{ n: number }>(
        'SELECT COALESCE(sum(length(CAST(r.spec AS BLOB))),0) n FROM studio_cad_revisions r JOIN studio_projects p ON p.id=r.project_id WHERE p.owner_id=?',
        user.id,
      )!.n;
      const totalBytes = store.get<{ n: number }>(
        'SELECT COALESCE(sum(length(CAST(spec AS BLOB))),0) n FROM studio_cad_revisions',
      )!.n;
      const added = spec ? Buffer.byteLength(spec) : 0;
      ensure(
        added <= 90000 &&
          ownBytes + added <= 20 * 1024 * 1024 &&
          totalBytes + added <= 200 * 1024 * 1024,
        413,
        'CAD_SPEC_LIMIT',
        'CAD specification quota reached / Достигнут лимит спецификаций CAD',
      );
      const version = revise(store, project, JSON.parse(project.brief), 'manual', true);
      store.run(
        'INSERT INTO studio_cad_revisions(id,project_id,number,project_version,spec,sha256,created_at) VALUES(?,?,?,?,?,?,?)',
        randomUUID(),
        projectId,
        (current?.number ?? 0) + 1,
        version,
        spec,
        spec ? digest(spec) : null,
        Date.now(),
      );
      event(store, user.id, detach ? 'cad.detached' : 'cad.saved', projectId, String(version));
    });
    res.json({
      project: projectObject(store, owned(store, projectId, user.id)),
      cad: state(service, projectId),
    });
  };
  router.put('/studio/projects/:id/cad', (req, res) => save(req, res, false));
  router.delete('/studio/projects/:id/cad', (req, res) => save(req, res, true));
  router.post('/studio/projects/:id/cad/build', (req, res) => {
    const user = requireUser(store, req),
      body = buildSchema.parse(req.body),
      projectId = id(req);
    const result = store.transaction(() => {
      const project = owned(store, projectId, user.id);
      const replay = store.get<CadBuildRow>(
        'SELECT * FROM studio_cad_builds WHERE owner_id=? AND project_id=? AND request_id=?',
        user.id,
        projectId,
        body.requestId,
      );
      if (replay) {
        ensure(
          replay.project_version === body.version,
          409,
          'CAD_REQUEST_CHANGED',
          'Request ID belongs to another version',
        );
        return replay;
      }
      editable(project, body.version);
      const revision = latestCadRevision(store, projectId);
      ensure(
        revision?.spec,
        409,
        'CAD_SPEC_REQUIRED',
        'Save a CAD specification first / Сначала сохраните спецификацию CAD',
      );
      const existing =
        currentCadBuild(store, projectId, project.version) ??
        store.get<CadBuildRow>(
          "SELECT * FROM studio_cad_builds WHERE project_id=? AND project_version=? AND revision_id=? AND status IN ('queued','running')",
          projectId,
          project.version,
          revision.id,
        );
      if (existing) return existing;
      ensure(
        service.capabilities.configured,
        503,
        'CAD_NOT_CONFIGURED',
        'CAD engine is not configured / CAD-движок не настроен',
      );
      ensure(
        !store.get(
          "SELECT 1 FROM studio_cad_builds WHERE owner_id=? AND status IN ('queued','running')",
          user.id,
        ),
        409,
        'CAD_BUSY',
        'Wait for or cancel your current CAD build / Дождитесь или отмените текущую сборку CAD',
      );
      const stats = store.get<{ project: number; owner: number; total: number; pending: number }>(
        `SELECT (SELECT count(*) FROM studio_cad_builds WHERE project_id=?) project,COALESCE(sum(CASE WHEN actor_id=? THEN 1 ELSE 0 END),0) owner,count(*) total,(SELECT count(*) FROM studio_cad_builds WHERE status IN ('queued','running')) pending FROM events WHERE action='cad.queued' AND created_at>?`,
        projectId,
        user.id,
        Date.now() - 86400000,
      )!;
      const limits = service.capabilities.limits;
      ensure(
        stats.project < limits.maxBuildsPerProject &&
          stats.owner < limits.maxBuildsPerUserDay &&
          stats.total < limits.maxBuildsPerInstanceDay &&
          stats.pending < 10,
        429,
        'CAD_BUILD_LIMIT',
        'CAD build limit reached / Достигнут лимит сборок CAD',
      );
      service.assertStorage(user.id, CAD_MAX_BYTES);
      const buildId = randomUUID();
      store.run(
        "INSERT INTO studio_cad_builds(id,owner_id,project_id,revision_id,project_version,request_id,status,created_at) VALUES(?,?,?,?,?,?,'queued',?)",
        buildId,
        user.id,
        projectId,
        revision.id,
        project.version,
        body.requestId,
        Date.now(),
      );
      event(store, user.id, 'cad.queued', projectId, buildId);
      return ownedBuild(store, projectId, buildId);
    });
    res.status(202).json({ build: cadBuild(store, result) });
    service.kick();
  });
  router.post('/studio/projects/:id/cad/builds/:buildId/cancel', (req, res) => {
    const user = requireUser(store, req),
      project = owned(store, id(req), user.id);
    z.object({}).strict().parse(req.body);
    const build = ownedBuild(store, project.id, id(req, 'buildId'));
    service.cancel(build.id);
    event(store, user.id, 'cad.cancelled', project.id, build.id);
    res.json({ build: cadBuild(store, ownedBuild(store, project.id, build.id)) });
  });
  router.get('/studio/projects/:id/cad/builds/:buildId/artifacts/:name', (req, res) => {
    const user = requireUser(store, req),
      project = owned(store, id(req), user.id),
      build = ownedBuild(store, project.id, id(req, 'buildId'));
    ensure(build.status === 'succeeded', 404, 'NOT_FOUND', 'CAD artifact not available');
    artifact(store, build.id, req.params.name, res);
  });
  router.get('/jobs/:id/cad', (req, res) => {
    const user = requireUser(store, req),
      jobId = id(req),
      access = grantAccess(store, jobId, user);
    const handoff = store.get<{ build_id: string; packet: string }>(
      'SELECT * FROM studio_cad_handoffs WHERE job_id=?',
      jobId,
    );
    if (!handoff) {
      res.json({ available: false, access: false });
      return;
    }
    if (!access.allowed) {
      res.json({ available: true, access: false });
      return;
    }
    const build = store.get<CadBuildRow>(
      'SELECT * FROM studio_cad_builds WHERE id=?',
      handoff.build_id,
    )!;
    const participants = access.owner
      ? store.all<{ provider_id: string; name: string; allowed: number }>(
          `SELECT DISTINCT p.user_id provider_id,p.name,CASE WHEN g.provider_id IS NULL THEN 0 ELSE 1 END allowed FROM profiles p LEFT JOIN conversations c ON c.provider_id=p.user_id AND c.job_id=? LEFT JOIN studio_cad_grants g ON g.provider_id=p.user_id AND g.job_id=? JOIN users u ON u.id=p.user_id WHERE (c.id IS NOT NULL OR p.id=?) AND u.suspended=0 ORDER BY p.name`,
          jobId,
          jobId,
          access.job.target_profile_id ?? '',
        )
      : [];
    const packet = JSON.parse(handoff.packet);
    res.json({
      available: true,
      access: true,
      build: cadBuild(store, build),
      version: packet.version,
      confirmed_hash: packet.confirmed_hash,
      participants,
    });
  });
  router.post('/jobs/:id/cad/grants', (req, res) => {
    const user = requireUser(store, req),
      jobId = id(req),
      body = z
        .object({ provider_id: z.string().uuid(), allow: z.boolean() })
        .strict()
        .parse(req.body);
    store.transaction(() => {
      const { job, owner } = grantAccess(store, jobId, user);
      ensure(owner, 403, 'FORBIDDEN', 'Only the project owner can grant CAD access');
      ensure(
        store.get('SELECT 1 FROM studio_cad_handoffs WHERE job_id=?', jobId),
        404,
        'NOT_FOUND',
        'CAD handoff not found',
      );
      if (body.allow) {
        const provider = store.get<{ user_id: string }>(
          'SELECT p.user_id FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND p.published=1 AND u.suspended=0',
          body.provider_id,
        );
        ensure(
          provider &&
            !blocked(store, user.id, provider.user_id) &&
            (store.get(
              'SELECT 1 FROM conversations WHERE job_id=? AND provider_id=?',
              jobId,
              provider.user_id,
            ) ||
              store.get(
                'SELECT 1 FROM profiles WHERE id=? AND user_id=?',
                job.target_profile_id ?? '',
                provider.user_id,
              )),
          400,
          'CAD_PROVIDER_INVALID',
          'Choose a participant in this project / Выберите участника обсуждения этого проекта',
        );
        store.run(
          'INSERT OR IGNORE INTO studio_cad_grants(job_id,provider_id,created_at) VALUES(?,?,?)',
          jobId,
          provider.user_id,
          Date.now(),
        );
      } else {
        ensure(
          !assignedTo(store, job, body.provider_id),
          409,
          'CAD_ASSIGNED',
          'The selected provider retains access / Выбранный исполнитель сохраняет доступ',
        );
        store.run(
          'DELETE FROM studio_cad_grants WHERE job_id=? AND provider_id=?',
          jobId,
          body.provider_id,
        );
      }
      event(
        store,
        user.id,
        body.allow ? 'cad.access_granted' : 'cad.access_revoked',
        jobId,
        body.provider_id,
      );
    });
    res.json({ ok: true });
  });
  router.get('/jobs/:id/cad/artifacts/:name', (req, res) => {
    const user = requireUser(store, req),
      jobId = id(req),
      access = grantAccess(store, jobId, user);
    ensure(access.allowed, 404, 'NOT_FOUND', 'CAD artifact not found');
    const handoff = store.get<{ build_id: string }>(
      'SELECT build_id FROM studio_cad_handoffs WHERE job_id=?',
      jobId,
    );
    ensure(handoff, 404, 'NOT_FOUND', 'CAD artifact not found');
    artifact(store, handoff.build_id, req.params.name, res);
  });
  router.get('/jobs/:id/cad/packet', (req, res) => {
    const user = requireUser(store, req),
      jobId = id(req),
      access = grantAccess(store, jobId, user);
    ensure(access.allowed, 404, 'NOT_FOUND', 'CAD packet not found');
    const handoff = store.get<{ packet: string }>(
      'SELECT packet FROM studio_cad_handoffs WHERE job_id=?',
      jobId,
    );
    ensure(handoff, 404, 'NOT_FOUND', 'CAD packet not found');
    res.attachment(`neofab-${jobId}.json`).type('application/json').send(handoff.packet);
  });
  return router;
}
