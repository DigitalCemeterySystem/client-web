'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Map, Users, Sun, Moon, ChevronDown, UserRound, FileText, LogOut, CirclePlus, MapPinned, Landmark, ShieldCheck, FileSearch, Sparkles, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authService, AUTH_CHANGED_EVENT } from '@/core/api/auth.service';
import { getRolePresentation } from '@/core/auth/role-presentation';
import { UserProfileResponse } from '@/types';
import UserAvatar from '@/components/ui/UserAvatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AuthRequiredModal from '@/components/ui/AuthRequiredModal';

const links = [
  { href: '/cemeteries', label: 'Кладбища', icon: Map },
  { href: '/burials', label: 'Захоронения', icon: Users },
];

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [authRequiredOpen, setAuthRequiredOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadCurrentUser = useCallback(async () => {
    try {
      const profile = await authService.getMe();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const syncAuthState = () => {
      loadCurrentUser();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    };
  }, [loadCurrentUser]);

  useEffect(() => {
    setMenuOpen(false);
    setAddDialogOpen(false);
    setAuthRequiredOpen(false);
    loadCurrentUser();
  }, [pathname, loadCurrentUser]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  async function handleLogoutConfirm() {
    setLogoutPending(true);
    try {
      await authService.logout();
      setUser(null);
      setMenuOpen(false);
      setShowLogoutDialog(false);
      window.location.assign('/');
    } finally {
      setLogoutPending(false);
    }
  }

  function openLogoutDialogFromMenu() {
    setMenuOpen(false);
    setShowLogoutDialog(true);
  }

  function getBioText(profile: UserProfileResponse) {
    const bio = profile.bio?.trim();
    return bio || 'Описание профиля пока не заполнено.';
  }

  function openAddFlow() {
    if (!authReady) return;
    if (!user) {
      setAuthRequiredOpen(true);
      return;
    }
    setAddDialogOpen(true);
  }

  function navigateToAddPath(path: string) {
    setAddDialogOpen(false);
    router.push(path);
  }

  const rolePresentation = user ? getRolePresentation(user.role) : null;
  const canModerate = user?.role === 'MODERATOR' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--line)]/80 bg-[color:var(--bg)]/75 backdrop-blur-md">
        <div className="flex h-16 w-full items-center px-4 sm:px-6">
          <Link href="/" className="group flex flex-shrink-0 items-center gap-3">
            <Image
              src="/dcs-logo.svg"
              alt="Логотип DCS"
              width={40}
              height={40}
              className="h-10 w-10 flex-shrink-0 object-contain transition-transform group-hover:scale-[1.03]"
              priority
            />
            <div>
              <p className="display-font text-2xl leading-none text-[color:var(--ink)]">DCS</p>
              <p className="-mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">цифровые кладбища</p>
            </div>
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-1 px-6 lg:flex">
            {links.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={<item.icon className="h-4 w-4" />}
                text={item.label}
                active={pathname === item.href}
              />
            ))}
            <button
              type="button"
              onClick={openAddFlow}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-[color:var(--ink-muted)] transition hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--ink)]"
              aria-label="Добавить"
            >
              <CirclePlus className="h-4 w-4" />
              <span>Добавить</span>
            </button>
          </div>

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openAddFlow}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-muted)] transition hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--ink)] sm:hidden"
              aria-label="Добавить"
            >
              <CirclePlus className="h-4 w-4" />
              <span>Добавить</span>
            </button>

            <div className="hidden items-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-1 py-1 sm:flex lg:hidden">
              {links.map((item) => (
                <NavLink
                  key={`mobile-${item.href}`}
                  href={item.href}
                  icon={<item.icon className="h-4 w-4" />}
                  text={item.label}
                  active={pathname === item.href}
                  compact
                />
              ))}
              <button
                type="button"
                onClick={openAddFlow}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-[color:var(--ink-muted)] transition hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--ink)] sm:text-sm"
                aria-label="Добавить"
              >
                <CirclePlus className="h-4 w-4" />
                <span>Добавить</span>
              </button>
            </div>

            {mounted && (
              <button
                aria-label="Переключить тему"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-2 text-[color:var(--ink-muted)] transition hover:text-[color:var(--ink)]"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}

            {authReady && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-2.5 py-1.5 text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                >
                  <UserAvatar
                    avatarUrl={user.avatarUrl}
                    username={user.username}
                    size="sm"
                    cropStorageKey={`dcs-avatar-crop-${user.id}`}
                  />
                  <span className="max-w-32 truncate text-sm font-semibold sm:max-w-40">{user.username}</span>
                  <ChevronDown className={`h-4 w-4 text-[color:var(--ink-muted)] transition ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                  <div className="surface-card absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(90vw,280px)] rounded-2xl p-2 shadow-xl">
                    <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          avatarUrl={user.avatarUrl}
                          username={user.username}
                          size="lg"
                          cropStorageKey={`dcs-avatar-crop-${user.id}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">{user.username}</p>
                          <p className="truncate text-xs text-[color:var(--ink-muted)]">{user.email}</p>
                          {rolePresentation && (
                            <p
                              className={[
                                'mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                rolePresentation.className,
                              ].join(' ')}
                            >
                              <rolePresentation.Icon className="h-3.5 w-3.5" />
                              {rolePresentation.label}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-[color:var(--ink-muted)]">{getBioText(user)}</p>
                    </section>

                    <section className="mt-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-2">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        <UserRound className="h-4 w-4 text-[color:var(--ink-muted)]" />
                        Профиль
                      </Link>
                      <Link
                        href="/profile/requests"
                        className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        <FileText className="h-4 w-4 text-[color:var(--ink-muted)]" />
                        Мои заявки
                      </Link>
                      {canModerate && (
                        <Link
                          href="/profile/requests/users"
                          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                          onClick={() => setMenuOpen(false)}
                        >
                          <ShieldCheck className="h-4 w-4 text-[color:var(--ink-muted)]" />
                          Заявки пользователей
                        </Link>
                      )}
                      {isAdmin && (
                        <>
                          <Link
                            href="/profile/search"
                            className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                            onClick={() => setMenuOpen(false)}
                          >
                            <FileSearch className="h-4 w-4 text-[color:var(--ink-muted)]" />
                            Поиск информации
                          </Link>
                          <Link
                            href="/profile/biographies"
                            className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                            onClick={() => setMenuOpen(false)}
                          >
                            <Sparkles className="h-4 w-4 text-[color:var(--ink-muted)]" />
                            Генерация биографий
                          </Link>
                        </>
                      )}
                    </section>

                    <section className="mt-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-2">
                      <button
                        type="button"
                        onClick={openLogoutDialogFromMenu}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#9e3024] transition hover:bg-[#d04f3f]/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Выйти из аккаунта
                      </button>
                    </section>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/register"
                  className="hidden rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)] sm:inline-flex"
                >
                  Регистрация
                </Link>
                <Link href="/login" className="pill-action px-4 py-2 text-sm font-semibold">
                  Войти
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <ConfirmDialog
        open={showLogoutDialog}
        title="Выйти из аккаунта?"
        description="Вы уверены, что хотите завершить текущую сессию?"
        confirmLabel="Да, выйти"
        pending={logoutPending}
        onCancel={() => setShowLogoutDialog(false)}
        onConfirm={handleLogoutConfirm}
      />

      {addDialogOpen && (
        <div className="fixed inset-0 z-[94] flex items-center justify-center px-4">
          <button
            type="button"
            onClick={() => setAddDialogOpen(false)}
            className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
            aria-label="Закрыть окно выбора"
          />
          <section className="surface-card relative z-[95] w-full max-w-xl rounded-3xl p-6 sm:p-7">
            <button
              type="button"
              onClick={() => setAddDialogOpen(false)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)] transition hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--ink)]"
              aria-label="Закрыть окно"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Что добавить</p>
            <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">Новая заявка</h3>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigateToAddPath('/add/burial')}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-4 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
              >
                <MapPinned className="h-4 w-4 text-[color:var(--accent)]" />
                Захоронение
              </button>
              <button
                type="button"
                onClick={() => navigateToAddPath('/add/cemetery')}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-4 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
              >
                <Landmark className="h-4 w-4 text-[color:var(--accent)]" />
                Кладбище
              </button>
            </div>
          </section>
        </div>
      )}

      <AuthRequiredModal
        open={authRequiredOpen}
        onClose={() => setAuthRequiredOpen(false)}
        title="Нужна авторизация"
        description="Сначала авторизуйтесь, чтобы отправлять заявки на изменение данных."
      />
    </>
  );
}

function NavLink({
  href,
  icon,
  text,
  active,
  compact,
}: {
  href: string;
  icon: React.ReactNode;
  text: string;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition',
        compact ? 'text-xs sm:text-sm' : '',
        active
          ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
          : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--ink)]',
      ].join(' ')}
    >
      {icon}
      <span>{text}</span>
    </Link>
  );
}
