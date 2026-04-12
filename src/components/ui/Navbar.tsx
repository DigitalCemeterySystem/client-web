'use client';

import Link from 'next/link';
import { Map, Users, Trees, Sun, Moon, ChevronDown, UserRound, FileText, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authService, AUTH_CHANGED_EVENT } from '@/core/api/auth.service';
import { getRolePresentation } from '@/core/auth/role-presentation';
import { UserProfileResponse } from '@/types';
import UserAvatar from '@/components/ui/UserAvatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const links = [
  { href: '/cemeteries', label: 'Кладбища', icon: Map },
  { href: '/burials', label: 'Захоронения', icon: Users },
];

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
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

  const rolePresentation = user ? getRolePresentation(user.role) : null;

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--line)]/80 bg-[color:var(--bg)]/75 backdrop-blur-md">
        <div className="flex h-16 w-full items-center px-4 sm:px-6">
          <Link href="/" className="group flex flex-shrink-0 items-center gap-3">
            <div className="rounded-xl bg-[color:var(--accent)]/15 p-2 text-[color:var(--accent)] transition group-hover:bg-[color:var(--accent)]/20">
              <Trees className="h-5 w-5" />
            </div>
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
          </div>

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
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
