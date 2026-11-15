import { lazy, Suspense, useState } from 'react';
import { Download, RefreshCw, LockKeyhole } from 'lucide-react';
import type { CadBuild } from '../shared/cad';
import { ErrorBox, Loading, errorText, post, useApp, useRemote } from './core';
import './cad.css';
const CadPreview = lazy(() => import('./cad-preview'));
type Handoff = {
  available: boolean;
  access: boolean;
  build?: CadBuild;
  version?: number;
  confirmed_hash?: string;
  participants?: { provider_id: string; name: string; allowed: number }[];
};
export default function JobCad({
  jobId,
  owner,
  revision,
}: {
  jobId: string;
  owner: boolean;
  revision: string;
}) {
  const { t } = useApp();
  const remote = useRemote<Handoff>(`/jobs/${jobId}/cad`, revision);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function access(provider_id: string, allow: boolean) {
    setBusy(provider_id);
    setError('');
    try {
      await post(`/jobs/${jobId}/cad/grants`, { provider_id, allow });
      remote.reload();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy('');
    }
  }
  if (remote.loading && !remote.data) return <Loading />;
  if (remote.error) return <ErrorBox error={remote.error} retry={remote.reload} />;
  const data = remote.data;
  if (!data?.available) return null;
  return (
    <section className="panel job-cad" aria-labelledby="job-cad-title">
      <div className="between">
        <h2 id="job-cad-title">
          {t('Комплект CAD', 'CAD package')}
          {data.version ? ` · v${data.version}` : ''}
        </h2>
        <button
          className="icon-button"
          aria-label={t('Обновить доступ к CAD', 'Refresh CAD access')}
          onClick={remote.reload}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {!data.access ? (
        <p className="info-box">
          <LockKeyhole size={16} />{' '}
          {t(
            'Файлы доступны по разрешению заказчика. Откройте обсуждение ниже и запросите CAD для расчёта. Выбранный исполнитель получает доступ автоматически.',
            'Files require the customer’s permission. Start a discussion below and request CAD for a quotation. The selected provider receives access automatically.',
          )}
        </p>
      ) : (
        <>
          <p className="muted small">
            {t(
              'Точная версия для обсуждения и расчёта. Перед изготовлением согласуйте материал, допуски, нагрузки и подготовку оборудования.',
              'This exact version is for discussion and quotation. Agree on materials, tolerances, loads and machine setup before manufacturing.',
            )}
          </p>
          {data.build?.report && (
            <>
              <p className={'info-box' + (data.build.report.passed ? '' : ' warn')}>
                {data.build.report.passed
                  ? t('Проверки геометрии пройдены.', 'Geometry checks passed.')
                  : t(
                      'Есть замечания к геометрии — изучите отчёт.',
                      'Geometry checks found issues — review the report.',
                    )}
              </p>
              <Suspense fallback={<Loading />}>
                <CadPreview url={`/api/jobs/${jobId}/cad/artifacts/mesh.json`} />
              </Suspense>
            </>
          )}
          <div className="row wrap" style={{ marginTop: 16 }}>
            {(data.build?.artifacts ?? [])
              .filter((file) =>
                ['model.step', 'model.stl', 'parts.zip', 'bom.csv', 'report.json'].includes(
                  file.name,
                ),
              )
              .map((file) => (
                <a
                  key={file.name}
                  href={`/api/jobs/${jobId}/cad/artifacts/${encodeURIComponent(file.name)}`}
                  className="button secondary small"
                  download
                >
                  <Download size={14} /> {file.name}
                </a>
              ))}
            <a className="text-button" href={`/api/jobs/${jobId}/cad/packet`} download>
              {t('Подтверждённое ТЗ и манифест', 'Confirmed brief and manifest')}
            </a>
          </div>
          <details style={{ marginTop: 18 }}>
            <summary>
              {t('Все файлы и контроль целостности', 'All files and integrity checks')}
            </summary>
            <ul className="cad-file-list">
              {data.build?.artifacts.map((file) => (
                <li key={file.name}>
                  <a
                    href={`/api/jobs/${jobId}/cad/artifacts/${encodeURIComponent(file.name)}`}
                    download
                  >
                    {file.name}
                  </a>
                  <span className="micro muted">
                    {Math.ceil(file.size / 1024)} KB · SHA-256 {file.sha256}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {owner && data.access && (
        <div style={{ marginTop: 24 }}>
          <h3>{t('Кому открыт расчёт по CAD', 'Who can quote using CAD')}</h3>
          <p className="small muted">
            {t(
              'Прямой адресат получает доступ сразу. Для публичного задания откройте файлы участникам обсуждения. Отзыв доступа прекращает новые скачивания; уже скачанные копии остаются у получателя.',
              'A direct recipient receives access immediately. For a public brief, share files with participants in its discussion. Revoking access stops new downloads; downloaded copies remain with the recipient.',
            )}
          </p>
          {!data.participants?.length && (
            <p className="small">
              {t(
                'Участники появятся после первого вопроса или предложения.',
                'Participants appear after their first question or offer.',
              )}
            </p>
          )}
          {data.participants?.map((person) => (
            <div className="between" style={{ gap: 12, marginTop: 12 }} key={person.provider_id}>
              <span>{person.name}</span>
              <button
                className="button secondary small"
                disabled={!!busy}
                onClick={() => void access(person.provider_id, !person.allowed)}
              >
                {person.allowed
                  ? t('Закрыть доступ', 'Revoke access')
                  : t('Открыть CAD для расчёта', 'Share CAD for quotation')}
              </button>
            </div>
          ))}
          <ErrorBox error={error} />
        </div>
      )}
    </section>
  );
}
