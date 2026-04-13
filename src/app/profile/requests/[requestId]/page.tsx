'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  ImageIcon,
  Info,
  Layers,
  Link2,
  LocateFixed,
  Map as MapIcon,
  MapPinned,
  PencilLine,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import BurialRequestLocationMap from '@/components/features/map/BurialRequestLocationMap';
import { changeRequestService } from '@/core/api/change-request.service';
import { burialService } from '@/core/api/burial.service';
import { getRolePresentation } from '@/core/auth/role-presentation';
import { resolveImageSource } from '@/core/utils/image-source';
import { useBurials } from '@/hooks/useBurials';
import { useCemeteries } from '@/hooks/useCemeteries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  formatDateTime,
  getRequestTitle,
  getStatusClassName,
  operationIcons,
  operationLabels,
  statusIcons,
  statusLabels,
  targetIcons,
  targetLabels,
} from '@/components/features/requests/change-request-ui';
import type { BurialChangeFieldKey, BurialResponse, ChangeRequestResponse } from '@/types';

const CemeteryMap = dynamic(() => import('@/components/features/map/CemeteryMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[320px] w-full animate-pulse rounded-2xl bg-[color:var(--bg-elevated)]" />,
});

type RequestsScope = 'my' | 'users';
type LayerVisibility = {
  boundary: boolean;
  sectors: boolean;
  burials: boolean;
};

type Point = {
  latitude: number;
  longitude: number;
};

const DEFAULT_LAYERS: LayerVisibility = {
  boundary: true,
  sectors: true,
  burials: true,
};

function pointsAreEqual(first: Point | null, second: Point | null) {
  if (!first && !second) return true;
  if (!first || !second) return false;

  return Math.abs(first.latitude - second.latitude) < 0.000001 && Math.abs(first.longitude - second.longitude) < 0.000001;
}

function parseFieldCoordinate(request: ChangeRequestResponse, key: 'LATITUDE' | 'LONGITUDE') {
  const raw = request.fields.find((field) => field.fieldKey === key)?.afterValue;
  if (!raw) return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function getFieldIcon(fieldKey: BurialChangeFieldKey) {
  if (fieldKey === 'FULL_NAME') return UserRound;
  if (fieldKey === 'BIRTH_DATE' || fieldKey === 'DEATH_DATE') return CalendarDays;
  if (fieldKey === 'LATITUDE' || fieldKey === 'LONGITUDE') return LocateFixed;
  if (fieldKey === 'PHOTO_URL') return ImageIcon;
  if (fieldKey === 'BIOGRAPHY') return BookOpen;
  if (fieldKey === 'CEMETERY_NAME') return MapPinned;
  if (fieldKey === 'SECTOR_NAME') return Layers;
  return Info;
}

export default function RequestDetailsPage() {
  const router = useRouter();
  const params = useParams<{ requestId: string }>();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useCurrentUser();
  const { cemeteries } = useCemeteries();
  const { burials } = useBurials();

  const parsedRequestId = Number(params?.requestId);
  const requestId = Number.isFinite(parsedRequestId) ? parsedRequestId : null;

  const scope: RequestsScope = searchParams.get('scope') === 'users' ? 'users' : 'my';
  const canModerate = user?.role === 'MODERATOR' || user?.role === 'ADMIN';

  const [request, setRequest] = useState<ChangeRequestResponse | null>(null);
  const [sourceBurial, setSourceBurial] = useState<BurialResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [selectedCemeteryId, setSelectedCemeteryId] = useState<number | null>(null);
  const [cemeteryFilterOpen, setCemeteryFilterOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectionReason, setShowRejectionReason] = useState(false);
  const [headerMapShowBoundaries, setHeaderMapShowBoundaries] = useState(true);
  const [headerMapShowSectors, setHeaderMapShowSectors] = useState(true);

  useEffect(() => {
    if (requestId == null) {
      setLoading(false);
      setError('Некорректный номер заявки.');
    }
  }, [requestId]);

  useEffect(() => {
    if (userLoading || !user || requestId == null) return;

    let active = true;

    async function loadRequest() {
      setLoading(true);
      setError('');

      try {
        const primaryList = scope === 'users' && canModerate
          ? await changeRequestService.getAll()
          : await changeRequestService.getMy();

        let found = primaryList.find((item) => item.id === requestId) ?? null;

        if (!found && canModerate) {
          const fallbackList = await changeRequestService.getAll();
          found = fallbackList.find((item) => item.id === requestId) ?? null;
        }

        if (!active) return;

        if (!found) {
          setRequest(null);
          setError('Заявка не найдена или недоступна для просмотра.');
          setLoading(false);
          return;
        }

        setRequest(found);

        if (found.operationType === 'EDIT' && found.burialId) {
          try {
            const burial = await burialService.getById(found.burialId);
            if (!active) return;
            setSourceBurial(burial);
            if (burial.cemeteryId != null) {
              setSelectedCemeteryId(burial.cemeteryId);
            }
          } catch {
            if (!active) return;
            setSourceBurial(null);
          }
        } else {
          setSourceBurial(null);
        }
      } catch (requestError) {
        if (!active) return;
        setRequest(null);
        setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить заявку.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRequest();
    return () => {
      active = false;
    };
  }, [canModerate, requestId, scope, user, userLoading]);

  const authorCanEdit =
    !!user &&
    !!request &&
    request.authorUserId === user.id &&
    request.status === 'PENDING' &&
    scope === 'my';

  const requestPoint = useMemo(() => {
    if (!request) return null;

    if (request.previewLatitude != null && request.previewLongitude != null) {
      return {
        latitude: request.previewLatitude,
        longitude: request.previewLongitude,
      };
    }

    const latitude = parseFieldCoordinate(request, 'LATITUDE');
    const longitude = parseFieldCoordinate(request, 'LONGITUDE');
    if (latitude == null || longitude == null) return null;

    return { latitude, longitude };
  }, [request]);

  const originalPoint = useMemo(() => {
    if (!sourceBurial || sourceBurial.latitude == null || sourceBurial.longitude == null) return null;
    return {
      latitude: Number(sourceBurial.latitude),
      longitude: Number(sourceBurial.longitude),
    };
  }, [sourceBurial]);

  const fixedMarkers = useMemo(() => {
    if (!request) return [];

    if (request.operationType === 'ADD') {
      return requestPoint
        ? [{ id: `request-${request.id}-new`, latitude: requestPoint.latitude, longitude: requestPoint.longitude, variant: 'next' as const }]
        : [];
    }

    const markers: Array<{ id: string; latitude: number; longitude: number; variant: 'current' | 'next' }> = [];
    if (originalPoint) {
      markers.push({
        id: `request-${request.id}-old`,
        latitude: originalPoint.latitude,
        longitude: originalPoint.longitude,
        variant: 'current',
      });
    }

    if (requestPoint && !pointsAreEqual(requestPoint, originalPoint)) {
      markers.push({
        id: `request-${request.id}-new`,
        latitude: requestPoint.latitude,
        longitude: requestPoint.longitude,
        variant: 'next',
      });
    }

    return markers;
  }, [originalPoint, request, requestPoint]);

  const selectedBurials = useMemo(() => {
    if (selectedCemeteryId == null) return burials;
    return burials.filter((burial) => burial.cemeteryId === selectedCemeteryId);
  }, [burials, selectedCemeteryId]);

  const headerMapBurials = useMemo(() => {
    if (!sourceBurial || sourceBurial.latitude == null || sourceBurial.longitude == null) return [];
    return [sourceBurial];
  }, [sourceBurial]);

  const headerMapCemeteries = useMemo(() => {
    if (sourceBurial?.cemeteryId == null) return cemeteries;
    return cemeteries.filter((cemetery) => cemetery.id === sourceBurial.cemeteryId);
  }, [cemeteries, sourceBurial?.cemeteryId]);

  const headerMapSectorList = useMemo(() => {
    if (sourceBurial?.cemeteryId == null) return [];
    const cemetery = cemeteries.find((item) => item.id === sourceBurial.cemeteryId);
    return cemetery?.sectors ?? [];
  }, [cemeteries, sourceBurial?.cemeteryId]);

  const canReview = scope === 'users' && canModerate && request?.status === 'PENDING';
  const reviewerRolePresentation = request?.reviewedByRole ? getRolePresentation(request.reviewedByRole) : null;
  const hasCoordinateFieldChanges =
    request?.fields.some((field) => field.fieldKey === 'LATITUDE' || field.fieldKey === 'LONGITUDE') ?? false;
  const shouldShowMapBinding =
    !!request && (request.operationType === 'ADD' || (request.operationType === 'EDIT' && hasCoordinateFieldChanges));
  const mapBindingPoint: Point | null = !request
    ? null
    : request.operationType === 'ADD'
      ? requestPoint
      : hasCoordinateFieldChanges
        ? requestPoint ?? originalPoint
        : null;

  function navigateBack() {
    const fallback = scope === 'users' ? '/profile/requests/users' : '/profile/requests';

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallback);
  }

  async function handleApprove() {
    if (!request || !canReview) return;

    setProcessing(true);
    setError('');
    try {
      const updated = await changeRequestService.approve(request.id);
      setRequest(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось одобрить заявку.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!request || !canReview) return;

    setProcessing(true);
    setError('');
    try {
      const updated = await changeRequestService.reject(request.id, rejectReason);
      setRequest(updated);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось отклонить заявку.');
    } finally {
      setProcessing(false);
    }
  }

  if (userLoading || loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
        <p className="text-sm text-[color:var(--ink-muted)]">Загружаем заявку...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="surface-card w-full rounded-3xl p-8 sm:p-10">
          <h1 className="display-font text-4xl text-[color:var(--ink)] sm:text-5xl">Нужна авторизация</h1>
          <p className="mt-4 text-base text-[color:var(--ink-muted)]">Авторизуйтесь, чтобы просматривать заявку.</p>
          <div className="mt-6 flex gap-3">
            <Link href="/login" className="pill-action px-5 py-2.5 text-sm font-semibold">
              Войти
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!requestId || !request) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={navigateBack}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:text-[color:var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <section className="surface-card mt-5 rounded-3xl p-8">
          <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Заявка недоступна</h1>
          <p className="mt-3 text-sm text-[color:var(--ink-muted)]">{error || 'Не удалось найти заявку.'}</p>
        </section>
      </div>
    );
  }

  const StatusIcon = statusIcons[request.status];
  const OperationIcon = operationIcons[request.operationType];
  const TargetIcon = targetIcons[request.targetType];

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={navigateBack}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:text-[color:var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <section className="surface-card mt-5 rounded-3xl p-6 sm:p-8">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(430px,1.15fr)]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(request.status)}`}>
                  <StatusIcon size={13} />
                  {statusLabels[request.status]}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-strong)]">
                  <OperationIcon size={13} />
                  {operationLabels[request.operationType]}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--bg-elevated)] px-3 py-1 text-xs font-semibold text-[color:var(--ink-muted)]">
                  <TargetIcon size={13} />
                  {targetLabels[request.targetType]}
                </span>
              </div>

              <h1 className="text-3xl font-semibold text-[color:var(--ink)]">{getRequestTitle(request.id)}</h1>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Создана" value={formatDateTime(request.createdAt)} />
                <InfoRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Изменена" value={formatDateTime(request.updatedAt)} />
                <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="Полей" value={`${request.fields.length}`} />
                <InfoRow icon={<UserRound className="h-3.5 w-3.5" />} label="Автор" value={request.authorUsername} />
              </div>
            </div>

            {request.operationType === 'EDIT' && headerMapBurials.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[color:var(--line)]">
                <div className="border-b border-[color:var(--line)] p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setHeaderMapShowBoundaries((current) => !current)}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        headerMapShowBoundaries
                          ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                          : 'border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)]',
                      ].join(' ')}
                    >
                      <Layers size={13} />
                      Границы
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeaderMapShowSectors((current) => !current)}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        headerMapShowSectors
                          ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                          : 'border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)]',
                      ].join(' ')}
                    >
                      <Layers size={13} />
                      Кварталы
                    </button>
                  </div>
                </div>
                <div className="h-[420px] bg-[color:var(--bg-elevated)]">
                  <CemeteryMap
                    cemeteries={headerMapCemeteries}
                    sectors={headerMapSectorList}
                    burials={headerMapBurials}
                    showBoundary={headerMapShowBoundaries}
                    showSectors={headerMapShowSectors}
                    showBurials
                    fitToBurials
                    autoPinSingleBurial
                    singleBurialVerticalAnchor={0.9}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="surface-card mt-5 rounded-3xl p-6 sm:p-8">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[color:var(--ink)]">
            <Eye size={16} />
            Изменения
          </h2>

          <div className="mt-4 space-y-3">
            {request.fields.map((field) => {
              const FieldIcon = getFieldIcon(field.fieldKey);
              return (
                <div key={`${request.id}-${field.fieldKey}`} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    <FieldIcon className="h-3.5 w-3.5" />
                    {field.fieldLabel}
                  </p>
                  <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <ValueBlock fieldKey={field.fieldKey} label="Было" value={field.beforeValue || 'Не указано'} />
                    <div className="hidden items-center justify-center text-[color:var(--ink-muted)] sm:flex">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <ValueBlock fieldKey={field.fieldKey} label="Стало" value={field.afterValue || 'Не указано'} accent />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface-card mt-5 rounded-3xl p-6 sm:p-8">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[color:var(--ink)]">
            <MapPinned size={16} />
            Привязка на карте
          </h2>

          {shouldShowMapBinding ? (
            <>
              <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--line)]">
                <div className="relative h-[440px]">
                  <BurialRequestLocationMap
                    cemeteries={cemeteries}
                    burials={selectedBurials}
                    selectedCemeteryId={selectedCemeteryId}
                    point={mapBindingPoint}
                    fixedMarkers={fixedMarkers}
                    showCenterPin={false}
                    showBoundary={layers.boundary}
                    showSectors={layers.sectors}
                    showBurials={layers.burials}
                    interactive
                    onPointChange={() => undefined}
                  />

                  <div className="absolute left-3 top-3 w-[min(80vw,280px)]">
                    <button
                      type="button"
                      onClick={() => setCemeteryFilterOpen((current) => !current)}
                      className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]/95 px-3 py-2 text-sm font-semibold text-[color:var(--ink)] backdrop-blur-sm"
                    >
                      <span className="inline-flex items-center gap-2">
                        <MapPinned className="h-4 w-4 text-[color:var(--ink-muted)]" />
                        Фильтр кладбищ
                      </span>
                      <ChevronDown className={`h-4 w-4 text-[color:var(--ink-muted)] transition ${cemeteryFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {cemeteryFilterOpen && (
                      <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]/95 p-3 backdrop-blur-sm">
                        <select
                          value={selectedCemeteryId ?? ''}
                          onChange={(event) => {
                            const next = event.target.value ? Number(event.target.value) : null;
                            setSelectedCemeteryId(next);
                          }}
                          className="h-10 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-3 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                        >
                          <option value="">Все кладбища</option>
                          {cemeteries.map((cemetery) => (
                            <option key={cemetery.id} value={cemetery.id}>
                              {cemetery.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="absolute right-3 top-3 w-[188px]">
                    <button
                      type="button"
                      onClick={() => setLayersMenuOpen((current) => !current)}
                      className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]/95 px-3 py-2 text-sm font-semibold text-[color:var(--ink)] backdrop-blur-sm"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Layers className="h-4 w-4 text-[color:var(--ink-muted)]" />
                        Слои
                      </span>
                      <ChevronDown className={`h-4 w-4 text-[color:var(--ink-muted)] transition ${layersMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {layersMenuOpen && (
                      <div className="absolute right-0 top-[calc(100%+8px)] w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]/95 p-2 backdrop-blur-sm">
                        <LayerMenuItem
                          icon={<MapIcon className="h-3.5 w-3.5" />}
                          label="Границы"
                          active={layers.boundary}
                          onClick={() => setLayers((current) => ({ ...current, boundary: !current.boundary }))}
                        />
                        <LayerMenuItem
                          icon={<Layers className="h-3.5 w-3.5" />}
                          label="Кварталы"
                          active={layers.sectors}
                          onClick={() => setLayers((current) => ({ ...current, sectors: !current.sectors }))}
                        />
                        <LayerMenuItem
                          icon={<MapPinned className="h-3.5 w-3.5" />}
                          label="Захоронения"
                          active={layers.burials}
                          onClick={() => setLayers((current) => ({ ...current, burials: !current.burials }))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {fixedMarkers.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {fixedMarkers.some((marker) => marker.variant === 'next') && (
                    <LegendItem variant="next" label={request.operationType === 'ADD' ? 'Координаты из заявки' : 'Новые координаты'} />
                  )}
                  {fixedMarkers.some((marker) => marker.variant === 'current') && (
                    <LegendItem variant="current" label="Старые координаты" />
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[color:var(--ink-muted)]">Координаты в заявке отсутствуют.</p>
              )}
            </>
          ) : (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-5 py-10 text-center">
              <p className="text-sm font-semibold text-[color:var(--ink)]">Координаты захоронения не изменялись</p>
              <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
                Для заявок на редактирование карта показывается только при изменении широты или долготы.
              </p>
            </div>
          )}
        </section>

        <section className="surface-card mt-5 rounded-3xl p-6 sm:p-8">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[color:var(--ink)]">
            <ShieldCheck size={16} />
            Рассмотрение
          </h2>

          <div className="mt-4 space-y-3 text-sm text-[color:var(--ink-muted)]">
            <p className="inline-flex items-center gap-2">
              <span>Статус:</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(request.status)}`}>
                <StatusIcon size={13} />
                {statusLabels[request.status]}
              </span>
            </p>
            {request.status !== 'PENDING' && <p>Когда рассмотрена: {formatDateTime(request.reviewedAt)}</p>}
            {request.reviewedByUsername && (
              <div className="flex flex-wrap items-center gap-2">
                <span>Кем рассмотрена:</span>
                <span className="font-semibold text-[color:var(--ink)]">{request.reviewedByUsername}</span>
                {reviewerRolePresentation && (
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      reviewerRolePresentation.className,
                    ].join(' ')}
                  >
                    <reviewerRolePresentation.Icon className="h-3.5 w-3.5" />
                    {reviewerRolePresentation.label}
                  </span>
                )}
              </div>
            )}

            {request.status === 'REJECTED' && request.rejectionReason && (
              <div className="flex items-center gap-3 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-[#9e3024]">
                <button
                  type="button"
                  onClick={() => setShowRejectionReason((current) => !current)}
                  className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[#d04f3f]/35 bg-white/60 transition hover:bg-white"
                  aria-label="Показать причину отклонения"
                  title="Показать причину"
                >
                  <Info size={14} />
                </button>
                <p className="text-sm font-medium">{showRejectionReason ? request.rejectionReason : 'Причина'}</p>
              </div>
            )}
          </div>

          {canReview && (
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectReason('');
                  setShowRejectModal(true);
                }}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-full border border-[#d04f3f]/35 bg-[#d04f3f]/10 px-4 py-2.5 text-sm font-semibold text-[#9e3024] transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle size={15} />
                Отклонить
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 size={15} />
                Одобрить
              </button>
            </div>
          )}

          {error && <p className="mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}
        </section>

        {authorCanEdit && (
          <div className="mt-5 flex justify-end">
            <Link
              href={`/add/burial?mode=draft&requestId=${request.id}`}
              className="pill-action inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <PencilLine className="h-4 w-4" />
              Редактировать
            </Link>
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-[92] flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={() => setShowRejectModal(false)} />
          <section className="surface-card relative z-[93] w-full max-w-lg rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">Отклонить заявку</h3>
            <p className="mt-2 text-sm text-[color:var(--ink-muted)]">Укажите причину отказа. Она будет видна автору заявки.</p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="mt-4 min-h-36 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
              placeholder="Причина отклонения"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || processing}
                onClick={handleReject}
                className="rounded-full bg-[#d04f3f] px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отклонить
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-3 py-2.5">
      <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

function ValueBlock({
  fieldKey,
  label,
  value,
  accent,
}: {
  fieldKey: BurialChangeFieldKey;
  label: string;
  value: string;
  accent?: boolean;
}) {
  const isImageField = fieldKey === 'PHOTO_URL';
  const imageSource = isImageField && value !== 'Не указано' ? resolveImageSource(value) : null;

  if (isImageField) {
    return (
      <div className={`rounded-2xl px-4 py-3 ${accent ? 'bg-[color:var(--accent-soft)]/55' : 'bg-[color:var(--bg-elevated)]'}`}>
        <p className="text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">{label}</p>

        <div className="mt-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-3 py-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
            <Link2 className="h-3.5 w-3.5" />
            Ссылка на изображение
          </p>
          <p className="mt-1 whitespace-pre-wrap break-all text-sm leading-6 text-[color:var(--ink)]">{value}</p>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]">
          <p className="inline-flex items-center gap-1.5 px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
            <ImageIcon className="h-3.5 w-3.5" />
            Предпросмотр изображения
          </p>
          {imageSource ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSource.src}
                alt="Предпросмотр изображения в изменении"
                className="mt-2 block h-[570px] w-full object-cover object-center"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  if (imageSource.fallbackSrc && event.currentTarget.src !== imageSource.fallbackSrc) {
                    event.currentTarget.src = imageSource.fallbackSrc;
                  }
                }}
              />
            </>
          ) : (
            <div className="mt-2 flex h-[570px] items-center justify-center px-4 text-center text-sm leading-normal text-[color:var(--ink-muted)]">
              {value === 'Не указано' ? 'Изображение не указано' : 'Не удалось загрузить изображение'}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl px-4 py-3 ${accent ? 'bg-[color:var(--accent-soft)]/55' : 'bg-[color:var(--bg-elevated)]'}`}>
      <p className="text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

function LayerMenuItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'mt-1 inline-flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition first:mt-0',
        active
          ? 'bg-[color:var(--accent)] text-white'
          : 'bg-[color:var(--bg-elevated)] text-[color:var(--ink-muted)] hover:bg-[color:var(--accent-soft)]/60 hover:text-[color:var(--ink)]',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function LegendItem({ variant, label }: { variant: 'current' | 'next'; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-3 py-1.5 text-sm text-[color:var(--ink)]">
      <span
        className={[
          'inline-flex h-2.5 w-2.5 rounded-full',
          variant === 'next' ? 'bg-[#d04f3f]' : 'bg-[#2563eb]',
        ].join(' ')}
      />
      {label}
    </div>
  );
}
