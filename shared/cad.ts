import { z } from 'zod';

/** Versioned declarative geometry. No executable source or filesystem paths are accepted. */
export const CAD_SCHEMA_VERSION = 'neofab-cad/1' as const;
export const CAD_MAX_PARTS = 24;
export const CAD_MAX_OPERATIONS = 300;

const coordinate = z.number().finite().min(-2000).max(2000);
const positive = z.number().finite().gt(0).max(2000);
const point = z.tuple([coordinate, coordinate, coordinate]);
const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$(?![\s\S])/);
const text = (max: number) => z.string().max(max);
const operationIdentity = { id: identifier };

type Point2 = [number, number];
function simplePolygon(points: Point2[]) {
  if (new Set(points.map((p) => `${p[0]},${p[1]}`)).size !== points.length) return false;
  const area =
    points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2;
  if (Math.abs(area) < 1e-7) return false;
  const orientation = (a: Point2, b: Point2, c: Point2) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (a: Point2, b: Point2, p: Point2) =>
    Math.min(a[0], b[0]) - 1e-9 <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    Math.min(a[1], b[1]) - 1e-9 <= p[1] &&
    p[1] <= Math.max(a[1], b[1]) + 1e-9;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const a = points[i],
        b = points[(i + 1) % points.length];
      const c = points[j],
        d = points[(j + 1) % points.length];
      const abC = orientation(a, b, c),
        abD = orientation(a, b, d);
      const cdA = orientation(c, d, a),
        cdB = orientation(c, d, b);
      if (
        (abC * abD < 0 && cdA * cdB < 0) ||
        (Math.abs(abC) <= 1e-9 && onSegment(a, b, c)) ||
        (Math.abs(abD) <= 1e-9 && onSegment(a, b, d)) ||
        (Math.abs(cdA) <= 1e-9 && onSegment(c, d, a)) ||
        (Math.abs(cdB) <= 1e-9 && onSegment(c, d, b))
      )
        return false;
    }
  }
  return true;
}

export const cadOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...operationIdentity,
      type: z.literal('box'),
      mode: z.enum(['add', 'cut']),
      size: z.tuple([positive, positive, positive]),
      at: point,
    })
    .strict(),
  z
    .object({
      ...operationIdentity,
      type: z.literal('cylinder'),
      mode: z.enum(['add', 'cut']),
      radius: positive,
      height: positive,
      axis: z.enum(['x', 'y', 'z']),
      at: point,
    })
    .strict(),
  z
    .object({
      ...operationIdentity,
      type: z.literal('extrude'),
      mode: z.enum(['add', 'cut']),
      points: z
        .array(z.tuple([coordinate, coordinate]))
        .min(3)
        .max(100),
      plane: z.enum(['XY', 'XZ', 'YZ']),
      distance: positive,
      at: point,
    })
    .strict(),
  z
    .object({
      ...operationIdentity,
      type: z.literal('fillet'),
      radius: positive,
      selector: z.enum(['|X', '|Y', '|Z', '>Z', '<Z', 'all']),
    })
    .strict(),
  z
    .object({
      ...operationIdentity,
      type: z.literal('chamfer'),
      length: positive,
      selector: z.enum(['|X', '|Y', '|Z', '>Z', '<Z', 'all']),
    })
    .strict(),
]);
export type CadOperation = z.infer<typeof cadOperationSchema>;

const partFields = {
  name: z.string().min(1).max(120),
  material: text(160),
  process: text(160),
};
export const cadComponentSchema = z
  .object({
    id: identifier,
    ...partFields,
    operations: z.array(cadOperationSchema).min(1).max(60),
    at: point,
    rotation: point,
    quantity: z.literal(1),
  })
  .strict();
export type CadComponent = z.infer<typeof cadComponentSchema>;

export const cadSpecSchema = z
  .object({
    schema_version: z.literal(CAD_SCHEMA_VERSION),
    ...partFields,
    units: z.literal('mm'),
    description: text(4000),
    assumptions: z.array(text(500)).max(30),
    missing_geometry: z.array(text(500)).max(30),
    operations: z.array(cadOperationSchema).max(60),
    components: z.array(cadComponentSchema).max(CAD_MAX_PARTS),
    requirements: z
      .object({
        expected_solids: z.number().int().min(1).max(CAD_MAX_PARTS),
        bounds: z.tuple([positive, positive, positive]).nullable(),
        tolerance: z.number().finite().gt(0).max(10),
      })
      .strict(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const ids = [...(spec.operations.length ? ['body'] : []), ...spec.components.map((c) => c.id)];
    if (!ids.length || ids.length > CAD_MAX_PARTS)
      ctx.addIssue({ code: 'custom', path: ['components'], message: 'Supply 1–24 physical parts' });
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        path: ['components'],
        message: 'Component IDs must be unique',
      });
    if (
      spec.operations.length + spec.components.reduce((n, part) => n + part.operations.length, 0) >
      CAD_MAX_OPERATIONS
    )
      ctx.addIssue({
        code: 'custom',
        path: ['components'],
        message: 'Maximum 300 total operations',
      });
    const checkOperations = (operations: CadOperation[], path: (string | number)[]) => {
      if (new Set(operations.map((operation) => operation.id)).size !== operations.length)
        ctx.addIssue({
          code: 'custom',
          path,
          message: 'Operation IDs must be unique within each part',
        });
      operations.forEach((operation, index) => {
        if (operation.type === 'extrude' && !simplePolygon(operation.points))
          ctx.addIssue({
            code: 'custom',
            path: [...path, index, 'points'],
            message: 'Polygon must be simple, nonzero and have unique vertices',
          });
      });
    };
    checkOperations(spec.operations, ['operations']);
    spec.components.forEach((part, index) =>
      checkOperations(part.operations, ['components', index, 'operations']),
    );
  });
export type CadSpec = z.infer<typeof cadSpecSchema>;

const outputCoordinate = z.number().finite().min(-20000).max(20000);
const outputPoint = z.tuple([outputCoordinate, outputCoordinate, outputCoordinate]);
const outputLength = z.number().finite().min(0).max(40000);
const outputBounds = z.tuple([outputLength, outputLength, outputLength]);
const outputVolume = z.number().finite().min(0).max(64_000_000_000_000);

export const cadReportSchema = z
  .object({
    schema_version: z.literal('neofab-cad-report/1'),
    compiler_version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$(?![\s\S])/)
      .max(40),
    passed: z.boolean(),
    verification_scope: z.literal('geometry_only'),
    manufacturing_release: z.literal('requires_engineer_review'),
    checks: z
      .array(
        z
          .object({
            code: z.enum([
              'component_solid',
              'brep',
              'solid_count',
              'missing_geometry',
              'bounds',
              'interference',
            ]),
            name: text(200),
            passed: z.boolean(),
            detail: text(16000),
          })
          .strict(),
      )
      .min(1)
      .max(400),
    warnings: z.array(text(500)).max(64),
    bounds_mm: outputBounds,
    volume_mm3: outputVolume,
    solids: z
      .number()
      .int()
      .min(1)
      .max(CAD_MAX_PARTS * CAD_MAX_PARTS),
    components: z
      .array(
        z
          .object({
            id: identifier,
            ...partFields,
            quantity: z.literal(1),
            bounds_mm: outputBounds,
            volume_mm3: outputVolume,
          })
          .strict(),
      )
      .min(1)
      .max(CAD_MAX_PARTS),
    operations: z
      .array(
        z
          .object({
            component: identifier,
            operations: z
              .array(
                z
                  .object({
                    id: identifier,
                    type: z.enum(['box', 'cylinder', 'extrude', 'fillet', 'chamfer']),
                    volume_before: outputVolume,
                    volume_after: outputVolume,
                  })
                  .strict(),
              )
              .min(1)
              .max(60),
          })
          .strict(),
      )
      .min(1)
      .max(CAD_MAX_PARTS),
  })
  .strict()
  .superRefine((report, ctx) => {
    if (report.passed !== report.checks.every((check) => check.passed))
      ctx.addIssue({
        code: 'custom',
        path: ['passed'],
        message: 'Report result does not match its checks',
      });
    const ids = new Set(report.components.map((component) => component.id));
    if (ids.size !== report.components.length)
      ctx.addIssue({
        code: 'custom',
        path: ['components'],
        message: 'Report component IDs must be unique',
      });
    if (
      new Set(report.operations.map((entry) => entry.component)).size !==
        report.operations.length ||
      report.operations.length !== ids.size ||
      report.operations.some((entry) => !ids.has(entry.component)) ||
      report.operations.reduce((n, entry) => n + entry.operations.length, 0) > CAD_MAX_OPERATIONS
    )
      ctx.addIssue({
        code: 'custom',
        path: ['operations'],
        message: 'Report operations do not match its components or limits',
      });
  });
export type CadReport = z.infer<typeof cadReportSchema>;

export const cadMeshSchema = z
  .object({
    schema_version: z.literal('neofab-cad-mesh/1'),
    units: z.literal('mm'),
    vertices: z.array(outputPoint).min(3).max(200_000),
    triangles: z
      .array(z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)]))
      .min(1)
      .max(200_000),
    groups: z
      .array(
        z
          .object({
            id: identifier,
            name: partFields.name,
            start: z.number().int().min(0).max(200_000),
            count: z.number().int().min(1).max(200_000),
            center: outputPoint,
          })
          .strict(),
      )
      .min(1)
      .max(CAD_MAX_PARTS),
    bounds: outputBounds,
  })
  .strict()
  .superRefine((mesh, ctx) => {
    if (mesh.triangles.some((triangle) => triangle.some((index) => index >= mesh.vertices.length)))
      ctx.addIssue({
        code: 'custom',
        path: ['triangles'],
        message: 'Mesh triangle references an absent vertex',
      });
    if (new Set(mesh.groups.map((group) => group.id)).size !== mesh.groups.length)
      ctx.addIssue({ code: 'custom', path: ['groups'], message: 'Mesh group IDs must be unique' });
    let end = 0;
    for (const group of mesh.groups) {
      if (group.start !== end) {
        ctx.addIssue({
          code: 'custom',
          path: ['groups'],
          message: 'Mesh groups must partition triangles in order',
        });
        break;
      }
      end = group.start + group.count;
    }
    if (end !== mesh.triangles.length)
      ctx.addIssue({
        code: 'custom',
        path: ['groups'],
        message: 'Mesh groups must cover every triangle',
      });
  });
export type CadMesh = z.infer<typeof cadMeshSchema>;

export const cadRootArtifactNames = [
  'model.step',
  'model.stl',
  'mesh.json',
  'spec.json',
  'report.json',
  'bom.csv',
  'parts.zip',
] as const;
export const cadArtifactPathSchema = z
  .string()
  .max(100)
  .refine((path) => {
    if ((cadRootArtifactNames as readonly string[]).includes(path)) return true;
    const match =
      /^parts\/([A-Za-z][A-Za-z0-9_-]{0,39})\/([A-Za-z][A-Za-z0-9_-]{0,39})\.(step|stl)$/.exec(
        path,
      );
    return !!match && match[0].length === path.length && match[1] === match[2];
  }, 'Unsupported CAD artifact path');
const artifactFields = {
  size: z
    .number()
    .int()
    .min(1)
    .max(32 * 1024 * 1024),
  sha256: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]{64}$/),
};
export const cadArtifactSchema = z
  .object({ name: cadArtifactPathSchema, ...artifactFields })
  .strict();
export type CadArtifact = z.infer<typeof cadArtifactSchema>;
export const cadManifestSchema = z
  .object({
    schema_version: z.literal('neofab-cad-manifest/1'),
    artifacts: z
      .array(z.object({ path: cadArtifactPathSchema, ...artifactFields }).strict())
      .min(1)
      .max(cadRootArtifactNames.length + CAD_MAX_PARTS * 2),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const paths = new Set(manifest.artifacts.map((artifact) => artifact.path));
    if (paths.size !== manifest.artifacts.length)
      ctx.addIssue({
        code: 'custom',
        path: ['artifacts'],
        message: 'Artifact paths must be unique',
      });
    if (cadRootArtifactNames.some((name) => !paths.has(name)))
      ctx.addIssue({
        code: 'custom',
        path: ['artifacts'],
        message: 'Required CAD artifacts are missing',
      });
    if (
      manifest.artifacts.reduce((total, artifact) => total + artifact.size, 0) >
      128 * 1024 * 1024
    )
      ctx.addIssue({
        code: 'custom',
        path: ['artifacts'],
        message: 'CAD artifacts exceed 128 MiB',
      });
  });
export type CadManifest = z.infer<typeof cadManifestSchema>;

export type CadCapabilities = {
  configured: boolean;
  compilerVersion: string;
  limits: {
    maxBuildsPerProject: number;
    maxBuildsPerUserDay: number;
    maxBuildsPerInstanceDay: number;
    maxArtifactBytes: number;
  };
  reason?: string;
};
export type CadRevision = {
  id: string;
  number: number;
  project_version: number;
  spec: CadSpec;
  sha256: string;
  created_at: number;
};
export type CadBuild = {
  id: string;
  project_version: number;
  revision_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error_code: string | null;
  error_detail?: string | null;
  created_at: number;
  finished_at: number | null;
  report: CadReport | null;
  artifacts: CadArtifact[];
};
export type CadState = {
  capabilities: CadCapabilities;
  revision: CadRevision | null;
  builds: CadBuild[];
};

/** Explicit teaching examples; loading one never asserts the user's requirements. */
export const sampleCadSpecs: Readonly<Record<'plate' | 'shelf', CadSpec>> = {
  plate: {
    schema_version: CAD_SCHEMA_VERSION,
    name: 'Учебная пластина / Example plate',
    units: 'mm',
    material: 'Не выбран / Not selected',
    process: 'Не выбран / Not selected',
    description:
      'Учебная пластина 80 × 50 × 6 мм с двумя отверстиями Ø5 мм. Example dimensions only.',
    assumptions: [
      'Размеры примера не являются измерениями изделия. Нагрузки и технология не заданы.',
    ],
    missing_geometry: [],
    operations: [
      { id: 'base', type: 'box', mode: 'add', size: [80, 50, 6], at: [0, 0, 0] },
      {
        id: 'hole_1',
        type: 'cylinder',
        mode: 'cut',
        radius: 2.5,
        height: 8,
        axis: 'z',
        at: [15, 25, -1],
      },
      {
        id: 'hole_2',
        type: 'cylinder',
        mode: 'cut',
        radius: 2.5,
        height: 8,
        axis: 'z',
        at: [65, 25, -1],
      },
    ],
    components: [],
    requirements: { expected_solids: 1, bounds: [80, 50, 6], tolerance: 0.01 },
  },
  shelf: {
    schema_version: CAD_SCHEMA_VERSION,
    name: 'Учебная сборка из панелей / Example panel assembly',
    units: 'mm',
    material: 'По компонентам / By component',
    process: 'Сборка / Assembly',
    description:
      'Три отдельные панели: основание и две боковины. Учебная компоновка с условными размерами.',
    assumptions: [
      'Учебная сборка: нагрузки, устойчивость и производственные допуски не рассчитаны.',
    ],
    missing_geometry: ['Соединения панелей и отверстия для крепежа требуют проектирования.'],
    operations: [],
    components: [
      {
        id: 'base',
        name: 'Основание / Base',
        material: 'Фанера / Plywood',
        process: 'WOOD_CNC',
        quantity: 1,
        at: [0, 0, 0],
        rotation: [0, 0, 0],
        operations: [
          { id: 'panel', type: 'box', mode: 'add', size: [300, 180, 18], at: [0, 0, 0] },
        ],
      },
      {
        id: 'left',
        name: 'Левая боковина / Left side',
        material: 'Фанера / Plywood',
        process: 'WOOD_CNC',
        quantity: 1,
        at: [0, 0, 18],
        rotation: [0, 0, 0],
        operations: [
          { id: 'panel', type: 'box', mode: 'add', size: [18, 180, 240], at: [0, 0, 0] },
        ],
      },
      {
        id: 'right',
        name: 'Правая боковина / Right side',
        material: 'Фанера / Plywood',
        process: 'WOOD_CNC',
        quantity: 1,
        at: [282, 0, 18],
        rotation: [0, 0, 0],
        operations: [
          { id: 'panel', type: 'box', mode: 'add', size: [18, 180, 240], at: [0, 0, 0] },
        ],
      },
    ],
    requirements: { expected_solids: 3, bounds: [300, 180, 258], tolerance: 0.01 },
  },
};

export function sampleCadSpec(name: keyof typeof sampleCadSpecs): CadSpec {
  return structuredClone(sampleCadSpecs[name]);
}
