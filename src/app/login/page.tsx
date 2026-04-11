export { default } from '@/components/features/auth/LoginPageContent';
/*
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { authService } from '@/core/api/auth.service';

export default function LoginPage() {
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      await authService.login({ emailOrUsername, password });
      router.push('/profile');
      router.refresh();
    } catch (submissionError) {
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
            Используйте e-mail или имя пользователя. После входа откроется профиль с настройками аккаунта и
            подготовкой к будущему workflow заявок.
          </p>
        </section>

        <section className="surface-muted rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--ink)]">E-mail или username</span>
              <input
                value={emailOrUsername}
                onChange={(event) => setEmailOrUsername(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="user@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--ink)]">Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Введите пароль"
                required
              />
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
*/
