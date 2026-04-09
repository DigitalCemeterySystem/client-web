import Link from 'next/link';
import { ArrowRight, Map, Search, Users } from 'lucide-react';

const quickAccess = [
  {
    href: '/cemeteries',
    title: 'Карта кладбищ',
    description: 'Просмотр границ кладбищ, кварталов и структуры участков на интерактивной карте.',
    icon: Map,
    action: 'Открыть карту',
  },
  {
    href: '/burials',
    title: 'Реестр захоронений',
    description: 'Карточки персон, даты, квартал и геопозиция захоронения в едином каталоге.',
    icon: Users,
    action: 'Перейти в реестр',
  },
  {
    href: '/search',
    title: 'Поиск по данным',
    description: 'Быстрый поиск по ФИО, датам и локациям для граждан и городских служб.',
    icon: Search,
    action: 'Запустить поиск',
  },
];

export default function Home() {
  return (
    <div className="relative flex-1 overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(79,107,104,0.22),transparent_66%)]" />

      <section className="relative mx-auto w-full max-w-6xl animate-fade-in">
        <div className="surface-card rounded-3xl px-6 py-12 sm:px-10 sm:py-16">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Digital Cemetery System</p>
          <h1 className="display-font mt-4 max-w-4xl text-5xl leading-[1.02] text-[color:var(--ink)] sm:text-6xl lg:text-7xl">Цифровой доступ к памяти и реестрам захоронений</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[color:var(--ink-muted)] sm:text-lg">
            Публичный веб-интерфейс для поиска, навигации и проверки данных о кладбищах. Спокойная подача,
            понятная структура и минимальный визуальный шум.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/search" className="pill-action inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              Начать поиск
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/cemeteries"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--bg)]"
            >
              Открыть карту
            </Link>
          </div>
        </div>
      </section>

      <section className="relative mx-auto mt-8 grid w-full max-w-6xl gap-4 md:grid-cols-3 md:gap-5 animate-slide-up">
        {quickAccess.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group surface-muted rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]/50"
          >
            <div className="inline-flex rounded-xl bg-[color:var(--accent-soft)] p-2.5 text-[color:var(--accent-strong)]">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[color:var(--ink)]">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">{item.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--accent-strong)]">
              {item.action}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
