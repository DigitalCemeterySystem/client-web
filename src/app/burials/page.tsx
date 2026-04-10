'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useBurials } from '@/hooks/useBurials';
import { useCemeteries } from '@/hooks/useCemeteries';
import type { BurialResponse, SectorResponse } from '@/types';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers3,
  Loader2,
  MapPinned,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const CemeteryMap = dynamic(() => import('@/components/features/map/CemeteryMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[360px] w-full animate-pulse rounded-[28px] bg-[color:var(--bg-elevated)]" />,
});

const PAGE_SIZE = 12;
const INITIAL_MAP_CENTER: [number, number] = [82.9, 55.03];
const INITIAL_MAP_ZOOM = 10;
const BURIALS_PAGE_STATE_KEY = 'burials:page-state';
const BURIALS_RETURN_HIGHLIGHT_ID_KEY = 'burials:return-highlight-id';

type FiltersState = {
  cemeteryId: string;
  sectorId: string;
  name: string;
  birthDateExact: string;
  birthDateFrom: string;
  birthDateTo: string;
  deathDateExact: string;
  deathDateFrom: string;
  deathDateTo: string;
};

const INITIAL_FILTERS: FiltersState = {
  cemeteryId: '',
  sectorId: '',
  name: '',
  birthDateExact: '',
  birthDateFrom: '',
  birthDateTo: '',
  deathDateExact: '',
  deathDateFrom: '',
  deathDateTo: '',
};

type BurialsPageState = {
  filters: FiltersState;
  page: number;
  selectedMapBurialId: number | null;
  isMapOpen: boolean;
  isMapPopupOpen: boolean;
  mapFocusKey: number;
  showMapBoundaries: boolean;
  showMapSectors: boolean;
  scrollY: number;
};

function readSavedPageState(): BurialsPageState | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.sessionStorage.getItem(BURIALS_PAGE_STATE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<BurialsPageState>;
    return {
      filters: {
        cemeteryId: parsed.filters?.cemeteryId ?? '',
        sectorId: parsed.filters?.sectorId ?? '',
        name: parsed.filters?.name ?? '',
        birthDateExact: parsed.filters?.birthDateExact ?? '',
        birthDateFrom: parsed.filters?.birthDateFrom ?? '',
        birthDateTo: parsed.filters?.birthDateTo ?? '',
        deathDateExact: parsed.filters?.deathDateExact ?? '',
        deathDateFrom: parsed.filters?.deathDateFrom ?? '',
        deathDateTo: parsed.filters?.deathDateTo ?? '',
      },
      page: Number.isFinite(parsed.page) ? Math.max(1, Number(parsed.page)) : 1,
      selectedMapBurialId: Number.isFinite(parsed.selectedMapBurialId) ? Number(parsed.selectedMapBurialId) : null,
      isMapOpen: Boolean(parsed.isMapOpen),
      isMapPopupOpen: Boolean(parsed.isMapPopupOpen),
      mapFocusKey: Number.isFinite(parsed.mapFocusKey) ? Number(parsed.mapFocusKey) : 0,
      showMapBoundaries: parsed.showMapBoundaries ?? true,
      showMapSectors: parsed.showMapSectors ?? true,
      scrollY: Number.isFinite(parsed.scrollY) ? Math.max(0, Number(parsed.scrollY)) : 0,
    };
  } catch {
    return null;
  }
}

function writeSavedPageState(state: BurialsPageState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(BURIALS_PAGE_STATE_KEY, JSON.stringify(state));
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function extractDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const matched = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (matched) return matched[1];

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined): string {
  const normalized = extractDateValue(value);
  if (!normalized) return 'Не указана';

  const [year, month, day] = normalized.split('-');
  return `${day}.${month}.${year}`;
}

function hasDateMatch(value: string | null | undefined, exact: string, from: string, to: string) {
  if (!exact && !from && !to) return true;

  const normalized = extractDateValue(value);
  if (!normalized) return false;

  if (exact && normalized !== exact) return false;
  if (from && normalized < from) return false;
  if (to && normalized > to) return false;

  return true;
}

function buildDescription(burial: BurialResponse) {
  if (!burial.biography?.trim()) {
    return 'Биография пока отсутствует в реестре.';
  }

  const normalized = burial.biography.trim().replace(/\s+/g, ' ');
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 180).trimEnd()}...`;
}

export default function BurialsPage() {
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const pendingStateRef = useRef<BurialsPageState | null>(null);
  const restoredStateRef = useRef(false);
  const skipNextPageResetRef = useRef(false);
  const restoredScrollYRef = useRef<number | null>(null);
  const [scrollRestoreEpoch, setScrollRestoreEpoch] = useState(0);

  const { cemeteries, loading: cemeteriesLoading, error: cemeteriesError } = useCemeteries();
  const { burials, loading: burialsLoading, error: burialsError } = useBurials();

  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedMapBurialId, setSelectedMapBurialId] = useState<number | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false);
  const [mapFocusKey, setMapFocusKey] = useState(0);
  const [showMapBoundaries, setShowMapBoundaries] = useState(true);
  const [showMapSectors, setShowMapSectors] = useState(true);
  const [highlightedBurialId, setHighlightedBurialId] = useState<number | null>(null);

  const persistPageState = useCallback(() => {
    writeSavedPageState({
      filters,
      page,
      selectedMapBurialId,
      isMapOpen,
      isMapPopupOpen,
      mapFocusKey,
      showMapBoundaries,
      showMapSectors,
      scrollY: typeof window === 'undefined' ? 0 : Math.max(0, window.scrollY),
    });
  }, [filters, isMapOpen, isMapPopupOpen, mapFocusKey, page, selectedMapBurialId, showMapBoundaries, showMapSectors]);

  useEffect(() => {
    pendingStateRef.current = readSavedPageState();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('cemeteries:return-burial-popup-id');
    }
  }, []);

  const selectedCemetery = useMemo(
    () => cemeteries.find((cemetery) => String(cemetery.id) === filters.cemeteryId) ?? null,
    [cemeteries, filters.cemeteryId]
  );

  const availableSectors = useMemo(
    () => selectedCemetery?.sectors?.slice().sort((left, right) => left.name.localeCompare(right.name, 'ru')) ?? [],
    [selectedCemetery]
  );

  useEffect(() => {
    if (!filters.sectorId) return;

    const sectorStillExists = availableSectors.some((sector) => String(sector.id) === filters.sectorId);
    if (sectorStillExists) return;

    setFilters((current) => ({ ...current, sectorId: '' }));
  }, [availableSectors, filters.sectorId]);

  const filteredBurials = useMemo(() => {
    const normalizedName = filters.name.trim().toLocaleLowerCase('ru');

    return burials.filter((burial) => {
      if (filters.cemeteryId && String(burial.cemeteryId ?? '') !== filters.cemeteryId) {
        return false;
      }

      if (filters.sectorId && String(burial.sectorId ?? '') !== filters.sectorId) {
        return false;
      }

      if (normalizedName && !burial.fullName.toLocaleLowerCase('ru').includes(normalizedName)) {
        return false;
      }

      if (!hasDateMatch(burial.birthDate, filters.birthDateExact, filters.birthDateFrom, filters.birthDateTo)) {
        return false;
      }

      if (!hasDateMatch(burial.deathDate, filters.deathDateExact, filters.deathDateFrom, filters.deathDateTo)) {
        return false;
      }

      return true;
    });
  }, [burials, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredBurials.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (skipNextPageResetRef.current) {
      skipNextPageResetRef.current = false;
      return;
    }

    setPage(1);
  }, [filters]);

  const paginatedBurials = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredBurials.slice(start, start + PAGE_SIZE);
  }, [filteredBurials, page]);

  const selectedBurialForMap = useMemo(() => {
    if (selectedMapBurialId === null) return null;
    return filteredBurials.find((burial) => burial.id === selectedMapBurialId) ?? null;
  }, [filteredBurials, selectedMapBurialId]);

  useEffect(() => {
    if (selectedMapBurialId === null) return;
    if (selectedBurialForMap) return;

    setSelectedMapBurialId(null);
    setIsMapOpen(false);
    setIsMapPopupOpen(false);
  }, [selectedBurialForMap, selectedMapBurialId]);

  const mapBurials = useMemo(() => (selectedBurialForMap ? [selectedBurialForMap] : []), [selectedBurialForMap]);

  const mapCemeteries = useMemo(() => {
    if (!selectedBurialForMap || !showMapBoundaries) return [];
    return cemeteries.filter((cemetery) => cemetery.id === selectedBurialForMap.cemeteryId);
  }, [cemeteries, selectedBurialForMap, showMapBoundaries]);

  const mapSectors = useMemo<SectorResponse[]>(() => {
    if (!selectedBurialForMap || !showMapSectors) return [];

    const cemetery = cemeteries.find((item) => item.id === selectedBurialForMap.cemeteryId);
    return cemetery?.sectors ?? [];
  }, [cemeteries, selectedBurialForMap, showMapSectors]);

  const activeFiltersCount = useMemo(
    () => Object.values(filters).reduce((count, value) => count + (value ? 1 : 0), 0),
    [filters]
  );

  const scrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const focusSingleBurial = (burial: BurialResponse) => {
    setSelectedMapBurialId(burial.id);
    setIsMapOpen(true);
    setIsMapPopupOpen(true);
    setMapFocusKey((current) => current + 1);
    scrollToMap();
  };

  const closeMap = () => {
    setIsMapOpen(false);
    setIsMapPopupOpen(false);
    setSelectedMapBurialId(null);
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setIsMapOpen(false);
    setIsMapPopupOpen(false);
    setSelectedMapBurialId(null);
  };

  const handleBeforeNavigateDetails = useCallback(
    (burialId: number) => {
      persistPageState();
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(BURIALS_RETURN_HIGHLIGHT_ID_KEY, String(burialId));
      }
    },
    [persistPageState]
  );

  const handlePinnedPopupChange = useCallback((burialId: number | null) => {
    setIsMapPopupOpen(burialId !== null);
  }, []);

  const loading = cemeteriesLoading || burialsLoading;
  const error = cemeteriesError || burialsError;

  useEffect(() => {
    if (restoredStateRef.current) return;
    if (loading) return;
    if (error) return;

    restoredStateRef.current = true;
    const savedState = pendingStateRef.current;
    if (!savedState) return;

    skipNextPageResetRef.current = true;
    setFilters(savedState.filters);
    setPage(savedState.page);
    setSelectedMapBurialId(savedState.selectedMapBurialId);
    setIsMapOpen(savedState.isMapOpen);
    setIsMapPopupOpen(savedState.isMapPopupOpen);
    setMapFocusKey(savedState.mapFocusKey);
    setShowMapBoundaries(savedState.showMapBoundaries);
    setShowMapSectors(savedState.showMapSectors);
    restoredScrollYRef.current = savedState.scrollY;
    setScrollRestoreEpoch((current) => current + 1);

    if (typeof window !== 'undefined') {
      const highlightRawId = window.sessionStorage.getItem(BURIALS_RETURN_HIGHLIGHT_ID_KEY);
      if (highlightRawId) {
        const numericId = Number(highlightRawId);
        if (Number.isFinite(numericId)) {
          setHighlightedBurialId(numericId);
        }
        window.sessionStorage.removeItem(BURIALS_RETURN_HIGHLIGHT_ID_KEY);
      }
    }

    pendingStateRef.current = null;
  }, [error, loading]);

  useEffect(() => {
    if (!restoredStateRef.current) return;

    persistPageState();
  }, [persistPageState]);

  useEffect(() => {
    if (restoredScrollYRef.current === null) return;

    const targetScrollY = restoredScrollYRef.current;
    restoredScrollYRef.current = null;

    const restore = () => {
      window.scrollTo({ top: targetScrollY, behavior: 'auto' });
    };

    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  }, [scrollRestoreEpoch]);

  useEffect(() => {
    if (highlightedBurialId === null) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedBurialId(null);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedBurialId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 xl:px-8">
      <section className="surface-card rounded-[32px] px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Реестр</p>
            <h1 className="display-font mt-3 text-4xl leading-tight text-[color:var(--ink)] sm:text-5xl">Захоронения</h1>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-muted)] sm:text-base">
              Найдите нужное захоронение по ФИО, кладбищу, кварталу и датам. Для просмотра на карте выберите запись в
              списке и нажмите «На карте».
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <SummaryChip icon={<UserRound size={15} />} label="Найдено" value={`${filteredBurials.length}`} />
            <SummaryChip icon={<Filter size={15} />} label="Активных фильтров" value={`${activeFiltersCount}`} />
          </div>
        </div>
      </section>

      <div className={cn('mt-6 grid gap-6', isMapOpen ? 'xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]' : 'xl:grid-cols-1')}>
        <section className="space-y-6">
          <div className="surface-card rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--accent-strong)]">
                    <SlidersHorizontal size={14} />
                    Фильтры
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-muted)]">
                    Используйте фильтры, чтобы быстро сузить список захоронений.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                  >
                    <X size={15} />
                    Сбросить
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <Field label="По имени" icon={<Search size={14} />}>
                  <input
                    type="text"
                    value={filters.name}
                    onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Например, Иванов Иван"
                    className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  />
                </Field>

                <Field label="Кладбище" icon={<MapPinned size={14} />}>
                  <select
                    value={filters.cemeteryId}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        cemeteryId: event.target.value,
                        sectorId: '',
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  >
                    <option value="">Все кладбища</option>
                    {cemeteries
                      .slice()
                      .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
                      .map((cemetery) => (
                        <option key={cemetery.id} value={cemetery.id}>
                          {cemetery.name}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Квартал" icon={<Layers3 size={14} />}>
                  <select
                    value={filters.sectorId}
                    onChange={(event) => setFilters((current) => ({ ...current, sectorId: event.target.value }))}
                    disabled={!selectedCemetery}
                    className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)] px-4 text-sm text-[color:var(--ink)] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  >
                    <option value="">{selectedCemetery ? 'Все кварталы' : 'Сначала выберите кладбище'}</option>
                    {availableSectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <DateFilterGroup
                  title="Дата рождения"
                  stacked={isMapOpen}
                  exact={filters.birthDateExact}
                  from={filters.birthDateFrom}
                  to={filters.birthDateTo}
                  onExactChange={(value) => setFilters((current) => ({ ...current, birthDateExact: value }))}
                  onFromChange={(value) => setFilters((current) => ({ ...current, birthDateFrom: value }))}
                  onToChange={(value) => setFilters((current) => ({ ...current, birthDateTo: value }))}
                />
                <DateFilterGroup
                  title="Дата смерти"
                  stacked={isMapOpen}
                  exact={filters.deathDateExact}
                  from={filters.deathDateFrom}
                  to={filters.deathDateTo}
                  onExactChange={(value) => setFilters((current) => ({ ...current, deathDateExact: value }))}
                  onFromChange={(value) => setFilters((current) => ({ ...current, deathDateFrom: value }))}
                  onToChange={(value) => setFilters((current) => ({ ...current, deathDateTo: value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">Список захоронений</h2>
                <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                  Страница {page} из {totalPages}. На одной странице показывается до {PAGE_SIZE} записей.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--ink-muted)]">
                <span className="rounded-full bg-[color:var(--bg-elevated)] px-3 py-1">Всего: {filteredBurials.length}</span>
                {isMapOpen && selectedBurialForMap && (
                  <span className="rounded-full bg-[color:var(--bg-elevated)] px-3 py-1">На карте: {selectedBurialForMap.fullName}</span>
                )}
              </div>
            </div>

            {paginatedBurials.length > 0 ? (
              paginatedBurials.map((burial) => (
                <BurialCard
                  key={burial.id}
                  burial={burial}
                  isMapFocused={selectedMapBurialId === burial.id && isMapOpen}
                  onShowOnMap={() => focusSingleBurial(burial)}
                  onBeforeNavigateDetails={() => handleBeforeNavigateDetails(burial.id)}
                  isRecentlyHighlighted={highlightedBurialId === burial.id}
                />
              ))
            ) : (
              <EmptyResultsState onReset={resetFilters} />
            )}

            {filteredBurials.length > PAGE_SIZE && (
              <div className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[color:var(--ink-muted)]">
                  Показаны записи {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredBurials.length)} из {filteredBurials.length}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--ink)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[color:var(--bg-elevated)]"
                  >
                    <ChevronLeft size={16} />
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--ink)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[color:var(--bg-elevated)]"
                  >
                    Вперёд
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {isMapOpen && selectedBurialForMap && (
          <section ref={mapSectionRef} className="xl:sticky xl:top-24 xl:h-[calc(100vh-120px)]">
            <div className="surface-card flex h-full min-h-[520px] flex-col overflow-hidden rounded-[30px]">
              <div className="flex flex-col gap-4 border-b border-[color:var(--line)] px-5 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Карта</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">{selectedBurialForMap.fullName}</h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeMap}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                  >
                    <X size={15} />
                    Закрыть карту
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMapBoundaries((current) => !current)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition',
                      showMapBoundaries
                        ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                        : 'border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
                    )}
                  >
                    <Layers3 size={15} />
                    Границы кладбища
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMapSectors((current) => !current)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition',
                      showMapSectors
                        ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                        : 'border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
                    )}
                  >
                    <Layers3 size={15} />
                    Кварталы
                  </button>
                </div>
              </div>

              <div className="relative flex-1 bg-[color:var(--bg-elevated)]">
                <CemeteryMap
                  key={`burial-map-${selectedMapBurialId}-${mapFocusKey}`}
                  cemeteries={mapCemeteries}
                  sectors={mapSectors}
                  burials={mapBurials}
                  center={INITIAL_MAP_CENTER}
                  zoom={INITIAL_MAP_ZOOM}
                  focusKey={mapFocusKey}
                  fitToBurials
                  showBoundary={showMapBoundaries}
                  showSectors={showMapSectors}
                  showBurials
                  autoPinSingleBurial={isMapPopupOpen}
                  autoPinNonce={mapFocusKey}
                  onPinnedPopupChange={handlePinnedPopupChange}
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-3">
        <Loader2 className="h-5 w-5 animate-spin text-[color:var(--accent)]" />
        <span className="text-sm font-medium text-[color:var(--ink-muted)]">Загрузка реестра захоронений...</span>
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
      <h2 className="mt-4 text-xl font-semibold text-[color:var(--ink)]">Не удалось загрузить реестр</h2>
      <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{message}</p>
    </div>
  );
}

function SummaryChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">{value}</div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
  compact,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span
        className={cn(
          'mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]',
          compact && 'mb-1 text-[11px]'
        )}
      >
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function DateFilterGroup({
  title,
  stacked = false,
  exact,
  from,
  to,
  onExactChange,
  onFromChange,
  onToChange,
}: {
  title: string;
  stacked?: boolean;
  exact: string;
  from: string;
  to: string;
  onExactChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--bg-panel)]/70 p-4">
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
        <Calendar size={14} />
        {title}
      </div>

      <div className={cn(stacked ? '' : 'overflow-x-auto pb-1')}>
        <div
          className={cn(
            'grid gap-3',
            stacked ? 'grid-cols-1' : 'min-w-[520px] grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)]'
          )}
        >
          <Field label="Точная дата" icon={<Calendar size={13} />} compact>
            <input
              type="date"
              value={exact}
              onChange={(event) => onExactChange(event.target.value)}
              className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)] px-3 text-[13px] text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
            />
          </Field>

          <div className="rounded-2xl border border-[color:var(--line)]/80 bg-[color:var(--bg-elevated)]/55 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">Диапазон дат</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="От" icon={<Calendar size={13} />} compact>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => onFromChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)] px-3 text-[13px] text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
              </Field>

              <Field label="До" icon={<Calendar size={13} />} compact>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => onToChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)] px-3 text-[13px] text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BurialCard({
  burial,
  isMapFocused,
  onShowOnMap,
  onBeforeNavigateDetails,
  isRecentlyHighlighted,
}: {
  burial: BurialResponse;
  isMapFocused: boolean;
  onShowOnMap: () => void;
  onBeforeNavigateDetails?: () => void;
  isRecentlyHighlighted?: boolean;
}) {
  const sectorLabel = burial.sectorName || 'Квартал не указан';
  const cemeteryLabel = burial.cemeteryName || 'Кладбище не указано';

  return (
    <article
      className={cn(
        'surface-card rounded-[28px] px-5 py-5 sm:px-6',
        isMapFocused && 'ring-2 ring-[color:var(--accent)]/40',
        isRecentlyHighlighted &&
          'ring-1 ring-amber-300/80 bg-amber-50/10 shadow-[0_0_0_4px_rgba(251,191,36,0.12)] transition-[box-shadow,background-color,ring-color] duration-700'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-strong)]">
              {cemeteryLabel}
            </span>
            <span className="rounded-full bg-[color:var(--bg-elevated)] px-3 py-1 text-xs font-semibold text-[color:var(--ink-muted)]">
              {sectorLabel}
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold text-[color:var(--ink)]">{burial.fullName}</h3>

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--ink-muted)]">
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1">Дата рождения: {formatDate(burial.birthDate)}</span>
            <span className="rounded-full border border-[color:var(--line)] px-3 py-1">Дата смерти: {formatDate(burial.deathDate)}</span>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[color:var(--ink-muted)]">{buildDescription(burial)}</p>
        </div>

        <div className="flex flex-col gap-2 lg:min-w-[200px]">
          <button
            type="button"
            onClick={onShowOnMap}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
          >
            <MapPinned size={16} />
            На карте
          </button>

          <Link
            href={`/burials/${burial.id}`}
            scroll={false}
            onClick={onBeforeNavigateDetails}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Подробнее
          </Link>
        </div>
      </div>
    </article>
  );
}

function EmptyResultsState({ onReset }: { onReset: () => void }) {
  return (
    <div className="surface-card rounded-[28px] px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-xl font-semibold text-[color:var(--ink)]">Совпадений не найдено</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[color:var(--ink-muted)]">
        В реестре нет записей, которые удовлетворяют текущему набору фильтров. Можно сбросить фильтры и посмотреть
        полный список снова.
      </p>
      <button type="button" onClick={onReset} className="pill-action mt-5 px-4 py-2 text-sm font-semibold">
        Сбросить фильтры
      </button>
    </div>
  );
}
