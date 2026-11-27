import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { addMapBackground } from './map-background';
import 'leaflet/dist/leaflet.css';
import { useApp } from './core';

type Props = {
  lat: number | null;
  lng: number | null;
  disabled: boolean;
  onChange: (lat: number, lng: number) => void;
};
const projected = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

export default function CatalogLocationPicker({ lat, lng, disabled, onChange }: Props) {
  const { t, mapTiles } = useApp();
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const latest = useRef({ disabled, onChange });
  latest.current = { disabled, onChange };
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView([25, 20], 2);
    map.current = instance;
    const removeBackground = addMapBackground(instance, mapTiles);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!latest.current.disabled) {
        const location = event.latlng.wrap();
        latest.current.onChange(Number(location.lat.toFixed(6)), Number(location.lng.toFixed(6)));
      }
    });
    return () => {
      removeBackground();
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, [mapTiles]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (lat === null || lng === null) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const position: L.LatLngExpression = [projected(lat), lng];
    if (!marker.current) {
      marker.current = L.marker(position, {
        draggable: true,
        title: t(
          'Точка студии; для точного ввода используйте поля координат',
          'Studio location; use the coordinate fields for precise entry',
        ),
        icon: L.divIcon({
          className: 'catalog-location-pin',
          html: '<span aria-hidden="true">●</span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(instance);
      marker.current.on('dragend', () => {
        const location = marker.current?.getLatLng().wrap();
        if (location && !latest.current.disabled)
          latest.current.onChange(Number(location.lat.toFixed(6)), Number(location.lng.toFixed(6)));
      });
    } else marker.current.setLatLng(position);
    if (disabled) marker.current.dragging?.disable();
    else marker.current.dragging?.enable();
    instance.setView(position, Math.max(instance.getZoom(), mapTiles ? 8 : 4), { animate: false });
  }, [lat, lng, disabled, mapTiles]);
  useEffect(() => {
    element.current
      ?.querySelector('.leaflet-control-zoom-in')
      ?.setAttribute('aria-label', t('Приблизить', 'Zoom in'));
    element.current
      ?.querySelector('.leaflet-control-zoom-out')
      ?.setAttribute('aria-label', t('Отдалить', 'Zoom out'));
    const markerElement = marker.current?.getElement();
    const label = t(
      'Точка студии; для точного ввода используйте поля координат',
      'Studio location; use the coordinate fields for precise entry',
    );
    markerElement?.setAttribute('aria-label', label);
    markerElement?.setAttribute('title', label);
  }, [t, lat, lng]);
  return (
    <div>
      {mapTiles && (
        <p className="micro muted">
          {t(
            'Нажмите на карту или переместите точку. Координаты также можно ввести вручную. Фон загружается из OpenStreetMap.',
            'Click the map or drag the marker. You can also enter coordinates manually. Map tiles load from OpenStreetMap.',
          )}
        </p>
      )}
      <div
        ref={element}
        className="catalog-location-map"
        role="region"
        aria-label={t('Выбор точки студии', 'Studio location picker')}
      />
      {lat !== null && Math.abs(lat) > 85.05112878 && (
        <p className="micro muted">
          {t(
            'Точка у полюса показана у края карты; исходная широта сохранена.',
            'The polar location is shown at the map edge; the original latitude is preserved.',
          )}
        </p>
      )}
    </div>
  );
}
