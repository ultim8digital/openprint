import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { z, ZodError } from 'zod';
import { Store } from './database.js';
import {
  registration,
  login,
  profileInput,
  jobInput,
  messageInput,
  password,
} from '../shared/validation.js';
import {
  HttpError,
  ensure,
  requireUser,
  requireAdmin,
  readUser,
  hashPassword,
  verifyPassword,
  digest,
  createSession,
  revokeSession,
  rateLimiter,
  notify,
  event,
  isLoopback,
} from './security.js';
import {
  profileObject,
  ownProfile,
  jobObject,
  jobSelect,
  offerSelect,
  visibleJob,
  assignedTo,
  assertDaily,
  sendOffer,
  acceptOffer,
  conversationAccess,
  blocked,
  type ProfileRow,
  type JobRow,
} from './domain.js';
import { saveUpload, uploadDirectory, canReadFile, type FileRow } from './files.js';
import type { Offer, User } from '../shared/types.js';
import { createStudioRouter } from './studio.js';
import type { StudioAIConfig } from './studio-ai.js';
import { CadService, type CadOptions } from './cad-runner.js';
import { createCadRouter } from './cad.js';
import { createCadAIRouter } from './cad-ai.js';

type Options = {
  store: Store;
  dataDir: string;
  appUrl: string;
  demo?: boolean;
  development?: boolean;
  trustProxy?: boolean;
  userLimit?: number;
  totalLimit?: number;
  staticDir?: string;
  studioAI?: StudioAIConfig;
  cad?: CadOptions;
};
const id = (req: Request, key = 'id') => z.string().uuid().parse(req.params[key]);
const textQuery = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, 100) : '');
const pageQuery = (value: unknown, max = 200) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : 24;
};

export function createApp(options: Options) {
  const { store, dataDir } = options;
  const app = express();
  const origin = new URL(options.appUrl).origin;
  const secure = new URL(origin).protocol === 'https:';
  const throttle = rateLimiter();
  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxy ? 1 : false);
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    });
    if (options.development) res.removeHeader('Content-Security-Policy'); // Vite HMR; production keeps the policy above.
    if (secure) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const allowed = [
        origin,
        ...(options.development
          ? [
              'http://localhost:5173',
              'http://127.0.0.1:5173',
              'http://127.0.0.1:3000',
              'http://localhost:3000',
            ]
          : []),
      ];
      if (!allowed.includes(req.headers.origin || '')) {
        next(new HttpError(403, 'ORIGIN', 'Request origin rejected / Источник запроса отклонён'));
        return;
      }
      if (req.path !== '/files' && !req.is('application/json')) {
        next(new HttpError(415, 'CONTENT_TYPE', 'Send JSON'));
        return;
      }
    }
    next();
  });
  app.use('/api', throttle('api', 240));
  app.use(express.json({ limit: '96kb' }));
  const cad = new CadService(store, dataDir, options.cad);
  app.locals.cad = cad;
  app.use('/api', createCadRouter(cad));
  app.use('/api', createCadAIRouter(cad, options.studioAI));
  app.use(
    '/api/studio',
    createStudioRouter({
      store,
      dataDir,
      ai: options.studioAI,
      userLimit: options.userLimit,
      totalLimit: options.totalLimit,
    }),
  );

  app.get('/api/health', (_req, res) => {
    store.get('SELECT 1');
    res.json({ status: 'ok', version: '0.3.0' });
  });
  app.get('/api/bootstrap', (req, res) => {
    const user = readUser(store, req);
    const profile = user ? ownProfile(store, user.id) : undefined;
    const stats = {
      profiles: store.get<{ n: number }>(
        'SELECT count(*) AS n FROM profiles p JOIN users u ON p.user_id=u.id WHERE published=1 AND u.suspended=0',
      )!.n,
      projects: store.get<{ n: number }>(
        "SELECT count(*) AS n FROM jobs WHERE visibility='public' AND status='open' AND moderated=0",
      )!.n,
      models: store.get<{ n: number }>('SELECT count(*) AS n FROM models WHERE published=1')!.n,
      completed: store.get<{ n: number }>(
        "SELECT count(*) AS n FROM jobs WHERE status='completed'",
      )!.n,
    };
    const unread = user
      ? store.get<{ n: number }>(
          'SELECT count(*) AS n FROM notifications WHERE user_id=? AND seen=0',
          user.id,
        )!.n
      : 0;
    const demoUsers =
      options.demo && isLoopback(req)
        ? store.all<Pick<User, 'id' | 'name' | 'email'>>(
            'SELECT id,name,email FROM users WHERE email LIKE ? ORDER BY created_at',
            '%@demo.example',
          )
        : [];
    const contact = process.env.OPERATOR_CONTACT || '';
    res.json({
      user,
      profile: profile ? profileObject(profile) : null,
      stats,
      unread,
      demo: !!options.demo,
      demoUsers,
      instance: process.env.INSTANCE_NAME || 'OpenPrint',
      operatorContact: /^(https:\/\/|mailto:)[^\s<>"']+$/i.test(contact) ? contact : '',
    });
  });

  app.post('/api/auth/register', throttle('auth', 10, 15 * 60000), async (req, res) => {
    const body = registration.parse(req.body);
    const hash = await hashPassword(body.password);
    const userId = randomUUID();
    store.transaction(() => {
      ensure(
        !store.get('SELECT 1 FROM users WHERE email=?', body.email),
        409,
        'EMAIL_EXISTS',
        'Unable to register this email. Try signing in or contact the instance operator / Не удалось зарегистрировать адрес. Попробуйте войти или обратитесь к владельцу сервера',
      );
      store.run(
        'INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)',
        userId,
        body.email,
        body.name,
        hash,
        Date.now(),
      );
      createSession(store, res, userId, secure);
      event(store, userId, 'user.registered', userId);
    });
    res.status(201).json({ ok: true });
  });
  app.post('/api/auth/login', throttle('auth', 10, 15 * 60000), async (req, res) => {
    const body = login.parse(req.body);
    const user = store.get<User & { password_hash: string; suspended: number }>(
      'SELECT * FROM users WHERE email=?',
      body.email,
    );
    const match = await verifyPassword(body.password, user?.password_hash || '');
    ensure(
      user && match && !user.suspended,
      401,
      'LOGIN_FAILED',
      'Email or password is incorrect / Неверный адрес или пароль',
    );
    revokeSession(store, req, res, secure);
    createSession(store, res, user.id, secure);
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', (req, res) => {
    revokeSession(store, req, res, secure);
    res.json({ ok: true });
  });
  app.post('/api/auth/demo', (req, res) => {
    ensure(options.demo && isLoopback(req), 404, 'NOT_FOUND', 'Not found');
    const userId = z.string().uuid().parse(req.body.user_id);
    ensure(
      store.get('SELECT 1 FROM users WHERE id=? AND email LIKE ?', userId, '%@demo.example'),
      404,
      'NOT_FOUND',
      'Not found',
    );
    revokeSession(store, req, res, secure);
    createSession(store, res, userId, secure);
    res.json({ ok: true });
  });
  app.post('/api/auth/recover', throttle('recovery', 8, 15 * 60000), async (req, res) => {
    const body = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password }).parse(req.body);
    const hash = await hashPassword(body.password);
    store.transaction(() => {
      const token = store.get<{ user_id: string; promote_admin: number }>(
        'SELECT user_id,promote_admin FROM reset_tokens WHERE token_hash=? AND expires_at>?',
        digest(body.token),
        Date.now(),
      );
      ensure(
        token,
        400,
        'TOKEN_INVALID',
        'Token expired or already used / Ссылка истекла или уже использована',
      );
      ensure(
        store.get('SELECT 1 FROM users WHERE id=? AND suspended=0', token.user_id),
        400,
        'TOKEN_INVALID',
        'Account unavailable',
      );
      store.run(
        "UPDATE users SET password_hash=?,role=CASE WHEN ?=1 THEN 'admin' ELSE role END WHERE id=?",
        hash,
        token.promote_admin,
        token.user_id,
      );
      store.run('DELETE FROM reset_tokens WHERE user_id=?', token.user_id);
      store.run('DELETE FROM sessions WHERE user_id=?', token.user_id);
      createSession(store, res, token.user_id, secure);
      event(store, token.user_id, 'password.recovered', token.user_id);
    });
    res.json({ ok: true });
  });

  app.get('/api/profiles', (req, res) => {
    const q = textQuery(req.query.q),
      city = textQuery(req.query.city),
      tech = textQuery(req.query.technology),
      kind = textQuery(req.query.kind);
    const limit = pageQuery(req.query.limit),
      offset = Math.max(0, Number.parseInt(textQuery(req.query.offset), 10) || 0);
    const rows = store.all<ProfileRow>(
      `SELECT p.* FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.published=1 AND u.suspended=0
      AND (?='' OR unicode_fold(p.name) LIKE unicode_fold(?) OR unicode_fold(p.city) LIKE unicode_fold(?) OR unicode_fold(p.description) LIKE unicode_fold(?)) AND (?='' OR unicode_fold(p.city) LIKE unicode_fold(?))
      AND (?='' OR EXISTS(SELECT 1 FROM json_each(p.technologies) WHERE value=?))
      AND (?='' OR p.kind=? OR p.kind='both') AND (?=0 OR p.verified=1)
      ORDER BY p.verified DESC,p.created_at DESC,p.id LIMIT ? OFFSET ?`,
      q,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      city,
      `%${city}%`,
      tech,
      tech,
      kind,
      kind,
      req.query.verified === '1' ? 1 : 0,
      limit + 1,
      offset,
    );
    res.json({ profiles: rows.slice(0, limit).map(profileObject), has_more: rows.length > limit });
  });
  app.get('/api/profiles/:id', (req, res) => {
    const profile = store.get<ProfileRow>(
      'SELECT p.* FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.published=1 AND u.suspended=0',
      id(req),
    );
    ensure(profile, 404, 'NOT_FOUND', 'Workshop not found / Мастерская не найдена');
    res.json({ profile: profileObject(profile) });
  });
  app.put('/api/profile', (req, res) => {
    const user = requireUser(store, req),
      body = profileInput.parse(req.body),
      existing = ownProfile(store, user.id),
      profileId = existing?.id || randomUUID();
    ensure(
      !existing || existing.published,
      403,
      'MODERATED',
      'Contact the moderator to restore this profile / Обратитесь к модератору для восстановления профиля',
    );
    store.run(
      `INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,website,lat,lng,remote,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,kind=excluded.kind,city=excluded.city,description=excluded.description,technologies=excluded.technologies,materials=excluded.materials,website=excluded.website,lat=excluded.lat,lng=excluded.lng,remote=excluded.remote,verified=0`,
      profileId,
      user.id,
      body.name,
      body.kind,
      body.city,
      body.description,
      JSON.stringify([...new Set(body.technologies)]),
      JSON.stringify([...new Set(body.materials)]),
      body.website,
      body.lat,
      body.lng,
      body.remote ? 1 : 0,
      Date.now(),
    );
    event(store, user.id, 'profile.updated', profileId);
    res.json({ profile: profileObject(ownProfile(store, user.id)!) });
  });

  app.get('/api/projects', (req, res) => {
    const q = textQuery(req.query.q),
      city = textQuery(req.query.city),
      kind = textQuery(req.query.kind);
    const limit = pageQuery(req.query.limit),
      offset = Math.max(0, Number.parseInt(textQuery(req.query.offset), 10) || 0);
    const rows = store.all<JobRow>(
      `${jobSelect} WHERE j.visibility='public' AND j.status='open' AND j.moderated=0
      AND (?='' OR unicode_fold(j.title) LIKE unicode_fold(?) OR unicode_fold(j.description) LIKE unicode_fold(?)) AND (?='' OR unicode_fold(j.city) LIKE unicode_fold(?)) AND (?='' OR j.kind=?)
      ORDER BY j.created_at DESC,j.id LIMIT ? OFFSET ?`,
      q,
      `%${q}%`,
      `%${q}%`,
      city,
      `%${city}%`,
      kind,
      kind,
      limit + 1,
      offset,
    );
    res.json({
      projects: rows.slice(0, limit).map((row) => jobObject(row)),
      has_more: rows.length > limit,
    });
  });
  app.post('/api/projects', (req, res) => {
    const user = requireUser(store, req),
      body = jobInput.parse(req.body),
      jobId = randomUUID();
    store.transaction(() => {
      assertDaily(store, user.id, 'job.created', 20);
      if (body.file_id)
        ensure(
          store.get('SELECT 1 FROM files WHERE id=? AND owner_id=?', body.file_id, user.id),
          400,
          'FILE_INVALID',
          'Choose your own file / Выберите свой файл',
        );
      if (body.target_profile_id) {
        const target = store.get<{ user_id: string }>(
          'SELECT p.user_id FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.published=1 AND u.suspended=0',
          body.target_profile_id,
        );
        ensure(
          target && target.user_id !== user.id && !blocked(store, user.id, target.user_id),
          400,
          'TARGET_INVALID',
          'Choose another workshop / Выберите другую мастерскую',
        );
      }
      store.run(
        `INSERT INTO jobs(id,owner_id,title,description,kind,city,technology,material,quantity,currency,budget,deadline,visibility,target_profile_id,file_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        jobId,
        user.id,
        body.title,
        body.description,
        body.kind,
        body.city,
        body.technology,
        body.material,
        body.quantity,
        body.currency,
        body.budget,
        body.deadline,
        body.visibility,
        body.target_profile_id,
        body.file_id,
        Date.now(),
      );
      if (body.target_profile_id) {
        const target = store.get<{ user_id: string }>(
          'SELECT user_id FROM profiles WHERE id=?',
          body.target_profile_id,
        )!;
        notify(store, target.user_id, `job.direct|${body.title}`, `/projects/${jobId}`);
      }
      event(store, user.id, 'job.created', jobId);
    });
    res.status(201).json({ id: jobId });
  });
  app.get('/api/projects/:id', (req, res) => {
    const user = readUser(store, req),
      job = visibleJob(store, id(req), user),
      owner = user?.id === job.owner_id,
      assigned = assignedTo(store, job, user?.id);
    const offers = user
      ? store.all<Offer>(
          `${offerSelect} WHERE f.job_id=? AND (?=1 OR f.provider_id=?) ORDER BY f.created_at DESC,f.revision DESC`,
          job.id,
          owner ? 1 : 0,
          user.id,
        )
      : [];
    const file =
      (owner || assigned) && job.file_id
        ? store.get<Pick<FileRow, 'id' | 'name' | 'size'>>(
            'SELECT id,name,size FROM files WHERE id=?',
            job.file_id,
          )
        : null;
    const conversation =
      user && !owner
        ? store.get<{ id: string }>(
            'SELECT id FROM conversations WHERE job_id=? AND provider_id=?',
            job.id,
            user.id,
          )
        : null;
    const conversations = owner
      ? store.all(
          'SELECT c.id,c.provider_id,p.name AS profile_name FROM conversations c JOIN profiles p ON p.user_id=c.provider_id WHERE c.job_id=?',
          job.id,
        )
      : [];
    res.json({
      job: jobObject(job, owner || assigned),
      offers,
      file,
      can_download: !!file,
      owner,
      assigned,
      conversation_id: conversation?.id ?? null,
      conversations,
    });
  });
  app.post('/api/projects/:id/conversation', throttle('new-conversation', 20), (req, res) => {
    const user = requireUser(store, req),
      job = visibleJob(store, id(req), user),
      profile = ownProfile(store, user.id);
    ensure(
      profile?.published && user.id !== job.owner_id,
      403,
      'PROFILE_REQUIRED',
      'Create your maker profile first / Сначала создайте профиль участника',
    );
    ensure(
      job.status === 'open' && !job.moderated && !blocked(store, user.id, job.owner_id),
      409,
      'JOB_CLOSED',
      'This project is unavailable / Проект недоступен',
    );
    const existing = store.get<{ id: string }>(
      'SELECT id FROM conversations WHERE job_id=? AND provider_id=?',
      job.id,
      user.id,
    );
    if (existing) {
      res.json(existing);
      return;
    }
    const conversationId = randomUUID();
    store.transaction(() => {
      assertDaily(store, user.id, 'conversation.created', 20);
      store.run(
        'INSERT INTO conversations(id,job_id,provider_id) VALUES(?,?,?)',
        conversationId,
        job.id,
        user.id,
      );
      event(store, user.id, 'conversation.created', conversationId);
    });
    res.status(201).json({ id: conversationId });
  });
  app.post('/api/projects/:id/offers', (req, res) => {
    const user = requireUser(store, req);
    res.status(201).json({ offer: sendOffer(store, user, id(req), req.body) });
  });
  app.post('/api/projects/:id/accept', (req, res) => {
    const user = requireUser(store, req),
      body = z
        .object({
          offer_id: z.string().uuid(),
          revision: z.number().int().positive(),
          version: z.number().int().positive(),
        })
        .parse(req.body);
    res.json({
      terms: acceptOffer(store, user, id(req), body.offer_id, body.revision, body.version),
    });
  });
  app.post('/api/projects/:id/status', (req, res) => {
    const user = requireUser(store, req),
      job = visibleJob(store, id(req), user),
      body = z.object({ action: z.enum(['cancel', 'deliver', 'complete']) }).parse(req.body);
    const owner = job.owner_id === user.id,
      assigned = assignedTo(store, job, user.id);
    let status = '';
    if (body.action === 'cancel') {
      ensure(
        owner && job.status === 'open',
        409,
        'TRANSITION',
        'Only an open project can be cancelled / Отменить можно открытый проект',
      );
      status = 'cancelled';
    }
    if (body.action === 'deliver') {
      ensure(
        assigned && job.status === 'assigned',
        409,
        'TRANSITION',
        'Only the selected provider can mark delivery / Передать результат может выбранный исполнитель',
      );
      status = 'delivered';
    }
    if (body.action === 'complete') {
      ensure(
        owner && job.status === 'delivered',
        409,
        'TRANSITION',
        'The customer confirms delivery / Заказчик подтверждает полученный результат',
      );
      status = 'completed';
    }
    store.transaction(() => {
      store.run('UPDATE jobs SET status=?,version=version+1 WHERE id=?', status, job.id);
      if (status === 'cancelled')
        store.run("UPDATE offers SET status='declined' WHERE job_id=? AND status='active'", job.id);
      if (job.accepted_offer_id) {
        const provider = store.get<{ provider_id: string }>(
          'SELECT provider_id FROM offers WHERE id=?',
          job.accepted_offer_id,
        )!;
        notify(
          store,
          owner ? provider.provider_id : job.owner_id,
          `job.${status}|${job.title}`,
          `/projects/${job.id}`,
        );
      }
      event(store, user.id, `job.${status}`, job.id);
    });
    res.json({ ok: true });
  });
  app.post('/api/offers/:id/withdraw', (req, res) => {
    const user = requireUser(store, req),
      offer = store.get<Offer>(
        'SELECT * FROM offers WHERE id=? AND provider_id=?',
        id(req),
        user.id,
      );
    ensure(
      offer?.status === 'active',
      409,
      'OFFER_STALE',
      'Offer is no longer active / Предложение уже неактивно',
    );
    store.run("UPDATE offers SET status='withdrawn' WHERE id=?", offer.id);
    event(store, user.id, 'offer.withdrawn', offer.id);
    res.json({ ok: true });
  });

  app.get('/api/conversations/:id/messages', (req, res) => {
    const user = requireUser(store, req),
      conversation = conversationAccess(store, id(req), user);
    const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER,
      after = Number(req.query.after) || 0;
    const rows = store.all(
      `SELECT m.id,m.conversation_id,m.author_id,u.name AS author_name,CASE WHEN m.hidden=1 THEN '' ELSE m.body END AS body,m.hidden,m.created_at FROM messages m LEFT JOIN users u ON u.id=m.author_id WHERE m.conversation_id=? AND m.id<? AND m.id>? ORDER BY m.id ${after ? 'ASC' : 'DESC'} LIMIT 51`,
      conversation.id,
      before,
      after,
    );
    const hasMore = rows.length > 50;
    const page = rows.slice(0, 50);
    if (!after) page.reverse();
    res.json({
      messages: page.map((m) => ({ ...m, hidden: !!m.hidden })),
      has_more: hasMore,
      blocked: blocked(store, conversation.owner_id, conversation.provider_id),
      blocked_by_me: !!store.get(
        'SELECT 1 FROM blocks WHERE owner_id=? AND blocked_id=?',
        user.id,
        user.id === conversation.owner_id ? conversation.provider_id : conversation.owner_id,
      ),
      status: conversation.status,
    });
  });
  app.post('/api/conversations/:id/messages', throttle('messages', 30), (req, res) => {
    const user = requireUser(store, req),
      conversation = conversationAccess(store, id(req), user),
      body = messageInput.parse(req.body);
    ensure(
      !blocked(store, conversation.owner_id, conversation.provider_id),
      403,
      'BLOCKED',
      'Contact blocked / Общение заблокировано',
    );
    ensure(
      !['completed', 'cancelled'].includes(conversation.status),
      409,
      'THREAD_CLOSED',
      'This project is archived / Проект в архиве',
    );
    store.transaction(() => {
      assertDaily(store, user.id, 'message.sent', 500);
      store.run(
        'INSERT INTO messages(conversation_id,author_id,body,created_at) VALUES(?,?,?,?)',
        conversation.id,
        user.id,
        body.body,
        Date.now(),
      );
      notify(
        store,
        user.id === conversation.owner_id ? conversation.provider_id : conversation.owner_id,
        `message.new|${conversation.title}`,
        `/projects/${conversation.job_id}?thread=${conversation.id}`,
      );
      event(store, user.id, 'message.sent', conversation.id);
    });
    res.status(201).json({ ok: true });
  });
  app.post('/api/conversations/:id/read', (req, res) => {
    const user = requireUser(store, req),
      conversation = conversationAccess(store, id(req), user),
      body = z.object({ through: z.number().int().positive() }).parse(req.body);
    ensure(
      store.get(
        'SELECT 1 FROM messages WHERE conversation_id=? AND id=?',
        conversation.id,
        body.through,
      ),
      400,
      'CURSOR',
      'Invalid message cursor',
    );
    const column = user.id === conversation.owner_id ? 'owner_read' : 'provider_read';
    store.run(
      `UPDATE conversations SET ${column}=max(${column},?) WHERE id=?`,
      body.through,
      conversation.id,
    );
    res.json({ ok: true });
  });

  app.post(
    '/api/files',
    throttle('uploads', 15),
    (req, _res, next) => {
      requireUser(store, req);
      next();
    },
    express.raw({ type: 'application/octet-stream', limit: '20mb' }),
    (req, res) => {
      const user = requireUser(store, req);
      ensure(Buffer.isBuffer(req.body), 415, 'CONTENT_TYPE', 'Send file bytes');
      let name = '';
      try {
        name = decodeURIComponent(String(req.headers['x-file-name'] || ''));
      } catch {
        throw new HttpError(400, 'FILE_NAME', 'Invalid filename');
      }
      res.status(201).json({
        file: saveUpload(
          store,
          dataDir,
          user.id,
          name,
          req.body,
          options.userLimit ?? 200 * 1024 * 1024,
          options.totalLimit ?? 1024 * 1024 * 1024,
        ),
      });
    },
  );
  app.get('/api/files/:id', (req, res) => {
    const file = store.get<FileRow>('SELECT * FROM files WHERE id=?', id(req)),
      user = readUser(store, req);
    ensure(
      file && canReadFile(store, file, user?.id),
      404,
      'NOT_FOUND',
      'File not found / Файл недоступен',
    );
    const path = join(uploadDirectory(dataDir), file.storage_name);
    ensure(
      existsSync(path),
      404,
      'NOT_FOUND',
      'File is missing; contact the instance operator / Файл отсутствует. Свяжитесь с владельцем сервера',
    );
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': 'private, no-store',
    });
    res.download(path, file.name);
  });

  app.get('/api/models', (req, res) => {
    const q = textQuery(req.query.q),
      limit = pageQuery(req.query.limit),
      offset = Math.max(0, Number.parseInt(textQuery(req.query.offset), 10) || 0);
    const rows = store.all(
      `SELECT m.*,u.name AS author_name,f.name AS file_name,f.size AS file_size FROM models m JOIN users u ON u.id=m.owner_id LEFT JOIN files f ON f.id=m.file_id WHERE m.published=1 AND (?='' OR unicode_fold(m.title) LIKE unicode_fold(?) OR unicode_fold(m.description) LIKE unicode_fold(?)) ORDER BY m.created_at DESC,m.id LIMIT ? OFFSET ?`,
      q,
      `%${q}%`,
      `%${q}%`,
      limit + 1,
      offset,
    );
    res.json({
      models: rows.slice(0, limit).map((m) => ({
        ...m,
        preset: m.preset ? JSON.parse(String(m.preset)) : null,
        published: !!m.published,
        demo: !!m.demo,
      })),
      has_more: rows.length > limit,
    });
  });
  app.post('/api/models', (req, res) => {
    const user = requireUser(store, req),
      body = z
        .object({
          title: z.string().trim().min(5).max(120),
          description: z.string().trim().min(30).max(3000),
          category: z.enum(['parts', 'home', 'tools', 'art']),
          license: z.enum(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0']),
          attribution: z.string().trim().min(2).max(120),
          file_id: z.string().uuid(),
          rights: z.literal(true),
        })
        .parse(req.body);
    ensure(
      store.get('SELECT 1 FROM files WHERE id=? AND owner_id=?', body.file_id, user.id),
      400,
      'FILE_INVALID',
      'Choose your own file / Выберите свой файл',
    );
    const modelId = randomUUID();
    store.transaction(() => {
      assertDaily(store, user.id, 'model.created', 10);
      store.run(
        'INSERT INTO models(id,owner_id,title,description,category,license,attribution,file_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
        modelId,
        user.id,
        body.title,
        body.description,
        body.category,
        body.license,
        body.attribution,
        body.file_id,
        Date.now(),
      );
      event(store, user.id, 'model.created', modelId);
    });
    res.status(201).json({ id: modelId });
  });
  app.delete('/api/models/:id', (req, res) => {
    const user = requireUser(store, req),
      model = store.get<{ owner_id: string }>('SELECT owner_id FROM models WHERE id=?', id(req));
    ensure(model?.owner_id === user.id, 404, 'NOT_FOUND', 'Model not found');
    store.run('DELETE FROM models WHERE id=?', id(req));
    res.json({ ok: true });
  });

  app.get('/api/dashboard', (req, res) => {
    const user = requireUser(store, req),
      profile = ownProfile(store, user.id);
    const projects = store
      .all<JobRow>(`${jobSelect} WHERE j.owner_id=? ORDER BY j.created_at DESC LIMIT 200`, user.id)
      .map((j) => jobObject(j, true));
    const offers = store.all<Offer & { job_title: string; job_status: string; currency: string }>(
      `${offerSelect} JOIN jobs j ON j.id=f.job_id WHERE f.provider_id=? AND f.revision=(SELECT max(revision) FROM offers x WHERE x.job_id=f.job_id AND x.provider_id=f.provider_id) ORDER BY f.created_at DESC LIMIT 200`,
      user.id,
    );
    const direct = profile
      ? store
          .all<JobRow>(
            `${jobSelect} WHERE j.target_profile_id=? ORDER BY j.created_at DESC LIMIT 100`,
            profile.id,
          )
          .map((j) => jobObject(j))
      : [];
    const conversations = store.all(
      `SELECT c.id,c.job_id,c.provider_id,j.title,j.owner_id,p.name AS provider_name,
      (SELECT count(*) FROM messages m WHERE m.conversation_id=c.id AND m.author_id<>? AND m.hidden=0 AND m.id>CASE WHEN j.owner_id=? THEN c.owner_read ELSE c.provider_read END) AS unread
      FROM conversations c JOIN jobs j ON j.id=c.job_id LEFT JOIN profiles p ON p.user_id=c.provider_id
      WHERE j.owner_id=? OR c.provider_id=? ORDER BY (SELECT max(id) FROM messages WHERE conversation_id=c.id) DESC LIMIT 200`,
      user.id,
      user.id,
      user.id,
      user.id,
    );
    const models = store.all(
      'SELECT id,title,license,published FROM models WHERE owner_id=? ORDER BY created_at DESC',
      user.id,
    );
    const blocks = store.all(
      'SELECT b.blocked_id,u.name FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.owner_id=?',
      user.id,
    );
    res.json({
      projects,
      offers,
      direct,
      conversations,
      models,
      blocks,
      profile: profile ? { ...profileObject(profile), published: !!profile.published } : null,
    });
  });
  app.get('/api/notifications', (req, res) => {
    const user = requireUser(store, req);
    res.json({
      notifications: store
        .all(
          'SELECT id,title,path,seen,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100',
          user.id,
        )
        .map((n) => ({ ...n, seen: !!n.seen })),
    });
  });
  app.post('/api/notifications/read', (req, res) => {
    const user = requireUser(store, req);
    const through = z.number().int().nonnegative().parse(req.body.through);
    store.run('UPDATE notifications SET seen=1 WHERE user_id=? AND id<=?', user.id, through);
    res.json({ ok: true });
  });
  app.post('/api/blocks', (req, res) => {
    const user = requireUser(store, req),
      body = z.object({ user_id: z.string().uuid(), blocked: z.boolean() }).parse(req.body);
    ensure(
      body.user_id !== user.id && store.get('SELECT 1 FROM users WHERE id=?', body.user_id),
      400,
      'TARGET_INVALID',
      'Invalid participant',
    );
    if (body.blocked)
      store.run(
        'INSERT OR IGNORE INTO blocks(owner_id,blocked_id) VALUES(?,?)',
        user.id,
        body.user_id,
      );
    else store.run('DELETE FROM blocks WHERE owner_id=? AND blocked_id=?', user.id, body.user_id);
    res.json({
      ok: true,
      blocked: blocked(store, user.id, body.user_id),
      blocked_by_me: body.blocked,
    });
  });
  app.get('/api/account/export', (req, res) => {
    const user = requireUser(store, req);
    res.attachment('openprint-account.json').json({
      exported_at: new Date().toISOString(),
      user,
      profile: ownProfile(store, user.id),
      projects: store.all('SELECT * FROM jobs WHERE owner_id=?', user.id),
      offers: store.all('SELECT * FROM offers WHERE provider_id=?', user.id),
      messages: store.all('SELECT * FROM messages WHERE author_id=?', user.id),
      models: store.all('SELECT * FROM models WHERE owner_id=?', user.id),
      studio_projects: store.all(
        'SELECT id,idea,language,brief,version,confirmed_version,confirmed_hash,source,job_id,packet,file_id,created_at,updated_at FROM studio_projects WHERE owner_id=?',
        user.id,
      ),
      studio_revisions: store.all(
        'SELECT r.* FROM studio_revisions r JOIN studio_projects p ON p.id=r.project_id WHERE p.owner_id=?',
        user.id,
      ),
      studio_confirmations: store.all(
        'SELECT c.* FROM studio_confirmations c JOIN studio_projects p ON p.id=c.project_id WHERE p.owner_id=?',
        user.id,
      ),
      studio_ai_usage: store.all(
        'SELECT id,project_id,model,quality,task,status,input_tokens,output_tokens,error_code,created_at,finished_at FROM studio_ai_runs WHERE owner_id=?',
        user.id,
      ),
      cad_revisions: store.all(
        'SELECT r.* FROM studio_cad_revisions r JOIN studio_projects p ON p.id=r.project_id WHERE p.owner_id=?',
        user.id,
      ),
      cad_proposals: store.all(
        'SELECT c.* FROM studio_cad_proposals c JOIN studio_projects p ON p.id=c.project_id WHERE p.owner_id=?',
        user.id,
      ),
      cad_builds: store.all('SELECT * FROM studio_cad_builds WHERE owner_id=?', user.id),
      cad_artifacts: store.all(
        'SELECT a.build_id,a.name,a.size,a.sha256 FROM studio_cad_artifacts a JOIN studio_cad_builds b ON b.id=a.build_id WHERE b.owner_id=?',
        user.id,
      ),
      files: store.all(
        'SELECT id,name,size,sha256,created_at FROM files WHERE owner_id=?',
        user.id,
      ),
    });
  });
  app.post(
    '/api/account/password',
    throttle('password-change', 8, 15 * 60000),
    async (req, res) => {
      const user = requireUser(store, req),
        body = z.object({ current: z.string().min(1).max(128), password }).parse(req.body);
      const credentials = store.get<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id=?',
        user.id,
      )!;
      ensure(
        await verifyPassword(body.current, credentials.password_hash),
        401,
        'LOGIN_FAILED',
        'Incorrect password / Неверный пароль',
      );
      const hash = await hashPassword(body.password);
      store.transaction(() => {
        store.run('UPDATE users SET password_hash=? WHERE id=?', hash, user.id);
        store.run('DELETE FROM sessions WHERE user_id=?', user.id);
        store.run('DELETE FROM reset_tokens WHERE user_id=?', user.id);
        createSession(store, res, user.id, secure);
        event(store, user.id, 'password.changed', user.id);
      });
      res.json({ ok: true });
    },
  );
  app.delete('/api/account', async (req, res) => {
    const user = requireUser(store, req),
      body = z
        .object({ password: z.string().min(1).max(128), confirm: z.literal('DELETE') })
        .parse(req.body);
    const credentials = store.get<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id=?',
      user.id,
    )!;
    ensure(
      await verifyPassword(body.password, credentials.password_hash),
      401,
      'LOGIN_FAILED',
      'Incorrect password / Неверный пароль',
    );
    const replacement = await hashPassword(randomBytes(32).toString('hex'));
    store.transaction(() => {
      ensure(
        !store.get(
          "SELECT 1 FROM jobs j LEFT JOIN offers f ON f.id=j.accepted_offer_id WHERE (j.owner_id=? OR f.provider_id=?) AND j.status IN ('assigned','delivered')",
          user.id,
          user.id,
        ),
        409,
        'ACTIVE_DEALS',
        'Finish active deals before removing your account / Завершите активные сделки перед удалением',
      );
      ensure(
        user.role !== 'admin' ||
          Number(
            store.get<{ n: number }>(
              "SELECT count(*) AS n FROM users WHERE role='admin' AND suspended=0",
            )!.n,
          ) > 1,
        409,
        'LAST_ADMIN',
        'Create another administrator first / Сначала назначьте другого администратора',
      );
      store.run(
        "UPDATE users SET email=?,name='Deleted participant',password_hash=?,suspended=1 WHERE id=?",
        `${user.id}@deleted.invalid`,
        replacement,
        user.id,
      );
      store.run(
        "UPDATE profiles SET name='Deleted workshop',description='',website='',city='',lat=NULL,lng=NULL,published=0,verified=0 WHERE user_id=?",
        user.id,
      );
      store.run(
        "UPDATE jobs SET title='Archived project',description='',city='',status=CASE WHEN status='open' THEN 'cancelled' ELSE status END,file_id=NULL WHERE owner_id=?",
        user.id,
      );
      store.run(
        "UPDATE messages SET body='[removed by participant]',hidden=1 WHERE author_id=?",
        user.id,
      );
      store.run(
        "UPDATE offers SET status='withdrawn' WHERE provider_id=? AND status='active'",
        user.id,
      );
      store.run('DELETE FROM models WHERE owner_id=?', user.id);
      for (const build of store.all<{ id: string }>(
        "SELECT id FROM studio_cad_builds WHERE owner_id=? AND status IN ('queued','running')",
        user.id,
      ))
        cad.cancel(build.id);
      store.run('DELETE FROM studio_projects WHERE owner_id=?', user.id);
      store.run('DELETE FROM sessions WHERE user_id=?', user.id);
      store.run('DELETE FROM reset_tokens WHERE user_id=?', user.id);
      store.run('DELETE FROM notifications WHERE user_id=?', user.id);
      store.run(
        "UPDATE reports SET reason='[removed by participant]' WHERE reporter_id=?",
        user.id,
      );
      event(store, user.id, 'account.anonymized', user.id);
    });
    // Historical accepted terms stay as the parties' agreement. See PRIVACY.md.
    const files = store.all<FileRow>(
      'SELECT f.* FROM files f WHERE f.owner_id=? AND NOT EXISTS(SELECT 1 FROM jobs WHERE file_id=f.id) AND NOT EXISTS(SELECT 1 FROM models WHERE file_id=f.id)',
      user.id,
    );
    for (const file of files) {
      const path = join(uploadDirectory(dataDir), file.storage_name);
      if (existsSync(path)) unlinkSync(path);
      store.run('DELETE FROM files WHERE id=?', file.id);
    }
    revokeSession(store, req, res, secure);
    res.json({ ok: true });
  });

  app.post('/api/reports', throttle('reports', 10), (req, res) => {
    const user = requireUser(store, req),
      body = z
        .object({
          kind: z.enum(['profile', 'job', 'model', 'message']),
          target_id: z.string().min(1).max(80),
          reason: z.string().trim().min(10).max(2000),
        })
        .parse(req.body);
    if (body.kind === 'message') {
      const msg = store.get<{ conversation_id: string }>(
        'SELECT conversation_id FROM messages WHERE id=?',
        body.target_id,
      );
      ensure(msg, 404, 'NOT_FOUND', 'Not found');
      conversationAccess(store, msg.conversation_id, user);
    } else if (body.kind === 'job') visibleJob(store, body.target_id, user);
    else {
      const table = body.kind === 'profile' ? 'profiles' : 'models';
      ensure(
        store.get(`SELECT 1 FROM ${table} WHERE id=?`, body.target_id),
        404,
        'NOT_FOUND',
        'Not found',
      );
    }
    const reportId = randomUUID();
    store.run(
      'INSERT INTO reports(id,reporter_id,kind,target_id,reason,created_at) VALUES(?,?,?,?,?,?)',
      reportId,
      user.id,
      body.kind,
      body.target_id,
      body.reason,
      Date.now(),
    );
    res.status(201).json({ ok: true });
  });
  app.get('/api/admin', (req, res) => {
    requireAdmin(store, req);
    const reports = store
      .all<{ kind: string; target_id: string }>(
        'SELECT * FROM reports WHERE resolved=0 ORDER BY created_at DESC LIMIT 200',
      )
      .map((report) => {
        const table =
          report.kind === 'job'
            ? 'jobs'
            : report.kind === 'profile'
              ? 'profiles'
              : report.kind === 'model'
                ? 'models'
                : 'messages';
        const column = report.kind === 'message' ? 'body' : 'description';
        return {
          ...report,
          target_preview:
            store.get<{ preview: string }>(
              `SELECT ${column} AS preview FROM ${table} WHERE id=?`,
              report.target_id,
            )?.preview || '',
        };
      });
    res.json({
      profiles: store
        .all<ProfileRow>(
          'SELECT * FROM profiles ORDER BY verified,published DESC,created_at DESC LIMIT 200',
        )
        .map((p) => ({ ...profileObject(p), published: !!p.published })),
      models: store.all(
        'SELECT m.id,m.title,m.description,m.file_id,m.license,m.published,m.attribution,u.name AS author_name FROM models m JOIN users u ON u.id=m.owner_id ORDER BY m.published,m.created_at DESC LIMIT 200',
      ),
      reports,
      events: store.all('SELECT action,target_id,created_at FROM events ORDER BY id DESC LIMIT 50'),
    });
  });
  app.post('/api/admin/profiles/:id', (req, res) => {
    const admin = requireAdmin(store, req),
      body = z.object({ verified: z.boolean(), published: z.boolean() }).parse(req.body);
    const profile = store.get<ProfileRow>('SELECT * FROM profiles WHERE id=?', id(req));
    ensure(profile, 404, 'NOT_FOUND', 'Not found');
    store.run(
      'UPDATE profiles SET verified=?,published=? WHERE id=?',
      body.verified ? 1 : 0,
      body.published ? 1 : 0,
      profile.id,
    );
    event(store, admin.id, 'profile.moderated', profile.id, JSON.stringify(body));
    notify(store, profile.user_id, 'profile.moderated|' + profile.name, '/workspace?tab=profile');
    res.json({ ok: true });
  });
  app.post('/api/admin/models/:id', (req, res) => {
    const admin = requireAdmin(store, req),
      body = z.object({ published: z.boolean() }).parse(req.body),
      model = store.get<{ owner_id: string; title: string }>(
        'SELECT owner_id,title FROM models WHERE id=?',
        id(req),
      );
    ensure(model, 404, 'NOT_FOUND', 'Not found');
    store.run('UPDATE models SET published=? WHERE id=?', body.published ? 1 : 0, id(req));
    event(store, admin.id, 'model.moderated', id(req));
    notify(store, model.owner_id, 'model.moderated|' + model.title, '/workspace?tab=models');
    res.json({ ok: true });
  });
  app.get('/api/admin/models/:id/file', (req, res) => {
    requireAdmin(store, req);
    const file = store.get<FileRow>(
      'SELECT f.* FROM files f JOIN models m ON m.file_id=f.id WHERE m.id=?',
      id(req),
    );
    ensure(file, 404, 'NOT_FOUND', 'No uploaded file / Нет загруженного файла');
    const path = join(uploadDirectory(dataDir), file.storage_name);
    ensure(existsSync(path), 404, 'NOT_FOUND', 'File missing');
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': 'private, no-store',
    });
    res.download(path, file.name);
  });
  app.post('/api/admin/reports/:id', (req, res) => {
    const admin = requireAdmin(store, req),
      body = z
        .object({ resolution: z.string().trim().min(5).max(1000), hide: z.boolean() })
        .parse(req.body),
      report = store.get<{ kind: string; target_id: string }>(
        'SELECT kind,target_id FROM reports WHERE id=? AND resolved=0',
        id(req),
      );
    ensure(report, 404, 'NOT_FOUND', 'Not found');
    store.transaction(() => {
      if (body.hide) {
        if (report.kind === 'profile')
          store.run('UPDATE profiles SET published=0,verified=0 WHERE id=?', report.target_id);
        if (report.kind === 'model')
          store.run('UPDATE models SET published=0 WHERE id=?', report.target_id);
        if (report.kind === 'message')
          store.run('UPDATE messages SET hidden=1 WHERE id=?', report.target_id);
        if (report.kind === 'job')
          store.run('UPDATE jobs SET moderated=1 WHERE id=?', report.target_id);
      }
      store.run('UPDATE reports SET resolved=1,resolution=? WHERE id=?', body.resolution, id(req));
      event(store, admin.id, 'report.resolved', id(req), body.resolution);
    });
    res.json({ ok: true });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found / Не найдено', code: 'NOT_FOUND' });
  });
  if (options.staticDir) {
    app.use(express.static(resolve(options.staticDir), { index: false, etag: true, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(join(resolve(options.staticDir!), 'index.html'));
    });
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        code: 'VALIDATION',
      });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    if (
      typeof error === 'object' &&
      error &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      res.status(413).json({
        error: 'File or request is too large / Слишком большой файл или запрос',
        code: 'TOO_LARGE',
      });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON / Некорректный JSON', code: 'JSON_INVALID' });
      return;
    }
    console.error(
      'OpenPrint request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    res.status(500).json({
      error: 'Server error. Please try again / Ошибка сервера. Повторите попытку',
      code: 'SERVER_ERROR',
    });
  });
  return app;
}
