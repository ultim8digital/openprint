import { localeTag } from '../shared/locales';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
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
  api,
} from './core';
import { HeroArt } from './art';
import {
  technologies,
  technologyLabel,
  materialLabel,
  type Profile,
  type Job,
} from '../shared/types';
import type {
  CatalogStudio,
  DirectoryResponse,
  DirectoryMapPoint,
  DirectoryMapResponse,
} from '../shared/directory';
const CommunityMap = lazy(() => import('./CommunityMap'));
const emptyMapPoints: DirectoryMapPoint[] = [];
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
      <p className="card-description" dir="auto">
        {profile.description}
      </p>
      <div className="tags">
        {profile.technologies.slice(0, 4).map((s) => (
          <span key={s}>{technologyLabel(s, t)}</span>
        ))}
        {profile.materials
          .filter((m) => m !== 'Any')
          .slice(0, 2)
          .map((s) => (
            <span key={s}>{materialLabel(s, t)}</span>
          ))}
      </div>
      <Link className="card-link" to={`/studios/${profile.id}`}>
        {t('Познакомиться', 'Meet the maker')}
        <ArrowUpRight className="directional-icon" size={17} />
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
        {!compact && (
          <p className="card-description" dir="auto">
            {job.description}
          </p>
        )}
        <div className="job-meta">
          <span>
            <MapPin size={13} />
            {job.city}
          </span>
          {job.technology !== 'Any' && <span>{technologyLabel(job.technology, t)}</span>}
          {job.material !== 'Any' && <span>{materialLabel(job.material, t)}</span>}
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
          aria-label={t('Открыть проект: {title}', 'View project: {title}', { title: job.title })}
          to={`/projects/${job.id}`}
        >
          <ArrowUpRight className="directional-icon" size={19} />
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
              <ArrowUpRight className="directional-icon" size={17} />
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
          {t('У меня уже есть ТЗ', 'I already have a brief')}{' '}
          <ArrowUpRight className="directional-icon" size={16} />
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
                <ArrowUpRight className="directional-icon" size={16} />
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
            <ArrowRight className="directional-icon" size={16} />
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
            <ArrowRight className="directional-icon" size={16} />
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
          <span className="eyebrow">{t('ОТКРЫТО ПО ЗАМЫСЛУ', 'OPEN BY DESIGN')}</span>
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
          <ArrowUpRight className="directional-icon" size={16} />
        </Link>
      </section>
    </div>
  );
}
function safeCatalogLink(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function catalogLocation(studio: CatalogStudio) {
  return [...new Set([studio.city, studio.region, studio.country].filter(Boolean))].join(', ');
}

function CatalogCard({ studio }: { studio: CatalogStudio }) {
  const { t } = useApp();
  return (
    <article className="profile-card catalog-card">
      <div className="between">
        <span className={`studio-avatar color-${studio.name.length % 4}`}>
          {initials(studio.name)}
        </span>
        <span className="catalog-label">
          {studio.listing_type === 'self-published'
            ? t('Самостоятельная публикация', 'Self-published')
            : t('Справочная запись', 'Directory listing')}
        </span>
      </div>
      <div>
        <span className="eyebrow">{t('КАТАЛОГ СТУДИЙ', 'STUDIO DIRECTORY')}</span>
        <h3>
          <Link to={`/catalog/${studio.id}`}>{studio.name}</Link>
        </h3>
        <p className="location">
          <MapPin size={13} />
          {catalogLocation(studio) || t('Город не указан', 'City not specified')}
        </p>
      </div>
      <p className="card-description">
        {studio.description ||
          t(
            'Сведения об организации из каталога. Контакты и возможности уточняйте у студии.',
            'An organization listed in the directory. Confirm contacts and capabilities with the studio.',
          )}
      </p>
      <div className="tags">
        {studio.technologies.slice(0, 4).map((technology) => (
          <span key={technology}>{technologyLabel(technology, t)}</span>
        ))}
        {studio.lat === null || studio.lng === null ? (
          <span>{t('Без точки на карте', 'No map location')}</span>
        ) : null}
      </div>
      <p className="micro muted catalog-source">
        {t('Источник', 'Source')}:{' '}
        {studio.listing_type === 'self-published'
          ? t('Самостоятельная публикация', 'Self-published')
          : studio.source_name}
      </p>
      <Link className="card-link" to={`/catalog/${studio.id}`}>
        {t('Контакты студии', 'Studio contacts')}
        <ArrowUpRight className="directional-icon" size={17} />
      </Link>
    </article>
  );
}

// Tag results with their request path so a changed filter never displays stale labels or points.
function useDirectoryRemote<T>(path: string | null) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    path: string;
    data: T | null;
    error: string;
    loading: boolean;
  } | null>(null);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({ path, data: null, error: '', loading: true });
    void api<T>(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ path, data, error: '', loading: false });
      },
      (error) => {
        if (!controller.signal.aborted)
          setState({ path, data: null, error: errorText(error), loading: false });
      },
    );
    return () => controller.abort();
  }, [path, revision]);
  return {
    data: state?.path === path ? state.data : null,
    error: state?.path === path ? state.error : '',
    loading: !!path && (state?.path !== path || state.loading),
    reload,
  };
}

export function Directory() {
  const { t, mode, mapTiles } = useApp(),
    [params, setParams] = useSearchParams();
  const map = params.get('view') === 'map';
  const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);
  const filters = new URLSearchParams();
  for (const key of mode === 'catalog'
    ? ['q', 'city', 'technology']
    : ['source', 'q', 'city', 'technology', 'kind']) {
    const value = params.get(key);
    if (value) filters.set(key, value);
  }
  if (mode === 'catalog') filters.set('source', 'catalog');
  const query = new URLSearchParams(filters);
  query.set('limit', '12');
  query.set('offset', String(offset));
  const remote = useDirectoryRemote<DirectoryResponse>('/directory?' + query);
  const mapRemote = useDirectoryRemote<DirectoryMapResponse>(
    map ? '/directory/map?' + filters : null,
  );
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete('offset');
    next.delete('verified');
    setParams(next);
  }
  function page(nextOffset: number) {
    const next = new URLSearchParams(params);
    nextOffset ? next.set('offset', String(nextOffset)) : next.delete('offset');
    setParams(next);
  }
  return (
    <div className="page">
      <PageTitle
        eyebrow={t('ОТКРЫТЫЙ КАТАЛОГ СТУДИЙ', 'OPEN STUDIO DIRECTORY')}
        title={t('Найдите свою мастерскую.', 'Find your kind of maker.')}
        description={t(
          'Студии печати и производства рядом с вами. Свяжитесь напрямую или добавьте свою студию без регистрации. Код каталога открыт.',
          'Print and manufacturing studios near you. Contact them directly or add your studio without signing up. The directory is open source.',
        )}
      >
        <Link className="button secondary" to="/network">
          <MapPin size={17} /> {t('Сеть мастерских', 'Workshop network')}
        </Link>
        <Link className="button" to="/catalog/new">
          <Plus size={17} />
          {t('Добавить студию', 'Add a studio')}
        </Link>
      </PageTitle>
      <div className="filter-panel">
        <div className="search-input">
          <Search size={18} />
          <input
            dir="auto"
            aria-label={t('Поиск мастерских', 'Search workshops')}
            maxLength={100}
            placeholder={t('Название, город или специализация', 'Name, city, or specialty')}
            value={params.get('q') || ''}
            onChange={(e) => filter('q', e.target.value)}
          />
        </div>
        <div className="filter-row">
          {mode === 'community' && (
            <>
              <select
                aria-label={t('Источник записей', 'Listing source')}
                value={params.get('source') || 'all'}
                onChange={(event) => filter('source', event.target.value)}
              >
                <option dir="auto" value="all">
                  {t('Участники и каталог', 'Members and directory')}
                </option>
                <option dir="auto" value="member">
                  {t('Участники OpenPrint', 'OpenPrint members')}
                </option>
                <option dir="auto" value="catalog">
                  {t('Каталог студий', 'Studio directory')}
                </option>
              </select>
              <select
                aria-label={t('Тип участника', 'Maker type')}
                value={params.get('kind') || ''}
                onChange={(e) => filter('kind', e.target.value)}
              >
                <option dir="auto" value="">
                  {t('Все специализации', 'All specialties')}
                </option>
                <option dir="auto" value="studio">
                  {t('Мастерские', 'Workshops')}
                </option>
                <option dir="auto" value="engineer">
                  {t('Инженеры', 'Engineers')}
                </option>
              </select>
            </>
          )}
          <select
            aria-label={t('Технология', 'Technology')}
            value={params.get('technology') || ''}
            onChange={(e) => filter('technology', e.target.value)}
          >
            <option dir="auto" value="">
              {t('Все технологии', 'All technologies')}
            </option>
            {technologies.map((s) => (
              <option dir="auto" key={s} value={s}>
                {technologyLabel(s, t)}
              </option>
            ))}
            {['PolyJet', 'Binder Jetting'].map((technology) => (
              <option dir="auto" key={technology} value={technology}>
                {technology}
              </option>
            ))}
          </select>
          <button
            className={'text-button map-toggle' + (map ? ' selected' : '')}
            aria-pressed={map}
            onClick={() => {
              const next = new URLSearchParams(params);
              map ? next.delete('view') : next.set('view', 'map');
              setParams(next);
            }}
          >
            <MapPin size={16} />
            {map ? t('Скрыть карту', 'Hide map') : t('Показать карту', 'Show map')}
          </button>
        </div>
      </div>
      {map && (
        <section className="map-section" aria-label={t('Студии на карте', 'Studios on the map')}>
          <p className="micro muted">
            {mapTiles &&
              t(
                'Точки всех результатов выбранных фильтров, независимо от страницы списка. Фон OpenStreetMap загружается при открытии карты.',
                'All locations matching your filters, across every list page. OpenStreetMap tiles load when you open the map.',
              )}
          </p>
          <div className="map-legend" aria-label={t('Обозначения карты', 'Map legend')}>
            {mode === 'community' && (
              <span>
                <i className="map-key member" />
                {t('Участники OpenPrint', 'OpenPrint members')}
              </span>
            )}
            <span>
              <i className="map-key catalog" />
              {t('Справочные записи', 'Directory listings')}
            </span>
          </div>
          <div
            role="status"
            className="directory-map-count"
            aria-label={t('Результаты карты', 'Map results')}
          >
            {mapRemote.loading ? (
              t('Загружаем точки…', 'Loading locations…')
            ) : mapRemote.data ? (
              <>
                {t('Точек на карте', 'Map locations')}: {mapRemote.data.points.length} ·{' '}
                {t('Всего результатов', 'Total results')}: {mapRemote.data.total} ·{' '}
                {t('Без координат', 'Without coordinates')}: {mapRemote.data.unmapped}
              </>
            ) : null}
          </div>
          <ErrorBox error={mapRemote.error} retry={mapRemote.reload} />
          {mapRemote.data?.truncated && (
            <p className="info-box">
              {t(
                'Показана часть точек. Уточните город, название или технологию, чтобы увидеть остальные.',
                'Only some locations are shown. Narrow the city, name, or technology to see the rest.',
              )}
            </p>
          )}
          <Suspense fallback={<Loading />}>
            <CommunityMap
              points={mapRemote.data?.points || emptyMapPoints}
              datasetKey={filters.toString()}
              loading={mapRemote.loading || !!mapRemote.error}
            />
          </Suspense>
          {mapRemote.data && !mapRemote.data.mappable && (
            <p className="micro muted">
              {t(
                'У этих записей пока нет координат. Контакты доступны в списке.',
                'These listings have no coordinates yet. Contact details remain available in the list.',
              )}
            </p>
          )}
        </section>
      )}
      <div className="results-bar">
        <h2 className="directory-heading">
          <span role="status">
            {remote.data ? (
              <>
                {t('Найдено', 'Found')}: {remote.data.total}
                {mode === 'community' && (
                  <>
                    {' '}
                    · {t('Участников', 'Members')}: {remote.data.members} ·{' '}
                    {t('Из каталога', 'Directory')}: {remote.data.catalog}
                  </>
                )}
              </>
            ) : (
              t('Ищем студии…', 'Finding studios…')
            )}
          </span>
        </h2>
        <span className="micro">
          {t(
            'Возможности и условия уточняйте напрямую у студии',
            'Confirm capabilities and terms directly with the studio',
          )}
        </span>
      </div>
      <ErrorBox error={remote.error} retry={remote.reload} />
      {remote.loading ? (
        <Loading />
      ) : remote.data?.entries.length ? (
        <div className="profile-grid">
          {remote.data.entries.map((entry) =>
            entry.source === 'member' ? (
              <ProfileCard key={'member:' + entry.profile.id} profile={entry.profile} />
            ) : (
              <CatalogCard key={'catalog:' + entry.studio.id} studio={entry.studio} />
            ),
          )}
        </div>
      ) : remote.error ? null : (
        <Empty
          title={t('Пока не нашли совпадений', 'No makers found yet')}
          description={t(
            'Попробуйте другой город или технологию. Знаете студию? Добавьте её контакты с разрешения организации.',
            'Try another city or technology. Know a studio? Add its contacts with the organization’s permission.',
          )}
        >
          <Link className="button secondary" to="/catalog/new">
            {t('Добавить студию', 'Add a studio')}
          </Link>
        </Empty>
      )}
      <div className="pagination">
        {offset > 0 && (
          <button className="button secondary" onClick={() => page(Math.max(0, offset - 12))}>
            {t('Назад', 'Previous')}
          </button>
        )}
        {remote.data?.has_more && (
          <button className="button secondary" onClick={() => page(offset + 12)}>
            {t('Следующая страница', 'Next page')}
            <ArrowRight className="directional-icon" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
export function CatalogPage() {
  const { id } = useParams();
  const { t, lang } = useApp();
  const remote = useRemote<{ studio: CatalogStudio }>('/directory/catalog/' + id);
  if (remote.loading) return <Loading />;
  if (remote.error)
    return (
      <div className="page narrow">
        <ErrorBox error={remote.error} retry={remote.reload} />
      </div>
    );
  const studio = remote.data!.studio;
  const website = safeCatalogLink(studio.website);
  const source = safeCatalogLink(studio.source_url);
  const telephone = studio.phone.replace(/[\s().-]/g, '');
  const canCall = /^\+?\d{6,18}$/.test(telephone);
  const hasLocation =
    typeof studio.lat === 'number' &&
    typeof studio.lng === 'number' &&
    Number.isFinite(studio.lat) &&
    Number.isFinite(studio.lng);
  return (
    <div className="page narrow catalog-page">
      <Link className="back-link" to="/studios?source=catalog">
        <span className="directional-icon" aria-hidden="true">
          ←
        </span>{' '}
        {t('Каталог студий', 'Studio directory')}
      </Link>
      <section className="panel profile-detail catalog-detail">
        <span className="catalog-label">
          {studio.listing_type === 'self-published'
            ? t('Самостоятельная публикация', 'Self-published')
            : t('Справочная запись', 'Directory listing')}
        </span>
        <h1 dir="auto">{studio.name}</h1>
        <p className="location">
          <MapPin size={15} />
          {catalogLocation(studio) || t('Город не указан', 'City not specified')}
        </p>
        {studio.address && (
          <p className="prose" dir="auto">
            {studio.address}
          </p>
        )}
        <div className="info-box">
          {t(
            'Сведения опубликованы в открытом каталоге. Принадлежность записи организации не проверяется. Контакты, наличие оборудования и условия работы уточняйте непосредственно у студии.',
            'Details are published in an open directory. The listing’s ownership is not verified. Confirm contact details, available equipment, and terms directly with the studio.',
          )}
        </div>
        {studio.description && (
          <p className="prose" dir="auto">
            {studio.description}
          </p>
        )}
        {!!(studio.technologies.length || studio.materials.length) && (
          <>
            <h2>{t('Технологии и материалы', 'Technologies and materials')}</h2>
            <div className="tags">
              {[...studio.technologies, ...studio.materials].map((value, index) => (
                <span key={value + index}>{materialLabel(technologyLabel(value, t), t)}</span>
              ))}
            </div>
          </>
        )}
        <h2>{t('Контакты организации', 'Organization contacts')}</h2>
        <div className="detail-actions">
          {website && (
            <a className="button secondary" href={website} target="_blank" rel="noreferrer">
              {t('Сайт студии', 'Studio website')}
              <ExternalLink size={15} />
            </a>
          )}
          {canCall && (
            <a className="button secondary" href={'tel:' + telephone}>
              {studio.phone}
            </a>
          )}
          {hasLocation && (
            <a
              className="text-button"
              href={`https://www.openstreetmap.org/?mlat=${studio.lat}&mlon=${studio.lng}#map=14/${studio.lat}/${studio.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={15} />
              {t('На OpenStreetMap', 'View on OpenStreetMap')}
            </a>
          )}
        </div>
        {studio.phone && !canCall && (
          <p>
            {t('Телефон', 'Phone')}: {studio.phone}
          </p>
        )}
        {!website && !studio.phone && (
          <p className="muted">
            {t(
              'Прямые контакты не указаны. Проверьте исходную запись.',
              'Direct contact details are not listed. Check the original source.',
            )}
          </p>
        )}
        {!hasLocation && (
          <p className="micro muted">
            {t(
              'Координаты не указаны: запись доступна в списке, но не отмечена на карте.',
              'Coordinates are not provided: this listing is available in the list but has no map marker.',
            )}
          </p>
        )}
        <div className="catalog-provenance">
          <p>
            <strong>{t('Источник', 'Source')}: </strong>
            {studio.listing_type === 'self-published'
              ? t('Самостоятельная публикация', 'Self-published')
              : studio.source_name}
          </p>
          {source && (
            <a className="text-button" href={source} target="_blank" rel="noreferrer">
              {t('Открыть источник', 'Open source listing')}
              <ExternalLink size={14} />
            </a>
          )}
          {studio.listing_type === 'self-published' ? (
            <>
              <p className="micro muted">
                {t('Опубликовано', 'Published')}: {formatDate(studio.imported_at, lang)} ·{' '}
                {t('Обновлено', 'Updated')}: {formatDate(studio.updated_at, lang)}
              </p>
              <Link className="text-button" to={`/catalog/${studio.id}/edit`}>
                {t('Управлять записью по ключу', 'Manage listing with a key')}
              </Link>
            </>
          ) : (
            <p className="micro muted">
              {t('Импортировано', 'Imported')}:{' '}
              {new Intl.DateTimeFormat(localeTag(lang), { dateStyle: 'medium' })
                .format(studio.imported_at)
                .replace(/\.$/, '')}
              .{' '}
              {t(
                'Это дата переноса записи. Она не подтверждает актуальность сведений об организации.',
                'This is the import date. It does not confirm that the organization’s details are current.',
              )}
            </p>
          )}
        </div>
      </section>
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
        <span className="directional-icon" aria-hidden="true">
          ←
        </span>{' '}
        {t('Все мастерские', 'All makers')}
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
        <h1 dir="auto">{p.name}</h1>
        <p className="location">
          <MapPin size={15} />
          {p.city}
          {p.remote && <span>· {t('Работает удалённо', 'Works remotely')}</span>}
        </p>
        <p className="prose" dir="auto">
          {p.description}
        </p>
        <h3>{t('Технологии и материалы', 'Technologies & materials')}</h3>
        <div className="tags">
          {[...p.technologies, ...p.materials.filter((x) => x !== 'Any')].map((tag, i) => (
            <span key={tag + i}>{materialLabel(technologyLabel(tag, t), t)}</span>
          ))}
        </div>
        <div className="detail-actions">
          {p.user_id !== user?.id && (
            <Link
              className="button"
              to={`/projects/new?target=${p.id}&kind=${p.kind === 'engineer' ? 'design' : 'print'}`}
            >
              {t('Обсудить проект', 'Discuss a project')}
              <ArrowUpRight className="directional-icon" size={17} />
            </Link>
          )}
          {p.user_id !== user?.id && (
            <Link className="button secondary" to={'/tools?target=' + encodeURIComponent(p.id)}>
              {t('В 3D-мастерскую', 'Open 3D tools')}
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
          dir="auto"
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
            dir="auto"
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
            dir="auto"
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
            <ArrowRight className="directional-icon" size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
