import { spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Store } from './database.js';
import type { CadCapabilities, CadSpec } from '../shared/cad.js';
import { cadSpecSchema, cadReportSchema, cadMeshSchema, cadManifestSchema } from '../shared/cad.js';
import { canonicalJSON } from './studio-geometry.js';
import { digest, ensure } from './security.js';
import { latestCadRevision, type CadBuildRow, type CadRevisionRow } from './cad-data.js';

export const CAD_MAX_BYTES = 128 * 1024 * 1024;
export type CadOutput = { name: string; content: Buffer }[];
export type CadExecutor = (spec: CadSpec, signal: AbortSignal) => Promise<CadOutput>;
export type CadOptions = {
  python?: string;
  timeoutMs?: number;
  executor?: CadExecutor;
  userStorageBytes?: number;
  totalStorageBytes?: number;
  maxBuildsPerProject?: number;
  maxBuildsPerUserDay?: number;
  maxBuildsPerInstanceDay?: number;
};
class CadExecutionError extends Error {
  constructor(readonly detail: string) {
    super('CAD_COMPILE_FAILED');
  }
}
function fail(code: string): never {
  throw new Error(code);
}
function limit(value: number | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error('Invalid CAD limit');
  return value;
}
const workerPath = fileURLToPath(
  new URL(
    import.meta.url.endsWith('.ts') ? '../cad-worker/worker.py' : '../../cad-worker/worker.py',
    import.meta.url,
  ),
);
export function artifactNames(spec: CadSpec) {
  const ids = [...(spec.operations.length ? ['body'] : []), ...spec.components.map((c) => c.id)];
  return [
    'model.step',
    'model.stl',
    'mesh.json',
    'bom.csv',
    'spec.json',
    'report.json',
    'parts.zip',
    ...ids.flatMap((id) => [`parts/${id}/${id}.step`, `parts/${id}/${id}.stl`]),
  ].sort();
}
export function validateCadOutput(spec: CadSpec, artifacts: CadOutput) {
  const expected = [...artifactNames(spec), 'manifest.json'].sort();
  ensure(
    canonicalJSON(artifacts.map((a) => a.name).sort()) === canonicalJSON(expected),
    500,
    'CAD_ARTIFACTS',
    'CAD artifact set is invalid',
  );
  let total = 0;
  const map = new Map<string, Buffer>();
  for (const artifact of artifacts) {
    ensure(
      artifact.content.length > 0 && artifact.content.length <= 32 * 1024 * 1024,
      413,
      'CAD_ARTIFACT_LIMIT',
      'CAD artifact is too large',
    );
    total += artifact.content.length;
    map.set(artifact.name, artifact.content);
  }
  ensure(total <= CAD_MAX_BYTES, 413, 'CAD_ARTIFACT_LIMIT', 'CAD output limit exceeded');
  const json = (name: string) => JSON.parse(map.get(name)!.toString('utf8')) as unknown;
  const manifest = cadManifestSchema.parse(json('manifest.json'));
  ensure(
    canonicalJSON(manifest.artifacts.map((a) => a.path).sort()) ===
      canonicalJSON(artifactNames(spec)),
    500,
    'CAD_MANIFEST',
    'Invalid CAD manifest',
  );
  for (const artifact of manifest.artifacts) {
    const bytes = map.get(artifact.path)!;
    ensure(
      bytes.length === artifact.size && digest(bytes) === artifact.sha256,
      500,
      'CAD_INTEGRITY',
      'CAD artifact integrity failed',
    );
  }
  ensure(
    canonicalJSON(cadSpecSchema.parse(json('spec.json'))) === canonicalJSON(spec),
    500,
    'CAD_SPEC_MISMATCH',
    'CAD specification changed during compilation',
  );
  const report = cadReportSchema.parse(json('report.json'));
  const mesh = cadMeshSchema.parse(json('mesh.json'));
  const expectedIds = [
    ...(spec.operations.length ? ['body'] : []),
    ...spec.components.map((c) => c.id),
  ].sort();
  ensure(
    canonicalJSON(report.components.map((c) => c.id).sort()) === canonicalJSON(expectedIds),
    500,
    'CAD_REPORT',
    'CAD report components mismatch',
  );
  ensure(
    canonicalJSON(mesh.groups.map((group) => group.id).sort()) === canonicalJSON(expectedIds),
    500,
    'CAD_MESH',
    'CAD mesh components mismatch',
  );
  ensure(
    report.passed === report.checks.every((check) => check.passed),
    500,
    'CAD_REPORT',
    'CAD report summary mismatch',
  );
  for (const [name, bytes] of map) {
    if (name.endsWith('.step'))
      ensure(
        bytes.subarray(0, 80).toString('ascii').includes('ISO-10303-21;'),
        500,
        'CAD_STEP',
        'Invalid STEP header',
      );
    if (name.endsWith('.stl'))
      ensure(
        bytes.length >= 84 &&
          bytes.readUInt32LE(80) > 0 &&
          84 + 50 * bytes.readUInt32LE(80) === bytes.length,
        500,
        'CAD_STL',
        'Invalid binary STL',
      );
    if (name === 'parts.zip')
      ensure(bytes.readUInt32LE(0) === 0x04034b50, 500, 'CAD_ZIP', 'Invalid ZIP header');
  }
  return { report, total };
}

function diskExecutor(python: string, dataDir: string): CadExecutor {
  return async (spec, signal) => {
    const base = join(dataDir, 'cad-work');
    mkdirSync(base, { recursive: true, mode: 0o700 });
    const directory = mkdtempSync(join(base, 'build-'));
    const output = join(directory, 'output');
    writeFileSync(join(directory, 'input.json'), canonicalJSON(spec), { mode: 0o600, flag: 'wx' });
    try {
      await new Promise<void>((ok, reject) => {
        let child: ChildProcess;
        let settled = false,
          outputBytes = 0,
          stderr = '';
        let outputExceeded = false;
        const terminate = () => {
          if (child.pid) {
            try {
              process.kill(-child.pid, 'SIGKILL');
            } catch {
              child.kill('SIGKILL');
            }
          }
        };
        const abort = () => terminate();
        const done = (error?: Error) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', abort);
          error ? reject(error) : ok();
        };
        child = spawn(
          python,
          [
            '-B',
            workerPath,
            '--parent-pid',
            String(process.pid),
            '--input',
            join(directory, 'input.json'),
            '--output',
            output,
          ],
          {
            cwd: directory,
            shell: false,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
              PATH: '/usr/bin:/bin',
              HOME: directory,
              TMPDIR: directory,
              LANG: 'C.UTF-8',
              PYTHONNOUSERSITE: '1',
              PYTHONDONTWRITEBYTECODE: '1',
              OPENBLAS_NUM_THREADS: '1',
              OMP_NUM_THREADS: '1',
              MKL_NUM_THREADS: '1',
            },
          },
        );
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) terminate();
        const onOutput = (chunk: Buffer) => {
          outputBytes += chunk.length;
          if (outputBytes > 64 * 1024) {
            outputExceeded = true;
            terminate();
          }
        };
        child.stdout?.on('data', onOutput);
        child.stderr?.on('data', (chunk: Buffer) => {
          onOutput(chunk);
          if (!outputExceeded) stderr += chunk.toString('utf8');
        });
        child.on('error', () => done(new Error('CAD_UNAVAILABLE')));
        child.on('close', (code) => {
          let error: Error | undefined;
          if (signal.aborted) error = new Error('CAD_INTERRUPTED');
          else if (outputExceeded) error = new Error('CAD_OUTPUT_LIMIT');
          else if (code !== 0) {
            error = new Error('CAD_COMPILE_FAILED');
            try {
              const last = JSON.parse(stderr.trim().split('\n').at(-1) ?? '{}');
              if (last.error === 'CAD_BUILD_FAILED' && typeof last.message === 'string')
                error = new CadExecutionError(
                  last.message.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 800),
                );
            } catch {
              /* Native diagnostic output stays private. */
            }
          }
          done(error);
        });
      });
      const root = realpathSync(output),
        found: CadOutput = [];
      let total = 0;
      const walk = (path: string, prefix = '', depth = 0) => {
        if (depth > 2) fail('CAD_ARTIFACTS');
        for (const entry of readdirSync(path, { withFileTypes: true })) {
          const name = prefix + entry.name,
            full = join(path, entry.name),
            info = lstatSync(full);
          if (info.isSymbolicLink() || !realpathSync(full).startsWith(root + sep))
            fail('CAD_ARTIFACTS');
          if (info.isDirectory()) walk(full, name + '/', depth + 1);
          else {
            if (
              !info.isFile() ||
              info.nlink !== 1 ||
              info.size > 32 * 1024 * 1024 ||
              found.length > 56
            )
              fail('CAD_ARTIFACT_LIMIT');
            total += info.size;
            if (total > CAD_MAX_BYTES) fail('CAD_ARTIFACT_LIMIT');
            found.push({ name, content: readFileSync(full) });
          }
        }
      };
      walk(output);
      return found;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

/** One local native process at a time. No AI/API configuration is passed to it. */
export class CadService {
  readonly capabilities: CadCapabilities;
  readonly userStorageBytes: number;
  readonly totalStorageBytes: number;
  private readonly executor: CadExecutor | null;
  private readonly timeoutMs: number;
  private active: { id: string; abort: AbortController } | null = null;
  private stopped = false;
  private completion: Promise<void> = Promise.resolve();
  constructor(
    readonly store: Store,
    dataDir: string,
    options: CadOptions = {},
  ) {
    const python = options.python ?? process.env.CAD_PYTHON ?? '';
    if (python && !isAbsolute(python))
      throw new Error('CAD_PYTHON must be an absolute interpreter path');
    this.executor =
      options.executor ??
      (python && existsSync(python) && process.platform !== 'win32'
        ? diskExecutor(python, resolve(dataDir))
        : null);
    this.timeoutMs = limit(options.timeoutMs, 120000);
    this.userStorageBytes = limit(options.userStorageBytes, 256 * 1024 * 1024);
    this.totalStorageBytes = limit(options.totalStorageBytes, 2048 * 1024 * 1024);
    this.capabilities = {
      configured: !!this.executor,
      compilerVersion: '1.0.0',
      limits: {
        maxBuildsPerProject: limit(options.maxBuildsPerProject, 30),
        maxBuildsPerUserDay: limit(options.maxBuildsPerUserDay, 10),
        maxBuildsPerInstanceDay: limit(options.maxBuildsPerInstanceDay, 100),
        maxArtifactBytes: CAD_MAX_BYTES,
      },
      ...(!this.executor ? { reason: 'CAD_NOT_CONFIGURED' } : {}),
    };
    store.run(
      "UPDATE studio_cad_builds SET status='failed',error_code='CAD_INTERRUPTED',finished_at=? WHERE status='running'",
      Date.now(),
    );
    // Only this single app process owns DATA_DIR (server.pid). Remove abandoned temporary work.
    const temporary = join(dataDir, 'cad-work');
    if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
    queueMicrotask(() => this.kick());
  }
  assertStorage(owner: string, added: number, excludingBuild?: string) {
    const stored = this.store.get<{ own: number; total: number }>(
      `SELECT COALESCE(sum(CASE WHEN b.owner_id=? THEN a.size ELSE 0 END),0) own,COALESCE(sum(a.size),0) total FROM studio_cad_artifacts a JOIN studio_cad_builds b ON b.id=a.build_id`,
      owner,
    )!;
    const reserved = this.store.get<{ own: number; total: number }>(
      `SELECT COALESCE(sum(CASE WHEN owner_id=? THEN 1 ELSE 0 END),0) own,count(*) total FROM studio_cad_builds WHERE status IN ('queued','running') AND id<>?`,
      owner,
      excludingBuild ?? '',
    )!;
    ensure(
      stored.own + reserved.own * CAD_MAX_BYTES + added <= this.userStorageBytes &&
        stored.total + reserved.total * CAD_MAX_BYTES + added <= this.totalStorageBytes,
      413,
      'CAD_STORAGE_LIMIT',
      'CAD storage quota reached / Достигнут лимит хранения CAD',
    );
  }
  kick() {
    if (this.stopped || this.active || !this.executor) return;
    const next = this.store.get<CadBuildRow>(
      "SELECT * FROM studio_cad_builds WHERE status='queued' ORDER BY created_at,id LIMIT 1",
    );
    if (!next) return;
    const project = this.store.get<{ version: number; job_id: string | null; suspended: number }>(
      'SELECT p.version,p.job_id,u.suspended FROM studio_projects p JOIN users u ON u.id=p.owner_id WHERE p.id=?',
      next.project_id,
    );
    const revision = this.store.get<CadRevisionRow>(
      'SELECT * FROM studio_cad_revisions WHERE id=?',
      next.revision_id,
    );
    if (
      !project ||
      project.suspended ||
      project.job_id ||
      project.version !== next.project_version ||
      latestCadRevision(this.store, next.project_id)?.id !== next.revision_id ||
      !revision?.spec
    ) {
      this.store.run(
        "UPDATE studio_cad_builds SET status='failed',error_code='CAD_STALE',finished_at=? WHERE id=?",
        Date.now(),
        next.id,
      );
      queueMicrotask(() => this.kick());
      return;
    }
    this.store.run("UPDATE studio_cad_builds SET status='running' WHERE id=?", next.id);
    const abort = new AbortController();
    this.active = { id: next.id, abort };
    this.completion = this.run(next, cadSpecSchema.parse(JSON.parse(revision.spec)), abort);
  }
  private async run(row: CadBuildRow, spec: CadSpec, abort: AbortController) {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, this.timeoutMs);
    try {
      const artifacts = await this.executor!(spec, abort.signal);
      if (abort.signal.aborted) fail(timedOut ? 'CAD_TIMEOUT' : 'CAD_CANCELLED');
      const checked = validateCadOutput(spec, artifacts);
      this.store.transaction(() => {
        const current = this.store.get<{ status: string; suspended: number }>(
          'SELECT b.status,u.suspended FROM studio_cad_builds b JOIN users u ON u.id=b.owner_id WHERE b.id=?',
          row.id,
        );
        if (!current || current.status !== 'running' || current.suspended) return;
        this.assertStorage(row.owner_id, checked.total, row.id);
        for (const artifact of artifacts)
          this.store.run(
            'INSERT INTO studio_cad_artifacts(build_id,name,size,sha256,content) VALUES(?,?,?,?,?)',
            row.id,
            artifact.name,
            artifact.content.length,
            digest(artifact.content),
            artifact.content,
          );
        this.store.run(
          "UPDATE studio_cad_builds SET status='succeeded',report=?,finished_at=? WHERE id=?",
          JSON.stringify(checked.report),
          Date.now(),
          row.id,
        );
      });
    } catch (error) {
      const raw =
        error instanceof Error && 'code' in error && typeof error.code === 'string'
          ? error.code
          : error instanceof Error
            ? error.message
            : '';
      const code = timedOut
        ? 'CAD_TIMEOUT'
        : abort.signal.aborted
          ? 'CAD_CANCELLED'
          : /^CAD_[A-Z_]+$/.test(raw)
            ? raw
            : 'CAD_COMPILE_FAILED';
      this.store.run(
        "UPDATE studio_cad_builds SET status='failed',error_code=?,error_detail=?,finished_at=? WHERE id=? AND status='running'",
        code,
        error instanceof CadExecutionError ? error.detail : null,
        Date.now(),
        row.id,
      );
    } finally {
      clearTimeout(timer);
      this.active = null;
      queueMicrotask(() => this.kick());
    }
  }
  cancel(buildId: string) {
    this.store.run(
      "UPDATE studio_cad_builds SET status='failed',error_code='CAD_CANCELLED',finished_at=? WHERE id=? AND status IN ('queued','running')",
      Date.now(),
      buildId,
    );
    if (this.active?.id === buildId) this.active.abort.abort();
  }
  async stop() {
    this.stopped = true;
    this.active?.abort.abort();
    await this.completion;
  }
}
