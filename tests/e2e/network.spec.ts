import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import { Store } from '../../build/server/database.js';
import { createApp } from '../../build/server/app.js';

async function node(mode: 'catalog' | 'community', peer = '') {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const dir = mkdtempSync(join(tmpdir(), 'openprint-network-'));
  const store = new Store(join(dir, 'openprint.sqlite'));
  const app = createApp({
    mode,
    appUrl: origin,
    networkPeers: peer,
    mapTiles: false,
    store,
    dataDir: dir,
    staticDir: 'dist',
    cad: { python: '' },
    studioAI: {},
  });
  server.on('request', app);
  return {
    origin,
    store,
    async close() {
      await app.locals.cad.stop();
      await new Promise<void>((done) => server.close(() => done()));
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('two independent nodes discover a maker, transfer an edited mesh and complete a private print order', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const workshop = await node('community');
  const directory = await node('catalog', workshop.origin);
  const makerContext = await browser.newContext();
  const provider = await makerContext.newPage();
  const customer = page.context();
  const urls: string[] = [];
  customer.on('request', (r) => urls.push(r.url()));
  try {
    const headers = { Origin: workshop.origin };
    const account = await provider.request.post(workshop.origin + '/api/auth/register', {
      headers,
      data: {
        name: 'Fixture maker',
        email: 'maker@example.test',
        password: 'synthetic-workshop-password',
      },
    });
    expect(account.status()).toBe(201);
    const saved = await provider.request.put(workshop.origin + '/api/profile', {
      headers,
      data: {
        name: 'River Workshop',
        kind: 'studio',
        city: 'Test Town',
        description: 'Small workshop making original household parts.',
        technologies: ['FDM'],
        materials: ['PLA'],
        lat: 12,
        lng: 100,
        website: '',
      },
    });
    expect(saved.ok()).toBeTruthy();
    const id = (await saved.json()).profile.id;
    expect(
      (await (await provider.request.get(workshop.origin + '/api/directory/node')).json())
        .workshops,
    ).toEqual([]);
    await provider.goto(workshop.origin + '/workspace?tab=profile');
    await provider.getByLabel('Показывать мою мастерскую на других узлах OpenPrint').check();
    await provider.getByRole('button', { name: 'Сохранить профиль' }).click();
    await expect(
      provider.getByRole('status').filter({ hasText: 'Профиль сохранён' }),
    ).toBeVisible();

    await page.goto(directory.origin + '/');
    await page.getByRole('link', { name: 'Сеть мастерских' }).click();
    await expect(page.getByRole('heading', { name: 'River Workshop' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Карта мастерских' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('network-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath('network-mobile.png') });
    const map = page.getByRole('region', { name: 'Карта мастерских' });
    const bounds = (await map.boundingBox())!;
    await map.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await map.getByRole('button', { name: 'River Workshop · Test Town' }).click();
    await expect(page).toHaveURL(workshop.origin + '/tools?target=' + id);

    // A model designed before discovering a maker must keep its dimensions across origins.
    await page.goto(directory.origin + '/tools');
    await page.getByLabel('Ширина, мм', { exact: true }).fill('84');
    await page.getByRole('button', { name: 'Выберите исполнителя' }).click();
    await page.getByRole('button', { name: 'Личный запрос' }).click();
    await expect(page.getByLabel('Ширина, мм', { exact: true })).toHaveValue('84');
    await expect(page).toHaveURL(new RegExp('target=' + id + '#part='));
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Скачать STL' }).click();
    const original = readFileSync((await (await downloadEvent).path())!);

    await page.goto(directory.origin + '/tools');
    await page.getByRole('button', { name: 'Мой файл', exact: true }).click();
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'part.stl', mimeType: 'application/octet-stream', buffer: original });
    await page.getByLabel('Масштаб, %').fill('150');
    await expect(page.locator('.model-measures')).toContainText('126');
    const scaledDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Скачать STL' }).click();
    const expected = readFileSync((await (await scaledDownload).path())!);
    expect(expected.equals(original)).toBe(false);
    await page.getByRole('button', { name: 'Выберите исполнителя' }).click();
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Личный запрос' }).click();
    const order = await popup;
    await order
      .getByRole('button', { name: 'Открыть STL или OBJ · ' + directory.origin, exact: true })
      .click();
    await expect(order.locator('.model-measures')).toContainText('126');
    await order.getByRole('button', { name: 'Личный запрос', exact: true }).click();
    await order.getByRole('button', { name: 'Регистрация', exact: true }).click();
    await order.getByRole('textbox', { name: 'Как вас зовут?' }).fill('Fixture customer');
    await order.getByRole('textbox', { name: 'Электронная почта' }).fill('customer@example.test');
    await order.getByLabel('Пароль', { exact: false }).fill('synthetic-customer-password');
    await order.getByRole('button', { name: 'Присоединиться', exact: true }).click();
    await order.getByLabel('Что нужно сделать?').fill('Print the edited plate');
    await order.getByLabel('Город или «Удалённо»').fill('Test Town');
    await order
      .getByLabel('Описание задачи', { exact: true })
      .fill('Please print the attached plate in PLA at the supplied dimensions.');
    await order.getByRole('button', { name: 'Продолжить' }).click();
    await expect(order.getByText(/part-150pct.stl/)).toBeVisible();
    await order.getByRole('button', { name: 'Продолжить' }).click();
    await expect(order.getByText('River Workshop', { exact: true })).toBeVisible();
    expect(workshop.store.get('SELECT count(*) n FROM files').n).toBe(0);
    await order.getByRole('checkbox').check();
    await order.route(
      '**/api/projects',
      async (route) => {
        await route.fetch();
        await route.abort('failed');
      },
      { times: 1 },
    );
    await order.getByRole('button', { name: 'Опубликовать проект' }).click();
    await expect(order.locator('[role="alert"]')).toBeVisible();
    await order.getByRole('button', { name: 'Опубликовать проект' }).click();
    await expect(order).toHaveURL(/\/projects\/[\da-f-]{36}$/);
    expect(workshop.store.get('SELECT count(*) n FROM jobs').n).toBe(1);
    expect(workshop.store.get('SELECT count(*) n FROM files').n).toBe(1);
    const row = workshop.store.get('SELECT target_profile_id,visibility,id FROM jobs');
    expect(row).toMatchObject({ target_profile_id: id, visibility: 'direct' });
    for (const table of ['jobs', 'files', 'users'])
      expect(directory.store.get('SELECT count(*) n FROM ' + table).n).toBe(0);
    expect(
      (await (await page.request.get(workshop.origin + '/api/projects')).json()).projects,
    ).toHaveLength(0);
    await provider.goto(order.url());
    await provider.getByRole('textbox', { name: 'Цена за весь проект' }).fill('1200');
    await provider.getByRole('spinbutton', { name: 'Срок, дней после принятия' }).fill('2');
    await provider
      .getByRole('textbox', { name: 'Что входит в предложение?' })
      .fill('One fitted plate printed in PLA, ready for collection.');
    await provider.getByRole('button', { name: 'Отправить предложение', exact: true }).click();
    await expect(provider.getByRole('button', { name: 'Отправить новую версию' })).toBeVisible();
    await order.reload();
    await order.getByRole('button', { name: 'Выбрать предложение' }).click();
    await order.getByRole('button', { name: 'Принять эти условия' }).click();
    await expect(order.getByText('СОГЛАСОВАННЫЕ УСЛОВИЯ', { exact: true })).toBeVisible();
    await provider.reload();
    const link = provider.getByRole('link', { name: /part-150pct.stl/ });
    const attachment = await provider.request.get(
      new URL((await link.getAttribute('href'))!, workshop.origin).href,
    );
    expect(attachment.status()).toBe(200);
    expect((await attachment.body()).equals(expected)).toBe(true);
    await provider.getByRole('button', { name: 'Результат готов, передать заказчику' }).click();
    await expect(provider.getByText('Ждёт подтверждения', { exact: true })).toBeVisible();
    await order.reload();
    await order.getByRole('button', { name: 'Результат получен, завершить' }).click();
    await expect(order.getByText('Завершён', { exact: true })).toBeVisible();
    expect(
      urls.filter(
        (url) =>
          /^https?:/.test(url) &&
          ![directory.origin, workshop.origin].includes(new URL(url).origin),
      ),
    ).toEqual([]);
  } finally {
    await makerContext.close();
    await Promise.all([directory.close(), workshop.close()]);
  }
});

test('a published OBJ opens from the model library and keeps the selected workshop through resizing', async ({
  page,
}) => {
  const workshop = await node('community');
  try {
    const headers = { Origin: workshop.origin };
    const account = await page.request.post(workshop.origin + '/api/auth/register', {
      headers,
      data: {
        name: 'Model author',
        email: 'author@example.test',
        password: 'synthetic-model-passphrase',
      },
    });
    expect(account.ok()).toBe(true);
    const profile = await page.request.put(workshop.origin + '/api/profile', {
      headers,
      data: {
        name: 'Library workshop',
        kind: 'studio',
        city: 'Test City',
        description: 'A fictional maker for the library workflow.',
        technologies: ['FDM'],
        materials: ['PLA'],
        website: '',
      },
    });
    const id = (await profile.json()).profile.id;
    const model = Buffer.from('o sample\nv 0 0 0\nv 3 0 0\nv 0 4 0\nf 1 2 3\n');
    const file = await page.request.post(workshop.origin + '/api/files', {
      headers: {
        ...headers,
        'content-type': 'application/octet-stream',
        'x-file-name': 'library.obj',
      },
      data: model,
    });
    expect(file.ok()).toBe(true);
    const submission = await page.request.post(workshop.origin + '/api/models', {
      headers,
      data: {
        title: 'Fictional mesh',
        description: 'A synthetic geometric mesh for checking the model library.',
        category: 'parts',
        license: 'CC0-1.0',
        attribution: 'Test author',
        rights: true,
        file_id: (await file.json()).file.id,
      },
    });
    expect(submission.ok()).toBe(true);
    workshop.store.run('UPDATE models SET published=1 WHERE id=?', (await submission.json()).id);
    await page.context().clearCookies();
    await page.goto(workshop.origin + '/tools?target=' + id);
    await page.getByRole('main').getByRole('link', { name: 'Библиотека моделей' }).click();
    await page.getByRole('button', { name: 'Изменить размеры' }).click();
    await expect(page.getByText('library.obj', { exact: true })).toBeVisible();
    await page.getByLabel('Масштаб, %').fill('200');
    await expect(page.locator('.model-measures')).toContainText('6,0 × 8,0');
    await expect(page.getByText('Library workshop', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Личный запрос', exact: true }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    const next = new URL(page.url()).searchParams.get('next');
    expect(next).toContain('target=' + id);
  } finally {
    await workshop.close();
  }
});
