import { localeTag } from '../shared/locales';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, ArrowUpRight, Upload, Box, ShieldCheck, RotateCcw } from 'lucide-react';
import { useApp, useRemote, Loading, ErrorBox, errorText } from './core';
import { PageTitle } from './Browse';
import ModelViewer from './ModelViewer';
import {
  partGeometry,
  geometryInfo,
  defaultPart,
  partSchema,
  type PartSpec,
} from '../shared/parts';
import { partFile, geometryFile, downloadFile, readModel } from './model-files';
import type { BufferGeometry } from 'three';
import type { Profile } from '../shared/types';
import { stageFile, stagedFile, offerModel, receiveModel, listenForModel } from './model-handoff';
import type { Maker } from './WorkshopNetwork';
const WorkshopNetwork = lazy(() => import('./WorkshopNetwork'));

export default function Tools() {
  const { t, lang, mode: appMode } = useApp(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [fragment] = useState(() => new URLSearchParams(location.hash.slice(1))),
    [mode, setMode] = useState<'builder' | 'file'>(
      params.get('mode') === 'file' || fragment.has('transfer') || params.has('attachment')
        ? 'file'
        : 'builder',
    );
  const [sender, setSender] = useState<Window | null>(null);
  useEffect(() => {
    if (fragment.has('transfer')) return listenForModel(fragment, (source) => setSender(source));
  }, [fragment]);
  const target = params.get('target');
  const profile = useRemote<{ profile: Profile }>(
    target && appMode === 'community' ? '/profiles/' + encodeURIComponent(target) : null,
  );
  const [choosing, setChoosing] = useState(false);
  const [fallback, setFallback] = useState<{ url: string; file: File } | null>(null);
  const fileRequest = useRef(0);
  useEffect(
    () => () => {
      fileRequest.current++;
    },
    [],
  );
  const stopTransfer = useRef<(() => void) | null>(null);
  const chooser = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (choosing) chooser.current?.scrollIntoView({ block: 'start' });
  }, [choosing]);
  useEffect(() => () => stopTransfer.current?.(), []);
  const [initial] = useState(() => {
    const preset = fragment.get('part') ?? params.get('preset');
    if (preset === null) return { spec: defaultPart, invalid: false };
    try {
      return { spec: partSchema.parse(JSON.parse(preset)), invalid: false };
    } catch {
      return { spec: defaultPart, invalid: true };
    }
  });
  const [invalidPreset, setInvalidPreset] = useState(initial.invalid);
  const [spec, setSpec] = useState<PartSpec>(initial.spec),
    [fileGeometry, setFileGeometry] = useState<BufferGeometry | null>(null),
    [file, setFile] = useState<File | null>(null),
    [scale, setScale] = useState(100),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const result = useMemo(() => {
    if (invalidPreset)
      return {
        geometry: null,
        error: t(
          'Ссылка недействительна или срок её действия истёк.',
          'The link is invalid or has expired.',
        ),
      };
    try {
      const geometry = partGeometry(spec);
      return { geometry, error: '' };
    } catch (error) {
      return { geometry: null, error: errorText(error) };
    }
  }, [spec, invalidPreset, t]);
  useEffect(() => () => result.geometry?.dispose(), [result.geometry]);
  useEffect(() => () => fileGeometry?.dispose(), [fileGeometry]);
  const scaled = useMemo(() => {
    if (!fileGeometry || scale <= 0 || scale > 1000) return null;
    if (scale === 100) return fileGeometry;
    return fileGeometry.clone().scale(scale / 100, scale / 100, scale / 100);
  }, [fileGeometry, scale]);
  useEffect(
    () => () => {
      if (scaled !== fileGeometry) scaled?.dispose();
    },
    [scaled, fileGeometry],
  );
  const current = mode === 'file' ? scaled : result.geometry,
    info = useMemo(() => {
      try {
        return current ? geometryInfo(current) : null;
      } catch {
        return null;
      }
    }, [current]);
  async function loadFile(input: File | Promise<File>) {
    const generation = ++fileRequest.current;
    setBusy(true);
    setError('');
    setFile(null);
    setFileGeometry(null);
    try {
      const chosen = await input;
      const geometry = await readModel(chosen);
      if (generation !== fileRequest.current) {
        geometry.dispose();
        return;
      }
      setFile(chosen);
      setFileGeometry(geometry);
      setScale(100);
    } catch (err) {
      if (generation === fileRequest.current) setError(errorText(err));
    } finally {
      if (generation === fileRequest.current) setBusy(false);
    }
  }
  useEffect(() => {
    const libraryFile = stagedFile(params.get('attachment'));
    if (libraryFile) void loadFile(libraryFile);
  }, [params]);
  function modelFile() {
    if (mode === 'builder') return partFile(spec);
    if (!file || !scaled) throw new Error('Select a model / Выберите модель');
    return scale === 100
      ? file
      : geometryFile(scaled, file.name.replace(/\.[^.]+$/, '') + '-' + scale + 'pct.stl');
  }
  function attach(recipient: string | null) {
    try {
      if (mode === 'builder' && !recipient) {
        sessionStorage.setItem('openprint.part.v1', JSON.stringify(spec));
        navigate('/projects/new?from=tools');
        return;
      }
      const model = modelFile();
      if (model.size > 20 * 1024 * 1024)
        throw new Error(t('Файл должен быть не больше 20 МБ', 'File must be 20 MB or smaller'));
      const query = new URLSearchParams({ from: 'model', attachment: stageFile(model) });
      if (recipient) query.set('target', recipient);
      navigate('/projects/new?' + query);
    } catch (err) {
      setError(errorText(err));
    }
  }
  function chooseMaker(maker: Maker) {
    if (busy || !info) return;
    setFallback(null);
    if (maker.origin === location.origin && appMode === 'community') {
      attach(maker.id);
      return;
    }
    const url = new URL('/tools', maker.origin);
    url.searchParams.set('target', maker.id);
    if (mode === 'builder') {
      url.hash = new URLSearchParams({ part: JSON.stringify(partSchema.parse(spec)) }).toString();
      window.location.assign(url.href);
      return;
    }
    try {
      const model = modelFile();
      if (model.size > 20 * 1024 * 1024)
        throw new Error(t('Файл должен быть не больше 20 МБ', 'File must be 20 MB or smaller'));
      stopTransfer.current?.();
      url.searchParams.set('mode', 'file');
      const manualURL = url.href;
      const expired = () => setFallback({ url: manualURL, file: model });
      stopTransfer.current = offerModel(url, model, expired);
      if (!stopTransfer.current) expired();
    } catch (err) {
      setError(errorText(err));
    }
  }
  function update(field: keyof PartSpec, value: string) {
    setInvalidPreset(false);
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
                  <option dir="auto" value="plate">
                    {t('Пластина с отверстием', 'Drilled plate')}
                  </option>
                  <option dir="auto" value="tube">
                    {t('Втулка', 'Spacer tube')}
                  </option>
                  <option dir="auto" value="block">
                    {t('Блок', 'Solid block')}
                  </option>
                </select>
              </label>
              <div className="form-grid">
                <label>
                  {spec.kind === 'tube'
                    ? t('Диаметр, мм', 'Diameter, mm')
                    : t('Ширина, мм', 'Width, mm')}
                  <input
                    dir="auto"
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
                      dir="auto"
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
                    dir="auto"
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
                      dir="auto"
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
                  dir="auto"
                  type="file"
                  accept=".stl,.obj"
                  disabled={busy}
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (chosen) void loadFile(chosen);
                  }}
                />
                <small>
                  {t('До 20 МБ · без отправки на сервер', 'Up to 20 MB · not sent to the server')}
                </small>
              </label>
              {fragment.has('transfer') && !file && (
                <button
                  className="button secondary"
                  disabled={busy || !sender}
                  onClick={() =>
                    void loadFile(Promise.resolve().then(() => receiveModel(fragment, sender!)))
                  }
                >
                  {t('Открыть STL или OBJ', 'Open an STL or OBJ')} ·{' '}
                  <bdi>{fragment.get('source')}</bdi>
                </button>
              )}
              {file && (
                <>
                  <p dir="auto" className="small muted">
                    {file.name}
                  </p>
                  <label>
                    {t('Масштаб, %', 'Scale, %')}
                    <input
                      type="number"
                      min="0.01"
                      max="1000"
                      step="any"
                      value={scale || ''}
                      onChange={(e) => setScale(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="button"
                    disabled={!scaled || !info}
                    onClick={() => {
                      if (scaled)
                        downloadFile(
                          geometryFile(
                            scaled,
                            file.name.replace(/\.[^.]+$/, '') + '-' + scale + 'pct.stl',
                          ),
                        );
                    }}
                  >
                    <Download size={15} />
                    {t('Скачать STL', 'Download STL')}
                  </button>
                </>
              )}
            </>
          )}
          <div className="stack">
            {target && appMode === 'community' && (
              <p>
                {t('Личный запрос для', 'Direct request for')}{' '}
                <strong dir="auto">{profile.data?.profile.name || '…'}</strong> ·{' '}
                <bdi>{location.host}</bdi>
              </p>
            )}
            {appMode === 'community' && (
              <button
                className="button secondary"
                disabled={
                  busy ||
                  !info ||
                  (!!target &&
                    (profile.loading || profile.data?.profile.id !== target || !!profile.error))
                }
                onClick={() => attach(target)}
              >
                {target
                  ? t('Личный запрос', 'Direct request')
                  : t('Использовать в проекте', 'Use in a project')}{' '}
                <ArrowUpRight size={15} />
              </button>
            )}
            {!target && (
              <button
                className="button secondary"
                disabled={!choosing && (busy || !info)}
                aria-expanded={choosing}
                onClick={() => setChoosing(!choosing)}
              >
                {t('Выберите исполнителя', 'Choose a maker')}
              </button>
            )}
            {appMode === 'community' && (
              <Link
                className="text-button"
                to={'/models' + (target ? '?target=' + encodeURIComponent(target) : '')}
              >
                {t('Библиотека моделей', 'Model library')}
              </Link>
            )}
            {target && appMode === 'catalog' && (
              <Link className="text-button" to="/network">
                {t(
                  'Выберите доступного исполнителя для личного запроса.',
                  'Choose an available provider for the direct request.',
                )}
              </Link>
            )}
            <ErrorBox error={error || profile.error} />
          </div>
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
                  {[info.width, info.depth, info.height]
                    .map((n) =>
                      n.toLocaleString(localeTag(lang), {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }),
                    )
                    .join(' × ')}
                </strong>
              </div>
              <div>
                <small>{t('ТРЕУГОЛЬНИКОВ', 'TRIANGLES')}</small>
                <strong>{info.triangles.toLocaleString(localeTag(lang))}</strong>
              </div>
              <div>
                <small>{t('ОБЪЁМ ПО СЕТКЕ, СМ³', 'MESH VOLUME, CM³')}</small>
                <strong>
                  {(info.volume / 1000).toLocaleString(localeTag(lang), {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  *
                </strong>
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
      {choosing && (
        <div ref={chooser}>
          {fallback && (
            <p className="info-box" role="status">
              {t(
                'Скачайте файл и откройте его на узле мастерской.',
                'Download the file and open it on the workshop’s node.',
              )}
              <button className="text-button" onClick={() => downloadFile(fallback.file)}>
                {t('Скачать файл', 'Download file')}
              </button>
              <a href={fallback.url} rel="noreferrer">
                {new URL(fallback.url).host}
              </a>
            </p>
          )}
          <Suspense fallback={<Loading />}>
            <WorkshopNetwork choose={chooseMaker} />
          </Suspense>
        </div>
      )}
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
