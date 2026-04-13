'use client';

import { useEffect, useMemo, useState } from 'react';
import { changeRequestService } from '@/core/api/change-request.service';
import { burialService } from '@/core/api/burial.service';
import LocationPickerMap from '@/components/features/map/LocationPickerMap';
import type { BurialChangeDraftRequest, BurialResponse, CemeteryResponse, ChangeRequestResponse } from '@/types';

type EditChangeRequestModalProps = {
  open: boolean;
  request: ChangeRequestResponse | null;
  cemeteries: CemeteryResponse[];
  onClose: () => void;
  onUpdated: (request: ChangeRequestResponse) => void;
};

function getFieldAfter(request: ChangeRequestResponse, fieldKey: string) {
  return request.fields.find((field) => field.fieldKey === fieldKey)?.afterValue ?? null;
}

function normalizeDate(value: string | null) {
  if (!value) return '';
  const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return matched?.[1] ?? value;
}

export default function EditChangeRequestModal({
  open,
  request,
  cemeteries,
  onClose,
  onUpdated,
}: EditChangeRequestModalProps) {
  const [burialBase, setBurialBase] = useState<BurialResponse | null>(null);
  const [loadingBase, setLoadingBase] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    birthDate: '',
    deathDate: '',
    photoUrl: '',
    biography: '',
    latitude: '',
    longitude: '',
  });
  const [coordinateMode, setCoordinateMode] = useState<'manual' | 'map'>('manual');
  const [mapPoint, setMapPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !request) return;

    let active = true;
    setError('');
    setPending(false);
    setCoordinateMode('manual');

    if (request.operationType === 'EDIT' && request.burialId) {
      setLoadingBase(true);
      burialService
        .getById(request.burialId)
        .then((burial) => {
          if (!active) return;
          setBurialBase(burial);
        })
        .catch(() => {
          if (!active) return;
          setBurialBase(null);
        })
        .finally(() => {
          if (active) {
            setLoadingBase(false);
          }
        });
    } else {
      setBurialBase(null);
      setLoadingBase(false);
    }

    return () => {
      active = false;
    };
  }, [open, request]);

  const initialValues = useMemo(() => {
    if (!request) {
      return {
        fullName: '',
        birthDate: '',
        deathDate: '',
        photoUrl: '',
        biography: '',
        latitude: '',
        longitude: '',
      };
    }

    const base = burialBase;
    const latitudeAfter = getFieldAfter(request, 'LATITUDE');
    const longitudeAfter = getFieldAfter(request, 'LONGITUDE');

    return {
      fullName: getFieldAfter(request, 'FULL_NAME') ?? base?.fullName ?? request.burialLabel ?? '',
      birthDate: normalizeDate(getFieldAfter(request, 'BIRTH_DATE') ?? base?.birthDate ?? ''),
      deathDate: normalizeDate(getFieldAfter(request, 'DEATH_DATE') ?? base?.deathDate ?? ''),
      photoUrl: getFieldAfter(request, 'PHOTO_URL') ?? base?.photoUrl ?? '',
      biography: getFieldAfter(request, 'BIOGRAPHY') ?? base?.biography ?? '',
      latitude: latitudeAfter ?? (base?.latitude != null ? base.latitude.toFixed(6) : request.previewLatitude?.toFixed(6) ?? ''),
      longitude: longitudeAfter ?? (base?.longitude != null ? base.longitude.toFixed(6) : request.previewLongitude?.toFixed(6) ?? ''),
    };
  }, [burialBase, request]);

  useEffect(() => {
    if (!open || !request) return;
    setForm(initialValues);
    setMapPoint(
      initialValues.latitude && initialValues.longitude
        ? { latitude: Number(initialValues.latitude), longitude: Number(initialValues.longitude) }
        : null
    );
  }, [initialValues, open, request]);

  async function handleSubmit() {
    if (!request) return;
    if (!form.fullName.trim()) {
      setError('ФИО не может быть пустым.');
      return;
    }

    const payload: BurialChangeDraftRequest = {};

    if (request.operationType === 'ADD') {
      const latitude = Number(form.latitude.replace(',', '.'));
      const longitude = Number(form.longitude.replace(',', '.'));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setError('Укажите корректные координаты.');
        return;
      }

      payload.fullName = form.fullName.trim();
      payload.latitude = latitude;
      payload.longitude = longitude;
      payload.birthDate = form.birthDate || undefined;
      payload.deathDate = form.deathDate || undefined;
      payload.photoUrl = form.photoUrl.trim() || undefined;
      payload.biography = form.biography.trim() || undefined;
    } else {
      const base = burialBase;
      if (!base) {
        setError('Не удалось загрузить текущее состояние захоронения.');
        return;
      }

      if (form.fullName.trim() !== (base.fullName || '').trim()) payload.fullName = form.fullName.trim();
      if ((form.birthDate || '') !== normalizeDate(base.birthDate)) {
        if (form.birthDate) {
          payload.birthDate = form.birthDate;
        } else if (base.birthDate) {
          payload.clearBirthDate = true;
        }
      }
      if ((form.deathDate || '') !== normalizeDate(base.deathDate)) {
        if (form.deathDate) {
          payload.deathDate = form.deathDate;
        } else if (base.deathDate) {
          payload.clearDeathDate = true;
        }
      }

      const nextPhotoUrl = form.photoUrl.trim();
      const basePhotoUrl = (base.photoUrl || '').trim();
      if (nextPhotoUrl !== basePhotoUrl) {
        if (nextPhotoUrl) {
          payload.photoUrl = nextPhotoUrl;
        } else if (basePhotoUrl) {
          payload.clearPhotoUrl = true;
        }
      }

      const nextBiography = form.biography.trim();
      const baseBiography = (base.biography || '').trim();
      if (nextBiography !== baseBiography) {
        if (nextBiography) {
          payload.biography = nextBiography;
        } else if (baseBiography) {
          payload.clearBiography = true;
        }
      }

      const latitude = Number(form.latitude.replace(',', '.'));
      const longitude = Number(form.longitude.replace(',', '.'));
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        if (base.latitude == null || Number(base.latitude.toFixed(6)) !== Number(latitude.toFixed(6))) payload.latitude = latitude;
        if (base.longitude == null || Number(base.longitude.toFixed(6)) !== Number(longitude.toFixed(6))) payload.longitude = longitude;
      }
    }

    setPending(true);
    setError('');
    try {
      const updated = await changeRequestService.updateOwnDraft(request.id, payload);
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось обновить заявку.');
    } finally {
      setPending(false);
    }
  }

  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 z-[94] flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={onClose} />
      <section className="surface-card relative z-[95] w-full max-w-4xl rounded-3xl p-6 sm:p-7">
        <h3 className="text-xl font-semibold text-[color:var(--ink)]">Редактирование заявки</h3>
        <p className="mt-2 text-sm text-[color:var(--ink-muted)]">
          Измените данные черновика и сохраните обновлённую заявку.
        </p>

        {loadingBase ? (
          <div className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-6 text-sm text-[color:var(--ink-muted)]">
            Загружаем текущее состояние захоронения...
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <div className="space-y-4">
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                placeholder="ФИО"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                />
                <input
                  type="date"
                  value={form.deathDate}
                  onChange={(event) => setForm((current) => ({ ...current, deathDate: event.target.value }))}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                />
              </div>
              <input
                value={form.photoUrl}
                onChange={(event) => setForm((current) => ({ ...current, photoUrl: event.target.value }))}
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Ссылка на изображение"
              />
              <textarea
                value={form.biography}
                onChange={(event) => setForm((current) => ({ ...current, biography: event.target.value }))}
                className="min-h-36 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Биография"
              />
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCoordinateMode('manual')}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                    coordinateMode === 'manual'
                      ? 'bg-[color:var(--accent)] text-white'
                      : 'border border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink)]',
                  ].join(' ')}
                >
                  Координаты вручную
                </button>
                <button
                  type="button"
                  onClick={() => setCoordinateMode('map')}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                    coordinateMode === 'map'
                      ? 'bg-[color:var(--accent)] text-white'
                      : 'border border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink)]',
                  ].join(' ')}
                >
                  Координаты на карте
                </button>
              </div>

              {coordinateMode === 'manual' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={form.latitude}
                    onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="Широта"
                  />
                  <input
                    value={form.longitude}
                    onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="Долгота"
                  />
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-[color:var(--line)]">
                    <div className="h-[300px]">
                      <LocationPickerMap
                        cemeteries={cemeteries}
                        value={mapPoint}
                        onSelect={(point) => {
                          setMapPoint(point);
                          setForm((current) => ({
                            ...current,
                            latitude: point.latitude.toFixed(6),
                            longitude: point.longitude.toFixed(6),
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm text-[color:var(--ink)]">
                    {mapPoint
                      ? `Широта: ${mapPoint.latitude.toFixed(6)} | Долгота: ${mapPoint.longitude.toFixed(6)}`
                      : 'Поставьте точку на карте.'}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={pending || loadingBase}
            onClick={handleSubmit}
            className="pill-action px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Сохраняем...' : 'Сохранить заявку'}
          </button>
        </div>
      </section>
    </div>
  );
}
