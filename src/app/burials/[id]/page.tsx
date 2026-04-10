'use client';

import { burialService } from '@/core/api/burial.service';
import { cemeteryService } from '@/core/api/cemetery.service';
import type { BurialResponse } from '@/types';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  Copy,
  Grid2x2,
  Landmark,
  Loader2,
  LocateFixed,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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

  return {
    latitude,
    longitude,
    latitudeLabel: latitude.toFixed(6),
    longitudeLabel: longitude.toFixed(6),
    copyValue: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  };
}

function extractGoogleDriveFileId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const isGoogleDriveHost =
      host === 'drive.google.com' ||
      host === 'docs.google.com' ||
      host.endsWith('.drive.google.com');

    if (!isGoogleDriveHost) return null;

    const idFromQuery = url.searchParams.get('id');
    if (idFromQuery) return idFromQuery;

    const idFromPath = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    if (idFromPath) return idFromPath;
  } catch {
    // Ignore invalid URLs and fallback to regex extraction.
  }

  return rawUrl.match(/[-\w]{25,}/)?.[0] ?? null;
}

function resolveBurialPhoto(rawUrl: string | null) {
  if (!rawUrl?.trim()) return null;

  const source = rawUrl.trim();
  const fileId = extractGoogleDriveFileId(source);
  if (!fileId) {
    return { src: source, href: source };
  }

  return {
    src: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    fallbackSrc: `https://drive.google.com/uc?export=view&id=${fileId}`,
    href: `https://drive.google.com/uc?export=view&id=${fileId}`,
  };
}

function buildYandexMapsUrl(latitude: number, longitude: number) {
  return `https://yandex.ru/maps/?ll=${longitude}%2C${latitude}&z=18&pt=${longitude},${latitude},pm2rdm`;
}

function buildTwoGisUrl(latitude: number, longitude: number) {
  return `https://2gis.ru/search/${latitude},${longitude}`;
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator === 'undefined') {
    throw new Error('Clipboard API is unavailable.');
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const success = document.execCommand('copy');
    if (!success) {
      throw new Error('Copy command failed.');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function BurialDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [burial, setBurial] = useState<BurialResponse | null>(null);
  const [cemeteryAddress, setCemeteryAddress] = useState<string | null>(null);
  const [photoVisible, setPhotoVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);

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

        return burialService.getById(numericId);
      })
      .then((data) => {
        if (!mounted) return;
        setBurial(data);
        setPhotoVisible(true);
        setCoordinatesCopied(false);
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

  useEffect(() => {
    if (!burial?.cemeteryId) {
      setCemeteryAddress(null);
      return;
    }

    let mounted = true;

    cemeteryService
      .getById(burial.cemeteryId)
      .then((cemetery) => {
        if (mounted) {
          setCemeteryAddress(cemetery.address || null);
        }
      })
      .catch(() => {
        if (mounted) {
          setCemeteryAddress(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [burial?.cemeteryId]);

  useEffect(() => {
    if (!coordinatesCopied) return;

    const timeoutId = window.setTimeout(() => {
      setCoordinatesCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [coordinatesCopied]);

  const coordinates = useMemo(() => (burial ? resolveCoordinates(burial) : null), [burial]);
  const burialPhoto = useMemo(() => resolveBurialPhoto(burial?.photoUrl ?? null), [burial?.photoUrl]);

  const handleCopyCoordinates = async () => {
    if (!coordinates) return;

    try {
      await copyTextToClipboard(coordinates.copyValue);
      setCoordinatesCopied(true);
    } catch {
      setCoordinatesCopied(false);
    }
  };

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

      <article className="surface-card mt-5 overflow-hidden rounded-[2rem] p-5 sm:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] lg:self-start">
            {burialPhoto && photoVisible ? (
              <a
                href={burialPhoto.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-[300px] w-full bg-[color:var(--bg-elevated)] sm:h-[360px] lg:h-[540px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={burialPhoto.src}
                  alt={`Фотография захоронения ${burial.fullName}`}
                  loading="eager"
                  decoding="async"
                  className="block h-full w-full object-cover"
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (burialPhoto.fallbackSrc && image.src !== burialPhoto.fallbackSrc) {
                      image.src = burialPhoto.fallbackSrc;
                      return;
                    }

                    setPhotoVisible(false);
                  }}
                />
              </a>
            ) : (
              <div className="flex h-[300px] w-full items-center justify-center rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[color:var(--bg-panel)] text-sm text-[color:var(--ink-muted)] sm:h-[360px] lg:h-[540px]">
                Фотография отсутствует
              </div>
            )}
          </div>

          <div className="flex h-full flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
                Информация об усопшем
              </p>
              <h1 className="display-font mt-3 text-4xl leading-tight text-[color:var(--ink)]">{burial.fullName}</h1>
            </div>

            <div className="grid flex-1 gap-3 md:grid-cols-2 md:items-start">
              <div className="flex h-full flex-col gap-3">
                <InfoCard icon={<CalendarDays className="h-4 w-4" />} title="Даты жизни" className="md:h-[156px]">
                  <p className="text-sm font-medium leading-6 text-[color:var(--ink)]">
                    {formatDate(burial.birthDate)} - {formatDate(burial.deathDate)}
                  </p>
                </InfoCard>

                <InfoCard icon={<LocateFixed className="h-4 w-4" />} title="Координаты" className="md:h-[208px]">
                  {coordinates ? (
                    <div className="space-y-2.5 text-sm leading-6 text-[color:var(--ink)]">
                      <p>
                        <span className="font-semibold">Широта:</span> {coordinates.latitudeLabel}
                      </p>
                      <p>
                        <span className="font-semibold">Долгота:</span> {coordinates.longitudeLabel}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <MapLink
                          href={buildYandexMapsUrl(coordinates.latitude, coordinates.longitude)}
                          label="Открыть в Яндекс Картах"
                          iconSrc="/map-icons/ya_maps.svg"
                        />
                        <MapLink
                          href={buildTwoGisUrl(coordinates.latitude, coordinates.longitude)}
                          label="Открыть в 2ГИС"
                          iconSrc="/map-icons/2gis-icon-logo.svg"
                        />
                        <button
                          type="button"
                          onClick={handleCopyCoordinates}
                          className={[
                            'inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-all duration-200',
                            coordinatesCopied
                              ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 scale-[1.02]'
                              : 'border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink)] hover:-translate-y-0.5 hover:bg-[color:var(--accent-soft)]',
                          ].join(' ')}
                          aria-live="polite"
                        >
                          <span className="relative flex h-4 w-4 items-center justify-center">
                            <Copy
                              className={[
                                'absolute h-4 w-4 transition-all duration-200',
                                coordinatesCopied ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
                              ].join(' ')}
                            />
                            <Check
                              className={[
                                'absolute h-4 w-4 transition-all duration-200',
                                coordinatesCopied ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                              ].join(' ')}
                            />
                          </span>
                          <span>{coordinatesCopied ? 'Скопировано' : 'Копировать'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium leading-6 text-[color:var(--ink)]">Не указаны</p>
                  )}
                </InfoCard>
              </div>

              <div className="flex h-full flex-col gap-3">
                <InfoCard icon={<Landmark className="h-4 w-4" />} title="Кладбище" className="md:h-[208px]">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-6 text-[color:var(--ink)]">
                      {burial.cemeteryName || 'Не указано'}
                    </p>
                    <p className="text-sm leading-6 text-[color:var(--ink-muted)]">
                      {cemeteryAddress || 'Адрес не указан'}
                    </p>
                  </div>
                </InfoCard>

                <InfoCard icon={<Grid2x2 className="h-4 w-4" />} title="Квартал" className="md:h-[156px]">
                  <p className="text-sm font-medium leading-6 text-[color:var(--ink)]">
                    {burial.sectorName || 'Не указан'}
                  </p>
                </InfoCard>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5">
          <div className="flex items-center gap-2 text-[color:var(--ink-muted)]">
            <BookOpen className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">Биография</p>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[color:var(--ink-muted)]">
            {burial.biography?.trim() || 'Биография отсутствует.'}
          </p>
        </div>
      </article>
    </section>
  );
}

function InfoCard({
  icon,
  title,
  children,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-4 ${className}`}>
      <div className="flex items-center gap-2 text-[color:var(--ink-muted)]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MapLink({ href, label, iconSrc }: { href: string; label: string; iconSrc: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="burial-popup-map-link"
      aria-label={label}
      title={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} alt="" className="burial-popup-link-icon" />
    </a>
  );
}
