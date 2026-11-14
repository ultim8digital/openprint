import { lazy, Suspense, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Search,
  Box,
  BriefcaseBusiness,
  Layers3,
  Store,
  Globe2,
  Clock3,
  Paperclip,
  ExternalLink,
  Flag,
} from 'lucide-react';
import {
  useApp,
  useRemote,
  Loading,
  ErrorBox,
  Empty,
  initials,
  formatMoney,
  formatDate,
  Status,
  post,
  errorText,
} from './core';
import { HeroArt } from './art';
import { technologies, technologyName, type Profile, type Job } from '../shared/types';
const CommunityMap = lazy(() => import('./CommunityMap'));
export function ProfileCard({ profile }: { profile: Profile }) {
  const { t } = useApp();
  return (
    <article className="profile-card">
      <div className="between">
        <span className={`studio-avatar color-${profile.name.length % 4}`}>
          {initials(profile.name)}
        </span>
        {profile.verified ? (
          <span
            className="verified"
            title={t('Проверен модератором сообщества', 'Reviewed by this community’s moderator')}
          >
            <ShieldCheck size={13} />
            {t('Проверен', 'Reviewed')}
          </span>
        ) : (
          <span className="micro muted">{t('Новый участник', 'New member')}</span>
        )}
      </div>
      <div>
        <span className="eyebrow">
          {profile.kind === 'engineer'
            ? t('ИНЖЕНЕР', 'ENGINEER')
            : profile.kind === 'both'
              ? t('ПРОИЗВОДСТВО И ПРОЕКТИРОВАНИЕ', 'MANUFACTURING & DESIGN')
              : t('МАСТЕРСКАЯ', 'WORKSHOP')}
        </span>
        <h3>
          <Link to={`/studios/${profile.id}`}>{profile.name}</Link>
        </h3>
        <p className="location">
          <MapPin size={13} />
          {profile.city}
          {profile.remote && (
            <>
              <span>·</span>
              {t('Удалённо', 'Remote')}
            </>
          )}
        </p>
      </div>
      <p className="card-description">{profile.description}</p>
      <div className="tags">
        {profile.technologies.slice(0, 4).map((s) => (
          <span key={s}>{t(technologyName(s, 'ru'), technologyName(s, 'en'))}</span>
        ))}
        {profile.materials
          .filter((m) => m !== 'Any')
          .slice(0, 2)
          .map((s) => (
            <span key={s}>{s}</span>
          ))}
      </div>
      <Link className="card-link" to={`/studios/${profile.id}`}>
        {t('Познакомиться', 'Meet the maker')}
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}
export function JobCard({ job, compact = false }: { job: Job; compact?: boolean }) {
  const { t, lang } = useApp();
  return (
    <article className={'job-card' + (compact ? ' compact' : '')}>
      <div className={`job-icon kind-${job.kind}`}>
        {job.kind === 'design' ? (
          <Layers3 size={22} />
        ) : job.kind === 'repair' ? (
          <Box size={22} />
        ) : (
          <BriefcaseBusiness size={22} />
        )}
      </div>
      <div className="job-main">
        <div className="job-top">
          <span className="eyebrow">
            {job.kind === 'design'
              ? t('ПРОЕКТИРОВАНИЕ', 'DESIGN')
              : job.kind === 'repair'
                ? t('РЕМОНТ ДЕТАЛИ', 'REPAIR')
                : t('ИЗГОТОВЛЕНИЕ', 'MANUFACTURING')}
          </span>
          <span className="micro muted">{formatDate(job.created_at, lang)}</span>
        </div>
        <h3>
          <Link to={`/projects/${job.id}`}>{job.title}</Link>
        </h3>
        {!compact && <p className="card-description">{job.description}</p>}
        <div className="job-meta">
          <span>
            <MapPin size={13} />
            {job.city}
          </span>
          {job.technology !== 'Any' && <span>{job.technology}</span>}
          {job.material !== 'Any' && <span>{job.material}</span>}
          <span>
            {job.quantity} {t('шт.', 'pcs')}
          </span>
          {job.has_file && <Paperclip size={13} />}
        </div>
      </div>
      <div className="job-side">
        <strong>
          {job.budget
            ? formatMoney(job.budget, job.currency, lang)
            : t('По договорённости', 'Open budget')}
        </strong>
        <span className="micro muted">
          {job.offers_count} {t('предложений', 'offers')}
        </span>
        <Link
          className="round-arrow"
          aria-label={t('Открыть проект', 'View project') + ': ' + job.title}
          to={`/projects/${job.id}`}
        >
          <ArrowUpRight size={19} />
        </Link>
      </div>
    </article>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Home() {
  const { t, stats } = useApp(),
    profiles = useRemote<{ profiles: Profile[] }>('/profiles?limit=3'),
    projects = useRemote<{ projects: Job[] }>('/projects?limit=3');
  return (
    <div className="page home">
      <div className="intro-row">
        <span className="eyebrow">
          <span className="online-dot" />
          {t('МЕСТО, ГДЕ ИДЕИ ОБРЕТАЮТ ФОРМУ', 'WHERE IDEAS TAKE SHAPE')}
        </span>
        <span className="micro muted">
          {t('Сделано сообществом. Для сообщества.', 'Made by the community. For the community.')}
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag">
            <Layers3 size={14} />
            {t('Открытая мастерская', 'The open workshop')}
          </span>
          <h1>
            {t('От идеи', 'From an idea')}
            <br />
            {t('к первой детали.', 'to something real.')}
            <span className="hero-star">✳</span>
          </h1>
          <p>
            {t(
              'Найдите мастерскую, соберите команду или создайте модель. Всё, чтобы ваша задумка стала настоящей вещью.',
              'Find a workshop, team up with an engineer, or build a model. Everything you need to bring your next idea to life.',
            )}
          </p>
          <div className="hero-actions">
            <Link className="button" to="/studio">
              {t('Создать с Neofab', 'Create with Neofab')}
              <Plus size={17} />
            </Link>
            <Link className="text-button" to="/studios">
              {t('Найти мастерскую', 'Find a workshop')}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-proof">
            <span className="mini-avatars" aria-hidden="true">
              <i>OP</i>
              <i>3D</i>
              <i>↗</i>
            </span>
            <span>
              {t(
                'Для любопытных, изобретателей и тех, кто делает.',
                'For the curious, the inventive, and the hands-on.',
              )}
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <HeroArt />
          <div className="floating-note">
            <span className="online-dot" />
            {t('Из цифры — в вещь', 'From pixels to a part')}
            <span>01 / 03</span>
          </div>
        </div>
      </section>
      <div className="neofab-entry">
        <div>
          <strong>Neofab Studio</strong>
          <p>
            {t(
              'От отдельной детали до мебели и сборки: назначение, размеры, состав изделия и маршрут изготовления в одном проекте.',
              'From a part to furniture and assemblies: purpose, dimensions, components and a manufacturing route in one project.',
            )}
          </p>
        </div>
        <Link className="text-button" to="/projects/new">
          {t('У меня уже есть ТЗ', 'I already have a brief')} <ArrowUpRight size={16} />
        </Link>
      </div>
      <section
        className="stats-strip"
        aria-label={t('Сообщество в цифрах', 'Community in numbers')}
      >
        {[
          [stats.profiles, t('мастерских и инженеров', 'workshops & engineers')],
          [stats.projects, t('открытых проектов', 'open projects')],
          [stats.models, t('открытых моделей', 'shared models')],
        ].map(([n, label]) => (
          <div key={String(label)}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
        <div className="stats-note">
          <span className="circle-icon">
            <Globe2 size={20} />
          </span>
          <span>
            {t('Открытый код.', 'Open source.')}
            <br />
            <strong>{t('Общие возможности.', 'Shared possibilities.')}</strong>
          </span>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>{t('С чего начнём?', 'What will you make?')}</h2>
          <span className="micro muted">
            {t(
              'Любая хорошая вещь начинается с маленького шага',
              'Good things start with one small step',
            )}
          </span>
        </div>
        <div className="start-grid">
          {[
            {
              to: '/studios',
              icon: Store,
              title: t('Найти своих', 'Find your people'),
              desc: t(
                'Мастерские и инженеры рядом или онлайн.',
                'Meet workshops and engineers, nearby or online.',
              ),
              label: t('Открыть каталог', 'Explore makers'),
            },
            {
              to: '/projects/new',
              icon: BriefcaseBusiness,
              title: t('Поставить задачу', 'Share your idea'),
              desc: t(
                'Опишите идею и сравните предложения.',
                'Describe your project and compare real offers.',
              ),
              label: t('Создать проект', 'Create a project'),
            },
            {
              to: '/tools',
              icon: Box,
              title: t('Сделать модель', 'Shape a part'),
              desc: t(
                'Проверьте свой файл или создайте деталь.',
                'Inspect a file or build a custom-size part.',
              ),
              label: t('В 3D-мастерскую', 'Open 3D tools'),
            },
          ].map((c, i) => (
            <Link className={`start-card start-${i}`} key={c.to} to={c.to}>
              <span className="start-icon">
                <c.icon size={22} />
              </span>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <span className="card-link">
                {c.label}
                <ArrowUpRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('СИЛА В ЛЮДЯХ', 'PEOPLE MAKE IT POSSIBLE')}</span>
            <h2>{t('Те, кто умеет делать', 'Meet the makers')}</h2>
          </div>
          <Link className="text-button" to="/studios">
            {t('Все участники', 'All makers')}
            <ArrowRight size={16} />
          </Link>
        </div>
        <ErrorBox error={profiles.error} retry={profiles.reload} />
        {profiles.loading ? (
          <Loading />
        ) : profiles.data?.profiles.length ? (
          <div className="profile-grid">
            {profiles.data.profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} />
            ))}
          </div>
        ) : (
          <Empty
            title={t('Будьте первым участником', 'Be the first maker')}
            description={t(
              'Добавьте мастерскую или профиль инженера — и помогите сообществу начать.',
              'Add your workshop or engineering profile and help this community grow.',
            )}
          >
            <Link className="button secondary" to="/workspace?tab=profile">
              {t('Добавить профиль', 'Add your profile')}
              <Plus size={15} />
            </Link>
          </Empty>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('ИДЕИ ИЩУТ РУКИ', 'IDEAS LOOKING FOR MAKERS')}</span>
            <h2>{t('Сейчас в работе сообщества', 'On the project board')}</h2>
          </div>
          <Link className="text-button" to="/projects">
            {t('Все проекты', 'All projects')}
            <ArrowRight size={16} />
          </Link>
        </div>
        <ErrorBox error={projects.error} retry={projects.reload} />
        {projects.loading ? (
          <Loading />
        ) : projects.data?.projects.length ? (
          <div className="job-list">
            {projects.data.projects.map((p) => (
              <JobCard key={p.id} job={p} compact />
            ))}
          </div>
        ) : (
          <Empty
            title={t('Здесь будет ваша следующая идея', 'Your next idea belongs here')}
            description={t(
              'Опубликуйте задачу для печати, проектирования или ремонта.',
              'Start a printing, design, or repair project.',
            )}
          >
            <Link className="button" to="/projects/new">
              {t('Создать проект', 'Start a project')}
            </Link>
          </Empty>
        )}
      </section>
      <section className="open-banner">
        <span className="open-banner-icon">
          <Layers3 size={37} />
        </span>
        <div>
          <span className="eyebrow">OPEN BY DESIGN</span>
          <h2>{t('Ваше сообщество. Ваши правила.', 'Your community. Your way.')}</h2>
          <p>
            {t(
              'OpenPrint можно запустить для города, мастерской или клуба. Код открыт, а знания становятся полезнее, когда ими делятся.',
              'Run OpenPrint for your city, workshop, or maker club. Open code, shared knowledge, and room for everyone.',
            )}
          </p>
        </div>
        <Link className="button secondary" to="/about">
          {t('О проекте', 'About OpenPrint')}
          <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}
export function Directory() {
  const { t } = useApp(),
    [params, setParams] = useSearchParams(),
    [map, setMap] = useState(false),
    [offset, setOffset] = useState(0);
  const query = new URLSearchParams(params);
  query.set('limit', '12');
  query.set('offset', String(offset));
  const remote = useRemote<{ profiles: Profile[]; has_more: boolean }>('/profiles?' + query);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
    setOffset(0);
  }
  return (
    <div className="page">
      <PageTitle
        eyebrow={t('ЛЮДИ И ВОЗМОЖНОСТИ', 'PEOPLE & POSSIBILITIES')}
        title={t('Найдите свою мастерскую.', 'Find your kind of maker.')}
        description={t(
          'От небольшой детали до сложной задумки — рядом есть тот, кто поможет.',
          'From a tiny replacement part to an ambitious idea, find someone who can help.',
        )}
      >
        <Link className="button" to="/workspace?tab=profile">
          <Plus size={17} />
          {t('Стать участником', 'Join as a maker')}
        </Link>
      </PageTitle>
      <div className="filter-panel">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label={t('Поиск мастерских', 'Search workshops')}
            placeholder={t('Название, город или специализация', 'Name, city, or specialty')}
            value={params.get('q') || ''}
            onChange={(e) => filter('q', e.target.value)}
          />
        </div>
        <div className="filter-row">
          <select
            aria-label={t('Тип участника', 'Maker type')}
            value={params.get('kind') || ''}
            onChange={(e) => filter('kind', e.target.value)}
          >
            <option value="">{t('Все участники', 'All makers')}</option>
            <option value="studio">{t('Мастерские', 'Workshops')}</option>
            <option value="engineer">{t('Инженеры', 'Engineers')}</option>
          </select>
          <select
            aria-label={t('Технология', 'Technology')}
            value={params.get('technology') || ''}
            onChange={(e) => filter('technology', e.target.value)}
          >
            <option value="">{t('Все технологии', 'All technologies')}</option>
            {technologies.map((s) => (
              <option key={s} value={s}>
                {t(technologyName(s, 'ru'), technologyName(s, 'en'))}
              </option>
            ))}
          </select>
          <label className="check-label">
            <input
              type="checkbox"
              checked={params.get('verified') === '1'}
              onChange={(e) => filter('verified', e.target.checked ? '1' : '')}
            />
            <ShieldCheck size={15} />
            {t('Проверены модератором', 'Moderator reviewed')}
          </label>
          <button
            className={'text-button map-toggle' + (map ? ' selected' : '')}
            onClick={() => setMap((v) => !v)}
          >
            <MapPin size={16} />
            {map ? t('Скрыть карту', 'Hide map') : t('Показать карту', 'Show map')}
          </button>
        </div>
      </div>
      {map && (
        <div className="map-section">
          <p className="micro muted">
            {t(
              'Карта текущей страницы результатов. Тайлы OpenStreetMap загружаются только при открытии карты.',
              'Map of this results page. OpenStreetMap tiles load only when you open the map.',
            )}
          </p>
          <Suspense fallback={<Loading />}>
            <CommunityMap profiles={remote.data?.profiles || []} />
          </Suspense>
        </div>
      )}
      <div className="results-bar">
        <span>{t('Мастерские и независимые инженеры', 'Workshops and independent engineers')}</span>
        <span className="micro">
          <span className="online-dot" />
          {t('Профили ведут сами участники', 'Profiles maintained by makers')}
        </span>
      </div>
      <ErrorBox error={remote.error} retry={remote.reload} />
      {remote.loading ? (
        <Loading />
      ) : remote.data?.profiles.length ? (
        <div className="profile-grid">
          {remote.data.profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      ) : (
        <Empty
          title={t('Пока не нашли совпадений', 'No makers found yet')}
          description={t(
            'Попробуйте другой город или технологию. Можно создать проект — участники сами предложат помощь.',
            'Try another city or technology, or post a project so makers can offer to help.',
          )}
        >
          <Link className="button secondary" to="/projects/new">
            {t('Создать проект', 'Create a project')}
          </Link>
        </Empty>
      )}
      <div className="pagination">
        {offset > 0 && (
          <button
            className="button secondary"
            onClick={() => setOffset((v) => Math.max(0, v - 12))}
          >
            {t('Назад', 'Previous')}
          </button>
        )}
        {remote.data?.has_more && (
          <button className="button secondary" onClick={() => setOffset((v) => v + 12)}>
            {t('Следующая страница', 'Next page')}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
export function ProfilePage() {
  const { id } = useParams(),
    { t, user, toast } = useApp(),
    remote = useRemote<{ profile: Profile }>('/profiles/' + id);
  if (remote.loading) return <Loading />;
  if (remote.error)
    return (
      <div className="page">
        <ErrorBox error={remote.error} retry={remote.reload} />
      </div>
    );
  const p = remote.data!.profile;
  return (
    <div className="page narrow">
      <Link className="back-link" to="/studios">
        ← {t('Все мастерские', 'All makers')}
      </Link>
      <section className="panel profile-detail">
        <div className="between">
          <span className={`studio-avatar large color-${p.name.length % 4}`}>
            {initials(p.name)}
          </span>
          {p.verified && (
            <span className="verified">
              <ShieldCheck size={15} />
              {t('Проверен модератором', 'Moderator reviewed')}
            </span>
          )}
        </div>
        <span className="eyebrow">
          {p.kind === 'engineer' ? t('ИНЖЕНЕР', 'ENGINEER') : t('МАСТЕРСКАЯ', 'WORKSHOP')}
        </span>
        <h1>{p.name}</h1>
        <p className="location">
          <MapPin size={15} />
          {p.city}
          {p.remote && <span>· {t('Работает удалённо', 'Works remotely')}</span>}
        </p>
        <p className="prose">{p.description}</p>
        <h3>{t('Технологии и материалы', 'Technologies & materials')}</h3>
        <div className="tags">
          {[...p.technologies, ...p.materials.filter((x) => x !== 'Any')].map((tag, i) => (
            <span key={tag + i}>{tag}</span>
          ))}
        </div>
        <div className="detail-actions">
          {p.user_id !== user?.id && (
            <Link
              className="button"
              to={`/projects/new?target=${p.id}&kind=${p.kind === 'engineer' ? 'design' : 'print'}`}
            >
              {t('Обсудить проект', 'Discuss a project')}
              <ArrowUpRight size={17} />
            </Link>
          )}
          {p.website && (
            <a className="button secondary" target="_blank" rel="noreferrer" href={p.website}>
              {t('Сайт участника', 'Maker website')}
              <ExternalLink size={15} />
            </a>
          )}
          {p.lat !== null && p.lng !== null && (
            <a
              className="text-button"
              target="_blank"
              rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=14/${p.lat}/${p.lng}`}
            >
              <MapPin size={15} />
              {t('На карте', 'View on map')}
            </a>
          )}
        </div>
        <div className="info-box">
          {t(
            'Профиль создан участником. Проверка модератором подтверждает профиль внутри сообщества и не гарантирует качество работ. Уточните условия до выбора исполнителя.',
            'Profiles are maintained by their makers. Moderator review is a community check, not a quality guarantee. Agree on details before choosing a provider.',
          )}
        </div>
        {user && <ReportButton kind="profile" target={p.id} />}
      </section>
    </div>
  );
}
export function ReportButton({
  kind,
  target,
}: {
  kind: 'profile' | 'job' | 'model' | 'message';
  target: string;
}) {
  const { t, toast } = useApp(),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return open ? (
    <form
      className="report-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await post('/reports', { kind, target_id: target, reason });
          setOpen(false);
          toast(t('Модератор получит вашу жалобу', 'Your report was sent to the moderator'));
        } catch (error) {
          setError(errorText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {t('Что произошло?', 'What happened?')}
        <textarea
          minLength={10}
          maxLength={2000}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </label>
      <ErrorBox error={error} />
      <div className="row">
        <button className="button small secondary" disabled={busy}>
          {t('Отправить жалобу', 'Send report')}
        </button>
        <button className="text-button" type="button" onClick={() => setOpen(false)}>
          {t('Отмена', 'Cancel')}
        </button>
      </div>
    </form>
  ) : (
    <button className="text-button muted small" onClick={() => setOpen(true)}>
      <Flag size={13} />
      {t('Сообщить о проблеме', 'Report a concern')}
    </button>
  );
}
export function Projects() {
  const { t } = useApp(),
    [params, setParams] = useSearchParams(),
    [offset, setOffset] = useState(0);
  const q = new URLSearchParams(params);
  q.set('limit', '12');
  q.set('offset', String(offset));
  const remote = useRemote<{ projects: Job[]; has_more: boolean }>('/projects?' + q);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
    setOffset(0);
  }
  return (
    <div className="page">
      <PageTitle
        eyebrow={t('ОТ ЗАДАЧИ К РЕЗУЛЬТАТУ', 'FROM AN IDEA TO A FINISHED PART')}
        title={t('Хорошие идеи ищут руки.', 'Good ideas need good hands.')}
        description={t(
          'Откликайтесь на задачи, обсуждайте детали и создавайте полезные вещи вместе.',
          'Find projects, discuss the details, and make something useful together.',
        )}
      >
        <Link className="button" to="/projects/new">
          <Plus size={17} />
          {t('Создать проект', 'Create a project')}
        </Link>
      </PageTitle>
      <div className="filter-panel">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label={t('Поиск проектов', 'Search projects')}
            placeholder={t('Что хотите сделать?', 'What would you like to make?')}
            value={params.get('q') || ''}
            onChange={(e) => change('q', e.target.value)}
          />
        </div>
        <div className="filter-row">
          <div className="pills">
            {[
              ['', t('Все проекты', 'All projects')],
              ['print', t('Изготовление', 'Manufacturing')],
              ['design', t('Проектирование', 'Design')],
              ['repair', t('Ремонт деталей', 'Repair')],
            ].map(([value, label]) => (
              <button
                className={(params.get('kind') || '') === value ? 'active' : ''}
                key={value}
                onClick={() => change('kind', value)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            aria-label={t('Город проекта', 'Project city')}
            placeholder={t('Любой город', 'Any city')}
            value={params.get('city') || ''}
            onChange={(e) => change('city', e.target.value)}
            className="city-filter"
          />
        </div>
      </div>
      <ErrorBox error={remote.error} retry={remote.reload} />
      {remote.loading ? (
        <Loading />
      ) : remote.data?.projects.length ? (
        <div className="job-list">
          {remote.data.projects.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <Empty
          title={t('Станьте началом чего-то хорошего', 'Start something good')}
          description={t(
            'Таких проектов пока нет. Измените фильтры или опубликуйте свою идею.',
            'No matching projects yet. Try different filters or share your own idea.',
          )}
        >
          <Link className="button" to="/projects/new">
            {t('Создать проект', 'Create a project')}
          </Link>
        </Empty>
      )}
      <div className="pagination">
        {offset > 0 && (
          <button
            className="button secondary"
            onClick={() => setOffset((v) => Math.max(0, v - 12))}
          >
            {t('Назад', 'Previous')}
          </button>
        )}
        {remote.data?.has_more && (
          <button className="button secondary" onClick={() => setOffset((v) => v + 12)}>
            {t('Дальше', 'Next page')}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
