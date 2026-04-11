'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authService } from '@/core/api/auth.service';

export default function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Проверяем ссылку подтверждения...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Ссылка подтверждения некорректна: токен не найден.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((response) => {
        setStatus('success');
        setMessage(response.message);
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Не удалось подтвердить e-mail.');
      });
  }, [token]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="surface-card w-full rounded-3xl p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Подтверждение e-mail</p>
        <h1 className="display-font mt-4 text-4xl text-[color:var(--ink)] sm:text-5xl">
          {status === 'loading' ? 'Подождите пару секунд' : status === 'success' ? 'Почта подтверждена' : 'Не удалось подтвердить почту'}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[color:var(--ink-muted)]">{message}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="pill-action px-5 py-2.5 text-sm font-semibold">
            Перейти ко входу
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
          >
            Создать новый аккаунт
          </Link>
        </div>
      </section>
    </div>
  );
}
