import { Mesh, MeshBasicMaterial } from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { partGeometry, geometryInfo, partSchema } from '../shared/parts.js';
import type { StudioBrief, StudioCheck } from '../shared/studio.js';
import { ensure, digest } from './security.js';

/** Stable across object property order; array order remains meaningful. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJSON(object[key])}`)
    .join(',')}}`;
}

export function validTemplate(brief: StudioBrief) {
  if (!brief.part || brief.process !== 'FDM' || brief.components.length > 0) return false;
  const parsed = partSchema.safeParse(brief.part);
  return (
    parsed.success &&
    (brief.part.kind !== 'block' || brief.part.hole === 0) &&
    (brief.part.kind !== 'tube' || brief.part.depth === brief.part.width)
  );
}

export function studioChecks(brief: StudioBrief): StudioCheck[] {
  const checks: StudioCheck[] = [];
  const add = (condition: boolean, code: string, ru: string, en: string) => {
    if (!condition) checks.push({ code, level: 'required', ru, en });
  };
  add(
    brief.city.length >= 2,
    'city',
    'Укажите город или место доставки.',
    'Specify the city or delivery location.',
  );
  add(brief.quantity !== null, 'quantity', 'Укажите количество изделий.', 'Specify the quantity.');
  if (brief.questions.length)
    checks.push({
      code: 'questions',
      level: 'attention',
      ru: 'Открытые вопросы войдут в ТЗ для обсуждения с исполнителем.',
      en: 'Open questions will be included in the brief for discussion with the provider.',
    });
  if (brief.assumptions.length)
    checks.push({
      code: 'assumptions',
      level: 'attention',
      ru: 'Неподтверждённые предположения сохраняются в ТЗ и требуют согласования.',
      en: 'Unconfirmed assumptions remain in the brief and require agreement.',
    });
  if (brief.components.some((component) => component.quantity === null))
    checks.push({
      code: 'component_quantity',
      level: 'attention',
      ru: 'Количество некоторых компонентов ещё требуется уточнить.',
      en: 'Some component quantities still need clarification.',
    });
  if (brief.part) {
    const valid = validTemplate(brief);
    add(
      valid,
      'template',
      'Шаблон доступен только для одной FDM-детали. Проверьте размеры, отверстие и стенку; для сборки оставьте ТЗ без шаблона.',
      'A template supports one FDM part. Check dimensions, hole and wall; keep assemblies as briefs without a template.',
    );
    if (valid)
      checks.push({
        code: 'geometry',
        level: 'passed',
        ru: 'Размеры шаблона допустимы. Это проверка геометрии; слайсинг и изготовление ещё не проверены.',
        en: 'Template dimensions are valid. This is a geometry check; slicing and manufacturing are not verified.',
      });
  }
  checks.push({
    code: 'production',
    level: 'attention',
    ru: 'Исполнитель должен согласовать технологию, материал, допуски и подготовку оборудования. CAM и G-code не созданы.',
    en: 'The provider must agree on process, material, tolerances and machine setup. No CAM or G-code has been generated.',
  });
  if (!brief.part)
    checks.push({
      code: 'brief_only',
      level: 'attention',
      ru: 'Пакет содержит техническое задание. CAD-модель ещё не создана.',
      en: 'The packet contains a design brief. No CAD model has been created.',
    });
  return checks;
}

export function templateSTL(brief: StudioBrief): Buffer | null {
  if (!brief.part) return null;
  ensure(
    validTemplate(brief),
    409,
    'TEMPLATE_INVALID',
    'Review the part template / Проверьте шаблон детали',
  );
  const geometry = partGeometry(brief.part);
  const material = new MeshBasicMaterial();
  try {
    geometryInfo(geometry);
    const result = new STLExporter().parse(new Mesh(geometry, material), { binary: true });
    return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  } finally {
    geometry.dispose();
    material.dispose();
  }
}

export function studioPacket(
  projectId: string,
  version: number,
  brief: StudioBrief,
  model: Buffer | null,
) {
  const canonical = canonicalJSON(brief),
    hash = digest(canonical);
  return {
    schema_version: 'neofab-packet/1',
    project_id: projectId,
    version,
    confirmed_hash: hash,
    brief,
    checks: studioChecks(brief),
    manufacturing_release: 'requires_provider_review',
    confirmation_scope: 'brief_for_discussion_and_quote',
    geometry_scope: model ? 'bounded_fdm_template_only' : 'no_geometry',
    cam: 'not_generated',
    manifest: [
      {
        path: 'brief.json',
        media_type: 'application/json',
        bytes: Buffer.byteLength(canonical),
        sha256: hash,
        encoding: 'canonical-json',
      },
      ...(model
        ? [
            {
              path: 'model.stl',
              media_type: 'model/stl',
              bytes: model.length,
              sha256: digest(model),
              units: 'mm',
              generator: 'openprint-parametric-template/1',
            },
          ]
        : []),
    ],
  };
}
