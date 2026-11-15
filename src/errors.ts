import type { Translator } from '../shared/messages';
import { getActiveLanguage, translate, matchesTranslation } from './i18n';

const errors: Record<string, [string, string]> = {
  AUTH_REQUIRED: ['Войдите, чтобы продолжить.', 'Sign in to continue.'],
  FORBIDDEN: ['У вас нет доступа к этому действию.', 'You do not have access to this action.'],
  NOT_FOUND: ['Запись или файл не найдены.', 'The record or file was not found.'],
  VALIDATION: [
    'Проверьте заполненные поля и допустимые значения.',
    'Check the completed fields and allowed values.',
  ],
  SERVER_ERROR: [
    'Ошибка сервера. Повторите попытку позже.',
    'Server error. Please try again later.',
  ],
  RATE_LIMIT: [
    'Слишком много запросов. Подождите и повторите.',
    'Too many requests. Wait and try again.',
  ],
  DAILY_LIMIT: [
    'Достигнут суточный лимит. Повторите позже.',
    'The daily limit has been reached. Try again later.',
  ],
  ORIGIN: [
    'Запрос должен быть отправлен с этого сайта.',
    'The request must be sent from this website.',
  ],
  LOGIN_FAILED: ['Неверная почта или пароль.', 'Incorrect email or password.'],
  EMAIL_EXISTS: ['Эта почта уже используется.', 'This email address is already in use.'],
  TOKEN_INVALID: [
    'Ссылка недействительна или срок её действия истёк.',
    'The link is invalid or has expired.',
  ],
  MANAGEMENT_KEY_INVALID: [
    'Личная ссылка управления недействительна.',
    'The private management link is invalid.',
  ],
  SUBMISSION_DELETED: ['Эта карточка удалена.', 'This listing has been deleted.'],
  DUPLICATE_STUDIO: [
    'Такая студия уже есть в каталоге.',
    'This studio is already in the directory.',
  ],
  SUBMISSION_CAPACITY: [
    'Достигнут лимит публикаций. Повторите позже.',
    'The publication limit has been reached. Try again later.',
  ],
  VERSION_CONFLICT: [
    'Карточка изменилась. Загрузите последнюю версию перед сохранением.',
    'The listing has changed. Load the latest version before saving.',
  ],
  PROFILE_REQUIRED: ['Сначала создайте профиль мастерской.', 'Create a workshop profile first.'],
  ENGINEER_REQUIRED: [
    'Для этого действия нужен профиль инженера.',
    'An engineer profile is required for this action.',
  ],
  STUDIO_REQUIRED: [
    'Для этого действия нужен профиль мастерской.',
    'A workshop profile is required for this action.',
  ],
  BLOCKED: [
    'Действие недоступно из-за блокировки участника.',
    'This action is unavailable because a participant is blocked.',
  ],
  MODERATED: [
    'Публикация скрыта владельцем сервера.',
    'This publication has been hidden by the server operator.',
  ],
  ACTIVE_DEALS: ['Сначала завершите активные сделки.', 'Complete active agreements first.'],
  LAST_ADMIN: [
    'Нельзя удалить последнего администратора.',
    'The last administrator cannot be removed.',
  ],
  OWN_JOB: [
    'Нельзя предложить услуги по собственному запросу.',
    'You cannot offer services on your own request.',
  ],
  JOB_CHANGED: [
    'Запрос изменился. Обновите страницу.',
    'The request has changed. Refresh the page.',
  ],
  JOB_CLOSED: ['Этот запрос уже закрыт.', 'This request is already closed.'],
  OFFER_STALE: [
    'Предложение изменилось или больше недоступно.',
    'The offer has changed or is no longer available.',
  ],
  PROVIDER_UNAVAILABLE: [
    'Выбранный исполнитель больше недоступен.',
    'The selected provider is no longer available.',
  ],
  TARGET_INVALID: [
    'Выберите доступного исполнителя для личного запроса.',
    'Choose an available provider for the direct request.',
  ],
  THREAD_CLOSED: ['Обсуждение закрыто.', 'This conversation is closed.'],
  TRANSITION: [
    'Это действие недоступно на текущем этапе.',
    'This action is unavailable at the current stage.',
  ],
  CURSOR: [
    'Ссылка на страницу устарела. Начните просмотр заново.',
    'The page link is outdated. Start browsing again.',
  ],
  CONTENT_TYPE: ['Неподдерживаемый формат запроса.', 'Unsupported request format.'],
  JSON_INVALID: ['Не удалось прочитать данные запроса.', 'The request data could not be read.'],
  TOO_LARGE: ['Размер данных превышает допустимый предел.', 'The data exceeds the allowed size.'],
  FILE_SIZE: ['Размер файла превышает допустимый предел.', 'The file exceeds the allowed size.'],
  FILE_NAME: ['Проверьте имя файла.', 'Check the file name.'],
  FILE_TYPE: ['Этот тип файла не поддерживается.', 'This file type is not supported.'],
  FILE_INVALID: [
    'Файл повреждён или имеет неверный формат.',
    'The file is damaged or has an invalid format.',
  ],
  NO_MODEL: ['Сначала добавьте модель.', 'Add a model first.'],
  MODEL_INTEGRITY: [
    'Не удалось проверить целостность модели.',
    'The model integrity check failed.',
  ],
  STORAGE_LIMIT: [
    'На сервере достигнут лимит хранения файлов.',
    'The server file storage limit has been reached.',
  ],
  STUDIO_CHANGED: [
    'Техническое задание изменилось. Загрузите последнюю версию.',
    'The brief has changed. Load the latest version.',
  ],
  STUDIO_INCOMPLETE: [
    'Заполните обязательные поля технического задания.',
    'Complete the required brief fields.',
  ],
  STUDIO_UNCONFIRMED: [
    'Проверьте и подтвердите текущую версию технического задания.',
    'Review and confirm the current brief version.',
  ],
  STUDIO_PUBLISHED: ['Этот проект уже опубликован.', 'This project has already been published.'],
  STUDIO_PUBLICATION_CHANGED: [
    'Сохранённые условия публикации отличаются от запроса.',
    'The saved publication terms differ from this request.',
  ],
  STUDIO_PROJECT_LIMIT: [
    'Достигнут лимит проектов студии.',
    'The studio project limit has been reached.',
  ],
  STUDIO_REVISION_LIMIT: [
    'Достигнут лимит версий проекта.',
    'The project revision limit has been reached.',
  ],
  STUDIO_STORAGE_LIMIT: [
    'Достигнут лимит хранения проектов студии.',
    'The studio project storage limit has been reached.',
  ],
  TEMPLATE_INVALID: [
    'Проверьте размеры и форму шаблона детали.',
    'Check the part template dimensions and shape.',
  ],
  HANDOFF_TOO_LONG: [
    'Пакет для исполнителя слишком большой. Сократите техническое задание.',
    'The provider packet is too large. Shorten the brief.',
  ],
  REQUEST_ID_REUSED: [
    'Идентификатор запроса уже использован с другими данными.',
    'The request identifier was already used with different data.',
  ],
  AI_DISABLED: [
    'Владелец сервера ещё не настроил ИИ.',
    'The server operator has not configured AI yet.',
  ],
  AI_BUSY: [
    'ИИ занят другим запросом. Повторите позже.',
    'AI is busy with another request. Try again later.',
  ],
  AI_RUNNING: ['Этот запрос ИИ ещё выполняется.', 'This AI request is still running.'],
  AI_INCOMPLETE: [
    'ИИ не завершил ответ. Попробуйте уточнить запрос.',
    'AI did not complete the response. Try clarifying the request.',
  ],
  AI_INPUT_LIMIT: [
    'Запрос слишком большой. Сократите текст или техническое задание.',
    'The request is too large. Shorten the text or brief.',
  ],
  AI_PROJECT_LIMIT: [
    'Достигнут лимит запросов ИИ для проекта.',
    'The project AI request limit has been reached.',
  ],
  AI_USER_LIMIT: [
    'Достигнут ваш суточный лимит запросов ИИ.',
    'Your daily AI request limit has been reached.',
  ],
  AI_INSTANCE_LIMIT: [
    'Достигнут суточный лимит ИИ на этом сервере.',
    'This server’s daily AI request limit has been reached.',
  ],
  AI_INTERRUPTED: [
    'Запрос ИИ был прерван. Повторите попытку.',
    'The AI request was interrupted. Try again.',
  ],
  AI_INVALID: [
    'Ответ ИИ не прошёл проверку. Изменения не применены.',
    'The AI response failed validation. No changes were applied.',
  ],
  AI_NOT_APPLIED: [
    'Предложение ИИ не применено. Проверьте текущую версию проекта.',
    'The AI proposal was not applied. Check the current project version.',
  ],
  AI_PROVIDER: ['Сервис ИИ временно недоступен.', 'The AI service is temporarily unavailable.'],
  AI_REFUSAL: ['ИИ не смог выполнить этот запрос.', 'AI could not fulfil this request.'],
  AI_REQUEST_CHANGED: [
    'Этот запрос ИИ уже отправлен с другими данными.',
    'This AI request was already submitted with different data.',
  ],
  AI_TIMEOUT: ['Время ожидания ответа ИИ истекло.', 'The AI response timed out.'],
  CAD_NOT_CONFIGURED: [
    'Ядро CAD не настроено на этом сервере.',
    'The CAD kernel is not configured on this server.',
  ],
  CAD_BUSY: ['Ядро CAD занято. Повторите позже.', 'The CAD kernel is busy. Try again later.'],
  CAD_TIMEOUT: ['Время построения CAD истекло.', 'The CAD build timed out.'],
  CAD_CANCELLED: ['Построение CAD отменено.', 'The CAD build was cancelled.'],
  CAD_BUILD_LIMIT: ['Достигнут лимит построений CAD.', 'The CAD build limit has been reached.'],
  CAD_STORAGE_LIMIT: [
    'Достигнут лимит хранения файлов CAD.',
    'The CAD file storage limit has been reached.',
  ],
  CAD_ARTIFACT_LIMIT: [
    'Результат CAD превышает допустимый размер.',
    'The CAD output exceeds the allowed size.',
  ],
  CAD_SPEC_LIMIT: [
    'Описание CAD превышает допустимый размер.',
    'The CAD specification exceeds the allowed size.',
  ],
  CAD_SPEC_REQUIRED: [
    'Сначала добавьте описание модели CAD.',
    'Add a CAD model specification first.',
  ],
  CAD_BUILD_REQUIRED: [
    'Сначала успешно постройте текущую версию CAD.',
    'Successfully build the current CAD version first.',
  ],
  CAD_SPEC_MISMATCH: [
    'Модель CAD не соответствует текущей версии проекта.',
    'The CAD model does not match the current project version.',
  ],
  CAD_TEMPLATE_CONFLICT: [
    'Выберите либо параметрическую модель CAD, либо простой шаблон.',
    'Choose either a parametric CAD model or a simple template.',
  ],
  CAD_ASSIGNED: [
    'Доступ к CAD уже связан с выбранным исполнителем.',
    'CAD access is already linked to the selected provider.',
  ],
  CAD_PROPOSAL_EMPTY: [
    'В предложении ИИ нет модели CAD для применения.',
    'The AI proposal has no CAD model to apply.',
  ],
  CAD_PROPOSAL_LIMIT: [
    'Достигнут лимит предложений CAD.',
    'The CAD proposal limit has been reached.',
  ],
  CAD_PROPOSAL_STALE: [
    'Проект изменился после создания предложения CAD. Создайте новое предложение.',
    'The project changed after the CAD proposal was created. Create a new proposal.',
  ],
  CAD_REQUEST_CHANGED: [
    'Этот запрос CAD уже отправлен с другими данными.',
    'This CAD request was already submitted with different data.',
  ],
};
const cadIntegrity = new Set([
  'CAD_ARTIFACTS',
  'CAD_INTEGRITY',
  'CAD_MANIFEST',
  'CAD_MESH',
  'CAD_PROVIDER_INVALID',
  'CAD_REPORT',
  'CAD_STL',
  'CAD_ZIP',
]);
export function localizedError(
  error: unknown,
  t: Translator = (ru, en, params) => translate(getActiveLanguage(), ru, en, params),
): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const pair = errors[code];
  if (pair) return t(...pair);
  if (cadIntegrity.has(code))
    return t(
      'Результат CAD не прошёл проверку целостности. Не используйте эти файлы для изготовления.',
      'The CAD output failed integrity checks. Do not use these files for manufacturing.',
    );
  if (code)
    return t(
      'Не удалось выполнить действие. Код ошибки: {code}.',
      'The action could not be completed. Error code: {code}.',
      { code },
    );
  if (error instanceof TypeError)
    return t(
      'Не удалось связаться с сервером. Проверьте соединение.',
      'Could not reach the server. Check your connection.',
    );
  const message = error instanceof Error ? error.message : String(error);
  // Existing displayed errors can be translated again when the UI language changes.
  for (const value of Object.values(errors))
    if (matchesTranslation(message, ...value)) return t(...value);
  return message;
}
