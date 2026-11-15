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
    if (version > 5)
      throw new Error('Database is newer than this OpenPrint version. Upgrade the application.');
    if (version === 5) return;
    if (version === 0)
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
    if (version < 2)
      this.transaction(() =>
        this.db.exec(`
      CREATE TABLE studio_projects (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), idea TEXT NOT NULL,
        language TEXT NOT NULL CHECK(language IN ('ru','en')),
        brief TEXT NOT NULL CHECK(json_valid(brief)), version INTEGER NOT NULL CHECK(version>0),
        confirmed_version INTEGER, confirmed_hash TEXT,
        source TEXT NOT NULL CHECK(source IN ('manual','openai')),
        job_id TEXT UNIQUE REFERENCES jobs(id), packet TEXT CHECK(packet IS NULL OR json_valid(packet)), model_stl BLOB,
        file_id TEXT REFERENCES files(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        CHECK((confirmed_version IS NULL AND confirmed_hash IS NULL) OR (confirmed_version=version AND confirmed_hash IS NOT NULL))
      ) STRICT;
      CREATE INDEX studio_projects_owner ON studio_projects(owner_id, updated_at DESC);
      CREATE INDEX studio_projects_file ON studio_projects(file_id);
      CREATE TABLE studio_revisions (
        project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK(version>0), brief TEXT NOT NULL CHECK(json_valid(brief)),
        source TEXT NOT NULL CHECK(source IN ('manual','openai')), created_at INTEGER NOT NULL,
        PRIMARY KEY(project_id,version)
      ) STRICT;
      CREATE TRIGGER studio_revision_immutable BEFORE UPDATE ON studio_revisions
        BEGIN SELECT RAISE(ABORT, 'Studio revisions are immutable'); END;
      CREATE TABLE studio_confirmations (
        project_id TEXT NOT NULL, version INTEGER NOT NULL,
        brief_hash TEXT NOT NULL, confirmed_at INTEGER NOT NULL,
        PRIMARY KEY(project_id,version),
        FOREIGN KEY(project_id,version) REFERENCES studio_revisions(project_id,version) ON DELETE CASCADE
      ) STRICT;
      CREATE TRIGGER studio_confirmation_immutable BEFORE UPDATE ON studio_confirmations
        BEGIN SELECT RAISE(ABORT, 'Studio confirmations are immutable'); END;
      CREATE TABLE studio_ai_runs (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
        project_id TEXT REFERENCES studio_projects(id) ON DELETE SET NULL,
        request_id TEXT NOT NULL, request_hash TEXT NOT NULL, input_version INTEGER NOT NULL,
        model TEXT NOT NULL, quality TEXT NOT NULL CHECK(quality IN ('standard','review')),
        status TEXT NOT NULL CHECK(status IN ('running','complete','failed','stale')),
        input_tokens INTEGER NOT NULL DEFAULT 0 CHECK(input_tokens>=0),
        output_tokens INTEGER NOT NULL DEFAULT 0 CHECK(output_tokens>=0),
        result_version INTEGER, error_code TEXT, created_at INTEGER NOT NULL, finished_at INTEGER,
        UNIQUE(owner_id,project_id,request_id)
      ) STRICT;
      CREATE INDEX studio_ai_owner_time ON studio_ai_runs(owner_id,created_at DESC);
      CREATE INDEX studio_ai_project ON studio_ai_runs(project_id);
      CREATE INDEX studio_ai_status_time ON studio_ai_runs(status,created_at);
      CREATE TRIGGER studio_ai_request_immutable BEFORE UPDATE OF owner_id,request_id,request_hash,input_version,model,quality,created_at ON studio_ai_runs
        BEGIN SELECT RAISE(ABORT, 'AI request identity is immutable'); END;
      CREATE TRIGGER studio_ai_project_immutable BEFORE UPDATE OF project_id ON studio_ai_runs WHEN NEW.project_id IS NOT NULL
        BEGIN SELECT RAISE(ABORT, 'AI requests cannot be reassigned'); END;
      CREATE TRIGGER studio_published_immutable BEFORE UPDATE OF brief,version,confirmed_version,confirmed_hash,packet,model_stl,job_id,file_id ON studio_projects WHEN OLD.job_id IS NOT NULL
        BEGIN SELECT RAISE(ABORT, 'Published studio projects are immutable'); END;
      PRAGMA user_version=2;
    `),
      );
    if (version < 3)
      this.transaction(() =>
        this.db.exec(`
      CREATE INDEX events_action_time ON events(action,created_at);
      CREATE TABLE studio_cad_revisions (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
        number INTEGER NOT NULL CHECK(number>0), project_version INTEGER NOT NULL,
        spec TEXT CHECK(spec IS NULL OR json_valid(spec)), sha256 TEXT,
        created_at INTEGER NOT NULL, UNIQUE(project_id,number), UNIQUE(project_id,project_version),
        CHECK((spec IS NULL AND sha256 IS NULL) OR (spec IS NOT NULL AND sha256 IS NOT NULL))
      ) STRICT;
      CREATE TRIGGER studio_cad_revision_immutable BEFORE UPDATE ON studio_cad_revisions
        BEGIN SELECT RAISE(ABORT, 'CAD revisions are immutable'); END;
      CREATE TABLE studio_cad_builds (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
        project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
        revision_id TEXT NOT NULL REFERENCES studio_cad_revisions(id) ON DELETE CASCADE,
        project_version INTEGER NOT NULL, request_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
        error_code TEXT, error_detail TEXT CHECK(error_detail IS NULL OR length(error_detail)<=800), report TEXT CHECK(report IS NULL OR json_valid(report)),
        created_at INTEGER NOT NULL, finished_at INTEGER,
        UNIQUE(owner_id,project_id,request_id)
      ) STRICT;
      CREATE INDEX studio_cad_build_queue ON studio_cad_builds(status,created_at);
      CREATE INDEX studio_cad_build_owner ON studio_cad_builds(owner_id,created_at);
      CREATE INDEX studio_cad_build_project ON studio_cad_builds(project_id,project_version);
      CREATE TRIGGER studio_cad_build_identity_immutable BEFORE UPDATE OF owner_id,project_id,revision_id,project_version,request_id,created_at ON studio_cad_builds
        BEGIN SELECT RAISE(ABORT, 'CAD build identity is immutable'); END;
      CREATE TRIGGER studio_cad_build_result_immutable BEFORE UPDATE ON studio_cad_builds WHEN OLD.status='succeeded'
        BEGIN SELECT RAISE(ABORT, 'Successful CAD builds are immutable'); END;
      CREATE TABLE studio_cad_artifacts (
        build_id TEXT NOT NULL REFERENCES studio_cad_builds(id) ON DELETE CASCADE,
        name TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0), sha256 TEXT NOT NULL,
        content BLOB NOT NULL, PRIMARY KEY(build_id,name), CHECK(length(content)=size)
      ) STRICT;
      CREATE TRIGGER studio_cad_artifact_immutable BEFORE UPDATE ON studio_cad_artifacts
        BEGIN SELECT RAISE(ABORT, 'CAD artifacts are immutable'); END;
      CREATE TABLE studio_cad_handoffs (
        job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
        build_id TEXT NOT NULL REFERENCES studio_cad_builds(id) ON DELETE CASCADE,
        packet TEXT NOT NULL CHECK(json_valid(packet)), created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX studio_cad_handoff_build ON studio_cad_handoffs(build_id);
      CREATE TRIGGER studio_cad_handoff_immutable BEFORE UPDATE ON studio_cad_handoffs
        BEGIN SELECT RAISE(ABORT, 'CAD handoffs are immutable'); END;
      CREATE TABLE studio_cad_grants (
        job_id TEXT NOT NULL REFERENCES studio_cad_handoffs(job_id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
        PRIMARY KEY(job_id,provider_id)
      ) STRICT;
      PRAGMA user_version=3;
    `),
      );
    if (version < 4)
      this.transaction(() =>
        this.db.exec(`
      ALTER TABLE studio_ai_runs ADD COLUMN task TEXT NOT NULL DEFAULT 'brief' CHECK(task IN ('brief','cad'));
      CREATE TRIGGER studio_ai_task_immutable BEFORE UPDATE OF task ON studio_ai_runs
        BEGIN SELECT RAISE(ABORT, 'AI task identity is immutable'); END;
      CREATE TABLE studio_cad_proposals (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE REFERENCES studio_ai_runs(id),
        project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
        input_version INTEGER NOT NULL CHECK(input_version>0), model TEXT NOT NULL,
        base_cad_revision_id TEXT, base_confirmed_version INTEGER, base_confirmed_hash TEXT,
        summary TEXT NOT NULL CHECK(length(summary) BETWEEN 1 AND 2000),
        questions TEXT NOT NULL CHECK(json_valid(questions)),
        spec TEXT CHECK(spec IS NULL OR json_valid(spec)),
        created_at INTEGER NOT NULL,
        applied_version INTEGER CHECK(applied_version IS NULL OR applied_version>=input_version),
        applied_revision_id TEXT,
        CHECK((applied_version IS NULL AND applied_revision_id IS NULL) OR
          (applied_version IS NOT NULL AND applied_revision_id IS NOT NULL AND spec IS NOT NULL))
      ) STRICT;
      CREATE INDEX studio_cad_proposal_project ON studio_cad_proposals(project_id,created_at DESC);
      CREATE TRIGGER studio_cad_proposal_identity_immutable BEFORE UPDATE OF
        id,run_id,project_id,input_version,model,base_cad_revision_id,base_confirmed_version,base_confirmed_hash,summary,questions,spec,created_at
        ON studio_cad_proposals BEGIN SELECT RAISE(ABORT, 'CAD proposals are immutable'); END;
      CREATE TRIGGER studio_cad_proposal_application_immutable BEFORE UPDATE OF applied_version,applied_revision_id
        ON studio_cad_proposals WHEN OLD.applied_version IS NOT NULL
        BEGIN SELECT RAISE(ABORT, 'CAD proposal application is immutable'); END;
      PRAGMA user_version=4;
    `),
      );
    this.transaction(() =>
      this.db.exec(`
      CREATE TABLE catalog_studios (
        id TEXT PRIMARY KEY, source_key TEXT NOT NULL, source_id TEXT NOT NULL,
        name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200), city TEXT NOT NULL,
        region TEXT NOT NULL, country TEXT NOT NULL, description TEXT NOT NULL,
        technologies TEXT NOT NULL CHECK(json_valid(technologies)),
        materials TEXT NOT NULL CHECK(json_valid(materials)), website TEXT NOT NULL,
        phone TEXT NOT NULL, address TEXT NOT NULL, lat REAL, lng REAL,
        source_name TEXT NOT NULL, source_url TEXT NOT NULL, imported_at INTEGER NOT NULL,
        UNIQUE(source_key,source_id),
        CHECK((lat IS NULL AND lng IS NULL) OR
          (lat IS NOT NULL AND lng IS NOT NULL AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180))
      ) STRICT;
      CREATE INDEX catalog_studios_city ON catalog_studios(city);
      PRAGMA user_version=5;
    `),
    );
  }
}
