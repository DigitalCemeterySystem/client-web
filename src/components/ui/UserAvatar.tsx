'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { resolveImageSource } from '@/core/utils/image-source';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AvatarCrop = { x: number; y: number; zoom: number };
const DEFAULT_CROP: AvatarCrop = { x: 0, y: 0, zoom: 1 };
const LEGACY_CROP_BASE_SIZE = 220;

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
  '2xl': 'h-56 w-56',
};

export default function UserAvatar({
  avatarUrl,
  username,
  size = 'md',
  crop,
  cropStorageKey,
}: {
  avatarUrl?: string | null;
  username: string;
  size?: AvatarSize;
  crop?: AvatarCrop;
  cropStorageKey?: string;
}) {
  const [hasLoadError, setHasLoadError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState('');
  const [storedCrop, setStoredCrop] = useState<AvatarCrop>(DEFAULT_CROP);

  const resolvedSource = useMemo(() => resolveImageSource(avatarUrl ?? ''), [avatarUrl]);
  const effectiveCrop = crop ?? storedCrop;

  useEffect(() => {
    setHasLoadError(false);
    setCurrentSrc(resolvedSource?.src ?? '');
  }, [resolvedSource?.src, resolvedSource?.fallbackSrc]);

  useEffect(() => {
    if (!cropStorageKey || crop) {
      setStoredCrop(DEFAULT_CROP);
      return undefined;
    }

    const readCrop = () => {
      const raw = window.localStorage.getItem(cropStorageKey);
      if (!raw) {
        setStoredCrop(DEFAULT_CROP);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as AvatarCrop;
        const rawX = Number.isFinite(parsed.x) ? parsed.x : 0;
        const rawY = Number.isFinite(parsed.y) ? parsed.y : 0;
        const isLegacyPixelCrop = Math.abs(rawX) > 2 || Math.abs(rawY) > 2;
        setStoredCrop({
          x: isLegacyPixelCrop ? rawX / LEGACY_CROP_BASE_SIZE : rawX,
          y: isLegacyPixelCrop ? rawY / LEGACY_CROP_BASE_SIZE : rawY,
          zoom: Number.isFinite(parsed.zoom) ? Math.min(Math.max(parsed.zoom, 1), 3) : 1,
        });
      } catch {
        setStoredCrop(DEFAULT_CROP);
      }
    };

    const onCropChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      if (!customEvent.detail?.key || customEvent.detail.key === cropStorageKey) {
        readCrop();
      }
    };

    readCrop();
    window.addEventListener('dcs-avatar-crop-changed', onCropChanged);
    window.addEventListener('storage', readCrop);
    return () => {
      window.removeEventListener('dcs-avatar-crop-changed', onCropChanged);
      window.removeEventListener('storage', readCrop);
    };
  }, [cropStorageKey, crop]);

  const shouldUseCustomAvatar = Boolean(currentSrc) && !hasLoadError;
  const imageStyle: CSSProperties | undefined = effectiveCrop
    ? {
        transform: `translate(${effectiveCrop.x * 100}%, ${effectiveCrop.y * 100}%) scale(${effectiveCrop.zoom})`,
        transformOrigin: 'center center',
      }
    : undefined;

  return (
    <div className={`relative overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] ${sizeClasses[size]}`}>
      {shouldUseCustomAvatar ? (
        // `img` is intentional: users can provide arbitrary remote avatar URLs.
        // Next/Image would require allow-listing domains in config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={`Аватар пользователя ${username}`}
          className="h-full w-full object-cover"
          style={imageStyle}
          referrerPolicy="no-referrer"
          onError={() => {
            if (resolvedSource?.fallbackSrc && currentSrc !== resolvedSource.fallbackSrc) {
              setCurrentSrc(resolvedSource.fallbackSrc);
              return;
            }
            setHasLoadError(true);
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/avatar-placeholder.svg"
          alt="Стандартный аватар"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
