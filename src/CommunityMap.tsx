import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DirectoryMapPoint } from '../shared/directory';
import { useApp } from './core';
const mercatorLatitude = 85.05112878;
export default function CommunityMap({
  points,
  datasetKey,
  loading,
}: {
  points: DirectoryMapPoint[];
  datasetKey: string;
  loading: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    instance = useRef<L.Map | null>(null),
    markers = useRef<L.LayerGroup | null>(null),
    renderer = useRef<L.Canvas | null>(null),
    fitted = useRef<string | null>(null),
    [tileError, setTileError] = useState(false),
    { t, lang } = useApp();
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      scrollWheelZoom: false,
      preferCanvas: true,
    }).setView([40, 45], 3);
    instance.current = map;
    renderer.current = L.canvas({ padding: 0.5 });
    markers.current = L.layerGroup().addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    });
    tiles.on('tileerror', () => setTileError(true));
    tiles.addTo(map);
    return () => {
      map.remove();
      instance.current = null;
      markers.current = null;
      renderer.current = null;
      fitted.current = null;
    };
  }, []);
  useEffect(() => {
    const map = instance.current;
    const layer = markers.current;
    if (!map || !layer || !renderer.current) return;
    map.stop();
    layer.clearLayers();
    const coordinates: L.LatLngTuple[] = [];
    for (const p of points)
      if (
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180
      ) {
        const pos: L.LatLngTuple = [
          Math.max(-mercatorLatitude, Math.min(mercatorLatitude, p.lat)),
          p.lng,
        ];
        coordinates.push(pos);
        L.circleMarker(pos, {
          renderer: renderer.current,
          radius: p.source === 'member' ? 7 : 5,
          color: '#fff',
          weight: 1.5,
          fillColor: p.source === 'member' ? '#277759' : '#9c6227',
          fillOpacity: 0.9,
        })
          .bindPopup(() => {
            const content = document.createElement('div');
            const link = document.createElement('a');
            link.href =
              (p.source === 'member' ? '/studios/' : '/catalog/') + encodeURIComponent(p.id);
            link.textContent = p.name + (p.city ? ' · ' + p.city : '');
            const label = document.createElement('p');
            label.textContent =
              p.source === 'member'
                ? t('Участник OpenPrint', 'OpenPrint member')
                : t('Справочная запись', 'Directory listing');
            content.dir = document.documentElement.dir;
            link.dir = 'auto';
            content.append(link, label);
            return content;
          })
          .addTo(layer);
      }
    if (!loading && fitted.current !== datasetKey) {
      if (coordinates.length)
        map.fitBounds(L.latLngBounds(coordinates), {
          padding: [40, 40],
          maxZoom: 11,
          animate: false,
        });
      fitted.current = datasetKey;
    }
    const zoomIn = container.current?.querySelector('.leaflet-control-zoom-in');
    const zoomOut = container.current?.querySelector('.leaflet-control-zoom-out');
    zoomIn?.setAttribute('aria-label', t('Приблизить карту', 'Zoom in'));
    zoomOut?.setAttribute('aria-label', t('Отдалить карту', 'Zoom out'));
  }, [points, datasetKey, loading, lang, t]);
  return (
    <>
      {tileError && (
        <p className="info-box">
          {t(
            'Фон карты недоступен. Точки и список студий продолжают работать.',
            'Map tiles are unavailable. Studio points and the list still work.',
          )}
        </p>
      )}
      <div
        ref={container}
        className="community-map"
        role="region"
        aria-label={t('Карта мастерских', 'Workshop map')}
      />
      {points.some((point) => Math.abs(point.lat) > mercatorLatitude) && (
        <p className="micro muted">
          {t(
            'Точки у полюсов показаны на границе проекции карты; исходные координаты сохранены в записи.',
            'Polar locations are shown at the map projection boundary; their original coordinates are preserved in the listing.',
          )}
        </p>
      )}
    </>
  );
}
