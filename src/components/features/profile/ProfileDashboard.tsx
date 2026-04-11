'use client';

import Link from 'next/link';
import {
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Info,
  KeyRound,
  LogOut,
  Pencil,
  PencilLine,
  Trash2,
  UserRound,
} from 'lucide-react';
import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientError, authService, AUTH_CHANGED_EVENT } from '@/core/api/auth.service';
import { getRolePresentation } from '@/core/auth/role-presentation';
import { normalizeExternalImageUrl, resolveImageSource } from '@/core/utils/image-source';
import { UserProfileResponse } from '@/types';
import UserAvatar from '@/components/ui/UserAvatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

type ProfileSection = 'profile' | 'requests';

type AvatarCrop = {
  x: number;
  y: number;
  zoom: number;
};
type PasswordFieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
};

const AVATAR_EDITOR_DIAMETER = 220;
const DEFAULT_AVATAR_CROP: AvatarCrop = {
  x: 0,
  y: 0,
  zoom: 1,
};
const CROP_OFFSET_LIMIT = 1.5;

const statusLabels: Record<UserProfileResponse['status'], string> = {
  ACTIVE: 'Активен',
  DISABLED: 'Отключен',
  PENDING_VERIFICATION: 'Ожидает подтверждения e-mail',
};

function getBioText(user: UserProfileResponse) {
  const bio = user.bio?.trim();
  return bio || 'Пользователь пока не добавил описание профиля.';
}

function getAvatarCropKey(userId: number) {
  return `dcs-avatar-crop-${userId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeCrop(raw: AvatarCrop): AvatarCrop {
  return {
    x: clamp(raw.x, -CROP_OFFSET_LIMIT, CROP_OFFSET_LIMIT),
    y: clamp(raw.y, -CROP_OFFSET_LIMIT, CROP_OFFSET_LIMIT),
    zoom: clamp(raw.zoom, 1, 3),
  };
}

function parseStoredCrop(raw: string | null): AvatarCrop {
  if (!raw) return DEFAULT_AVATAR_CROP;
  try {
    const maybeCrop = JSON.parse(raw) as AvatarCrop;
    const x = Number.isFinite(maybeCrop.x) ? maybeCrop.x : 0;
    const y = Number.isFinite(maybeCrop.y) ? maybeCrop.y : 0;
    const zoom = Number.isFinite(maybeCrop.zoom) ? maybeCrop.zoom : 1;

    const isLegacyPixelCrop = Math.abs(x) > 2 || Math.abs(y) > 2;
    if (isLegacyPixelCrop) {
      return sanitizeCrop({
        x: x / AVATAR_EDITOR_DIAMETER,
        y: y / AVATAR_EDITOR_DIAMETER,
        zoom,
      });
    }

    return sanitizeCrop({ x, y, zoom });
  } catch {
    return DEFAULT_AVATAR_CROP;
  }
}

function PasswordInputField({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <div>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={[
            'w-full rounded-2xl border bg-[color:var(--bg-panel)] px-4 py-3 pr-14 outline-none transition',
            error ? 'border-[#d04f3f]' : 'border-[color:var(--line)] focus:border-[color:var(--accent)]',
          ].join(' ')}
          placeholder={placeholder}
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
      {error && <p className="mt-2 text-sm text-[#9e3024]">{error}</p>}
    </div>
  );
}

function validatePasswordForm(form: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};

  if (!form.currentPassword.trim()) {
    errors.currentPassword = 'Введите текущий пароль.';
  } else if (form.currentPassword.length < 8) {
    errors.currentPassword = 'Текущий пароль должен быть не короче 8 символов.';
  }

  if (!form.newPassword.trim()) {
    errors.newPassword = 'Введите новый пароль.';
  } else if (form.newPassword.length < 8) {
    errors.newPassword = 'Новый пароль должен быть не короче 8 символов.';
  }

  if (!form.confirmNewPassword.trim()) {
    errors.confirmNewPassword = 'Повторите новый пароль.';
  } else if (form.confirmNewPassword.length < 8) {
    errors.confirmNewPassword = 'Подтверждение должно быть не короче 8 символов.';
  } else if (form.newPassword && form.newPassword !== form.confirmNewPassword) {
    errors.confirmNewPassword = 'Новые пароли не совпадают.';
  }

  return errors;
}

export default function ProfileDashboard({ section }: { section: ProfileSection }) {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [profileForm, setProfileForm] = useState({ username: '', avatarUrl: '', bio: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [pageError, setPageError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<PasswordFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarDraftUrl, setAvatarDraftUrl] = useState('');
  const [avatarCrop, setAvatarCrop] = useState<AvatarCrop>(DEFAULT_AVATAR_CROP);
  const [avatarDraftCrop, setAvatarDraftCrop] = useState<AvatarCrop>(DEFAULT_AVATAR_CROP);
  const [avatarDraftError, setAvatarDraftError] = useState('');
  const [avatarPreviewSrc, setAvatarPreviewSrc] = useState('');

  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const pageTitle = section === 'profile' ? 'Профиль' : 'Мои заявки';
  const avatarPreviewSource = useMemo(() => resolveImageSource(avatarDraftUrl), [avatarDraftUrl]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setPageError('');

      try {
        const profile = await authService.getMe();
        if (!active) {
          return;
        }

        const rawCrop = window.localStorage.getItem(getAvatarCropKey(profile.id));
        const parsedCrop = parseStoredCrop(rawCrop);

        setUser(profile);
        setAvatarCrop(parsedCrop);
        setProfileForm({
          username: profile.username,
          avatarUrl: profile.avatarUrl || '',
          bio: profile.bio || '',
        });
      } catch (requestError) {
        if (!active) {
          return;
        }
        setUser(null);
        setPageError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить профиль.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    const onAuthChanged = () => {
      loadProfile();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (event: globalThis.MouseEvent) => {
      if (!dragStateRef.current?.dragging) {
        return;
      }

      const dx = event.clientX - dragStateRef.current.startX;
      const dy = event.clientY - dragStateRef.current.startY;
      setAvatarDraftCrop((current) =>
        sanitizeCrop({
          ...current,
          x: dragStateRef.current!.originX + dx / AVATAR_EDITOR_DIAMETER,
          y: dragStateRef.current!.originY + dy / AVATAR_EDITOR_DIAMETER,
        })
      );
    };

    const onMouseUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current.dragging = false;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    setAvatarPreviewSrc(avatarPreviewSource?.src ?? '');
  }, [avatarPreviewSource?.src, avatarPreviewSource?.fallbackSrc]);

  useEffect(() => {
    if (!profileMessage) return undefined;
    const timeout = window.setTimeout(() => setProfileMessage(''), 3800);
    return () => window.clearTimeout(timeout);
  }, [profileMessage]);

  useEffect(() => {
    if (!passwordMessage) return undefined;
    const timeout = window.setTimeout(() => setPasswordMessage(''), 3800);
    return () => window.clearTimeout(timeout);
  }, [passwordMessage]);

  useEffect(() => {
    if (!profileError) return undefined;
    const timeout = window.setTimeout(() => setProfileError(''), 3800);
    return () => window.clearTimeout(timeout);
  }, [profileError]);

  useEffect(() => {
    if (!passwordError) return undefined;
    const timeout = window.setTimeout(() => setPasswordError(''), 3800);
    return () => window.clearTimeout(timeout);
  }, [passwordError]);

  useEffect(() => {
    if (!avatarDraftError) return undefined;
    const timeout = window.setTimeout(() => setAvatarDraftError(''), 3800);
    return () => window.clearTimeout(timeout);
  }, [avatarDraftError]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');

    if (!user) {
      setProfileError('Профиль недоступен.');
      return;
    }

    const normalizedUsername = profileForm.username.trim();
    const normalizedBio = profileForm.bio.trim();
    const normalizedAvatarUrl = normalizeExternalImageUrl(profileForm.avatarUrl);
    const currentUsername = user.username.trim();
    const currentBio = (user.bio ?? '').trim();
    const currentAvatar = normalizeExternalImageUrl(user.avatarUrl ?? '');

    const hasChanges =
      normalizedUsername !== currentUsername ||
      normalizedBio !== currentBio ||
      normalizedAvatarUrl !== currentAvatar;

    if (!hasChanges) {
      setProfileError('Нет новых изменений для сохранения.');
      return;
    }

    try {
      const updated = await authService.updateMe({
        username: normalizedUsername,
        bio: normalizedBio,
        avatarUrl: normalizedAvatarUrl,
      });
      setUser(updated);
      setProfileForm({
        username: updated.username,
        avatarUrl: updated.avatarUrl || '',
        bio: updated.bio || '',
      });
      if (updated.id) {
        window.localStorage.setItem(getAvatarCropKey(updated.id), JSON.stringify(avatarCrop));
        window.dispatchEvent(new CustomEvent('dcs-avatar-crop-changed', { detail: { key: getAvatarCropKey(updated.id) } }));
      }
      setProfileMessage('Профиль обновлен.');
      setAvatarMenuOpen(false);
    } catch (requestError) {
      setProfileError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить профиль.');
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError('');
    setPasswordFieldErrors({});
    setPasswordMessage('');

    const validationErrors = validatePasswordForm(passwordForm);
    if (Object.keys(validationErrors).length > 0) {
      setPasswordFieldErrors(validationErrors);
      return;
    }

    try {
      const response = await authService.changePassword(passwordForm);
      setPasswordMessage(response.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setPasswordFieldErrors({});
    } catch (requestError) {
      const apiError = requestError instanceof ApiClientError ? requestError : undefined;
      const fieldErrors = (apiError?.fieldErrors as PasswordFieldErrors | undefined) ?? {};
      const hasFieldErrors = Object.keys(fieldErrors).length > 0;

      if (hasFieldErrors) {
        setPasswordFieldErrors(fieldErrors);
        setPasswordError('Проверьте заполнение полей.');
        return;
      }

      setPasswordError(requestError instanceof Error ? requestError.message : 'Не удалось сменить пароль.');
    }
  }

  async function handleLogoutConfirm() {
    setLogoutPending(true);
    try {
      await authService.logout();
      setShowLogoutDialog(false);
      window.location.assign('/');
    } finally {
      setLogoutPending(false);
    }
  }

  function openAvatarEditor() {
    setAvatarMenuOpen(false);
    setAvatarDraftError('');
    setAvatarDraftUrl(profileForm.avatarUrl);
    setAvatarDraftCrop(sanitizeCrop(avatarCrop));
    setAvatarEditorOpen(true);
  }

  function removeAvatar() {
    setAvatarMenuOpen(false);
    setProfileForm((current) => ({ ...current, avatarUrl: '' }));
    setAvatarCrop(DEFAULT_AVATAR_CROP);
    if (user?.id) {
      window.localStorage.removeItem(getAvatarCropKey(user.id));
      window.dispatchEvent(new CustomEvent('dcs-avatar-crop-changed', { detail: { key: getAvatarCropKey(user.id) } }));
    }
  }

  function applyAvatarDraft() {
    const normalized = normalizeExternalImageUrl(avatarDraftUrl);
    if (!normalized) {
      setAvatarDraftError('Введите ссылку на изображение.');
      return;
    }

    setAvatarDraftError('');
    setProfileForm((current) => ({ ...current, avatarUrl: normalized }));
    const nextCrop = sanitizeCrop(avatarDraftCrop);
    setAvatarCrop(nextCrop);
    if (user?.id) {
      window.localStorage.setItem(getAvatarCropKey(user.id), JSON.stringify(nextCrop));
      window.dispatchEvent(new CustomEvent('dcs-avatar-crop-changed', { detail: { key: getAvatarCropKey(user.id) } }));
    }
    setAvatarEditorOpen(false);
  }

  function handlePreviewMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    dragStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: avatarDraftCrop.x,
      originY: avatarDraftCrop.y,
    };
  }

  const overview = useMemo(() => {
    if (!user) {
      return null;
    }

    return [
      { label: 'Роль', value: getRolePresentation(user.role).label },
      { label: 'Статус', value: statusLabels[user.status] },
      { label: 'E-mail', value: user.email },
      { label: 'Дата регистрации', value: new Date(user.createdAt).toLocaleDateString('ru-RU') },
    ];
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10 text-[color:var(--ink-muted)]">
        Загружаем профиль...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="surface-card w-full rounded-3xl p-8 sm:p-10">
          <h1 className="display-font text-4xl text-[color:var(--ink)] sm:text-5xl">Профиль недоступен</h1>
          <p className="mt-4 text-base text-[color:var(--ink-muted)]">{pageError || 'Сначала выполните вход в систему.'}</p>
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

  const rolePresentation = getRolePresentation(user.role);

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="surface-card rounded-3xl p-6">
              <div className="flex min-w-0 items-start gap-4">
                <UserAvatar avatarUrl={profileForm.avatarUrl} username={user.username} size="xl" crop={avatarCrop} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-[color:var(--ink)]">{user.username}</p>
                  <p className="truncate text-sm text-[color:var(--ink-muted)]">{user.email}</p>
                  <p
                    className={[
                      'mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                      rolePresentation.className,
                    ].join(' ')}
                  >
                    <rolePresentation.Icon className="h-3.5 w-3.5" />
                    {rolePresentation.label}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-muted)]">{getBioText(user)}</p>
            </section>

            <section className="surface-card rounded-3xl p-3">
              <Link
                href="/profile"
                className={[
                  'flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  section === 'profile'
                    ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                    : 'text-[color:var(--ink)] hover:bg-[color:var(--bg-elevated)]',
                ].join(' ')}
              >
                <UserRound className="h-4 w-4" />
                Профиль
              </Link>
              <Link
                href="/profile/requests"
                className={[
                  'mt-2 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  section === 'requests'
                    ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                    : 'text-[color:var(--ink)] hover:bg-[color:var(--bg-elevated)]',
                ].join(' ')}
              >
                <FileText className="h-4 w-4" />
                Мои заявки
              </Link>
            </section>

            <section className="surface-card rounded-3xl p-3">
              <button
                type="button"
                onClick={() => setShowLogoutDialog(true)}
                className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-[#9e3024] transition hover:bg-[#d04f3f]/10"
              >
                <LogOut className="h-4 w-4" />
                Выйти из аккаунта
              </button>
            </section>
          </aside>

          <section className="space-y-6">
            <section className="surface-card rounded-3xl p-6 sm:p-8">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Личный кабинет</p>
              <h1 className="display-font mt-3 text-4xl text-[color:var(--ink)] sm:text-5xl">{pageTitle}</h1>
            </section>

            {section === 'profile' ? (
              <>
                <section className="surface-muted rounded-3xl p-6 sm:p-8">
                  <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[color:var(--ink)]">
                    <Info className="h-5 w-5 text-[color:var(--accent-strong)]" />
                    Информация о пользователе
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {overview?.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">{item.label}</p>
                        <p className="mt-1 text-sm font-medium text-[color:var(--ink)]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <form onSubmit={handleProfileSubmit} className="surface-muted rounded-3xl p-6 sm:p-8">
                  <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[color:var(--ink)]">
                    <PencilLine className="h-5 w-5 text-[color:var(--accent-strong)]" />
                    Редактирование профиля
                  </h2>

                  <div className="mt-4 grid items-start gap-6 lg:grid-cols-[1fr_auto]">
                    <div className="space-y-4">
                      <input
                        value={profileForm.username}
                        onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                        className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                        placeholder="Имя пользователя"
                      />
                      <textarea
                        value={profileForm.bio}
                        onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                        className="min-h-56 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none transition focus:border-[color:var(--accent)]"
                        placeholder="Краткое описание профиля"
                      />
                    </div>

                    <div className="relative mx-auto flex w-fit flex-col items-center self-start">
                      <UserAvatar avatarUrl={profileForm.avatarUrl} username={user.username} size="2xl" crop={avatarCrop} />
                      <div className="relative mt-4">
                        <button
                          type="button"
                          onClick={() => setAvatarMenuOpen((current) => !current)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)]/90 px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                        >
                          <Pencil className="h-4 w-4" />
                          Редактировать фото
                        </button>

                        {avatarMenuOpen && (
                          <div className="surface-card absolute left-0 top-[calc(100%+0.45rem)] z-20 w-52 rounded-2xl p-2 shadow-lg">
                            <button
                              type="button"
                              onClick={openAvatarEditor}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                            >
                              <ImagePlus className="h-4 w-4" />
                              Загрузить новое
                            </button>
                            <button
                              type="button"
                              onClick={removeAvatar}
                              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#9e3024] transition hover:bg-[#d04f3f]/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Удалить фото
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {profileMessage && (
                    <p className="notice-fadeout mt-4 rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
                      {profileMessage}
                    </p>
                  )}
                  {profileError && <p className="notice-fadeout mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{profileError}</p>}

                  <button className="pill-action mt-5 px-5 py-2.5 text-sm font-semibold">Сохранить профиль</button>
                </form>

                <form onSubmit={handlePasswordSubmit} className="surface-muted rounded-3xl p-6 sm:p-8">
                  <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[color:var(--ink)]">
                    <KeyRound className="h-5 w-5 text-[color:var(--accent-strong)]" />
                    Смена пароля
                  </h2>
                  <div className="mt-4 space-y-4">
                    <PasswordInputField
                      value={passwordForm.currentPassword}
                      onChange={(value) => {
                        setPasswordForm((current) => ({ ...current, currentPassword: value }));
                        setPasswordError('');
                        setPasswordFieldErrors((current) => ({ ...current, currentPassword: undefined }));
                      }}
                      placeholder="Текущий пароль"
                      visible={showCurrentPassword}
                      onToggle={() => setShowCurrentPassword((current) => !current)}
                      error={passwordFieldErrors.currentPassword}
                    />
                    <PasswordInputField
                      value={passwordForm.newPassword}
                      onChange={(value) => {
                        setPasswordForm((current) => ({ ...current, newPassword: value }));
                        setPasswordError('');
                        setPasswordFieldErrors((current) => ({ ...current, newPassword: undefined }));
                      }}
                      placeholder="Новый пароль"
                      visible={showNewPassword}
                      onToggle={() => setShowNewPassword((current) => !current)}
                      error={passwordFieldErrors.newPassword}
                    />
                    <PasswordInputField
                      value={passwordForm.confirmNewPassword}
                      onChange={(value) => {
                        setPasswordForm((current) => ({ ...current, confirmNewPassword: value }));
                        setPasswordError('');
                        setPasswordFieldErrors((current) => ({ ...current, confirmNewPassword: undefined }));
                      }}
                      placeholder="Повторите новый пароль"
                      visible={showConfirmPassword}
                      onToggle={() => setShowConfirmPassword((current) => !current)}
                      error={passwordFieldErrors.confirmNewPassword}
                    />
                  </div>

                  {passwordMessage && (
                    <p className="notice-fadeout mt-4 rounded-2xl bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
                      {passwordMessage}
                    </p>
                  )}
                  {passwordError && <p className="notice-fadeout mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{passwordError}</p>}

                  <button className="pill-action mt-5 px-5 py-2.5 text-sm font-semibold">Обновить пароль</button>
                </form>
              </>
            ) : (
              <section className="surface-muted rounded-3xl p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-[color:var(--ink)]">Мои заявки</h2>
                <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-muted)]">
                  Раздел заявок будет подключен на следующем этапе. Здесь появятся ваши заявки на добавление и редактирование данных.
                </p>
              </section>
            )}
          </section>
        </div>
      </div>

      {avatarEditorOpen && (
        <div className="fixed inset-0 z-[82] flex items-center justify-center px-4">
          <button
            aria-label="Закрыть окно редактирования аватара"
            className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setAvatarEditorOpen(false)}
          />
          <section className="surface-card relative z-[83] w-full max-w-xl rounded-3xl p-6 sm:p-7">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">Новое изображение профиля</h3>
            <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
              Вставьте ссылку на изображение, затем перетяните картинку в круге и настройте масштаб.
            </p>

            <input
              value={avatarDraftUrl}
              onChange={(event) => {
                setAvatarDraftUrl(event.target.value);
                setAvatarDraftError('');
              }}
              className="mt-4 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              placeholder="https://..."
            />

            <div className="mt-4 grid gap-6 sm:grid-cols-[240px_1fr]">
              <div
                className="relative h-[220px] w-[220px] cursor-grab overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] active:cursor-grabbing"
                onMouseDown={handlePreviewMouseDown}
              >
                {avatarPreviewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreviewSrc}
                    alt="Предпросмотр аватара"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    style={{
                      transform: `translate(${avatarDraftCrop.x * 100}%, ${avatarDraftCrop.y * 100}%) scale(${avatarDraftCrop.zoom})`,
                      transformOrigin: 'center center',
                    }}
                    onError={() => {
                      if (avatarPreviewSource?.fallbackSrc && avatarPreviewSrc !== avatarPreviewSource.fallbackSrc) {
                        setAvatarPreviewSrc(avatarPreviewSource.fallbackSrc);
                        return;
                      }
                      setAvatarPreviewSrc('');
                    }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/images/avatar-placeholder.svg"
                    alt="Заглушка аватара"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-[color:var(--ink)]">Масштаб</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={avatarDraftCrop.zoom}
                  onChange={(event) =>
                    setAvatarDraftCrop((current) =>
                      sanitizeCrop({
                        ...current,
                        zoom: Number(event.target.value),
                      })
                    )
                  }
                  className="w-full"
                />
                <p className="text-xs text-[color:var(--ink-muted)]">
                  Тяните изображение мышью внутри круга, чтобы выбрать нужные границы отображения.
                </p>
              </div>
            </div>

            {avatarDraftError && <p className="notice-fadeout mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{avatarDraftError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAvatarEditorOpen(false)}
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={applyAvatarDraft}
                className="pill-action px-5 py-2.5 text-sm font-semibold"
              >
                Применить
              </button>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={showLogoutDialog}
        title="Выйти из аккаунта?"
        description="Вы уверены, что хотите завершить текущую сессию?"
        confirmLabel="Да, выйти"
        pending={logoutPending}
        onCancel={() => setShowLogoutDialog(false)}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
}
