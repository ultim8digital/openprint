import { mkdir, copyFile } from 'node:fs/promises';
import { localeCodes } from '../shared/locales.ts';
await mkdir(new URL('../build/locales/', import.meta.url), { recursive: true });
await Promise.all(
  localeCodes
    .filter((lang) => lang !== 'en' && lang !== 'ru')
    .map((lang) =>
      copyFile(
        new URL(`../src/locales/${lang}.json`, import.meta.url),
        new URL(`../build/locales/${lang}.json`, import.meta.url),
      ),
    ),
);
