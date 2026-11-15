import type { Lang } from '../shared/locales';
import { messageId, interpolate, type MessageParams } from '../shared/messages';

// Bundle the small URL manifest, not the translations. Data fetches can retry after an
// offline failure without reusing a rejected module import from the browser cache.
const urls = import.meta.glob<string>(['./locales/*.json', '!./locales/source.json'], {
  query: '?url',
  import: 'default',
  eager: true,
});
const dictionaries = new Map<Lang, Record<string, string>>();
const pending = new Map<Lang, Promise<void>>();
let activeLanguage: Lang = 'ru';
export const getActiveLanguage = () => activeLanguage;
export const setActiveLanguage = (lang: Lang) => {
  activeLanguage = lang;
};
export const localeLoaded = (lang: Lang) =>
  lang === 'ru' || lang === 'en' || dictionaries.has(lang);
export function loadLocale(lang: Lang): Promise<void> {
  if (localeLoaded(lang)) return Promise.resolve();
  const existing = pending.get(lang);
  if (existing) return existing;
  const url = urls[`./locales/${lang}.json`];
  if (!url) return Promise.reject(new Error('Locale is unavailable'));
  const request = fetch(url, { signal: AbortSignal.timeout(20000) })
    .then(async (response) => {
      if (!response.ok) throw new Error('Locale download failed');
      const messages: unknown = await response.json();
      if (
        !messages ||
        typeof messages !== 'object' ||
        Array.isArray(messages) ||
        Object.values(messages).some((value) => typeof value !== 'string')
      )
        throw new Error('Invalid locale data');
      return messages as Record<string, string>;
    })
    .then((messages) => {
      dictionaries.set(lang, messages);
    })
    .finally(() => pending.delete(lang));
  pending.set(lang, request);
  return request;
}
/** Re-render errors saved as strings in older forms when their language changes. */
export function matchesTranslation(value: string, ru: string, en: string): boolean {
  if (value === ru || value === en) return true;
  const id = messageId(ru, en);
  for (const dictionary of dictionaries.values()) if (dictionary[id] === value) return true;
  return false;
}
export function translate(lang: Lang, ru: string, en: string, params?: MessageParams): string {
  return interpolate(
    lang === 'ru' ? ru : lang === 'en' ? en : (dictionaries.get(lang)?.[messageId(ru, en)] ?? en),
    params,
  );
}
