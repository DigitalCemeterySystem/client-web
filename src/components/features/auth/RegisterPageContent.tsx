'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiClientError, authService } from '@/core/api/auth.service';
import type { RegisterRequest } from '@/types';

const COOLDOWN_SECONDS = 30;

type RegisterField = keyof RegisterRequest;
type RegisterFieldErrors = Partial<Record<RegisterField, string>>;

function normalizeRegisterForm(form: RegisterRequest): RegisterRequest {
  return {
    email: form.email.trim(),
    username: form.username.trim(),
    password: form.password,
    confirmPassword: form.confirmPassword,
  };
}

function areRegisterFormsEqual(left: RegisterRequest | null, right: RegisterRequest): boolean {
  if (!left) {
    return false;
  }

  const normalizedRight = normalizeRegisterForm(right);
  return (
    left.email === normalizedRight.email &&
    left.username === normalizedRight.username &&
    left.password === normalizedRight.password &&
    left.confirmPassword === normalizedRight.confirmPassword
  );
}

function validateRegisterForm(form: RegisterRequest): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const email = form.email.trim();
  const username = form.username.trim();

  if (!email) {
    errors.email = 'Введите e-mail.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Введите корректный e-mail.';
  }

  if (!username) {
    errors.username = 'Введите имя пользователя.';
  } else if (username.length < 3) {
    errors.username = 'Имя пользователя должно содержать минимум 3 символа.';
  } else if (username.length > 64) {
    errors.username = 'Имя пользователя должно содержать не более 64 символов.';
  }

  if (!form.password) {
    errors.password = 'Введите пароль.';
  } else if (form.password.length < 8) {
    errors.password = 'Пароль должен содержать минимум 8 символов.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Повторите пароль.';
  } else if (form.confirmPassword.length < 8) {
    errors.confirmPassword = 'Подтверждение пароля должно содержать минимум 8 символов.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Пароли не совпадают.';
  }

  return errors;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 pr-14 outline-none transition focus:border-[color:var(--accent)]"
        placeholder={placeholder}
        type={visible ? 'text' : 'password'}
        required
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[color:var(--ink-muted)] transition hover:text-[color:var(--ink)]"
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function RegisterPageContent() {
  const [form, setForm] = useState<RegisterRequest>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [verificationEmail, setVerificationEmail] = useState('');
  const [lastRegisteredForm, setLastRegisteredForm] = useState<RegisterRequest | null>(null);
  const [resendMessage, setResendMessage] = useState('');
  const [registerCooldownSeconds, setRegisterCooldownSeconds] = useState(0);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const clientFieldErrors = useMemo(() => validateRegisterForm(form), [form]);
  const formChangedSinceLastSuccessfulRegistration = Boolean(
    lastRegisteredForm && !areRegisterFormsEqual(lastRegisteredForm, form)
  );
  const verificationPanelVisible = Boolean(message && verificationEmail && !formChangedSinceLastSuccessfulRegistration);
  const resendActionCooldownSeconds = resendCooldownSeconds;

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

  useEffect(() => {
    if (registerCooldownSeconds <= 0 && resendCooldownSeconds <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRegisterCooldownSeconds((current) => Math.max(current - 1, 0));
      setResendCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [registerCooldownSeconds, resendCooldownSeconds]);

  function updateField<K extends RegisterField>(field: K, value: RegisterRequest[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function syncValidationErrors(apiError?: ApiClientError) {
    if (!apiError?.fieldErrors) {
      setFieldErrors({});
      return;
    }

    setFieldErrors(apiError.fieldErrors as RegisterFieldErrors);
  }

  function startCooldowns() {
    setRegisterCooldownSeconds(COOLDOWN_SECONDS);
    setResendCooldownSeconds(COOLDOWN_SECONDS);
  }

  async function submitRegistration(source: 'register' | 'resend') {
    setSubmitted(true);
    setError('');
    setResendMessage('');

    const validationErrors = validateRegisterForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return false;
    }

    if (source === 'register') {
      setPending(true);
    } else {
      setResendPending(true);
    }

    try {
      const response = await authService.register(form);
      const normalizedForm = normalizeRegisterForm(form);

      setFieldErrors({});
      setMessage(response.message);
      setVerificationEmail(normalizedForm.email);
      setLastRegisteredForm(normalizedForm);
      startCooldowns();

      if (source === 'resend') {
        setResendMessage('Отправили новое письмо с текущими данными формы.');
      }

      return true;
    } catch (submissionError) {
      const apiError = submissionError instanceof ApiClientError ? submissionError : undefined;
      syncValidationErrors(apiError);
      setMessage('');
      setVerificationEmail('');
      setLastRegisteredForm(null);
      setResendMessage('');
      setError(submissionError instanceof Error ? submissionError.message : 'Не удалось зарегистрироваться.');

      if (apiError?.status === 429) {
        setRegisterCooldownSeconds(COOLDOWN_SECONDS);
      }

      return false;
    } finally {
      if (source === 'register') {
        setPending(false);
      } else {
        setResendPending(false);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (registerCooldownSeconds > 0) {
      setError(`Зарегистрироваться снова можно через ${registerCooldownSeconds} сек.`);
      return;
    }

    await submitRegistration('register');
  }

  async function handleResendVerification() {
    setError('');
    setResendMessage('');

    if (resendCooldownSeconds > 0) {
      setError(`Отправить письмо ещё раз можно через ${resendCooldownSeconds} сек.`);
      return;
    }

    setResendPending(true);

    try {
      const response = await authService.resendVerification(verificationEmail);
      setResendMessage(response.message);
      setResendCooldownSeconds(COOLDOWN_SECONDS);
    } catch (requestError) {
      const apiError = requestError instanceof ApiClientError ? requestError : undefined;
      setError(requestError instanceof Error ? requestError.message : 'Не удалось отправить письмо повторно.');

      if (apiError?.status === 429) {
        setResendCooldownSeconds(COOLDOWN_SECONDS);
      }
    } finally {
      setResendPending(false);
    }
  }

  function getFieldError(field: RegisterField) {
    if (fieldErrors[field]) {
      return fieldErrors[field];
    }

    if (!submitted) {
      return '';
    }

    return clientFieldErrors[field] ?? '';
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="surface-card rounded-3xl p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Регистрация</p>
          <h1 className="display-font mt-4 text-4xl text-[color:var(--ink)] sm:text-5xl">Создание аккаунта</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[color:var(--ink-muted)] sm:text-base">
            После отправки формы пользователь создаётся в системе, но вход станет доступен только после подтверждения e-mail
            по ссылке из письма.
          </p>
        </section>

        <section className="surface-muted rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="E-mail"
                type="email"
                required
              />
              {getFieldError('email') && <p className="mt-2 text-sm text-[#9e3024]">{getFieldError('email')}</p>}
            </div>

            <div>
              <input
                value={form.username}
                onChange={(event) => updateField('username', event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Имя пользователя"
                required
              />
              {getFieldError('username') && <p className="mt-2 text-sm text-[#9e3024]">{getFieldError('username')}</p>}
            </div>

            <div>
              <PasswordInput
                value={form.password}
                onChange={(value) => updateField('password', value)}
                placeholder="Пароль"
                visible={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />
              {getFieldError('password') && <p className="mt-2 text-sm text-[#9e3024]">{getFieldError('password')}</p>}
            </div>

            <div>
              <PasswordInput
                value={form.confirmPassword}
                onChange={(value) => updateField('confirmPassword', value)}
                placeholder="Повторите пароль"
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((current) => !current)}
              />
              {getFieldError('confirmPassword') && (
                <p className="mt-2 text-sm text-[#9e3024]">{getFieldError('confirmPassword')}</p>
              )}
            </div>

            {message && <p className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{message}</p>}
            {error && <p className="rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}

            {verificationPanelVisible && (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
                <p className="text-sm text-[color:var(--ink-muted)]">
                  Письмо отправлено на {verificationEmail}. Пока e-mail не подтверждён, можно отправить письмо ещё раз.
                  Если изменить данные в форме, этот блок скроется и появится снова только после нового нажатия
                  «Зарегистрироваться».
                </p>

                {resendActionCooldownSeconds > 0 ? (
                  <p className="mt-3 rounded-2xl bg-[color:var(--bg-elevated)] px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
                    {`Отправить письмо ещё раз можно через ${resendActionCooldownSeconds} сек.`}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendPending}
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

            <button
              disabled={pending || registerCooldownSeconds > 0}
              className="pill-action w-full px-5 py-3 text-sm font-semibold disabled:opacity-70"
            >
              {pending
                ? 'Создаём аккаунт...'
                : registerCooldownSeconds > 0
                  ? `Зарегистрироваться снова можно через ${registerCooldownSeconds} сек.`
                  : 'Зарегистрироваться'}
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
