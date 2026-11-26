import LanguageSelector from './LanguageSelector';
import { localeTag } from '../shared/locales';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  Layers3,
  LayoutGrid,
  Store,
  BriefcaseBusiness,
  Box,
  UserRound,
  ArrowUpRight,
  Plus,
  Search,
  Bell,
  ArrowRight,
  ChevronDown,
  Code2,
  BookOpen,
  X,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp, post, errorText, Loading, ErrorBox, useRemote, initials } from './core';
import type { Notification } from '../shared/types';
import { Home, Directory, CatalogPage, ProfilePage, Projects } from './Browse';
const WorkshopNetwork = lazy(() => import('./WorkshopNetwork'));
const Auth = lazy(() => import('./Auth'));
const NewProject = lazy(() => import('./NewProject'));
const Project = lazy(() => import('./Project'));
const Workspace = lazy(() => import('./Workspace'));
const Models = lazy(() => import('./Models'));
const Tools = lazy(() => import('./Tools'));
const Admin = lazy(() => import('./Admin'));
const About = lazy(() => import('./About'));
const Studio = lazy(() => import('./Studio'));
const CatalogApp = lazy(() => import('./CatalogApp'));
const CatalogEditor = lazy(() => import('./CatalogEditor'));

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();
  const location = useLocation();
  if (loading) return <Loading />;
  return user ? (
    <>{children}</>
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
      replace
    />
  );
}
const names = (t: ReturnType<typeof useApp>['t']): Record<string, string> => ({
  '/': t('Обзор сообщества', 'Community overview'),
  '/network': t('Сеть мастерских', 'Workshop network'),
  '/studios': t('Мастерские и инженеры', 'Workshops & engineers'),
  '/projects': t('Биржа проектов', 'Project board'),
  '/models': t('Библиотека моделей', 'Model library'),
  '/tools': t('3D-инструменты', '3D tools'),
  '/workspace': t('Моя мастерская', 'My workspace'),
  '/about': t('О сообществе', 'About the community'),
  '/admin': t('Модерация', 'Moderation'),
  '/login': t('Добро пожаловать', 'Welcome'),
  '/recover': t('Восстановить доступ', 'Account recovery'),
  '/studio': t('Neofab Studio', 'Neofab Studio'),
});
function Notifications({ close }: { close: () => void }) {
  const { t, lang, refresh } = useApp(),
    dialog = useRef<HTMLDialogElement>(null),
    remote = useRemote<{ notifications: Notification[] }>('/notifications');
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const labels: Record<string, string> = {
    'offer.created': t('Новое предложение', 'New offer'),
    'offer.accepted': t('Ваше предложение принято', 'Your offer was accepted'),
    'offer.closed': t('Исполнитель выбран', 'A provider was selected'),
    'message.new': t('Новое сообщение', 'New message'),
    'job.direct': t('Личный запрос', 'Direct request'),
    'job.delivered': t('Результат готов к проверке', 'Delivery is ready to review'),
    'job.completed': t('Проект завершён', 'Project completed'),
    'profile.moderated': t('Обновлён статус профиля', 'Profile moderation update'),
    'model.moderated': t('Обновлён статус модели', 'Model moderation update'),
  };
  async function mark() {
    if (remote.data?.notifications.length) {
      await post('/notifications/read', {
        through: Math.max(...remote.data.notifications.map((n) => n.id)),
      });
      await refresh();
    }
    close();
  }
  return (
    <dialog
      ref={dialog}
      className="notifications-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="between">
        <h2>{t('Уведомления', 'Notifications')}</h2>
        <button className="icon-button" aria-label={t('Закрыть', 'Close')} onClick={close}>
          <X size={19} />
        </button>
      </div>
      <ErrorBox error={remote.error} />
      {remote.loading ? (
        <Loading />
      ) : (
        <div className="notification-list">
          {remote.data?.notifications.map((n) => {
            const [key, title] = n.title.split('|');
            return (
              <Link
                className={!n.seen ? 'unseen' : ''}
                key={n.id}
                to={n.path}
                onClick={() => void mark()}
              >
                <span>{labels[key] || key}</span>
                <strong>{title}</strong>
                <small>{new Date(n.created_at).toLocaleString(localeTag(lang))}</small>
              </Link>
            );
          })}
          {!remote.data?.notifications.length && (
            <p className="muted">
              {t(
                'Здесь появятся ответы на ваши проекты и сообщения.',
                'Project updates and messages will appear here.',
              )}
            </p>
          )}
        </div>
      )}
      <button className="button secondary full" onClick={() => void mark()}>
        {t('Отметить прочитанными', 'Mark as read')}
      </button>
    </dialog>
  );
}
export default function App() {
  const context = useApp(),
    { t, user, profile, lang, demo, demoUsers, refresh, toast, unread } = context,
    location = useLocation(),
    navigate = useNavigate();
  const [search, setSearch] = useState(''),
    [notifications, setNotifications] = useState(false);
  const pageTitle =
    names(t)[location.pathname] ||
    (location.pathname.startsWith('/catalog/')
      ? t('Карточка студии', 'Studio listing')
      : t('Проект', 'Project'));
  useEffect(() => {
    if (context.mode === 'catalog') return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = `${pageTitle} · OpenPrint`;
  }, [location.pathname, pageTitle, context.mode]);
  const nav = [
    { to: '/', icon: LayoutGrid, label: t('Обзор', 'Overview') },
    { to: '/studios', icon: Store, label: t('Мастерские', 'Workshops') },
    { to: '/projects', icon: BriefcaseBusiness, label: t('Проекты', 'Projects') },
    { to: '/models', icon: Box, label: t('Модели', 'Models') },
    { to: '/tools', icon: Layers3, label: t('3D-инструменты', '3D tools') },
    { to: '/studio', icon: Sparkles, label: 'Neofab Studio' },
  ];
  if (context.loading) return <Loading />;
  if (context.mode === 'catalog')
    return (
      <Suspense fallback={<Loading />}>
        <CatalogApp />
      </Suspense>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        {t('К содержимому', 'Skip to content')}
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <span className="brand-icon">
              <Layers3 size={23} />
            </span>
            <span>
              openprint<span className="brand-period">.</span>
            </span>
          </Link>
          <p className="sidebar-label">{t('СООБЩЕСТВО СОЗДАТЕЛЕЙ', 'A COMMUNITY OF MAKERS')}</p>
          <nav aria-label={t('Главное меню', 'Main navigation')} className="main-nav">
            {nav.map((n) => (
              <NavLink to={n.to} end={n.to === '/'} key={n.to}>
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.to === '/projects' && context.stats.projects > 0 && (
                  <span className="nav-count">{context.stats.projects}</span>
                )}
              </NavLink>
            ))}
            <div className="nav-divider" />
            <NavLink to="/workspace">
              <UserRound size={19} />
              <span>{t('Мой кабинет', 'My workspace')}</span>
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin">
                <ShieldCheck size={19} />
                <span>{t('Модерация', 'Moderation')}</span>
              </NavLink>
            )}
            <NavLink to="/about">
              <BookOpen size={19} />
              <span>{t('Как это работает', 'How it works')}</span>
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <div className="community-note">
              <span className="tiny-cube">↗</span>
              <strong>{t('Создаём вместе.', 'Better, together.')}</strong>
              <p>
                {t(
                  'Здесь есть место вашей идее — и людям, которые помогут её сделать.',
                  'A place for your ideas, and the people who help make them real.',
                )}
              </p>
              <a href="https://github.com/ultim8digital/openprint" target="_blank" rel="noreferrer">
                GitHub <ArrowUpRight className="directional-icon" size={14} />
              </a>
            </div>
            <div className="sidebar-foot">
              <span className="online-dot" />
              {t('Открыто для каждого', 'Open to everyone')}
              <span>v0.5</span>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>OpenPrint</span>
              <span>/</span>
              <strong>{pageTitle}</strong>
            </div>
            <div className="top-actions">
              <form
                className="top-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(`/studios?q=${encodeURIComponent(search)}`);
                }}
              >
                <Search size={16} />
                <input
                  dir="auto"
                  aria-label={t('Поиск по сообществу', 'Search the community')}
                  placeholder={t('Найти мастерскую…', 'Find a workshop…')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd>↵</kbd>
              </form>
              <LanguageSelector />
              {user ? (
                <>
                  <button
                    className="icon-button notification-button"
                    aria-label={t('Уведомления', 'Notifications')}
                    onClick={() => setNotifications(true)}
                  >
                    <Bell size={19} />
                    {unread > 0 && <i />}
                  </button>
                  <Link
                    to="/workspace"
                    className="user-avatar"
                    aria-label={t('{initials} · Мой кабинет', '{initials} · My workspace', {
                      initials: initials(user.name),
                    })}
                  >
                    {initials(user.name)}
                  </Link>
                </>
              ) : (
                <Link className="button small secondary" to="/login">
                  {t('Войти', 'Sign in')} <ArrowUpRight className="directional-icon" size={14} />
                </Link>
              )}
            </div>
          </header>
          {demo && (
            <div className="demo-bar" role="region" aria-label={t('Демонстрация', 'Demo controls')}>
              <span>
                <span className="demo-dot" />
                {t(
                  'Демо-аккаунты и проекты вымышлены. Каталог может содержать реальные организации.',
                  'Demo accounts and projects are fictional. The directory may include real organizations.',
                )}
              </span>
              <label>
                {t('Посмотреть как', 'Explore as')}
                <select
                  aria-label={t('Демо-участник', 'Demo participant')}
                  value={user?.id || ''}
                  onChange={async (e) => {
                    try {
                      if (e.target.value) await post('/auth/demo', { user_id: e.target.value });
                      else await post('/auth/logout', {});
                      await refresh();
                    } catch (error) {
                      toast(errorText(error));
                    }
                  }}
                >
                  <option dir="auto" value="">
                    {t('Гость', 'Guest')}
                  </option>
                  {demoUsers.map((u) => (
                    <option dir="auto" key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>
            </div>
          )}
          <main id="main" tabIndex={-1}>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route
                  path="/studio"
                  element={
                    <RequireAuth>
                      <Studio key={user?.id} />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/studio/:id"
                  element={
                    <RequireAuth>
                      <Studio key={user?.id} />
                    </RequireAuth>
                  }
                />
                <Route path="/" element={<Home />} />
                <Route path="/network" element={<WorkshopNetwork />} />
                <Route path="/studios" element={<Directory />} />
                <Route path="/studios/:id" element={<ProfilePage />} />
                <Route path="/catalog/new" element={<CatalogEditor key="new" />} />
                <Route
                  path="/catalog/:id/edit"
                  element={<CatalogEditor key={location.pathname} />}
                />
                <Route path="/catalog/:id" element={<CatalogPage />} />
                <Route path="/projects" element={<Projects />} />
                <Route
                  path="/projects/new"
                  element={
                    <RequireAuth>
                      <NewProject key={user?.id} />
                    </RequireAuth>
                  }
                />
                <Route path="/projects/:id" element={<Project />} />
                <Route path="/models" element={<Models />} />
                <Route path="/tools" element={<Tools />} />
                <Route
                  path="/workspace"
                  element={
                    <RequireAuth>
                      <Workspace key={user?.id} />
                    </RequireAuth>
                  }
                />
                <Route path="/login" element={<Auth />} />
                <Route path="/recover" element={<Auth recovery />} />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth>
                      <Admin />
                    </RequireAuth>
                  }
                />
                <Route path="/about" element={<About />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>404</h1>
                      <p>
                        {t(
                          'Этой страницы нет. Давайте начнём с идеи.',
                          'This page is missing. Let’s start with an idea.',
                        )}
                      </p>
                      <Link className="button" to="/">
                        {t('На главную', 'Back home')}
                        <ArrowRight className="directional-icon" size={16} />
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </main>
          <footer className="footer">
            <span>
              openprint.{' '}
              <span>{t('Маленькие идеи. Настоящие вещи.', 'Small ideas. Real things.')}</span>
            </span>
            <div>
              <Link to="/about">{t('Сообщество', 'Community')}</Link>
              <a href="https://github.com/ultim8digital/openprint" target="_blank" rel="noreferrer">
                <Code2 size={14} /> {t('MIT · Открытый код', 'MIT · Open source')}
              </a>
            </div>
          </footer>
        </div>
      </div>
      <nav className="mobile-nav" aria-label={t('Навигация', 'Navigation')}>
        {nav.slice(0, 4).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <n.icon size={21} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <NavLink to="/workspace">
          <UserRound size={21} />
          <span>{t('Кабинет', 'Workspace')}</span>
        </NavLink>
      </nav>
      {notifications && <Notifications close={() => setNotifications(false)} />}
    </>
  );
}
