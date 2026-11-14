import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Paperclip, ShieldCheck, Upload, X } from 'lucide-react';
import { useApp, useRemote, post, upload, ErrorBox, errorText, formatMoney } from './core';
import { PageTitle } from './Browse';
import { technologies, technologyName, materials, currencies, type Profile } from '../shared/types';
import { minorUnits, jobInput } from '../shared/validation';
type Draft = {
  title: string;
  description: string;
  kind: 'print' | 'design' | 'repair';
  city: string;
  technology: string;
  material: string;
  quantity: string;
  currency: string;
  budget: string;
  deadline: string;
  target: string | null;
};
export default function NewProject() {
  const { t, user, lang, refresh } = useApp(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    key = `openprint.draft.v1.${user!.id}`;
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft>(() => {
    const initial: Draft = {
      title: '',
      description: '',
      kind: params.get('kind') === 'design' ? 'design' : 'print',
      city: '',
      technology: 'Any',
      material: 'Any',
      quantity: '1',
      currency: 'RUB',
      budget: '',
      deadline: '',
      target: params.get('target'),
    };
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
      return stored && typeof stored.title === 'string' && !params.get('target')
        ? { ...initial, ...stored }
        : initial;
    } catch {
      return initial;
    }
  });
  const target = useRemote<{ profile: Profile }>(draft.target ? '/profiles/' + draft.target : null);
  const set = (field: keyof Draft, value: string | null) =>
    setDraft((d) => ({
      ...d,
      [field]: value,
      ...(field === 'technology' ? { material: 'Any' } : {}),
    }));
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {}
  }, [draft, key]);
  useEffect(() => {
    if (params.get('from') === 'tools') {
      import('./model-files')
        .then(async (module) => {
          const stored = sessionStorage.getItem('openprint.part.v1');
          if (stored) {
            const spec = JSON.parse(stored);
            setFile(module.partFile(spec));
          }
        })
        .catch((error) => setError(errorText(error)));
    }
  }, [params]);
  const input = () => ({
    title: draft.title,
    description: draft.description,
    kind: draft.kind,
    city: draft.city,
    technology: draft.technology,
    material: draft.material,
    quantity: Number(draft.quantity),
    currency: draft.currency,
    budget: minorUnits(draft.budget),
    deadline: draft.deadline,
    visibility: draft.target ? 'direct' : 'public',
    target_profile_id: draft.target,
    file_id: null as string | null,
  });
  async function next(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step < 2) {
      if (step === 1) {
        try {
          const result = jobInput.safeParse(input());
          if (!result.success) {
            setError(result.error.issues.map((i) => i.message).join('; '));
            return;
          }
        } catch (error) {
          setError(errorText(error));
          return;
        }
      }
      setStep((s) => s + 1);
      return;
    }
    setBusy(true);
    try {
      const body = input();
      if (file) body.file_id = (await upload(file)).file.id;
      const result = await post<{ id: string }>('/projects', body);
      sessionStorage.removeItem(key);
      sessionStorage.removeItem('openprint.part.v1');
      await refresh();
      navigate('/projects/' + result.id);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const kindLabel =
    draft.kind === 'design'
      ? t('Проектирование', 'Design')
      : draft.kind === 'repair'
        ? t('Ремонт детали', 'Repair')
        : t('Изготовление', 'Manufacturing');
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow={t('ОДИН ШАГ БЛИЖЕ К РЕЗУЛЬТАТУ', 'ONE STEP CLOSER TO SOMETHING REAL')}
        title={t('Расскажите о вашей идее.', 'Tell us what you have in mind.')}
        description={t(
          'Хорошее описание помогает получить точное предложение. Модель можно приложить позже — для начала достаточно задачи и размеров.',
          'A clear brief helps makers quote accurately. Start with your needs and dimensions, even if you don’t have a model yet.',
        )}
      />
      <div className="steps">
        {[t('Идея', 'Your idea'), t('Детали', 'The details'), t('Проверка', 'Review')].map(
          (name, i) => (
            <div className={step >= i ? 'active' : ''} key={name}>
              <span>{step > i ? <Check size={11} /> : i + 1}</span>
              {name}
            </div>
          ),
        )}
      </div>
      <form className="panel" onSubmit={next}>
        {step === 0 && (
          <div className="stack">
            <label>
              {t('Что нужно сделать?', 'What would you like to make?')}
              <input
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
                required
                minLength={5}
                maxLength={120}
                placeholder={t(
                  'Например, корпус для метеостанции',
                  'For example, an enclosure for a weather station',
                )}
              />
            </label>
            <div className="form-grid">
              <label>
                {t('Тип проекта', 'Project type')}
                <select value={draft.kind} onChange={(e) => set('kind', e.target.value)}>
                  <option value="print">{t('Изготовить изделие', 'Manufacture a product')}</option>
                  <option value="design">{t('Спроектировать модель', 'Design a model')}</option>
                  <option value="repair">{t('Восстановить деталь', 'Repair a part')}</option>
                </select>
              </label>
              <label>
                {t('Город или «Удалённо»', 'City or “Remote”')}
                <input
                  value={draft.city}
                  onChange={(e) => set('city', e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder={t('Москва', 'Your city')}
                />
              </label>
            </div>
            <label>
              {t('Описание задачи', 'Project brief')}
              <textarea
                aria-label={t('Описание задачи', 'Project brief')}
                aria-describedby="brief-privacy"
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
                rows={7}
                minLength={30}
                maxLength={6000}
                required
                placeholder={t(
                  'Для чего нужна деталь? Какие размеры, нагрузки и особенности важны? Что должно получиться в итоге?',
                  'What is the part for? What dimensions, loads, and details matter? What would a successful result look like?',
                )}
              />
              <small id="brief-privacy">
                {t(
                  'Не указывайте здесь личные контакты и конфиденциальную информацию. Обсудить детали можно в закрытой переписке.',
                  'Keep personal contact details and confidential information out of this brief. Use the private conversation for details.',
                )}
              </small>
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            <div className="form-grid">
              <label>
                {t('Технология', 'Technology')}
                <select
                  value={draft.technology}
                  onChange={(e) => set('technology', e.target.value)}
                >
                  <option value="Any">{t('Помогите выбрать', 'Help me choose')}</option>
                  {technologies.map((s) => (
                    <option key={s} value={s}>
                      {technologyName(s, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Материал', 'Material')}
                <select value={draft.material} onChange={(e) => set('material', e.target.value)}>
                  {materials.map((s) => (
                    <option key={s} value={s}>
                      {s === 'Any' ? t('Помогите выбрать', 'Help me choose') : s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Количество', 'Quantity')}
                <input
                  type="number"
                  min={1}
                  max={10000}
                  required
                  value={draft.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                />
              </label>
              <label>
                {t('Желаемая дата · необязательно', 'Preferred date · optional')}
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={draft.deadline}
                  onChange={(e) => set('deadline', e.target.value)}
                />
              </label>
              <label>
                {t('Бюджет · необязательно', 'Budget · optional')}
                <input
                  inputMode="decimal"
                  value={draft.budget}
                  onChange={(e) => set('budget', e.target.value)}
                  placeholder={t(
                    'Оставьте пустым для предложений',
                    'Leave empty to receive quotes',
                  )}
                />
              </label>
              <label>
                {t('Валюта', 'Currency')}
                <select value={draft.currency} onChange={(e) => set('currency', e.target.value)}>
                  {currencies.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="upload-box">
              <Upload size={25} />
              <label>
                {t('Файл модели · необязательно', 'Model file · optional')}
                <input
                  type="file"
                  accept=".stl,.obj,.step,.stp,.3mf,.glb"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (chosen && chosen.size > 20 * 1024 * 1024) {
                      setError(
                        t('Файл должен быть не больше 20 МБ', 'File must be 20 MB or smaller'),
                      );
                      return;
                    }
                    setFile(chosen || null);
                  }}
                />
                <small>STL, OBJ, STEP, 3MF, GLB · {t('до 20 МБ', 'up to 20 MB')}</small>
                {file && (
                  <small>
                    <Paperclip size={12} /> {file.name} · {(file.size / 1024).toFixed(1)} KB
                  </small>
                )}
              </label>
              {file && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('Убрать файл', 'Remove file')}
                  onClick={() => setFile(null)}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="info-box">
              <ShieldCheck size={15} />{' '}
              {t(
                'Приложенный файл увидите только вы и выбранный исполнитель. Для предварительной оценки укажите размеры и требования в описании. Файл загружается при публикации проекта.',
                'Only you and your selected provider can access the attachment. Include dimensions and requirements in the brief so makers can quote. The file uploads when you publish.',
              )}
            </div>
          </div>
        )}
        {step === 2 && (
          <>
            <span className="eyebrow">{t('ВСЁ ГОТОВО К СТАРТУ', 'READY TO GET STARTED')}</span>
            <h2 style={{ marginTop: 12 }}>{draft.title}</h2>
            <p className="prose" style={{ marginTop: 20 }}>
              {draft.description}
            </p>
            <dl className="review-grid">
              {[
                [t('Тип проекта', 'Project type'), kindLabel],
                [t('Город', 'City'), draft.city],
                [
                  t('Технология / материал', 'Technology / material'),
                  `${draft.technology} / ${draft.material}`,
                ],
                [t('Количество', 'Quantity'), draft.quantity],
                [
                  t('Бюджет', 'Budget'),
                  draft.budget
                    ? formatMoney(minorUnits(draft.budget)!, draft.currency, lang)
                    : t('По предложению исполнителя', 'Open to quotes'),
                ],
                [t('Файл', 'File'), file?.name || t('Без файла', 'No attachment')],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {draft.target ? (
              <div className="info-box">
                {t('Личный запрос для', 'Direct request for')}{' '}
                <strong>{target.data?.profile.name || '…'}</strong>.{' '}
                {t('Его не будет в общей ленте.', 'It won’t appear on the public board.')}
                <br />
                <button type="button" className="text-button" onClick={() => set('target', null)}>
                  {t('Отправить в общую ленту', 'Post on the public board instead')}
                </button>
              </div>
            ) : (
              <div className="info-box">
                {t(
                  'Название, описание, город, требования и бюджет появятся в открытой ленте. Файл останется закрытым до выбора исполнителя.',
                  'Your title, brief, city, requirements, and budget will appear on the public board. The file stays private until you select a provider.',
                )}
              </div>
            )}
            <label className="check-label">
              <input type="checkbox" required />
              {t(
                'Описание проверено. У меня есть права на приложенные материалы.',
                'I’ve checked the brief and have rights to the attached materials.',
              )}
            </label>
          </>
        )}
        <ErrorBox error={error || target.error} />
        <div className="form-actions">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => (step ? setStep((s) => s - 1) : navigate('/projects'))}
          >
            <ArrowLeft size={15} />
            {t('Назад', 'Back')}
          </button>
          <button className="button" disabled={busy || !!target.error}>
            {busy
              ? t('Публикуем…', 'Publishing…')
              : step === 2
                ? t('Опубликовать проект', 'Publish project')
                : t('Продолжить', 'Continue')}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
      <p className="micro muted" style={{ marginTop: 16, textAlign: 'center' }}>
        {t(
          'Черновик сохраняется в этой вкладке. Файл нужно выбрать заново после обновления страницы.',
          'Your brief is saved in this tab. Re-select an attached file after reloading.',
        )}
      </p>
    </div>
  );
}
