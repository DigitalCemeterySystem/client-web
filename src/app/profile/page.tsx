'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { authService } from '@/core/api/auth.service';
import { UserProfileResponse } from '@/types';

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [profileForm, setProfileForm] = useState({ username: '', avatarUrl: '', bio: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService
      .getMe()
      .then((profile) => {
        setUser(profile);
        setProfileForm({
          username: profile.username,
          avatarUrl: profile.avatarUrl || '',
          bio: profile.bio || '',
        });
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить профиль.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setProfileMessage('');

    try {
      const updated = await authService.updateMe(profileForm);
      setUser(updated);
      setProfileMessage('Профиль обновлён.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить профиль.');
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPasswordMessage('');

    try {
      const response = await authService.changePassword(passwordForm);
      setPasswordMessage(response.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сменить пароль.');
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-10 text-[color:var(--ink-muted)]">
        Загружаем профиль...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="surface-card w-full rounded-3xl p-8 sm:p-10">
          <h1 className="display-font text-4xl text-[color:var(--ink)] sm:text-5xl">Профиль недоступен</h1>
          <p className="mt-4 text-base text-[color:var(--ink-muted)]">{error || 'Сначала выполните вход в систему.'}</p>
          <div className="mt-6 flex gap-3">
            <Link href="/login" className="pill-action px-5 py-2.5 text-sm font-semibold">
              Войти
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
            >
              Регистрация
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="surface-card rounded-3xl p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Профиль</p>
          <h1 className="display-font mt-4 text-4xl text-[color:var(--ink)]">{user.username}</h1>
          <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-muted)]">
            Роль: <span className="font-semibold text-[color:var(--ink)]">{user.role}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">
            Статус: <span className="font-semibold text-[color:var(--ink)]">{user.status}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">{user.email}</p>
        </aside>

        <section className="space-y-6">
          <form onSubmit={handleProfileSubmit} className="surface-muted rounded-3xl p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-[color:var(--ink)]">Данные профиля</h2>
            <div className="mt-4 space-y-4">
              <input
                value={profileForm.username}
                onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Имя пользователя"
              />
              <input
                value={profileForm.avatarUrl}
                onChange={(event) => setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Ссылка на аватар"
              />
              <textarea
                value={profileForm.bio}
                onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                className="min-h-32 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Краткое описание профиля"
              />
            </div>

            {profileMessage && <p className="mt-4 rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{profileMessage}</p>}
            {error && <p className="mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}

            <button className="pill-action mt-5 px-5 py-2.5 text-sm font-semibold">Сохранить профиль</button>
          </form>

          <form onSubmit={handlePasswordSubmit} className="surface-muted rounded-3xl p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-[color:var(--ink)]">Смена пароля</h2>
            <div className="mt-4 space-y-4">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Текущий пароль"
              />
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Новый пароль"
              />
              <input
                type="password"
                value={passwordForm.confirmNewPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmNewPassword: event.target.value }))}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Повторите новый пароль"
              />
            </div>

            {passwordMessage && <p className="mt-4 rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{passwordMessage}</p>}

            <button className="pill-action mt-5 px-5 py-2.5 text-sm font-semibold">Обновить пароль</button>
          </form>
        </section>
      </div>
    </div>
  );
}
