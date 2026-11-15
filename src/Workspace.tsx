import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowUpRight,
  Download,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Check,
  UserRound,
  Trash2,
} from 'lucide-react';
import {
  useApp,
  useRemote,
  post,
  ErrorBox,
  errorText,
  Loading,
  Empty,
  Status,
  formatMoney,
  formatDate,
} from './core';
import { PageTitle, JobCard } from './Browse';
import {
  technologies,
  technologyLabel,
  materialLabel,
  materials,
  type Job,
  type Profile,
  type Offer,
} from '../shared/types';
type Dashboard = {
  projects: Job[];
  offers: (Offer & { job_title: string; job_status: string; currency: string })[];
  direct: Job[];
  conversations: {
    id: string;
    job_id: string;
    title: string;
    owner_id: string;
    provider_name: string;
    unread: number;
  }[];
  profile: (Profile & { published: boolean }) | null;
  models: { id: string; title: string; license: string; published: number }[];
  blocks: { blocked_id: string; name: string }[];
};
function ProfileForm({ profile, done }: { profile: Profile | null; done: () => void }) {
  const { t, toast } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [tech, setTech] = useState<string[]>(profile?.technologies || ['FDM']),
    [mat, setMat] = useState<string[]>(profile?.materials || ['PLA']);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await post(
        '/profile',
        {
          name: form.get('name'),
          kind: form.get('kind'),
          city: form.get('city'),
          description: form.get('description'),
          technologies: tech,
          materials: mat,
          website: form.get('website'),
          lat: String(form.get('lat')).trim() ? Number(form.get('lat')) : null,
          lng: String(form.get('lng')).trim() ? Number(form.get('lng')) : null,
          remote: form.get('remote') === 'on',
        },
        'PUT',
      );
      toast(t('Профиль сохранён', 'Your profile was saved'));
      done();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const toggle = (array: string[], value: string, set: (values: string[]) => void) =>
    set(array.includes(value) ? array.filter((x) => x !== value) : [...array, value]);
  return (
    <form className="panel stack" onSubmit={save}>
      <h2>
        {profile
          ? t('Ваша страница в сообществе', 'Your place in the community')
          : t('Расскажите, что умеете.', 'Show us what you make.')}
      </h2>
      <p className="muted small">
        {t(
          'Аккаунт уже позволяет заказывать. Публичный профиль нужен, если вы хотите помогать другим как мастерская или инженер.',
          'You can already create projects. Add a public maker profile if you want to offer printing or engineering services.',
        )}
      </p>
      <div className="form-grid">
        <label>
          {t('Название мастерской или ваше имя', 'Workshop name or your name')}
          <input
            dir="auto"
            name="name"
            defaultValue={profile?.name}
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label>
          {t('Чем занимаетесь?', 'What do you offer?')}
          <select name="kind" defaultValue={profile?.kind || 'studio'}>
            <option dir="auto" value="studio">
              {t('Изготавливаю детали', 'Making & printing')}
            </option>
            <option dir="auto" value="engineer">
              {t('Проектирую модели', 'Design & engineering')}
            </option>
            <option dir="auto" value="both">
              {t('И проектирую, и изготавливаю', 'Both design and manufacturing')}
            </option>
          </select>
        </label>
        <label>
          {t('Город', 'City')}
          <input
            dir="auto"
            name="city"
            defaultValue={profile?.city}
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          {t('Сайт · необязательно', 'Website · optional')}
          <input
            dir="auto"
            name="website"
            type="url"
            placeholder="https://"
            defaultValue={profile?.website}
            maxLength={300}
          />
        </label>
      </div>
      <label>
        {t('О ваших возможностях', 'Tell us about your work')}
        <textarea
          dir="auto"
          rows={5}
          name="description"
          defaultValue={profile?.description}
          required
          minLength={30}
          maxLength={3000}
          placeholder={t(
            'Оборудование, опыт, размеры печати, примеры задач и то, что важно знать заказчику.',
            'Equipment, experience, build volume, typical projects, and what customers should know.',
          )}
        />
      </label>
      <fieldset className="choice-fieldset">
        <legend>{t('Технологии', 'Technologies')}</legend>
        <div className="row">
          {technologies.map((value) => (
            <label className="check-label" key={value}>
              <input
                dir="auto"
                type="checkbox"
                checked={tech.includes(value)}
                onChange={() => toggle(tech, value, setTech)}
              />
              {technologyLabel(value, t)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-fieldset">
        <legend>{t('Материалы', 'Materials')}</legend>
        <div className="row">
          {materials.map((value) => (
            <label className="check-label" key={value}>
              <input
                dir="auto"
                type="checkbox"
                checked={mat.includes(value)}
                onChange={() => toggle(mat, value, setMat)}
              />
              {value === 'Any'
                ? t('Консультирую по выбору', 'Material advice')
                : materialLabel(value, t)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="check-label">
        <input dir="auto" name="remote" type="checkbox" defaultChecked={profile?.remote} />
        {t('Работаю удалённо / отправляю заказы', 'Remote work / shipping available')}
      </label>
      <details>
        <summary className="small muted">
          {t(
            'Показать мастерскую на карте · необязательно',
            'Add your workshop to the map · optional',
          )}
        </summary>
        <div className="form-grid" style={{ marginTop: 18 }}>
          <label>
            {t('Широта', 'Latitude')}
            <input
              dir="auto"
              name="lat"
              type="number"
              min={-85}
              max={85}
              step="any"
              defaultValue={profile?.lat ?? ''}
            />
          </label>
          <label>
            {t('Долгота', 'Longitude')}
            <input
              dir="auto"
              name="lng"
              type="number"
              min={-180}
              max={180}
              step="any"
              defaultValue={profile?.lng ?? ''}
            />
          </label>
        </div>
        <p className="micro muted" style={{ marginTop: 12 }}>
          {t(
            'Эта точка станет публичной. Не указывайте домашний адрес, если не хотите его показывать.',
            'This location will be public. Don’t share your home location unless you want it visible.',
          )}
        </p>
      </details>
      <div className="info-box">
        {t(
          'Профиль будет виден участникам сразу. Значок проверки выдаёт модератор после своей проверки; при изменении данных его нужно получить заново.',
          'Your profile becomes public immediately. A moderator can review it and add a community review badge. Changing profile details resets this badge.',
        )}
      </div>
      <ErrorBox error={error} />
      <div>
        <button className="button" disabled={busy}>
          {busy ? t('Сохраняем…', 'Saving…') : t('Сохранить профиль', 'Save maker profile')}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
function AccountSettings({ data, reload }: { data: Dashboard; reload: () => void }) {
  const { t, user, demo, refresh, toast } = useApp(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      fields = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await post('/account/password', {
        current: fields.get('current'),
        password: fields.get('password'),
      });
      form.reset();
      toast(
        t(
          'Пароль изменён. Остальные сеансы завершены.',
          'Password changed. Other sessions were signed out.',
        ),
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    if (
      !confirm(
        t(
          'Обезличить аккаунт и удалить ваши модели и файлы? Это действие нельзя отменить.',
          'Anonymize your account and remove your models and files? This cannot be undone.',
        ),
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await post(
        '/account',
        { password: fields.get('delete-password'), confirm: 'DELETE' },
        'DELETE',
      );
      await refresh();
      navigate('/');
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="panel">
        <h2>{t('Ваши данные — под вашим контролем.', 'Your data, in your hands.')}</h2>
        <p className="muted small" style={{ margin: '15px 0 23px' }}>
          {user?.name} · {user?.email}
        </p>
        <div className="row">
          <a className="button secondary" href="/api/account/export" download>
            <Download size={15} />
            {t('Экспорт моих данных', 'Export my data')}
          </a>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await post('/auth/logout', {});
                await refresh();
                navigate('/');
              } catch (error) {
                setError(errorText(error));
              }
            }}
          >
            <LogOut size={15} />
            {t('Выйти', 'Sign out')}
          </button>
        </div>
      </div>
      {data.blocks.length > 0 && (
        <div className="panel">
          <h3>{t('Заблокированные участники', 'Blocked participants')}</h3>
          {data.blocks.map((b) => (
            <div className="between" style={{ marginTop: 15 }} key={b.blocked_id}>
              <span className="small">{b.name}</span>
              <button
                className="text-button"
                onClick={async () => {
                  await post('/blocks', { user_id: b.blocked_id, blocked: false });
                  reload();
                }}
              >
                {t('Разблокировать', 'Unblock')}
              </button>
            </div>
          ))}
        </div>
      )}
      <form className="panel stack" onSubmit={changePassword}>
        <h3>{t('Изменить пароль', 'Change your password')}</h3>
        <div className="form-grid">
          <label>
            {t('Текущий пароль', 'Current password')}
            <input
              dir="auto"
              name="current"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            {t('Новый пароль · от 12 символов', 'New password · at least 12 characters')}
            <input
              dir="auto"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        </div>
        <div>
          <button className="button secondary" disabled={busy || demo}>
            {t('Сохранить новый пароль', 'Save new password')}
          </button>
        </div>
      </form>
      <details className="panel">
        <summary className="small muted">{t('Удаление аккаунта', 'Remove account')}</summary>
        <p className="muted small" style={{ marginTop: 20 }}>
          {t(
            'Сначала завершите активные сделки. Публичный профиль и модели будут удалены из каталога, личные сообщения обезличены, доступ закрыт. Принятые условия и минимальная история сделок сохранятся у сторон. Скачанные другими участниками файлы отозвать нельзя.',
            'Finish active agreements first. Your public profile and models will be removed from the directory, your messages anonymized, and account access revoked. Accepted terms and minimal deal history remain with the parties. Files downloaded by others cannot be recalled.',
          )}
        </p>
        <form className="stack" style={{ marginTop: 20 }} onSubmit={remove}>
          <label>
            {t('Подтвердите паролем', 'Confirm with your password')}
            <input
              dir="auto"
              name="delete-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <div>
            <button className="button danger" disabled={busy || demo}>
              <Trash2 size={14} />
              {t('Обезличить и закрыть аккаунт', 'Anonymize & close account')}
            </button>
          </div>
        </form>
      </details>
      <ErrorBox error={error} />
      {demo && (
        <p className="info-box">
          {t(
            'Пароли и удаление вымышленных демо-аккаунтов недоступны. На чистом сервере эти функции работают с вашим паролем.',
            'Password changes and account removal are disabled for fictional demo accounts. On a clean instance, use your account password.',
          )}
        </p>
      )}
    </div>
  );
}
export default function Workspace() {
  const { t, user, lang, refresh, toast } = useApp(),
    [params, setParams] = useSearchParams(),
    remote = useRemote<Dashboard>('/dashboard', user?.id),
    [error, setError] = useState(''),
    tab = params.get('tab') || 'projects';
  const tabs = [
    ['projects', t('Мои проекты', 'My projects')],
    ['offers', t('Мои предложения', 'My offers')],
    ['messages', t('Сообщения', 'Messages')],
    ['profile', t('Профиль участника', 'Maker profile')],
    ['models', t('Мои модели', 'My models')],
    ['settings', t('Настройки', 'Settings')],
  ];
  if (remote.loading) return <Loading />;
  if (remote.error)
    return (
      <div className="page">
        <ErrorBox error={remote.error} retry={remote.reload} />
      </div>
    );
  const data = remote.data!;
  return (
    <div className="page">
      <PageTitle
        eyebrow={t('ВАША ЛИЧНАЯ МАСТЕРСКАЯ', 'YOUR PERSONAL WORKSPACE')}
        title={t('Привет, {name}.', 'Hello, {name}.', { name: user?.name.split(' · ')[0] || '' })}
        description={t(
          'Идеи, договорённости и разговоры — всё под рукой.',
          'Your ideas, agreements, and conversations, all in one place.',
        )}
      >
        <Link className="button" to="/projects/new">
          <Plus size={16} />
          {t('Новый проект', 'New project')}
        </Link>
      </PageTitle>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label={t('Разделы кабинета', 'Workspace sections')}
      >
        {tabs.map(([value, label]) => (
          <button
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'active' : ''}
            key={value}
            onClick={() => setParams({ tab: value })}
          >
            {label}
            {value === 'messages' && data.conversations.some((c) => c.unread > 0) ? ' •' : ''}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      {tab === 'projects' &&
        (data.projects.length ? (
          <div className="job-list">
            {data.projects.map((job) => (
              <div key={job.id}>
                <JobCard job={job} />
                <div style={{ padding: '0 22px 18px' }}>
                  <Status value={job.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={t('Всё начинается с вашей идеи', 'It starts with your idea')}
            description={t(
              'Опишите задачу, чтобы получить предложения от сообщества.',
              'Share a brief and receive offers from your community.',
            )}
          >
            <Link className="button" to="/projects/new">
              {t('Создать первый проект', 'Create your first project')}
              <Plus size={15} />
            </Link>
          </Empty>
        ))}
      {tab === 'offers' && (
        <>
          <h2 style={{ marginBottom: 20 }}>{t('Ваши предложения', 'Your offers')}</h2>
          {data.offers.length ? (
            data.offers.map((o) => (
              <div className="workspace-card" key={o.id}>
                <div className="between">
                  <h3>
                    <Link to={'/projects/' + o.job_id}>{o.job_title}</Link>
                  </h3>
                  <Status value={o.status} />
                </div>
                <p>
                  {formatMoney(o.price, o.currency, lang)} · {o.days} {t('дней', 'days')} · v
                  {o.revision}
                </p>
                <div className="row" style={{ marginTop: 15 }}>
                  <Link className="text-button" to={'/projects/' + o.job_id}>
                    {t('Открыть проект', 'View project')}
                    <ArrowUpRight className="directional-icon" size={15} />
                  </Link>
                  <Status value={o.job_status} />
                </div>
              </div>
            ))
          ) : (
            <Empty
              title={t('Здесь будут ваши отклики', 'Your next collaboration starts here')}
              description={t(
                'Добавьте профиль участника, найдите интересную задачу и предложите свои условия.',
                'Add your maker profile, find an interesting brief, and send an offer.',
              )}
            >
              <Link className="button secondary" to="/projects">
                {t('Найти задачу', 'Explore projects')}
                <ArrowUpRight className="directional-icon" size={15} />
              </Link>
            </Empty>
          )}
          {data.direct.length > 0 && (
            <>
              <h2 style={{ margin: '30px 0 20px' }}>
                {t('Запросы для вас', 'Direct requests for you')}
              </h2>
              <div className="job-list">
                {data.direct.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === 'messages' &&
        (data.conversations.length ? (
          data.conversations.map((c) => (
            <Link
              to={`/projects/${c.job_id}?thread=${c.id}`}
              className="workspace-card between"
              style={{ display: 'flex' }}
              key={c.id}
            >
              <div>
                <h3>{c.title}</h3>
                <p>
                  {c.owner_id === user?.id
                    ? c.provider_name
                    : t('Разговор с заказчиком', 'Conversation with customer')}
                </p>
              </div>
              <span className="row">
                {c.unread > 0 && (
                  <span className="status">
                    {c.unread} {t('новых', 'new')}
                  </span>
                )}
                <MessageSquare size={18} />
              </span>
            </Link>
          ))
        ) : (
          <Empty
            title={t('Здесь начнутся хорошие разговоры', 'Good conversations start here')}
            description={t(
              'Переписка появляется после первого вопроса или предложения по проекту.',
              'A private conversation opens when a maker asks a question or sends an offer.',
            )}
          />
        ))}
      {tab === 'profile' &&
        (data.profile && !data.profile.published ? (
          <div className="info-box warn">
            {t(
              'Ваш профиль скрыт модератором. Свяжитесь с владельцем сообщества для восстановления.',
              'Your profile was hidden by the moderator. Contact the instance operator to restore it.',
            )}
          </div>
        ) : (
          <ProfileForm
            profile={data.profile}
            done={() => {
              remote.reload();
              void refresh();
            }}
          />
        ))}
      {tab === 'models' && (
        <>
          <div className="between" style={{ marginBottom: 22 }}>
            <h2>{t('Ваш вклад в библиотеку', 'Your contribution to the library')}</h2>
            <Link className="button secondary small" to="/models?publish=1">
              <Plus size={15} />
              {t('Поделиться моделью', 'Share a model')}
            </Link>
          </div>
          {data.models.length ? (
            data.models.map((m) => (
              <div className="workspace-card" key={m.id}>
                <div className="between">
                  <h3>{m.title}</h3>
                  <span className="status">
                    {m.published
                      ? t('Опубликована', 'Published')
                      : t('На проверке', 'Pending review')}
                  </span>
                </div>
                <div className="between">
                  <span className="micro muted">{m.license}</span>
                  <button
                    className="text-button muted"
                    onClick={async () => {
                      if (
                        !confirm(
                          t(
                            'Снять модель с публикации и удалить запись? Уже скачанные файлы останутся у участников.',
                            'Remove this model? Existing downloads and license grants remain with their recipients.',
                          ),
                        )
                      )
                        return;
                      try {
                        await post('/models/' + m.id, {}, 'DELETE');
                        remote.reload();
                        void refresh();
                      } catch (error) {
                        setError(errorText(error));
                      }
                    }}
                  >
                    {t('Удалить модель', 'Remove model')}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title={t('Поделитесь полезной деталью', 'Share a useful design')}
              description={t(
                'Своя модель с понятной лицензией поможет другим участникам начать быстрее.',
                'An original model with a clear license helps other makers get started.',
              )}
            />
          )}
        </>
      )}
      {tab === 'settings' && <AccountSettings data={data} reload={remote.reload} />}
    </div>
  );
}
