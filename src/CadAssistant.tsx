import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  CheckCircle2,
  FileCode2,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { CadProposal, CadProposalState } from '../shared/cad-ai';
import type { CadOperation, CadSpec, CadState } from '../shared/cad';
import type { StudioProject, StudioUsage } from '../shared/studio';
import { api, post, ErrorBox, errorText, formatDate, Loading, useApp } from './core';

type Props = {
  project: StudioProject;
  blocked: boolean;
  templateAttached: boolean;
  usage?: StudioUsage;
  onUsageChanged?: (usage: StudioUsage) => void;
  onApplyingChange: (applying: boolean) => void;
  onApplied: (result: { project: StudioProject; cad: CadState }) => void;
};
const types: Record<CadOperation['type'], [string, string]> = {
  box: ['Блок', 'Box'],
  cylinder: ['Цилиндр', 'Cylinder'],
  extrude: ['Выдавливание', 'Extrude'],
  fillet: ['Скругление', 'Fillet'],
  chamfer: ['Фаска', 'Chamfer'],
};
function ProposalSpec({ spec }: { spec: CadSpec }) {
  const { t } = useApp();
  const vector = (values: number[]) => values.join(' × ');
  function describe(operation: CadOperation) {
    const origin =
      'at' in operation
        ? `${t('начало', 'origin')}: [${operation.at.join(', ')}] ${t('мм', 'mm')}`
        : '';
    const mode =
      'mode' in operation
        ? t(
            operation.mode === 'add' ? 'добавить' : 'вычесть',
            operation.mode === 'add' ? 'add' : 'cut',
          )
        : '';
    if (operation.type === 'box')
      return `${mode} · ${vector(operation.size)} ${t('мм', 'mm')} · ${origin}`;
    if (operation.type === 'cylinder')
      return `${mode} · R ${operation.radius} ${t('мм', 'mm')} · ${t('длина', 'length')} ${operation.height} ${t('мм', 'mm')} · ${t('ось', 'axis')} ${operation.axis.toUpperCase()} · ${origin}`;
    if (operation.type === 'extrude')
      return `${mode} · ${operation.plane} · ${operation.points.length} ${t('вершин', 'vertices')} · ${t('выдавливание', 'distance')} ${operation.distance} ${t('мм', 'mm')} · ${origin}`;
    if (operation.type === 'fillet')
      return `R ${operation.radius} ${t('мм', 'mm')} · ${t('рёбра', 'edges')} ${operation.selector}`;
    return `${operation.length} ${t('мм', 'mm')} · ${t('рёбра', 'edges')} ${operation.selector}`;
  }
  const parts = [
    ...(spec.operations.length
      ? [
          {
            id: 'body',
            name: spec.name,
            material: spec.material,
            process: spec.process,
            operations: spec.operations,
            at: [0, 0, 0],
            rotation: [0, 0, 0],
          },
        ]
      : []),
    ...spec.components,
  ];
  return (
    <div className="cad-proposal-spec">
      <h4>{spec.name}</h4>
      {spec.description && <p>{spec.description}</p>}
      <dl className="cad-proposal-facts">
        <div>
          <dt>{t('Компонентов', 'Components')}</dt>
          <dd>{parts.length}</dd>
        </div>
        <div>
          <dt>{t('Ожидается тел', 'Expected solids')}</dt>
          <dd>{spec.requirements.expected_solids}</dd>
        </div>
        <div>
          <dt>{t('Проверяемые габариты, мм', 'Declared bounds, mm')}</dt>
          <dd>
            {spec.requirements.bounds
              ? vector(spec.requirements.bounds)
              : t('Не заданы', 'Not specified')}
          </dd>
        </div>
        <div>
          <dt>{t('Допуск проверки габаритов, мм', 'Bounds check tolerance, mm')}</dt>
          <dd>{spec.requirements.tolerance}</dd>
        </div>
      </dl>
      <p className="studio-help">
        {t(
          'Здесь показаны предложенные параметры. Фактические габариты и корректность тела появятся после отдельного построения CAD.',
          'These are proposed parameters. Actual bounds and solid validity are available after a separate CAD build.',
        )}
      </p>
      <div className="cad-proposal-parts">
        {parts.map((part) => (
          <details key={part.id} open={parts.length === 1}>
            <summary>
              <strong>{part.name}</strong>
              <span>
                {part.operations.length} {t('операций', 'operations')}
              </span>
            </summary>
            <div>
              <p>
                {t('Материал', 'Material')}: {part.material || t('Не выбран', 'Not chosen')} ·{' '}
                {t('Технология', 'Process')}: {part.process || t('Не выбрана', 'Not chosen')}
              </p>
              <p>
                {t('Положение, мм', 'Position, mm')}: [{part.at.join(', ')}] ·{' '}
                {t('Поворот, °', 'Rotation, °')}: [{part.rotation.join(', ')}]
              </p>
              <ol>
                {part.operations.map((operation) => (
                  <li key={operation.id}>
                    <strong>
                      {t(...types[operation.type])} · {operation.id}
                    </strong>
                    <p>{describe(operation)}</p>
                    {operation.type === 'extrude' && (
                      <p>
                        {t('Вершины контура', 'Contour vertices')}:{' '}
                        {operation.points.map((point) => `[${point.join(', ')}]`).join(' → ')}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>
      {spec.assumptions.length > 0 && (
        <div className="cad-proposal-notes">
          <h4>{t('Допущения в модели', 'Model assumptions')}</h4>
          <ul>
            {spec.assumptions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {spec.missing_geometry.length > 0 && (
        <div className="cad-proposal-notes">
          <h4>{t('Недостающая геометрия', 'Missing geometry')}</h4>
          <ul>
            {spec.missing_geometry.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="cad-proposal-json">
        <summary>
          <FileCode2 size={15} />
          {t('Посмотреть JSON предложения', 'View proposal JSON')}
        </summary>
        <pre role="region" tabIndex={0} aria-label={t('JSON предложения CAD', 'CAD proposal JSON')}>
          {JSON.stringify(spec, null, 2)}
        </pre>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = 'neofab-cad-proposal.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <ArrowDownToLine size={15} />
          {t('Скачать предложение JSON', 'Download proposal JSON')}
        </button>
      </details>
    </div>
  );
}

export default function CadAssistant({
  project,
  blocked,
  templateAttached,
  usage,
  onUsageChanged,
  onApplyingChange,
  onApplied,
}: Props) {
  const { t, lang, toast } = useApp();
  const [data, setData] = useState<CadProposalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [pendingRequest, setPendingRequest] = useState<{ key: string; id: string } | null>(null);
  const actionLock = useRef(false);
  const readSequence = useRef(0);
  const callbacks = useRef({ onUsageChanged, onApplyingChange, onApplied });
  callbacks.current = { onUsageChanged, onApplyingChange, onApplied };
  const base = `/studio/projects/${project.id}/cad`;
  const published = !!project.job_id;
  const key = JSON.stringify([project.version, message.trim()]);
  const retrying = pendingRequest?.key === key;
  const sharedUsage = usage ?? data?.usage;
  const remaining = data
    ? Math.max(0, data.ai.maxCallsPerProject - (sharedUsage?.projectCalls ?? 0))
    : 0;
  const acceptData = (next: CadProposalState, selectNewest = false) => {
    setData(next);
    callbacks.current.onUsageChanged?.(next.usage);
    setSelectedId((current) =>
      selectNewest || !next.proposals.some((proposal) => proposal.id === current)
        ? (next.proposals[0]?.id ?? '')
        : current,
    );
  };
  useEffect(() => {
    const sequence = ++readSequence.current;
    const controller = new AbortController();
    setLoading(true);
    setReviewed(false);
    api<CadProposalState>(base + '/proposals', { signal: controller.signal })
      .then((next) => {
        if (sequence === readSequence.current) {
          acceptData(next);
          setError('');
        }
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError' && sequence === readSequence.current)
          setError(errorText(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === readSequence.current) setLoading(false);
      });
    return () => controller.abort();
  }, [base, project.version, project.confirmed_hash, project.job_id]);
  useEffect(() => {
    setReviewed(false);
  }, [selectedId, blocked]);
  async function refreshData() {
    const sequence = ++readSequence.current;
    const next = await api<CadProposalState>(base + '/proposals');
    if (sequence === readSequence.current) {
      acceptData(next);
      setLoading(false);
    }
    return next;
  }
  async function assist(event: FormEvent) {
    event.preventDefault();
    if (
      actionLock.current ||
      published ||
      blocked ||
      templateAttached ||
      !data?.ai.configured ||
      !consent ||
      !message.trim() ||
      (!remaining && !retrying)
    )
      return;
    const request = retrying ? pendingRequest! : { key, id: crypto.randomUUID() };
    setPendingRequest(request);
    actionLock.current = true;
    setBusy('assist');
    setError('');
    setReviewed(false);
    ++readSequence.current;
    try {
      const next = await post<CadProposalState>(base + '/assist', {
        version: project.version,
        requestId: request.id,
        message: message.trim(),
        consent: true,
      });
      ++readSequence.current;
      acceptData(next, true);
      setLoading(false);
      setMessage('');
      setConsent(false);
      setPendingRequest(null);
      toast(
        t(
          'Предложение готово к проверке. Модель проекта пока не изменена.',
          'The proposal is ready for review. Your project model has not changed.',
        ),
      );
    } catch (reason) {
      const original = errorText(reason);
      // A lost response may follow a paid call. Refresh usage and retain the same request ID.
      try {
        await refreshData();
      } catch {
        /* Preserve the original failure and retry identity. */
      }
      setError(original);
    } finally {
      actionLock.current = false;
      setBusy('');
      setLoading(false);
    }
  }
  const selected =
    data?.proposals.find((proposal) => proposal.id === selectedId) ?? data?.proposals[0];
  const stale = !!selected && (selected.stale || selected.input_version !== project.version);
  const canApply =
    !!selected?.spec &&
    !selected.applied_version &&
    !stale &&
    !published &&
    !blocked &&
    !templateAttached &&
    !busy &&
    reviewed;
  async function applyProposal(proposal: CadProposal) {
    if (actionLock.current || !canApply) return;
    actionLock.current = true;
    setBusy('apply');
    setError('');
    callbacks.current.onApplyingChange(true);
    ++readSequence.current;
    try {
      const result = await post<{ project: StudioProject; cad: CadState }>(
        `${base}/proposals/${proposal.id}/apply`,
        { version: project.version, reviewed: true },
      );
      setData((current) =>
        current
          ? {
              ...current,
              proposals: current.proposals.map((item) =>
                item.id === proposal.id
                  ? { ...item, applied_version: result.project.version }
                  : item,
              ),
            }
          : current,
      );
      callbacks.current.onApplied(result);
      setReviewed(false);
      toast(
        t(
          'Предложение применено как новая версия CAD. Теперь можно построить геометрию.',
          'Proposal applied as a new CAD revision. You can now build its geometry.',
        ),
      );
    } catch (reason) {
      const original = errorText(reason);
      try {
        const latest = await refreshData();
        if (
          latest.proposals.some((item) => item.id === proposal.id && item.applied_version !== null)
        ) {
          // The mutation may have succeeded before the response was lost. Recover saved state.
          const [detail, cad] = await Promise.all([
            api<{ project: StudioProject }>(`/studio/projects/${project.id}`),
            api<CadState>(base),
          ]);
          callbacks.current.onApplied({ project: detail.project, cad });
          setReviewed(false);
          toast(
            t(
              'Сохранённое предложение восстановлено после потери ответа.',
              'The saved proposal was recovered after a lost response.',
            ),
          );
          return;
        }
      } catch {
        /* The apply error remains actionable. */
      }
      setError(original);
    } finally {
      callbacks.current.onApplyingChange(false);
      actionLock.current = false;
      setBusy('');
      setLoading(false);
    }
  }
  const proposalLabel = (proposal: CadProposal) =>
    `${t('ТЗ v', 'Brief v')}${proposal.input_version} · ${formatDate(proposal.created_at, lang)} · ${proposal.applied_version ? t('Применено', 'Applied') : proposal.stale || proposal.input_version !== project.version ? t('Предыдущая версия', 'Previous revision') : proposal.spec ? t('На проверке', 'For review') : t('Нужны уточнения', 'Needs clarification')}`;
  return (
    <section className="cad-assistant" aria-labelledby="cad-assistant-heading">
      <div className="cad-assistant-heading">
        <Sparkles size={19} />
        <div>
          <h3 id="cad-assistant-heading">
            {t('Предложение CAD с помощью ИИ', 'AI-assisted CAD proposal')}
          </h3>
          <p>
            {t(
              'Сначала параметры и вопросы. Применение модели и построение геометрии — отдельные действия.',
              'Review parameters and questions first. Applying the model and building geometry are separate actions.',
            )}
          </p>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading && !data && <Loading />}
      {!data && !loading && (
        <button
          type="button"
          className="button secondary"
          onClick={() => void refreshData().catch((reason) => setError(errorText(reason)))}
        >
          <RefreshCw size={15} />
          {t('Обновить предложения', 'Refresh proposals')}
        </button>
      )}
      {data && (
        <>
          {!data.ai.configured && (
            <div className="cad-assistant-off">
              <strong>{t('ИИ для CAD не подключён', 'CAD AI is not connected')}</strong>
              <p>
                {t(
                  'Редактор CAD, примеры, импорт JSON и сохранение работают без ИИ. Ранее полученные предложения можно просматривать и применять после проверки.',
                  'The CAD editor, examples, JSON import and saving work without AI. Previous proposals remain available to review and apply.',
                )}
              </p>
            </div>
          )}
          {published && (
            <p className="studio-help">
              {t(
                'Заявка опубликована: история предложений доступна для просмотра.',
                'The request is published: proposal history is available for review.',
              )}
            </p>
          )}
          {!published && data.ai.configured && (
            <form onSubmit={assist} className="cad-assistant-form">
              <p className="cad-ai-role">
                <span>{t('Роль: проектирование CAD', 'Role: CAD planning')}</span>
                <code>{data.ai.model}</code>
              </p>
              <label>
                {t('Что спроектировать или изменить?', 'What should be designed or changed?')}
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setConsent(false);
                  }}
                  rows={4}
                  maxLength={2000}
                  required
                  disabled={!!busy}
                  placeholder={t(
                    'Укажите известные размеры, расположение деталей, соединения и необходимые изменения. Если размеров нет, попросите сначала уточняющие вопросы.',
                    'Include known dimensions, component placement, joints and required changes. If dimensions are unknown, ask for clarification questions first.',
                  )}
                />
              </label>
              <p className="studio-help">
                {t(
                  'Каждая новая просьба отправляется вместе с сохранённым ТЗ и текущей CAD-моделью. История переписки не передаётся: включите необходимые уточнения в этот запрос.',
                  'Each new request includes the saved brief and current CAD model. Previous conversation is not sent: include the necessary clarifications in this request.',
                )}
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={!!busy || blocked || templateAttached}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  {t(
                    'Разрешаю отправить язык проекта, исходную идею, сохранённое ТЗ, текущую спецификацию CAD и этот запрос в OpenAI. Это обращение использует платный API.',
                    'I allow the project language, original idea, saved brief, current CAD specification and this request to be sent to OpenAI. This call uses a paid API.',
                  )}
                </span>
              </label>
              <p className="studio-help">
                {t('Осталось обращений в проекте: ', 'Calls remaining in this project: ')}
                <strong>{remaining}</strong>
                {t(' из ', ' of ')}
                {data.ai.maxCallsPerProject}
                {t(
                  '. Лимит общий с помощником ТЗ; также действуют суточные ограничения.',
                  '. This limit is shared with the brief assistant; daily limits also apply.',
                )}
              </p>
              {blocked && (
                <p className="studio-action-note">
                  {t(
                    'Сохраните или отмените правки ТЗ и CAD перед запросом к ИИ или применением предложения.',
                    'Save or discard brief and CAD edits before asking AI or applying a proposal.',
                  )}
                </p>
              )}
              {templateAttached && (
                <p className="studio-action-note">
                  {t(
                    'Для предложения CAD сначала отключите простой шаблон модели и сохраните ТЗ.',
                    'Before requesting CAD, remove the simple model template and save the brief.',
                  )}
                </p>
              )}
              <button
                type="submit"
                className="button"
                disabled={
                  !!busy ||
                  blocked ||
                  templateAttached ||
                  !consent ||
                  !message.trim() ||
                  (!remaining && !retrying)
                }
              >
                {busy === 'assist' ? (
                  <LoaderCircle size={16} className="studio-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {busy === 'assist'
                  ? t('Готовим предложение…', 'Preparing a proposal…')
                  : retrying
                    ? t('Получить результат CAD-попытки', 'Retrieve the CAD attempt result')
                    : t('Получить предложение CAD', 'Request a CAD proposal')}
              </button>
              {retrying && !busy && (
                <div className="cad-ai-retry">
                  <p className="studio-help">
                    {t(
                      'Повторное получение использует прежний идентификатор запроса и не создаёт новый платный вызов. Для новой попытки подготовьте отдельное обращение.',
                      'Retrieving uses the same request ID and does not start another paid call. Prepare a separate request for a new attempt.',
                    )}
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!remaining || blocked || templateAttached}
                    onClick={() => {
                      setPendingRequest(null);
                      setConsent(false);
                      setError('');
                    }}
                  >
                    {t('Подготовить новую CAD-попытку', 'Prepare a new CAD attempt')}
                  </button>
                </div>
              )}
            </form>
          )}
          {data.proposals.length > 0 && (
            <div className="cad-proposal-history">
              <label>
                {t('История предложений CAD', 'CAD proposal history')}
                <select
                  value={selected?.id ?? ''}
                  disabled={!!busy}
                  onChange={(event) => {
                    setSelectedId(event.target.value);
                    setReviewed(false);
                  }}
                >
                  {data.proposals.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposalLabel(proposal)}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <article className="cad-proposal" aria-labelledby="cad-proposal-heading">
                  <div className="cad-proposal-title">
                    <h4 id="cad-proposal-heading">
                      {t('Предложение для проверки', 'Proposal for review')}
                    </h4>
                    <span>{proposalLabel(selected)}</span>
                  </div>
                  <p>{selected.summary}</p>
                  {selected.applied_version ? (
                    <p className="cad-proposal-applied">
                      <CheckCircle2 size={16} />
                      {t('Применено в версии проекта ', 'Applied in project revision ')}
                      {selected.applied_version}
                    </p>
                  ) : (
                    stale && (
                      <p className="studio-action-note">
                        {t(
                          'Контекст проекта изменился. Это предложение можно просмотреть, но применять к текущей версии нельзя. Запросите новое предложение по сохранённым данным.',
                          'The project context changed. This proposal can be reviewed but cannot be applied to the current revision. Request a new proposal using the saved data.',
                        )}
                      </p>
                    )
                  )}
                  {selected.questions.length > 0 && (
                    <div className="cad-proposal-notes">
                      <h4>{t('Вопросы для уточнения', 'Clarification questions')}</h4>
                      <ul>
                        {selected.questions.map((question, index) => (
                          <li key={index}>{question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selected.spec ? (
                    <ProposalSpec spec={selected.spec} />
                  ) : (
                    <p className="cad-proposal-empty">
                      {t(
                        'Модель пока не предложена. Уточните данные в ТЗ или следующем запросе: применять здесь нечего.',
                        'No model has been proposed yet. Clarify the brief or include the missing data in your next request; there is no model to apply.',
                      )}
                    </p>
                  )}
                  {selected.spec && !selected.applied_version && !published && (
                    <div className="cad-proposal-apply">
                      <p className="studio-help">
                        {t(
                          'Применение заменит текущую CAD-спецификацию новой версией и снимет подтверждение ТЗ. После этого отдельно постройте геометрию и проверьте отчёт.',
                          'Applying replaces the current CAD specification with a new revision and clears brief confirmation. Then build the geometry separately and inspect its report.',
                        )}
                      </p>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={reviewed}
                          disabled={!!busy || blocked || templateAttached || stale}
                          onChange={(event) => setReviewed(event.target.checked)}
                        />
                        <span>
                          {t(
                            'Проверил размеры, положение компонентов, допущения и открытые вопросы этого предложения.',
                            'I reviewed this proposal’s dimensions, component positions, assumptions and open questions.',
                          )}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="button"
                        disabled={!canApply}
                        onClick={() => void applyProposal(selected)}
                      >
                        {busy === 'apply' ? (
                          <LoaderCircle size={16} className="studio-spin" />
                        ) : (
                          <ArrowDownToLine size={16} />
                        )}
                        {t('Применить предложение CAD', 'Apply CAD proposal')}
                      </button>
                      {blocked && (
                        <p className="studio-action-note">
                          {t(
                            'Сначала сохраните или отмените свои изменения. Они не будут заменены предложением.',
                            'Save or discard your edits first. The proposal will not replace them.',
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
