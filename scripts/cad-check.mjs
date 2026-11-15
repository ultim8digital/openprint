// Run a real local CAD build and check its artifacts through the server validator.
// No API keys or network access are needed. Invoke after `npm run build`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { cadSpecSchema } from '../build/shared/cad.js';
import { validateCadOutput } from '../build/server/cad-runner.js';

const python = process.env.CAD_PYTHON;
if (!python || !isAbsolute(python))
  throw new Error('Set CAD_PYTHON to an absolute Python interpreter path');
const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'neofab-cad-check-'));
const environment = {
  PATH: '/usr/bin:/bin',
  HOME: directory,
  TMPDIR: directory,
  LANG: 'C.UTF-8',
  PYTHONDONTWRITEBYTECODE: '1',
  PYTHONNOUSERSITE: '1',
};
try {
  for (const name of ['plate', 'panel-shelf']) {
    const spec = cadSpecSchema.parse(
      JSON.parse(readFileSync(join(root, 'cad-worker', 'examples', `${name}.json`), 'utf8')),
    );
    const output = join(directory, name);
    const child = spawnSync(
      python,
      [join(root, 'cad-worker/worker.py'), '--output', output, '--parent-pid', String(process.pid)],
      {
        input: JSON.stringify(spec),
        encoding: 'utf8',
        env: environment,
        timeout: 120000,
        maxBuffer: 64 * 1024,
      },
    );
    assert.equal(child.status, 0, `CAD worker failed: ${child.error?.message ?? child.stderr}`);
    assert.equal(JSON.parse(child.stdout).schema_version, 'neofab-cad-result/1');
    const artifacts = [];
    function collect(path, prefix = '') {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const name = prefix + entry.name;
        if (entry.isDirectory()) collect(join(path, entry.name), `${name}/`);
        else artifacts.push({ name, content: readFileSync(join(path, entry.name)) });
      }
    }
    collect(output);
    const { report } = validateCadOutput(spec, artifacts);
    assert.equal(report.passed, name === 'plate');
    assert.equal(report.solids, name === 'plate' ? 1 : 3);
    assert.equal(report.verification_scope, 'geometry_only');
    if (name === 'plate')
      assert.ok(Math.abs(report.volume_mm3 - (60 * 40 * 6 - Math.PI * 4 ** 2 * 6)) < 0.0001);
    console.log(
      `${name}: actual CAD compiled; artifact hashes and server contracts passed; geometry passed=${report.passed}`,
    );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
