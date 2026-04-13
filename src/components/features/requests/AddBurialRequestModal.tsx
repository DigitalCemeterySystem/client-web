'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MapPinned, PencilLine, X } from 'lucide-react';
import { changeRequestService } from '@/core/api/change-request.service';
import LocationPickerMap from '@/components/features/map/LocationPickerMap';
import type { BurialChangeDraftRequest, CemeteryResponse, ChangeRequestResponse } from '@/types';

type AddBurialRequestModalProps = {
  open: boolean;
  cemeteries: CemeteryResponse[];
  onClose: () => void;
  onCreated?: (request: ChangeRequestResponse) => void;
};

type Stage = 'coordinates' | 'details' | 'result';
type CoordinateMode = 'manual' | 'map';

function parseCoordinate(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export default function AddBurialRequestModal({ open, cemeteries, onClose, onCreated }: AddBurialRequestModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('coordinates');
  const [coordinateMode, setCoordinateMode] = useState<CoordinateMode>('manual');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [mapPoint, setMapPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    birthDate: '',
    deathDate: '',
    photoUrl: '',
    biography: '',
  });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage('coordinates');
    setCoordinateMode('manual');
    setLatitude('');
    setLongitude('');
    setMapPoint(null);
    setForm({ fullName: '', birthDate: '', deathDate: '', photoUrl: '', biography: '' });
    setError('');
    setPending(false);
  }, [open]);

  const manualPoint = useMemo(() => {
    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);
    if (parsedLatitude == null || parsedLongitude == null || Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
      return null;
    }
    return {
      latitude: Number(parsedLatitude.toFixed(6)),
      longitude: Number(parsedLongitude.toFixed(6)),
    };
  }, [latitude, longitude]);

  const selectedPoint = coordinateMode === 'map' ? mapPoint : manualPoint;

  function proceedToDetails() {
    if (!selectedPoint) {
      setError('Укажите корректные координаты.');
      return;
    }
    setError('');
    setStage('details');
  }

  async function submitRequest() {
    if (!selectedPoint) {
      setError('Сначала подтвердите координаты.');
      setStage('coordinates');
      return;
    }

    if (!form.fullName.trim()) {
      setError('ФИО обязательно для новой заявки.');
      return;
    }

    const payload: BurialChangeDraftRequest = {
      fullName: form.fullName.trim(),
      latitude: selectedPoint.latitude,
      longitude: selectedPoint.longitude,
      birthDate: form.birthDate || undefined,
      deathDate: form.deathDate || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
      biography: form.biography.trim() || undefined,
    };

    setPending(true);
    setError('');

    try {
      const created = await changeRequestService.createBurialAddition(payload);
      onCreated?.(created);
      setStage('result');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось создать заявку.');
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[88] flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={onClose} aria-label="Закрыть окно" />
      <section className="surface-card relative z-[89] w-full max-w-4xl rounded-3xl p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Новая заявка</p>
            <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">Добавление захоронения</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
            aria-label="Закрыть окно"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StepChip active={stage === 'coordinates'} icon={<MapPinned size={14} />} label="Координаты" />
          <StepChip active={stage === 'details' || stage === 'result'} icon={<PencilLine size={14} />} label="Карточка" />
          <StepChip active={stage === 'result'} icon={<CheckCircle2 size={14} />} label="Готово" />
        </div>

        {stage === 'coordinates' && (
          <div className="mt-6 space-y-4">
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
                Ввести координаты
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
                Указать на карте
              </button>
            </div>

            {coordinateMode === 'manual' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                  placeholder="Широта"
                />
                <input
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                  placeholder="Долгота"
                />
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-[color:var(--line)]">
              <div className="h-[360px]">
                <LocationPickerMap cemeteries={cemeteries} value={selectedPoint} onSelect={setMapPoint} />
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm text-[color:var(--ink)]">
              {selectedPoint
                ? `Широта: ${selectedPoint.latitude.toFixed(6)} | Долгота: ${selectedPoint.longitude.toFixed(6)}`
                : 'Укажите координаты вручную или выберите точку на карте.'}
            </div>
          </div>
        )}

        {stage === 'details' && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm text-[color:var(--ink)]">
                Координаты: {selectedPoint?.latitude.toFixed(6)} | {selectedPoint?.longitude.toFixed(6)}
              </div>
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
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)]">
                {form.photoUrl.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photoUrl.trim()} alt="Предпросмотр захоронения" className="h-[220px] w-full object-cover" />
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-[color:var(--ink-muted)]">Предпросмотр изображения</div>
                )}
              </div>
              <textarea
                value={form.biography}
                onChange={(event) => setForm((current) => ({ ...current, biography: event.target.value }))}
                className="min-h-40 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                placeholder="Биография"
              />
            </div>
          </div>
        )}

        {stage === 'result' && (
          <div className="mt-6 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-6">
            <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <h4 className="text-lg font-semibold">Заявка отправлена</h4>
                <p className="mt-1 text-sm">Новая заявка на добавление захоронения сохранена и отправлена на рассмотрение.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push('/cemeteries');
                }}
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
              >
                Вернуться к карте
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push('/profile/requests');
                }}
                className="pill-action px-5 py-2.5 text-sm font-semibold"
              >
                Открыть мои заявки
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}

        {stage !== 'result' && (
          <div className="mt-6 flex justify-end gap-3">
            {stage === 'details' && (
              <button
                type="button"
                onClick={() => setStage('coordinates')}
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
              >
                Назад
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
            >
              Отмена
            </button>
            {stage === 'coordinates' ? (
              <button type="button" onClick={proceedToDetails} className="pill-action px-5 py-2.5 text-sm font-semibold">
                Подтвердить координаты
              </button>
            ) : (
              <button type="button" disabled={pending} onClick={submitRequest} className="pill-action px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                {pending ? 'Отправляем...' : 'Создать заявку'}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StepChip({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition',
        active
          ? 'bg-[color:var(--accent)] text-white'
          : 'border border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)]',
      ].join(' ')}
    >
      {icon}
      {label}
    </div>
  );
}
