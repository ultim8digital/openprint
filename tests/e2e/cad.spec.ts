import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { CadState } from '../../shared/cad';

async function createWorkspace(page: Page, title: string) {
  await page.goto('/');
  await page
    .getByRole('combobox', { name: 'Демо-участник', exact: true })
    .selectOption({ label: 'Аня · заказчик' });
  await page.goto('/studio');
  await page
    .getByRole('textbox', {
      name: 'Задача, условия использования и известные размеры',
      exact: true,
    })
    .fill(title);
  await page.getByRole('button', { name: 'Создать рабочий проект', exact: true }).click();
  await expect(page).toHaveURL(/studio\/[a-f0-9-]{36}$/);
  await page.getByLabel('Количество изделий', { exact: true }).fill('2');
  await page.getByLabel('Город или «Удалённо»', { exact: true }).fill('Москва');
  await page.getByRole('button', { name: 'Сохранить ТЗ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить ТЗ', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: 'Модель и сборка CAD', exact: true }),
  ).toBeVisible();
  return page.url().split('/').at(-1)!;
}
async function saveCAD(page: Page) {
  await page.getByRole('button', { name: 'Сохранить CAD', exact: true }).click();
  await expect(page.getByText('CAD: изменения сохранены', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить CAD', exact: true })).toBeDisabled();
}
async function bytesFromLink(page: Page, name: RegExp) {
  const result = page.waitForEvent('download');
  await page.getByRole('link', { name }).first().click();
  return readFileSync((await (await result).path())!);
}

test('manual CAD editing is versioned, validates JSON, preserves the brief, and detaches without losing history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const id = await createWorkspace(
    page,
    'Нужна инженерная проработка небольшого корпуса и комплект деталей для пробной сборки. Размеры согласуем с исполнителем.',
  );
  const original = (await (await page.request.get(`/api/studio/projects/${id}`)).json()).project;
  await page.getByRole('button', { name: 'Загрузить пример', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeDisabled();
  await page
    .getByLabel('Название CAD-модели', { exact: true })
    .fill('Пробная пластина для обсуждения');
  const originX = page.getByLabel('Начало операции, мм X', { exact: true }).first();
  await originX.fill('');
  await originX.pressSequentially('-12.5');
  await expect(originX).toHaveValue('-12.5');
  await originX.fill('0');

  await page.getByText('Спецификация JSON: импорт и экспорт', { exact: true }).click();
  const raw = page.getByRole('textbox', { name: 'JSON модели', exact: true });
  const valid = JSON.parse(await raw.inputValue());
  await raw.fill(JSON.stringify({ ...valid, executable: 'not allowed' }));
  await page.getByRole('button', { name: 'Применить JSON', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Проверьте модель' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить CAD', exact: true })).toBeDisabled();
  await raw.fill(JSON.stringify(valid, null, 2));
  await page.getByRole('button', { name: 'Применить JSON', exact: true }).click();
  await saveCAD(page);
  const saved = await (await page.request.get(`/api/studio/projects/${id}`)).json();
  expect(saved.project.version).toBe(original.version + 1);
  expect(saved.project.brief).toEqual(original.brief);
  const attached = (await (
    await page.request.get(`/api/studio/projects/${id}/cad`)
  ).json()) as CadState;
  expect(attached.revision?.spec.name).toBe('Пробная пластина для обсуждения');
  expect(attached.revision?.spec.operations).toHaveLength(3);
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeDisabled();
  await page.getByText('Проверки геометрии и открытые вопросы', { exact: true }).click();
  const assumptions = page.getByRole('textbox', {
    name: 'Допущения CAD, по одному на строку',
    exact: true,
  });
  await assumptions.fill('Первая строка');
  await assumptions.press('End');
  await assumptions.press('Enter');
  await assumptions.pressSequentially('Вторая строка');
  await expect(assumptions).toHaveValue('Первая строка\nВторая строка');
  await page.getByRole('button', { name: 'Отменить правки CAD', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const a11y = await new AxeBuilder({ page }).include('#studio-cad').analyze();
  expect(a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.getByText('Открепить CAD от проекта', { exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Подтверждаю открепление текущей модели', exact: true })
    .check();
  await page.getByRole('button', { name: 'Открепить CAD', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Загрузить пример', exact: true })).toBeVisible();
  const detached = await (await page.request.get(`/api/studio/projects/${id}/cad`)).json();
  expect(detached.revision).toBe(null);
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('real CAD assembly builds, previews, rebuilds for the exact brief revision and hands identical files to the selected maker', async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.CAD_PYTHON,
    'Real CadQuery interpreter is required; no geometry fixtures are used.',
  );
  test.setTimeout(180000);
  const pageErrors: string[] = [];
  const aiCalls: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/assist') || request.url().includes('api.openai.com'))
      aiCalls.push(request.url());
  });
  const id = await createWorkspace(
    page,
    'Нужно разработать мебельную сборку из фанерных панелей и согласовать соединения. Учебный образец нужен для обсуждения с инженером.',
  );
  const studioURL = page.url();
  await page.getByRole('combobox', { name: 'Учебный пример', exact: true }).selectOption('shelf');
  await page.getByRole('button', { name: 'Загрузить пример', exact: true }).click();
  await page.getByLabel('Название компонента', { exact: true }).fill('Основание стенда');
  await saveCAD(page);
  await page.getByRole('button', { name: 'Построить CAD', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Показать компонент', exact: true })).toBeVisible(
    { timeout: 90000 },
  );
  await page
    .getByRole('combobox', { name: 'Показать компонент', exact: true })
    .selectOption('base');
  await page.getByRole('slider', { name: /Разнести компоненты/ }).fill('45');
  await expect(page.getByRole('img', { name: /Геометрия CAD/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Показать компонент', exact: true }).selectOption('');
  await page.getByRole('slider', { name: /Разнести компоненты/ }).fill('0');
  await page
    .locator('.cad-preview')
    .screenshot({ path: test.info().outputPath('cad-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.cad-preview').screenshot({ path: test.info().outputPath('cad-mobile.png') });
  const modelA11y = await new AxeBuilder({ page }).include('#studio-cad').analyze();
  expect(
    modelA11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeEnabled();
  const first = (await (
    await page.request.get(`/api/studio/projects/${id}/cad`)
  ).json()) as CadState;
  expect(first.builds[0]?.status).toBe('succeeded');
  expect(first.builds[0]?.report?.solids).toBe(3);
  expect(first.builds[0]?.report?.passed).toBe(false); // The example explicitly lacks designed joints.
  expect(first.builds[0]?.report?.verification_scope).toBe('geometry_only');
  await page.getByLabel('Количество изделий', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Сохранить ТЗ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить ТЗ', exact: true })).toBeDisabled();
  await expect(
    page.getByText('Предыдущая версия: не соответствует текущему ТЗ', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Построить CAD', exact: true }).click();
  await expect(
    page.getByText('Предыдущая версия: не соответствует текущему ТЗ', { exact: true }),
  ).not.toBeVisible({ timeout: 90000 });
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeEnabled({
    timeout: 90000,
  });
  const state = (await (
    await page.request.get(`/api/studio/projects/${id}/cad`)
  ).json()) as CadState;
  expect(state.builds).toHaveLength(2);
  const current = state.builds[0]!;
  expect(current.status).toBe('succeeded');
  expect(current.project_version).toBe(first.builds[0]!.project_version + 1);
  await page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ТЗ подтверждено', exact: true })).toBeDisabled();
  const stl = await bytesFromLink(page, /^model\.stl/);
  const step = await bytesFromLink(page, /^model\.step/);
  expect(step.toString('utf8')).toContain('ISO-10303-21;');
  expect(createHash('sha256').update(stl).digest('hex')).toBe(
    current.artifacts.find((artifact) => artifact.name === 'model.stl')?.sha256,
  );
  const packet = JSON.parse(
    (await bytesFromLink(page, /^Скачать пакет ТЗ \(JSON\)$/)).toString('utf8'),
  );
  expect(packet.cad.build_id).toBe(current.id);
  expect(packet.cad.geometry_passed).toBe(false);
  expect(packet.geometry_scope).toBe('declarative_cad');
  const matched = (await (await page.request.get(`/api/studio/projects/${id}/matches`)).json())
    .matches;
  const makerChoice = page
    .locator('.studio-maker-choice')
    .filter({ has: page.getByRole('link', { name: /Профиль:/ }) })
    .first();
  await expect(makerChoice).toBeVisible();
  const target = (await makerChoice.getByRole('link').getAttribute('href'))!.split('/').at(-1)!;
  const maker = matched.find(
    (match: { profile: { id: string } }) => match.profile.id === target,
  ).profile;
  await makerChoice.getByRole('radio').check();
  await page.getByRole('checkbox', { name: /Подтверждаю отправку.*CAD/ }).check();
  await page.getByRole('button', { name: 'Отправить выбранному исполнителю', exact: true }).click();
  await expect(page).toHaveURL(/projects\/[a-f0-9-]{36}$/);
  const jobId = page.url().split('/').at(-1)!;
  const guest = await browser.newContext({ baseURL: 'http://127.0.0.1:3012' });
  expect((await guest.request.get(`/api/jobs/${jobId}/cad/artifacts/model.stl`)).status()).toBe(
    401,
  );
  await guest.close();
  const makerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3012' });
  const makerPage = await makerContext.newPage();
  await makerPage.goto('/');
  await makerPage
    .getByRole('combobox', { name: 'Демо-участник', exact: true })
    .selectOption(maker.user_id);
  await makerPage.goto(`/projects/${jobId}`);
  const received = await (await makerPage.request.get(`/api/jobs/${jobId}/cad`)).json();
  expect(received.access).toBe(true);
  expect(received.build.id).toBe(current.id);
  expect(await bytesFromLink(makerPage, /^model\.stl$/)).toEqual(stl);
  const artifact = await makerPage.request.get(`/api/jobs/${jobId}/cad/artifacts/model.stl`);
  expect(artifact.status()).toBe(200);
  expect(await artifact.body()).toEqual(stl);
  expect(artifact.headers()['x-content-sha256']).toBe(
    current.artifacts.find((file) => file.name === 'model.stl')?.sha256,
  );
  await makerContext.close();
  await page.goto(studioURL);
  await expect(page.getByLabel('Название CAD-модели', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Сохранить CAD', exact: true })).not.toBeVisible();
  await page
    .getByRole('combobox', { name: 'История построений', exact: true })
    .selectOption(first.builds[0]!.id);
  await expect(
    page.getByText('Предыдущая версия: не соответствует текущему ТЗ', { exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(aiCalls).toEqual([]);
});
