/** The same 50 regional locales used by our apps. `en` preserves existing saved preferences. */
export const localeCodes = [
  'en',
  'es-ES',
  'ar-SA',
  'fr-FR',
  'hi',
  'th',
  'ru',
  'de-DE',
  'it',
  'pt-BR',
  'nl-NL',
  'sv',
  'da',
  'no',
  'tr',
  'vi',
  'ja',
  'ko',
  'zh-Hans',
  'zh-Hant',
  'en-GB',
  'en-AU',
  'en-CA',
  'es-MX',
  'fr-CA',
  'pt-PT',
  'pl',
  'uk',
  'id',
  'cs',
  'sk',
  'hu',
  'ro',
  'hr',
  'el',
  'fi',
  'sl-SI',
  'ca',
  'he',
  'ms',
  'bn-BD',
  'gu-IN',
  'kn-IN',
  'ml-IN',
  'mr-IN',
  'or-IN',
  'pa-IN',
  'ta-IN',
  'te-IN',
  'ur-PK',
] as const;
export type Lang = (typeof localeCodes)[number];
export type Locale = {
  code: Lang;
  name: string;
  englishName: string;
  tag: string;
  dir: 'ltr' | 'rtl';
};
const names: Record<Lang, [string, string]> = {
  en: ['English (US)', 'English (United States)'],
  'es-ES': ['Español (España)', 'Spanish (Spain)'],
  'ar-SA': ['العربية', 'Arabic'],
  'fr-FR': ['Français (France)', 'French (France)'],
  hi: ['हिन्दी', 'Hindi'],
  th: ['ไทย', 'Thai'],
  ru: ['Русский', 'Russian'],
  'de-DE': ['Deutsch', 'German'],
  it: ['Italiano', 'Italian'],
  'pt-BR': ['Português (Brasil)', 'Portuguese (Brazil)'],
  'nl-NL': ['Nederlands', 'Dutch'],
  sv: ['Svenska', 'Swedish'],
  da: ['Dansk', 'Danish'],
  no: ['Norsk bokmål', 'Norwegian Bokmål'],
  tr: ['Türkçe', 'Turkish'],
  vi: ['Tiếng Việt', 'Vietnamese'],
  ja: ['日本語', 'Japanese'],
  ko: ['한국어', 'Korean'],
  'zh-Hans': ['简体中文', 'Chinese (Simplified)'],
  'zh-Hant': ['繁體中文', 'Chinese (Traditional)'],
  'en-GB': ['English (UK)', 'English (United Kingdom)'],
  'en-AU': ['English (Australia)', 'English (Australia)'],
  'en-CA': ['English (Canada)', 'English (Canada)'],
  'es-MX': ['Español (México)', 'Spanish (Mexico)'],
  'fr-CA': ['Français (Canada)', 'French (Canada)'],
  'pt-PT': ['Português (Portugal)', 'Portuguese (Portugal)'],
  pl: ['Polski', 'Polish'],
  uk: ['Українська', 'Ukrainian'],
  id: ['Bahasa Indonesia', 'Indonesian'],
  cs: ['Čeština', 'Czech'],
  sk: ['Slovenčina', 'Slovak'],
  hu: ['Magyar', 'Hungarian'],
  ro: ['Română', 'Romanian'],
  hr: ['Hrvatski', 'Croatian'],
  el: ['Ελληνικά', 'Greek'],
  fi: ['Suomi', 'Finnish'],
  'sl-SI': ['Slovenščina', 'Slovenian'],
  ca: ['Català', 'Catalan'],
  he: ['עברית', 'Hebrew'],
  ms: ['Bahasa Melayu', 'Malay'],
  'bn-BD': ['বাংলা', 'Bengali'],
  'gu-IN': ['ગુજરાતી', 'Gujarati'],
  'kn-IN': ['ಕನ್ನಡ', 'Kannada'],
  'ml-IN': ['മലയാളം', 'Malayalam'],
  'mr-IN': ['मराठी', 'Marathi'],
  'or-IN': ['ଓଡ଼ିଆ', 'Odia'],
  'pa-IN': ['ਪੰਜਾਬੀ', 'Punjabi'],
  'ta-IN': ['தமிழ்', 'Tamil'],
  'te-IN': ['తెలుగు', 'Telugu'],
  'ur-PK': ['اردو', 'Urdu'],
};
export const LOCALES: readonly Locale[] = localeCodes.map((code) => ({
  code,
  name: names[code][0],
  englishName: names[code][1],
  tag: code === 'en' ? 'en-US' : code === 'no' ? 'nb-NO' : code,
  dir: code === 'ar-SA' || code === 'he' || code === 'ur-PK' ? 'rtl' : 'ltr',
}));
const byCode = new Map(LOCALES.map((locale) => [locale.code, locale]));
export const localeInfo = (lang: Lang): Locale => byCode.get(lang)!;
export const localeTag = (lang: Lang): string => localeInfo(lang).tag;
export const localeDirection = (lang: Lang): 'ltr' | 'rtl' => localeInfo(lang).dir;
export function normalizeLocale(value: unknown): Lang | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll('_', '-').toLowerCase();
  const exact = LOCALES.find(
    (locale) => locale.code.toLowerCase() === normalized || locale.tag.toLowerCase() === normalized,
  );
  if (exact) return exact.code;
  if (['zh', 'zh-cn', 'zh-sg'].includes(normalized)) return 'zh-Hans';
  if (['zh-tw', 'zh-hk', 'zh-mo'].includes(normalized)) return 'zh-Hant';
  if (['nb', 'nb-no', 'no-no'].includes(normalized)) return 'no';
  return LOCALES.find((locale) => locale.code.split('-')[0] === normalized)?.code ?? null;
}
