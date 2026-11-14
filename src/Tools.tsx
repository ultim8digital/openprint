import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, ArrowUpRight, Upload, Box, ShieldCheck, RotateCcw } from 'lucide-react';
import { useApp, ErrorBox, errorText } from './core';
import { PageTitle } from './Browse';
import ModelViewer from './ModelViewer';
import {
  partGeometry,
  geometryInfo,
  defaultPart,
  partSchema,
  type PartSpec,
} from '../shared/parts';
import { partFile, downloadFile, readModel } from './model-files';
import type { BufferGeometry } from 'three';
export default function Tools() {
  const { t } = useApp(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [mode, setMode] = useState<'builder' | 'file'>('builder');
  const [spec, setSpec] = useState<PartSpec>(() => {
      try {
        const preset = params.get('preset');
        return preset ? partSchema.parse(JSON.parse(preset)) : defaultPart;
      } catch {
        return defaultPart;
      }
    }),
    [fileGeometry, setFileGeometry] = useState<BufferGeometry | null>(null),
    [filename, setFilename] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const result = useMemo(() => {
    try {
      const geometry = partGeometry(spec);
      return { geometry, info: geometryInfo(geometry), error: '' };
    } catch (error) {
      return { geometry: null, info: null, error: errorText(error) };
    }
  }, [spec]);
  useEffect(() => () => result.geometry?.dispose(), [result.geometry]);
  useEffect(() => () => fileGeometry?.dispose(), [fileGeometry]);
  const current = mode === 'file' ? fileGeometry : result.geometry,
    info = useMemo(() => {
      try {
        return current ? geometryInfo(current) : null;
      } catch {
        return null;
      }
    }, [current]);
  function update(field: keyof PartSpec, value: string) {
    setSpec((p) => ({
      ...p,
      [field]: field === 'kind' ? value : Number(value),
      ...(field === 'kind' && value === 'tube'
        ? { depth: p.width, hole: Math.min(p.width - 3, 10) }
        : {}),
    }));
  }
  return (
    <div className="page">
      <PageTitle
        eyebrow={t('ВЕЩИ НАЧИНАЮТСЯ С ФОРМЫ', 'GOOD THINGS START WITH A SHAPE')}
        title={t('Ваша идея. В трёх измерениях.', 'Your idea. In three dimensions.')}
        description={t(
          'Создайте простую деталь по размерам или изучите свой файл. Эти инструменты работают без аккаунта, модель остаётся в браузере.',
          'Build a custom-size part or inspect your own file. No account required; your model stays in this browser.',
        )}
      />
      <div className="pills" style={{ marginBottom: 23 }}>
        <button className={mode === 'builder' ? 'active' : ''} onClick={() => setMode('builder')}>
          <Box size={14} /> {t('Конструктор детали', 'Part builder')}
        </button>
        <button className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>
          <Upload size={14} /> {t('Мой файл', 'My model file')}
        </button>
      </div>
      <div className="tools-layout">
        <section className="panel tools-controls">
          {mode === 'builder' ? (
            <>
              <h2 style={{ fontSize: 20 }}>{t('Под ваши размеры.', 'Made to your dimensions.')}</h2>
              <label>
                {t('Тип детали', 'Part type')}
                <select value={spec.kind} onChange={(e) => update('kind', e.target.value)}>
                  <option value="plate">{t('Пластина с отверстием', 'Drilled plate')}</option>
                  <option value="tube">{t('Втулка', 'Spacer tube')}</option>
                  <option value="block">{t('Блок', 'Solid block')}</option>
                </select>
              </label>
              <div className="form-grid">
                <label>
                  {spec.kind === 'tube'
                    ? t('Диаметр, мм', 'Diameter, mm')
                    : t('Ширина, мм', 'Width, mm')}
                  <input
                    type="number"
                    min={4}
                    max={300}
                    step={1}
                    value={spec.width}
                    onChange={(e) => update('width', e.target.value)}
                  />
                </label>
                {spec.kind !== 'tube' && (
                  <label>
                    {t('Глубина, мм', 'Depth, mm')}
                    <input
                      type="number"
                      min={4}
                      max={300}
                      step={1}
                      value={spec.depth}
                      onChange={(e) => update('depth', e.target.value)}
                    />
                  </label>
                )}
                <label>
                  {t('Высота, мм', 'Height, mm')}
                  <input
                    type="number"
                    min={1}
                    max={300}
                    step={0.5}
                    value={spec.height}
                    onChange={(e) => update('height', e.target.value)}
                  />
                </label>
                {spec.kind !== 'block' && (
                  <label>
                    {t('Отверстие Ø, мм', 'Hole Ø, mm')}
                    <input
                      type="number"
                      min={spec.kind === 'tube' ? 1 : 0}
                      max={296}
                      step={0.5}
                      value={spec.hole}
                      onChange={(e) => update('hole', e.target.value)}
                    />
                  </label>
                )}
              </div>
              <ErrorBox error={result.error} />
              <div className="stack">
                <button
                  className="button"
                  disabled={!result.geometry}
                  onClick={() => downloadFile(partFile(spec))}
                >
                  <Download size={15} />
                  {t('Скачать STL', 'Download STL')}
                </button>
                <button
                  className="button secondary"
                  disabled={!result.geometry}
                  onClick={() => {
                    sessionStorage.setItem('openprint.part.v1', JSON.stringify(spec));
                    navigate('/projects/new?from=tools');
                  }}
                >
                  {t('Использовать в проекте', 'Use in a project')}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 20 }}>{t('Посмотрим поближе.', 'Take a closer look.')}</h2>
              <label className="upload-box" style={{ display: 'block' }}>
                <Upload size={24} />
                <span style={{ display: 'block', margin: '10px 0' }}>
                  {t('Открыть STL или OBJ', 'Open an STL or OBJ')}
                </span>
                <input
                  type="file"
                  accept=".stl,.obj"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    setError('');
                    try {
                      const geometry = await readModel(file);
                      setFileGeometry(geometry);
                      setFilename(file.name);
                    } catch (error) {
                      setError(errorText(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <small>
                  {t('До 20 МБ · без отправки на сервер', 'Up to 20 MB · not sent to the server')}
                </small>
              </label>
              {filename && <p className="small muted">{filename}</p>}
              <ErrorBox error={error} />
            </>
          )}
          <div className="info-box">
            <ShieldCheck size={15} />{' '}
            {t(
              'STL и OBJ не содержат единиц: здесь координаты считаются миллиметрами. Просмотр не заменяет проверку в слайсере. Для нагруженных деталей согласуйте конструкцию с инженером.',
              'STL and OBJ don’t specify units; coordinates are treated as millimeters here. Preview is not a slicer or a printability check. Have an engineer review load-bearing parts.',
            )}
          </div>
        </section>
        <div>
          {current ? (
            <ModelViewer geometry={current} />
          ) : (
            <div className="viewer" style={{ display: 'grid', placeItems: 'center' }}>
              <p className="small muted">
                {t('Здесь появится ваша модель', 'Your model will appear here')}
              </p>
            </div>
          )}
          {info && (
            <div className="model-measures">
              <div>
                <small>{t('ГАБАРИТЫ, ММ', 'DIMENSIONS, MM')}</small>
                <strong>
                  {[info.width, info.depth, info.height].map((n) => n.toFixed(1)).join(' × ')}
                </strong>
              </div>
              <div>
                <small>{t('ТРЕУГОЛЬНИКОВ', 'TRIANGLES')}</small>
                <strong>{info.triangles.toLocaleString()}</strong>
              </div>
              <div>
                <small>{t('ОБЪЁМ ПО СЕТКЕ, СМ³', 'MESH VOLUME, CM³')}</small>
                <strong>{(info.volume / 1000).toFixed(2)}*</strong>
              </div>
            </div>
          )}
          <p className="micro muted" style={{ marginTop: 12 }}>
            {t(
              '* Для незамкнутой сетки объём может быть неверным. Цена и расход материала здесь не рассчитываются.',
              '* Volume can be inaccurate for open meshes. This tool does not calculate price or material usage.',
            )}
          </p>
        </div>
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>{t('Как выбрать материал?', 'Which material fits your idea?')}</h2>
          <span className="micro muted">
            {t(
              'Отправная точка для разговора с мастерской',
              'A starting point for talking with your maker',
            )}
          </span>
        </div>
        <div className="material-grid">
          {[
            [
              'PLA',
              t('Макеты и предметы для дома', 'Prototypes & indoor objects'),
              t(
                'Простой старт. Для ненагруженных деталей, которые не нагреваются.',
                'A simple starting point for low-load parts kept away from heat.',
              ),
            ],
            [
              'PETG',
              t('Функциональные детали', 'Functional parts'),
              t(
                'Хорош для многих корпусов и креплений. Допуски и нагрузки обсудите с исполнителем.',
                'Often useful for enclosures and brackets. Discuss tolerances and loads with your provider.',
              ),
            ],
            [
              'TPU',
              t('Гибкие детали', 'Flexible parts'),
              t(
                'Накладки, бамперы и упругие элементы. Укажите желаемую жёсткость и условия работы.',
                'Covers, bumpers, and flexible elements. Specify desired hardness and use conditions.',
              ),
            ],
          ].map(([name, title, description]) => (
            <div className="panel" key={name}>
              <span className="eyebrow">{name} / FDM</span>
              <h3 style={{ marginTop: 13 }}>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
