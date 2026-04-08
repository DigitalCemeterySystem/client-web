'use client';

import { useCemeteries } from '@/hooks/useCemeteries';
import { useBurials } from '@/hooks/useBurials';
import type { CemeteryResponse } from '@/types';
import dynamic from 'next/dynamic';
import { AlertCircle, ChevronLeft, ChevronRight, Layers, Loader2, Map as MapIcon, Users } from 'lucide-react';
import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CemeteryMap = dynamic(() => import('@/components/features/map/CemeteryMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[400px] w-full animate-pulse rounded-2xl bg-[color:var(--bg-elevated)]" />,
});

export default function CemeteriesPage() {
  const { cemeteries, loading: cLoading, error: cError } = useCemeteries();

  const [selectedCemetery, setSelectedCemetery] = useState<CemeteryResponse | null>(null);
  const { burials, loading: bLoading } = useBurials(selectedCemetery?.id ?? null);
  const [focusKey, setFocusKey] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [layers, setLayers] = useState({
    boundary: true,
    sectors: true,
    burials: true,
  });

  if (cLoading) {
    return <LoadingState />;
  }

  if (cError) {
    return <ErrorState message={cError} />;
  }

  if (cemeteries.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="relative flex h-[calc(100vh-64px)] flex-1 overflow-hidden">
      <aside
        className={cn(
          'surface-card z-20 flex h-full flex-shrink-0 flex-col border-r transition-all duration-300 ease-in-out',
          isPanelOpen ? 'w-80 translate-x-0 md:w-96' : 'w-0 -translate-x-full overflow-hidden opacity-0 border-none'
        )}
      >
        <div className="shrink-0 border-b border-[color:var(--line)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Реестр</p>
              <h2 className="mt-1 text-xl font-semibold text-[color:var(--ink)]">Кладбища</h2>
            </div>
            <button
              onClick={() => setIsPanelOpen(false)}
              className="rounded-lg p-1.5 text-[color:var(--ink-muted)] transition hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--ink)]"
              aria-label="Скрыть список кладбищ"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {cemeteries.map((cemetery) => (
            <button
              key={cemetery.id}
              onClick={() => {
                setSelectedCemetery(cemetery);
                setFocusKey((prev) => prev + 1);
              }}
              className={cn(
                'w-full rounded-xl border p-4 text-left transition duration-200',
                selectedCemetery?.id === cemetery.id
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]/60 shadow-[0_0_0_1px_var(--accent)]'
                  : 'border-[color:var(--line)] bg-[color:var(--bg-panel)] hover:border-[color:var(--accent)]/60 hover:bg-[color:var(--bg-elevated)]'
              )}
            >
              <h3 className="text-base font-semibold text-[color:var(--ink)]">{cemetery.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-[color:var(--ink-muted)]">{cemetery.address}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md bg-[color:var(--bg-elevated)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--ink-muted)]">
                  ID {cemetery.id}
                </span>
                <span className="rounded-md bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--accent-strong)]">
                  Секторов: {cemetery.sectors?.length ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {!isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(true)}
          className="absolute left-4 top-4 z-30 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-2.5 text-[color:var(--ink-muted)] shadow-md transition hover:text-[color:var(--ink)]"
          aria-label="Показать список кладбищ"
        >
          <ChevronRight size={22} />
        </button>
      )}

      <main className="relative flex-1 overflow-hidden bg-[color:var(--bg-elevated)]">
        <div className="absolute right-4 top-4 z-10">
          <div className="surface-card flex min-w-[170px] flex-col gap-2 rounded-xl p-3">
            <div className="mb-1 flex items-center gap-2 px-1">
              <Layers size={14} className="text-[color:var(--ink-muted)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">Слои</span>
            </div>

            <LayerToggle
              active={layers.boundary}
              onClick={() => setLayers((current) => ({ ...current, boundary: !current.boundary }))}
              icon={<MapIcon size={14} />}
              label="Границы"
            />
            <LayerToggle
              active={layers.sectors}
              onClick={() => setLayers((current) => ({ ...current, sectors: !current.sectors }))}
              icon={<Layers size={14} />}
              label="Кварталы"
            />
            <LayerToggle
              active={layers.burials}
              onClick={() => setLayers((current) => ({ ...current, burials: !current.burials }))}
              icon={<Users size={14} />}
              label="Захоронения"
            />
          </div>
        </div>

        <div className="h-full w-full">
          <CemeteryMap
            cemetery={selectedCemetery}
            sectors={selectedCemetery?.sectors}
            burials={burials}
            focusKey={focusKey}
            showBoundary={layers.boundary}
            showSectors={layers.sectors}
            showBurials={layers.burials}
          />
        </div>

        {bLoading && (
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 shadow-lg">
            <Loader2 size={16} className="animate-spin text-[color:var(--accent)]" />
            <span className="text-xs font-semibold text-[color:var(--ink-muted)]">Загрузка захоронений...</span>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-3">
        <Loader2 className="h-5 w-5 animate-spin text-[color:var(--accent)]" />
        <span className="text-sm font-medium text-[color:var(--ink-muted)]">Загрузка списка кладбищ...</span>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-[color:var(--ink)]">Не удалось загрузить данные</h2>
      <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
      <h2 className="text-xl font-semibold text-[color:var(--ink)]">Реестр кладбищ пока пуст</h2>
      <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
        После добавления данных здесь появится список кладбищ и интерактивная карта с секторами.
      </p>
    </div>
  );
}

function LayerToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition',
        active
          ? 'bg-[color:var(--accent)] text-white'
          : 'bg-[color:var(--bg-elevated)] text-[color:var(--ink-muted)] hover:bg-[color:var(--accent-soft)]/60 hover:text-[color:var(--ink)]'
      )}
    >
      {icon}
      <span>{label}</span>
      <div className={cn('ml-auto h-1.5 w-1.5 rounded-full transition', active ? 'scale-125 bg-white' : 'bg-[color:var(--line)]')} />
    </button>
  );
}
