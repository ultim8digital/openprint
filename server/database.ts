import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class Store {
  readonly db: DatabaseSync;
  constructor(readonly path: string) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.function('unicode_fold', { deterministic: true }, (value) =>
      typeof value === 'string' ? value.normalize('NFKC').toLowerCase() : '',
    );
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.migrate();
  }
  get<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }
  all<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).all(...params) as T[];
  }
  run(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).run(...params);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  private migrate() {
    const version = Number(
      this.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0,
    );
    if (version > 1)
      throw new Error('Database is newer than this OpenPrint version. Upgrade the application.');
    if (version === 1) return;
    this.transaction(() =>
      this.db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
        password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
        suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN (0,1)), created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX sessions_user ON sessions(user_id);
      CREATE INDEX sessions_expiry ON sessions(expires_at);
      CREATE TABLE reset_tokens (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, promote_admin INTEGER NOT NULL DEFAULT 0 CHECK(promote_admin IN (0,1))
      ) STRICT;
      CREATE INDEX resets_user ON reset_tokens(user_id);
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('studio','engineer','both')), city TEXT NOT NULL,
        description TEXT NOT NULL, technologies TEXT NOT NULL CHECK(json_valid(technologies)),
        materials TEXT NOT NULL CHECK(json_valid(materials)), website TEXT NOT NULL DEFAULT '',
        lat REAL, lng REAL, remote INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 1, demo INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX profiles_city ON profiles(city, published);
      CREATE TABLE files (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
        storage_name TEXT NOT NULL UNIQUE, size INTEGER NOT NULL CHECK(size > 0), sha256 TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX files_owner ON files(owner_id);
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
        description TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('print','design','repair')),
        city TEXT NOT NULL, technology TEXT NOT NULL, material TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10000), currency TEXT NOT NULL,
        budget INTEGER CHECK(budget > 0), deadline TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL CHECK(visibility IN ('public','direct')),
        target_profile_id TEXT REFERENCES profiles(id), file_id TEXT REFERENCES files(id),
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','assigned','delivered','completed','cancelled')),
        accepted_offer_id TEXT, accepted_terms TEXT CHECK(accepted_terms IS NULL OR json_valid(accepted_terms)),
        version INTEGER NOT NULL DEFAULT 1, demo INTEGER NOT NULL DEFAULT 0, moderated INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
        CHECK((visibility='public' AND target_profile_id IS NULL) OR (visibility='direct' AND target_profile_id IS NOT NULL))
      ) STRICT;
      CREATE INDEX jobs_feed ON jobs(visibility, status, created_at DESC);
      CREATE INDEX jobs_owner ON jobs(owner_id, created_at DESC);
      CREATE INDEX jobs_target ON jobs(target_profile_id);
      CREATE INDEX jobs_file ON jobs(file_id);
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL REFERENCES users(id), owner_read INTEGER NOT NULL DEFAULT 0,
        provider_read INTEGER NOT NULL DEFAULT 0, UNIQUE(job_id, provider_id)
      ) STRICT;
      CREATE INDEX conversations_provider ON conversations(provider_id);
      CREATE TABLE offers (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL REFERENCES users(id), profile_id TEXT NOT NULL REFERENCES profiles(id),
        conversation_id TEXT NOT NULL REFERENCES conversations(id), revision INTEGER NOT NULL CHECK(revision > 0),
        price INTEGER NOT NULL CHECK(price BETWEEN 1 AND 100000000), days INTEGER NOT NULL CHECK(days BETWEEN 1 AND 365),
        note TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','superseded','accepted','declined','withdrawn')),
        created_at INTEGER NOT NULL, UNIQUE(job_id, provider_id, revision)
      ) STRICT;
      CREATE UNIQUE INDEX one_active_offer ON offers(job_id, provider_id) WHERE status='active';
      CREATE UNIQUE INDEX one_accepted_offer ON offers(job_id) WHERE status='accepted';
      CREATE INDEX offers_provider ON offers(provider_id);
      CREATE INDEX offers_profile ON offers(profile_id);
      CREATE INDEX offers_conversation ON offers(conversation_id);
      CREATE TRIGGER immutable_offer BEFORE UPDATE OF price, days, note, revision, provider_id, profile_id, job_id, conversation_id ON offers
        BEGIN SELECT RAISE(ABORT, 'Offer terms are immutable; create a new revision'); END;
      CREATE TRIGGER immutable_accepted BEFORE UPDATE OF status ON offers WHEN OLD.status='accepted' AND NEW.status<>'accepted'
        BEGIN SELECT RAISE(ABORT, 'Accepted offer is immutable'); END;
      CREATE TRIGGER immutable_agreement BEFORE UPDATE OF accepted_terms, accepted_offer_id ON jobs WHEN OLD.accepted_offer_id IS NOT NULL
        BEGIN SELECT RAISE(ABORT, 'Agreement is immutable'); END;
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        author_id TEXT REFERENCES users(id), body TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX messages_thread ON messages(conversation_id, id);
      CREATE INDEX messages_author ON messages(author_id);
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL, path TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX notifications_user ON notifications(user_id, id DESC);
      CREATE TABLE models (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL,
        category TEXT NOT NULL, license TEXT NOT NULL CHECK(license IN ('CC0-1.0','CC-BY-4.0','CC-BY-SA-4.0')),
        attribution TEXT NOT NULL, file_id TEXT REFERENCES files(id), preset TEXT CHECK(preset IS NULL OR json_valid(preset)),
        published INTEGER NOT NULL DEFAULT 0, demo INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
        CHECK(file_id IS NOT NULL OR preset IS NOT NULL)
      ) STRICT;
      CREATE INDEX models_owner ON models(owner_id);
      CREATE INDEX models_file ON models(file_id);
      CREATE INDEX models_feed ON models(published, created_at DESC);
      CREATE TABLE reports (
        id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK(kind IN ('profile','job','model','message')), target_id TEXT NOT NULL,
        reason TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, resolution TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX reports_reporter ON reports(reporter_id);
      CREATE INDEX reports_open ON reports(resolved, created_at DESC);
      CREATE TABLE blocks (
        owner_id TEXT NOT NULL REFERENCES users(id), blocked_id TEXT NOT NULL REFERENCES users(id),
        PRIMARY KEY(owner_id, blocked_id), CHECK(owner_id<>blocked_id)
      ) STRICT;
      CREATE INDEX blocks_target ON blocks(blocked_id);
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT REFERENCES users(id),
        action TEXT NOT NULL, target_id TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX events_actor ON events(actor_id);
      PRAGMA user_version=1;
    `),
    );
  }
}
