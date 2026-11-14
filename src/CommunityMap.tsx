import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Profile } from '../shared/types';
import { useApp } from './core';
export default function CommunityMap({ profiles }: { profiles: Profile[] }) {
  const container = useRef<HTMLDivElement>(null),
    [tileError, setTileError] = useState(false),
    { t } = useApp();
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([40, 45], 3);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    });
    tiles.on('tileerror', () => setTileError(true));
    tiles.addTo(map);
    const coordinates: L.LatLngTuple[] = [];
    for (const p of profiles)
      if (p.lat !== null && p.lng !== null) {
        const pos: L.LatLngTuple = [p.lat, p.lng];
        coordinates.push(pos);
        const link = document.createElement('a');
        link.href = '/studios/' + p.id;
        link.textContent = p.name + ' · ' + p.city;
        L.circleMarker(pos, {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#277759',
          fillOpacity: 1,
        })
          .bindPopup(link)
          .addTo(map);
      }
    if (coordinates.length)
      map.fitBounds(L.latLngBounds(coordinates), { padding: [40, 40], maxZoom: 11 });
    return () => {
      map.remove();
    };
  }, [profiles]);
  return (
    <>
      {tileError && (
        <p className="info-box">
          {t(
            'Карта сейчас недоступна. Список участников продолжает работать.',
            'Map tiles are unavailable. The maker directory still works.',
          )}
        </p>
      )}
      <div
        ref={container}
        className="community-map"
        aria-label={t('Карта мастерских', 'Workshop map')}
      />
      {!profiles.some((p) => p.lat !== null) && (
        <p className="micro muted">
          {t(
            'У этих участников пока не указаны координаты.',
            'These makers haven’t added coordinates yet.',
          )}
        </p>
      )}
    </>
  );
}
