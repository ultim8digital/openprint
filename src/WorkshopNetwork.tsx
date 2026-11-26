import { useMemo, useState } from 'react';
import { ArrowUpRight, MapPin, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp, useRemote, Loading, ErrorBox } from './core';
import CommunityMap from './CommunityMap';
import type { NetworkWorkshop, WorkshopNode } from '../shared/network';
import { technologyLabel } from '../shared/types';

export type Maker = NetworkWorkshop & { origin: string };
export function editorAt(maker: Maker) {
  const url = new URL('/tools', maker.origin);
  url.searchParams.set('target', maker.id);
  return url;
}

export default function WorkshopNetwork({ choose }: { choose?: (maker: Maker) => void }) {
  const { t } = useApp();
  const remote = useRemote<{ nodes: WorkshopNode[] }>('/directory/network');
  const [filter, setFilter] = useState('');
  const makers = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase();
    return (remote.data?.nodes || []).flatMap((node) =>
      node.workshops
        .filter((p) =>
          [p.name, p.city, ...p.technologies].join(' ').toLocaleLowerCase().includes(term),
        )
        .map((p) => ({ ...p, origin: node.origin })),
    );
  }, [remote.data, filter]);
  const locations = useMemo(
    () =>
      makers.flatMap((p) =>
        p.lat === null || p.lng === null
          ? []
          : [
              {
                source: 'member' as const,
                id: editorAt(p).href,
                name: p.name,
                city: p.city,
                lat: p.lat,
                lng: p.lng,
              },
            ],
      ),
    [makers],
  );
  function select(maker: Maker) {
    if (choose) choose(maker);
    else window.location.assign(editorAt(maker).href);
  }
  return (
    <section className="page network-page">
      {choose ? (
        <h2>{t('Сеть мастерских', 'Workshop network')}</h2>
      ) : (
        <h1>{t('Сеть мастерских', 'Workshop network')}</h1>
      )}
      <p>
        {t(
          'Заказ и файл будут храниться на узле выбранной мастерской.',
          'Your order and file will be stored on the chosen workshop’s node.',
        )}
      </p>
      <div className="search-input">
        <Search size={18} />
        <input
          aria-label={t('Поиск мастерских', 'Search workshops')}
          placeholder={t('Название, город или специализация', 'Name, city, or specialty')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <ErrorBox error={remote.error} retry={remote.reload} />
      ) : (
        <>
          {remote.data?.nodes
            .filter((n) => !n.available || n.truncated)
            .map((n) => (
              <p className="info-box" key={n.origin}>
                <bdi>{n.origin}</bdi>
                {' · '}
                {n.available ? (
                  <a href={new URL('/studios?source=member', n.origin).href} rel="noreferrer">
                    {t('Открыть каталог', 'Open directory')}
                  </a>
                ) : (
                  t(
                    'Не удалось получить ответ сервера. Проверьте соединение и повторите действие.',
                    'The server did not respond. Check your connection and retry.',
                  )
                )}
              </p>
            ))}
          {locations.length > 0 && (
            <CommunityMap
              points={locations}
              datasetKey={filter}
              loading={false}
              onSelect={(point) => {
                const maker = makers.find((p) => editorAt(p).href === point.id);
                if (maker) select(maker);
              }}
            />
          )}
          {makers.length ? (
            <div className="profile-grid">
              {makers.map((maker) => (
                <article className="panel" key={editorAt(maker).href}>
                  <h2 dir="auto">{maker.name}</h2>
                  <p className="location">
                    <MapPin size={15} />
                    <bdi>{maker.city}</bdi>
                  </p>
                  <p className="micro muted">
                    <bdi>{maker.origin}</bdi>
                  </p>
                  <div className="tags">
                    {maker.technologies.map((tech) => (
                      <span key={tech}>{technologyLabel(tech, t)}</span>
                    ))}
                  </div>
                  <button type="button" className="button secondary" onClick={() => select(maker)}>
                    {t('Личный запрос', 'Direct request')} <ArrowUpRight size={15} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>{t('Пока не нашли совпадений', 'No makers found yet')}</h2>
              {!filter.trim() && (
                <p>
                  {t(
                    'Для подключения мастерских укажите адреса узлов в OPENPRINT_PEERS.',
                    'To connect workshops, add node addresses to OPENPRINT_PEERS.',
                  )}
                </p>
              )}
              <Link className="text-button" to="/studios">
                {t('Каталог и карта', 'Directory & map')}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
