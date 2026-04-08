'use client';

import Link from 'next/link';
import { Map, Users, Search, Trees, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [
  { href: '/cemeteries', label: 'Кладбища', icon: Map },
  { href: '/burials', label: 'Захоронения', icon: Users },
  { href: '/search', label: 'Поиск', icon: Search },
];

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--line)]/80 bg-[color:var(--bg)]/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <div className="rounded-xl bg-[color:var(--accent)]/15 p-2 text-[color:var(--accent)] transition group-hover:bg-[color:var(--accent)]/20">
            <Trees className="h-5 w-5" />
          </div>
          <div>
            <p className="display-font text-2xl leading-none text-[color:var(--ink)]">DCS</p>
            <p className="-mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">публичный веб</p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
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

        <div className="flex items-center gap-2">
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

          <button className="pill-action px-4 py-2 text-sm font-semibold">Войти</button>
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
