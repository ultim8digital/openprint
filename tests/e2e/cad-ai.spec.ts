import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sampleCadSpec } from '../../shared/cad';
import type { CadProposal, CadProposalState } from '../../shared/cad-ai';
import type { StudioProject } from '../../shared/studio';

// These tests verify UI behavior with explicitly mocked AI-proposal responses.
// Auth, project editing, CAD revision persistence and publication use the real local server.
// They do not call OpenAI or establish live model quality.
async function workspace(page: Page) {
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
    .fill(
      'Для обсуждения с инженером нужна пластина 80 × 50 × 6 мм с двумя отверстиями диаметром 5 мм. Материал и изготовление согласуем позже.',
    );
  await page.getByRole('button', { name: 'Создать рабочий проект', exact: true }).click();
  await expect(page).toHaveURL(/studio\/[a-f0-9-]{36}$/);
  await page.getByLabel('Количество изделий', { exact: true }).fill('2');
  await page.getByLabel('Город или «Удалённо»', { exact: true }).fill('Москва');
  await page.getByRole('button', { name: 'Сохранить ТЗ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить ТЗ', exact: true })).toBeDisabled();
  const id = page.url().split('/').at(-1)!;
  return (await (await page.request.get(`/api/studio/projects/${id}`)).json())
    .project as StudioProject;
}
function fixture(project: StudioProject, changes: Partial<CadProposal> = {}): CadProposal {
  const spec = sampleCadSpec('plate');
  spec.name = 'Пластина — тестовое предложение';
  spec.assumptions = ['Тестовый ответ ИИ, не реальная генерация. Размеры проверяет заказчик.'];
  return {
    id: crypto.randomUUID(),
    run_id: crypto.randomUUID(),
    project_id: project.id,
    input_version: project.version,
    model: 'mock-cad-planner',
    summary: 'Тестовое предложение: пластина с двумя отверстиями. Проверьте координаты отверстий.',
    questions: ['Подтверждены ли координаты центров отверстий?'],
    spec,
    created_at: Date.now(),
    applied_version: null,
    stale: false,
    ...changes,
  };
}
function proposalState(proposals: CadProposal[], calls = 0, maxCalls = 1): CadProposalState {
  return {
    proposals,
    usage: { projectCalls: calls, inputTokens: calls * 100, outputTokens: calls * 80, runs: [] },
    ai: { configured: true, model: 'mock-cad-planner', maxCallsPerProject: maxCalls },
  };
}
const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

test('mock AI transport: retry reuses the paid attempt, review protects drafts, and explicit apply creates CAD without building it', async ({
  page,
}) => {
  const project = await workspace(page);
  const candidate = fixture(project);
  const path = `/api/studio/projects/${project.id}/cad`;
  let calls = 0;
  let attempts = 0;
  let proposals: CadProposal[] = [];
  const ids: string[] = [];
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') mutations.push(new URL(request.url()).pathname);
  });
  await page.route(`**${path}/proposals`, async (route) => {
    const current = (await (await page.request.get(`/api/studio/projects/${project.id}`)).json())
      .project as StudioProject;
    await json(
      route,
      proposalState(
        proposals.map((proposal) => ({
          ...proposal,
          stale: proposal.input_version !== current.version,
        })),
        calls,
      ),
    );
  });
  await page.route(`**${path}/assist`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.version).toBe(project.version);
    expect(body.consent).toBe(true);
    expect(body.message).toContain('80 × 50 × 6');
    ids.push(body.requestId);
    attempts++;
    if (attempts === 1) {
      calls = 1;
      proposals = [candidate];
      await route.abort('failed'); // Simulate a response lost after a completed paid call.
    } else await json(route, proposalState(proposals, calls));
  });
  await page.route(`**${path}/proposals/${candidate.id}/apply`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ version: project.version, reviewed: true });
    // The AI-proposal apply endpoint is mocked. Persist through the real CAD save route.
    const response = await page.request.put(path, {
      data: { version: project.version, spec: candidate.spec },
      headers: { Origin: 'http://127.0.0.1:3012' },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    proposals = [{ ...candidate, applied_version: result.project.version }];
    await route.abort('failed'); // Apply persisted, but the browser lost its response.
  });
  await page.reload();
  const ask = page.getByRole('textbox', { name: 'Что спроектировать или изменить?', exact: true });
  await ask.fill(
    'Подготовь пластину 80 × 50 × 6 мм с отверстиями диаметром 5 мм, координаты центров [15,25] и [65,25].',
  );
  await expect(
    page.getByRole('button', { name: 'Получить предложение CAD', exact: true }),
  ).toBeDisabled();
  const consent = page.getByRole('checkbox', { name: /Разрешаю отправить язык проекта/ });
  await consent.check();
  await page.getByRole('button', { name: 'Получить предложение CAD', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Получить результат CAD-попытки', exact: true }),
  ).toBeEnabled();
  await expect(
    page.locator('.cad-assistant').getByText('Осталось обращений в проекте:', { exact: false }),
  ).toContainText('0 из 1');
  await page.getByRole('button', { name: 'Получить результат CAD-попытки', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Предложение для проверки', exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(calls).toBe(1);
  expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(ids[1]).toBe(ids[0]);
  expect((await (await page.request.get(path)).json()).revision).toBe(null);
  await expect(page.getByText(candidate.questions[0]!, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Применить предложение CAD', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('добавить · 80 × 50 × 6 мм · начало: [0, 0, 0] мм', { exact: true }),
  ).toBeVisible();
  const review = page.getByRole('checkbox', { name: /Проверил размеры, положение компонентов/ });
  await page.getByLabel('Количество изделий', { exact: true }).fill('3');
  await expect(review).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Применить предложение CAD', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Количество изделий', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Загрузить пример', exact: true }).click();
  await page.getByLabel('Название CAD-модели', { exact: true }).fill('Мой несохранённый черновик');
  await expect(review).toBeDisabled();
  await expect(page.getByLabel('Название CAD-модели', { exact: true })).toHaveValue(
    'Мой несохранённый черновик',
  );
  await page.getByRole('button', { name: 'Отменить правки CAD', exact: true }).click();
  await expect(review).toBeEnabled();
  await review.check();
  await page.getByRole('button', { name: 'Применить предложение CAD', exact: true }).click();
  await expect(
    page.getByText(`Применено в версии проекта ${project.version + 1}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Название CAD-модели', { exact: true })).toHaveValue(
    candidate.spec!.name,
  );
  const saved = await (await page.request.get(path)).json();
  expect(saved.revision.spec).toEqual(candidate.spec);
  expect(saved.builds).toEqual([]);
  const current = (await (await page.request.get(`/api/studio/projects/${project.id}`)).json())
    .project;
  expect(current.version).toBe(project.version + 1);
  expect(current.confirmed_version).toBe(null);
  expect(current.job_id).toBe(null);
  expect(mutations.some((path) => /\/(build|confirm|publish)$/.test(path))).toBe(false);
});

test('mock AI history: question-only and stale proposals are readable, mobile accessible, and published projects are read-only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const project = await workspace(page);
  const question = fixture(project, {
    spec: null,
    summary: 'Тестовый ответ: данных для геометрии недостаточно.',
    questions: ['Укажите расстояние между крепёжными отверстиями.'],
  });
  const stale = fixture(project, {
    input_version: project.version - 1,
    stale: true,
    created_at: Date.now() - 1000,
  });
  await page.route(`**/api/studio/projects/${project.id}/cad/proposals`, (route) =>
    json(route, proposalState([question, stale], 2, 3)),
  );
  const unexpectedWrites: string[] = [];
  await page.route(`**/api/studio/projects/${project.id}/cad/assist`, async (route) => {
    unexpectedWrites.push(route.request().url());
    await json(route, { error: 'Unexpected mock call' }, 500);
  });
  await page.reload();
  await expect(page.getByText('Модель пока не предложена.', { exact: false })).toBeVisible();
  await expect(page.getByText(question.questions[0]!, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Применить предложение CAD', exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole('combobox', { name: 'История предложений CAD', exact: true })
    .selectOption(stale.id);
  await expect(page.getByText('Контекст проекта изменился.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: /Проверил размеры, положение компонентов/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Применить предложение CAD', exact: true }),
  ).toBeDisabled();
  await page.getByText('Посмотреть JSON предложения', { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const a11y = await new AxeBuilder({ page }).include('.cad-assistant').analyze();
  expect(
    a11y.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Подтвердить ТЗ', exact: true }).click();
  await page.getByRole('checkbox', { name: /Подтверждаю публикацию/ }).check();
  await page.getByRole('button', { name: 'Опубликовать заявку', exact: true }).click();
  await expect(page).toHaveURL(/projects\/[a-f0-9-]{36}$/);
  await page.goto(`/studio/${project.id}`);
  await expect(
    page.getByText('Заявка опубликована: история предложений доступна для просмотра.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Что спроектировать или изменить?', exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole('combobox', { name: 'История предложений CAD', exact: true })
    .selectOption(stale.id);
  await expect(
    page.getByRole('button', { name: 'Применить предложение CAD', exact: true }),
  ).not.toBeVisible();
  expect(unexpectedWrites).toEqual([]);
});
