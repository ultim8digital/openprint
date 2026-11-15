import JobCad from './JobCad';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Download,
  MessageSquare,
  Send,
  ShieldCheck,
  X,
  Check,
  Clock3,
  Paperclip,
  RefreshCw,
  Ban,
} from 'lucide-react';
import {
  useApp,
  useRemote,
  api,
  post,
  Loading,
  ErrorBox,
  errorText,
  formatMoney,
  formatDate,
  Status,
  Empty,
} from './core';
import { ReportButton } from './Browse';
import { minorUnits } from '../shared/validation';
import type { JobDetail, Offer, Job, Message } from '../shared/types';

function Conversation({
  id,
  closed,
  counterparty,
}: {
  id: string;
  closed: boolean;
  counterparty: string;
}) {
  const { t, user, toast } = useApp(),
    [messages, setMessages] = useState<Message[]>([]),
    [error, setError] = useState(''),
    [more, setMore] = useState(false),
    [blocked, setBlocked] = useState(false),
    [myBlock, setMyBlock] = useState(false),
    [body, setBody] = useState(''),
    [sending, setSending] = useState(false),
    [loaded, setLoaded] = useState(false);
  const list = useRef<HTMLDivElement>(null),
    sticky = useRef(true),
    maxId = useRef(0),
    reading = useRef(0),
    olderHeight = useRef<number | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      if (document.visibilityState !== 'visible') return;
      try {
        const data = await api<{
          messages: Message[];
          has_more: boolean;
          blocked: boolean;
          blocked_by_me: boolean;
        }>(`/conversations/${id}/messages${maxId.current ? '?after=' + maxId.current : ''}`, {
          signal: controller.signal,
        });
        if (!active) return;
        setBlocked(data.blocked);
        setMyBlock(data.blocked_by_me);
        if (!maxId.current) {
          setMessages(data.messages);
          setMore(data.has_more);
        } else if (data.messages.length)
          setMessages((previous) => [
            ...previous,
            ...data.messages.filter((m) => !previous.some((p) => p.id === m.id)),
          ]);
        if (data.messages.length) maxId.current = data.messages.at(-1)!.id;
        setLoaded(true);
        setError('');
      } catch (error) {
        if (active && !(error instanceof Error && error.name === 'AbortError'))
          setError(errorText(error));
      }
    }
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [id]);
  function mark() {
    const through = messages.at(-1)?.id;
    if (through && through > reading.current && document.visibilityState === 'visible') {
      reading.current = through;
      void post(`/conversations/${id}/read`, { through }).catch(() => {
        reading.current = 0;
      });
    }
  }
  useEffect(() => {
    if (!list.current) return;
    if (olderHeight.current !== null) {
      list.current.scrollTop = list.current.scrollHeight - olderHeight.current;
      olderHeight.current = null;
      return;
    }
    if (sticky.current) {
      list.current.scrollTop = list.current.scrollHeight;
      mark();
    }
  }, [messages]);
  async function earlier() {
    try {
      const data = await api<{ messages: Message[]; has_more: boolean }>(
        `/conversations/${id}/messages?before=${messages[0]?.id}`,
      );
      sticky.current = false;
      olderHeight.current = list.current?.scrollHeight ?? null;
      setMessages((previous) => [...data.messages, ...previous]);
      setMore(data.has_more);
    } catch (error) {
      setError(errorText(error));
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await post(`/conversations/${id}/messages`, { body });
      setBody('');
      sticky.current = true;
      const data = await api<{ messages: Message[] }>(
        `/conversations/${id}/messages?after=${maxId.current}`,
      );
      setMessages((previous) => [
        ...previous,
        ...data.messages.filter((m) => !previous.some((p) => p.id === m.id)),
      ]);
      if (data.messages.length) maxId.current = data.messages.at(-1)!.id;
    } catch (error) {
      setError(errorText(error));
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="conversation">
      <div className="between">
        <h3>
          <MessageSquare size={15} /> {t('Закрытая переписка', 'Private conversation')}
        </h3>
        <span className="micro muted">{t('Обновляется каждые 5 с', 'Updates every 5 s')}</span>
      </div>
      {more && (
        <button className="text-button full" onClick={() => void earlier()}>
          {t('Загрузить предыдущие сообщения', 'Load earlier messages')}
        </button>
      )}
      <div
        className="messages"
        ref={list}
        onScroll={() => {
          if (list.current) {
            sticky.current =
              list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 30;
            if (sticky.current) mark();
          }
        }}
      >
        {messages.map((m) => (
          <div key={m.id} className={'message' + (m.author_id === user?.id ? ' mine' : '')}>
            <small>
              {m.author_id === user?.id ? t('Вы', 'You') : m.author_name} ·{' '}
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </small>
            <p>{m.hidden ? t('Сообщение скрыто', 'Message hidden') : m.body}</p>
            {m.author_id !== user?.id && !m.hidden && (
              <ReportButton kind="message" target={String(m.id)} />
            )}
          </div>
        ))}
        {loaded && !messages.length && (
          <p className="micro muted">
            {t(
              'Уточните размеры, допуски и состав результата.',
              'Discuss dimensions, tolerances, and the expected deliverables.',
            )}
          </p>
        )}
      </div>
      <ErrorBox error={error} />
      {closed || blocked ? (
        <p className="info-box">
          {blocked
            ? t(
                'Общение заблокировано одним из участников. История сохранена.',
                'One participant has blocked contact. History remains available.',
              )
            : t(
                'Проект завершён. Переписка сохранена в архиве.',
                'This project is closed. The conversation is archived.',
              )}
        </p>
      ) : (
        <form onSubmit={send}>
          <label className="sr-only" htmlFor={'message-' + id}>
            {t('Сообщение', 'Message')}
          </label>
          <textarea
            id={'message-' + id}
            rows={2}
            minLength={1}
            maxLength={4000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('Обсудим детали…', 'Let’s discuss the details…')}
          />
          <button
            className="button"
            disabled={sending || !body.trim()}
            aria-label={t('Отправить сообщение', 'Send message')}
          >
            <Send size={17} />
          </button>
        </form>
      )}
      <button
        className="text-button muted"
        style={{ marginTop: 14 }}
        onClick={async () => {
          if (
            !myBlock &&
            !confirm(
              t('Заблокировать общение с этим участником?', 'Block contact with this participant?'),
            )
          )
            return;
          try {
            const updated = await post<{ blocked: boolean; blocked_by_me: boolean }>('/blocks', {
              user_id: counterparty,
              blocked: !myBlock,
            });
            setMyBlock(updated.blocked_by_me);
            setBlocked(updated.blocked);
            toast(t('Настройка общения сохранена', 'Contact preferences saved'));
          } catch (error) {
            setError(errorText(error));
          }
        }}
      >
        <Ban size={13} />
        {myBlock
          ? t('Снять мою блокировку', 'Remove my block')
          : t('Заблокировать общение', 'Block contact')}
      </button>
    </section>
  );
}
function AcceptDialog({
  offer,
  job,
  close,
  done,
}: {
  offer: Offer;
  job: Job;
  close: () => void;
  done: () => void;
}) {
  const { t, lang } = useApp(),
    dialog = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="notifications-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <div className="between">
        <h2>{t('Проверим условия.', 'Review the agreement.')}</h2>
        <button
          className="icon-button"
          onClick={close}
          disabled={busy}
          aria-label={t('Закрыть', 'Close')}
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 18 }}>
        {offer.profile_name} · {t('версия', 'revision')} {offer.revision}
      </p>
      <dl className="review-grid">
        <div>
          <dt>{t('За весь проект', 'For the whole project')}</dt>
          <dd>{formatMoney(offer.price, job.currency, lang)}</dd>
        </div>
        <div>
          <dt>{t('Срок после принятия', 'Lead time after acceptance')}</dt>
          <dd>
            {offer.days} {t('дней', 'days')}
          </dd>
        </div>
      </dl>
      <p className="prose small">{offer.note}</p>
      <div className="info-box">
        {t(
          'Эти цена, срок и описание сохранятся в условиях проекта. Исполнитель получит доступ к приложенному файлу. Оплату и доставку вы согласовываете напрямую: OpenPrint не принимает деньги.',
          'This price, lead time, and scope will be saved as your agreement. The provider will gain access to your attached file. Arrange payment and delivery directly; OpenPrint does not collect payments.',
        )}
      </div>
      <ErrorBox error={error} />
      <button
        className="button full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post(`/projects/${job.id}/accept`, {
              offer_id: offer.id,
              revision: offer.revision,
              version: job.version,
            });
            done();
          } catch (error) {
            setError(errorText(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t('Сохраняем…', 'Saving…') : t('Принять эти условия', 'Accept these terms')}
        <Check size={16} />
      </button>
    </dialog>
  );
}
function OfferForm({ job, offer, done }: { job: Job; offer?: Offer; done: () => void }) {
  const { t } = useApp(),
    [price, setPrice] = useState(offer ? String(offer.price / 100) : ''),
    [days, setDays] = useState(offer ? String(offer.days) : '3'),
    [note, setNote] = useState(offer?.note || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await post(`/projects/${job.id}/offers`, {
            price: minorUnits(price),
            days: Number(days),
            note,
          });
          done();
        } catch (error) {
          setError(errorText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label>
          {t('Цена за весь проект', 'Total project price')} · {job.currency}
          <input
            inputMode="decimal"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          {t('Срок, дней после принятия', 'Lead time, days after acceptance')}
          <input
            type="number"
            min={1}
            max={365}
            required
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
      </div>
      <label>
        {t('Что входит в предложение?', 'What does your offer include?')}
        <textarea
          rows={4}
          minLength={10}
          maxLength={2000}
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(
            'Материал, качество, количество, доставка и формат результата.',
            'Material, quality, quantity, delivery, and deliverable formats.',
          )}
        />
      </label>
      {offer && (
        <p className="micro muted">
          {t(
            'Новая версия заменит активное предложение. Ранее принятые условия изменить нельзя.',
            'A new revision replaces your active offer. Accepted terms cannot be changed.',
          )}
        </p>
      )}
      <ErrorBox error={error} />
      <button className="button" disabled={busy}>
        {busy
          ? t('Сохраняем…', 'Saving…')
          : offer
            ? t('Отправить новую версию', 'Send a new revision')
            : t('Отправить предложение', 'Send your offer')}
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
export default function Project() {
  const { id } = useParams(),
    { t, user, profile, lang, toast, refresh } = useApp(),
    [params, setParams] = useSearchParams(),
    remote = useRemote<JobDetail>('/projects/' + id, user?.id),
    [error, setError] = useState(''),
    [accepting, setAccepting] = useState<Offer | null>(null),
    [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false);
  async function done() {
    remote.reload();
    await refresh();
    setEdit(false);
    setAccepting(null);
  }
  async function action(action: string) {
    setBusy(true);
    try {
      await post(`/projects/${id}/status`, { action });
      await done();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  if (remote.loading) return <Loading />;
  if (remote.error)
    return (
      <div className="page">
        <ErrorBox error={remote.error} retry={remote.reload} />
        <Link className="text-button" to="/projects">
          ← {t('Все проекты', 'All projects')}
        </Link>
      </div>
    );
  const detail = remote.data!,
    { job, owner, assigned, offers } = detail,
    active = offers.filter((o) => o.status === 'active' || o.status === 'accepted'),
    ownOffer = offers.find((o) => o.provider_id === user?.id),
    thread = owner ? params.get('thread') || detail.conversations[0]?.id : detail.conversation_id;
  return (
    <div className="page">
      <Link className="back-link" to="/projects">
        ← {t('Биржа проектов', 'Project board')}
      </Link>
      <div className="project-title">
        <div>
          <span className="eyebrow">
            {t('ПРОЕКТ', 'PROJECT')} ·{' '}
            {job.visibility === 'direct'
              ? t('ЛИЧНЫЙ ЗАПРОС', 'DIRECT REQUEST')
              : t('ОТКРЫТАЯ ЗАДАЧА', 'OPEN BRIEF')}
          </span>
          <h1>{job.title}</h1>
          <p className="location">
            {job.city} · {formatDate(job.created_at, lang)}
          </p>
        </div>
        <Status value={job.status} />
      </div>
      <ErrorBox error={error} />
      {job.moderated && (
        <p className="info-box warn">
          {t(
            'Проект скрыт модератором. Свяжитесь с владельцем сообщества.',
            'This project has been hidden by the moderator. Contact the instance operator.',
          )}
        </p>
      )}
      <div className="project-layout">
        <div className="project-content">
          <section className="panel">
            <h2>{t('Задача', 'The brief')}</h2>
            <p className="prose">{job.description}</p>
            <div className="tags" style={{ marginTop: 22 }}>
              {[job.technology, job.material]
                .filter((s) => s !== 'Any')
                .map((s) => (
                  <span key={s}>{s}</span>
                ))}
            </div>
            {detail.file ? (
              <a
                className="button secondary small"
                style={{ marginTop: 20 }}
                href={'/api/files/' + detail.file.id}
                download
              >
                <Download size={15} />
                {detail.file.name} · {(detail.file.size / 1024).toFixed(0)} KB
              </a>
            ) : job.has_file ? (
              <p className="info-box">
                <Paperclip size={14} />{' '}
                {t(
                  'К проекту приложен файл. Он откроется выбранному исполнителю после принятия предложения.',
                  'A model is attached. The selected provider can access it after their offer is accepted.',
                )}
              </p>
            ) : null}
          </section>
          {user && (
            <JobCad
              key={`${job.id}:${user.id}`}
              jobId={job.id}
              owner={owner}
              revision={`${detail.conversations.length}:${job.accepted_offer_id || ''}:${job.status}`}
            />
          )}
          {job.accepted_terms && (
            <section className="panel agreement">
              <span className="eyebrow">
                <ShieldCheck size={14} />
                {t('СОГЛАСОВАННЫЕ УСЛОВИЯ', 'YOUR AGREEMENT')}
              </span>
              <h2 style={{ marginTop: 15 }}>{job.accepted_terms.profile_name}</h2>
              <dl className="review-grid">
                <div>
                  <dt>{t('Итоговая цена', 'Agreed total')}</dt>
                  <dd>
                    {formatMoney(job.accepted_terms.price, job.accepted_terms.currency, lang)}
                  </dd>
                </div>
                <div>
                  <dt>{t('Срок после принятия', 'Lead time after acceptance')}</dt>
                  <dd>
                    {job.accepted_terms.days} {t('дней', 'days')}
                  </dd>
                </div>
              </dl>
              <p className="prose small">{job.accepted_terms.note}</p>
              <div className="row" style={{ marginTop: 20 }}>
                {assigned && job.status === 'assigned' && (
                  <button className="button" disabled={busy} onClick={() => void action('deliver')}>
                    {t('Результат готов, передать заказчику', 'Mark delivery ready')}
                    <ArrowRight size={15} />
                  </button>
                )}
                {owner && job.status === 'delivered' && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void action('complete')}
                  >
                    {t('Результат получен, завершить', 'Confirm receipt & finish')}
                    <Check size={15} />
                  </button>
                )}
              </div>
              {job.status === 'delivered' && (
                <p className="info-box">
                  {t(
                    'Исполнитель отметил результат готовым. Заказчик проверяет работу и подтверждает завершение. Если есть вопросы, используйте переписку или жалобу модератору.',
                    'The provider has marked delivery ready. The customer reviews it and confirms completion. Discuss issues in the conversation or report them to a moderator.',
                  )}
                </p>
              )}
            </section>
          )}
          {owner && (
            <section className="panel">
              <h2>{t('Предложения участников', 'Offers from makers')}</h2>
              {active.length ? (
                active.map((o) => (
                  <div className="offer-card" key={o.id}>
                    <div className="between">
                      <Link className="offer-name" to={'/studios/' + o.profile_id}>
                        {o.profile_name} ↗
                      </Link>
                      <Status value={o.status} />
                    </div>
                    <div className="between" style={{ marginTop: 15 }}>
                      <span className="offer-price">
                        {formatMoney(o.price, job.currency, lang)}
                      </span>
                      <span className="micro muted">
                        {o.days} {t('дней', 'days')} · v{o.revision}
                      </span>
                    </div>
                    <p>{o.note}</p>
                    <div className="offer-actions">
                      <button
                        className="text-button"
                        onClick={() => setParams({ thread: o.conversation_id })}
                      >
                        <MessageSquare size={14} />
                        {t('Обсудить', 'Discuss')}
                      </button>
                      {job.status === 'open' && o.status === 'active' && (
                        <button className="button small" onClick={() => setAccepting(o)}>
                          {t('Выбрать предложение', 'Review offer')}
                          <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted small">
                  {t(
                    'Здесь появятся предложения с ценой, сроком и описанием результата.',
                    'Offers with a price, lead time, and scope will appear here.',
                  )}
                </p>
              )}
              {offers.filter((o) => !['active', 'accepted'].includes(o.status)).length > 0 && (
                <details style={{ marginTop: 20 }}>
                  <summary className="small muted">
                    {t(
                      'Предыдущие версии и закрытые предложения',
                      'Earlier revisions & closed offers',
                    )}
                  </summary>
                  {offers
                    .filter((o) => !['active', 'accepted'].includes(o.status))
                    .map((o) => (
                      <div className="offer-card" key={o.id}>
                        <div className="between">
                          <strong className="small">
                            {o.profile_name} · v{o.revision}
                          </strong>
                          <Status value={o.status} />
                        </div>
                        <p>
                          {formatMoney(o.price, job.currency, lang)} · {o.days} {t('дней', 'days')}
                        </p>
                        <p>{o.note}</p>
                      </div>
                    ))}
                </details>
              )}
            </section>
          )}
          {!owner && user && job.status === 'open' && !job.moderated && (
            <section className="panel">
              <h2>{t('Есть идея, как помочь?', 'Have a way to help?')}</h2>
              {!profile ? (
                <>
                  <p className="muted small">
                    {t(
                      'Добавьте профиль мастерской или инженера, чтобы отправлять предложения и задавать вопросы.',
                      'Add a workshop or engineer profile to send offers and ask questions.',
                    )}
                  </p>
                  <Link
                    className="button secondary"
                    style={{ marginTop: 20 }}
                    to="/workspace?tab=profile"
                  >
                    {t('Создать профиль', 'Create your maker profile')}
                    <ArrowUpRight size={16} />
                  </Link>
                </>
              ) : (
                <>
                  {ownOffer && !edit ? (
                    <div className="offer-card">
                      <div className="between">
                        <strong>
                          {formatMoney(ownOffer.price, job.currency, lang)} · {ownOffer.days}{' '}
                          {t('дней', 'days')}
                        </strong>
                        <Status value={ownOffer.status} />
                      </div>
                      <p>{ownOffer.note}</p>
                      <div className="row">
                        <button className="text-button" onClick={() => setEdit(true)}>
                          {t('Отправить новую версию', 'Send a new revision')}
                        </button>
                        {ownOffer.status === 'active' && (
                          <button
                            className="text-button muted"
                            onClick={async () => {
                              try {
                                await post(`/offers/${ownOffer.id}/withdraw`, {});
                                await done();
                              } catch (error) {
                                setError(errorText(error));
                              }
                            }}
                          >
                            {t('Отозвать', 'Withdraw')}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <OfferForm
                      key={ownOffer?.id}
                      job={job}
                      offer={ownOffer}
                      done={() => void done()}
                    />
                  )}
                  <button
                    className="text-button"
                    style={{ marginTop: 18 }}
                    onClick={async () => {
                      try {
                        const conversation = await post<{ id: string }>(
                          `/projects/${job.id}/conversation`,
                          {},
                        );
                        setParams({ thread: conversation.id });
                        remote.reload();
                      } catch (error) {
                        setError(errorText(error));
                      }
                    }}
                  >
                    <MessageSquare size={15} />
                    {t('Сначала задать вопрос', 'Ask a question first')}
                  </button>
                </>
              )}
            </section>
          )}
          {!user && job.status === 'open' && (
            <div className="panel">
              <h2>{t('Поможете сделать?', 'Can you help make it?')}</h2>
              <p className="muted small" style={{ margin: '12px 0 20px' }}>
                {t(
                  'Войдите, чтобы обсудить задачу или предложить свои условия.',
                  'Sign in to discuss the brief or send your offer.',
                )}
              </p>
              <Link className="button" to={`/login?next=/projects/${job.id}`}>
                {t('Присоединиться к проекту', 'Join this project')}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
          {owner && detail.conversations.length > 0 && (
            <div className="row" style={{ marginBottom: 15 }}>
              <label>
                {t('Переписка с участником', 'Conversation with')}
                <select
                  value={thread || ''}
                  onChange={(e) => setParams({ thread: e.target.value })}
                >
                  {detail.conversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.profile_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {thread && user && (
            <Conversation
              key={thread}
              id={thread}
              counterparty={
                owner
                  ? detail.conversations.find((c) => c.id === thread)?.provider_id || ''
                  : job.owner_id
              }
              closed={['completed', 'cancelled'].includes(job.status)}
            />
          )}
        </div>
        <aside className="project-aside">
          <div className="panel">
            <h3>{t('О проекте', 'Project details')}</h3>
            <dl className="project-facts" style={{ marginTop: 23 }}>
              {[
                [
                  t('Бюджет', 'Budget'),
                  job.budget
                    ? formatMoney(job.budget, job.currency, lang)
                    : t('По предложению', 'Open to quotes'),
                ],
                [t('Количество', 'Quantity'), job.quantity + ' ' + t('шт.', 'pcs')],
                [
                  t('Желаемая дата', 'Preferred date'),
                  job.deadline || t('Обсуждается', 'Flexible'),
                ],
                [
                  t('Технология', 'Technology'),
                  job.technology === 'Any' ? t('Нужен совет', 'Advice welcome') : job.technology,
                ],
                [
                  t('Материал', 'Material'),
                  job.material === 'Any' ? t('Нужен совет', 'Advice welcome') : job.material,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="info-box">
              {t(
                'Договаривайтесь о цене, доставке и формате результата до начала работ. Не публикуйте личные контакты в описании.',
                'Agree on price, shipping, and deliverables before starting. Keep personal contact details out of public briefs.',
              )}
            </div>
            {owner && job.status === 'open' && (
              <button
                className="text-button muted"
                disabled={busy}
                onClick={() => {
                  if (confirm(t('Отменить этот проект?', 'Cancel this project?')))
                    void action('cancel');
                }}
              >
                {t('Отменить проект', 'Cancel project')}
              </button>
            )}
            {user && <ReportButton kind="job" target={job.id} />}
          </div>
        </aside>
      </div>
      {accepting && (
        <AcceptDialog
          offer={accepting}
          job={job}
          close={() => setAccepting(null)}
          done={() => void done()}
        />
      )}
    </div>
  );
}
