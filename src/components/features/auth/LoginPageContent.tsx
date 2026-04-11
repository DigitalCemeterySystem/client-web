'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiClientError, authService } from '@/core/api/auth.service';

type LoginFieldErrors = {
  emailOrUsername?: string;
  password?: string;
};

function validateLoginForm(emailOrUsername: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};

  if (!emailOrUsername.trim()) {
    errors.emailOrUsername = 'Введите e-mail или username.';
  }

  if (!password) {
    errors.password = 'Введите пароль.';
  }

  return errors;
}

export default function LoginPageContent() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  const clientFieldErrors = useMemo(
    () => validateLoginForm(emailOrUsername, password),
    [emailOrUsername, password]
  );

  useEffect(() => {
    let active = true;

    authService
      .getMe()
      .then(() => {
        if (active) {
          window.location.replace('/profile');
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  function getFieldError(field: keyof LoginFieldErrors) {
    if (fieldErrors[field]) {
      return fieldErrors[field];
    }

    if (!submitted) {
      return '';
    }

    return clientFieldErrors[field] ?? '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setPending(true);
    setError('');

    const validationErrors = validateLoginForm(emailOrUsername, password);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setPending(false);
      return;
    }

    try {
      await authService.login({ emailOrUsername, password });
      window.location.assign('/profile');
    } catch (submissionError) {
      const apiError = submissionError instanceof ApiClientError ? submissionError : undefined;
      setFieldErrors((apiError?.fieldErrors as LoginFieldErrors | undefined) ?? {});
      setError(submissionError instanceof Error ? submissionError.message : 'Не удалось выполнить вход.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="surface-card rounded-3xl p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Авторизация</p>
          <h1 className="display-font mt-4 text-4xl text-[color:var(--ink)] sm:text-5xl">Вход в систему</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[color:var(--ink-muted)] sm:text-base">
            Используйте e-mail или имя пользователя. После входа откроется профиль 
            со всей личной информацией.
          </p>
        </section>

        <section className="surface-muted rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--ink)]">E-mail или username</span>
              <input
                value={emailOrUsername}
                onChange={(event) => {
                  setEmailOrUsername(event.target.value);
                  setFieldErrors((current) => ({ ...current, emailOrUsername: undefined }));
                }}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="user@example.com"
                required
              />
              {getFieldError('emailOrUsername') && (
                <p className="mt-2 text-sm text-[#9e3024]">{getFieldError('emailOrUsername')}</p>
              )}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--ink)]">Пароль</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 pr-14 outline-none transition focus:border-[color:var(--accent)]"
                  placeholder="Введите пароль"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[color:var(--ink-muted)] transition hover:text-[color:var(--ink)]"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {getFieldError('password') && <p className="mt-2 text-sm text-[#9e3024]">{getFieldError('password')}</p>}
            </label>

            {error && <p className="rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}

            <button disabled={pending} className="pill-action w-full px-5 py-3 text-sm font-semibold disabled:opacity-70">
              {pending ? 'Выполняем вход...' : 'Войти'}
            </button>
          </form>

          <p className="mt-5 text-sm text-[color:var(--ink-muted)]">
            Нет аккаунта?{' '}
            <Link href="/register" className="font-semibold text-[color:var(--accent-strong)]">
              Зарегистрироваться
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
