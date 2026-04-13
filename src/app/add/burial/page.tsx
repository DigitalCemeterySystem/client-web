'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ImageIcon,
  Landmark,
  Layers,
  Link2,
  LocateFixed,
  Map as MapIcon,
  MapPinned,
  Save,
  SendHorizontal,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import BurialRequestLocationMap from '@/components/features/map/BurialRequestLocationMap';
import { useBurials } from '@/hooks/useBurials';
import { useCemeteries } from '@/hooks/useCemeteries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { changeRequestService } from '@/core/api/change-request.service';
import { burialService } from '@/core/api/burial.service';
import { resolveImageSource } from '@/core/utils/image-source';
import type { BurialChangeDraftRequest, BurialResponse, CemeteryResponse, ChangeRequestResponse, CoordinateDTO, SectorResponse } from '@/types';

type StepKey = 'coordinates' | 'details' | 'confirm';
type LayerVisibility = {
  boundary: boolean;
  sectors: boolean;
  burials: boolean;
};

type Point = {
  latitude: number;
  longitude: number;
};

type BurialForm = {
  fullName: string;
  birthDate: string;
  deathDate: string;
  photoUrl: string;
  biography: string;
};

type SaveNotice = {
  type: 'success' | 'error';
  message: string;
};

type PlacementResult = {
  cemetery: CemeteryResponse | null;
  sector: SectorResponse | null;
};

const DEFAULT_LAYERS: LayerVisibility = {
  boundary: true,
  sectors: true,
  burials: true,
};

const DEFAULT_FORM: BurialForm = {
  fullName: '',
  birthDate: '',
  deathDate: '',
  photoUrl: '',
  biography: '',
};

const COORDINATE_CHANGE_EPSILON = 0.00001;

function toEditableDate(value: string | null) {
  if (!value) return '';
  const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return matched?.[1] ?? '';
}

function normalizeFormValue(value: string) {
  return value.trim();
}

function pointsAreEqual(first: Point | null, second: Point | null) {
  if (!first && !second) return true;
  if (!first || !second) return false;
  return (
    Math.abs(first.latitude - second.latitude) < COORDINATE_CHANGE_EPSILON &&
    Math.abs(first.longitude - second.longitude) < COORDINATE_CHANGE_EPSILON
  );
}

function parseCoordinate(rawValue: string) {
  if (!rawValue.trim()) return null;
  const parsed = Number(rawValue.replace(',', '.'));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
}

function validatePoint(point: Point | null) {
  if (!point) return 'Сначала укажите координаты.';
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    return 'Координаты заполнены некорректно.';
  }
  if (point.latitude < -90 || point.latitude > 90) {
    return 'Широта должна быть в диапазоне от -90 до 90.';
  }
  if (point.longitude < -180 || point.longitude > 180) {
    return 'Долгота должна быть в диапазоне от -180 до 180.';
  }
  return null;
}

function validateDetails(form: BurialForm) {
  if (!form.fullName.trim()) return 'Поле ФИО обязательно для отправки заявки.';
  return null;
}

function pointInPolygon(point: Point, boundary: CoordinateDTO[]) {
  if (!boundary?.length) return false;

  let inside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].longitude;
    const yi = boundary[i].latitude;
    const xj = boundary[j].longitude;
    const yj = boundary[j].latitude;

    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function resolvePointPlacement(point: Point | null, cemeteries: CemeteryResponse[]): PlacementResult {
  if (!point) {
    return { cemetery: null, sector: null };
  }

  const cemetery = cemeteries.find((item) => pointInPolygon(point, item.boundary ?? [])) ?? null;
  if (!cemetery) {
    return { cemetery: null, sector: null };
  }

  const sector = (cemetery.sectors ?? []).find((item) => pointInPolygon(point, item.boundary ?? [])) ?? null;
  return { cemetery, sector };
}

function formatDateForSummary(value: string) {
  if (!value) return 'Не указана';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function getFieldAfterValue(request: ChangeRequestResponse, fieldKey: string) {
  return request.fields.find((field) => field.fieldKey === fieldKey)?.afterValue ?? null;
}

function parseNumberOrNull(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function getPointFromRequest(request: ChangeRequestResponse, fallbackPoint: Point | null): Point | null {
  const fieldLatitude = parseNumberOrNull(getFieldAfterValue(request, 'LATITUDE'));
  const fieldLongitude = parseNumberOrNull(getFieldAfterValue(request, 'LONGITUDE'));

  if (fieldLatitude != null && fieldLongitude != null) {
    return {
      latitude: Number(fieldLatitude.toFixed(6)),
      longitude: Number(fieldLongitude.toFixed(6)),
    };
  }

  if (request.previewLatitude != null && request.previewLongitude != null) {
    return {
      latitude: Number(request.previewLatitude.toFixed(6)),
      longitude: Number(request.previewLongitude.toFixed(6)),
    };
  }

  return fallbackPoint;
}

function getFormFromRequest(request: ChangeRequestResponse, sourceBurial: BurialResponse | null): BurialForm {
  return {
    fullName: getFieldAfterValue(request, 'FULL_NAME') ?? sourceBurial?.fullName ?? request.burialLabel ?? '',
    birthDate: toEditableDate(getFieldAfterValue(request, 'BIRTH_DATE') ?? sourceBurial?.birthDate ?? ''),
    deathDate: toEditableDate(getFieldAfterValue(request, 'DEATH_DATE') ?? sourceBurial?.deathDate ?? ''),
    photoUrl: getFieldAfterValue(request, 'PHOTO_URL') ?? sourceBurial?.photoUrl ?? '',
    biography: getFieldAfterValue(request, 'BIOGRAPHY') ?? sourceBurial?.biography ?? '',
  };
}

export default function AddBurialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useCurrentUser();
  const { cemeteries, loading: cemeteriesLoading } = useCemeteries();
  const { burials, loading: burialsLoading } = useBurials();
  const requestedMode = searchParams.get('mode');
  const requestedBurialId = Number(searchParams.get('burialId'));
  const requestedRequestId = Number(searchParams.get('requestId'));
  const isEditMode = requestedMode === 'edit' && Number.isFinite(requestedBurialId);
  const isDraftEditMode = requestedMode === 'draft' && Number.isFinite(requestedRequestId);
  const invalidEditParams = requestedMode === 'edit' && !Number.isFinite(requestedBurialId);
  const invalidDraftParams = requestedMode === 'draft' && !Number.isFinite(requestedRequestId);

  const [activeStep, setActiveStep] = useState<StepKey>('coordinates');
  const [selectedCemeteryId, setSelectedCemeteryId] = useState<number | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [cemeteryFilterOpen, setCemeteryFilterOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [baselinePoint, setBaselinePoint] = useState<Point | null>(null);
  const [resetBaselinePoint, setResetBaselinePoint] = useState<Point | null>(null);
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [form, setForm] = useState<BurialForm>(DEFAULT_FORM);
  const [baselineForm, setBaselineForm] = useState<BurialForm>(DEFAULT_FORM);
  const [resetBaselineForm, setResetBaselineForm] = useState<BurialForm>(DEFAULT_FORM);
  const [coordinateNotice, setCoordinateNotice] = useState<SaveNotice | null>(null);
  const [detailsNotice, setDetailsNotice] = useState<SaveNotice | null>(null);
  const [confirmNotice, setConfirmNotice] = useState<SaveNotice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<ChangeRequestResponse | null>(null);
  const [draftRequest, setDraftRequest] = useState<ChangeRequestResponse | null>(null);
  const [draftRequestLoading, setDraftRequestLoading] = useState(false);
  const [draftRequestError, setDraftRequestError] = useState<string | null>(null);
  const [sourceBurial, setSourceBurial] = useState<BurialResponse | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState('');
  const coordinatesStepRef = useRef<HTMLElement | null>(null);
  const detailsStepRef = useRef<HTMLElement | null>(null);
  const confirmStepRef = useRef<HTMLElement | null>(null);

  const imageSource = useMemo(() => resolveImageSource(form.photoUrl), [form.photoUrl]);
  const placement = useMemo(() => resolvePointPlacement(point, cemeteries), [point, cemeteries]);
  const selectedBurials = useMemo(() => {
    if (selectedCemeteryId == null) return burials;
    return burials.filter((burial) => burial.cemeteryId === selectedCemeteryId);
  }, [burials, selectedCemeteryId]);

  useEffect(() => {
    if (!isDraftEditMode) {
      setDraftRequest(null);
      setDraftRequestLoading(false);
      setDraftRequestError(invalidDraftParams ? 'Некорректный номер заявки для редактирования.' : null);
      return;
    }

    if (userLoading || !user) return;

    let mounted = true;
    setDraftRequestLoading(true);
    setDraftRequestError(null);

    changeRequestService
      .getMy()
      .then((requests) => {
        if (!mounted) return;
        const found = requests.find((request) => request.id === requestedRequestId) ?? null;

        if (!found) {
          setDraftRequest(null);
          setDraftRequestError('Не удалось найти вашу заявку для редактирования.');
          return;
        }

        if (found.status !== 'PENDING') {
          setDraftRequest(found);
          setDraftRequestError('Редактирование доступно только для заявок со статусом «На рассмотрении».');
          return;
        }

        setDraftRequest(found);
        setDraftRequestError(null);
      })
      .catch((requestError) => {
        if (!mounted) return;
        setDraftRequest(null);
        setDraftRequestError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить заявку для редактирования.');
      })
      .finally(() => {
        if (mounted) {
          setDraftRequestLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [invalidDraftParams, isDraftEditMode, requestedRequestId, user, userLoading]);

  useEffect(() => {
    const shouldLoadBurialById =
      (isEditMode && Number.isFinite(requestedBurialId)) ||
      (isDraftEditMode && draftRequest?.operationType === 'EDIT' && !!draftRequest.burialId);

    if (!shouldLoadBurialById) {
      setSourceBurial(null);
      setSourceLoading(false);
      if (invalidEditParams) {
        setSourceError('Некорректный идентификатор захоронения для редактирования.');
      } else {
        setSourceError(null);
      }
      return;
    }

    const burialId = isEditMode ? requestedBurialId : Number(draftRequest?.burialId);
    if (!Number.isFinite(burialId)) {
      setSourceBurial(null);
      setSourceLoading(false);
      setSourceError('Некорректный идентификатор захоронения для редактирования.');
      return;
    }

    let mounted = true;
    setSourceLoading(true);
    setSourceError(null);

    burialService
      .getById(burialId)
      .then((burial) => {
        if (!mounted) return;
        setSourceBurial(burial);
        setSourceError(null);
      })
      .catch((requestError) => {
        if (!mounted) return;
        setSourceBurial(null);
        setSourceError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить исходную карточку захоронения.');
      })
      .finally(() => {
        if (mounted) {
          setSourceLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [draftRequest?.burialId, draftRequest?.operationType, invalidEditParams, isDraftEditMode, isEditMode, requestedBurialId]);

  useEffect(() => {
    if (isEditMode && sourceBurial) {
      const initialPoint =
        sourceBurial.latitude != null && sourceBurial.longitude != null
          ? {
              latitude: Number(sourceBurial.latitude.toFixed(6)),
              longitude: Number(sourceBurial.longitude.toFixed(6)),
            }
          : null;

      const initialForm: BurialForm = {
        fullName: sourceBurial.fullName ?? '',
        birthDate: toEditableDate(sourceBurial.birthDate),
        deathDate: toEditableDate(sourceBurial.deathDate),
        photoUrl: sourceBurial.photoUrl ?? '',
        biography: sourceBurial.biography ?? '',
      };

      setPoint(initialPoint);
      setBaselinePoint(initialPoint);
      setResetBaselinePoint(initialPoint);
      setForm(initialForm);
      setBaselineForm(initialForm);
      setResetBaselineForm(initialForm);
      setSelectedCemeteryId(sourceBurial.cemeteryId ?? null);
      setActiveStep('coordinates');
      setCoordinateNotice(null);
      setDetailsNotice(null);
      setConfirmNotice(null);
      setCreatedRequest(null);
      return;
    }

    if (!isDraftEditMode || !draftRequest) return;
    if (draftRequest.operationType === 'EDIT' && !sourceBurial) return;

    const sourcePoint =
      sourceBurial?.latitude != null && sourceBurial?.longitude != null
        ? {
            latitude: Number(sourceBurial.latitude.toFixed(6)),
            longitude: Number(sourceBurial.longitude.toFixed(6)),
          }
        : null;

    const initialPoint = getPointFromRequest(draftRequest, sourcePoint);
    const initialForm = getFormFromRequest(draftRequest, sourceBurial);

    setPoint(initialPoint);
    setBaselinePoint(initialPoint);
    setResetBaselinePoint(initialPoint);
    setForm(initialForm);
    setBaselineForm(initialForm);
    setResetBaselineForm(initialForm);
    setSelectedCemeteryId(sourceBurial?.cemeteryId ?? null);
    setActiveStep('coordinates');
    setCoordinateNotice(null);
    setDetailsNotice(null);
    setConfirmNotice(null);
    setCreatedRequest(null);
  }, [draftRequest, isDraftEditMode, isEditMode, sourceBurial]);

  useEffect(() => {
    if (isEditMode || isDraftEditMode) return;

    setPoint(null);
    setBaselinePoint(null);
    setResetBaselinePoint(null);
    setForm(DEFAULT_FORM);
    setBaselineForm(DEFAULT_FORM);
    setResetBaselineForm(DEFAULT_FORM);
    setSelectedCemeteryId(null);
    setActiveStep('coordinates');
    setCoordinateNotice(null);
    setDetailsNotice(null);
    setConfirmNotice(null);
    setCreatedRequest(null);
  }, [isDraftEditMode, isEditMode]);

  useEffect(() => {
    if (selectedCemeteryId == null) return;
    if (cemeteries.some((cemetery) => cemetery.id === selectedCemeteryId)) return;
    setSelectedCemeteryId(null);
  }, [cemeteries, selectedCemeteryId]);

  useEffect(() => {
    if (!point) {
      setLatitudeInput('');
      setLongitudeInput('');
      return;
    }
    setLatitudeInput(point.latitude.toFixed(6));
    setLongitudeInput(point.longitude.toFixed(6));
  }, [point]);

  useEffect(() => {
    setPreviewSrc(imageSource?.src ?? '');
  }, [imageSource?.src, imageSource?.fallbackSrc]);

  useEffect(() => {
    if (activeStep === 'coordinates') return;
    setLayersMenuOpen(false);
    setCemeteryFilterOpen(false);
  }, [activeStep]);

  function scrollToStep(step: StepKey) {
    const stepRefs: Record<StepKey, { current: HTMLElement | null }> = {
      coordinates: coordinatesStepRef,
      details: detailsStepRef,
      confirm: confirmStepRef,
    };
    const section = stepRefs[step].current;
    if (!section) return;
    const headerOffset = 86;
    const top = window.scrollY + section.getBoundingClientRect().top - headerOffset;
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: 'smooth',
    });
  }

  function activateStep(step: StepKey) {
    setActiveStep(step);
    window.setTimeout(() => scrollToStep(step), 30);
  }

  function handleBackToPreviousPage() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    if (isDraftEditMode) {
      if (draftRequest) {
        router.push(`/profile/requests/${draftRequest.id}?scope=my`);
      } else {
        router.push('/profile/requests');
      }
      return;
    }

    if (isEditMode) {
      router.push(`/burials/${requestedBurialId}`);
      return;
    }

    router.push('/cemeteries');
  }

  function setStepNotice(step: StepKey, notice: SaveNotice | null) {
    if (step === 'coordinates') setCoordinateNotice(notice);
    if (step === 'details') setDetailsNotice(notice);
    if (step === 'confirm') setConfirmNotice(notice);
  }

  function clearNotices() {
    setCoordinateNotice(null);
    setDetailsNotice(null);
    setConfirmNotice(null);
  }

  function validateCoordinatesStep() {
    const pointError = validatePoint(point);
    if (pointError) return pointError;
    const allowOutOfBoundaryValidation =
      (isEditMode || (isDraftEditMode && draftRequest?.operationType === 'EDIT')) &&
      pointsAreEqual(point, baselinePoint);

    if (allowOutOfBoundaryValidation) return null;
    if (!placement.cemetery) return 'Выбранная точка не попадает в границы ни одного кладбища.';
    return null;
  }

  function handleLatitudeInputChange(value: string) {
    setLatitudeInput(value);
    setStepNotice('coordinates', null);

    const latitude = parseCoordinate(value);
    const longitude = parseCoordinate(longitudeInput);
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return;
    }

    setPoint({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  }

  function handleLongitudeInputChange(value: string) {
    setLongitudeInput(value);
    setStepNotice('coordinates', null);

    const latitude = parseCoordinate(latitudeInput);
    const longitude = parseCoordinate(value);
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return;
    }

    setPoint({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  }

  function handleCoordinatesNext() {
    const error = validateCoordinatesStep();
    if (error) {
      setStepNotice('coordinates', { type: 'error', message: error });
      return;
    }

    setStepNotice('coordinates', { type: 'success', message: 'Координаты определены корректно.' });
    activateStep('details');
  }

  function handleDetailsNext() {
    const detailsError = validateDetails(form);
    if (detailsError) {
      setStepNotice('details', { type: 'error', message: detailsError });
      return;
    }

    setStepNotice('details', { type: 'success', message: 'Карточка заполнена корректно.' });
    activateStep('confirm');
  }

  function resetCoordinatesToBaseline() {
    setPoint(resetBaselinePoint);
    setStepNotice('coordinates', { type: 'success', message: 'Координаты возвращены к исходным значениям.' });
  }

  function resetDetailsToBaseline() {
    setForm(resetBaselineForm);
    setStepNotice('details', { type: 'success', message: 'Поля карточки возвращены к исходным значениям.' });
  }

  function buildEditPayload(): BurialChangeDraftRequest {
    const payload: BurialChangeDraftRequest = {};

    const nextFullName = normalizeFormValue(form.fullName);
    const originalFullName = normalizeFormValue(baselineForm.fullName);
    if (nextFullName !== originalFullName) {
      payload.fullName = nextFullName;
    }

    if (form.birthDate !== baselineForm.birthDate) {
      if (form.birthDate) {
        payload.birthDate = form.birthDate;
      } else if (baselineForm.birthDate) {
        payload.clearBirthDate = true;
      }
    }

    if (form.deathDate !== baselineForm.deathDate) {
      if (form.deathDate) {
        payload.deathDate = form.deathDate;
      } else if (baselineForm.deathDate) {
        payload.clearDeathDate = true;
      }
    }

    const nextPhotoUrl = normalizeFormValue(form.photoUrl);
    const originalPhotoUrl = normalizeFormValue(baselineForm.photoUrl);
    if (nextPhotoUrl !== originalPhotoUrl) {
      if (nextPhotoUrl) {
        payload.photoUrl = nextPhotoUrl;
      } else if (originalPhotoUrl) {
        payload.clearPhotoUrl = true;
      }
    }

    const nextBiography = normalizeFormValue(form.biography);
    const originalBiography = normalizeFormValue(baselineForm.biography);
    if (nextBiography !== originalBiography) {
      if (nextBiography) {
        payload.biography = nextBiography;
      } else if (originalBiography) {
        payload.clearBiography = true;
      }
    }

    if (!pointsAreEqual(point, baselinePoint)) {
      if (!point) {
        throw new Error('Координаты не выбраны.');
      }
      payload.latitude = point.latitude;
      payload.longitude = point.longitude;
    }

    return payload;
  }

  async function submitRequest() {
    const coordinatesError = validateCoordinatesStep();
    if (coordinatesError) {
      setStepNotice('confirm', { type: 'error', message: coordinatesError });
      activateStep('coordinates');
      return;
    }

    const detailsError = validateDetails(form);
    if (detailsError) {
      setStepNotice('confirm', { type: 'error', message: detailsError });
      activateStep('details');
      return;
    }
    if (!point) {
      setStepNotice('confirm', { type: 'error', message: 'Не удалось определить координаты.' });
      return;
    }

    let payload: BurialChangeDraftRequest;
    const useEditPayload = isEditMode || (isDraftEditMode && draftRequest?.operationType === 'EDIT');
    try {
      payload = useEditPayload
        ? buildEditPayload()
        : {
            fullName: form.fullName.trim(),
            birthDate: form.birthDate || undefined,
            deathDate: form.deathDate || undefined,
            photoUrl: form.photoUrl.trim() || undefined,
            biography: form.biography.trim() || undefined,
            latitude: point.latitude,
            longitude: point.longitude,
          };
    } catch (requestError) {
      setStepNotice('confirm', {
        type: 'error',
        message: requestError instanceof Error ? requestError.message : 'Не удалось подготовить изменения для отправки.',
      });
      return;
    }

    if (useEditPayload && Object.keys(payload).length === 0) {
      setStepNotice('confirm', {
        type: 'error',
        message: 'Нет изменений. Измените хотя бы одно поле перед отправкой заявки.',
      });
      return;
    }

    setSubmitting(true);
    clearNotices();

    try {
      let request: ChangeRequestResponse;
      if (isDraftEditMode && draftRequest) {
        request = await changeRequestService.updateOwnDraft(draftRequest.id, payload);
      } else if (isEditMode && sourceBurial) {
        request = await changeRequestService.submitBurialEdit(sourceBurial.id, payload);
      } else {
        request = await changeRequestService.createBurialAddition(payload);
      }
      setCreatedRequest(request);
    } catch (requestError) {
      setStepNotice('confirm', {
        type: 'error',
        message: requestError instanceof Error ? requestError.message : 'Не удалось сохранить заявку.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const stepStates: Array<{ key: StepKey; label: string; icon: ReactNode }> = [
    { key: 'coordinates', label: 'Координаты', icon: <MapPinned className="h-4 w-4" /> },
    { key: 'details', label: 'Карточка', icon: <UserRound className="h-4 w-4" /> },
    { key: 'confirm', label: 'Подтверждение', icon: <ShieldCheck className="h-4 w-4" /> },
  ];
  const usesEditScenario = isEditMode || (isDraftEditMode && draftRequest?.operationType === 'EDIT');
  const pageTitle = usesEditScenario ? 'Редактирование захоронения' : 'Добавление захоронения';
  const pageTag = isDraftEditMode ? 'Редактирование заявки' : 'Новая заявка';
  const step1Title = usesEditScenario ? 'Шаг 1. Редактирование координат' : 'Шаг 1. Добавление координат';
  const step2Title = usesEditScenario ? 'Шаг 2. Редактирование карточки захоронения' : 'Шаг 2. Заполнение карточки захоронения';
  const loadingTitle = isDraftEditMode
    ? 'Проверяем доступ к странице редактирования заявки...'
    : usesEditScenario
      ? 'Проверяем доступ к странице редактирования...'
      : 'Проверяем доступ к странице добавления...';
  const successSummary = isDraftEditMode
    ? 'редактирование заявки'
    : usesEditScenario
      ? 'изменение данных захоронения'
      : 'добавление нового захоронения';
  const summaryCemetery = placement.cemetery?.name ?? (usesEditScenario ? sourceBurial?.cemeteryName ?? 'Не указано' : 'Не определено');
  const summarySector = placement.sector?.name ?? (usesEditScenario ? sourceBurial?.sectorName ?? 'Не указан' : 'Не определен');

  if (userLoading || draftRequestLoading || ((isEditMode || (isDraftEditMode && draftRequest?.operationType === 'EDIT')) && sourceLoading)) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
        <p className="text-sm text-[color:var(--ink-muted)]">{loadingTitle}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="surface-card w-full rounded-3xl p-8 sm:p-10">
          <h1 className="display-font text-4xl text-[color:var(--ink)] sm:text-5xl">Нужна авторизация</h1>
          <p className="mt-4 text-base text-[color:var(--ink-muted)]">Авторизуйтесь, чтобы получить доступ к редактированию и отправке заявок.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/cemeteries" className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)]">
              Отмена
            </Link>
            <Link href="/login" className="pill-action px-5 py-2.5 text-sm font-semibold">
              Войти
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (
    invalidDraftParams ||
    invalidEditParams ||
    (isDraftEditMode && (!draftRequest || !!draftRequestError)) ||
    ((isEditMode || (isDraftEditMode && draftRequest?.operationType === 'EDIT')) && (sourceError || !sourceBurial))
  ) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="surface-card w-full rounded-3xl p-8 sm:p-10">
          <h1 className="display-font text-4xl text-[color:var(--ink)] sm:text-5xl">Форма редактирования недоступна</h1>
          <p className="mt-4 text-base text-[color:var(--ink-muted)]">
            {draftRequestError ?? sourceError ?? 'Не удалось определить карточку захоронения для редактирования.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleBackToPreviousPage}
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)]"
            >
              Назад
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (createdRequest) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <section className="surface-card rounded-3xl p-8">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">{isDraftEditMode ? 'Изменения сохранены' : 'Заявка отправлена'}</h1>
          </div>
          <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
            {isDraftEditMode
              ? `Заявка #${createdRequest.id} успешно отредактирована.`
              : `Заявка #${createdRequest.id} на ${successSummary} принята системой и отправлена на модерацию.`}
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push(`/profile/requests?requestId=${createdRequest.id}`)}
              className="pill-action px-5 py-2.5 text-sm font-semibold"
            >
              Перейти к заявке в «Мои заявки»
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={handleBackToPreviousPage}
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:text-[color:var(--ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      <section className="surface-card mt-5 rounded-3xl p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">{pageTag}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)] sm:text-4xl">{pageTitle}</h1>
        <p className="mt-3 text-sm text-[color:var(--ink-muted)]">Выполните следующие три шага:</p>

        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
          {stepStates.map((step) => (
            <StepProgressChip
              key={step.key}
              label={step.label}
              icon={step.icon}
              active={activeStep === step.key}
              inactive={!activeStep || activeStep !== step.key}
              showConnector={step.key !== 'confirm'}
            />
          ))}
        </div>

        <div className="mt-6 space-y-5">
          <section
            ref={coordinatesStepRef}
            className={[
              'rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-5 transition',
              activeStep === 'coordinates' ? '' : 'pointer-events-none opacity-45',
            ].join(' ')}
          >
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[color:var(--ink)]">
              <MapPinned className="h-5 w-5 text-[color:var(--accent)]" />
              {step1Title}
            </h2>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    <LocateFixed className="h-3.5 w-3.5" />
                    Широта
                  </span>
                  <input
                    value={latitudeInput}
                    onChange={(event) => handleLatitudeInputChange(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="55.012345"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    <LocateFixed className="h-3.5 w-3.5" />
                    Долгота
                  </span>
                  <input
                    value={longitudeInput}
                    onChange={(event) => handleLongitudeInputChange(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="82.987654"
                  />
                </label>

                <SummaryItem icon={<Landmark className="h-3.5 w-3.5" />} label="Кладбище точки" value={placement.cemetery?.name ?? 'Не определено'} />
                <SummaryItem icon={<Layers className="h-3.5 w-3.5" />} label="Квартал точки" value={placement.sector?.name ?? 'Не определен'} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-[color:var(--line)]">
                <div className="relative h-[420px]">
                  <BurialRequestLocationMap
                    cemeteries={cemeteries}
                    burials={selectedBurials}
                    selectedCemeteryId={selectedCemeteryId}
                    point={point}
                    showBoundary={layers.boundary}
                    showSectors={layers.sectors}
                    showBurials={layers.burials}
                    interactive={activeStep === 'coordinates'}
                    onPointChange={(nextPoint) => {
                      if (point && pointsAreEqual(point, nextPoint)) {
                        return;
                      }
                      setPoint(nextPoint);
                      setCoordinateNotice(null);
                    }}
                  />

                  <div className={['pointer-events-none absolute inset-0 z-20', activeStep === 'coordinates' ? '' : 'opacity-70'].join(' ')}>
                    <div className={['absolute left-3 top-3 w-[min(80vw,300px)]', activeStep === 'coordinates' ? 'pointer-events-auto' : 'pointer-events-none'].join(' ')}>
                      <button
                        type="button"
                        disabled={activeStep !== 'coordinates'}
                        onClick={() => setCemeteryFilterOpen((current) => !current)}
                        className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]/95 px-3 py-2 text-sm font-semibold text-[color:var(--ink)] backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-[color:var(--ink-muted)]" />
                          Фильтр кладбищ
                        </span>
                        <ChevronDown className={`h-4 w-4 text-[color:var(--ink-muted)] transition ${cemeteryFilterOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {cemeteryFilterOpen && (
                        <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]/95 p-3 backdrop-blur-sm">
                          <label className="block">
                            <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                              <Landmark className="h-3.5 w-3.5" />
                              Кладбище
                            </span>
                            <select
                              value={selectedCemeteryId ?? ''}
                              onChange={(event) => {
                                const next = event.target.value ? Number(event.target.value) : null;
                                setSelectedCemeteryId(next);
                                setCoordinateNotice(null);
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
                          </label>
                        </div>
                      )}
                    </div>

                    <div className={['absolute right-3 top-3 w-[188px]', activeStep === 'coordinates' ? 'pointer-events-auto' : 'pointer-events-none'].join(' ')}>
                      <button
                        type="button"
                        disabled={activeStep !== 'coordinates'}
                        onClick={() => setLayersMenuOpen((current) => !current)}
                        className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)]/95 px-3 py-2 text-sm font-semibold text-[color:var(--ink)] backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-65"
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
              </div>
            </div>

            <StepStatusMessage notice={coordinateNotice} />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                {(isEditMode || isDraftEditMode) && (
                  <button
                    type="button"
                    onClick={resetCoordinatesToBaseline}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d04f3f] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#d04f3f] transition hover:bg-[#d04f3f]/10"
                  >
                    <X className="h-4 w-4" />
                    Отмена
                  </button>
                )}
              </div>
              <button type="button" onClick={handleCoordinatesNext} className="pill-action inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                <ArrowDown className="h-4 w-4" />
                Далее
              </button>
            </div>
          </section>

          <section
            ref={detailsStepRef}
            className={[
              'rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-5 transition',
              activeStep === 'details' ? '' : 'pointer-events-none opacity-45',
            ].join(' ')}
          >
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[color:var(--ink)]">
              <UserRound className="h-5 w-5 text-[color:var(--accent)]" />
              {step2Title}
            </h2>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    <Link2 className="h-3.5 w-3.5" />
                    Ссылка на изображение (необязательно)
                  </span>
                  <input
                    value={form.photoUrl}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, photoUrl: event.target.value }));
                      setDetailsNotice(null);
                    }}
                    className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="https://..."
                  />
                </label>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Предпросмотр изображения
                </p>
                <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)]">
                  {previewSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewSrc}
                      alt="Предпросмотр захоронения"
                      className="block h-[570px] w-full object-cover object-center"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        if (imageSource?.fallbackSrc && previewSrc !== imageSource.fallbackSrc) {
                          setPreviewSrc(imageSource.fallbackSrc);
                          return;
                        }
                        setPreviewSrc('');
                      }}
                    />
                  ) : (
                    <div className="flex h-[570px] items-center justify-center px-4 text-center text-sm leading-normal text-[color:var(--ink-muted)]">
                      Изображение не указано
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    <UserRound className="h-3.5 w-3.5" />
                    ФИО (обязательно)
                  </span>
                  <input
                    value={form.fullName}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, fullName: event.target.value }));
                      setDetailsNotice(null);
                    }}
                    className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="ФИО"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Дата рождения (необязательно)
                    </span>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, birthDate: event.target.value }));
                        setDetailsNotice(null);
                      }}
                      className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Дата смерти (необязательно)
                    </span>
                    <input
                      type="date"
                      value={form.deathDate}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, deathDate: event.target.value }));
                        setDetailsNotice(null);
                      }}
                      className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                    <BookOpen className="h-3.5 w-3.5" />
                    Биография (необязательно)
                  </span>
                  <textarea
                    value={form.biography}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, biography: event.target.value }));
                      setDetailsNotice(null);
                    }}
                    className="min-h-[360px] w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="Биография"
                  />
                </label>
              </div>
            </div>

            <StepStatusMessage notice={detailsNotice} />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                {(isEditMode || isDraftEditMode) && (
                  <button
                    type="button"
                    onClick={resetDetailsToBaseline}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d04f3f] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#d04f3f] transition hover:bg-[#d04f3f]/10"
                  >
                    <X className="h-4 w-4" />
                    Отмена
                  </button>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => activateStep('coordinates')}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)]"
                >
                  <ArrowUp className="h-4 w-4" />
                  Назад
                </button>
                <button type="button" onClick={handleDetailsNext} className="pill-action inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                  <ArrowDown className="h-4 w-4" />
                  Далее
                </button>
              </div>
            </div>
          </section>

          <section
            ref={confirmStepRef}
            className={[
              'rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-5 transition',
              activeStep === 'confirm' ? '' : 'pointer-events-none opacity-45',
            ].join(' ')}
          >
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[color:var(--ink)]">
              <ShieldCheck className="h-5 w-5 text-[color:var(--accent)]" />
              Шаг 3. Подтверждение
            </h2>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="min-w-0 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryItem icon={<LocateFixed className="h-3.5 w-3.5" />} label="Широта" value={point ? point.latitude.toFixed(6) : 'Не указана'} />
                  <SummaryItem icon={<LocateFixed className="h-3.5 w-3.5" />} label="Долгота" value={point ? point.longitude.toFixed(6) : 'Не указана'} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryItem icon={<Landmark className="h-3.5 w-3.5" />} label="Кладбище" value={summaryCemetery} />
                  <SummaryItem icon={<Layers className="h-3.5 w-3.5" />} label="Квартал" value={summarySector} />
                </div>
                <SummaryItem icon={<UserRound className="h-3.5 w-3.5" />} label="ФИО" value={form.fullName.trim() || 'Не указана'} />
                <SummaryItem icon={<CalendarDays className="h-3.5 w-3.5" />} label="Дата рождения" value={formatDateForSummary(form.birthDate)} />
                <SummaryItem icon={<CalendarDays className="h-3.5 w-3.5" />} label="Дата смерти" value={formatDateForSummary(form.deathDate)} />
                <SummaryItem icon={<BookOpen className="h-3.5 w-3.5" />} label="Биография" value={form.biography.trim() || 'Не указана'} multiline />
                <SummaryItem icon={<Link2 className="h-3.5 w-3.5" />} label="Ссылка на изображение" value={form.photoUrl.trim() || 'Не указана'} multiline />
              </div>

              <div className="min-w-0">
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Предпросмотр изображения
                </p>
                <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)]">
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewSrc} alt="Предпросмотр захоронения" className="block h-[570px] w-full object-cover object-center" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-[570px] items-center justify-center px-4 text-center text-sm leading-normal text-[color:var(--ink-muted)]">
                    Изображение не указано
                  </div>
                )}
              </div>
              </div>
            </div>

            <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
              {isDraftEditMode
                ? 'Вы можете вернуться к предыдущим этапам для исправлений или сохранить изменения в заявке.'
                : 'Вы можете вернуться к предыдущим этапам для исправлений или отправить заявку на модерацию.'}
            </p>

            <StepStatusMessage notice={confirmNotice} />

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => activateStep('details')}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)]"
              >
                <ArrowUp className="h-4 w-4" />
                Назад
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={submitting}
                className="pill-action inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDraftEditMode ? <Save className="h-4 w-4" /> : <SendHorizontal className="h-4 w-4" />}
                {submitting
                  ? isDraftEditMode
                    ? 'Сохраняем...'
                    : 'Отправляем...'
                  : isDraftEditMode
                    ? 'Сохранить изменения'
                    : 'Отправить заявку'}
              </button>
            </div>
          </section>
        </div>

        {(cemeteriesLoading || burialsLoading) && (
          <p className="mt-5 text-sm text-[color:var(--ink-muted)]">Загружаем слои карты и список захоронений...</p>
        )}
      </section>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  multiline,
  icon,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-3">
      <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
        {icon}
        {label}
      </p>
      <p className={['mt-1 min-w-0 text-sm font-medium text-[color:var(--ink)]', multiline ? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-6' : ''].join(' ')}>{value}</p>
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

function StepProgressChip({
  label,
  icon,
  active,
  inactive,
  showConnector,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  inactive: boolean;
  showConnector: boolean;
}) {
  return (
    <>
      <div
        className={[
          'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition',
          active
            ? 'bg-emerald-600 text-white'
            : inactive
              ? 'border border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)]'
              : 'bg-[color:var(--accent)] text-white',
        ].join(' ')}
      >
        <span
          className={[
            'inline-flex h-7 w-7 items-center justify-center rounded-full transition',
            active ? 'bg-white/16 shadow-[0_0_0_4px_rgba(16,185,129,0.24),0_0_16px_rgba(16,185,129,0.45)]' : 'bg-black/10',
          ].join(' ')}
        >
          {icon}
        </span>
        {label}
      </div>
      {showConnector && <div className="h-0 w-10 border-t-2 border-dashed border-[color:var(--line)]" />}
    </>
  );
}

function StepStatusMessage({ notice }: { notice: SaveNotice | null }) {
  if (!notice) return null;

  return (
    <p
      className={[
        'mt-4 rounded-2xl px-4 py-3 text-sm',
        notice.type === 'success' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-[#d04f3f]/10 text-[#9e3024]',
      ].join(' ')}
    >
      {notice.message}
    </p>
  );
}

