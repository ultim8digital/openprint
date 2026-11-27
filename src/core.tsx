import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { User, Profile } from '../shared/types';
import { normalizeLocale, localeTag, localeDirection, type Lang } from '../shared/locales';
import type { Translator } from '../shared/messages';
import { loadLocale, localeLoaded, translate, setActiveLanguage } from './i18n';
import { localizedError } from './errors';
export type { Lang } from '../shared/locales';
export type Bootstrap = {
  mode: 'catalog' | 'community';
  user: User | null;
  profile: Profile | null;
  stats: { profiles: number; projects: number; models: number; completed: number };
  unread: number;
  demo: boolean;
  demoUsers: Pick<User, 'id' | 'name' | 'email'>[];
  instance: string;
  operatorContact: string;
  mapTiles: boolean;
};
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || `Error ${response.status}`,
      data.code || 'ERROR',
      response.status,
    );
  return data as T;
}
export const post = <T = Record<string, unknown>,>(path: string, body: unknown, method = 'POST') =>
  api<T>(path, { method, body: JSON.stringify(body) });
export async function upload(file: File) {
  return api<{ file: { id: string; name: string; size: number } }>('/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
}
export function useRemote<T>(path: string | null, key: unknown = '') {
  const { t } = useApp();
  const [data, setData] = useState<T | null>(null),
    [failure, setFailure] = useState<unknown>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailure(null);
    api<T>(path, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setFailure(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, key, revision]);
  return { data, error: failure ? localizedError(failure, t) : '', loading, reload };
}
const empty: Bootstrap = {
  mode: 'catalog',
  user: null,
  profile: null,
  stats: { profiles: 0, projects: 0, models: 0, completed: 0 },
  unread: 0,
  demo: false,
  demoUsers: [],
  instance: 'OpenPrint',
  operatorContact: '',
  mapTiles: true,
};
type Context = Bootstrap & {
  lang: Lang;
  t: Translator;
  refresh: () => Promise<void>;
  toast: (message: string) => void;
  loading: boolean;
  languageLoading: boolean;
};
const AppContext = createContext<Context>(null!);
export const useApp = () => useContext(AppContext);
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(empty),
    [loading, setLoading] = useState(true),
    [lang, setLang] = useState<Lang>(() => {
      try {
        return normalizeLocale(localStorage.getItem('openprint.language')) ?? 'ru';
      } catch {
        return 'ru';
      }
    }),
    [languageLoading, setLanguageLoading] = useState(false),
    [languageReady, setLanguageReady] = useState(() => localeLoaded(lang)),
    [message, setMessage] = useState('');
  const languageRequest = useRef(0);
  const changeLanguage = useCallback(
    (next: Lang) => {
      const request = ++languageRequest.current;
      setLanguageLoading(true);
      void loadLocale(next)
        .then(() => {
          if (request !== languageRequest.current) return;
          setActiveLanguage(next);
          setLang(next);
          setLanguageReady(true);
        })
        .catch(() => {
          if (request !== languageRequest.current) return;
          setMessage(
            translate(
              lang,
              'Не удалось загрузить язык. Проверьте соединение и повторите.',
              'The language could not be loaded. Check your connection and try again.',
            ),
          );
          if (!localeLoaded(lang)) {
            setLang('ru');
            setActiveLanguage('ru');
          }
          setLanguageReady(true);
        })
        .finally(() => {
          if (request === languageRequest.current) setLanguageLoading(false);
        });
    },
    [lang],
  );
  useEffect(() => {
    if (!localeLoaded(lang)) changeLanguage(lang);
    return () => {
      languageRequest.current++;
    };
  }, []);
  const refresh = useCallback(async () => {
    setState(await api<Bootstrap>('/bootstrap'));
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh().catch(() => setLoading(false));
    const update = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {});
    };
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = localeTag(lang);
    document.documentElement.dir = localeDirection(lang);
    setActiveLanguage(lang);
    try {
      localStorage.setItem('openprint.language', lang);
    } catch {
      /* Private browsing can disable storage. */
    }
  }, [lang]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const t: Translator = useCallback((ru, en, params) => translate(lang, ru, en, params), [lang]);
  return (
    <AppContext.Provider
      value={{ ...state, lang, t, refresh, toast: setMessage, loading, languageLoading }}
    >
      <LanguageContext.Provider value={changeLanguage}>
        {languageReady ? (
          children
        ) : (
          <div
            className="loading"
            role="status"
            aria-label={t('Загрузка языка…', 'Loading language…')}
          >
            <span className="spinner" />
          </div>
        )}
        <div className={'toast' + (message ? ' visible' : '')} role="status" aria-live="polite">
          {message}
        </div>
      </LanguageContext.Provider>
    </AppContext.Provider>
  );
}
export const LanguageContext = createContext<(lang: Lang) => void>(() => {});
export const formatMoney = (minor: number, currency: string, lang: Lang = 'ru') =>
  new Intl.NumberFormat(localeTag(lang), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
export const formatDate = (time: number, lang: Lang = 'ru') =>
  new Intl.DateTimeFormat(localeTag(lang), {
    day: 'numeric',
    month: 'short',
  }).format(time);
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
export const errorText = localizedError;
export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  const { t } = useApp();
  return error ? (
    <div className="error-box" role="alert">
      <span>{localizedError(error, t)}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          {t('Повторить', 'Try again')}
        </button>
      )}
    </div>
  ) : null;
}
export function Loading() {
  const { t } = useApp();
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {t('Загружаем…', 'Loading…')}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">↗</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export const statuses: Record<string, [string, string]> = {
  open: ['Принимает предложения', 'Open for offers'],
  assigned: ['В работе', 'In progress'],
  delivered: ['Ждёт подтверждения', 'Awaiting confirmation'],
  completed: ['Завершён', 'Completed'],
  cancelled: ['Отменён', 'Cancelled'],
  active: ['Активно', 'Active'],
  superseded: ['Предыдущая версия', 'Earlier revision'],
  accepted: ['Принято', 'Accepted'],
  declined: ['Закрыто', 'Closed'],
  withdrawn: ['Отозвано', 'Withdrawn'],
};
export function Status({ value }: { value: string }) {
  const { t } = useApp();
  const pair = statuses[value] || [value, value];
  return (
    <span className={`status status-${value}`}>
      <i />
      {t(...pair)}
    </span>
  );
}
