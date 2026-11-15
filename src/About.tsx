import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers3, Store, ShieldCheck, Users, Code2, Download } from 'lucide-react';
import { useApp } from './core';
import { PageTitle } from './Browse';
export default function About() {
  const { t, operatorContact } = useApp();
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow={t('ОТКРЫТО ПО ЗАМЫСЛУ', 'OPEN BY DESIGN')}
        title={t('Делать вместе — проще.', 'Making is better together.')}
        description={t(
          'OpenPrint соединяет тех, у кого есть идея, с теми, кто умеет придать ей форму. Открытое сообщество без обязательных подписок на платформы.',
          'OpenPrint connects people with ideas to people who know how to make them real. An open community with no required cloud subscription.',
        )}
      />
      <div className="about-layout">
        {[
          {
            icon: Users,
            title: t('Заказчику', 'For customers'),
            body: t(
              'Опишите задачу, сравните предложения и поговорите с исполнителем. Согласованные условия сохраняются, а завершение подтверждаете вы.',
              'Share a brief, compare offers, and talk to a maker. Your agreement is recorded, and you confirm the final result.',
            ),
            to: '/projects/new',
            link: t('Начать проект', 'Start a project'),
          },
          {
            icon: Store,
            title: t('Мастерской и инженеру', 'For workshops & engineers'),
            body: t(
              'Ведите свою страницу, находите подходящие проекты и отвечайте без посредника. До оценки можно задать вопрос. Вы определяете цену и состав работы.',
              'Maintain your own profile, discover projects, and respond directly. Ask questions before quoting. You define your price and scope.',
            ),
            to: '/workspace?tab=profile',
            link: t('Создать профиль', 'Create a maker profile'),
          },
          {
            icon: Layers3,
            title: t('Автору модели', 'For model creators'),
            body: t(
              'Делитесь своей работой с указанием автора и лицензии. Публикация проходит проверку модератором. Параметрические детали можно создавать без аккаунта.',
              'Share original work with attribution and a license. Publications are reviewed by a moderator. Anyone can use the part builder without an account.',
            ),
            to: '/models',
            link: t('Открыть библиотеку', 'Explore the library'),
          },
          {
            icon: ShieldCheck,
            title: t('Организатору сообщества', 'For community organizers'),
            body: t(
              'Запустите свой экземпляр для клуба, города или мастерской. Вы управляете данными и модерацией. Начните с небольшого сообщества, которому доверяете.',
              'Run an instance for your club, city, or makerspace. You control the data and moderation. Start with a small community you trust.',
            ),
            to: 'https://github.com/ultim8digital/openprint',
            link: t('Инструкция на GitHub', 'Get started on GitHub'),
          },
        ].map((c) => (
          <section className="panel" key={c.title}>
            <span className="start-icon">
              <c.icon size={21} />
            </span>
            <h2>{c.title}</h2>
            <p>{c.body}</p>
            {c.to.startsWith('http') ? (
              <a
                className="text-button"
                style={{ marginTop: 17 }}
                href={c.to}
                target="_blank"
                rel="noreferrer"
              >
                {c.link}
                <ArrowUpRight className="directional-icon" size={14} />
              </a>
            ) : (
              <Link className="text-button" style={{ marginTop: 17 }} to={c.to}>
                {c.link}
                <ArrowUpRight className="directional-icon" size={14} />
              </Link>
            )}
          </section>
        ))}
      </div>
      <section className="panel legal-prose" style={{ marginTop: 23 }}>
        <h2 style={{ marginTop: 0 }}>
          {t('Простые правила хорошей мастерской', 'A few rules for a good workshop')}
        </h2>
        <ul>
          <li>
            {t(
              'Публикуйте свои работы или материалы, на которые есть разрешение. Уважайте лицензии и авторство.',
              'Share original work or content you have permission to distribute. Respect licenses and attribution.',
            )}
          </li>
          <li>
            {t(
              'Уточните материал, допуски, стоимость доставки и результат до принятия предложения.',
              'Agree on materials, tolerances, shipping costs, and deliverables before accepting an offer.',
            )}
          </li>
          <li>
            {t(
              'Не публикуйте личные контакты, документы и конфиденциальные чертежи в открытом описании.',
              'Keep personal contacts, documents, and confidential drawings out of public briefs.',
            )}
          </li>
          <li>
            {t(
              'Для ответственных изделий проверяйте конструкцию с квалифицированным специалистом. Просмотр 3D не является экспертизой.',
              'Have safety-critical parts reviewed by a qualified professional. A 3D preview is not engineering certification.',
            )}
          </li>
          <li>
            {t(
              'Спорные материалы можно отправить модератору кнопкой жалобы. Нежелательное общение можно заблокировать в переписке.',
              'Use report buttons for inappropriate content. Block unwanted contact in the conversation.',
            )}
          </li>
        </ul>
        <h2>{t('Что происходит с вашими данными', 'What happens to your data')}</h2>
        <p>
          {t(
            'Аккаунт, проекты, файлы и сообщения хранятся на сервере владельца этого сообщества. Это не сквозное шифрование: оператор имеет технический доступ к данным. При выборе сообщества учитывайте доверие к его владельцу.',
            'Your account, projects, files, and messages are stored on this community operator’s server. This is not end-to-end encryption: the operator has technical access to stored data. Choose an instance whose operator you trust.',
          )}
        </p>
        <p style={{ marginTop: 13 }}>
          {t(
            'Файл проекта доступен вам и выбранному исполнителю. Модель в открытой библиотеке после публикации доступна всем. Карта обращается к OpenStreetMap только по вашему запросу; остальные основные сценарии не требуют сторонних API. Рекламных трекеров и внешних шрифтов нет.',
            'Project attachments are accessible to you and your selected provider. Published library models are available to everyone. The map contacts OpenStreetMap only when you open it; other core workflows do not require third-party APIs. There are no advertising trackers or external fonts.',
          )}
        </p>
        <p style={{ marginTop: 13 }}>
          {t(
            'В кабинете можно экспортировать свои данные, поменять пароль, закрыть сеансы и запросить удаление аккаунта с подтверждением паролем. Активные сделки сначала нужно завершить. Принятые условия и минимальная история остаются у сторон; копии в резервных архивах удаляет владелец сервера по своей политике.',
            'Your workspace lets you export your data, change your password, sign out, and remove your account with password confirmation. Finish active agreements first. Accepted terms and minimal deal history remain with the parties; the operator manages retention in backups.',
          )}
        </p>
        <h2>{t('Что OpenPrint берёт на себя', 'What OpenPrint provides')}</h2>
        <p>
          {t(
            'Площадка помогает находить друг друга и сохранять договорённости. Оплата, доставка, качество изготовления и разрешение коммерческих споров остаются ответственностью участников. Платёжной системы, эскроу и автоматической проверки моделей здесь нет.',
            'OpenPrint helps people find each other and record agreements. Participants handle payment, shipping, manufacturing quality, and commercial disputes directly. This version does not include payments, escrow, or automatic model certification.',
          )}
        </p>
        <h2>{t('Запустить своё сообщество', 'Run your own community')}</h2>
        <p>
          {t(
            'Открытый код по MIT. Локально достаточно Node.js 24; для собственного сервера есть Docker Compose. База и файлы находятся в одной папке данных. В репозитории есть инструкции запуска, создания модератора, резервного копирования и восстановления.',
            'The code is MIT-licensed. Run locally with Node.js 24, or use Docker Compose on your server. The database and uploads live in one data directory. The repository includes setup, administrator, backup, and restore instructions.',
          )}
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          {operatorContact && (
            <a className="button secondary" href={operatorContact}>
              {t('Связаться с владельцем', 'Contact the operator')} ↗
            </a>
          )}
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href="https://github.com/ultim8digital/openprint"
          >
            <Code2 size={15} /> GitHub <ArrowUpRight className="directional-icon" size={15} />
          </a>
          <Link className="text-button" to="/tools">
            {t('Попробовать конструктор', 'Try the part builder')}
            <ArrowUpRight className="directional-icon" size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
