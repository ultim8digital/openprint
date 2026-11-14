import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { useApp, post, ErrorBox, errorText } from './core';

export default function Auth({ recovery = false }: { recovery?: boolean }) {
  const { t, user, refresh, toast, operatorContact } = useApp(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [token, setToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('token') || '',
  );
  const next = params.get('next') || '/workspace',
    safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/workspace';
  useEffect(() => {
    if (recovery && location.hash)
      history.replaceState(null, '', location.pathname + location.search);
  }, [recovery]);
  useEffect(() => {
    if (user && !recovery) navigate(safeNext, { replace: true });
  }, [user, recovery, navigate, safeNext]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (recovery) {
        await post('/auth/recover', { token, password: String(form.get('password')) });
        toast(
          t('Пароль обновлён. Вы вошли в аккаунт.', 'Password updated. You are now signed in.'),
        );
      } else
        await post(register ? '/auth/register' : '/auth/login', {
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        });
      await refresh();
      navigate(safeNext, { replace: true });
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <div className="auth-wrap">
        <span className="eyebrow">
          <ShieldCheck size={14} />
          {t('ВАШЕ МЕСТО В СООБЩЕСТВЕ', 'YOUR PLACE IN THE COMMUNITY')}
        </span>
        <h1 style={{ marginTop: 16 }}>
          {recovery
            ? t('Вернёмся к вашим идеям.', 'Back to your ideas.')
            : register
              ? t('Давайте создавать вместе.', 'Let’s make things together.')
              : t('С возвращением.', 'Welcome back.')}
        </h1>
        <p>
          {recovery
            ? t(
                'Владелец сообщества может выдать одноразовую ссылку после проверки вашего обращения. Письма автоматически не отправляются.',
                'The community operator can issue a one-use link after verifying your request. Recovery emails are not sent automatically.',
              )
            : t(
                'Один аккаунт — для собственных проектов, работы мастерской и помощи другим.',
                'One account for your ideas, your workshop, and helping others.',
              )}
        </p>
        <div className="panel">
          {recovery && operatorContact && (
            <a
              className="button secondary full"
              style={{ marginBottom: 20 }}
              href={operatorContact}
            >
              {t('Связаться с владельцем сообщества', 'Contact the community operator')} ↗
            </a>
          )}
          {!recovery && (
            <div className="auth-tabs">
              <button
                className={!register ? 'active' : ''}
                onClick={() => {
                  setRegister(false);
                  setError('');
                }}
              >
                {t('Войти', 'Sign in')}
              </button>
              <button
                className={register ? 'active' : ''}
                onClick={() => {
                  setRegister(true);
                  setError('');
                }}
              >
                {t('Регистрация', 'Create account')}
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            {recovery ? (
              <label>
                {t('Одноразовый код из ссылки', 'One-use code from your link')}
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  minLength={64}
                  maxLength={64}
                />
              </label>
            ) : (
              <>
                {register && (
                  <label>
                    {t('Как вас зовут?', 'Your name')}
                    <input name="name" autoComplete="name" required minLength={2} maxLength={80} />
                  </label>
                )}
                <label>
                  {t('Электронная почта', 'Email')}
                  <input name="email" type="email" autoComplete="email" required maxLength={254} />
                </label>
              </>
            )}
            <label>
              {recovery ? t('Новый пароль', 'New password') : t('Пароль', 'Password')}
              <input
                aria-label={recovery ? t('Новый пароль', 'New password') : t('Пароль', 'Password')}
                name="password"
                type="password"
                autoComplete={register || recovery ? 'new-password' : 'current-password'}
                minLength={register || recovery ? 12 : 1}
                maxLength={128}
                required
              />
              {(register || recovery) && (
                <small>
                  {t(
                    'Не менее 12 символов. Лучше — несколько случайных слов.',
                    'At least 12 characters. A few random words work well.',
                  )}
                </small>
              )}
            </label>
            <ErrorBox error={error} />
            <button className="button full" disabled={busy}>
              {busy
                ? t('Минуточку…', 'One moment…')
                : recovery
                  ? t('Обновить пароль', 'Update password')
                  : register
                    ? t('Присоединиться', 'Join the community')
                    : t('Войти в аккаунт', 'Sign in')}
              <ArrowRight size={16} />
            </button>
            {!register && !recovery && (
              <Link className="text-button" to="/recover">
                <KeyRound size={13} />
                {t('Не получается войти?', 'Can’t sign in?')}
              </Link>
            )}
          </form>
        </div>
        <p className="auth-foot">
          {t(
            'При регистрации вы принимаете правила этого сообщества. Используйте свои модели и уважайте работу других участников.',
            'By registering, you agree to this community’s rules. Share work you have rights to, and respect other makers.',
          )}
          <br />
          <Link to="/about">{t('Правила и работа с данными', 'Community rules & privacy')} ↗</Link>
        </p>
      </div>
    </div>
  );
}
