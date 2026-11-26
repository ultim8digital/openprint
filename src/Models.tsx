import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Download, ArrowUpRight, Search, ShieldCheck, Check } from 'lucide-react';
import { useApp, useRemote, post, upload, Loading, ErrorBox, Empty, errorText } from './core';
import { PageTitle, ReportButton } from './Browse';
import { stageFile } from './model-handoff';
import { PartArt } from './art';
import type { PartSpec } from '../shared/parts';
type SharedModel = {
  id: string;
  title: string;
  description: string;
  category: string;
  license: string;
  attribution: string;
  author_name: string;
  file_id: string | null;
  preset: PartSpec | null;
  file_name: string;
  file_size: number;
  demo: boolean;
};
const licenseLink = (code: string) =>
  code === 'CC0-1.0'
    ? 'https://creativecommons.org/publicdomain/zero/1.0/'
    : code === 'CC-BY-4.0'
      ? 'https://creativecommons.org/licenses/by/4.0/'
      : 'https://creativecommons.org/licenses/by-sa/4.0/';
function PublishForm() {
  const { t, user } = useApp(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  if (!user)
    return (
      <div className="panel">
        <h2>{t('Поделитесь тем, что сделали.', 'Share something you made.')}</h2>
        <p className="muted small" style={{ margin: '15px 0' }}>
          {t(
            'Войдите, чтобы добавить свою модель в открытую библиотеку.',
            'Sign in to add your original design to the community library.',
          )}
        </p>
        <Link className="button" to="/login?next=/models?publish=1">
          {t('Войти', 'Sign in')}
          <ArrowUpRight className="directional-icon" size={15} />
        </Link>
      </div>
    );
  if (success)
    return (
      <div className="empty">
        <div className="empty-symbol">
          <Check />
        </div>
        <h3>{t('Спасибо за ваш вклад!', 'Thanks for sharing!')}</h3>
        <p>
          {t(
            'Модель отправлена модератору. Она появится в библиотеке после проверки. Статус доступен в кабинете.',
            'Your model is pending moderator review. Once approved, it will appear in the library. Check its status in your workspace.',
          )}
        </p>
        <Link className="button secondary" to="/workspace?tab=models">
          {t('Мои модели', 'My models')}
          <ArrowUpRight className="directional-icon" size={15} />
        </Link>
      </div>
    );
  return (
    <form
      className="panel model-form stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget),
          file = form.get('file') as File;
        setBusy(true);
        setError('');
        try {
          const uploaded = await upload(file);
          await post('/models', {
            title: form.get('title'),
            description: form.get('description'),
            category: form.get('category'),
            license: form.get('license'),
            attribution: form.get('attribution'),
            file_id: uploaded.file.id,
            rights: form.get('rights') === 'on',
          });
          setSuccess(true);
        } catch (error) {
          setError(errorText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{t('Новая модель для сообщества', 'A new design for the community')}</h2>
      <label>
        {t('Название', 'Title')}
        <input dir="auto" name="title" required minLength={5} maxLength={120} />
      </label>
      <label>
        {t('Описание, размеры и советы по печати', 'Description, dimensions & printing notes')}
        <textarea dir="auto" name="description" required minLength={30} maxLength={3000} rows={5} />
      </label>
      <div className="form-grid">
        <label>
          {t('Категория', 'Category')}
          <select name="category">
            <option dir="auto" value="parts">
              {t('Детали', 'Parts')}
            </option>
            <option dir="auto" value="home">
              {t('Для дома', 'Home')}
            </option>
            <option dir="auto" value="tools">
              {t('Инструменты', 'Tools')}
            </option>
            <option dir="auto" value="art">
              {t('Творчество', 'Art')}
            </option>
          </select>
        </label>
        <label>
          {t('Лицензия', 'License')}
          <select name="license">
            <option dir="auto" value="CC-BY-4.0">
              CC BY 4.0
            </option>
            <option dir="auto" value="CC-BY-SA-4.0">
              CC BY-SA 4.0
            </option>
            <option dir="auto" value="CC0-1.0">
              CC0 1.0
            </option>
          </select>
        </label>
      </div>
      <label>
        {t('Имя автора для указания при использовании', 'Creator attribution')}
        <input
          dir="auto"
          name="attribution"
          defaultValue={user.name}
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label>
        {t('Файл модели', 'Model file')}
        <input
          dir="auto"
          aria-label={t('Файл модели', 'Model file')}
          name="file"
          type="file"
          accept=".stl,.obj,.step,.stp,.glb,.3mf"
          required
        />
        <small>
          {t(
            'До 20 МБ. После публикации модель смогут скачивать все.',
            'Up to 20 MB. Once published, anyone can download this file.',
          )}
        </small>
      </label>
      <p className="info-box">
        {t(
          'Выберите лицензию осознанно: она разрешает другим использовать вашу работу на указанных условиях. Уже выданные разрешения и скачанные файлы не отзываются при удалении модели.',
          'Choose your license carefully. It grants reuse rights on its terms. Removing a model does not revoke existing permissions or downloads.',
        )}{' '}
        <a
          href="https://creativecommons.org/share-your-work/cclicenses/"
          target="_blank"
          rel="noreferrer"
        >
          {t('О лицензиях', 'About the licenses')} ↗
        </a>
      </p>
      <label className="check-label">
        <input dir="auto" name="rights" type="checkbox" required />
        {t(
          'Я автор или имею право распространять эту модель под выбранной лицензией.',
          'I am the creator or have permission to distribute this model under the selected license.',
        )}
      </label>
      <ErrorBox error={error} />
      <button className="button" disabled={busy}>
        {busy ? t('Загружаем…', 'Uploading…') : t('Отправить на проверку', 'Submit for review')}
        <ArrowUpRight className="directional-icon" size={16} />
      </button>
    </form>
  );
}
export default function Models() {
  const { t, user, toast } = useApp(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    target = params.get('target'),
    [offset, setOffset] = useState(0),
    remote = useRemote<{ models: SharedModel[]; has_more: boolean }>(
      `/models?q=${encodeURIComponent(params.get('q') || '')}&limit=12&offset=${offset}`,
    ),
    [downloading, setDownloading] = useState('');
  return (
    <div className="page">
      <PageTitle
        eyebrow={t('ХОРОШИМИ ИДЕЯМИ СТОИТ ДЕЛИТЬСЯ', 'GOOD IDEAS ARE WORTH SHARING')}
        title={t('Модели, полезные каждому.', 'Designs worth making.')}
        description={t(
          'Открытые модели участников с понятными лицензиями. Скачайте, измените под свою задачу и поделитесь результатом.',
          'Community designs with clear licenses. Download, adapt them to your project, and share what you make.',
        )}
      >
        <button
          className="button"
          onClick={() =>
            setParams({
              ...(target ? { target } : {}),
              ...(params.get('publish') ? {} : { publish: '1' }),
            })
          }
        >
          <Plus size={16} />
          {params.get('publish')
            ? t('Вернуться в библиотеку', 'Back to the library')
            : t('Поделиться моделью', 'Share a model')}
        </button>
      </PageTitle>
      {params.get('publish') ? (
        <PublishForm />
      ) : (
        <>
          <div className="filter-panel">
            <div className="search-input">
              <Search size={18} />
              <input
                dir="auto"
                aria-label={t('Поиск моделей', 'Search models')}
                placeholder={t(
                  'Деталь, органайзер, держатель…',
                  'A part, an organizer, a bracket…',
                )}
                value={params.get('q') || ''}
                onChange={(e) => {
                  setParams({
                    ...(target ? { target } : {}),
                    ...(e.target.value ? { q: e.target.value } : {}),
                  });
                  setOffset(0);
                }}
              />
            </div>
          </div>
          <ErrorBox error={remote.error} retry={remote.reload} />
          {remote.loading ? (
            <Loading />
          ) : remote.data?.models.length ? (
            <div className="model-grid">
              {remote.data.models.map((model, i) => (
                <article className="model-card" key={model.id}>
                  <div className="model-art">
                    <span className="license-tag">{model.license}</span>
                    <PartArt
                      variant={
                        model.preset?.kind === 'tube' ? 1 : model.preset?.kind === 'block' ? 2 : 0
                      }
                    />
                    {!model.preset && (
                      <span className="viewer-note">
                        {t(
                          'Условная иллюстрация · файл участника',
                          'Illustration · maker-uploaded file',
                        )}
                      </span>
                    )}
                  </div>
                  <div className="model-info">
                    <h3 dir="auto">{model.title}</h3>
                    <small>{model.attribution}</small>
                    <p>{model.description}</p>
                    <div className="tags">
                      <a
                        href={licenseLink(model.license)}
                        target="_blank"
                        rel="noreferrer"
                        className="micro muted"
                      >
                        {model.license} ↗
                      </a>
                      {model.file_name && (
                        <span>{model.file_name.split('.').at(-1)?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="row" style={{ marginTop: 19 }}>
                      {model.preset ? (
                        <>
                          <button
                            className="button small secondary"
                            disabled={downloading === model.id}
                            onClick={async () => {
                              setDownloading(model.id);
                              try {
                                const { partFile, downloadFile } = await import('./model-files');
                                downloadFile(partFile(model.preset!));
                              } catch (error) {
                                toast(errorText(error));
                              } finally {
                                setDownloading('');
                              }
                            }}
                          >
                            <Download size={14} />
                            STL
                          </button>
                          <Link
                            className="text-button"
                            to={
                              '/tools?' +
                              new URLSearchParams({
                                preset: JSON.stringify(model.preset),
                                ...(target ? { target } : {}),
                              })
                            }
                          >
                            {t('Изменить размеры', 'Customize')}
                            <ArrowUpRight className="directional-icon" size={14} />
                          </Link>
                        </>
                      ) : (
                        <>
                          {model.file_id && /\.(stl|obj)$/i.test(model.file_name) && (
                            <button
                              className="text-button"
                              disabled={!!downloading}
                              onClick={async () => {
                                setDownloading(model.id);
                                try {
                                  const response = await fetch(
                                    '/api/files/' + encodeURIComponent(model.file_id!),
                                  );
                                  if (!response.ok)
                                    throw new Error(
                                      t(
                                        'Не удалось получить ответ сервера. Проверьте соединение и повторите действие.',
                                        'The server did not respond. Check your connection and retry.',
                                      ),
                                    );
                                  const file = new File([await response.blob()], model.file_name);
                                  navigate(
                                    '/tools?' +
                                      new URLSearchParams({
                                        attachment: stageFile(file),
                                        ...(target ? { target } : {}),
                                      }),
                                  );
                                } catch (err) {
                                  toast(errorText(err));
                                } finally {
                                  setDownloading('');
                                }
                              }}
                            >
                              {t('Изменить размеры', 'Customize')}
                            </button>
                          )}
                          <a
                            className="button small secondary"
                            href={'/api/files/' + model.file_id}
                            download
                          >
                            <Download size={14} />
                            {t('Скачать файл', 'Download file')}
                          </a>
                        </>
                      )}
                    </div>
                    {user && (
                      <div style={{ marginTop: 14 }}>
                        <ReportButton kind="model" target={model.id} />
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title={t('Библиотека начинается с вас', 'This library starts with you')}
              description={t(
                'Поделитесь собственной моделью — или создайте простую деталь в конструкторе.',
                'Share an original design, or create a simple part with the builder.',
              )}
            >
              <Link className="button secondary" to="/tools">
                {t('Открыть конструктор', 'Open the part builder')}
                <ArrowUpRight className="directional-icon" size={15} />
              </Link>
            </Empty>
          )}
          <div className="pagination">
            {offset > 0 && (
              <button
                className="button secondary"
                onClick={() => setOffset((v) => Math.max(0, v - 12))}
              >
                {t('Назад', 'Previous')}
              </button>
            )}
            {remote.data?.has_more && (
              <button className="button secondary" onClick={() => setOffset((v) => v + 12)}>
                {t('Дальше', 'Next page')}
                <ArrowUpRight className="directional-icon" size={15} />
              </button>
            )}
          </div>
          <div className="info-box">
            <ShieldCheck size={15} />{' '}
            {t(
              'Проверьте лицензию и рекомендации автора перед использованием. Публикация модели не подтверждает её пригодность для ответственных конструкций.',
              'Review the license and creator notes before use. Publication is not certification for safety-critical applications.',
            )}
          </div>
        </>
      )}
    </div>
  );
}
