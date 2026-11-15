import { randomUUID } from 'node:crypto';
import type { StudioUsage } from '../shared/studio.js';
import type { Store } from './database.js';
import { ensure } from './security.js';
import { StudioAIError, type ResolvedStudioAIConfig } from './studio-ai.js';

export type AIRunRow = {
  id: string;
  owner_id: string;
  project_id: string | null;
  request_id: string;
  request_hash: string;
  input_version: number;
  model: string;
  quality: 'standard' | 'review';
  task: 'brief' | 'cad';
  status: 'running' | 'complete' | 'failed' | 'stale';
  input_tokens: number;
  output_tokens: number;
  result_version: number | null;
  error_code: string | null;
  created_at: number;
  finished_at: number | null;
};

export function studioUsage(store: Store, projectId: string): StudioUsage {
  const totals = store.get<{ calls: number; input: number; output: number }>(
    'SELECT count(*) AS calls,COALESCE(sum(input_tokens),0) AS input,COALESCE(sum(output_tokens),0) AS output FROM studio_ai_runs WHERE project_id=?',
    projectId,
  )!;
  return {
    projectCalls: totals.calls,
    inputTokens: totals.input,
    outputTokens: totals.output,
    runs: store.all(
      'SELECT id,model,task,status,created_at,input_tokens,output_tokens FROM studio_ai_runs WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 20',
      projectId,
    ),
  };
}

/** Called inside the caller's transaction, after project ownership has been established. */
export function reserveAIRequest(
  store: Store,
  ai: ResolvedStudioAIConfig,
  options: {
    ownerId: string;
    projectId: string;
    requestId: string;
    requestHash: string;
    inputVersion: number;
    task: 'brief' | 'cad';
    model: string;
    quality: 'standard' | 'review';
    prepare: () => string;
  },
) {
  const now = Date.now();
  // Unknown provider outcomes consume the attempt and are never retried automatically.
  store.run(
    "UPDATE studio_ai_runs SET status='failed',error_code='AI_INTERRUPTED',finished_at=? WHERE status='running' AND created_at<?",
    now,
    now - ai.timeoutMs - 60000,
  );
  const prior = store.get<AIRunRow>(
    'SELECT * FROM studio_ai_runs WHERE owner_id=? AND project_id=? AND request_id=?',
    options.ownerId,
    options.projectId,
    options.requestId,
  );
  if (prior) {
    ensure(
      prior.task === options.task && prior.request_hash === options.requestHash,
      409,
      'AI_REQUEST_CHANGED',
      'This request ID was used for different input / Этот идентификатор уже использован для другого запроса',
    );
    return { run: prior, replay: true, input: '' };
  }
  if (!ai.apiKey) throw new StudioAIError('AI_DISABLED');
  const input = options.prepare();
  const count = (where: string, ...params: (string | number)[]) =>
    store.get<{ n: number }>(`SELECT count(*) AS n FROM studio_ai_runs WHERE ${where}`, ...params)!
      .n;
  ensure(
    count('project_id=?', options.projectId) < ai.maxCallsPerProject,
    429,
    'AI_PROJECT_LIMIT',
    'Project AI call limit reached / Достигнут лимит ИИ для проекта',
  );
  ensure(
    count('owner_id=? AND created_at>?', options.ownerId, now - 86400000) < ai.maxCallsPerUserDay,
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
    count("owner_id=? AND status='running'", options.ownerId) === 0,
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
  const runId = randomUUID();
  store.run(
    "INSERT INTO studio_ai_runs(id,owner_id,project_id,request_id,request_hash,input_version,model,quality,task,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'running',?)",
    runId,
    options.ownerId,
    options.projectId,
    options.requestId,
    options.requestHash,
    options.inputVersion,
    options.model,
    options.quality,
    options.task,
    now,
  );
  return {
    run: store.get<AIRunRow>('SELECT * FROM studio_ai_runs WHERE id=?', runId)!,
    replay: false,
    input,
  };
}

export function assertAIReplayFinished(run: AIRunRow) {
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
}
