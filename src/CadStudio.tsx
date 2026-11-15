import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Box,
  CheckCircle2,
  Download,
  Layers3,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  cadSpecSchema,
  sampleCadSpec,
  type CadBuild,
  type CadComponent,
  type CadOperation,
  type CadReport,
  type CadSpec,
  type CadState,
} from '../shared/cad';
import type { StudioProject } from '../shared/studio';
import { api, post, ErrorBox, errorText, Loading, useApp, formatDate } from './core';
import './cad.css';

const Preview = lazy(() => import('./cad-preview'));
type Props = {
  project: StudioProject;
  blocked: boolean;
  onProjectChanged: (project: StudioProject) => void;
  onDirtyChange: (dirty: boolean) => void;
};
const clone = <T,>(value: T): T => structuredClone(value);
const asLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
const operationNames: Record<CadOperation['type'], [string, string]> = {
  box: ['Прямоугольный блок', 'Box'],
  cylinder: ['Цилиндр', 'Cylinder'],
  extrude: ['Выдавливание контура', 'Extrude a contour'],
  fillet: ['Скругление', 'Fillet'],
  chamfer: ['Фаска', 'Chamfer'],
};
function russianCheck(check: CadReport['checks'][number], report: CadReport) {
  const partName = (id: string) => report.components.find((part) => part.id === id)?.name ?? id;
  switch (check.code) {
    case 'component_solid': {
      const part = /^([A-Za-z][A-Za-z0-9_-]{0,39}): single valid solid$/.exec(check.name);
      const count = /^(\d+) solid\(s\)$/.exec(check.detail);
      return {
        name: part
          ? `${partName(part[1]!)}: одно корректное тело`
          : 'Одно корректное тело компонента',
        detail: count ? `Число тел: ${count[1]}` : check.detail,
      };
    }
    case 'brep':
      return {
        name: 'Корректность B-Rep',
        detail:
          check.detail === 'OpenCascade geometry check'
            ? 'Проверка геометрии OpenCascade'
            : check.detail,
      };
    case 'solid_count': {
      const count = /^(\d+) \/ (\d+)$/.exec(check.detail);
      return {
        name: 'Заявленное число тел',
        detail: count ? `Тел: ${count[1]}; ожидается: ${count[2]}` : check.detail,
      };
    }
    case 'missing_geometry':
      return {
        name: 'Заявленная недостающая геометрия',
        // A failed check contains the user's declarations; never translate or replace them.
        detail:
          check.passed &&
          check.detail === 'None declared; not an independent completeness assessment'
            ? 'Не заявлена; полнота модели независимо не проверялась.'
            : check.detail,
      };
    case 'bounds': {
      const bounds = /^(\[[^\]]+\]) mm; check tolerance ([\d.+eE-]+) mm$/.exec(check.detail);
      return {
        name: 'Заданные габариты',
        detail: bounds
          ? `Габариты: ${bounds[1]} мм; допуск проверки: ${bounds[2]} мм`
          : check.detail,
      };
    }
    case 'interference': {
      const parts =
        /^Interference ([A-Za-z][A-Za-z0-9_-]{0,39}) \/ ([A-Za-z][A-Za-z0-9_-]{0,39})$/.exec(
          check.name,
        );
      const volume = /^Common volume ([\d.+eE-]+) mm3$/.exec(check.detail);
      return {
        name: parts
          ? `Пересечение: ${partName(parts[1]!)} / ${partName(parts[2]!)}`
          : 'Пересечение компонентов',
        detail: volume ? `Общий объём: ${volume[1]} мм³` : check.detail,
      };
    }
  }
}
const standardWarnings = [
  [
    'Geometry checks do not authorize manufacture.',
    'Проверка геометрии не означает разрешения на изготовление.',
  ],
  [
    'Wall thickness, tool access, strength, fatigue, GD&T and process compensation are not checked.',
    'Толщина стенок, доступ инструмента, прочность, усталость, геометрические допуски (GD&T) и компенсации технологии не проверялись.',
  ],
  ['No CAM or machine code is generated.', 'CAM и управляющий код для станка не создаются.'],
] as const;
function russianWarning(warning: string, index: number) {
  // Only the worker's three fixed entries are translated. Later entries are user assumptions.
  const standard = standardWarnings[index];
  return standard?.[0] === warning ? standard[1] : warning;
}
function operation(type: CadOperation['type'], id: string): CadOperation {
  if (type === 'box') return { id, type, mode: 'add', size: [20, 20, 10], at: [0, 0, 0] };
  if (type === 'cylinder')
    return { id, type, mode: 'cut', radius: 3, height: 12, axis: 'z', at: [10, 10, -1] };
  if (type === 'extrude')
    return {
      id,
      type,
      mode: 'add',
      points: [
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20],
      ],
      plane: 'XY',
      distance: 10,
      at: [0, 0, 0],
    };
  if (type === 'fillet') return { id, type, radius: 1, selector: '|Z' };
  return { id, type, length: 1, selector: '|Z' };
}
function newId(prefix: string, ids: string[]) {
  let number = 1;
  while (ids.includes(prefix + number)) number++;
  return prefix + number;
}
function downloadJSON(spec: CadSpec) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'neofab-cad.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Preserve intermediate keyboard input, including an empty field or a leading minus. */
function CadNumber({
  value,
  onChange,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      {...props}
      type="number"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        if (event.target.value !== '' && Number.isFinite(Number(event.target.value)))
          onChange(event);
      }}
      onBlur={(event) => {
        if (text === '' || !Number.isFinite(Number(text))) setText(String(value));
        props.onBlur?.(event);
      }}
    />
  );
}
function Triple({
  label,
  value,
  onChange,
  positive = false,
}: {
  label: string;
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
  positive?: boolean;
}) {
  return (
    <fieldset className="cad-triple">
      <legend>{label}</legend>
      <div>
        {value.map((number, index) => (
          <label key={index}>
            {['X', 'Y', 'Z'][index]}
            <CadNumber
              aria-label={`${label} ${['X', 'Y', 'Z'][index]}`}
              value={number}
              min={positive ? 0.001 : -2000}
              max={2000}
              step="any"
              required
              onChange={(event) => {
                const next = [...value] as [number, number, number];
                next[index] = Number(event.target.value);
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function OperationEditor({
  value,
  index,
  count,
  onChange,
  remove,
  move,
}: {
  value: CadOperation;
  index: number;
  count: number;
  onChange: (value: CadOperation) => void;
  remove: () => void;
  move: (direction: number) => void;
}) {
  const { t } = useApp();
  return (
    <details className="cad-operation" open={index === 0}>
      <summary>
        <span>
          {String(index + 1).padStart(2, '0')} · {t(...operationNames[value.type])}
        </span>
        <code>{value.id}</code>
      </summary>
      <div className="cad-operation-body">
        <div className="form-grid">
          <label>
            {t('ID операции', 'Operation ID')}
            <input
              value={value.id}
              pattern="[A-Za-z][A-Za-z0-9_-]{0,39}"
              maxLength={40}
              onChange={(event) => onChange({ ...value, id: event.target.value })}
            />
          </label>
          {'mode' in value && (
            <label>
              {t('Действие с телом', 'Body operation')}
              <select
                value={value.mode}
                onChange={(event) =>
                  onChange({ ...value, mode: event.target.value as 'add' | 'cut' })
                }
              >
                <option value="add">{t('Добавить материал', 'Add material')}</option>
                <option value="cut">{t('Вычесть материал', 'Cut material')}</option>
              </select>
            </label>
          )}
        </div>
        {value.type === 'box' && (
          <Triple
            label={t('Размеры блока, мм', 'Box dimensions, mm')}
            value={value.size}
            positive
            onChange={(size) => onChange({ ...value, size })}
          />
        )}
        {(value.type === 'cylinder' || value.type === 'fillet') && (
          <label>
            {t('Радиус, мм', 'Radius, mm')}
            <CadNumber
              min="0.001"
              max="2000"
              step="any"
              value={value.radius}
              onChange={(event) => onChange({ ...value, radius: Number(event.target.value) })}
            />
          </label>
        )}
        {value.type === 'cylinder' && (
          <div className="form-grid">
            <label>
              {t('Длина цилиндра, мм', 'Cylinder length, mm')}
              <CadNumber
                min="0.001"
                max="2000"
                step="any"
                value={value.height}
                onChange={(event) => onChange({ ...value, height: Number(event.target.value) })}
              />
            </label>
            <label>
              {t('Ось цилиндра', 'Cylinder axis')}
              <select
                value={value.axis}
                onChange={(event) =>
                  onChange({ ...value, axis: event.target.value as 'x' | 'y' | 'z' })
                }
              >
                {['x', 'y', 'z'].map((axis) => (
                  <option key={axis}>{axis}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {value.type === 'extrude' && (
          <>
            <div className="form-grid">
              <label>
                {t('Плоскость контура', 'Contour plane')}
                <select
                  value={value.plane}
                  onChange={(event) =>
                    onChange({ ...value, plane: event.target.value as 'XY' | 'XZ' | 'YZ' })
                  }
                >
                  {['XY', 'XZ', 'YZ'].map((plane) => (
                    <option key={plane}>{plane}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('Длина выдавливания, мм', 'Extrusion distance, mm')}
                <CadNumber
                  min="0.001"
                  max="2000"
                  step="any"
                  value={value.distance}
                  onChange={(event) => onChange({ ...value, distance: Number(event.target.value) })}
                />
              </label>
            </div>
            <fieldset className="cad-points">
              <legend>{t('Вершины замкнутого контура, мм', 'Closed contour vertices, mm')}</legend>
              {value.points.map((point, row) => (
                <div key={row}>
                  <span>{row + 1}</span>
                  {point.map((coordinate, axis) => (
                    <input
                      key={axis}
                      type="number"
                      step="any"
                      min="-2000"
                      max="2000"
                      value={coordinate}
                      aria-label={`${t('Вершина', 'Vertex')} ${row + 1} ${['U', 'V'][axis]}`}
                      onChange={(event) => {
                        const points = clone(value.points);
                        points[row]![axis] = Number(event.target.value);
                        onChange({ ...value, points });
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${t('Удалить вершину', 'Remove vertex')} ${row + 1}`}
                    disabled={value.points.length <= 3}
                    onClick={() =>
                      onChange({ ...value, points: value.points.filter((_, i) => i !== row) })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-button"
                disabled={value.points.length >= 100}
                onClick={() => onChange({ ...value, points: [...value.points, [0, 0]] })}
              >
                <Plus size={15} />
                {t('Добавить вершину', 'Add vertex')}
              </button>
            </fieldset>
          </>
        )}
        {value.type === 'chamfer' && (
          <label>
            {t('Размер фаски, мм', 'Chamfer length, mm')}
            <CadNumber
              min="0.001"
              max="2000"
              step="any"
              value={value.length}
              onChange={(event) => onChange({ ...value, length: Number(event.target.value) })}
            />
          </label>
        )}
        {'selector' in value && (
          <label>
            {t('Выбор рёбер', 'Edge selector')}
            <select
              value={value.selector}
              onChange={(event) =>
                onChange({ ...value, selector: event.target.value as typeof value.selector })
              }
            >
              {['|X', '|Y', '|Z', '>Z', '<Z', 'all'].map((selector) => (
                <option key={selector} value={selector}>
                  {selector === 'all' ? t('Все рёбра', 'All edges') : selector}
                </option>
              ))}
            </select>
          </label>
        )}
        {'at' in value && (
          <Triple
            label={t('Начало операции, мм', 'Operation origin, mm')}
            value={value.at}
            onChange={(at) => onChange({ ...value, at })}
          />
        )}
        <div className="cad-operation-actions">
          <button
            type="button"
            className="text-button"
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            <ArrowUp size={15} />
            {t('Выше', 'Up')}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={index === count - 1}
            onClick={() => move(1)}
          >
            <ArrowDown size={15} />
            {t('Ниже', 'Down')}
          </button>
          <button type="button" className="text-button cad-remove" onClick={remove}>
            <Trash2 size={15} />
            {t('Удалить операцию', 'Remove operation')}
          </button>
        </div>
      </div>
    </details>
  );
}

export default function CadStudio({ project, blocked, onProjectChanged, onDirtyChange }: Props) {
  const { t, lang, toast } = useApp();
  const [state, setState] = useState<CadState | null>(null);
  const [spec, setSpec] = useState<CadSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedPart, setSelectedPart] = useState('body');
  const [sample, setSample] = useState<'plate' | 'shelf'>('plate');
  const [operationType, setOperationType] = useState<CadOperation['type']>('box');
  const [raw, setRaw] = useState('');
  const [rawDirty, setRawDirty] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState('');
  const [detachConsent, setDetachConsent] = useState(false);
  const actionLock = useRef(false);
  const initialized = useRef(false);
  const request = useRef<{ version: number; id: string } | null>(null);
  const projectChanged = useRef(onProjectChanged);
  projectChanged.current = onProjectChanged;
  const dirty = rawDirty || JSON.stringify(spec) !== JSON.stringify(state?.revision?.spec ?? null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const path = `/studio/projects/${project.id}/cad`;
  const editable = !project.job_id && !busy && !blocked;
  const needsTemplateRemoval = !!project.brief.part;
  const locked = !editable;
  const syncSpec = (next: CadSpec | null) => {
    setSpec(next);
    setRaw(next ? JSON.stringify(next, null, 2) : '');
    setRawDirty(false);
  };
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    api<CadState>(path, { signal: controller.signal })
      .then((next) => {
        setState(next);
        if (!initialized.current || !dirtyRef.current) {
          syncSpec(next.revision?.spec ?? null);
          initialized.current = true;
        }
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(errorText(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, project.version]);
  const pending =
    state?.builds.some((build) => build.status === 'queued' || build.status === 'running') ?? false;
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api<CadState>(path, { signal: controller.signal });
        if (!active) return;
        const running = next.builds.some(
          (build) => build.status === 'queued' || build.status === 'running',
        );
        if (!running) {
          const updated = await api<{ project: StudioProject }>(`/studio/projects/${project.id}`, {
            signal: controller.signal,
          });
          if (active) projectChanged.current(updated.project);
        }
        if (active) setState(next);
        if (active && running) timer = setTimeout(() => void poll(), 2000);
      } catch (reason) {
        if (active && reason instanceof Error && reason.name !== 'AbortError') {
          setError(errorText(reason));
          timer = setTimeout(() => void poll(), 5000);
        }
      }
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, pending, project.id]);
  async function run(name: string, action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(name);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      actionLock.current = false;
      setBusy('');
    }
  }
  function updateSpec(next: CadSpec) {
    syncSpec(next);
    setDetachConsent(false);
  }
  function validate(input: unknown) {
    const parsed = cadSpecSchema.safeParse(input);
    if (!parsed.success)
      throw new Error(
        t('Проверьте модель: ', 'Check the model: ') +
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(' · '),
      );
    return parsed.data;
  }
  async function save() {
    await run('save', async () => {
      const valid = validate(spec);
      const result = await post<{ project: StudioProject; cad: CadState }>(
        path,
        { version: project.version, spec: valid },
        'PUT',
      );
      setState(result.cad);
      syncSpec(result.cad.revision?.spec ?? null);
      projectChanged.current(result.project);
      request.current = null;
      toast(
        t(
          'Модель CAD сохранена. Постройте новую версию геометрии.',
          'CAD model saved. Build this geometry revision.',
        ),
      );
    });
  }
  async function build() {
    if (!request.current || request.current.version !== project.version)
      request.current = { version: project.version, id: crypto.randomUUID() };
    await run('build', async () => {
      const result = await post<{ build: CadBuild }>(path + '/build', {
        version: project.version,
        requestId: request.current!.id,
      });
      setState((current) =>
        current
          ? {
              ...current,
              builds: [
                result.build,
                ...current.builds.filter((build) => build.id !== result.build.id),
              ].slice(0, 20),
            }
          : current,
      );
      setSelectedBuild(result.build.id);
      if (result.build.status === 'succeeded') {
        const updated = await api<{ project: StudioProject }>(`/studio/projects/${project.id}`);
        projectChanged.current(updated.project);
      }
    });
  }
  const selected = spec?.components.find((component) => component.id === selectedPart);
  const operations = selected?.operations ?? spec?.operations ?? [];
  function setOperations(next: CadOperation[]) {
    if (!spec) return;
    updateSpec(
      selected
        ? {
            ...spec,
            components: spec.components.map((component) =>
              component.id === selected.id ? { ...component, operations: next } : component,
            ),
          }
        : { ...spec, operations: next },
    );
  }
  function setComponent(next: CadComponent) {
    if (!spec || !selected) return;
    updateSpec({
      ...spec,
      components: spec.components.map((component) =>
        component.id === selected.id ? next : component,
      ),
    });
  }
  const activeBuild = state?.builds.find((build) => build.id === selectedBuild) ?? state?.builds[0];
  const buildLabel = (build: CadBuild) =>
    `${t('ТЗ v', 'Brief v')}${build.project_version} · ${t(...({ queued: ['В очереди', 'Queued'], running: ['Построение', 'Building'], succeeded: ['Построено', 'Built'], failed: ['Ошибка', 'Failed'] } satisfies Record<CadBuild['status'], [string, string]>)[build.status])} · ${formatDate(build.created_at, lang)}`;
  const artifactURL = (build: CadBuild, name: string) =>
    `/api${path}/builds/${build.id}/artifacts/${encodeURIComponent(name)}`;
  const canBuild =
    editable &&
    !dirty &&
    !needsTemplateRemoval &&
    !!state?.revision &&
    state.capabilities.configured &&
    !pending;
  return (
    <section
      className="panel studio-section cad-studio"
      id="studio-cad"
      aria-labelledby="cad-heading"
    >
      <div className="studio-section-heading">
        <span className="studio-section-icon">
          <Layers3 size={20} />
        </span>
        <div>
          <h2 id="cad-heading">{t('Модель и сборка CAD', 'CAD model & assembly')}</h2>
          <p>
            {t(
              'Размеры, отдельные компоненты и проверяемая геометрия. Все размеры в миллиметрах.',
              'Dimensions, separate components and checkable geometry. All dimensions are in millimetres.',
            )}
          </p>
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <ErrorBox error={error} />
          {!state ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              {t('Повторить загрузку', 'Reload')}
            </button>
          ) : (
            <>
              {!state.capabilities.configured && (
                <div className="info-box">
                  <strong>
                    {t(
                      'Редактор доступен. Геометрический сервис не подключён.',
                      'The editor is available. The geometry service is not connected.',
                    )}
                  </strong>
                  <p>
                    {t(
                      'Можно сохранить спецификацию и выгрузить JSON. Для STEP, STL и 3D-просмотра администратор должен подключить CAD worker по инструкции Neofab Setup.',
                      'Save the specification and export JSON. For STEP, STL and 3D preview, the administrator needs to connect the CAD worker using Neofab Setup.',
                    )}
                  </p>
                </div>
              )}
              {blocked && (
                <p className="studio-action-note">
                  {t(
                    'Сохраните изменения ТЗ перед действиями с CAD.',
                    'Save brief changes before CAD actions.',
                  )}
                </p>
              )}
              {needsTemplateRemoval && (
                <p className="studio-action-note">
                  {t(
                    'В ТЗ выбран простой шаблон. Выберите «Без шаблона» в разделе модели и сохраните ТЗ, чтобы прикрепить CAD-сборку.',
                    'The brief uses a simple template. Select “No template” in the model section and save the brief to attach a CAD assembly.',
                  )}
                </p>
              )}
              {!project.job_id && (
                <div className="cad-example-row">
                  <label>
                    {t('Учебный пример', 'Teaching example')}
                    <select
                      value={sample}
                      disabled={locked}
                      onChange={(event) => setSample(event.target.value as 'plate' | 'shelf')}
                    >
                      <option value="plate">
                        {t('Пластина с отверстиями', 'Plate with holes')}
                      </option>
                      <option value="shelf">
                        {t('Сборка из трёх панелей', 'Three-panel assembly')}
                      </option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={locked}
                    onClick={() => {
                      updateSpec(sampleCadSpec(sample));
                      setSelectedPart(sample === 'shelf' ? 'base' : 'body');
                    }}
                  >
                    {spec
                      ? t('Заменить черновик примером', 'Replace draft with example')
                      : t('Загрузить пример', 'Load example')}
                  </button>
                </div>
              )}
              {!spec && (
                <p className="studio-help">
                  {t(
                    'CAD необязателен: можно отправить ТЗ инженеру без модели. Примеры содержат условные размеры; применяйте их только после проверки своей задачи.',
                    'CAD is optional: send the brief to an engineer without a model. Examples contain illustrative dimensions; review them against your own requirements.',
                  )}
                </p>
              )}
              {spec && (
                <>
                  <div
                    className="cad-part-list"
                    role="group"
                    aria-label={t('Компоненты модели', 'Model components')}
                  >
                    <button
                      type="button"
                      className={selectedPart === 'body' ? 'active' : ''}
                      aria-pressed={selectedPart === 'body'}
                      onClick={() => setSelectedPart('body')}
                    >
                      <Box size={15} />
                      {t('Изделие', 'Product')}
                      {spec.operations.length ? ` · ${spec.operations.length}` : ''}
                    </button>
                    {spec.components.map((component) => (
                      <button
                        type="button"
                        key={component.id}
                        className={selectedPart === component.id ? 'active' : ''}
                        aria-pressed={selectedPart === component.id}
                        onClick={() => setSelectedPart(component.id)}
                      >
                        <Box size={15} />
                        {component.name}
                      </button>
                    ))}
                  </div>
                  <fieldset disabled={locked} className="cad-fields">
                    <div className="form-grid">
                      <label>
                        {t('Название CAD-модели', 'CAD model name')}
                        <input
                          value={spec.name}
                          maxLength={120}
                          onChange={(event) => updateSpec({ ...spec, name: event.target.value })}
                        />
                      </label>
                      <label>
                        {t('Описание CAD-модели', 'CAD model description')}
                        <textarea
                          value={spec.description}
                          rows={2}
                          maxLength={4000}
                          onChange={(event) =>
                            updateSpec({ ...spec, description: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    {!project.job_id && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={spec.components.length + (spec.operations.length ? 1 : 0) >= 24}
                        onClick={() => {
                          const id = newId('part', [
                            'body',
                            ...spec.components.map((component) => component.id),
                          ]);
                          const component: CadComponent = {
                            id,
                            name: t('Новый компонент', 'New component'),
                            material: '',
                            process: '',
                            quantity: 1,
                            at: [0, 0, 0],
                            rotation: [0, 0, 0],
                            operations: [operation('box', 'base')],
                          };
                          updateSpec({
                            ...spec,
                            components: [...spec.components, component],
                            requirements: {
                              ...spec.requirements,
                              expected_solids: Math.min(24, spec.requirements.expected_solids + 1),
                            },
                          });
                          setSelectedPart(id);
                        }}
                      >
                        <Plus size={15} />
                        {t('Добавить компонент', 'Add component')}
                      </button>
                    )}
                    <div className="cad-part-editor">
                      <div className="cad-part-heading">
                        <h3>
                          {selected
                            ? selected.name
                            : t('Общие свойства и основное тело', 'Product properties & main body')}
                        </h3>
                        {selected && (
                          <button
                            type="button"
                            className="text-button cad-remove"
                            onClick={() => {
                              updateSpec({
                                ...spec,
                                components: spec.components.filter(
                                  (component) => component.id !== selected.id,
                                ),
                                requirements: {
                                  ...spec.requirements,
                                  expected_solids: Math.max(
                                    1,
                                    spec.requirements.expected_solids - 1,
                                  ),
                                },
                              });
                              setSelectedPart('body');
                            }}
                          >
                            <Trash2 size={15} />
                            {t('Удалить компонент', 'Remove component')}
                          </button>
                        )}
                      </div>
                      {selected && (
                        <label>
                          {t('Название компонента', 'Component name')}
                          <input
                            value={selected.name}
                            maxLength={120}
                            onChange={(event) =>
                              setComponent({ ...selected, name: event.target.value })
                            }
                          />
                        </label>
                      )}
                      <div className="form-grid">
                        <label>
                          {t('Материал CAD', 'CAD material')}
                          <input
                            value={selected?.material ?? spec.material}
                            maxLength={160}
                            onChange={(event) =>
                              selected
                                ? setComponent({ ...selected, material: event.target.value })
                                : updateSpec({ ...spec, material: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          {t('Технология CAD', 'CAD process')}
                          <input
                            value={selected?.process ?? spec.process}
                            maxLength={160}
                            onChange={(event) =>
                              selected
                                ? setComponent({ ...selected, process: event.target.value })
                                : updateSpec({ ...spec, process: event.target.value })
                            }
                          />
                        </label>
                      </div>
                      {selected && (
                        <>
                          <Triple
                            label={t('Положение компонента, мм', 'Component position, mm')}
                            value={selected.at}
                            onChange={(at) => setComponent({ ...selected, at })}
                          />
                          <Triple
                            label={t('Поворот компонента, °', 'Component rotation, °')}
                            value={selected.rotation}
                            onChange={(rotation) => setComponent({ ...selected, rotation })}
                          />
                        </>
                      )}
                      <p className="studio-help">
                        {t(
                          'Операции выполняются сверху вниз. Блок строится от начальной точки, цилиндр — от центра основания вдоль выбранной оси. Каждый компонент описывает одну физическую деталь.',
                          'Operations run from top to bottom. A box starts at its origin; a cylinder starts at its base centre along the chosen axis. Each component represents one physical part.',
                        )}
                      </p>
                      {operations.map((item, index) => (
                        <OperationEditor
                          key={index}
                          value={item}
                          index={index}
                          count={operations.length}
                          onChange={(next) =>
                            setOperations(
                              operations.map((value, i) => (i === index ? next : value)),
                            )
                          }
                          remove={() => setOperations(operations.filter((_, i) => i !== index))}
                          move={(direction) => {
                            const next = [...operations];
                            [next[index], next[index + direction]] = [
                              next[index + direction]!,
                              next[index]!,
                            ];
                            setOperations(next);
                          }}
                        />
                      ))}
                      {!operations.length && (
                        <p className="studio-help">
                          {t(
                            'Здесь нет геометрии. Для сборки можно оставить только отдельные компоненты.',
                            'No geometry here. An assembly can consist only of separate components.',
                          )}
                        </p>
                      )}
                      <div className="cad-add-operation">
                        <label>
                          {t('Новая операция', 'New operation')}
                          <select
                            value={operationType}
                            onChange={(event) =>
                              setOperationType(event.target.value as CadOperation['type'])
                            }
                          >
                            {Object.entries(operationNames).map(([key, label]) => (
                              <option key={key} value={key}>
                                {t(...label)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={operations.length >= 60}
                          onClick={() =>
                            setOperations([
                              ...operations,
                              operation(
                                operationType,
                                newId(
                                  'op',
                                  operations.map((item) => item.id),
                                ),
                              ),
                            ])
                          }
                        >
                          <Plus size={15} />
                          {t('Добавить операцию', 'Add operation')}
                        </button>
                      </div>
                    </div>
                    <details className="cad-requirements">
                      <summary>
                        {t(
                          'Проверки геометрии и открытые вопросы',
                          'Geometry checks & open questions',
                        )}
                      </summary>
                      <div>
                        <div className="form-grid">
                          <label>
                            {t('Ожидаемое число тел', 'Expected solid count')}
                            <CadNumber
                              min={1}
                              max={24}
                              step={1}
                              value={spec.requirements.expected_solids}
                              onChange={(event) =>
                                updateSpec({
                                  ...spec,
                                  requirements: {
                                    ...spec.requirements,
                                    expected_solids: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            {t('Допуск проверки габаритов, мм', 'Bounds check tolerance, mm')}
                            <CadNumber
                              min="0.001"
                              max={10}
                              step="any"
                              value={spec.requirements.tolerance}
                              onChange={(event) =>
                                updateSpec({
                                  ...spec,
                                  requirements: {
                                    ...spec.requirements,
                                    tolerance: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={!!spec.requirements.bounds}
                            onChange={(event) =>
                              updateSpec({
                                ...spec,
                                requirements: {
                                  ...spec.requirements,
                                  bounds: event.target.checked ? [100, 100, 100] : null,
                                },
                              })
                            }
                          />
                          <span>{t('Проверить заданные габариты', 'Check specified bounds')}</span>
                        </label>
                        {spec.requirements.bounds && (
                          <Triple
                            positive
                            label={t('Ожидаемые габариты, мм', 'Expected bounds, mm')}
                            value={spec.requirements.bounds}
                            onChange={(bounds) =>
                              updateSpec({
                                ...spec,
                                requirements: { ...spec.requirements, bounds },
                              })
                            }
                          />
                        )}
                        <label>
                          {t('Допущения CAD, по одному на строку', 'CAD assumptions, one per line')}
                          <textarea
                            rows={3}
                            value={spec.assumptions.join('\n')}
                            onBlur={() =>
                              updateSpec({
                                ...spec,
                                assumptions: asLines(spec.assumptions.join('\n')),
                              })
                            }
                            onChange={(event) =>
                              updateSpec({
                                ...spec,
                                assumptions: event.target.value
                                  ? event.target.value.split('\n')
                                  : [],
                              })
                            }
                          />
                        </label>
                        <label>
                          {t(
                            'Недостающая геометрия, по одному на строку',
                            'Missing geometry, one per line',
                          )}
                          <textarea
                            rows={3}
                            value={spec.missing_geometry.join('\n')}
                            onBlur={() =>
                              updateSpec({
                                ...spec,
                                missing_geometry: asLines(spec.missing_geometry.join('\n')),
                              })
                            }
                            onChange={(event) =>
                              updateSpec({
                                ...spec,
                                missing_geometry: event.target.value
                                  ? event.target.value.split('\n')
                                  : [],
                              })
                            }
                          />
                        </label>
                      </div>
                    </details>
                  </fieldset>
                  <details className="cad-json">
                    <summary>
                      {t(
                        'Спецификация JSON: импорт и экспорт',
                        'JSON specification: import & export',
                      )}
                    </summary>
                    <div>
                      <p className="studio-help">
                        {t(
                          'Импорт меняет локальный черновик. Проверьте его и сохраните отдельно. Формат принимает параметры геометрии, а не исполняемый код.',
                          'Import changes the local draft. Review it and save separately. The format accepts geometry parameters, not executable code.',
                        )}
                      </p>
                      <label>
                        {t('JSON модели', 'Model JSON')}
                        <textarea
                          className="cad-json-input"
                          maxLength={262144}
                          value={raw}
                          rows={12}
                          spellCheck={false}
                          disabled={locked}
                          onChange={(event) => {
                            setRaw(event.target.value);
                            setRawDirty(true);
                          }}
                        />
                      </label>
                      <div className="cad-actions">
                        <button
                          type="button"
                          className="button secondary"
                          disabled={locked || !rawDirty}
                          onClick={() => {
                            try {
                              updateSpec(validate(JSON.parse(raw)));
                              setSelectedPart('body');
                              setError('');
                            } catch (reason) {
                              setError(errorText(reason));
                            }
                          }}
                        >
                          {t('Применить JSON', 'Apply JSON')}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => downloadJSON(spec)}
                        >
                          <Download size={15} />
                          {t('Скачать черновик JSON', 'Download draft JSON')}
                        </button>
                      </div>
                    </div>
                  </details>
                  {!project.job_id && (
                    <div className="cad-save-row">
                      <div>
                        <strong>
                          {dirty
                            ? t('CAD: есть несохранённые изменения', 'CAD: unsaved changes')
                            : t('CAD: изменения сохранены', 'CAD: changes saved')}
                        </strong>
                        <p className="studio-help">
                          {t(
                            'Сохранение модели создаёт версию проекта и снимает прежнее подтверждение ТЗ.',
                            'Saving a model creates a project revision and clears the previous brief confirmation.',
                          )}
                        </p>
                      </div>
                      <div className="cad-actions">
                        <button
                          type="button"
                          className="button secondary"
                          disabled={!dirty || locked}
                          onClick={() => {
                            syncSpec(clone(state.revision?.spec ?? null));
                            setSelectedPart('body');
                            setError('');
                          }}
                        >
                          <RotateCcw size={15} />
                          {t('Отменить правки CAD', 'Discard CAD edits')}
                        </button>
                        <button
                          type="button"
                          className="button"
                          disabled={!dirty || rawDirty || locked || needsTemplateRemoval}
                          onClick={() => void save()}
                        >
                          {busy === 'save' ? (
                            <LoaderCircle size={16} className="studio-spin" />
                          ) : (
                            <Save size={16} />
                          )}
                          {t('Сохранить CAD', 'Save CAD')}
                        </button>
                      </div>
                    </div>
                  )}
                  {rawDirty && (
                    <p className="studio-action-note">
                      {t(
                        'Примените JSON или отмените правки CAD перед сохранением.',
                        'Apply the JSON or discard CAD edits before saving.',
                      )}
                    </p>
                  )}
                </>
              )}
              {!project.job_id && (
                <label className="cad-import">
                  <Upload size={16} />
                  <span>{t('Импортировать JSON модели', 'Import model JSON')}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={locked}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      try {
                        if (file.size > 256 * 1024)
                          throw new Error(
                            t(
                              'Размер JSON не должен превышать 256 КБ.',
                              'JSON must be no larger than 256 KB.',
                            ),
                          );
                        updateSpec(validate(JSON.parse(await file.text())));
                        setSelectedPart('body');
                        setError('');
                      } catch (reason) {
                        setError(errorText(reason));
                      }
                    }}
                  />
                </label>
              )}
              {(state.revision || state.builds.length > 0) && (
                <div className="cad-build-area">
                  <div className="cad-build-heading">
                    <div>
                      <h3>{t('Геометрия и файлы', 'Geometry & files')}</h3>
                      <p className="studio-help">
                        {state.revision
                          ? `${t('Модель CAD v', 'CAD model v')}${state.revision.number}`
                          : t(
                              'CAD откреплён; доступна история',
                              'CAD detached; history is available',
                            )}{' '}
                        · {t('Текущая версия проекта ', 'Current project revision ')}
                        {project.version}
                      </p>
                    </div>
                    {!project.job_id && (
                      <button
                        type="button"
                        className="button"
                        disabled={!canBuild}
                        onClick={() => void build()}
                      >
                        {pending || busy === 'build' ? (
                          <LoaderCircle size={16} className="studio-spin" />
                        ) : (
                          <Play size={16} />
                        )}
                        {pending
                          ? t('Строим геометрию…', 'Building geometry…')
                          : t('Построить CAD', 'Build CAD')}
                      </button>
                    )}
                  </div>
                  <p className="studio-help">
                    {t(
                      'Построение выполняется геометрическим ядром. Обращение к ИИ не требуется.',
                      'A geometry kernel builds the model. No AI call is needed.',
                    )}
                  </p>
                  {!!state.builds.length && (
                    <label>
                      {t('История построений', 'Build history')}
                      <select
                        value={activeBuild?.id ?? ''}
                        onChange={(event) => setSelectedBuild(event.target.value)}
                      >
                        {state.builds.map((build) => (
                          <option key={build.id} value={build.id}>
                            {buildLabel(build)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {activeBuild && (
                    <div className="cad-build-result" aria-live="polite">
                      <p className="cad-result-status">
                        <strong>{buildLabel(activeBuild)}</strong>
                        {activeBuild.project_version !== project.version && (
                          <span className="cad-old-revision">
                            {t(
                              'Предыдущая версия: не соответствует текущему ТЗ',
                              'Previous revision: does not match the current brief',
                            )}
                          </span>
                        )}
                      </p>
                      {activeBuild.status === 'failed' && (
                        <div className="error-box">
                          <XCircle size={18} />
                          <span>
                            {activeBuild.error_code === 'CAD_CANCELLED'
                              ? t('Построение отменено.', 'Build cancelled.')
                              : t(
                                  'Геометрия не построена. Проверьте размеры, порядок операций и пересечения.',
                                  'Geometry could not be built. Check dimensions, operation order and intersections.',
                                )}{' '}
                            {activeBuild.error_code && <code>{activeBuild.error_code}</code>}
                            {activeBuild.error_detail && (
                              <p className="cad-error-detail">{activeBuild.error_detail}</p>
                            )}
                          </span>
                        </div>
                      )}
                      {activeBuild.status === 'failed' && !project.job_id && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={!canBuild}
                          onClick={() => {
                            request.current = null;
                            void build();
                          }}
                        >
                          {t('Повторить построение', 'Retry build')}
                        </button>
                      )}
                      {(activeBuild.status === 'queued' || activeBuild.status === 'running') && (
                        <div className="cad-pending">
                          <p>
                            {t(
                              'Можно продолжить редактирование. Результат останется привязан к этой версии проекта.',
                              'You can keep editing. The result stays linked to this project revision.',
                            )}
                          </p>
                          {!project.job_id && (
                            <button
                              type="button"
                              className="text-button"
                              disabled={!!busy}
                              onClick={() =>
                                void run('cancel', async () => {
                                  const result = await post<{ build: CadBuild }>(
                                    `${path}/builds/${activeBuild.id}/cancel`,
                                    {},
                                  );
                                  setState((current) =>
                                    current
                                      ? {
                                          ...current,
                                          builds: current.builds.map((build) =>
                                            build.id === result.build.id ? result.build : build,
                                          ),
                                        }
                                      : current,
                                  );
                                  request.current = null;
                                })
                              }
                            >
                              {t('Отменить построение', 'Cancel build')}
                            </button>
                          )}
                        </div>
                      )}
                      {activeBuild.status === 'succeeded' && (
                        <>
                          {activeBuild.artifacts.some(
                            (artifact) => artifact.name === 'mesh.json',
                          ) && (
                            <Suspense fallback={<Loading />}>
                              <Preview url={artifactURL(activeBuild, 'mesh.json')} />
                            </Suspense>
                          )}
                          {activeBuild.report && (
                            <div className="cad-report">
                              <h4>{t('Проверка геометрии', 'Geometry checks')}</h4>
                              <p>
                                {t('Габариты, мм: ', 'Bounds, mm: ')}
                                <strong>{activeBuild.report.bounds_mm.join(' × ')}</strong> ·{' '}
                                {t('Тел: ', 'Solids: ')}
                                {activeBuild.report.solids}
                              </p>
                              <ul>
                                {activeBuild.report.checks.map((check, index) => {
                                  const label =
                                    lang === 'ru'
                                      ? russianCheck(check, activeBuild.report!)
                                      : check;
                                  return (
                                    <li
                                      key={index}
                                      className={check.passed ? 'passed' : 'attention'}
                                    >
                                      {check.passed ? (
                                        <CheckCircle2 size={16} />
                                      ) : (
                                        <XCircle size={16} />
                                      )}
                                      <div>
                                        <strong>{label.name}</strong>
                                        <p>{label.detail}</p>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                              {activeBuild.report.warnings.map((warning, index) => (
                                <p className="studio-action-note" key={index}>
                                  {lang === 'ru' ? russianWarning(warning, index) : warning}
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="studio-action-note">
                            {t(
                              'Отчёт проверяет геометрию. Прочность, посадки, технологичность и траектории станка требуют отдельного согласования с исполнителем. Это версия для обсуждения и расчёта заказа.',
                              'The report checks geometry. Strength, fits, manufacturability and machine paths need separate review with the maker. This revision is for discussion and quotation.',
                            )}
                          </p>
                          <div className="cad-downloads">
                            {activeBuild.artifacts
                              .filter((artifact) => artifact.name !== 'mesh.json')
                              .map((artifact) => (
                                <a
                                  className="button secondary"
                                  key={artifact.name}
                                  href={artifactURL(activeBuild, artifact.name)}
                                  download
                                >
                                  <Download size={15} />
                                  <span>
                                    {artifact.name}
                                    <small>
                                      {(artifact.size / 1024).toFixed(1)} KB ·{' '}
                                      {t('ТЗ v', 'Brief v')}
                                      {activeBuild.project_version}
                                    </small>
                                  </span>
                                </a>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              {state.revision && !project.job_id && (
                <details className="cad-detach">
                  <summary>{t('Открепить CAD от проекта', 'Detach CAD from this project')}</summary>
                  <p className="studio-help">
                    {t(
                      'История сохранится. Текущая версия ТЗ останется без CAD; подтверждение нужно будет выполнить заново.',
                      'History is retained. The current brief will have no CAD attached and needs confirmation again.',
                    )}
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={detachConsent}
                      disabled={locked || dirty}
                      onChange={(event) => setDetachConsent(event.target.checked)}
                    />
                    <span>
                      {t(
                        'Подтверждаю открепление текущей модели',
                        'I confirm detaching the current model',
                      )}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={!detachConsent || locked || dirty}
                    onClick={() =>
                      void run('detach', async () => {
                        const result = await post<{ project: StudioProject; cad: CadState }>(
                          path,
                          { version: project.version },
                          'DELETE',
                        );
                        setState(result.cad);
                        syncSpec(null);
                        setDetachConsent(false);
                        projectChanged.current(result.project);
                      })
                    }
                  >
                    <Trash2 size={15} />
                    {t('Открепить CAD', 'Detach CAD')}
                  </button>
                </details>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
