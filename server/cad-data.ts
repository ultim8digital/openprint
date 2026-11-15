import type { Store } from './database.js';
import type { CadBuild, CadRevision, CadSpec } from '../shared/cad.js';
import type { StudioCheck } from '../shared/studio.js';
import { ensure } from './security.js';

export type CadRevisionRow = Omit<CadRevision, 'spec'> & {
  project_id: string;
  spec: string | null;
};
export type CadBuildRow = Omit<CadBuild, 'report' | 'artifacts'> & {
  owner_id: string;
  project_id: string;
  request_id: string;
  report: string | null;
};
export function latestCadRevision(store: Store, projectId: string) {
  return store.get<CadRevisionRow>(
    'SELECT * FROM studio_cad_revisions WHERE project_id=? ORDER BY number DESC LIMIT 1',
    projectId,
  );
}
export function cadRevision(row: CadRevisionRow | undefined): CadRevision | null {
  return row?.spec
    ? {
        id: row.id,
        number: row.number,
        project_version: row.project_version,
        spec: JSON.parse(row.spec) as CadSpec,
        sha256: row.sha256,
        created_at: row.created_at,
      }
    : null;
}
export function cadBuild(store: Store, row: CadBuildRow): CadBuild {
  return {
    id: row.id,
    revision_id: row.revision_id,
    project_version: row.project_version,
    status: row.status,
    error_code: row.error_code,
    error_detail: row.error_detail ?? null,
    created_at: row.created_at,
    finished_at: row.finished_at,
    report: row.report ? JSON.parse(row.report) : null,
    artifacts: store.all(
      'SELECT name,size,sha256 FROM studio_cad_artifacts WHERE build_id=? ORDER BY name',
      row.id,
    ),
  };
}
export function currentCadBuild(store: Store, projectId: string, version: number) {
  const revision = latestCadRevision(store, projectId);
  if (!revision?.spec) return null;
  return (
    store.get<CadBuildRow>(
      "SELECT * FROM studio_cad_builds WHERE project_id=? AND project_version=? AND revision_id=? AND status='succeeded' ORDER BY created_at DESC LIMIT 1",
      projectId,
      version,
      revision.id,
    ) ?? null
  );
}
export function cadChecks(store: Store, projectId: string, version: number): StudioCheck[] {
  if (!latestCadRevision(store, projectId)?.spec) return [];
  const row = currentCadBuild(store, projectId, version);
  if (!row)
    return [
      {
        code: 'cad_build',
        level: 'required',
        ru: 'Пересоберите CAD для текущей версии ТЗ или удалите CAD из проекта.',
        en: 'Build CAD for this brief version or remove CAD from the project.',
      },
    ];
  const build = cadBuild(store, row);
  return [
    {
      code: 'cad_geometry',
      level: build.report?.passed ? 'passed' : 'attention',
      ru: build.report?.passed
        ? 'Проверки геометрии CAD пройдены. Прочность, допуски и изготовление требуют проверки исполнителем.'
        : 'В отчёте CAD есть замечания. Комплект передаётся для обсуждения и расчёта.',
      en: build.report?.passed
        ? 'CAD geometry checks passed. Strength, tolerances and manufacturing need provider review.'
        : 'The CAD report contains issues. The package is for discussion and quotation.',
    },
  ];
}
export function cadSnapshot(store: Store, projectId: string, version: number) {
  const revision = latestCadRevision(store, projectId);
  if (!revision?.spec) return null;
  const row = currentCadBuild(store, projectId, version);
  ensure(
    row,
    409,
    'CAD_BUILD_REQUIRED',
    'Build CAD for this version first / Сначала соберите CAD для этой версии',
  );
  const build = cadBuild(store, row);
  return {
    revision_id: revision.id,
    revision_number: revision.number,
    spec_sha256: revision.sha256,
    build_id: row.id,
    compiler_version: build.report!.compiler_version,
    geometry_passed: build.report!.passed,
    verification_scope: 'geometry_only' as const,
    artifacts: build.artifacts,
  };
}
export type CadSnapshot = ReturnType<typeof cadSnapshot>;
