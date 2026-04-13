'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Landmark } from 'lucide-react';

export default function AddCemeteryStubPage() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/cemeteries');
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:text-[color:var(--ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      <section className="surface-card mt-5 rounded-3xl p-8 sm:p-10">
        <h1 className="inline-flex items-center gap-3 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">
          <Landmark className="h-7 w-7 text-[color:var(--accent)]" />
          Добавление кладбища
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-muted)]">
          Этот экран пока является заглушкой. UI для добавления кладбища будет реализован позже.
        </p>
      </section>
    </div>
  );
}
