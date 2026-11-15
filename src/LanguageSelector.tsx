import { useContext } from 'react';
import { Globe2 } from 'lucide-react';
import { LOCALES, normalizeLocale } from '../shared/locales';
import { LanguageContext, useApp } from './core';

export default function LanguageSelector() {
  const { lang, t, languageLoading } = useApp();
  const setLanguage = useContext(LanguageContext);
  return (
    <label className="language-select">
      <Globe2 size={16} aria-hidden="true" />
      <select
        aria-label={t('Язык', 'Language')}
        aria-busy={languageLoading}
        value={lang}
        onChange={(event) => {
          const next = normalizeLocale(event.target.value);
          if (next) setLanguage(next);
        }}
      >
        {LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code} lang={locale.tag} dir={locale.dir}>
            {locale.name}
          </option>
        ))}
      </select>
    </label>
  );
}
