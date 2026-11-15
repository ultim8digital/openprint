import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { messageId, interpolate, type Translator } from '../shared/messages.js';
import { localeCodes, type Lang } from '../shared/locales.js';

const cache = new Map<Lang, Record<string, string>>();
function messages(language: Lang): Record<string, string> {
  const saved = cache.get(language);
  if (saved) return saved;
  if (!localeCodes.includes(language)) throw new Error('Unsupported locale');
  // Production builds copy dictionaries beside the compiled server; source runs use src/locales.
  const directory = import.meta.url.endsWith('.ts') ? '../src/locales/' : '../locales/';
  const result = JSON.parse(
    readFileSync(fileURLToPath(new URL(`${directory}${language}.json`, import.meta.url)), 'utf8'),
  ) as Record<string, string>;
  cache.set(language, result);
  return result;
}
export function createTranslator(language: Lang): Translator {
  const dictionary = language === 'ru' || language === 'en' ? null : messages(language);
  return (ru, en, params) =>
    interpolate(language === 'ru' ? ru : (dictionary?.[messageId(ru, en)] ?? en), params);
}
