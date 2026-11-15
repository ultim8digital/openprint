/** Opt-in provider evaluation on fictional inputs. Default execution never calls an API. */
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { cadAIInput, requestCadProposal } from '../server/cad-ai.js';
import { loadStudioAIConfig, resolveStudioAIConfig, StudioAIError } from '../server/studio-ai.js';
import { validateCadOutput } from '../server/cad-runner.js';
import type { StudioBrief } from '../shared/studio.js';

type Case = {
  id: string;
  language: 'ru' | 'en';
  message: string;
  expected: { bounds: [number, number, number]; volume: number; solids: number } | null;
};
const cases: Case[] = [
  {
    id: 'plate',
    language: 'ru',
    message:
      'Учебная пластина без фасок: прямоугольник 80×50 мм, толщина 6 мм. Минимальный угол в (0,0,0), толщина по Z. Одно сквозное круглое отверстие диаметром 8 мм, ось Z, центр (40,25). Материал PLA, процесс FDM. Одно тело, габариты [80,50,6] мм, численный допуск проверки геометрии 0.01 мм. Это геометрический пример, без эксплуатационных нагрузок и без заявления о готовности производства. Построй только описанную геометрию.',
    expected: { bounds: [80, 50, 6], volume: 80 * 50 * 6 - Math.PI * 4 ** 2 * 6, solids: 1 },
  },
  {
    id: 'assembly',
    language: 'en',
    message:
      'A fictional geometric layout of exactly two separate solid blocks, no joints, holes or fillets. Each block is 20 by 10 by 5 mm in X,Y,Z. First minimum corner is (0,0,0); second minimum corner is (40,0,0). Both are PLA for FDM. Use two physical components, no root-body operations. Expected overall bounds [60,10,5] mm and 2 solids. Geometry-check tolerance 0.01 mm. These are separate samples, not a functional joined product; no loads or manufacturing-readiness claims.',
    expected: { bounds: [60, 10, 5], volume: 2 * 20 * 10 * 5, solids: 2 },
  },
  {
    id: 'missing-dimensions',
    language: 'ru',
    message:
      'Нужен переходник для сломанного крепления. Измерений и чертежа пока нет; ничего не известно о форме, посадках, нагрузках и материале. Не придумывай размеры. Верни spec=null и вопросы, необходимые для проектирования.',
    expected: null,
  },
];

async function main() {
  const args = process.argv.slice(2);
  let live = false;
  let selected = 'plate';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--live') live = true;
    else if (args[i] === '--case' && args[i + 1]) selected = args[++i];
    else
      throw new Error(
        'Usage: npm run ai:eval -- [--case plate|assembly|missing-dimensions|all] [--live]',
      );
  }
  const batch = selected === 'all' ? cases : cases.filter((item) => item.id === selected);
  if (!batch.length) throw new Error('Unknown evaluation case');
  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = resolveStudioAIConfig(loadStudioAIConfig());
  console.log(
    JSON.stringify(
      {
        mode: live ? 'live-provider' : 'dry-run',
        model: config.cadModel,
        apiKeyConfigured: !!config.apiKey,
        cases: batch.map((item) => ({
          id: item.id,
          message: item.message,
          expected: item.expected,
        })),
        maximumRequests: batch.length,
        maximumOutputTokensPerRequest: config.cadMaxOutputTokens,
        automaticRetries: 0,
        note: 'This standalone evaluation has its own bounded case list; it does not use the community AI ledger or impose a monetary cap.',
      },
      null,
      2,
    ),
  );
  if (!live) {
    console.log(
      'Dry run complete. --live explicitly enables paid provider calls on these fictional inputs.',
    );
    return;
  }
  if (!config.apiKey)
    throw new Error(
      'Set OPENAI_API_KEY locally on the server; never paste it into a project or commit it.',
    );
  const python = process.env.CAD_PYTHON;
  if (
    batch.some((item) => item.expected) &&
    (!python || !isAbsolute(python) || !existsSync(python))
  )
    throw new Error(
      'Set CAD_PYTHON to an installed absolute interpreter path before spending API calls on geometry evaluation.',
    );
  const directory = resolve(
    '.local',
    'ai-eval',
    new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID(),
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (batch.some((item) => item.expected)) {
    const probe = spawnSync(python!, [resolve('cad-worker/worker.py'), '--check'], {
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 64 * 1024,
      env: {
        PATH: '/usr/bin:/bin',
        HOME: directory,
        TMPDIR: directory,
        LANG: 'C.UTF-8',
        PYTHONNOUSERSITE: '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
    });
    if (probe.status !== 0)
      throw new Error(
        'CAD runtime check failed before any provider call. Run worker.py --check to diagnose.',
      );
  }
  const rows: Record<string, unknown>[] = [];
  for (const item of batch) {
    const started = Date.now();
    let observedUsage: unknown = null;
    let observedProposal: unknown = null;
    const brief: StudioBrief = {
      title: `CAD evaluation: ${item.id}`,
      purpose: item.message,
      requestKind: 'design',
      process: 'UNSURE',
      material: '',
      quantity: null,
      city: '',
      part: null,
      requirements: [],
      questions: [],
      assumptions: [],
      components: [],
      operations: [],
      acceptance: [],
    };
    const input = cadAIInput({
      idea: item.message,
      brief,
      language: item.language,
      spec: null,
      message: item.message,
    });
    try {
      const result = await requestCadProposal(config, { input, language: item.language });
      observedUsage = result.usage;
      observedProposal = result.proposal;
      let passed = false;
      let geometry: unknown = null;
      if (!item.expected) {
        passed = result.proposal.spec === null && result.proposal.questions.length > 0;
      } else if (result.proposal.spec) {
        const scratch = join(directory, item.id);
        mkdirSync(scratch, { mode: 0o700 });
        const output = join(scratch, 'output');
        try {
          const child = spawnSync(
            python!,
            [
              resolve('cad-worker/worker.py'),
              '--output',
              output,
              '--parent-pid',
              String(process.pid),
            ],
            {
              input: JSON.stringify(result.proposal.spec),
              encoding: 'utf8',
              timeout: 120000,
              maxBuffer: 64 * 1024,
              env: {
                PATH: '/usr/bin:/bin',
                HOME: scratch,
                TMPDIR: scratch,
                LANG: 'C.UTF-8',
                PYTHONNOUSERSITE: '1',
                PYTHONDONTWRITEBYTECODE: '1',
              },
            },
          );
          if (child.status !== 0) throw new Error('Native CAD compilation failed');
          const artifacts: { name: string; content: Buffer }[] = [];
          function collect(path: string, prefix = '') {
            for (const entry of readdirSync(path, { withFileTypes: true })) {
              if (entry.isDirectory()) collect(join(path, entry.name), prefix + entry.name + '/');
              else
                artifacts.push({
                  name: prefix + entry.name,
                  content: readFileSync(join(path, entry.name)),
                });
            }
          }
          collect(output);
          const report = validateCadOutput(result.proposal.spec, artifacts).report;
          const checks = {
            geometry: report.passed,
            solids: report.solids === item.expected.solids,
            bounds: report.bounds_mm.every(
              (value, i) => Math.abs(value - item.expected!.bounds[i]) < 0.001,
            ),
            volume: Math.abs(report.volume_mm3 - item.expected.volume) < 0.001,
          };
          passed = Object.values(checks).every(Boolean);
          geometry = { checks, report };
        } finally {
          rmSync(scratch, { recursive: true, force: true });
        }
      }
      rows.push({
        id: item.id,
        passed,
        durationMs: Date.now() - started,
        usage: result.usage,
        proposal: result.proposal,
        geometry,
      });
    } catch (error) {
      rows.push({
        id: item.id,
        passed: false,
        durationMs: Date.now() - started,
        code: error instanceof StudioAIError ? error.code : 'EVALUATION_FAILED',
        usage: error instanceof StudioAIError ? error.usage : observedUsage,
        proposal: observedProposal,
      });
    }
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify(
        {
          schema: 'neofab-ai-evaluation/1',
          model: config.cadModel,
          cases: rows,
          scope:
            'Three small fictional fixtures. Bounds/volume do not prove every feature or engineering correctness; inspect proposals manually.',
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    console.log(`${item.id}: ${rows.at(-1)!.passed ? 'PASS' : 'FAIL'}`);
    // Stop on a failed case; no further spending and no automatic repair/retry.
    if (!rows.at(-1)!.passed) break;
  }
  console.log(`Private evaluation report: ${join(directory, 'report.json')}`);
  if (rows.some((row) => !row.passed)) process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Evaluation failed');
  process.exitCode = 1;
});
