import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { LOCALES, localeTag, localeDirection, type Lang } from '../../shared/locales';
import { messageId } from '../../shared/messages';

test.skip(
  process.env.E2E_CATALOG_MODE !== '1',
  'Run through npm run test:e2e for an isolated public catalog',
);
const dictionaries = new Map(
  LOCALES.filter(({ code }) => code !== 'ru' && code !== 'en').map(({ code }) => [
    code,
    JSON.parse(
      readFileSync(new URL(`../../src/locales/${code}.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>,
  ]),
);
const text = (lang: Lang, ru: string, en: string) =>
  lang === 'ru' ? ru : lang === 'en' ? en : dictionaries.get(lang)![messageId(ru, en)];
const selector = (page: Page) => page.locator('.language-select select');
async function choose(page: Page, lang: Lang) {
  await selector(page).selectOption(lang);
  await expect(selector(page)).toHaveValue(lang);
  await expect(page.locator('html')).toHaveAttribute('lang', localeTag(lang));
  await expect(page.locator('html')).toHaveAttribute('dir', localeDirection(lang));
}
async function tiles(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO9sAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
}
test('all 50 languages load real bundles and preserve an unsaved public listing', async ({
  page,
}) => {
  test.setTimeout(120000);
  await tiles(page);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('/catalog/new');
  await expect(selector(page).locator('option')).toHaveCount(50);
  await page.getByRole('textbox', { name: 'Название студии' }).fill('Untranslated maker workshop');
  await page.getByRole('textbox', { name: 'Город', exact: false }).fill('Fixture City');
  for (const locale of LOCALES) {
    await choose(page, locale.code);
    await expect(
      page.getByRole('heading', {
        name: text(locale.code, 'О студии', 'About the studio'),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', {
        name: text(locale.code, 'Название студии', 'Studio name'),
        exact: false,
      }),
    ).toHaveValue('Untranslated maker workshop');
    await expect(
      page.getByRole('button', {
        name: text(locale.code, 'Опубликовать студию', 'Publish studio'),
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.reload();
  await expect(selector(page)).toHaveValue('ur-PK');
  await expect(
    page.getByRole('heading', { name: text('ur-PK', 'О студии', 'About the studio'), exact: true }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});

test('Arabic mobile publication and Japanese editing retain user content and private management', async ({
  page,
}, testInfo) => {
  await tiles(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/catalog/new');
  await choose(page, 'ar-SA');
  const ar = (ru: string, en: string) => text('ar-SA', ru, en);
  await page
    .getByRole('textbox', { name: ar('Название студии', 'Studio name') })
    .fill('I18N synthetic workshop');
  await page.getByRole('textbox', { name: ar('Город', 'City'), exact: false }).fill('Fixture City');
  await page
    .getByRole('textbox', { name: ar('Описание возможностей', 'Capabilities'), exact: true })
    .fill('Original workshop description stays unchanged.');
  await page
    .getByRole('textbox', { name: ar('Технологии через запятую', 'Technologies, comma separated') })
    .fill('FDM');
  await page
    .getByRole('textbox', { name: ar('Материалы через запятую', 'Materials, comma separated') })
    .fill('PLA');
  await page
    .getByRole('textbox', { name: ar('Сайт', 'Website'), exact: true })
    .fill('https://i18n-fixture.example.org');
  await page.getByRole('spinbutton', { name: ar('Широта', 'Latitude'), exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: ar('Долгота', 'Longitude'), exact: true }).fill('0');
  const rights = page.locator('.catalog-editor-form input[type="checkbox"]').last();
  await rights.check();
  const violations = await new AxeBuilder({ page }).include('#main').analyze();
  expect(
    violations.violations.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('arabic-mobile.png'), fullPage: true });
  await page
    .getByRole('button', { name: ar('Опубликовать студию', 'Publish studio'), exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: ar('Студия опубликована', 'Studio published'), exact: true }),
  ).toBeVisible();
  const link = await page
    .getByRole('textbox', {
      name: ar('Личная ссылка управления', 'Private management link'),
      exact: true,
    })
    .inputValue();
  const id = new URL(link).pathname.split('/')[2];
  await page.goto(link);
  await choose(page, 'ja');
  const ja = (ru: string, en: string) => text('ja', ru, en);
  await expect(
    page.getByRole('textbox', { name: ja('Название студии', 'Studio name') }),
  ).toHaveValue('I18N synthetic workshop');
  await expect(
    page.getByRole('textbox', { name: ja('Описание возможностей', 'Capabilities'), exact: true }),
  ).toHaveValue('Original workshop description stays unchanged.');
  expect(new URL(page.url()).hash).toBe('');
  await page
    .getByRole('textbox', { name: ja('Описание возможностей', 'Capabilities'), exact: true })
    .fill('Updated in Japanese interface, still original user text.');
  await page.locator('.catalog-editor-form input[type="checkbox"]').last().check();
  await page
    .getByRole('button', { name: ja('Опубликовать изменения', 'Publish changes'), exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: ja('Изменения опубликованы', 'Changes published') }),
  ).toBeVisible();
  expect(
    (await (await page.request.get(`/api/directory/catalog/${id}`)).json()).studio.description,
  ).toBe('Updated in Japanese interface, still original user text.');
  await choose(page, 'de-DE');
  await expect(
    page.getByRole('status').filter({
      hasText: text('de-DE', 'Изменения опубликованы', 'Changes published'),
    }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('german-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('a failed language download preserves the current UI and retries without losing the draft', async ({
  page,
}) => {
  await tiles(page);
  await page.goto('/catalog/new');
  await page.getByRole('textbox', { name: 'Название студии' }).fill('Keep this draft');
  await page.route('**/assets/fr-FR-*.json', (route) => route.abort());
  await selector(page).selectOption('fr-FR');
  await expect(
    page.getByRole('status').filter({ hasText: 'Не удалось загрузить язык' }),
  ).toBeVisible();
  await expect(selector(page)).toHaveValue('ru');
  await expect(page.getByRole('textbox', { name: 'Название студии' })).toHaveValue(
    'Keep this draft',
  );
  await page.unroute('**/assets/fr-FR-*.json');
  await choose(page, 'fr-FR');
  await expect(
    page.getByRole('textbox', { name: text('fr-FR', 'Название студии', 'Studio name') }),
  ).toHaveValue('Keep this draft');
});

test('language switching works when browser preference storage is disabled', async ({ page }) => {
  await tiles(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/studios');
  await choose(page, 'he');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    text('he', 'Найдите свою мастерскую.', 'Find your kind of maker.'),
  );
  await choose(page, 'en-GB');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('a late dictionary cannot replace a more recently selected language', async ({ page }) => {
  await tiles(page);
  await page.goto('/catalog/new');
  await page.getByRole('textbox', { name: 'Название студии' }).fill('Keep the latest language');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/ja-*.json', async (route) => {
    await gate;
    await route.continue();
  });
  const started = page.waitForRequest((request) => /\/assets\/ja-[^/]+\.json$/.test(request.url()));
  await selector(page).selectOption('ja');
  try {
    await started;
    await choose(page, 'fr-FR');
    const downloaded = page.waitForResponse((response) =>
      /\/assets\/ja-[^/]+\.json$/.test(response.url()),
    );
    release();
    await downloaded;
  } finally {
    release();
  }
  await expect(selector(page)).toHaveValue('fr-FR');
  await expect(
    page.getByRole('textbox', { name: text('fr-FR', 'Название студии', 'Studio name') }),
  ).toHaveValue('Keep the latest language');
  await choose(page, 'ja');
  await expect(
    page.getByRole('textbox', { name: text('ja', 'Название студии', 'Studio name') }),
  ).toHaveValue('Keep the latest language');
});
