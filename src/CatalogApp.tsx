import LanguageSelector from './LanguageSelector';
import { lazy, Suspense, useEffect } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layers3, Box, MapPin, Plus, BookOpen, Code2, ArrowUpRight } from 'lucide-react';
import { Directory, CatalogPage, PageTitle } from './Browse';
import { Loading, useApp } from './core';

const Tools = lazy(() => import('./Tools'));
const WorkshopNetwork = lazy(() => import('./WorkshopNetwork'));
const CatalogEditor = lazy(() => import('./CatalogEditor'));

function CatalogAbout() {
  const { t, operatorContact } = useApp();
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow={t('ОТКРЫТЫЙ КОД · MIT', 'OPEN SOURCE · MIT')}
        title={t('Открытый каталог мастерских.', 'An open workshop directory.')}
        description={t(
          'Найдите исполнителя и свяжитесь с ним напрямую. Студии добавляют и обновляют свои карточки самостоятельно.',
          'Find a maker and contact them directly. Studios publish and update their own listings.',
        )}
      />
      <section className="panel legal-prose">
        <h2>{t('Добавить свою студию', 'Add your studio')}</h2>
        <p>
          {t(
            'Сначала найдите студию по названию и городу. Если её ещё нет, заполните контакты и выберите точку на карте. Карточка публикуется сразу, без регистрации и одобрения модератора.',
            'First search by name and city. If your studio is missing, add its contacts and choose a location. Your listing is published immediately, without registration or moderator approval.',
          )}
        </p>
        <Link className="button" to="/catalog/new">
          <Plus size={17} />
          {t('Добавить студию', 'Add a studio')}
        </Link>
        <h2>{t('Управлять своей карточкой', 'Manage your listing')}</h2>
        <p>
          {t(
            'После публикации сохраните личную ссылку. Она позволяет изменять и удалять только вашу карточку. Не публикуйте её: любой, у кого есть ссылка, сможет управлять записью. Восстановления через почту нет.',
            'Save your private link after publishing. It lets you edit or delete your listing. Keep it private: anyone with the link can manage the record. There is no email recovery.',
          )}
        </p>
        <h2>{t('Откуда берутся сведения', 'Where the information comes from')}</h2>
        <p>
          {t(
            'У импортированных записей указан источник. Самостоятельные публикации отмечены отдельно. Публикация не подтверждает принадлежность бизнеса, качество услуг или актуальность контактов — условия уточняйте у исполнителя.',
            'Imported listings include their source. Self-published entries are labelled separately. Publication does not verify business ownership, service quality or current contact details; confirm terms directly with the maker.',
          )}
        </p>
        <h2>{t('Свободный код и свой сервер', 'Open code, your own server')}</h2>
        <p>
          {t(
            'Код распространяется под MIT. Каталог работает на Node.js и SQLite; аккаунты Vercel и Supabase не требуются. Для общего сайта нужен работающий сервер. Карта использует OpenStreetMap.',
            'The code is MIT licensed. The directory runs on Node.js and SQLite with no Vercel or Supabase account. A shared website needs a running server. The map uses OpenStreetMap.',
          )}
        </p>
        <a
          className="text-button"
          href="https://github.com/ultim8digital/openprint"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ArrowUpRight className="directional-icon" size={15} />
        </a>
        {operatorContact && (
          <p>
            <a href={operatorContact}>
              {t('Связаться с владельцем этого сайта', 'Contact this site’s operator')}
            </a>
          </p>
        )}
      </section>
    </div>
  );
}

export default function CatalogApp() {
  const { t } = useApp();
  const location = useLocation();
  const title =
    location.pathname === '/tools'
      ? t('3D-инструменты', '3D tools')
      : location.pathname === '/network'
        ? t('Сеть мастерских', 'Workshop network')
        : location.pathname === '/catalog/new'
          ? t('Добавить студию', 'Add a studio')
          : location.pathname.endsWith('/edit')
            ? t('Управление карточкой', 'Manage listing')
            : location.pathname === '/about'
              ? t('Как это работает', 'How it works')
              : location.pathname.startsWith('/catalog/')
                ? t('Карточка студии', 'Studio listing')
                : t('Каталог мастерских', 'Workshop directory');
  useEffect(() => {
    document.title = `${title} · OpenPrint`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, title]);
  const nav = [
    { to: '/studios', label: t('Каталог и карта', 'Directory & map'), icon: MapPin },
    { to: '/tools', label: t('3D-инструменты', '3D tools'), icon: Box },
    { to: '/catalog/new', label: t('Добавить студию', 'Add a studio'), icon: Plus },
    { to: '/about', label: t('Как это работает', 'How it works'), icon: BookOpen },
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        {t('К содержимому', 'Skip to content')}
      </a>
      <div className="app-shell catalog-shell">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <span className="brand-icon">
              <Layers3 size={23} />
            </span>
            <span>
              openprint<span className="brand-period">.</span>
            </span>
          </Link>
          <p className="sidebar-label">
            {t('ОТКРЫТЫЙ КАТАЛОГ МАСТЕРСКИХ', 'OPEN WORKSHOP DIRECTORY')}
          </p>
          <nav className="main-nav" aria-label={t('Главное меню', 'Main navigation')}>
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to}>
                <n.icon size={19} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="community-note">
              <strong>{t('Вашу студию легко найти.', 'Make your studio easy to find.')}</strong>
              <p>
                {t(
                  'Добавляйте контакты и возможности. Общайтесь с заказчиками напрямую.',
                  'Share your contacts and capabilities. Talk to customers directly.',
                )}
              </p>
              <a href="https://github.com/ultim8digital/openprint" target="_blank" rel="noreferrer">
                GitHub <ArrowUpRight className="directional-icon" size={14} />
              </a>
            </div>
            <div className="sidebar-foot">
              <span className="online-dot" />
              {t('MIT · Открытый код', 'MIT · Open source')}
              <span>v0.5</span>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>OpenPrint</span>
              <span>/</span>
              <strong>{title}</strong>
            </div>
            <LanguageSelector />
          </header>
          <main id="main" tabIndex={-1}>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Navigate to="/studios?view=map" replace />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/network" element={<WorkshopNetwork />} />
                <Route path="/studios" element={<Directory />} />
                <Route path="/catalog/new" element={<CatalogEditor key="new" />} />
                <Route
                  path="/catalog/:id/edit"
                  element={<CatalogEditor key={location.pathname} />}
                />
                <Route path="/catalog/:id" element={<CatalogPage />} />
                <Route path="/about" element={<CatalogAbout />} />
                <Route
                  path="*"
                  element={
                    <div className="page narrow empty">
                      <h1>404</h1>
                      <p>{t('Страница не найдена.', 'Page not found.')}</p>
                      <Link className="button" to="/studios">
                        {t('Открыть каталог', 'Open directory')}
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
              <span>
                {t('Мастерские рядом и по всему миру.', 'Workshops nearby and worldwide.')}
              </span>
            </span>
            <div>
              <Link to="/about">{t('Как это работает', 'How it works')}</Link>
              <a href="https://github.com/ultim8digital/openprint" target="_blank" rel="noreferrer">
                <Code2 size={14} />
                {t('MIT · Открытый код', 'MIT · Open source')}
              </a>
            </div>
          </footer>
        </div>
      </div>
      <nav className="mobile-nav" aria-label={t('Навигация', 'Navigation')}>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to}>
            <n.icon size={21} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
