export type ResolvedImageSource = {
  src: string;
  href: string;
  fallbackSrc?: string;
};

export function extractGoogleDriveFileId(rawUrl: string): string | null {
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
    // Ignore invalid URL and fallback to regex below.
  }

  return rawUrl.match(/[-\w]{25,}/)?.[0] ?? null;
}

export function normalizeExternalImageUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  const driveFileId = extractGoogleDriveFileId(trimmed);
  if (driveFileId) {
    return `https://drive.google.com/uc?export=view&id=${driveFileId}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function resolveImageSource(rawValue: string): ResolvedImageSource | null {
  const normalized = normalizeExternalImageUrl(rawValue);
  if (!normalized) {
    return null;
  }

  const driveFileId = extractGoogleDriveFileId(normalized);
  if (!driveFileId) {
    return {
      src: normalized,
      href: normalized,
    };
  }

  return {
    src: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`,
    fallbackSrc: `https://drive.google.com/uc?export=view&id=${driveFileId}`,
    href: `https://drive.google.com/uc?export=view&id=${driveFileId}`,
  };
}
