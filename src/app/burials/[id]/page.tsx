'use client';

import { burialService } from '@/core/api/burial.service';
import type { BurialResponse } from '@/types';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Loader2, MapPinned, ScrollText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function formatDate(dateValue: string | null): string {
  if (!dateValue) return 'Не указана';

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;

  return new Intl.DateTimeFormat('ru-RU').format(parsed);
}

function resolveCoordinates(burial: BurialResponse) {
  const latitude = Number(burial.latitude);
  const longitude = Number(burial.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export default function BurialDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [burial, setBurial] = useState<BurialResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burialId, setBurialId] = useState<number | null>(null);

  const navigateBackToMap = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/cemeteries');
  };

  useEffect(() => {
    let mounted = true;

    params
      .then(({ id }) => {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) {
          throw new Error('Некорректный идентификатор захоронения.');
        }

        if (mounted) {
          setBurialId(numericId);
        }

        return burialService.getById(numericId);
      })
      .then((data) => {
        if (!mounted) return;
        setBurial(data);
        setError(null);
      })
      .catch((caught) => {
        if (!mounted) return;
        setError(caught instanceof Error ? caught.message : 'Не удалось загрузить карточку захоронения.');
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [params]);

  const coordinates = useMemo(() => (burial ? resolveCoordinates(burial) : null), [burial]);

  if (loading) {
    return (
      <section className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6">
        <div className="surface-card flex items-center gap-3 rounded-2xl px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[color:var(--accent)]" />
          <span className="text-sm text-[color:var(--ink-muted)]">Загрузка карточки захоронения...</span>
        </div>
      </section>
    );
  }

  if (error || !burial) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Карточка захоронения недоступна</h1>
        <p className="mt-3 text-sm text-[color:var(--ink-muted)]">{error ?? 'Запись не найдена.'}</p>
        <button
          type="button"
          onClick={navigateBackToMap}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Вернуться к карте
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={navigateBackToMap}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:text-[color:var(--ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        К карте кладбищ
      </button>

      <article className="surface-card mt-5 overflow-hidden rounded-[2rem]">
        <div className="grid gap-0 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="flex items-center justify-center border-b border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-6 lg:border-b-0 lg:border-r">
            {burial.photoUrl ? (
              <Image
                src={burial.photoUrl}
                alt={`Фотография захоронения ${burial.fullName}`}
                width={420}
                height={420}
                unoptimized
                className="max-h-[420px] w-auto max-w-full rounded-[1.5rem] object-contain"
              />
            ) : (
              <div className="flex h-[260px] w-full items-center justify-center rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[color:var(--bg-panel)] text-sm text-[color:var(--ink-muted)]">
                Фотография отсутствует
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
              Захоронение #{burialId ?? burial.id}
            </p>
            <h1 className="display-font mt-3 text-4xl leading-tight text-[color:var(--ink)]">{burial.fullName}</h1>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <InfoCard
                icon={<CalendarDays className="h-4 w-4" />}
                title="Даты жизни"
                value={`${formatDate(burial.birthDate)} - ${formatDate(burial.deathDate)}`}
              />
              <InfoCard icon={<MapPinned className="h-4 w-4" />} title="Координаты" value={coordinates ?? 'Не указаны'} />
              <InfoCard icon={<MapPinned className="h-4 w-4" />} title="Кладбище" value={burial.cemeteryName || 'Не указано'} />
              <InfoCard icon={<ScrollText className="h-4 w-4" />} title="Квартал" value={burial.sectorName || 'Не указан'} />
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">Биография</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[color:var(--ink-muted)]">
                {burial.biography?.trim() || 'Биография отсутствует.'}
              </p>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-4">
      <div className="flex items-center gap-2 text-[color:var(--ink-muted)]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">{title}</span>
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ink)]">{value}</p>
    </div>
  );
}
