export { default } from '@/components/features/auth/RegisterPageContent';
/*
'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { authService } from '@/core/api/auth.service';

const RESEND_COOLDOWN_SECONDS = 30;

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [resendPending, setResendPending] = useState(false);
  const [pending, setPending] = useState(false);
  const canResend = error.includes('Пользователь с таким e-mail уже существует');

  const verificationPanelVisible = Boolean(message && verificationEmail && !canResend) || Boolean(message && verificationEmail);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [cooldownSeconds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    setResendMessage('');

    try {
      const response = await authService.register(form);
      setMessage(response.message);
      setVerificationEmail(form.email.trim());
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Не удалось зарегистрироваться.');
    } finally {
      setPending(false);
    }
  }

  async function handleResendVerification() {
    setResendPending(true);
    setError('');
    setResendMessage('');

    try {
      const response = await authService.resendVerification(verificationEmail);
      setResendMessage(response.message);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось отправить письмо повторно.');
    } finally {
      setResendPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="surface-card rounded-3xl p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Регистрация</p>
          <h1 className="display-font mt-4 text-4xl text-[color:var(--ink)] sm:text-5xl">Создание аккаунта</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[color:var(--ink-muted)] sm:text-base">
            После отправки формы пользователь создаётся в системе, но вход станет доступен только после подтверждения
            e-mail по ссылке из письма.
          </p>
        </section>

        <section className="surface-muted rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              placeholder="E-mail"
              type="email"
              required
            />
            <input
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              placeholder="Имя пользователя"
              required
            />
            <input
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              placeholder="Пароль"
              type="password"
              required
            />
            <input
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
              placeholder="Повторите пароль"
              type="password"
              required
            />

            {message && <p className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{message}</p>}
            {error && <p className="rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}

            {verificationPanelVisible && (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
                <p className="text-sm text-[color:var(--ink-muted)]">
                  Письмо отправлено на {verificationEmail}. Повторная отправка будет доступна каждые 30 секунд, пока e-mail не подтверждён.
                </p>
                {cooldownSeconds > 0 ? (
                  <p className="mt-3 rounded-2xl bg-[color:var(--bg-elevated)] px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
                    Отправить письмо ещё раз можно через {cooldownSeconds} сек.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendPending || !verificationEmail}
                    className="mt-3 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg)] disabled:opacity-60"
                  >
                    {resendPending ? 'Отправляем...' : 'Отправить письмо ещё раз'}
                  </button>
                )}
                {resendMessage && (
                  <p className="mt-3 rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
                    {resendMessage}
                  </p>
                )}
              </div>
            )}

            <button disabled={pending} className="pill-action w-full px-5 py-3 text-sm font-semibold disabled:opacity-70">
              {pending ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
            </button>
          </form>

          <p className="mt-5 text-sm text-[color:var(--ink-muted)]">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-semibold text-[color:var(--accent-strong)]">
              Войти
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
*/
