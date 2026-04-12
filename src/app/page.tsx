import Link from 'next/link';
import { ArrowRight, Map, ShieldCheck, Users } from 'lucide-react';

const quickAccess = [
  {
    href: '/cemeteries',
    title: 'Карта кладбищ',
    description: 'Просмотр захоронений и границ кладбищ, их кварталов и структуры участков на интерактивной карте.',
    icon: Map,
    action: 'Открыть карту',
  },
  {
    href: '/burials',
    title: 'Реестр захоронений',
    description: 'Карточки усопших, даты, квартал и геопозиция захоронения в едином каталоге с удобными фильтрами.',
    icon: Users,
    action: 'Перейти в реестр',
  },
  {
    href: '/login',
    title: 'Преимущества авторизации',
    description: 'Авторизованным пользователям доступны редактирование данных о захоронениях и добавление новых точек на карту.',
    icon: ShieldCheck,
    action: 'Перейти к авторизации',
  },
];

export default function Home() {
  return (
    <div className="relative flex-1 overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(79,107,104,0.22),transparent_66%)]" />

      <section className="relative mx-auto w-full max-w-6xl animate-fade-in">
        <div className="surface-card rounded-3xl px-6 py-12 sm:px-10 sm:py-16">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Digital Cemetery System</p>
          <h1 className="display-font mt-4 max-w-5xl text-5xl leading-[1.02] text-[color:var(--ink)] sm:text-6xl lg:text-7xl">
            <span className="block md:whitespace-nowrap">Цифровой доступ к кладбищам</span>
            <span className="block md:whitespace-nowrap">и реестрам захоронений</span>
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-[color:var(--ink-muted)] sm:text-lg">
            Веб-интерфейс для поиска, навигации и редактирования данных о кладбищах.
            <br className="hidden sm:block" />Спокойная подача, понятная структура и минимальный визуальный шум.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/cemeteries" className="pill-action inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              Открыть карту
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/burials"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--bg)]"
            >
              Перейти в реестр
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
