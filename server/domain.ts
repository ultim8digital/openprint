import { randomUUID } from 'node:crypto';
import type { Store } from './database.js';
import { ensure, event, notify } from './security.js';
import { offerInput } from '../shared/validation.js';
import type { Job, Profile, User, Offer, AcceptedTerms } from '../shared/types.js';

export type ProfileRow = Omit<
  Profile,
  'technologies' | 'materials' | 'verified' | 'remote' | 'demo'
> & {
  technologies: string;
  materials: string;
  verified: number;
  remote: number;
  demo: number;
  published: number;
};
export type JobRow = Omit<Job, 'accepted_terms' | 'demo' | 'moderated' | 'has_file'> & {
  accepted_terms: string | null;
  demo: number;
  moderated: number;
};
export const jobSelect = `SELECT j.*, (SELECT count(*) FROM offers f WHERE f.job_id=j.id AND f.status IN ('active','accepted')) AS offers_count FROM jobs j`;
export const offerSelect =
  'SELECT f.*,p.name AS profile_name FROM offers f JOIN profiles p ON p.id=f.profile_id';
export function profileObject(row: ProfileRow): Profile {
  const { published: _, ...rest } = row;
  return {
    ...rest,
    technologies: JSON.parse(row.technologies),
    materials: JSON.parse(row.materials),
    verified: !!row.verified,
    remote: !!row.remote,
    demo: !!row.demo,
  };
}
export function jobObject(row: JobRow, participant = false): Job {
  return {
    ...row,
    demo: !!row.demo,
    moderated: !!row.moderated,
    has_file: !!row.file_id,
    file_id: participant ? row.file_id : null,
    accepted_offer_id: participant ? row.accepted_offer_id : null,
    accepted_terms: participant && row.accepted_terms ? JSON.parse(row.accepted_terms) : null,
  };
}
export function ownProfile(store: Store, userId: string) {
  return store.get<ProfileRow>('SELECT * FROM profiles WHERE user_id=?', userId);
}
export function blocked(store: Store, a: string, b: string) {
  return !!store.get(
    'SELECT 1 FROM blocks WHERE (owner_id=? AND blocked_id=?) OR (owner_id=? AND blocked_id=?)',
    a,
    b,
    b,
    a,
  );
}
export function visibleJob(store: Store, id: string, user: User | null): JobRow {
  const row = store.get<JobRow>(`${jobSelect} WHERE j.id=?`, id);
  const target = row?.target_profile_id
    ? store.get<{ user_id: string }>(
        'SELECT user_id FROM profiles WHERE id=?',
        row.target_profile_id,
      )
    : null;
  ensure(
    row &&
      ((!row.moderated && row.visibility === 'public') ||
        row.owner_id === user?.id ||
        (!!user && target?.user_id === user.id) ||
        assignedTo(store, row, user?.id) ||
        user?.role === 'admin'),
    404,
    'NOT_FOUND',
    'Project not found / Проект не найден',
  );
  return row;
}
export function assignedTo(store: Store, job: JobRow, userId: string | undefined) {
  return !!(
    userId &&
    job.accepted_offer_id &&
    store.get('SELECT 1 FROM offers WHERE id=? AND provider_id=?', job.accepted_offer_id, userId)
  );
}
export function assertDaily(store: Store, user: string, action: string, max: number) {
  const count =
    store.get<{ n: number }>(
      'SELECT count(*) AS n FROM events WHERE actor_id=? AND action=? AND created_at>?',
      user,
      action,
      Date.now() - 86400000,
    )?.n ?? 0;
  ensure(count < max, 429, 'DAILY_LIMIT', 'Daily limit reached / Достигнут суточный лимит');
}
export function sendOffer(store: Store, user: User, jobId: string, input: unknown) {
  const body = offerInput.parse(input);
  return store.transaction(() => {
    const job = visibleJob(store, jobId, user);
    const profile = ownProfile(store, user.id);
    ensure(
      profile?.published,
      403,
      'PROFILE_REQUIRED',
      'Create your workshop or engineer profile / Создайте профиль мастерской или инженера',
    );
    ensure(
      job.owner_id !== user.id,
      403,
      'OWN_JOB',
      'You cannot bid on your own project / Нельзя откликнуться на свой проект',
    );
    ensure(
      !blocked(store, user.id, job.owner_id),
      403,
      'BLOCKED',
      'Contact blocked / Общение заблокировано',
    );
    ensure(
      job.status === 'open' && !job.moderated,
      409,
      'JOB_CLOSED',
      'This project is no longer open / Приём предложений завершён',
    );
    ensure(
      job.kind !== 'design' || profile.kind !== 'studio',
      403,
      'ENGINEER_REQUIRED',
      'This project needs an engineer / Для проекта нужен профиль инженера',
    );
    ensure(
      job.kind !== 'print' || profile.kind !== 'engineer',
      403,
      'STUDIO_REQUIRED',
      'This project needs a workshop / Для проекта нужен профиль мастерской',
    );
    assertDaily(store, user.id, 'offer.created', 60);
    let conversation = store.get<{ id: string }>(
      'SELECT id FROM conversations WHERE job_id=? AND provider_id=?',
      jobId,
      user.id,
    );
    if (!conversation) {
      conversation = { id: randomUUID() };
      store.run(
        'INSERT INTO conversations(id,job_id,provider_id) VALUES(?,?,?)',
        conversation.id,
        jobId,
        user.id,
      );
    }
    const revision =
      (store.get<{ n: number }>(
        'SELECT max(revision) AS n FROM offers WHERE job_id=? AND provider_id=?',
        jobId,
        user.id,
      )?.n ?? 0) + 1;
    store.run(
      "UPDATE offers SET status='superseded' WHERE job_id=? AND provider_id=? AND status='active'",
      jobId,
      user.id,
    );
    const id = randomUUID();
    store.run(
      "INSERT INTO offers(id,job_id,provider_id,profile_id,conversation_id,revision,price,days,note,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'active',?)",
      id,
      jobId,
      user.id,
      profile.id,
      conversation.id,
      revision,
      body.price,
      body.days,
      body.note,
      Date.now(),
    );
    notify(store, job.owner_id, `offer.created|${job.title}`, `/projects/${jobId}`);
    event(store, user.id, 'offer.created', id);
    return store.get<Offer>(`${offerSelect} WHERE f.id=?`, id)!;
  });
}
export function acceptOffer(
  store: Store,
  user: User,
  jobId: string,
  offerId: string,
  revision: number,
  version: number,
) {
  return store.transaction(() => {
    const job = visibleJob(store, jobId, user);
    ensure(
      job.owner_id === user.id,
      403,
      'FORBIDDEN',
      'Only the customer can choose / Выбрать исполнителя может заказчик',
    );
    ensure(
      job.status === 'open' && !job.moderated && job.version === version,
      409,
      'JOB_CHANGED',
      'The project changed. Refresh it / Проект изменился. Обновите страницу',
    );
    const offer = store.get<Offer>(`${offerSelect} WHERE f.id=? AND f.job_id=?`, offerId, jobId);
    ensure(
      offer?.status === 'active' && offer.revision === revision,
      409,
      'OFFER_STALE',
      'This offer has changed or was withdrawn. Review the latest revision / Предложение изменилось или отозвано. Посмотрите новую версию',
    );
    const provider = store.get<{ suspended: number }>(
      'SELECT suspended FROM users WHERE id=?',
      offer.provider_id,
    );
    const profile = store.get<{ published: number }>(
      'SELECT published FROM profiles WHERE id=?',
      offer.profile_id,
    );
    ensure(
      provider &&
        !provider.suspended &&
        profile?.published &&
        !blocked(store, user.id, offer.provider_id),
      409,
      'PROVIDER_UNAVAILABLE',
      'This provider is unavailable / Исполнитель недоступен',
    );
    const terms: AcceptedTerms = {
      offer_id: offer.id,
      revision: offer.revision,
      profile_id: offer.profile_id,
      profile_name: offer.profile_name,
      price: offer.price,
      currency: job.currency,
      days: offer.days,
      note: offer.note,
      accepted_at: Date.now(),
    };
    store.run("UPDATE offers SET status='accepted' WHERE id=?", offer.id);
    store.run("UPDATE offers SET status='declined' WHERE job_id=? AND status='active'", job.id);
    store.run(
      "UPDATE jobs SET status='assigned',accepted_offer_id=?,accepted_terms=?,version=version+1 WHERE id=?",
      offer.id,
      JSON.stringify(terms),
      job.id,
    );
    const others = store.all<{ provider_id: string }>(
      'SELECT DISTINCT provider_id FROM offers WHERE job_id=?',
      job.id,
    );
    for (const other of others)
      notify(
        store,
        other.provider_id,
        `${other.provider_id === offer.provider_id ? 'offer.accepted' : 'offer.closed'}|${job.title}`,
        `/projects/${job.id}`,
      );
    event(store, user.id, 'offer.accepted', offer.id, JSON.stringify(terms));
    return terms;
  });
}
export type ConversationRow = {
  id: string;
  job_id: string;
  provider_id: string;
  owner_id: string;
  title: string;
  owner_read: number;
  provider_read: number;
  status: string;
};
export function conversationAccess(store: Store, id: string, user: User) {
  const row = store.get<ConversationRow>(
    'SELECT c.*,j.owner_id,j.title,j.status FROM conversations c JOIN jobs j ON j.id=c.job_id WHERE c.id=?',
    id,
  );
  ensure(
    row && (row.owner_id === user.id || row.provider_id === user.id),
    404,
    'NOT_FOUND',
    'Conversation not found / Переписка не найдена',
  );
  return row;
}
