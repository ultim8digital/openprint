import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import type { Store } from './database.js';
import type { User } from '../shared/types.js';

const scrypt = promisify(scryptCallback);
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [, salt, expected] = encoded.split(':');
  const hash = (await scrypt(password, salt || 'not-a-user', 64)) as Buffer;
  const compare = Buffer.from(expected || '00'.repeat(64), 'hex');
  return compare.length === hash.length && timingSafeEqual(compare, hash);
}
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  status: number,
  code: string,
  message: string,
): asserts condition {
  if (!condition) throw new HttpError(status, code, message);
}
export function readUser(store: Store, req: Request): User | null {
  const token = req.headers.cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('openprint_session='))
    ?.slice(18);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    store.get<User>(
      `SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.suspended=0`,
      digest(token),
      Date.now(),
    ) ?? null
  );
}
export function requireUser(store: Store, req: Request) {
  const user = readUser(store, req);
  ensure(user, 401, 'AUTH_REQUIRED', 'Sign in to continue / Войдите, чтобы продолжить');
  return user;
}
export function requireAdmin(store: Store, req: Request) {
  const user = requireUser(store, req);
  ensure(
    user.role === 'admin',
    403,
    'FORBIDDEN',
    'Administrator access required / Нужны права модератора',
  );
  return user;
}
export function createSession(store: Store, res: Response, userId: string, secure: boolean) {
  const token = randomBytes(32).toString('hex');
  store.run(
    'INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
    digest(token),
    userId,
    Date.now() + 7 * 86400000,
    Date.now(),
  );
  res.cookie('openprint_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 7 * 86400000,
  });
}
export function revokeSession(store: Store, req: Request, res: Response, secure: boolean) {
  const token = req.headers.cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('openprint_session='))
    ?.slice(18);
  if (token) store.run('DELETE FROM sessions WHERE token_hash=?', digest(token));
  res.clearCookie('openprint_session', { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}
export function rateLimiter() {
  const buckets = new Map<string, { count: number; until: number }>();
  return (key: string, limit: number, duration = 60000) =>
    (req: Request, _res: Response, next: NextFunction) => {
      const now = Date.now();
      if (buckets.size > 10000) for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
      const id = `${key}:${digest(req.ip || req.socket.remoteAddress || '')}`;
      const bucket = buckets.get(id);
      if (!bucket || bucket.until < now) {
        if (!bucket && buckets.size >= 10000) {
          next(new HttpError(429, 'RATE_LIMIT', 'Try again later / Повторите позже'));
          return;
        }
        buckets.set(id, { count: 1, until: now + duration });
        next();
        return;
      }
      bucket.count++;
      if (bucket.count > limit) {
        next(
          new HttpError(
            429,
            'RATE_LIMIT',
            'Too many attempts. Try again later / Слишком много попыток, повторите позже',
          ),
        );
        return;
      }
      next();
    };
}
export function notify(store: Store, userId: string, title: string, path: string) {
  store.run(
    'INSERT INTO notifications(user_id,title,path,created_at) VALUES(?,?,?,?)',
    userId,
    title,
    path,
    Date.now(),
  );
}
export function event(store: Store, actor: string, action: string, target: string, detail = '') {
  store.run(
    'INSERT INTO events(actor_id,action,target_id,detail,created_at) VALUES(?,?,?,?,?)',
    actor,
    action,
    target,
    detail,
    Date.now(),
  );
}
export const isLoopback = (req: Request) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
