import { localeTag } from '../shared/locales';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Check, EyeOff, Eye, ArrowUpRight } from 'lucide-react';
import { useApp, useRemote, post, Loading, ErrorBox, errorText, Empty } from './core';
import { PageTitle } from './Browse';
import type { Profile } from '../shared/types';
type AdminData = {
  profiles: (Profile & { published: boolean })[];
  models: {
    id: string;
    title: string;
    description: string;
    file_id: string | null;
    license: string;
    published: number;
    attribution: string;
    author_name: string;
  }[];
  reports: {
    id: string;
    kind: string;
    target_id: string;
    reason: string;
    target_preview: string;
  }[];
  events: { action: string; created_at: number }[];
};
export default function Admin() {
  const { t, lang, user, toast, refresh } = useApp(),
    [tab, setTab] = useState('profiles'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    remote = useRemote<AdminData>(user?.role === 'admin' ? '/admin' : null);
  async function action(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await post(path, body);
      remote.reload();
      await refresh();
      toast(t('Решение сохранено', 'Moderation decision saved'));
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  if (user?.role !== 'admin')
    return (
      <div className="page">
        <Empty
          title={t('Здесь работает модератор', 'A place for the community moderator')}
          description={t(
            'Права администратора выдаёт владелец сервера.',
            'Administrator access is granted by the instance operator.',
          )}
        />
      </div>
    );
  if (remote.loading) return <Loading />;
  return (
    <div className="page">
      <PageTitle
        eyebrow={t('ЗАБОТА О СООБЩЕСТВЕ', 'LOOKING AFTER THE COMMUNITY')}
        title={t('Доверие начинается с деталей.', 'Trust starts with the details.')}
        description={t(
          'Проверяйте профили, права на модели и обращения участников. Ваши решения сохраняются в журнале.',
          'Review maker profiles, model rights, and member reports. Moderation decisions are recorded.',
        )}
      />
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label={t('Разделы модерации', 'Moderation sections')}
      >
        {[
          ['profiles', t('Участники', 'Makers')],
          ['models', t('Модели', 'Models')],
          ['reports', t('Жалобы', 'Reports')],
          ['events', t('Журнал', 'Activity')],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? 'active' : ''}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorBox error={error || remote.error} retry={remote.reload} />
      {tab === 'profiles' && (
        <>
          <p className="info-box">
            {t(
              'Значок означает вашу проверку профиля, а не сертификацию качества. Согласуйте внутри сообщества, как вы проверяете мастерские: сайт, контакты, подтверждение владельца.',
              'A badge means you have reviewed the profile, not certified the quality. Define your community’s process: website, contacts, and ownership verification.',
            )}
          </p>
          {remote.data?.profiles.map((p) => (
            <div className="workspace-card" key={p.id}>
              <div className="between">
                <div>
                  <h3 dir="auto">{p.name}</h3>
                  <p>
                    {p.city} · {p.kind}
                  </p>
                </div>
                <span className="status">
                  {!p.published
                    ? t('Скрыт', 'Hidden')
                    : p.verified
                      ? t('Проверен', 'Reviewed')
                      : t('Самостоятельный профиль', 'Self-declared')}
                </span>
              </div>
              <p>{p.description}</p>
              <div className="row" style={{ marginTop: 17 }}>
                <Link className="text-button" to={'/studios/' + p.id}>
                  {t('Открыть профиль', 'View profile')}
                  <ArrowUpRight className="directional-icon" size={13} />
                </Link>
                <button
                  className="button small secondary"
                  disabled={busy}
                  onClick={() =>
                    void action('/admin/profiles/' + p.id, {
                      verified: !p.verified,
                      published: true,
                    })
                  }
                >
                  <ShieldCheck size={14} />
                  {p.verified
                    ? t('Снять проверку', 'Remove badge')
                    : t('Профиль проверен', 'Mark reviewed')}
                </button>
                <button
                  className="text-button muted"
                  disabled={busy}
                  onClick={() =>
                    void action('/admin/profiles/' + p.id, {
                      verified: false,
                      published: !p.published,
                    })
                  }
                >
                  {p.published ? <EyeOff size={14} /> : <Eye size={14} />}{' '}
                  {p.published ? t('Скрыть', 'Hide') : t('Вернуть', 'Restore')}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {tab === 'models' &&
        (remote.data?.models.length ? (
          remote.data.models.map((m) => (
            <div className="workspace-card" key={m.id}>
              <div className="between">
                <h3>{m.title}</h3>
                <span className="status">
                  {m.published
                    ? t('Опубликована', 'Published')
                    : t('На проверке', 'Pending review')}
                </span>
              </div>
              <p>
                {m.author_name} · {m.attribution} · {m.license}
              </p>
              <p>{m.description}</p>
              {m.file_id && (
                <a className="text-button" href={'/api/admin/models/' + m.id + '/file'} download>
                  {t('Скачать файл для проверки', 'Download for review')} ↗
                </a>
              )}
              <p className="micro muted" style={{ marginTop: 10 }}>
                {t(
                  'Перед публикацией проверьте описание и заявленные права автора. Скачайте файл для проверки; запросите исходник или подтверждение при сомнении.',
                  'Review the description and creator’s rights before publishing. Download the file to review it; ask for source files or evidence if needed.',
                )}
              </p>
              <button
                className="button secondary small"
                style={{ marginTop: 17 }}
                disabled={busy}
                onClick={() => void action('/admin/models/' + m.id, { published: !m.published })}
              >
                {m.published ? <EyeOff size={14} /> : <Check size={14} />}{' '}
                {m.published
                  ? t('Снять с публикации', 'Unpublish')
                  : t('Разрешить публикацию', 'Approve publication')}
              </button>
            </div>
          ))
        ) : (
          <Empty
            title={t('Пока нет моделей на проверку', 'No models to review')}
            description={t(
              'Новые работы участников появятся здесь.',
              'New member designs will appear here.',
            )}
          />
        ))}
      {tab === 'reports' &&
        (remote.data?.reports.length ? (
          remote.data.reports.map((r) => (
            <form
              className="workspace-card stack"
              key={r.id}
              onSubmit={(e) => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget);
                void action('/admin/reports/' + r.id, {
                  resolution: fields.get('resolution'),
                  hide: fields.get('hide') === 'on',
                });
              }}
            >
              <div className="between">
                <h3>{t('Обращение участника', 'Member report')}</h3>
                <span className="status">{r.kind}</span>
              </div>
              <p className="prose small">{r.reason}</p>
              <details>
                <summary className="small muted">
                  {t('Содержание, на которое пожаловались', 'Reported content')}
                </summary>
                <p className="prose small" style={{ marginTop: 12 }}>
                  {r.target_preview ||
                    t('Содержимое уже удалено', 'This content was already removed')}
                </p>
              </details>
              <label>
                {t('Решение и пояснение', 'Decision & explanation')}
                <textarea
                  dir="auto"
                  name="resolution"
                  rows={2}
                  minLength={5}
                  maxLength={1000}
                  required
                />
              </label>
              <label className="check-label">
                <input dir="auto" type="checkbox" name="hide" />
                {t(
                  'Скрыть содержимое из публичного доступа / переписки',
                  'Hide the reported content from its audience',
                )}
              </label>
              <div>
                <button className="button secondary small" disabled={busy}>
                  <Check size={14} />
                  {t('Закрыть обращение', 'Resolve report')}
                </button>
              </div>
            </form>
          ))
        ) : (
          <Empty
            title={t('Здесь спокойно', 'All quiet here')}
            description={t(
              'Открытых жалоб нет. Спасибо, что заботитесь о сообществе.',
              'There are no open reports. Thanks for looking after the community.',
            )}
          />
        ))}
      {tab === 'events' && (
        <section className="panel stack">
          {remote.data?.events.map((event, i) => (
            <div className="between" key={i}>
              <code className="small muted">{event.action}</code>
              <span className="micro muted">
                {new Date(event.created_at).toLocaleString(localeTag(lang))}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
