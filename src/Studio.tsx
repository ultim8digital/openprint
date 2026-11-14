import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Layers3,
  ListChecks,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { api, post, useApp, useRemote, ErrorBox, Loading, errorText, formatDate } from './core';
import { PageTitle } from './Browse';
import { currencies, type Currency } from '../shared/types';
import {
  manufacturingProcesses,
  studioBriefSchema,
  type StudioBrief,
  type StudioCapabilities,
  type StudioMatch,
  type StudioProject,
  type StudioUsage,
} from '../shared/studio';
import './studio.css';

const PartPreview = lazy(() => import('./studio-preview'));
type Detail = { project: StudioProject; usage: StudioUsage; matches: StudioMatch[] };
type LineField = 'requirements' | 'questions' | 'assumptions' | 'operations' | 'acceptance';
type Draft = Omit<StudioBrief, LineField> & Record<LineField, string>;
const toDraft = (brief: StudioBrief): Draft => ({
  ...brief,
  requirements: brief.requirements.join('\n'),
  questions: brief.questions.join('\n'),
  assumptions: brief.assumptions.join('\n'),
  operations: brief.operations.join('\n'),
  acceptance: brief.acceptance.join('\n'),
});
const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
const fromDraft = (draft: Draft): StudioBrief => ({
  ...draft,
  requirements: lines(draft.requirements),
  questions: lines(draft.questions),
  assumptions: lines(draft.assumptions),
  operations: lines(draft.operations),
  acceptance: lines(draft.acceptance),
});
const emptyPart = { kind: 'plate' as const, width: 70, depth: 45, height: 5, hole: 10 };
const processNames: Record<string, [string, string]> = {
  FDM: ['3D-печать FDM', 'FDM 3D printing'],
  SLA: ['Фотополимерная печать SLA', 'SLA resin printing'],
  SLS: ['Порошковая печать SLS', 'SLS powder printing'],
  MJF: ['Порошковая печать MJF', 'MJF powder printing'],
  DMLS: ['3D-печать металлом', 'Metal 3D printing'],
  LASER: ['Лазерная резка', 'Laser cutting'],
  CNC: ['Фрезерование с ЧПУ', 'CNC milling'],
  CNC_TURNING: ['Токарная обработка с ЧПУ', 'CNC turning'],
  WOOD_CNC: ['ЧПУ по дереву', 'Wood CNC'],
  WATERJET: ['Гидроабразивная резка', 'Waterjet cutting'],
  PLASMA: ['Плазменная резка', 'Plasma cutting'],
  SHEET_METAL: ['Листовой металл и гибка', 'Sheet metal & bending'],
  MIXED: ['Несколько технологий', 'Multiple processes'],
  UNSURE: ['Нужен выбор технологии', 'Help choosing a process'],
};
function ProcessOptions() {
  const { t } = useApp();
  return manufacturingProcesses.map((process) => (
    <option key={process} value={process}>
      {t(...processNames[process])}
    </option>
  ));
}

export default function Studio() {
  const { id } = useParams();
  const capabilities = useRemote<StudioCapabilities>('/studio/capabilities');
  return id ? (
    <StudioEditor key={id} id={id} capabilities={capabilities.data} />
  ) : (
    <StudioStart capabilities={capabilities.data} />
  );
}
function StudioStart({ capabilities }: { capabilities: StudioCapabilities | null }) {
  const { t, lang } = useApp(),
    navigate = useNavigate();
  const [offset, setOffset] = useState(0),
    [savedProjects, setSavedProjects] = useState<StudioProject[]>([]);
  const projects = useRemote<{ projects: StudioProject[]; has_more: boolean }>(
    '/studio/projects?limit=20&offset=' + offset,
  );
  useEffect(() => {
    if (!projects.data) return;
    setSavedProjects((current) => {
      const combined =
        offset === 0 ? projects.data!.projects : [...current, ...projects.data!.projects];
      return [...new Map(combined.map((project) => [project.id, project])).values()];
    });
  }, [projects.data, offset]);
  const [idea, setIdea] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submitting = useRef(false);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await post<Detail>('/studio/projects', { idea, language: lang });
      navigate('/studio/' + result.project.id);
    } catch (error) {
      setError(errorText(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="page studio-page">
      <PageTitle
        eyebrow="NEOFAB STUDIO"
        title={t(
          'Сначала ваша задача. Затем — производство.',
          'Your idea. A clear path to making it.',
        )}
        description={t(
          'От крепления на замену до серии деталей, мебели или сложного изделия. Соберите требования, состав изделия и маршрут изготовления, затем выберите исполнителя.',
          'From a replacement bracket to a small batch, furniture or an engineered product. Define requirements, components and a manufacturing route, then choose a maker.',
        )}
      />
      <div className="studio-intro-grid">
        <form className="studio-start panel" onSubmit={create}>
          <span className="studio-kicker">
            <Sparkles size={16} />
            {t('Рабочее место для вашей идеи', 'A workspace for your idea')}
          </span>
          <h2>{t('Что вы хотите изготовить?', 'What would you like to make?')}</h2>
          <label htmlFor="studio-idea">
            {t(
              'Задача, условия использования и известные размеры',
              'The task, operating conditions and known dimensions',
            )}
          </label>
          <textarea
            id="studio-idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            rows={7}
            required
            minLength={20}
            maxLength={3000}
            placeholder={t(
              'Например: нужна небольшая серия корпусов для уличного датчика. Внутри плата 60 × 40 мм, крепление на стену, съёмная крышка. Нужно 20 штук. Город — Казань. Материал и способ изготовления хочу подобрать.',
              'For example: a small batch of outdoor sensor enclosures. A 60 × 40 mm board inside, wall mounting and a removable lid. I need 20 units. Location: Bristol. I need help choosing a material and process.',
            )}
          />
          <p className="studio-help">
            {t(
              'Начните с того, что известно. Черновик приватный; создание проекта не вызывает ИИ и не публикует заявку.',
              'Start with what you know. Your draft is private; creating it does not call AI or publish a request.',
            )}
          </p>
          <ErrorBox error={error} />
          <button className="button" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="studio-spin" /> : <ArrowRight size={16} />}
            {t('Создать рабочий проект', 'Create a workspace')}
          </button>
          {capabilities && (
            <p className="studio-help">
              {capabilities.ai.configured
                ? t(
                    'ИИ настроен. Вы сможете включить помощь отдельно в проекте.',
                    'AI is configured. You can choose to use it inside your project.',
                  )
                : t(
                    'ИИ пока не подключён. Все поля, состав изделия и поиск исполнителей доступны вручную.',
                    'AI is not connected yet. You can still edit the full brief, components and maker search manually.',
                  )}
            </p>
          )}
        </form>
        <aside className="studio-intro-aside">
          <div className="studio-orbit" aria-hidden="true">
            <div className="studio-orbit-ring" />
            <div className="studio-orbit-ring second" />
            <Layers3 size={58} strokeWidth={1.1} />
            <span>CAD → CAM</span>
          </div>
          <h2>{t('Один проект. Разные технологии.', 'One project. Many ways to make it.')}</h2>
          <p>
            {t(
              'Детали, узлы, запасные части, оснастка, мебель и малые серии. Для каждой позиции можно указать свой материал и технологию.',
              'Parts, assemblies, spares, tooling, furniture and small batches. Each component can have its own material and process.',
            )}
          </p>
          <div className="studio-process-tags">
            <span>{t('3D-печать', '3D printing')}</span>
            <span>{t('ЧПУ', 'CNC')}</span>
            <span>{t('Резка', 'Cutting')}</span>
            <span>{t('Гибка', 'Bending')}</span>
            <span>{t('Сборка', 'Assembly')}</span>
          </div>
          <ol className="studio-route-list">
            <li>
              <span>01</span>
              <div>
                <strong>{t('Опишите результат', 'Describe the outcome')}</strong>
                <p>
                  {t(
                    'Что должно получиться и как будет работать.',
                    'What it should do and where it will be used.',
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>
                  {t('Подготовьте техническое задание', 'Prepare the technical brief')}
                </strong>
                <p>
                  {t(
                    'Требования, состав, операции и критерии приёмки.',
                    'Requirements, components, operations and acceptance.',
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>{t('Выберите исполнителя', 'Choose a maker')}</strong>
                <p>
                  {t(
                    'Согласуйте конструкцию, стоимость и изготовление.',
                    'Agree on the design, price and manufacturing.',
                  )}
                </p>
              </div>
            </li>
          </ol>
        </aside>
      </div>
      <section className="studio-projects" aria-labelledby="studio-projects-heading">
        <div className="section-heading">
          <h2 id="studio-projects-heading">{t('Ваши рабочие проекты', 'Your workspaces')}</h2>
          <span className="studio-help">{t('Доступны только вам', 'Only visible to you')}</span>
        </div>
        <ErrorBox error={projects.error} retry={projects.reload} />
        {projects.loading && savedProjects.length === 0 ? (
          <Loading />
        ) : savedProjects.length ? (
          <div className="studio-project-grid">
            {savedProjects.map((project) => (
              <Link className="studio-project-card" key={project.id} to={'/studio/' + project.id}>
                <div className="studio-card-top">
                  <Layers3 size={20} />
                  <span>{formatDate(project.updated_at, lang)}</span>
                </div>
                <h3>{project.brief.title}</h3>
                <p>{project.brief.purpose}</p>
                <div className="studio-card-bottom">
                  <span>
                    {project.job_id
                      ? t('Заявка отправлена', 'Request sent')
                      : project.confirmed_version === project.version
                        ? t('ТЗ подтверждено', 'Brief confirmed')
                        : t('Черновик', 'Draft')}
                  </span>
                  <ArrowRight size={17} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="studio-empty-note">
            {t(
              'Здесь появятся ваши проекты: можно вернуться к размерам, составу изделия и выбору исполнителя.',
              'Your projects will appear here, ready to revisit dimensions, components and maker selection.',
            )}
          </p>
        )}
        {projects.data?.has_more && (
          <div className="studio-load-more">
            <button
              className="button secondary"
              disabled={projects.loading}
              onClick={() => setOffset(offset + 20)}
            >
              {projects.loading
                ? t('Загружаем…', 'Loading…')
                : t('Показать ещё проекты', 'Load more workspaces')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function StudioEditor({
  id,
  capabilities,
}: {
  id: string;
  capabilities: StudioCapabilities | null;
}) {
  const { t, lang, refresh, toast } = useApp(),
    navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null),
    [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const [aiMessage, setAiMessage] = useState(''),
    [quality, setQuality] = useState<'standard' | 'review'>('standard'),
    [consent, setConsent] = useState(false);
  const [target, setTarget] = useState(''),
    [currency, setCurrency] = useState<Currency>('RUB'),
    [publishConsent, setPublishConsent] = useState(false),
    [matches, setMatches] = useState<StudioMatch[]>([]);
  const pendingAssist = useRef<{ key: string; requestId: string } | null>(null),
    actionLock = useRef(false);
  const apply = (result: Detail) => {
    setDetail(result);
    setDraft(toDraft(result.project.brief));
    setMatches(result.matches ?? []);
    setTarget((current) =>
      result.matches?.some((match) => match.profile.id === current) ? current : '',
    );
    setPublishConsent(false);
  };
  useEffect(() => {
    const controller = new AbortController();
    api<Detail>('/studio/projects/' + id, { signal: controller.signal })
      .then(apply)
      .catch((error) => {
        if (error.name !== 'AbortError') setError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);
  const dirty = !!(
    draft &&
    detail &&
    JSON.stringify(fromDraft(draft)) !== JSON.stringify(detail.project.brief)
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((draft) => (draft ? { ...draft, [key]: value } : draft));
    setPublishConsent(false);
  };
  async function run(name: string, action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(name);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(errorText(error));
    } finally {
      actionLock.current = false;
      setBusy('');
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !detail) return;
    const parsed = studioBriefSchema.safeParse(fromDraft(draft));
    if (!parsed.success) {
      setError(
        t('Проверьте поля: ', 'Please check: ') +
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(' · '),
      );
      return;
    }
    await run('save', async () => {
      apply(
        await post<Detail>(
          '/studio/projects/' + id,
          { version: detail.project.version, brief: parsed.data },
          'PUT',
        ),
      );
      toast(t('ТЗ сохранено', 'Brief saved'));
    });
  }
  async function assist(event: FormEvent) {
    event.preventDefault();
    if (!detail || dirty || !consent) return;
    const key = JSON.stringify([detail.project.version, aiMessage, quality]);
    if (pendingAssist.current?.key !== key)
      pendingAssist.current = { key, requestId: crypto.randomUUID() };
    const requestId = pendingAssist.current.requestId;
    await run('assist', async () => {
      try {
        apply(
          await post<Detail>('/studio/projects/' + id + '/assist', {
            version: detail.project.version,
            requestId,
            message: aiMessage,
            quality,
            consent: true,
          }),
        );
      } catch (error) {
        // Failed attempts also consume quota. Retain the original revision and request ID
        // so a lost response can be retrieved without starting another paid call.
        try {
          const latest = await api<Detail>('/studio/projects/' + id);
          setDetail((current) => (current ? { ...current, usage: latest.usage } : current));
        } catch {
          /* The original error is the actionable result if the connection is down. */
        }
        throw error;
      }
      pendingAssist.current = null;
      setAiMessage('');
      setConsent(false);
      toast(
        t(
          'ИИ обновил черновик. Проверьте все изменения.',
          'AI updated the draft. Please review all changes.',
        ),
      );
    });
  }
  if (loading)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (!detail || !draft)
    return (
      <div className="page">
        <Link className="text-button" to="/studio">
          <ArrowLeft size={15} /> Neofab Studio
        </Link>
        <ErrorBox error={error} retry={() => window.location.reload()} />
      </div>
    );
  const project = detail.project,
    published = !!project.job_id,
    confirmed = project.confirmed_version === project.version;
  const unresolved = project.brief.questions.length + project.brief.assumptions.length;
  const required = project.checks.filter((check) => check.level === 'required');
  const canConfirm =
    !busy &&
    !dirty &&
    !published &&
    !required.length &&
    !!project.brief.city &&
    project.brief.quantity !== null;
  const canPublish = confirmed && !dirty && !busy && !published && publishConsent;
  const remaining = capabilities
    ? Math.max(0, capabilities.ai.maxCallsPerProject - detail.usage.projectCalls)
    : 0;
  const retryingAssist =
    pendingAssist.current?.key === JSON.stringify([project.version, aiMessage, quality]);
  const fieldLocked = !!busy || published;
  const labels: Record<LineField, [string, string]> = {
    requirements: ['Требования к изделию', 'Product requirements'],
    questions: ['Открытые вопросы', 'Open questions'],
    assumptions: ['Неподтверждённые допущения', 'Unconfirmed assumptions'],
    operations: ['Операции изготовления и сборки', 'Manufacturing & assembly operations'],
    acceptance: ['Критерии приёмки', 'Acceptance criteria'],
  };
  return (
    <div className="page studio-page">
      <div className="studio-editor-top">
        <Link className="text-button" to="/studio">
          <ArrowLeft size={15} /> {t('Рабочие проекты', 'Workspaces')}
        </Link>
        <span className="studio-version">
          {t('Версия', 'Revision')} {project.version} ·{' '}
          {project.source === 'openai'
            ? t('Черновик с помощью ИИ', 'AI-assisted draft')
            : t('Ручной черновик', 'Manual draft')}
        </span>
      </div>
      <PageTitle
        eyebrow="NEOFAB STUDIO"
        title={project.brief.title}
        description={t(
          'Соберите проверяемое техническое задание. Укажите, что уже согласовано и что предстоит обсудить с исполнителем.',
          'Build a technical brief that can be checked. Distinguish agreed facts from questions to discuss with the maker.',
        )}
      />
      <nav className="studio-stages" aria-label={t('Этапы проекта', 'Project stages')}>
        <a className="active" href="#studio-brief">
          <span>01</span>
          {t('Техническое задание', 'Technical brief')}
        </a>
        <a className={confirmed ? 'active' : ''} href="#studio-review">
          <span>{confirmed ? <Check size={13} /> : '02'}</span>
          {t('Проверка и подтверждение', 'Review & confirm')}
        </a>
        <a className={published ? 'active' : ''} href="#studio-makers">
          <span>{published ? <Check size={13} /> : '03'}</span>
          {t('Исполнитель', 'Your maker')}
        </a>
      </nav>
      <div className="studio-error-region">
        <ErrorBox error={error} />
      </div>
      {published && (
        <div className="studio-published" role="status">
          <CheckCircle2 size={22} />
          <div>
            <strong>{t('Заявка создана', 'Your request is ready')}</strong>
            <p>
              {t(
                'Эта версия зафиксирована. Предложения и переписка доступны в заявке.',
                'This revision is locked. Continue with offers and messages in the request.',
              )}
            </p>
          </div>
          <Link className="button" to={'/projects/' + project.job_id}>
            {t('Открыть заявку', 'Open request')}
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="studio-editor-grid">
        <div className="studio-main">
          <form onSubmit={save} className="studio-brief-form">
            <fieldset disabled={fieldLocked} className="studio-fields">
              <section
                className="panel studio-section"
                id="studio-brief"
                aria-labelledby="brief-heading"
              >
                <div className="studio-section-heading">
                  <span className="studio-section-icon">
                    <ListChecks size={20} />
                  </span>
                  <div>
                    <h2 id="brief-heading">{t('Техническое задание', 'Technical brief')}</h2>
                    <p>
                      {t(
                        'Изделие целиком: назначение, объём и основные требования.',
                        'The whole product: purpose, quantity and key requirements.',
                      )}
                    </p>
                  </div>
                </div>
                <label>
                  {t('Что нужно от исполнителя?', 'What do you need from the maker?')}
                  <select
                    value={draft.requestKind}
                    onChange={(event) =>
                      update('requestKind', event.target.value as StudioBrief['requestKind'])
                    }
                  >
                    <option value="design">
                      {t('Проектирование и консультация', 'Design & consultation')}
                    </option>
                    <option value="manufacture">
                      {t('Расчёт изготовления', 'Manufacturing quote')}
                    </option>
                  </select>
                </label>
                <label>
                  {t('Название проекта', 'Project title')}
                  <input
                    value={draft.title}
                    onChange={(e) => update('title', e.target.value)}
                    minLength={5}
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  {t('Назначение и условия эксплуатации', 'Purpose & operating conditions')}
                  <textarea
                    value={draft.purpose}
                    onChange={(e) => update('purpose', e.target.value)}
                    rows={5}
                    minLength={20}
                    maxLength={3000}
                    required
                  />
                </label>
                <div className="form-grid">
                  <label>
                    {t('Основная технология', 'Primary process')}
                    <select
                      value={draft.process}
                      onChange={(e) => update('process', e.target.value as StudioBrief['process'])}
                    >
                      <ProcessOptions />
                    </select>
                  </label>
                  <label>
                    {t('Материал или требования к материалу', 'Material or material requirements')}
                    <input
                      value={draft.material}
                      onChange={(e) => update('material', e.target.value)}
                      maxLength={80}
                      placeholder={t('Уточнить с исполнителем', 'Agree with the maker')}
                    />
                  </label>
                  <label>
                    {t('Количество изделий', 'Product quantity')}
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      value={draft.quantity ?? ''}
                      onChange={(e) =>
                        update('quantity', e.target.value === '' ? null : Number(e.target.value))
                      }
                      placeholder={t('Нужно уточнить', 'To be decided')}
                    />
                  </label>
                  <label>
                    {t('Город или «Удалённо»', 'City or “Remote”')}
                    <input
                      value={draft.city}
                      onChange={(e) => update('city', e.target.value)}
                      maxLength={80}
                      placeholder={t('Где нужен результат', 'Where it is needed')}
                    />
                  </label>
                </div>
                <label>
                  {t(...labels.requirements)}
                  <textarea
                    value={draft.requirements}
                    onChange={(e) => update('requirements', e.target.value)}
                    rows={4}
                    placeholder={t(
                      'Одно требование на строку: размеры, допуски, нагрузки, температура, поверхность…',
                      'One requirement per line: dimensions, tolerances, loads, temperature, finish…',
                    )}
                  />
                  <small>
                    {t(
                      'До 12 требований, каждое — до 300 символов.',
                      'Up to 12 requirements, 300 characters each.',
                    )}
                  </small>
                </label>
              </section>
              <section className="panel studio-section" aria-labelledby="components-heading">
                <div className="studio-section-heading">
                  <span className="studio-section-icon">
                    <Layers3 size={20} />
                  </span>
                  <div>
                    <h2 id="components-heading">{t('Состав изделия', 'Product components')}</h2>
                    <p>
                      {t(
                        'Детали, покупные компоненты и сборочные узлы. Количество — на одно изделие; оставьте поле пустым, если его нужно уточнить.',
                        'Parts, purchased components and assemblies. Quantities are per finished product; leave blank if they still need clarification.',
                      )}
                    </p>
                  </div>
                </div>
                {draft.components.length === 0 && (
                  <p className="studio-empty-note">
                    {t(
                      'Для простой детали достаточно основного ТЗ. Для корпуса со вставками, мебели или сборки добавьте отдельные позиции.',
                      'The main brief is enough for a simple part. Add components for an enclosure with inserts, furniture or an assembly.',
                    )}
                  </p>
                )}
                <div className="studio-components">
                  {draft.components.map((component, index) => {
                    const change = (patch: Partial<StudioBrief['components'][number]>) =>
                      update(
                        'components',
                        draft.components.map((item, i) =>
                          i === index ? { ...item, ...patch } : item,
                        ),
                      );
                    return (
                      <div className="studio-component" key={index}>
                        <div className="studio-component-heading">
                          <span>
                            {t('Позиция', 'Component')} {index + 1}
                          </span>
                          <button
                            type="button"
                            className="studio-icon-button"
                            aria-label={t('Удалить позицию ', 'Remove component ') + (index + 1)}
                            onClick={() =>
                              update(
                                'components',
                                draft.components.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="studio-component-name">
                          <label>
                            {t('Название позиции', 'Component name')}
                            <input
                              value={component.name}
                              minLength={2}
                              maxLength={100}
                              required
                              onChange={(e) => change({ name: e.target.value })}
                            />
                          </label>
                          <label>
                            {t('Кол-во', 'Qty')}
                            <input
                              type="number"
                              value={component.quantity ?? ''}
                              min={1}
                              max={10000}
                              step={1}
                              placeholder="?"
                              onChange={(e) =>
                                change({
                                  quantity: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="form-grid">
                          <label>
                            {t('Технология позиции', 'Component process')}
                            <select
                              value={component.process}
                              onChange={(e) =>
                                change({ process: e.target.value as StudioBrief['process'] })
                              }
                            >
                              <ProcessOptions />
                            </select>
                          </label>
                          <label>
                            {t('Материал позиции', 'Component material')}
                            <input
                              value={component.material}
                              maxLength={80}
                              onChange={(e) => change({ material: e.target.value })}
                            />
                          </label>
                        </div>
                        <label>
                          {t(
                            'Размеры и требования к позиции',
                            'Component dimensions & requirements',
                          )}
                          <textarea
                            value={component.requirements}
                            maxLength={600}
                            rows={2}
                            onChange={(e) => change({ requirements: e.target.value })}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="button secondary studio-add-component"
                  type="button"
                  disabled={fieldLocked || draft.components.length >= 30}
                  onClick={() =>
                    update('components', [
                      ...draft.components,
                      {
                        name: '',
                        quantity: null,
                        process: 'UNSURE',
                        material: '',
                        requirements: '',
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  {t('Добавить позицию', 'Add a component')}
                </button>
                <div className="studio-line-fields">
                  {(['operations', 'acceptance'] as const).map((key) => (
                    <label key={key}>
                      {t(...labels[key])}
                      <textarea
                        value={draft[key]}
                        onChange={(e) => update(key, e.target.value)}
                        rows={3}
                        placeholder={
                          key === 'operations'
                            ? t(
                                'Например: раскрой панелей, обработка кромок, сборка, контроль размеров.',
                                'For example: cut panels, finish edges, assemble, check dimensions.',
                              )
                            : t(
                                'Например: габариты по чертежу, сборка без люфта, комплектность партии.',
                                'For example: dimensions match the drawing, play-free assembly, complete batch.',
                              )
                        }
                      />
                      <small>{t('По одному пункту на строку.', 'One item per line.')}</small>
                    </label>
                  ))}
                </div>
              </section>
              <section
                className="panel studio-section"
                id="studio-unresolved"
                aria-labelledby="questions-heading"
              >
                <div className="studio-section-heading">
                  <div>
                    <h2 id="questions-heading">
                      {t('Что ещё нужно уточнить', 'What still needs clarification')}
                    </h2>
                    <p>
                      {t(
                        'Оставьте вопросы и неподтверждённые решения для обсуждения с исполнителем. Когда получите ответ, перенесите согласованные сведения в требования и обновите соответствующий пункт.',
                        'Keep open questions and unconfirmed choices here for discussion with the maker. When resolved, move agreed facts into requirements and update the relevant item.',
                      )}
                    </p>
                  </div>
                </div>
                <div className="studio-line-fields">
                  {(['questions', 'assumptions'] as const).map((key) => (
                    <label key={key}>
                      {t(...labels[key])}
                      <textarea
                        value={draft[key]}
                        onChange={(e) => update(key, e.target.value)}
                        rows={3}
                        placeholder={t('По одному пункту на строку', 'One item per line')}
                      />
                    </label>
                  ))}
                </div>
              </section>
              <section className="panel studio-section" aria-labelledby="geometry-heading">
                <div className="studio-section-heading">
                  <span className="studio-section-icon">
                    <Wrench size={20} />
                  </span>
                  <div>
                    <h2 id="geometry-heading">
                      {t('Геометрия простой детали', 'Simple part geometry')}
                    </h2>
                    <p>
                      {t(
                        'Необязательный шаблон для FDM: блок, пластина или втулка. Сложные изделия описываются в ТЗ и составе; их CAD-модель готовит инженер.',
                        'Optional FDM templates: a block, plate or spacer tube. Describe complex products in the brief and components; an engineer prepares their CAD model.',
                      )}
                    </p>
                  </div>
                </div>
                <label>
                  {t('Шаблон модели', 'Model template')}
                  <select
                    value={draft.part?.kind ?? 'none'}
                    onChange={(e) =>
                      update(
                        'part',
                        e.target.value === 'none'
                          ? null
                          : {
                              ...(draft.part ?? emptyPart),
                              kind: e.target.value as NonNullable<StudioBrief['part']>['kind'],
                              ...(e.target.value === 'tube'
                                ? { depth: draft.part?.width ?? emptyPart.width, hole: 10 }
                                : {}),
                              ...(e.target.value === 'block' ? { hole: 0 } : {}),
                            },
                      )
                    }
                  >
                    <option value="none">
                      {t('Своя конструкция — без шаблона', 'Custom design — no template')}
                    </option>
                    <option
                      value="block"
                      disabled={draft.process !== 'FDM' || draft.components.length > 0}
                    >
                      {t('Блок', 'Block')}
                    </option>
                    <option
                      value="plate"
                      disabled={draft.process !== 'FDM' || draft.components.length > 0}
                    >
                      {t('Пластина с отверстием', 'Drilled plate')}
                    </option>
                    <option
                      value="tube"
                      disabled={draft.process !== 'FDM' || draft.components.length > 0}
                    >
                      {t('Втулка', 'Spacer tube')}
                    </option>
                  </select>
                </label>
                {(draft.process !== 'FDM' || draft.components.length > 0) && (
                  <p className="studio-help">
                    {t(
                      'Шаблонный STL доступен для одной FDM-детали без отдельных позиций в составе. Для сборок и других процессов оставьте вариант «Своя конструкция».',
                      'Template STL supports a single FDM part without component entries. For assemblies and other processes, keep “Custom design”.',
                    )}
                  </p>
                )}
                {draft.part && (
                  <>
                    <div className="form-grid">
                      {(['width', 'depth', 'height', 'hole'] as const)
                        .filter(
                          (field) =>
                            !(draft.part?.kind === 'tube' && field === 'depth') &&
                            !(draft.part?.kind === 'block' && field === 'hole'),
                        )
                        .map((field) => (
                          <label key={field}>
                            {field === 'width'
                              ? draft.part?.kind === 'tube'
                                ? t('Наружный диаметр, мм', 'Outer diameter, mm')
                                : t('Ширина, мм', 'Width, mm')
                              : field === 'depth'
                                ? t('Глубина, мм', 'Depth, mm')
                                : field === 'height'
                                  ? t('Высота, мм', 'Height, mm')
                                  : t('Диаметр отверстия, мм', 'Hole diameter, mm')}
                            <input
                              type="number"
                              value={draft.part![field]}
                              min={field === 'hole' ? 0 : field === 'height' ? 1 : 4}
                              max={field === 'hole' ? 296 : 300}
                              step="any"
                              required
                              onChange={(e) =>
                                update('part', {
                                  ...draft.part!,
                                  [field]: Number(e.target.value),
                                  ...(field === 'width' && draft.part?.kind === 'tube'
                                    ? { depth: Number(e.target.value) }
                                    : {}),
                                })
                              }
                            />
                          </label>
                        ))}
                    </div>
                    <Suspense fallback={<Loading />}>
                      <PartPreview part={draft.part} />
                    </Suspense>
                  </>
                )}
              </section>
            </fieldset>
            {!published && (
              <div className="studio-save-bar">
                <div>
                  <strong>
                    {dirty
                      ? t('Есть несохранённые изменения', 'You have unsaved changes')
                      : t('Изменения сохранены', 'Changes are saved')}
                  </strong>
                  <p>
                    {t(
                      'Изменённое ТЗ получает новую версию, которую нужно подтвердить повторно.',
                      'A changed brief gets a new revision that needs confirmation again.',
                    )}
                  </p>
                </div>
                <button className="button" disabled={!dirty || !!busy}>
                  {busy === 'save' ? (
                    <LoaderCircle size={16} className="studio-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {t('Сохранить ТЗ', 'Save brief')}
                </button>
              </div>
            )}
          </form>
          <section
            className="panel studio-section"
            id="studio-makers"
            aria-labelledby="makers-heading"
          >
            <div className="studio-section-heading">
              <span className="studio-section-icon">
                <MapPin size={20} />
              </span>
              <div>
                <h2 id="makers-heading">{t('Выбор исполнителя', 'Choose a maker')}</h2>
                <p>
                  {t(
                    'Подбор по заявленным технологиям, материалам и городу. Возможности станка, допуски и готовность к заказу уточняются с исполнителем.',
                    'Matches use declared processes, materials and location. Confirm machine capabilities, tolerances and availability with the maker.',
                  )}
                </p>
              </div>
            </div>
            {!published && (
              <>
                <div className="studio-maker-options">
                  <label className={'studio-maker-choice' + (!target ? ' selected' : '')}>
                    <input
                      type="radio"
                      name="studio-target"
                      checked={!target}
                      onChange={() => {
                        setTarget('');
                        setPublishConsent(false);
                      }}
                      disabled={!!busy}
                    />
                    <div>
                      <strong>{t('Открытая заявка', 'Open request')}</strong>
                      <p>
                        {t(
                          'Все посетители смогут увидеть ТЗ. Исполнители смогут предложить условия.',
                          'All visitors can see the brief. Makers can propose their terms.',
                        )}
                      </p>
                    </div>
                  </label>
                  {matches.map((match) => (
                    <label
                      key={match.profile.id}
                      className={
                        'studio-maker-choice' + (target === match.profile.id ? ' selected' : '')
                      }
                    >
                      <input
                        type="radio"
                        name="studio-target"
                        checked={target === match.profile.id}
                        onChange={() => {
                          setTarget(match.profile.id);
                          setPublishConsent(false);
                        }}
                        disabled={!!busy}
                      />
                      <div>
                        <strong>{match.profile.name}</strong>
                        <p>
                          {match.profile.city}
                          {match.profile.remote
                            ? ' · ' + t('работает удалённо', 'remote available')
                            : ''}
                        </p>
                        <div className="studio-match-reasons">
                          {match.reasons.map((reason) => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>
                      </div>
                      <Link
                        className="text-button"
                        to={'/studios/' + match.profile.id}
                        target="_blank"
                        aria-label={t('Профиль: ', 'Profile: ') + match.profile.name}
                      >
                        {t('Профиль', 'Profile')} ↗
                      </Link>
                    </label>
                  ))}
                </div>
                {matches.length === 0 && (
                  <p className="studio-help">
                    {t(
                      'Подходящих профилей пока нет. Можно опубликовать открытый запрос и обсудить технологию с исполнителями.',
                      'No matching profiles yet. You can post an open request and discuss the process with makers.',
                    )}
                  </p>
                )}
                <button
                  className="text-button"
                  disabled={!!busy || dirty}
                  onClick={() =>
                    run('matches', async () => {
                      const result = await api<{ matches: StudioMatch[] }>(
                        '/studio/projects/' + id + '/matches',
                      );
                      setMatches(result.matches);
                    })
                  }
                >
                  {t('Обновить подбор по сохранённому ТЗ', 'Refresh matches for the saved brief')}
                </button>
                <div className="studio-publish-form">
                  <label>
                    {t('Валюта предложений', 'Quote currency')}
                    <select
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value as Currency);
                        setPublishConsent(false);
                      }}
                      disabled={!!busy}
                    >
                      {currencies.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={publishConsent}
                      onChange={(e) => setPublishConsent(e.target.checked)}
                      disabled={!confirmed || dirty || !!busy}
                    />
                    <span>
                      {target
                        ? t(
                            'Подтверждаю отправку этой версии ТЗ выбранному исполнителю. Цена и сроки будут согласованы в заявке.',
                            'I confirm sending this brief revision to the selected maker. Price and delivery will be agreed in the request.',
                          )
                        : t(
                            'Подтверждаю публикацию этой версии ТЗ для всех посетителей. В ней нет сведений, которые должны остаться приватными.',
                            'I confirm publishing this brief revision for all visitors. It contains no information that should stay private.',
                          )}
                    </span>
                  </label>
                  {(!confirmed || dirty) && (
                    <p className="studio-help">
                      {t(
                        'Сначала сохраните и подтвердите актуальную версию ТЗ в блоке проверки.',
                        'First save and confirm the current brief in the review panel.',
                      )}
                    </p>
                  )}
                  <button
                    className="button"
                    disabled={!canPublish}
                    onClick={() =>
                      run('publish', async () => {
                        const result = await post<{ job_id: string; project: StudioProject }>(
                          '/studio/projects/' + id + '/publish',
                          {
                            version: project.version,
                            visibility: target ? 'direct' : 'public',
                            target_profile_id: target || null,
                            currency,
                            budget: null,
                          },
                        );
                        await refresh();
                        navigate('/projects/' + result.job_id);
                      })
                    }
                  >
                    {busy === 'publish' ? (
                      <LoaderCircle size={16} className="studio-spin" />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                    {target
                      ? t('Отправить выбранному исполнителю', 'Send to selected maker')
                      : t('Опубликовать заявку', 'Publish request')}
                  </button>
                </div>
              </>
            )}
            {published && (
              <Link className="button secondary" to={'/projects/' + project.job_id}>
                {t('Предложения и переписка', 'Offers & messages')}
                <ArrowRight size={16} />
              </Link>
            )}
          </section>
        </div>
        <aside className="studio-sidebar">
          {!published && (
            <form className="panel studio-assistant" onSubmit={assist}>
              <div className="studio-section-heading">
                <span className="studio-section-icon">
                  <Sparkles size={19} />
                </span>
                <div>
                  <h2>{t('Помощник проекта', 'Project assistant')}</h2>
                  <p>
                    {t(
                      'Поможет уточнить ТЗ и найти пробелы.',
                      'Clarify the brief and find missing details.',
                    )}
                  </p>
                </div>
              </div>
              {capabilities?.ai.configured ? (
                <>
                  <label>
                    {t('Что проработать?', 'What should we work on?')}
                    <textarea
                      value={aiMessage}
                      onChange={(e) => setAiMessage(e.target.value)}
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={4}
                      disabled={!!busy}
                      placeholder={t(
                        'Например: разбей изделие на компоненты и задай вопросы о креплении и условиях работы.',
                        'For example: break the product into components and ask about mounting and operating conditions.',
                      )}
                    />
                  </label>
                  <label>
                    {t('Глубина разбора', 'Level of detail')}
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value as 'standard' | 'review')}
                      disabled={!!busy}
                    >
                      <option value="standard">{t('Уточнение задачи', 'Clarify the task')}</option>
                      <option value="review">{t('Подробный разбор', 'Detailed review')}</option>
                    </select>
                  </label>
                  <p className="studio-help">
                    {t(
                      'Подробный разбор может использовать более дорогую модель. ИИ предлагает черновик; размеры, материалы и требования нужно проверить.',
                      'A detailed review may use a more costly model. AI proposes a draft; dimensions, materials and requirements need review.',
                    )}
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      disabled={!!busy}
                    />
                    <span>
                      {t(
                        'Разрешаю отправить текст идеи, ТЗ и этого сообщения в OpenAI для обработки.',
                        'I allow the idea, brief and this message to be sent to OpenAI for processing.',
                      )}
                    </span>
                  </label>
                  <p className="studio-help">
                    {t('Доступно обращений в проекте: ', 'Calls remaining for this project: ')}
                    <strong>{remaining}</strong>
                    {t(' из ', ' of ')}
                    {capabilities.ai.maxCallsPerProject}
                    {t(
                      '. Действуют также общие суточные лимиты.',
                      '. Shared daily limits also apply.',
                    )}
                  </p>
                  {dirty && (
                    <p className="studio-action-note">
                      {t(
                        'Сохраните изменения перед обращением к ИИ.',
                        'Save your changes before asking AI.',
                      )}
                    </p>
                  )}
                  <button
                    className="button"
                    disabled={!!busy || dirty || !consent || (remaining === 0 && !retryingAssist)}
                  >
                    {busy === 'assist' ? (
                      <LoaderCircle size={16} className="studio-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {busy === 'assist'
                      ? t('Прорабатываем ТЗ…', 'Working on the brief…')
                      : retryingAssist
                        ? t('Получить результат попытки', 'Retrieve the attempt result')
                        : t('Уточнить с ИИ', 'Refine with AI')}
                  </button>
                  {retryingAssist && !busy && (
                    <div className="studio-retry-info">
                      <p className="studio-help">
                        {t(
                          'Повторное получение результата не создаёт новое обращение. Новая попытка с этим текстом использует ещё одно обращение и может потребовать оплату API.',
                          'Retrieving the result does not start a new call. A new attempt with this text uses another call and may incur API charges.',
                        )}
                      </p>
                      <button
                        className="text-button"
                        type="button"
                        disabled={remaining === 0 || dirty}
                        onClick={() => {
                          pendingAssist.current = null;
                          setConsent(false);
                          setError('');
                        }}
                      >
                        {t('Подготовить новое обращение', 'Prepare a new call')}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="studio-ai-off">
                  <span>{t('Доступен ручной режим', 'Manual mode is available')}</span>
                  <p>
                    {capabilities
                      ? t(
                          'ИИ не подключён к этой установке. Заполните ТЗ самостоятельно — сохранение, подтверждение, выгрузка и подбор исполнителей работают.',
                          'AI is not connected to this installation. Complete the brief manually — saving, confirmation, downloads and maker matching work.',
                        )
                      : t(
                          'Проверяем доступность ИИ. Вы можете заполнять ТЗ вручную.',
                          'Checking AI availability. You can complete the brief manually.',
                        )}
                  </p>
                </div>
              )}
            </form>
          )}
          <section
            className="panel studio-review"
            id="studio-review"
            aria-labelledby="review-heading"
          >
            <div className="studio-section-heading">
              <span className="studio-section-icon">
                <CheckCircle2 size={19} />
              </span>
              <div>
                <h2 id="review-heading">{t('Проверка ТЗ', 'Brief review')}</h2>
                <p>
                  {t('Для сохранённой версии ', 'For saved revision ')}
                  {project.version}
                </p>
              </div>
            </div>
            <ul className="studio-checks">
              {project.checks.map((check) => (
                <li key={check.code} className={'studio-check ' + check.level}>
                  <span
                    aria-label={
                      check.level === 'passed'
                        ? t('Пройдено', 'Passed')
                        : check.level === 'required'
                          ? t('Нужно исправить', 'Action required')
                          : t('Обратите внимание', 'Attention')
                    }
                  >
                    {check.level === 'passed' ? <Check size={13} /> : '!'}
                  </span>
                  <p>{lang === 'ru' ? check.ru : check.en}</p>
                </li>
              ))}
            </ul>
            <p className="studio-help">
              {t(
                'Эти проверки оценивают полноту ТЗ и геометрию шаблона. Они не подтверждают прочность, технологичность, пригодность материала или безопасность изделия. Производство согласует исполнитель.',
                'These checks cover brief completeness and template geometry. They do not certify strength, manufacturability, material suitability or product safety. The maker reviews manufacturing.',
              )}
            </p>
            {!published && (
              <>
                <p className="studio-help">
                  {t(
                    'Подтверждение фиксирует точное описание вашей задачи для обсуждения и расчёта. Конструкцию и запуск изготовления вы согласуете с исполнителем отдельно.',
                    'Confirmation records an accurate brief for discussion and quoting. Agree on the design and manufacturing release separately with the maker.',
                  )}
                </p>
                {dirty ? (
                  <p className="studio-action-note">
                    {t('Сначала сохраните изменения.', 'Save your changes first.')}
                  </p>
                ) : unresolved > 0 ? (
                  <a className="studio-action-note" href="#studio-unresolved">
                    {t(
                      'Для обсуждения с исполнителем — вопросов и допущений: ',
                      'Questions and assumptions for the maker: ',
                    )}
                    {unresolved} →
                  </a>
                ) : null}
                <button
                  className={'button ' + (confirmed ? 'secondary' : '')}
                  disabled={!canConfirm || confirmed}
                  onClick={() =>
                    run('confirm', async () => {
                      apply(
                        await post<Detail>('/studio/projects/' + id + '/confirm', {
                          version: project.version,
                        }),
                      );
                      toast(t('Версия ТЗ подтверждена', 'Brief revision confirmed'));
                    })
                  }
                >
                  {busy === 'confirm' ? (
                    <LoaderCircle size={16} className="studio-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {confirmed
                    ? t('ТЗ подтверждено', 'Brief confirmed')
                    : t('Подтвердить ТЗ', 'Confirm brief')}
                </button>
              </>
            )}
            {confirmed ? (
              <div className="studio-downloads">
                <a href={'/api/studio/projects/' + id + '/packet'} download>
                  <Download size={15} />
                  {t('Скачать пакет ТЗ (JSON)', 'Download brief packet (JSON)')}
                </a>
                {project.brief.part && project.brief.process === 'FDM' && (
                  <a href={'/api/studio/projects/' + id + '/model.stl'} download>
                    <Download size={15} />
                    {t('Скачать шаблон STL', 'Download template STL')}
                  </a>
                )}
                <p className="studio-help">
                  {t('Выгружается подтверждённая версия.', 'Downloads use the confirmed revision.')}
                  {dirty
                    ? ' ' +
                      t(
                        'Несохранённые правки в файл не попадут.',
                        'Unsaved changes are not included.',
                      )
                    : ''}
                </p>
              </div>
            ) : (
              <p className="studio-help">
                {t(
                  'Скачать пакет ТЗ и шаблон STL можно после подтверждения версии.',
                  'The brief packet and template STL become available after confirming the revision.',
                )}
              </p>
            )}
          </section>
          <details className="studio-original">
            <summary>{t('Исходная идея', 'Original idea')}</summary>
            <p>{project.idea}</p>
          </details>
        </aside>
      </div>
    </div>
  );
}
