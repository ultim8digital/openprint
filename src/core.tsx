import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Profile } from '../shared/types';
export type Lang = 'ru' | 'en';
export type Bootstrap = {
  user: User | null;
  profile: Profile | null;
  stats: { profiles: number; projects: number; models: number; completed: number };
  unread: number;
  demo: boolean;
  demoUsers: Pick<User, 'id' | 'name' | 'email'>[];
  instance: string;
  operatorContact: string;
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
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
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
    setError('');
    api<T>(path, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, key, revision]);
  return { data, error, loading, reload };
}
const empty: Bootstrap = {
  user: null,
  profile: null,
  stats: { profiles: 0, projects: 0, models: 0, completed: 0 },
  unread: 0,
  demo: false,
  demoUsers: [],
  instance: 'OpenPrint',
  operatorContact: '',
};
type Context = Bootstrap & {
  lang: Lang;
  t: (ru: string, en: string) => string;
  refresh: () => Promise<void>;
  toast: (message: string) => void;
  loading: boolean;
};
const AppContext = createContext<Context>(null!);
export const useApp = () => useContext(AppContext);
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(empty),
    [loading, setLoading] = useState(true),
    [lang, setLang] = useState<Lang>(() =>
      localStorage.getItem('openprint.language') === 'en' ? 'en' : 'ru',
    ),
    [message, setMessage] = useState('');
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
    document.documentElement.lang = lang;
    localStorage.setItem('openprint.language', lang);
  }, [lang]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const t = useCallback((ru: string, en: string) => (lang === 'ru' ? ru : en), [lang]);
  return (
    <AppContext.Provider value={{ ...state, lang, t, refresh, toast: setMessage, loading }}>
      <LanguageContext.Provider value={setLang}>
        {children}
        <div className={'toast' + (message ? ' visible' : '')} role="status" aria-live="polite">
          {message}
        </div>
      </LanguageContext.Provider>
    </AppContext.Provider>
  );
}
export const LanguageContext = createContext<(lang: Lang) => void>(() => {});
export const formatMoney = (minor: number, currency: string, lang: Lang = 'ru') =>
  new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
export const formatDate = (time: number, lang: Lang = 'ru') =>
  new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {
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
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  const { t } = useApp();
  return error ? (
    <div className="error-box" role="alert">
      <span>{error}</span>
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
