'use client';

import Link from 'next/link';
import { Map, Users, Trees, Sun, Moon, LogOut, UserCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authService } from '@/core/api/auth.service';
import { UserProfileResponse } from '@/types';

const links = [
  { href: '/cemeteries', label: 'Кладбища', icon: Map },
  { href: '/burials', label: 'Захоронения', icon: Users },
  { href: '/profile', label: 'Профиль', icon: UserCircle },
];

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    authService
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  async function handleLogout() {
    await authService.logout();
    setUser(null);
    window.location.href = '/';
  }

  const visibleLinks = user ? links : links.filter((item) => item.href !== '/profile');

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--line)]/80 bg-[color:var(--bg)]/75 backdrop-blur-md">
      <div className="flex h-16 w-full items-center px-4 sm:px-6">
        <Link href="/" className="group flex flex-shrink-0 items-center gap-3">
          <div className="rounded-xl bg-[color:var(--accent)]/15 p-2 text-[color:var(--accent)] transition group-hover:bg-[color:var(--accent)]/20">
            <Trees className="h-5 w-5" />
          </div>
          <div>
            <p className="display-font text-2xl leading-none text-[color:var(--ink)]">DCS</p>
            <p className="-mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">публичный веб</p>
          </div>
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-1 px-6 lg:flex">
          {visibleLinks.map((item) => (
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
            {visibleLinks.map((item) => (
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
            <>
              <Link
                href="/profile"
                className="hidden rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)] sm:inline-flex"
              >
                {user.username}
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </>
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
