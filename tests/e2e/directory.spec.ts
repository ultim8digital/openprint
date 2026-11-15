import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.skip(
  !process.env.E2E_DIRECTORY_FIXTURE,
  'Use npm run test:e2e or E2E_DIRECTORY_FIXTURE=1 for synthetic catalog records',
);

async function mapTiles(page: Page) {
  // Decorative tiles are stubbed; the directory, map points and detail pages use the real API/SQLite.
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

test('imported directory uses real API, maps all results beyond page 12, and keeps catalog contacts separate from provider accounts', async ({
  page,
}, testInfo) => {
  await mapTiles(page);
  const mapRequests: string[] = [];
  const tileRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/directory/map?')) mapRequests.push(request.url());
    if (request.url().startsWith('https://tile.openstreetmap.org/'))
      tileRequests.push(request.url());
  });
  await page.goto('/studios');
  await expect(page.locator('.profile-grid > article')).toHaveCount(12);
  await expect(page.locator('.results-bar')).toContainText('Найдено: 20');
  expect(mapRequests).toHaveLength(0);
  expect(tileRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Показать карту', exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
  const count = page.getByRole('status', { name: 'Результаты карты' });
  await expect(count).toHaveText('Точек на карте: 19 · Всего результатов: 20 · Без координат: 1');
  const canvas = page.locator('.leaflet-overlay-pane canvas');
  await expect(canvas).toHaveCount(1);
  const originalCanvas = await canvas.elementHandle();
  await expect(page.getByLabel('Обозначения карты')).toContainText('Справочные записи');
  await expect(page.getByText('Точки у полюсов показаны', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Следующая страница' }).click();
  await expect(page).toHaveURL(/offset=12/);
  await expect(page.locator('.profile-grid > article')).toHaveCount(8);
  await expect(count).toHaveText('Точек на карте: 19 · Всего результатов: 20 · Без координат: 1');
  expect(await originalCanvas!.evaluate((element) => element.isConnected)).toBe(true);
  expect(mapRequests).toHaveLength(1);
  await page.goBack();
  await expect(page.locator('.profile-grid > article')).toHaveCount(12);
  await expect(page).not.toHaveURL(/offset=/);
  expect(mapRequests).toHaveLength(1);
  await page.getByRole('combobox', { name: 'Источник записей' }).selectOption('catalog');
  await expect(count).toHaveText('Точек на карте: 13 · Всего результатов: 14 · Без координат: 1');
  await page.getByRole('combobox', { name: 'Технология', exact: true }).selectOption('FDM');
  await expect(count).toHaveText('Точек на карте: 12 · Всего результатов: 13 · Без координат: 1');
  await page.getByRole('combobox', { name: 'Технология', exact: true }).selectOption('');
  await page.getByRole('textbox', { name: 'Поиск мастерских' }).fill('Fixture Catalog 01');
  await expect(count).toHaveText('Точек на карте: 1 · Всего результатов: 1 · Без координат: 0');
  const map = page.getByRole('region', { name: 'Карта мастерских', exact: true });
  await map.scrollIntoViewIfNeeded();
  await map.click({
    position: { x: (await map.boundingBox())!.width / 2, y: (await map.boundingBox())!.height / 2 },
  });
  const popup = page.locator('.leaflet-popup');
  await expect(popup).toContainText('Справочная запись');
  const studioLink = popup.getByRole('link', { name: 'Fixture Catalog 01 · Fixture City' });
  await expect(studioLink).toHaveAttribute('href', /^\/catalog\//);
  await page.screenshot({ path: testInfo.outputPath('directory-map-desktop.png') });
  await studioLink.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fixture Catalog 01');
  await expect(page.getByRole('link', { name: 'Обсудить проект' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Сайт студии', exact: true })).toHaveAttribute(
    'href',
    'https://studio.example.org/',
  );
  await expect(page.getByRole('link', { name: 'Открыть источник' })).toHaveAttribute(
    'href',
    'https://catalog.example.org/',
  );
  await expect(page.getByRole('link', { name: '+15550100000', exact: true })).toHaveAttribute(
    'href',
    'tel:+15550100000',
  );
  await expect(page.getByRole('link', { name: 'На OpenStreetMap' })).toHaveAttribute(
    'href',
    /mlat=0&mlon=0/,
  );
  await expect(page.getByText('Это дата переноса записи.', { exact: false })).toBeVisible();
  await page.goto('/studios?source=catalog&view=map&technology=CNC');
  await expect(count).toHaveText('Точек на карте: 1 · Всего результатов: 1 · Без координат: 0');
  const reviewed = page.getByRole('checkbox', { name: 'Проверены модератором' });
  await reviewed.click();
  await expect(reviewed).toBeChecked();
  await expect(count).toHaveText('Точек на карте: 0 · Всего результатов: 0 · Без координат: 0');
  expect(errors).toEqual([]);
});

test('directory links open the map, preserve unlocated listings, and work in English on mobile', async ({
  page,
}, testInfo) => {
  await mapTiles(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studios?source=catalog&view=map');
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
  const count = page.getByRole('status', { name: 'Map results' });
  await expect(count).toHaveText('Map locations: 13 · Total results: 14 · Without coordinates: 1');
  await expect(page.getByRole('button', { name: 'Hide map', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('region', { name: 'Workshop map', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('directory-map-mobile.png') });
  const a11y = await new AxeBuilder({ page }).include('#main').analyze();
  expect(
    a11y.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.getByRole('textbox', { name: 'Search workshops' }).fill('Fixture Catalog 14');
  await expect(count).toHaveText('Map locations: 0 · Total results: 1 · Without coordinates: 1');
  await expect(
    page.getByText('These listings have no coordinates yet.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Fixture Catalog 14', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Studio contacts', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fixture Catalog 14');
  await expect(page.getByText('Coordinates are not provided:', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View on OpenStreetMap' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Discuss a project' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const detailA11y = await new AxeBuilder({ page }).include('#main').analyze();
  expect(
    detailA11y.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
