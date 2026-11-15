import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

test.skip(
  process.env.E2E_CATALOG_MODE !== '1',
  'Run through npm run test:e2e for an isolated catalog-only instance',
);

async function mapTiles(page: Page) {
  // Only the decorative basemap is synthetic; publication, management and map data use real SQLite/API.
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
async function fillStudio(page: Page, name: string, english = false) {
  await page.getByRole('textbox', { name: english ? 'Studio name' : 'Название студии' }).fill(name);
  await page
    .getByRole('textbox', { name: english ? 'City' : 'Город', exact: false })
    .fill('Fixture City');
  await page
    .getByRole('textbox', { name: english ? 'Capabilities' : 'Описание возможностей', exact: true })
    .fill('Synthetic workshop for browser validation only.');
  await page
    .getByRole('textbox', {
      name: english ? 'Technologies, comma separated' : 'Технологии через запятую',
    })
    .fill('FDM, CNC');
  await page
    .getByRole('textbox', {
      name: english ? 'Materials, comma separated' : 'Материалы через запятую',
    })
    .fill('PLA, Aluminum');
  await page
    .getByRole('textbox', { name: english ? 'Website' : 'Сайт', exact: true })
    .fill('https://workshop.example.test');
}
function rights(page: Page, english = false) {
  return page.getByRole('checkbox', {
    name: english ? /^I am authorized to publish/ : /^У меня есть право публиковать/,
  });
}
function publication(secretLink: string) {
  const url = new URL(secretLink),
    id = url.pathname.split('/')[2]!,
    key = new URLSearchParams(url.hash.slice(1)).get('key')!;
  expect(url.search).toBe('');
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  return { id, key, url };
}
async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).include('#main').analyze();
  expect(
    result.violations.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test('guest publishes a visible studio, manages it by secret link, resolves a stale edit and deletes it without accounts', async ({
  page,
  browser,
}) => {
  await mapTiles(page);
  const urls: string[] = [],
    referrers: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
    referrers.push(request.headers().referer || '');
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/studios\?view=map$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Найдите свою мастерскую');
  for (const label of ['Войти', 'Регистрация', 'Модерация', 'Neofab Studio'])
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  const bootstrap = await (await page.request.get('/api/bootstrap')).json();
  expect(bootstrap).toMatchObject({
    mode: 'catalog',
    user: null,
    profile: null,
    demo: false,
    demoUsers: [],
  });
  await page
    .locator('#main .page-heading')
    .getByRole('link', { name: 'Добавить студию', exact: true })
    .click();
  await fillStudio(page, 'E2E Guest Workshop');
  await page.getByRole('spinbutton', { name: 'Широта', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'Долгота', exact: true }).fill('0');
  await rights(page).check();
  await page.getByRole('button', { name: 'Опубликовать студию', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Студия опубликована', exact: true }),
  ).toBeVisible();
  const link = await page
    .getByRole('textbox', { name: 'Личная ссылка управления', exact: true })
    .inputValue();
  const { id, key } = publication(link);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать ключ', exact: true }).click();
  expect(readFileSync((await (await download).path())!, 'utf8')).toContain(link);
  await page.getByRole('link', { name: 'Открыть карточку', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Guest Workshop');
  await expect(page.locator('.catalog-label')).toHaveText('Самостоятельная публикация');
  await expect(page.getByRole('link', { name: 'Сайт студии', exact: true })).toHaveAttribute(
    'href',
    'https://workshop.example.test/',
  );
  await expect(page.getByRole('link', { name: 'Обсудить проект' })).toHaveCount(0);
  await page.goto('/studios?view=map&q=E2E%20Guest%20Workshop');
  await expect(page.getByRole('status', { name: 'Результаты карты' })).toHaveText(
    'Точек на карте: 1 · Всего результатов: 1 · Без координат: 0',
  );
  const mapData = await (
    await page.request.get('/api/directory/map?q=E2E%20Guest%20Workshop')
  ).json();
  expect(mapData.points).toEqual([
    { id, source: 'catalog', name: 'E2E Guest Workshop', city: 'Fixture City', lat: 0, lng: 0 },
  ]);
  await expect(page.locator('.leaflet-overlay-pane canvas')).toHaveCount(1);
  await page.goto(link);
  await expect(page.getByRole('textbox', { name: 'Название студии' })).toHaveValue(
    'E2E Guest Workshop',
  );
  expect(new URL(page.url()).hash).toBe('');
  expect(new URL(page.url()).search).toBe('');

  const secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3012' });
  try {
    const second = await secondContext.newPage();
    second.on('request', (request) => {
      urls.push(request.url());
      referrers.push(request.headers().referer || '');
    });
    second.on('pageerror', (error) => errors.push(error.message));
    await second.goto(`/catalog/${id}/edit#key=${'a'.repeat(64)}`);
    await expect(second.getByRole('alert')).toContainText('Ключ не подходит');
    expect(new URL(second.url()).hash).toBe('');
    await second.getByLabel('Ключ управления', { exact: true }).fill(key);
    await second.getByRole('button', { name: 'Открыть запись', exact: true }).click();
    await expect(second.getByRole('textbox', { name: 'Название студии' })).toHaveValue(
      'E2E Guest Workshop',
    );
    await page
      .getByRole('textbox', { name: 'Описание возможностей' })
      .fill('First editor published this description.');
    await rights(page).check();
    await page.getByRole('button', { name: 'Опубликовать изменения' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Изменения опубликованы' }),
    ).toBeVisible();
    await second
      .getByRole('textbox', { name: 'Описание возможностей' })
      .fill('Second editor has unsaved work.');
    await rights(second).check();
    await second.getByRole('button', { name: 'Опубликовать изменения' }).click();
    await expect(second.getByRole('alert')).toContainText('Запись уже изменена');
    await expect(second.getByRole('textbox', { name: 'Описание возможностей' })).toHaveValue(
      'Second editor has unsaved work.',
    );
    const reload = second.getByRole('button', { name: 'Загрузить актуальную запись' });
    await expect(reload).toBeDisabled();
    await second
      .getByRole('checkbox', { name: 'Разрешаю заменить форму актуальной записью с сервера' })
      .check();
    await reload.click();
    await expect(second.getByRole('textbox', { name: 'Описание возможностей' })).toHaveValue(
      'First editor published this description.',
    );
    await second
      .getByRole('textbox', { name: 'Описание возможностей' })
      .fill('Second editor explicitly rebased and published.');
    await rights(second).check();
    await second.getByRole('button', { name: 'Опубликовать изменения' }).click();
    await expect(
      second.getByRole('status').filter({ hasText: 'Изменения опубликованы' }),
    ).toBeVisible();
    await second.getByRole('button', { name: 'Удалить запись…', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Удалить окончательно' })).toBeDisabled();
    await second
      .getByRole('checkbox', { name: 'Подтверждаю окончательное удаление этой записи' })
      .check();
    await second.getByRole('button', { name: 'Удалить окончательно' }).click();
    await expect(
      second.getByRole('heading', { name: 'Запись удалена', exact: true }),
    ).toBeVisible();
    expect(
      await second.evaluate(
        (listingId) => sessionStorage.getItem('openprint.catalog.key.v1.' + listingId),
        id,
      ),
    ).toBeNull();
    expect((await second.request.get(`/api/directory/catalog/${id}`)).status()).toBe(404);
    const after = await (
      await second.request.get('/api/directory/map?q=E2E%20Guest%20Workshop')
    ).json();
    expect(after.total).toBe(0);
    expect(after.points).toEqual([]);
  } finally {
    await secondContext.close();
  }
  expect(urls.some((url) => url.includes(key) || /[?&](key|management_key)=/.test(url))).toBe(
    false,
  );
  expect(urls.some((url) => /\/api\/(auth|studio|admin)/.test(url))).toBe(false);
  expect(
    referrers.some((value) => value.includes(key) || /[?&#](key|management_key)=/.test(value)),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('English mobile publication is accessible, supports the map picker and keeps unlocated studios in the list', async ({
  page,
}, testInfo) => {
  await mapTiles(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/catalog/new');
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
  await fillStudio(page, 'E2E Mobile Workshop', true);
  await page.getByRole('button', { name: 'Choose on map', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Studio location picker' });
  await expect(picker).toBeVisible();
  await picker.click({ position: { x: 150, y: 120 } });
  await expect(page.getByRole('spinbutton', { name: 'Latitude', exact: true })).not.toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Longitude', exact: true })).not.toHaveValue(
    '',
  );
  await axe(page);
  await page.getByRole('button', { name: 'Clear coordinates', exact: true }).click();
  await page.getByRole('button', { name: 'Hide map picker', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Latitude', exact: true })).toHaveValue('');
  await rights(page, true).check();
  await page.getByRole('button', { name: 'Publish studio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Studio published', exact: true })).toBeVisible();
  const link = await page.getByRole('textbox', { name: 'Private management link' }).inputValue();
  const { id, key } = publication(link);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe(page);
  await page.getByRole('link', { name: 'View listing', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Mobile Workshop');
  await expect(page.getByText('Coordinates are not provided:', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View on OpenStreetMap' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('catalog-public-detail-mobile.png') });
  await axe(page);
  await page.goto('/studios?view=map&q=E2E%20Mobile%20Workshop');
  await expect(page.getByRole('status', { name: 'Map results' })).toHaveText(
    'Map locations: 0 · Total results: 1 · Without coordinates: 1',
  );
  await expect(
    page.getByRole('heading', { name: 'E2E Mobile Workshop', exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.delete(`/api/directory/submissions/${id}`, {
        headers: { Origin: 'http://127.0.0.1:3012', 'X-Catalog-Key': key },
        data: { version: 1 },
      })
    ).status(),
  ).toBe(200);
});

test('a lost successful POST response survives reload and retry uses exactly the same key and data', async ({
  page,
}) => {
  const bodies: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/directory/submissions'
    )
      bodies.push(request.postData()!);
  });
  let committed = false;
  await page.route('**/api/directory/submissions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    committed = true;
    await route.abort('connectionfailed');
  });
  await page.goto('/catalog/new');
  await fillStudio(page, 'E2E Lost Response Workshop');
  await rights(page).check();
  await page.getByRole('button', { name: 'Опубликовать студию', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Повторить с тем же ключом' })).toBeEnabled();
  expect(committed).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Название студии' })).toBeDisabled();
  expect(
    (await (await page.request.get('/api/directory?q=E2E%20Lost%20Response%20Workshop')).json())
      .total,
  ).toBe(1);
  await page.unroute('**/api/directory/submissions');
  // A front-door limit can reject a retry before the server reaches its idempotency lookup.
  // The earlier committed publication remains ambiguous, so this must not discard its key.
  await page.route('**/api/directory/submissions', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'RATE_LIMIT', error: 'Synthetic retry throttle' }),
    }),
  );
  await page.getByRole('button', { name: 'Повторить с тем же ключом' }).click();
  await expect(page.getByRole('alert')).toContainText('Слишком много попыток');
  await expect(page.getByRole('button', { name: 'Повторить с тем же ключом' })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Название студии' })).toBeDisabled();
  await page.unroute('**/api/directory/submissions');
  page.on('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Повторить с тем же ключом' })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Название студии' })).toHaveValue(
    'E2E Lost Response Workshop',
  );
  const replay = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/directory/submissions',
  );
  await page.getByRole('button', { name: 'Повторить с тем же ключом' }).click();
  expect((await (await replay).json()).replayed).toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Студия опубликована', exact: true }),
  ).toBeVisible();
  expect(bodies).toHaveLength(3);
  expect(bodies[1]).toBe(bodies[0]);
  expect(bodies[2]).toBe(bodies[0]);
  const { key, id } = publication(
    await page.getByRole('textbox', { name: 'Личная ссылка управления' }).inputValue(),
  );
  expect(key).toBe(JSON.parse(bodies[0]!).management_key);
  const directory = await (
    await page.request.get('/api/directory?q=E2E%20Lost%20Response%20Workshop')
  ).json();
  expect(directory.total).toBe(1);
  expect(directory.entries[0].studio.id).toBe(id);
  expect(
    await page.evaluate(() => sessionStorage.getItem('openprint.catalog.pending.v1')),
  ).toBeNull();
  expect(
    (
      await page.request.delete(`/api/directory/submissions/${id}`, {
        headers: { Origin: 'http://127.0.0.1:3012', 'X-Catalog-Key': key },
        data: { version: 1 },
      })
    ).status(),
  ).toBe(200);
});

test('lost validation and duplicate refusals unlock the preserved draft after a definitive retry', async ({
  page,
}) => {
  page.on('dialog', (dialog) => void dialog.accept());
  const endpoint = '**/api/directory/submissions';
  async function loseRefusal(status: number, code: string) {
    await page.route(endpoint, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(status);
      expect((await response.json()).code).toBe(code);
      await route.abort('connectionfailed');
    });
  }
  async function retryRefusal(status: number, code: string) {
    await expect(page.getByRole('button', { name: 'Повторить с тем же ключом' })).toBeEnabled();
    await expect(page.getByRole('textbox', { name: 'Название студии' })).toBeDisabled();
    await page.unroute(endpoint);
    const response = page.waitForResponse(
      (item) =>
        item.request().method() === 'POST' &&
        new URL(item.url()).pathname === '/api/directory/submissions',
    );
    await page.getByRole('button', { name: 'Повторить с тем же ключом' }).click();
    const refused = await response;
    expect(refused.status()).toBe(status);
    expect((await refused.json()).code).toBe(code);
    await expect(page.getByRole('textbox', { name: 'Название студии' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Повторить с тем же ключом' })).toHaveCount(0);
    expect(
      await page.evaluate(() => sessionStorage.getItem('openprint.catalog.pending.v1')),
    ).toBeNull();
  }

  await page.goto('/catalog/new');
  // Native minLength accepts two spaces, while the real API trims and rejects the name.
  await fillStudio(page, '  ');
  await loseRefusal(400, 'VALIDATION');
  await rights(page).check();
  await page.getByRole('button', { name: 'Опубликовать студию', exact: true }).click();
  await retryRefusal(400, 'VALIDATION');
  await expect(page.getByRole('textbox', { name: 'Описание возможностей' })).toHaveValue(
    'Synthetic workshop for browser validation only.',
  );
  await page
    .getByRole('textbox', { name: 'Название студии' })
    .fill('E2E Corrected Validation Workshop');
  await rights(page).check();
  await expect(
    page.getByRole('button', { name: 'Опубликовать студию', exact: true }),
  ).toBeEnabled();

  const originalKey = 'd'.repeat(64);
  const seed = await page.request.post('/api/directory/submissions', {
    headers: { Origin: 'http://127.0.0.1:3012' },
    data: {
      management_key: originalKey,
      rights_confirmed: true,
      studio: {
        name: 'E2E Duplicate Refusal Workshop',
        city: 'Fixture City',
        region: '',
        country: '',
        description: '',
        technologies: ['FDM'],
        materials: [],
        website: 'https://original.example.test',
        phone: '',
        address: '',
        lat: null,
        lng: null,
      },
    },
  });
  expect(seed.status()).toBe(201);
  const original = (await seed.json()).studio;
  await page.goto('/catalog/new');
  await fillStudio(page, 'E2E Duplicate Refusal Workshop');
  await loseRefusal(409, 'DUPLICATE_STUDIO');
  await rights(page).check();
  await page.getByRole('button', { name: 'Опубликовать студию', exact: true }).click();
  await retryRefusal(409, 'DUPLICATE_STUDIO');
  await expect(page.getByRole('textbox', { name: 'Название студии' })).toHaveValue(
    'E2E Duplicate Refusal Workshop',
  );
  await expect(page.getByRole('textbox', { name: 'Сайт', exact: true })).toHaveValue(
    'https://workshop.example.test',
  );
  await page
    .getByRole('textbox', { name: 'Название студии' })
    .fill('E2E Corrected Duplicate Workshop');
  await rights(page).check();
  await page.getByRole('button', { name: 'Опубликовать студию', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Студия опубликована', exact: true }),
  ).toBeVisible();
  const corrected = publication(
    await page.getByRole('textbox', { name: 'Личная ссылка управления' }).inputValue(),
  );
  for (const entry of [{ id: original.id, key: originalKey }, corrected]) {
    expect(
      (
        await page.request.delete(`/api/directory/submissions/${entry.id}`, {
          headers: { Origin: 'http://127.0.0.1:3012', 'X-Catalog-Key': entry.key },
          data: { version: 1 },
        })
      ).status(),
    ).toBe(200);
  }
});
