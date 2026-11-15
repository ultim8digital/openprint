import { localeTag } from '../shared/locales';
import { useEffect, useMemo } from 'react';
import { geometryInfo, partGeometry, type PartSpec } from '../shared/parts';
import { ErrorBox, errorText, useApp } from './core';
import ModelViewer from './ModelViewer';

export default function StudioPreview({ part }: { part: PartSpec }) {
  const { t, lang } = useApp();
  const result = useMemo(() => {
    try {
      const geometry = partGeometry(part);
      return { geometry, info: geometryInfo(geometry), error: '' };
    } catch (error) {
      return { geometry: null, info: null, error: errorText(error) };
    }
  }, [part]);
  useEffect(() => () => result.geometry?.dispose(), [result.geometry]);
  if (!result.geometry || !result.info) return <ErrorBox error={result.error} />;
  return (
    <div className="studio-preview">
      <ModelViewer geometry={result.geometry} />
      <p>
        {t('Габариты шаблона, мм: ', 'Template bounds, mm: ')}
        <strong>
          {[result.info.width, result.info.depth, result.info.height]
            .map((value) =>
              value.toLocaleString(localeTag(lang), {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            )
            .join(' × ')}
        </strong>
      </p>
      <p>
        {t(
          'Визуализация геометрии. Для изготовления нужны проверка исполнителя, профиль оборудования и подготовка в CAM или слайсере.',
          'Geometry preview. Manufacturing requires maker review, an equipment profile and CAM or slicer preparation.',
        )}
      </p>
    </div>
  );
}
