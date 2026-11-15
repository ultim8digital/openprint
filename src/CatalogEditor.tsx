import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Copy, Download, MapPin, Plus, Trash2 } from 'lucide-react';
import type { CatalogStudio, DirectoryResponse, PublicStudioInput } from '../shared/directory';
import { api, ApiError, useApp, Loading } from './core';

const LocationPicker = lazy(() => import('./CatalogLocationPicker'));
const keyPattern = /^[a-f0-9]{64}$/;
const pendingStorage = 'openprint.catalog.pending.v1';
const keyStorage = (id: string) => `openprint.catalog.key.v1.${id}`;
type Pending = { key: string; studio: PublicStudioInput };
type Draft = Omit<PublicStudioInput, 'technologies' | 'materials' | 'lat' | 'lng'> & {
  technologies: string;
  materials: string;
  lat: string;
  lng: string;
};
const emptyStudio: PublicStudioInput = {
  name: '',
  city: '',
  region: '',
  country: '',
  description: '',
  technologies: [],
  materials: [],
  website: '',
  phone: '',
  address: '',
  lat: null,
  lng: null,
};
const toDraft = (studio: PublicStudioInput): Draft => ({
  ...studio,
  technologies: studio.technologies.join(', '),
  materials: studio.materials.join(', '),
  lat: studio.lat === null ? '' : String(studio.lat),
  lng: studio.lng === null ? '' : String(studio.lng),
});
function readAccess(id?: string) {
  // Strip the private fragment before mounting effects or any optional external map content.
  const fragment = new URLSearchParams(location.hash.slice(1));
  const provided = fragment.get('key') || '';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  let key = keyPattern.test(provided) ? provided : '';
  let pending: Pending | null = null;
  let storageBlocked = false;
  try {
    if (id && !key) key = sessionStorage.getItem(keyStorage(id)) || '';
    if (!id) {
      const value = sessionStorage.getItem(pendingStorage);
      if (value) {
        const parsed: unknown = JSON.parse(value);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'key' in parsed &&
          typeof parsed.key === 'string' &&
          keyPattern.test(parsed.key) &&
          'studio' in parsed &&
          parsed.studio &&
          typeof parsed.studio === 'object' &&
          typeof (parsed.studio as PublicStudioInput).name === 'string'
        )
          pending = parsed as Pending;
      }
    }
  } catch {
    storageBlocked = true;
  }
  return { key: keyPattern.test(key) ? key : '', pending, storageBlocked };
}
function freshKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
function saveText(name: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SecretLink({ id, secret }: { id: string; secret: string }) {
  const { t } = useApp();
  const [message, setMessage] = useState('');
  const link = `${location.origin}/catalog/${id}/edit#key=${secret}`;
  return (
    <section className="catalog-secret" aria-labelledby="catalog-secret-title">
      <h2 id="catalog-secret-title">{t('Сохраните личную ссылку', 'Save your private link')}</h2>
      <p>
        {t(
          'Любой, у кого есть эта ссылка, может изменить или удалить запись. Сохраните её у себя: восстановить доступ без ключа невозможно. Не публикуйте ссылку и не пересылайте её клиентам.',
          'Anyone with this link can edit or delete the listing. Save it somewhere private: access cannot be recovered without the key. Do not publish it or send it to customers.',
        )}
      </p>
      <label>
        {t('Личная ссылка управления', 'Private management link')}
        <textarea
          readOnly
          rows={3}
          value={link}
          onFocus={(event) => event.target.select()}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="catalog-editor-actions">
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setMessage(t('Ссылка скопирована', 'Link copied'));
            } catch {
              setMessage(
                t('Выделите и скопируйте ссылку вручную.', 'Select and copy the link manually.'),
              );
            }
          }}
        >
          <Copy size={16} />
          {t('Копировать ссылку', 'Copy link')}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            saveText(
              `openprint-${id}-private.txt`,
              `OpenPrint — private management link\n${link}\n\nKeep this file private. Anyone with this key can edit or delete the listing.\n`,
            )
          }
        >
          <Download size={16} />
          {t('Скачать ключ', 'Download key')}
        </button>
      </div>
      <p role="status" className="micro">
        {message}
      </p>
    </section>
  );
}
function DuplicateFinder({
  name,
  city,
  exclude,
}: {
  name: string;
  city: string;
  exclude?: string;
}) {
  const { t } = useApp();
  const [result, setResult] = useState<{
    query: string;
    data: DirectoryResponse | null;
    failed: boolean;
  } | null>(null);
  const query = new URLSearchParams({
    source: 'catalog',
    q: name.trim().slice(0, 100),
    city: city.trim().slice(0, 100),
    limit: '5',
  }).toString();
  const enabled = name.trim().length >= 2 && city.trim().length >= 2;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<DirectoryResponse>('/directory?' + query, { signal: controller.signal }).then(
        (data) => {
          if (!controller.signal.aborted) setResult({ query, data, failed: false });
        },
        () => {
          if (!controller.signal.aborted) setResult({ query, data: null, failed: true });
        },
      );
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query]);
  if (!enabled || result?.query !== query) return null;
  const entries =
    result.data?.entries.filter(
      (entry) => entry.source === 'catalog' && entry.studio.id !== exclude,
    ) || [];
  if (!entries.length && !result.failed) return null;
  return (
    <aside
      className="info-box catalog-duplicates"
      aria-label={t('Похожие записи', 'Similar listings')}
    >
      <p>
        {result.failed
          ? t(
              'Не удалось проверить похожие записи. Перед добавлением можно поискать студию в каталоге.',
              'Could not check similar listings. You can search the directory before adding a studio.',
            )
          : t(
              'Похожие записи уже есть. Проверьте, не добавлена ли ваша студия.',
              'Similar listings exist. Check whether your studio is already listed.',
            )}
      </p>
      <ul>
        {entries.map(
          (entry) =>
            entry.source === 'catalog' && (
              <li key={entry.studio.id}>
                <Link target="_blank" rel="noreferrer" to={`/catalog/${entry.studio.id}`}>
                  {entry.studio.name} · {entry.studio.city}
                </Link>
              </li>
            ),
        )}
      </ul>
      <Link
        target="_blank"
        rel="noreferrer"
        to={`/studios?source=catalog&q=${encodeURIComponent(name.trim())}`}
      >
        {t('Поиск в каталоге', 'Search directory')}
      </Link>
    </aside>
  );
}

export default function CatalogEditor() {
  const { id } = useParams();
  return <Editor key={id || 'new'} id={id} />;
}
function Editor({ id }: { id?: string }) {
  const { t } = useApp();
  const [access] = useState(() => readAccess(id));
  const [secret, setSecret] = useState(access.key);
  const [keyInput, setKeyInput] = useState('');
  const [pending, setPending] = useState<Pending | null>(access.pending);
  const [studio, setStudio] = useState<CatalogStudio | null>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(access.pending?.studio || emptyStudio));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!id && !!access.key);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rights, setRights] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(access.storageBlocked);
  const [created, setCreated] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloadConfirmed, setReloadConfirmed] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const locked = busy || !!pending;
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(studio || emptyStudio));
  function persist(name: string, value: string | null) {
    try {
      value === null ? sessionStorage.removeItem(name) : sessionStorage.setItem(name, value);
    } catch {
      setStorageBlocked(true);
    }
  }
  function messageFor(caught: unknown) {
    const code = caught instanceof ApiError ? caught.code : '';
    const messages: Record<string, [string, string]> = {
      MANAGEMENT_KEY_INVALID: [
        'Ключ не подходит к этой записи. Проверьте личную ссылку или вставьте ключ заново.',
        'This key does not match the listing. Check your private link or enter the key again.',
      ],
      VERSION_CONFLICT: [
        'Запись уже изменена в другом окне. Ваши правки сохранены в форме. Загрузите актуальную запись только после сохранения нужных правок.',
        'This listing changed in another window. Your edits remain in the form. Save any needed edits before loading the latest listing.',
      ],
      DUPLICATE_STUDIO: [
        'Такая студия уже есть в каталоге. Найдите существующую запись ниже.',
        'This studio already exists in the directory. Find the existing listing below.',
      ],
      REQUEST_ID_REUSED: [
        'Этот ключ уже использован для другой публикации. Откройте ранее сохранённую личную ссылку.',
        'This key has already been used for another submission. Open your previously saved private link.',
      ],
      SUBMISSION_DELETED: [
        'Эта запись удалена. Старый ключ больше не позволяет её восстановить.',
        'This listing was deleted. Its old key cannot restore it.',
      ],
      RATE_LIMIT: [
        'Слишком много попыток. Подождите немного и повторите.',
        'Too many attempts. Wait a little and try again.',
      ],
      SUBMISSION_CAPACITY: [
        'Каталог временно не принимает новые записи. Попробуйте позже.',
        'The directory temporarily cannot accept new listings. Please try later.',
      ],
      VALIDATION: [
        'Проверьте поля: название и город, сайт или телефон, обе координаты или ни одной.',
        'Check the fields: name and city, website or phone, and either both coordinates or neither.',
      ],
    };
    const translated = messages[code];
    return translated
      ? t(...translated)
      : t(
          'Не удалось получить ответ сервера. Проверьте соединение и повторите действие.',
          'The server did not respond. Check your connection and retry.',
        );
  }
  useEffect(() => {
    if (!id || !secret) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<{ studio: CatalogStudio }>('/directory/submissions/' + id, {
      headers: { 'X-Catalog-Key': secret },
      signal: controller.signal,
    }).then(
      ({ studio: loaded }) => {
        if (controller.signal.aborted) return;
        setStudio(loaded);
        setDraft(toDraft(loaded));
        setLoading(false);
        try {
          sessionStorage.setItem(keyStorage(id), secret);
        } catch {
          setStorageBlocked(true);
        }
      },
      (caught) => {
        if (controller.signal.aborted) return;
        setError(messageFor(caught));
        setLoading(false);
        setSecret('');
        try {
          sessionStorage.removeItem(keyStorage(id));
        } catch {
          setStorageBlocked(true);
        }
      },
    );
    return () => controller.abort();
    // Language changes must not reload private data and overwrite unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, secret]);
  useEffect(() => {
    if ((!dirty && !pending && !busy) || created || deleted) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, pending, busy, created, deleted]);
  function change<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setRights(false);
    setNotice('');
  }
  function payload(): PublicStudioInput | null {
    const list = (value: string) => [
      ...new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
    const lat = draft.lat.trim() === '' ? null : Number(draft.lat);
    const lng = draft.lng.trim() === '' ? null : Number(draft.lng);
    const technologies = list(draft.technologies),
      materials = list(draft.materials);
    if (
      (lat === null) !== (lng === null) ||
      (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
    ) {
      setError(
        t(
          'Введите обе координаты: широта от −90 до 90, долгота от −180 до 180. Или очистите оба поля.',
          'Enter both coordinates: latitude from −90 to 90 and longitude from −180 to 180. Or clear both fields.',
        ),
      );
      return null;
    }
    if (!draft.website.trim() && !draft.phone.trim()) {
      setError(
        t(
          'Укажите сайт или телефон для прямой связи.',
          'Provide a website or phone for direct contact.',
        ),
      );
      return null;
    }
    if (draft.phone.trim() && !/^\+?\d{6,18}$/.test(draft.phone.trim().replace(/[\s().-]/g, ''))) {
      setError(
        t(
          'Телефон: от 6 до 18 цифр, можно с +, пробелами, скобками и дефисами. Добавочный номер укажите в описании.',
          'Use a phone number with 6 to 18 digits; +, spaces, parentheses, and hyphens are allowed. Put an extension in the description.',
        ),
      );
      return null;
    }
    if (draft.website.trim()) {
      try {
        const url = new URL(draft.website.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
          throw new Error();
      } catch {
        setError(
          t(
            'Сайт должен быть полным адресом http:// или https:// без логина и пароля.',
            'Use a full http:// or https:// website address without credentials.',
          ),
        );
        return null;
      }
    }
    if (
      technologies.length > 40 ||
      materials.length > 50 ||
      [...technologies, ...materials].some((value) => value.length > 100)
    ) {
      setError(
        t(
          'Сократите списки: до 40 технологий и 50 материалов, каждое название до 100 символов.',
          'Use up to 40 technologies and 50 materials, with each name up to 100 characters.',
        ),
      );
      return null;
    }
    return {
      ...draft,
      name: draft.name.trim(),
      city: draft.city.trim(),
      website: draft.website.trim(),
      phone: draft.phone.trim(),
      technologies,
      materials,
      lat,
      lng,
    };
  }
  async function publish(retry?: Pending) {
    const data = retry?.studio || payload();
    if (!data || (!retry && !rights)) return;
    const request = retry || { key: freshKey(), studio: data };
    setPending(request);
    persist(pendingStorage, JSON.stringify(request));
    setBusy(true);
    setError('');
    try {
      const result = await api<{ studio: CatalogStudio }>('/directory/submissions', {
        method: 'POST',
        body: JSON.stringify({
          management_key: request.key,
          studio: request.studio,
          rights_confirmed: true,
        }),
      });
      setStudio(result.studio);
      setSecret(request.key);
      setDraft(toDraft(result.studio));
      setCreated(true);
      setPending(null);
      persist(keyStorage(result.studio.id), request.key);
      persist(pendingStorage, null);
    } catch (caught) {
      setError(messageFor(caught));
      // Definite client failures did not create a record; ambiguous transport/5xx errors retain the exact request.
      if (
        caught instanceof ApiError &&
        caught.status >= 400 &&
        caught.status < 500 &&
        !['REQUEST_ID_REUSED', 'SUBMISSION_DELETED'].includes(caught.code)
      ) {
        setPending(null);
        persist(pendingStorage, null);
      }
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!id) {
      await publish();
      return;
    }
    const data = payload();
    if (!data || !studio || !rights) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ studio: CatalogStudio }>('/directory/submissions/' + id, {
        method: 'PATCH',
        headers: { 'X-Catalog-Key': secret },
        body: JSON.stringify({ studio: data, version: studio.version, rights_confirmed: true }),
      });
      setStudio(result.studio);
      setDraft(toDraft(result.studio));
      setRights(false);
      setConflict(false);
      setNotice(t('Изменения опубликованы', 'Changes published'));
    } catch (caught) {
      setError(messageFor(caught));
      if (caught instanceof ApiError && caught.code === 'VERSION_CONFLICT') setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  async function reloadLatest() {
    if (!reloadConfirmed) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ studio: CatalogStudio }>('/directory/submissions/' + id, {
        headers: { 'X-Catalog-Key': secret },
      });
      setStudio(result.studio);
      setDraft(toDraft(result.studio));
      setRights(false);
      setConflict(false);
      setReloadConfirmed(false);
      setDeleteOpen(false);
      setDeleteConfirmed(false);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!id || !studio || !deleteConfirmed) return;
    setBusy(true);
    setError('');
    try {
      await api('/directory/submissions/' + id, {
        method: 'DELETE',
        headers: { 'X-Catalog-Key': secret },
        body: JSON.stringify({ version: studio.version }),
      });
      persist(keyStorage(id), null);
      setDeleted(true);
      setSecret('');
      setKeyInput('');
      setStudio(null);
    } catch (caught) {
      setError(messageFor(caught));
      if (caught instanceof ApiError && caught.code === 'VERSION_CONFLICT') setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  const latValue =
    draft.lat.trim() !== '' &&
    Number.isFinite(Number(draft.lat)) &&
    Math.abs(Number(draft.lat)) <= 90
      ? Number(draft.lat)
      : null;
  const lngValue =
    draft.lng.trim() !== '' &&
    Number.isFinite(Number(draft.lng)) &&
    Math.abs(Number(draft.lng)) <= 180
      ? Number(draft.lng)
      : null;
  return (
    <div className="page narrow catalog-editor">
      <Link className="back-link" to="/studios">
        ← {t('Каталог студий', 'Studio directory')}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPENPRINT</span>
          <h1>
            {id ? t('Управление записью', 'Manage listing') : t('Добавить студию', 'Add a studio')}
          </h1>
          <p>
            {t(
              'Открытый каталог без регистрации. Публикация появляется сразу; клиенты связываются со студией напрямую.',
              'An open directory without sign-up. Listings are published immediately; customers contact studios directly.',
            )}
          </p>
        </div>
      </div>
      {storageBlocked && (
        <p className="info-box">
          {t(
            'Браузер не разрешает сохранить ключ на время сессии. Обязательно скопируйте или скачайте личную ссылку после публикации и не закрывайте страницу до получения ответа.',
            'This browser cannot keep the key for this session. Copy or download your private link after publishing and keep the page open until the server responds.',
          )}
        </p>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="info-box" role="status">
          {notice}
        </p>
      )}
      {deleted ? (
        <section className="panel">
          <h2>{t('Запись удалена', 'Listing deleted')}</h2>
          <p>
            {t(
              'Контакты и точка больше не доступны в каталоге. Ключ управления очищен из этой сессии.',
              'The contacts and map location are no longer in the directory. The management key was removed from this session.',
            )}
          </p>
          <Link className="button" to="/studios">
            {t('В каталог', 'Back to directory')}
          </Link>
        </section>
      ) : created && studio ? (
        <>
          <section className="panel">
            <h2>{t('Студия опубликована', 'Studio published')}</h2>
            <p>{studio.name}</p>
            <div className="catalog-editor-actions">
              <Link className="button" to={`/catalog/${studio.id}`}>
                {t('Открыть карточку', 'View listing')}
              </Link>
              <Link className="button secondary" to={`/catalog/${studio.id}/edit#key=${secret}`}>
                {t('Редактировать запись', 'Edit listing')}
              </Link>
            </div>
          </section>
          <SecretLink id={studio.id} secret={secret} />
        </>
      ) : loading ? (
        <Loading />
      ) : id && !studio ? (
        <form
          className="panel catalog-key-form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = keyInput.trim();
            if (!keyPattern.test(value)) {
              setError(
                t(
                  'Ключ должен содержать 64 строчных шестнадцатеричных символа. Используйте ключ из сохранённой личной ссылки.',
                  'The key must contain 64 lowercase hexadecimal characters. Use the key from your saved private link.',
                ),
              );
              return;
            }
            setSecret(value);
            setKeyInput('');
          }}
        >
          <h2>{t('Открыть с личным ключом', 'Open with your private key')}</h2>
          <p>
            {t(
              'Вставьте ключ из сохранённой ссылки управления. Для импортированных записей личные ключи не выдаются.',
              'Paste the key from your saved management link. Imported listings do not have private management keys.',
            )}
          </p>
          <label>
            {t('Ключ управления', 'Management key')}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
            />
          </label>
          <button className="button" type="submit">
            {t('Открыть запись', 'Open listing')}
          </button>
        </form>
      ) : (
        <>
          {id && studio && secret && <SecretLink id={studio.id} secret={secret} />}
          {pending && (
            <section className="info-box">
              <h2>{t('Проверить публикацию', 'Check publication')}</h2>
              <p>
                {t(
                  'Ответ пока не подтверждён. Повтор использует тот же ключ и те же данные, чтобы не добавить студию дважды. Правки доступны после получения результата.',
                  'The result is not confirmed yet. Retry uses the same key and data to avoid adding the studio twice. Editing resumes after the result is known.',
                )}
              </p>
              <button
                className="button secondary"
                disabled={busy}
                type="button"
                onClick={() => void publish(pending)}
              >
                {busy
                  ? t('Проверяем…', 'Checking…')
                  : t('Повторить с тем же ключом', 'Retry with the same key')}
              </button>
            </section>
          )}
          {conflict && (
            <section className="info-box catalog-conflict">
              <h2>{t('Сначала сохраните свои правки', 'Preserve your edits first')}</h2>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  saveText('studio-draft.json', JSON.stringify(draft, null, 2), 'application/json')
                }
              >
                {t('Скачать текущий черновик', 'Download current draft')}
              </button>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={reloadConfirmed}
                  onChange={(event) => setReloadConfirmed(event.target.checked)}
                />
                {t(
                  'Разрешаю заменить форму актуальной записью с сервера',
                  'Replace this form with the latest server listing',
                )}
              </label>
              <button
                type="button"
                className="button secondary"
                disabled={busy || !reloadConfirmed}
                onClick={() => void reloadLatest()}
              >
                {t('Загрузить актуальную запись', 'Load latest listing')}
              </button>
            </section>
          )}
          <form className="panel catalog-editor-form" onSubmit={(event) => void save(event)}>
            <h2>{t('О студии', 'About the studio')}</h2>
            <fieldset disabled={locked} className="catalog-form-fields">
              <legend className="sr-only">{t('Публичные сведения', 'Public details')}</legend>
              <div className="form-grid">
                <label className="span-2">
                  {t('Название студии', 'Studio name')} *
                  <input
                    required
                    minLength={2}
                    maxLength={200}
                    value={draft.name}
                    onChange={(event) => change('name', event.target.value)}
                    autoComplete="organization"
                  />
                </label>
                <label>
                  {t('Город', 'City')} *
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={draft.city}
                    onChange={(event) => change('city', event.target.value)}
                    autoComplete="address-level2"
                  />
                </label>
                <label>
                  {t('Регион', 'Region')}
                  <input
                    maxLength={160}
                    value={draft.region}
                    onChange={(event) => change('region', event.target.value)}
                    autoComplete="address-level1"
                  />
                </label>
                <label>
                  {t('Страна', 'Country')}
                  <input
                    maxLength={80}
                    value={draft.country}
                    onChange={(event) => change('country', event.target.value)}
                    autoComplete="country-name"
                  />
                </label>
                <label>
                  {t('Адрес', 'Address')}
                  <input
                    maxLength={500}
                    value={draft.address}
                    onChange={(event) => change('address', event.target.value)}
                    autoComplete="street-address"
                  />
                </label>
                <label className="span-2">
                  {t('Описание возможностей', 'Capabilities')}
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={draft.description}
                    onChange={(event) => change('description', event.target.value)}
                  />
                </label>
                <label>
                  {t('Технологии через запятую', 'Technologies, comma separated')}
                  <input
                    maxLength={4039}
                    placeholder="FDM, SLA, CNC"
                    value={draft.technologies}
                    onChange={(event) => change('technologies', event.target.value)}
                  />
                </label>
                <label>
                  {t('Материалы через запятую', 'Materials, comma separated')}
                  <input
                    maxLength={5049}
                    placeholder="PLA, PETG, ABS"
                    value={draft.materials}
                    onChange={(event) => change('materials', event.target.value)}
                  />
                </label>
              </div>
              <DuplicateFinder name={draft.name} city={draft.city} exclude={id} />
              <h2>{t('Контакты для клиентов', 'Customer contacts')}</h2>
              <p className="micro muted">
                {t(
                  'Нужен хотя бы сайт или телефон. Эти сведения будут общедоступны.',
                  'Provide at least a website or phone. These details will be public.',
                )}
              </p>
              <div className="form-grid">
                <label>
                  {t('Сайт', 'Website')}
                  <input
                    type="url"
                    maxLength={2048}
                    placeholder="https://studio.example"
                    value={draft.website}
                    onChange={(event) => change('website', event.target.value)}
                  />
                </label>
                <label>
                  {t('Телефон', 'Phone')}
                  <input
                    type="tel"
                    maxLength={100}
                    value={draft.phone}
                    onChange={(event) => change('phone', event.target.value)}
                    autoComplete="tel"
                  />
                </label>
              </div>
              <h2>{t('Точка на карте', 'Map location')}</h2>
              <p className="micro muted">
                {t(
                  'Необязательно. Без координат студия будет в списке, но без точки на карте. Адрес не отправляется в службы геокодирования.',
                  'Optional. Without coordinates the studio stays in the list but has no map marker. The address is not sent to geocoding services.',
                )}
              </p>
              <div className="form-grid">
                <label>
                  {t('Широта', 'Latitude')}
                  <input
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={draft.lat}
                    onChange={(event) => change('lat', event.target.value)}
                  />
                </label>
                <label>
                  {t('Долгота', 'Longitude')}
                  <input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={draft.lng}
                    onChange={(event) => change('lng', event.target.value)}
                  />
                </label>
              </div>
              <div className="catalog-editor-actions">
                <button
                  type="button"
                  className="text-button"
                  aria-expanded={mapOpen}
                  onClick={() => setMapOpen((value) => !value)}
                >
                  <MapPin size={16} />
                  {mapOpen
                    ? t('Скрыть выбор на карте', 'Hide map picker')
                    : t('Выбрать на карте', 'Choose on map')}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={locationBusy}
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setError(
                        t(
                          'Геолокация недоступна. Выберите точку или введите координаты.',
                          'Geolocation is unavailable. Choose a point or enter coordinates.',
                        ),
                      );
                      return;
                    }
                    setLocationBusy(true);
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setDraft((previous) => ({
                          ...previous,
                          lat: position.coords.latitude.toFixed(6),
                          lng: position.coords.longitude.toFixed(6),
                        }));
                        setRights(false);
                        setLocationBusy(false);
                      },
                      () => {
                        setError(
                          t(
                            'Не удалось определить местоположение. Выберите точку или введите координаты.',
                            'Could not determine your location. Choose a point or enter coordinates.',
                          ),
                        );
                        setLocationBusy(false);
                      },
                      { timeout: 10000 },
                    );
                  }}
                >
                  {locationBusy
                    ? t('Определяем…', 'Locating…')
                    : t('Моё местоположение', 'Use my location')}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setDraft((previous) => ({ ...previous, lat: '', lng: '' }));
                    setRights(false);
                  }}
                >
                  {t('Очистить координаты', 'Clear coordinates')}
                </button>
              </div>
              {mapOpen && (
                <Suspense fallback={<Loading />}>
                  <LocationPicker
                    lat={latValue !== null && lngValue !== null ? latValue : null}
                    lng={latValue !== null && lngValue !== null ? lngValue : null}
                    disabled={locked}
                    onChange={(lat, lng) => {
                      setDraft((previous) => ({ ...previous, lat: String(lat), lng: String(lng) }));
                      setRights(false);
                    }}
                  />
                </Suspense>
              )}
              <label className="check-label catalog-rights">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(event) => setRights(event.target.checked)}
                />
                {t(
                  'У меня есть право публиковать эти сведения и контакты от имени организации. Я согласен на их открытое размещение.',
                  'I am authorized to publish these details and contacts on behalf of the organization, and agree to make them public.',
                )}
              </label>
              <button
                className="button"
                type="submit"
                disabled={!rights || conflict || (id ? !dirty : false)}
              >
                <Plus size={17} />
                {busy
                  ? t('Сохраняем…', 'Saving…')
                  : id
                    ? t('Опубликовать изменения', 'Publish changes')
                    : t('Опубликовать студию', 'Publish studio')}
              </button>
            </fieldset>
          </form>
          {id && studio && (
            <section className="panel catalog-delete">
              <h2>{t('Удаление записи', 'Delete listing')}</h2>
              <p>
                {t(
                  'Запись исчезнет из списка и с карты. Восстановить её этим ключом будет нельзя.',
                  'The listing will disappear from the list and map. This key cannot restore it.',
                )}
              </p>
              {!deleteOpen ? (
                <button
                  className="text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 size={16} />
                  {t('Удалить запись…', 'Delete listing…')}
                </button>
              ) : (
                <>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(event) => setDeleteConfirmed(event.target.checked)}
                    />
                    {t(
                      'Подтверждаю окончательное удаление этой записи',
                      'I confirm permanent deletion of this listing',
                    )}
                  </label>
                  <div className="catalog-editor-actions">
                    <button
                      type="button"
                      className="button danger"
                      disabled={busy || !deleteConfirmed || conflict}
                      onClick={() => void remove()}
                    >
                      {t('Удалить окончательно', 'Delete permanently')}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => {
                        setDeleteOpen(false);
                        setDeleteConfirmed(false);
                      }}
                    >
                      {t('Отмена', 'Cancel')}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
