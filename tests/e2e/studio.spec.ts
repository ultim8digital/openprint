import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

async function openStudio(page: Page) {
  await page.goto('/');
  await page
    .getByRole('combobox', { name: 'Демо-участник', exact: true })
    .selectOption({ label: 'Аня · заказчик' });
  await page.goto('/studio');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Сначала ваша задача');
}
async function begin(page: Page, idea: string) {
  await page
    .getByRole('textbox', {
      name: 'Задача, условия использования и известные размеры',
      exact: true,
    })
    .fill(idea);
  await page.getByRole('button', { name: 'Создать рабочий проект', exact: true }).click();
  await expect(page).toHaveURL(/studio\/[a-f0-9-]{36}$/);
  await expect(page.getByLabel('Название проекта', { exact: true })).toBeVisible();
  return page.url().split('/').at(-1)!;
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Сохранить ТЗ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить ТЗ', exact: true })).toBeDisabled();
  await expect(page.getByText('Изменения сохранены', { exact: true })).toBeVisible();
}
async function download(page: Page, name: string) {
  const event = page.waitForEvent('download');
  await page.getByRole('link', { name, exact: true }).click();
  const file = await event;
  return readFileSync((await file.path())!);
}

test('manual Neofab template is reviewed, frozen and published with the exact STL and brief', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const paidCalls: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/assist') || request.url().includes('api.openai.com'))
      paidCalls.push(request.url());
  });
  await openStudio(page);
  const id = await begin(
    page,
    'Нужно изготовить пять простых прямоугольных блоков для проверки сборочного макета. Размеры уточню в техническом задании.',
  );
  const studioURL = page.url();
  await expect(page.getByText('Доступен ручной режим', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Уточнить с ИИ', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('link', { name: 'Скачать пакет ТЗ (JSON)', exact: true }),
  ).not.toBeVisible();
  await page
    .getByLabel('Название проекта', { exact: true })
    .fill('Пять прямоугольных блоков для макета');
  await page
    .getByRole('combobox', { name: 'Что нужно от исполнителя?', exact: true })
    .selectOption('manufacture');
  await page
    .getByRole('combobox', { name: 'Основная технология', exact: true })
    .selectOption('FDM');
  await page.getByLabel('Материал или требования к материалу', { exact: true }).fill('PETG');
  await page.getByLabel('Количество изделий', { exact: true }).fill('5');
  await page.getByLabel('Город или «Удалённо»', { exact: true }).fill('Москва');
  await page.getByRole('combobox', { name: 'Шаблон модели', exact: true }).selectOption('block');
  await page.getByLabel('Ширина, мм', { exact: true }).fill('80');
  await page.getByLabel('Глубина, мм', { exact: true }).fill('40');
  await page.getByLabel('Высота, мм', { exact: true }).fill('8');
  await page
    .getByRole('textbox', { name: 'Неподтверждённые допущения', exact: true })
    .fill('Цвет ещё не согласован.');
  await save(page);
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeEnabled();
  await page
    .getByRole('textbox', { name: 'Требования к изделию', exact: false })
    .fill('Пять блоков 80 × 40 × 8 мм без отверстий.\nЦвет зелёный, согласован для макета.');
  await page.getByRole('textbox', { name: 'Открытые вопросы', exact: false }).fill('');
  await page.getByRole('textbox', { name: 'Неподтверждённые допущения', exact: false }).fill('');
  await page
    .getByRole('textbox', { name: 'Критерии приёмки', exact: false })
    .fill('Комплект из пяти деталей; размеры проверены исполнителем по ТЗ.');
  await expect(page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Опубликовать заявку', exact: true }),
  ).toBeDisabled();
  await save(page);
  await page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ТЗ подтверждено', exact: true })).toBeDisabled();
  const packet = JSON.parse((await download(page, 'Скачать пакет ТЗ (JSON)')).toString('utf8'));
  const model = await download(page, 'Скачать шаблон STL');
  expect(packet.project_id).toBe(id);
  expect(packet.brief.part).toEqual({ kind: 'block', width: 80, depth: 40, height: 8, hole: 0 });
  expect(packet.brief.quantity).toBe(5);
  expect(packet.cam).toBe('not_generated');
  expect(packet.manifest.find((entry: { path: string }) => entry.path === 'model.stl').sha256).toBe(
    createHash('sha256').update(model).digest('hex'),
  );
  expect(model.readUInt32LE(80)).toBe(12);
  // A local edit cannot publish against a previously confirmed revision.
  await page.getByLabel('Количество изделий', { exact: true }).fill('6');
  await expect(
    page.getByRole('button', { name: 'Опубликовать заявку', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /Подтверждаю публикацию/ })).toBeDisabled();
  await page.getByLabel('Количество изделий', { exact: true }).fill('5');
  await page.getByRole('checkbox', { name: /Подтверждаю публикацию/ }).check();
  await page.getByRole('button', { name: 'Опубликовать заявку', exact: true }).click();
  await expect(page).toHaveURL(/projects\/[a-f0-9-]{36}$/);
  const jobId = page.url().split('/').at(-1)!;
  const job = (await (await page.request.get('/api/projects/' + jobId)).json()).job;
  expect(job.visibility).toBe('public');
  expect(job.description).toContain(packet.confirmed_hash);
  expect(job.description).toContain('X=80; Y=40; Z=8; Ø=0');
  expect(job.quantity).toBe(5);
  expect(job.has_file).toBe(true);
  await page.goto(studioURL);
  await expect(page.getByText('Заявка создана', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Название проекта', { exact: true })).toBeDisabled();
  const reloadedPacket = JSON.parse(
    (await download(page, 'Скачать пакет ТЗ (JSON)')).toString('utf8'),
  );
  expect(reloadedPacket).toEqual(packet);
  expect(await download(page, 'Скачать шаблон STL')).toEqual(model);
  expect(paidCalls).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('mixed-process furniture BOM stays a design brief; mobile forms are accessible and direct publication is private', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStudio(page);
  const initialA11y = await new AxeBuilder({ page }).analyze();
  expect(
    initialA11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const id = await begin(
    page,
    'Нужна серия рабочих столов: деревянная столешница и стальной каркас. В проекте нужно согласовать чертежи, раскрой и сборку.',
  );
  await page.getByLabel('Название проекта', { exact: true }).fill('Малая серия рабочих столов');
  await page
    .getByRole('combobox', { name: 'Что нужно от исполнителя?', exact: true })
    .selectOption('design');
  await page
    .getByRole('combobox', { name: 'Основная технология', exact: true })
    .selectOption('MIXED');
  await page.getByLabel('Количество изделий', { exact: true }).fill('4');
  await page.getByLabel('Город или «Удалённо»', { exact: true }).fill('Москва');
  await page.getByRole('button', { name: 'Добавить позицию', exact: true }).click();
  await page.getByLabel('Название позиции', { exact: true }).nth(0).fill('Столешница');
  await page
    .getByRole('combobox', { name: 'Технология позиции', exact: true })
    .nth(0)
    .selectOption('WOOD_CNC');
  await page.getByLabel('Материал позиции', { exact: true }).nth(0).fill('Фанера');
  await page
    .getByRole('textbox', { name: 'Размеры и требования к позиции', exact: true })
    .nth(0)
    .fill('Габариты 1200 × 600 × 24 мм. Чертёж крепления разрабатывает инженер.');
  await page.getByRole('button', { name: 'Добавить позицию', exact: true }).click();
  await page.getByLabel('Название позиции', { exact: true }).nth(1).fill('Опора каркаса');
  await page.getByLabel('Кол-во', { exact: true }).nth(1).fill('2');
  await page
    .getByRole('combobox', { name: 'Технология позиции', exact: true })
    .nth(1)
    .selectOption('SHEET_METAL');
  await page.getByLabel('Материал позиции', { exact: true }).nth(1).fill('Сталь');
  await page
    .getByRole('textbox', { name: 'Размеры и требования к позиции', exact: true })
    .nth(1)
    .fill('Разработать гибку и крепления после согласования чертежей.');
  await page
    .getByRole('textbox', { name: 'Операции изготовления и сборки', exact: false })
    .fill(
      'Разработка и согласование чертежей.\nРаскрой столешницы и обработка кромок.\nИзготовление каркаса и контрольная сборка.',
    );
  await page
    .getByRole('textbox', { name: 'Критерии приёмки', exact: false })
    .fill(
      'Комплектность 4 изделий по утверждённым чертежам.\nКонтроль размеров и устойчивости по согласованному протоколу.',
    );
  await page
    .getByRole('textbox', { name: 'Требования к изделию', exact: false })
    .fill('Требуется инженерная разработка узлов и согласование чертежей до изготовления.');
  await page
    .getByRole('textbox', { name: 'Открытые вопросы', exact: false })
    .fill('Какие крепления и конструкция каркаса нужны для согласованной нагрузки?');
  await page
    .getByRole('textbox', { name: 'Неподтверждённые допущения', exact: false })
    .fill('Порошковое покрытие каркаса нужно обсудить с исполнителем.');
  await save(page);
  await expect(page.getByRole('combobox', { name: 'Шаблон модели', exact: true })).toHaveValue(
    'none',
  );
  await page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ТЗ подтверждено', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('link', { name: 'Скачать шаблон STL', exact: true }),
  ).not.toBeVisible();
  const packet = JSON.parse((await download(page, 'Скачать пакет ТЗ (JSON)')).toString('utf8'));
  expect(packet.brief.components).toHaveLength(2);
  expect(packet.brief.components[0].quantity).toBe(null);
  expect(packet.brief.components[1].quantity).toBe(2);
  expect(packet.brief.questions).toHaveLength(1);
  expect(packet.brief.assumptions).toHaveLength(1);
  expect(packet.brief.components.map((c: { process: string }) => c.process)).toEqual([
    'WOOD_CNC',
    'SHEET_METAL',
  ]);
  expect(packet.geometry_scope).toBe('no_geometry');
  expect(packet.manifest.map((entry: { path: string }) => entry.path)).toEqual(['brief.json']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const editorA11y = await new AxeBuilder({ page }).analyze();
  expect(
    editorA11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  const makerChoice = page
    .locator('.studio-maker-choice')
    .filter({ has: page.getByRole('link', { name: /Профиль:/ }) })
    .first();
  await expect(makerChoice).toBeVisible();
  await makerChoice.getByRole('radio').check();
  await page.getByRole('checkbox', { name: /Подтверждаю отправку/ }).check();
  await page.getByRole('button', { name: 'Отправить выбранному исполнителю', exact: true }).click();
  await expect(page).toHaveURL(/projects\/[a-f0-9-]{36}$/);
  const jobId = page.url().split('/').at(-1)!;
  const job = (await (await page.request.get('/api/projects/' + jobId)).json()).job;
  expect(job.kind).toBe('design');
  expect(job.visibility).toBe('direct');
  expect(job.has_file).toBe(false);
  expect(job.description).toContain('Столешница');
  expect(job.description).toContain('Опора каркаса × 2');
  expect(job.description).toContain('WOOD_CNC');
  expect(job.description).toContain('SHEET_METAL');
  expect(job.description).toContain(packet.brief.questions[0]);
  expect(job.description).toContain(packet.brief.assumptions[0]);
  expect(job.description).toContain(packet.confirmed_hash);
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3012' });
  expect((await guestContext.request.get('/api/studio/projects/' + id)).status()).toBe(401);
  expect((await guestContext.request.get('/api/projects/' + jobId)).status()).toBe(404);
  await guestContext.close();
});
