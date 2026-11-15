import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('public discovery, responsive navigation, keyboard access and no compulsory third-party calls', async ({
  page,
}) => {
  const external: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:3012') && !request.url().startsWith('data:'))
      external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('От идеи');
  await expect(page.getByText('Layer Lab', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByText('К содержимому', { exact: true })).toBeFocused();
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.goto('/studios');
  await page.getByRole('textbox', { name: 'Поиск мастерских' }).fill('Layer');
  await expect(page.getByRole('heading', { name: 'Layer Lab', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Forma Works', exact: true })).not.toBeVisible();
  await page.getByRole('link', { name: 'Познакомиться' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Layer Lab' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator('.hero h1')
      .evaluate((heading) => heading.scrollWidth <= heading.clientWidth),
  ).toBe(true);
  const mobileA11y = await new AxeBuilder({ page }).analyze();
  expect(
    mobileA11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page
    .getByRole('navigation', { name: 'Навигация', exact: true })
    .getByRole('link', { name: 'Модели' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Модели');
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Designs worth making');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('customer and workshop complete a real browser → API → SQLite → file workflow', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Регистрация', exact: true }).click();
  await page.getByRole('textbox', { name: 'Как вас зовут?' }).fill('E2E Customer');
  await page.getByRole('textbox', { name: 'Электронная почта' }).fill('e2e.customer@test.example');
  await page.getByLabel('Пароль', { exact: false }).fill('synthetic-e2e-passphrase-123');
  await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
  await expect(page).toHaveURL(/workspace/);
  await page.goto('/tools');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('трёх измерениях');
  await page.getByLabel('Ширина, мм', { exact: true }).fill('80');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать STL', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain('80x45x5.stl');
  const bytes = readFileSync((await download.path())!);
  expect(bytes.readUInt32LE(80)).toBeGreaterThan(10);
  await page.getByRole('button', { name: 'Использовать в проекте', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Что нужно сделать?', exact: true })
    .fill('E2E корпус для датчика');
  await page.getByRole('textbox', { name: 'Город или «Удалённо»', exact: true }).fill('Москва');
  await page
    .getByRole('textbox', { name: 'Описание задачи', exact: true })
    .fill(
      'Нужно изготовить корпус для датчика 80 × 45 мм. Требуется точное расположение отверстия и гладкая поверхность. В комплекте одна деталь.',
    );
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByText(/openprint-plate-80x45x5.stl/)).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Опубликовать проект', exact: true }).click();
  await expect(page).toHaveURL(/projects\/[a-f0-9-]{36}$/);
  const projectURL = page.url();
  const providerContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:3012',
      viewport: { width: 1440, height: 1000 },
    }),
    provider = await providerContext.newPage();
  provider.on('pageerror', (error) => errors.push(error.message));
  await provider.goto(projectURL);
  await provider
    .getByRole('combobox', { name: 'Демо-участник', exact: true })
    .selectOption({ label: 'Layer Lab · мастерская' });
  await expect(
    provider.getByRole('button', { name: 'Отправить предложение', exact: true }),
  ).toBeVisible();
  await provider.getByRole('button', { name: 'Сначала задать вопрос', exact: true }).click();
  await provider
    .getByRole('textbox', { name: 'Сообщение', exact: true })
    .fill('Подойдёт зелёный PETG? Можем сделать за три дня.');
  await provider.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
  await expect(
    provider.getByText('Подойдёт зелёный PETG? Можем сделать за три дня.', { exact: true }),
  ).toBeVisible();
  await provider.getByRole('textbox', { name: 'Цена за весь проект', exact: false }).fill('2400');
  await provider
    .getByRole('spinbutton', { name: 'Срок, дней после принятия', exact: true })
    .fill('3');
  await provider
    .getByRole('textbox', { name: 'Что входит в предложение?', exact: true })
    .fill(
      'Одна деталь из PETG, слой 0,2 мм. Доставка обсуждается отдельно, файл проверим после согласования.',
    );
  await provider.getByRole('button', { name: 'Отправить предложение', exact: true }).click();
  await expect(
    provider.getByRole('button', { name: 'Отправить новую версию', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Выбрать предложение', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Выбрать предложение', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Принять эти условия', exact: true }).click();
  await expect(page.getByText('СОГЛАСОВАННЫЕ УСЛОВИЯ', { exact: true })).toBeVisible();
  await provider.reload();
  const fileLink = provider.getByRole('link', { name: /openprint-plate-80x45x5.stl/ });
  await expect(fileLink).toBeVisible();
  const fileResponse = await provider.request.get((await fileLink.getAttribute('href'))!);
  expect(fileResponse.status()).toBe(200);
  expect(Buffer.compare(await fileResponse.body(), bytes)).toBe(0);
  await provider
    .getByRole('button', { name: 'Результат готов, передать заказчику', exact: true })
    .click();
  await expect(provider.getByText('Ждёт подтверждения', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Результат получен, завершить', exact: true }).click();
  await expect(page.getByText('Завершён', { exact: true })).toBeVisible();
  await page.goto('/workspace?tab=settings');
  const exported = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Экспорт моих данных', exact: true }).click();
  const exportFile = await exported;
  const account = JSON.parse(readFileSync((await exportFile.path())!, 'utf8'));
  expect(
    account.projects.some(
      (j: { title: string; status: string }) =>
        j.title === 'E2E корпус для датчика' && j.status === 'completed',
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await providerContext.close();
});

test('new profiles, model authors and moderators use the UI without cloud services', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('combobox', { name: 'Демо-участник', exact: true })
    .selectOption({ label: 'Алексей · инженер' });
  await page.goto('/workspace?tab=profile');
  await expect(page.getByRole('textbox', { name: 'Название мастерской или ваше имя' })).toHaveValue(
    'Алексей · CAD & Repair',
  );
  await page
    .getByRole('textbox', { name: 'О ваших возможностях' })
    .fill(
      'Проектирование корпусов и подготовка моделей к изготовлению. Передаём исходники, спецификации и файлы для печати.',
    );
  await page.getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Профиль сохранён' })).toBeVisible();
  await page.goto('/models?publish=1');
  await page.getByRole('textbox', { name: 'Название', exact: true }).fill('E2E крепёжная пластина');
  await page
    .getByRole('textbox', { name: 'Описание, размеры и советы по печати' })
    .fill(
      'Авторская тестовая пластина, открытая для повторного использования с указанием автора. Размеры необходимо проверить перед изготовлением.',
    );
  await page.getByLabel('Файл модели', { exact: false }).setInputFiles({
    name: 'test-part.step',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;'),
  });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Спасибо за ваш вклад!' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Демо-участник', exact: true })
    .selectOption({ label: 'Модератор сообщества' });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Модели', exact: true }).click();
  const card = page
    .locator('.workspace-card')
    .filter({ has: page.getByRole('heading', { name: 'E2E крепёжная пластина', exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Разрешить публикацию', exact: true }).click();
  await expect(card.getByText('Опубликована', { exact: true })).toBeVisible();
  await page.goto('/models');
  await expect(
    page.getByRole('heading', { name: 'E2E крепёжная пластина', exact: true }),
  ).toBeVisible();
});
