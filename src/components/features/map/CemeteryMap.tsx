'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { BurialResponse, CemeteryResponse, SectorResponse } from '@/types';

interface CemeteryMapProps {
  cemetery?: CemeteryResponse | null;
  cemeteries?: CemeteryResponse[];
  sectors?: SectorResponse[];
  burials?: BurialResponse[];
  center?: [number, number];
  zoom?: number;
  showBoundary?: boolean;
  showSectors?: boolean;
  showBurials?: boolean;
  focusKey?: number;
  fitToBurials?: boolean;
  autoPinSingleBurial?: boolean;
  autoPinNonce?: number;
  syncNonce?: number;
  onPinnedPopupChange?: (burialId: number | null) => void;
}

type BurialLegacyFields = BurialResponse & {
  photo?: string | null;
  shortInfo?: string | null;
};

type CameraSnapshot = {
  center: maplibregl.LngLatLike;
  zoom: number;
  bearing: number;
  pitch: number;
};

type BoundaryPoint = {
  longitude: number;
  latitude: number;
};

type PopupPhoto = {
  src: string;
  href: string;
  fallbackSrc?: string;
};

type BurialPopupTriggerMode = 'hover' | 'pinned' | null;

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

type ThemeKey = keyof typeof STYLES;

const LAYERS = {
  cemeteryFill: 'cemetery-boundary-fill',
  cemeteryLine: 'cemetery-boundary-line',
  sectorsFill: 'sectors-boundary-fill',
  sectorsLine: 'sectors-boundary-line',
  selectedSector: 'selected-sector-line',
};

const SOURCES = {
  cemetery: 'cemetery-boundary',
  sectors: 'sectors-boundary',
  selectedSector: 'selected-sector',
};

const DEFAULT_CENTER: [number, number] = [82.9, 55.0];
const DEFAULT_ZOOM = 10;
const BIO_PREVIEW_LIMIT = 180;
const RETURN_TO_BURIAL_POPUP_KEY = 'cemeteries:return-burial-popup-id';

function formatDate(dateValue: string | null): string {
  if (!dateValue) return 'Не указана';

  const trimmed = dateValue.trim();
  const plainDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (plainDateMatch) {
    const [, year, month, day] = plainDateMatch;
    return `${day}.${month}.${year}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function truncateText(value: string, limit: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trimEnd()}...`;
}

function getPopupData(burial: BurialResponse) {
  const legacy = burial as BurialLegacyFields;
  return {
    photo: burial.photoUrl ?? legacy.photo ?? null,
    bio: burial.biography ?? legacy.shortInfo ?? '',
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

function resolvePopupPhoto(rawUrl: string | null): PopupPhoto | null {
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

function toLinearRing(points: BoundaryPoint[]): [number, number][] {
  const ring = points.reduce<[number, number][]>((acc, point) => {
    const longitude = Number(point.longitude);
    const latitude = Number(point.latitude);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      acc.push([longitude, latitude]);
    }
    return acc;
  }, []);

  if (ring.length < 3) return [];

  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    ring.push([firstLng, firstLat]);
  }

  return ring;
}

function polygonFromPoints(points: BoundaryPoint[]) {
  const ring = toLinearRing(points);
  if (ring.length < 4) return null;

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
    properties: {},
  };
}

function buildCemeteryData(cemeteries?: Array<CemeteryResponse | null | undefined>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (cemeteries ?? []).flatMap((cemetery) => {
      if (!cemetery?.boundary?.length) return [];

      const polygon = polygonFromPoints(cemetery.boundary);
      return polygon ? [polygon] : [];
    }),
  };
}

function buildSectorsData(sectors?: SectorResponse[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (sectors ?? []).flatMap((sector) => {
      const ring = toLinearRing(sector.boundary ?? []);
      if (ring.length < 4) return [];

      return [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [ring],
          },
          properties: {
            id: sector.id,
            name: sector.name,
          },
        },
      ];
    }),
  };
}

function setSourceData(map: maplibregl.Map, sourceId: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
  } else {
    map.addSource(sourceId, { type: 'geojson', data });
  }
}

function cloneStyleSpec(style: maplibregl.StyleSpecification): maplibregl.StyleSpecification {
  return JSON.parse(JSON.stringify(style)) as maplibregl.StyleSpecification;
}

function ensureLayerVisible(map: maplibregl.Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

function fitToCemetery(map: maplibregl.Map, cemetery: CemeteryResponse) {
  if (!cemetery.boundary.length) return;

  const bounds = new maplibregl.LngLatBounds();
  cemetery.boundary.forEach((point) => bounds.extend([point.longitude, point.latitude]));

  map.fitBounds(bounds, {
    padding: 80,
    duration: 900,
    maxZoom: 13.8,
  });
}

function fitToCemeteries(map: maplibregl.Map, cemeteries: CemeteryResponse[]) {
  const validCemeteries = cemeteries.filter((cemetery) => cemetery.boundary.length);
  if (!validCemeteries.length) return;

  if (validCemeteries.length === 1) {
    fitToCemetery(map, validCemeteries[0]);
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  validCemeteries.forEach((cemetery) => {
    cemetery.boundary.forEach((point) => {
      bounds.extend([point.longitude, point.latitude]);
    });
  });

  map.fitBounds(bounds, {
    padding: 80,
    duration: 900,
    maxZoom: 13.8,
  });
}

function fitMapToBurials(map: maplibregl.Map, burials: BurialResponse[]) {
  const coordinates = burials.reduce<[number, number][]>((acc, burial) => {
    const latitude = Number(burial.latitude);
    const longitude = Number(burial.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      acc.push([longitude, latitude]);
    }
    return acc;
  }, []);

  if (!coordinates.length) return;

  if (coordinates.length === 1) {
    const markerPosition = coordinates[0];
    const mapContainer = map.getContainer();
    const width = mapContainer.clientWidth;
    const height = mapContainer.clientHeight;

    map.jumpTo({
      center: markerPosition,
      zoom: 16.4,
    });

    const markerPoint = map.project(markerPosition);
    const targetPoint = {
      x: width * 0.5,
      y: height * 0.75,
    };

    const shiftX = targetPoint.x - markerPoint.x;
    const shiftY = targetPoint.y - markerPoint.y;
    const nextCenter = map.unproject([markerPoint.x - shiftX, markerPoint.y - shiftY]);

    map.easeTo({
      center: nextCenter,
      zoom: 16.4,
      duration: 900,
    });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  coordinates.forEach((point) => bounds.extend(point));

  map.fitBounds(bounds, {
    padding: 80,
    duration: 900,
    maxZoom: 15.5,
  });
}

function clearMarkers(markersRef: MutableRefObject<maplibregl.Marker[]>) {
  markersRef.current.forEach((marker) => marker.remove());
  markersRef.current = [];
}

function closeSectorPopup(sectorPopupRef: MutableRefObject<maplibregl.Popup | null>) {
  if (sectorPopupRef.current) {
    sectorPopupRef.current.remove();
    sectorPopupRef.current = null;
  }
}

function closeBurialPopup(burialPopupRef: MutableRefObject<maplibregl.Popup | null>) {
  if (burialPopupRef.current) {
    burialPopupRef.current.remove();
    burialPopupRef.current = null;
  }
}

function createExternalLinkButton(label: string, href: string, iconSrc: string) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'burial-popup-map-link';
  link.setAttribute('aria-label', label);
  link.setAttribute('title', label);

  const icon = document.createElement('img');
  icon.src = iconSrc;
  icon.alt = '';
  icon.className = 'burial-popup-link-icon';

  link.appendChild(icon);
  return link;
}

function readPendingBurialPopupId(): number | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.sessionStorage.getItem(RETURN_TO_BURIAL_POPUP_KEY);
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function writePendingBurialPopupId(burialId: number) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RETURN_TO_BURIAL_POPUP_KEY, String(burialId));
}

function clearPendingBurialPopupId() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RETURN_TO_BURIAL_POPUP_KEY);
}

function buildBurialPopupContent(burial: BurialResponse, onDetailsNavigate: () => void) {
  const popupData = getPopupData(burial);
  const popupPhoto = resolvePopupPhoto(popupData.photo);
  const bio = popupData.bio?.trim() ? popupData.bio : 'Биография отсутствует.';
  const bioPreview = truncateText(bio, BIO_PREVIEW_LIMIT);
  const latitude = Number(burial.latitude);
  const longitude = Number(burial.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  const article = document.createElement('article');
  article.className = `burial-popup-card${popupPhoto ? ' burial-popup-card--with-photo' : ' burial-popup-card--without-photo'}`;

  if (popupPhoto) {
    const media = document.createElement('div');
    media.className = 'burial-popup-media';

    const imageLink = document.createElement('a');
    imageLink.href = popupPhoto.href;
    imageLink.target = '_blank';
    imageLink.rel = 'noopener noreferrer';
    imageLink.className = 'burial-popup-image-link';

    const image = document.createElement('img');
    image.src = popupPhoto.src;
    image.alt = `Фотография захоронения ${burial.fullName}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.className = 'burial-popup-image';
    image.onerror = () => {
      if (popupPhoto.fallbackSrc && image.src !== popupPhoto.fallbackSrc) {
        image.src = popupPhoto.fallbackSrc;
        return;
      }

      media.remove();
      article.classList.remove('burial-popup-card--with-photo');
    };

    imageLink.appendChild(image);
    media.appendChild(imageLink);
    article.appendChild(media);
  }

  const content = document.createElement('div');
  content.className = 'burial-popup-content';

  const head = document.createElement('div');
  head.className = 'burial-popup-head';

  const textBlock = document.createElement('div');
  textBlock.className = 'burial-popup-text-block';

  const title = document.createElement('h3');
  title.className = 'burial-popup-title';
  title.textContent = burial.fullName;

  const dates = document.createElement('div');
  dates.className = 'burial-popup-dates';
  dates.textContent = `${formatDate(burial.birthDate)} - ${formatDate(burial.deathDate)}`;

  const mapLinks = document.createElement('div');
  mapLinks.className = 'burial-popup-map-links';
  if (hasCoordinates) {
    mapLinks.append(
      createExternalLinkButton('Открыть в Яндекс Картах', buildYandexMapsUrl(latitude, longitude), '/map-icons/ya_maps.svg'),
      createExternalLinkButton('Открыть в 2ГИС', buildTwoGisUrl(latitude, longitude), '/map-icons/2gis-icon-logo.svg')
    );
  }

  const bioText = document.createElement('p');
  bioText.className = 'burial-popup-bio';
  bioText.textContent = bioPreview;

  const summary = document.createElement('div');
  summary.className = 'burial-popup-summary';

  const detailsLink = document.createElement('a');
  detailsLink.href = `/burials/${burial.id}`;
  detailsLink.className = 'burial-popup-details';
  detailsLink.textContent = 'Подробнее';
  detailsLink.addEventListener('click', () => {
    writePendingBurialPopupId(burial.id);
    onDetailsNavigate();
  });

  textBlock.append(title, dates);
  head.append(textBlock, mapLinks);
  summary.append(bioText, detailsLink);
  content.append(head, summary);
  article.appendChild(content);

  return article;
}

function buildSectorPopupContent(sectorName: string, onClose: () => void) {
  const wrapper = document.createElement('div');
  wrapper.className = 'quarter-popup-card';

  const header = document.createElement('div');
  header.className = 'quarter-popup-head';

  const label = document.createElement('div');
  label.className = 'quarter-popup-label';
  label.textContent = 'Квартал';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'quarter-popup-close';
  closeButton.setAttribute('aria-label', 'Закрыть popup квартала');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    onClose();
  });

  const name = document.createElement('div');
  name.className = 'quarter-popup-name';
  name.textContent = sectorName;

  header.append(label, closeButton);
  wrapper.append(header, name);
  return wrapper;
}

function syncMapLayers(
  map: maplibregl.Map,
  cemeteries: CemeteryResponse[] | undefined,
  sectors: SectorResponse[] | undefined,
  selectedSectorId: number | null,
  showBoundary: boolean,
  showSectors: boolean
) {
  if (!map.isStyleLoaded()) return;

  const cemeteryData = buildCemeteryData(cemeteries);
  const sectorsData = buildSectorsData(sectors);

  setSourceData(map, SOURCES.cemetery, cemeteryData);
  setSourceData(map, SOURCES.sectors, sectorsData);

  const selectedSectorData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: sectorsData.features.filter((feature) => Number(feature.properties?.id) === selectedSectorId),
  };
  setSourceData(map, SOURCES.selectedSector, selectedSectorData);

  if (!map.getLayer(LAYERS.cemeteryFill)) {
    map.addLayer({
      id: LAYERS.cemeteryFill,
      type: 'fill',
      source: SOURCES.cemetery,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.08,
      },
    });
  }

  if (!map.getLayer(LAYERS.cemeteryLine)) {
    map.addLayer({
      id: LAYERS.cemeteryLine,
      type: 'line',
      source: SOURCES.cemetery,
      paint: {
        'line-color': '#1d4ed8',
        'line-width': 3.4,
        'line-opacity': 1,
      },
    });
  }

  if (!map.getLayer(LAYERS.sectorsFill)) {
    map.addLayer({
      id: LAYERS.sectorsFill,
      type: 'fill',
      source: SOURCES.sectors,
      paint: {
        'fill-color': '#22c55e',
        'fill-opacity': 0.04,
      },
    });
  }

  if (!map.getLayer(LAYERS.sectorsLine)) {
    map.addLayer({
      id: LAYERS.sectorsLine,
      type: 'line',
      source: SOURCES.sectors,
      paint: {
        'line-color': '#16a34a',
        'line-width': 1.6,
        'line-opacity': 0.95,
      },
    });
  }

  if (!map.getLayer(LAYERS.selectedSector)) {
    map.addLayer({
      id: LAYERS.selectedSector,
      type: 'line',
      source: SOURCES.selectedSector,
      paint: {
        'line-color': '#f97316',
        'line-width': 4.5,
        'line-opacity': 1,
      },
    });
  }

  ensureLayerVisible(map, LAYERS.cemeteryFill, showBoundary);
  ensureLayerVisible(map, LAYERS.cemeteryLine, showBoundary);
  ensureLayerVisible(map, LAYERS.sectorsFill, showSectors);
  ensureLayerVisible(map, LAYERS.sectorsLine, showSectors);
  ensureLayerVisible(map, LAYERS.selectedSector, showSectors && selectedSectorId !== null);
}

function syncBurialMarkers(
  map: maplibregl.Map,
  markersRef: MutableRefObject<maplibregl.Marker[]>,
  sectorPopupRef: MutableRefObject<maplibregl.Popup | null>,
  burialPopupRef: MutableRefObject<maplibregl.Popup | null>,
  pinnedBurialPopupRef: MutableRefObject<maplibregl.Popup | null>,
  pendingReturnBurialIdRef: MutableRefObject<number | null>,
  burials: BurialResponse[] | undefined,
  showBurials: boolean,
  autoPinSingleBurial: boolean,
  autoPinNonce: number,
  lastAutoPinNonceRef: MutableRefObject<number | null>,
  pinnedBurialIdRef: MutableRefObject<number | null>,
  onPinnedPopupChange?: (burialId: number | null) => void,
  suppressPopupCallbacksRef?: MutableRefObject<boolean>
) {
  closeBurialPopup(burialPopupRef);
  pinnedBurialPopupRef.current = null;
  clearMarkers(markersRef);
  if (pinnedBurialIdRef.current !== null) {
    pinnedBurialIdRef.current = null;
    if (!suppressPopupCallbacksRef?.current) {
      onPinnedPopupChange?.(null);
    }
  }
  if (!showBurials || !burials?.length) return;

  const shouldAutoPinSingleMarker =
    autoPinSingleBurial &&
    burials.length === 1 &&
    autoPinNonce !== lastAutoPinNonceRef.current;

  burials.forEach((burial) => {
    const latitude = Number(burial.latitude);
    const longitude = Number(burial.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const markerElement = document.createElement('button');
    markerElement.type = 'button';
    markerElement.className = 'burial-marker';
    markerElement.setAttribute('aria-label', `Открыть информацию о захоронении ${burial.fullName}`);
    markerElement.innerHTML = `
      <span class="burial-marker__halo"></span>
      <span class="burial-marker__pin"></span>
    `;

    const popup = new maplibregl.Popup({
      offset: 18,
      maxWidth: '300px',
      className: 'modern-popup',
      closeButton: true,
      closeOnClick: false,
    }).setDOMContent(
      buildBurialPopupContent(burial, () => {
        triggerMode = 'pinned';
        burialPopupRef.current = popup;
        pinnedBurialPopupRef.current = popup;
        clearCloseTimer();
        setMarkerActive(true);
      })
    );

    let triggerMode: BurialPopupTriggerMode = null;
    let pointerOverMarker = false;
    let pointerOverPopup = false;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const setMarkerActive = (active: boolean) => {
      markerElement.classList.toggle('is-active', active);
    };

    const clearCloseTimer = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    };

    const syncMarkerVisual = () => {
      setMarkerActive(popup.isOpen() || pointerOverMarker);
    };

    const maybeClosePopup = () => {
      if (triggerMode === 'pinned' || pointerOverMarker || pointerOverPopup) {
        syncMarkerVisual();
        return;
      }

      if (popup.isOpen()) {
        popup.remove();
      } else {
        syncMarkerVisual();
      }
    };

    const schedulePopupClose = () => {
      clearCloseTimer();
      closeTimer = setTimeout(maybeClosePopup, 120);
    };

    const openPopup = (mode: BurialPopupTriggerMode) => {
      if (pinnedBurialPopupRef.current && pinnedBurialPopupRef.current !== popup) {
        if (mode === 'hover') {
          return;
        }

        if (mode === 'pinned') {
          pinnedBurialPopupRef.current.remove();
          pinnedBurialPopupRef.current = null;
          pinnedBurialIdRef.current = null;
          onPinnedPopupChange?.(null);
        }
      }

      clearCloseTimer();
      triggerMode = mode;
      if (burialPopupRef.current && burialPopupRef.current !== popup) {
        burialPopupRef.current.remove();
      }
      if (!popup.isOpen()) {
        popup.setLngLat([longitude, latitude]).addTo(map);
      }
      burialPopupRef.current = popup;
      pinnedBurialPopupRef.current = mode === 'pinned' ? popup : pinnedBurialPopupRef.current;
      if (mode === 'pinned') {
        pinnedBurialIdRef.current = burial.id;
        onPinnedPopupChange?.(burial.id);
      }
      setMarkerActive(true);
    };

    popup.on('open', () => {
      closeSectorPopup(sectorPopupRef);
      if (burialPopupRef.current && burialPopupRef.current !== popup) {
        burialPopupRef.current.remove();
      }
      burialPopupRef.current = popup;
      setMarkerActive(true);

      const popupElement = popup.getElement();
      popupElement.onmouseenter = () => {
        pointerOverPopup = true;
        clearCloseTimer();
        setMarkerActive(true);
      };
      popupElement.onmouseleave = () => {
        pointerOverPopup = false;
        if (triggerMode !== 'pinned') {
          schedulePopupClose();
        }
      };
    });

    popup.on('close', () => {
      clearCloseTimer();
      pointerOverPopup = false;
      if (burialPopupRef.current === popup) {
        burialPopupRef.current = null;
      }
      if (pinnedBurialPopupRef.current === popup) {
        pinnedBurialPopupRef.current = null;
        pinnedBurialIdRef.current = null;
        if (!suppressPopupCallbacksRef?.current) {
          onPinnedPopupChange?.(null);
        }
      }
      triggerMode = null;
      syncMarkerVisual();
    });

    markerElement.addEventListener('mouseenter', () => {
      pointerOverMarker = true;
      openPopup(triggerMode === 'pinned' ? 'pinned' : 'hover');
    });

    markerElement.addEventListener('mouseleave', () => {
      pointerOverMarker = false;
      if (triggerMode !== 'pinned') {
        schedulePopupClose();
      } else {
        syncMarkerVisual();
      }
    });

    markerElement.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      pointerOverMarker = true;

      if (popup.isOpen() && triggerMode === 'pinned') {
        triggerMode = null;
        popup.remove();
        return;
      }

      openPopup('pinned');
    });

    const marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
      .setLngLat([longitude, latitude])
      .addTo(map);

    if (pendingReturnBurialIdRef.current === burial.id) {
      openPopup('pinned');
      pendingReturnBurialIdRef.current = null;
      clearPendingBurialPopupId();
    }

    markersRef.current.push(marker);

    if (shouldAutoPinSingleMarker) {
      lastAutoPinNonceRef.current = autoPinNonce;
      openPopup('pinned');
    }
  });
}

function syncAllMapVisuals(
  map: maplibregl.Map,
  markersRef: MutableRefObject<maplibregl.Marker[]>,
  sectorPopupRef: MutableRefObject<maplibregl.Popup | null>,
  burialPopupRef: MutableRefObject<maplibregl.Popup | null>,
  pinnedBurialPopupRef: MutableRefObject<maplibregl.Popup | null>,
  pendingReturnBurialIdRef: MutableRefObject<number | null>,
  cemeteries: CemeteryResponse[] | undefined,
  sectors: SectorResponse[] | undefined,
  burials: BurialResponse[] | undefined,
  selectedSectorId: number | null,
  showBoundary: boolean,
  showSectors: boolean,
  showBurials: boolean,
  autoPinSingleBurial: boolean,
  autoPinNonce: number,
  lastAutoPinNonceRef: MutableRefObject<number | null>,
  pinnedBurialIdRef: MutableRefObject<number | null>,
  onPinnedPopupChange?: (burialId: number | null) => void,
  suppressPopupCallbacksRef?: MutableRefObject<boolean>
) {
  syncMapLayers(map, cemeteries, sectors, selectedSectorId, showBoundary, showSectors);
  syncBurialMarkers(
    map,
    markersRef,
    sectorPopupRef,
    burialPopupRef,
    pinnedBurialPopupRef,
    pendingReturnBurialIdRef,
    burials,
    showBurials,
    autoPinSingleBurial,
    autoPinNonce,
    lastAutoPinNonceRef,
    pinnedBurialIdRef,
    onPinnedPopupChange,
    suppressPopupCallbacksRef
  );
}

export default function CemeteryMap({
  cemetery,
  cemeteries,
  sectors,
  burials,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  showBoundary = true,
  showSectors = true,
  showBurials = true,
  focusKey = 0,
  fitToBurials = false,
  autoPinSingleBurial = false,
  autoPinNonce = 0,
  syncNonce = 0,
  onPinnedPopupChange,
}: CemeteryMapProps) {
  const { resolvedTheme } = useTheme();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const sectorPopupRef = useRef<maplibregl.Popup | null>(null);
  const burialPopupRef = useRef<maplibregl.Popup | null>(null);
  const pinnedBurialPopupRef = useRef<maplibregl.Popup | null>(null);
  const pendingReturnBurialIdRef = useRef<number | null>(null);
  const lastAutoPinNonceRef = useRef<number | null>(null);
  const pinnedBurialIdRef = useRef<number | null>(null);
  const suppressPopupCallbacksRef = useRef(false);
  const styleUrlRef = useRef(STYLES.light);
  const cameraBeforeStyleRef = useRef<CameraSnapshot | null>(null);
  const pendingFocusRef = useRef<CemeteryResponse[] | null>(null);
  const pendingBurialsFocusRef = useRef(false);
  const lastFocusKeyRef = useRef<number | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSectorsRef = useRef(showSectors);
  const showBoundaryRef = useRef(showBoundary);
  const showBurialsRef = useRef(showBurials);
  const autoPinSingleBurialRef = useRef(autoPinSingleBurial);
  const onPinnedPopupChangeRef = useRef(onPinnedPopupChange);
  const hasExplicitCemeteriesProp = cemeteries !== undefined;
  const cemeteriesToRender = useMemo(() => {
    if (hasExplicitCemeteriesProp) {
      return (cemeteries ?? []).filter(Boolean);
    }

    return cemetery ? [cemetery] : [];
  }, [hasExplicitCemeteriesProp, cemeteries, cemetery]);
  const cemeterySelectionSignature = useMemo(
    () => cemeteriesToRender.map((item) => item.id).sort((a, b) => a - b).join(','),
    [cemeteriesToRender]
  );

  const cemeteryRef = useRef(cemetery);
  const cemeteriesRef = useRef<CemeteryResponse[]>(cemeteriesToRender);
  const sectorsRef = useRef(sectors);
  const burialsRef = useRef(burials);
  const selectedSectorIdRef = useRef<number | null>(null);
  const stylesCacheRef = useRef<Partial<Record<ThemeKey, maplibregl.StyleSpecification>>>({});
  const awaitingStyleLoadRef = useRef(true);

  const [mapReady, setMapReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);

  const initialCenter = useMemo<[number, number]>(() => [...center] as [number, number], []);
  const initialZoom = useMemo(() => zoom, []);

  useEffect(() => {
    pendingReturnBurialIdRef.current = readPendingBurialPopupId();
  }, []);

  useEffect(() => {
    const syncPendingReturnPopup = () => {
      pendingReturnBurialIdRef.current = readPendingBurialPopupId();
    };

    window.addEventListener('pageshow', syncPendingReturnPopup);
    window.addEventListener('focus', syncPendingReturnPopup);

    return () => {
      window.removeEventListener('pageshow', syncPendingReturnPopup);
      window.removeEventListener('focus', syncPendingReturnPopup);
    };
  }, []);

  useEffect(() => {
    showSectorsRef.current = showSectors;
    showBoundaryRef.current = showBoundary;
    showBurialsRef.current = showBurials;
    autoPinSingleBurialRef.current = autoPinSingleBurial;
    onPinnedPopupChangeRef.current = onPinnedPopupChange;
    cemeteryRef.current = cemetery;
    cemeteriesRef.current = cemeteriesToRender;
    sectorsRef.current = sectors;
    burialsRef.current = burials;
    selectedSectorIdRef.current = selectedSectorId;
  }, [burials, cemetery, cemeteriesToRender, sectors, selectedSectorId, showBoundary, showBurials, showSectors, autoPinSingleBurial, onPinnedPopupChange]);

  useEffect(() => {
    const abortController = new AbortController();

    const preloadStyle = async (themeKey: ThemeKey) => {
      if (stylesCacheRef.current[themeKey]) return;

      try {
        const response = await fetch(STYLES[themeKey], { signal: abortController.signal });
        if (!response.ok) return;
        const style = (await response.json()) as maplibregl.StyleSpecification;
        stylesCacheRef.current[themeKey] = style;
      } catch {
        // ignore: fallback to style URL if preloading failed
      }
    };

    preloadStyle('light');
    preloadStyle('dark');

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    suppressPopupCallbacksRef.current = false;

    const initialStyle = STYLES[resolvedTheme as keyof typeof STYLES] ?? STYLES.light;
    styleUrlRef.current = initialStyle;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    const finalizeStyleLoad = () => {
      if (!awaitingStyleLoadRef.current || !map.isStyleLoaded()) return;
      awaitingStyleLoadRef.current = false;

      if (cameraBeforeStyleRef.current) {
        map.jumpTo(cameraBeforeStyleRef.current);
        cameraBeforeStyleRef.current = null;
      }

      if (pendingFocusRef.current?.length) {
        fitToCemeteries(map, pendingFocusRef.current);
        pendingFocusRef.current = null;
      }
      if (pendingBurialsFocusRef.current && burialsRef.current?.length) {
        fitMapToBurials(map, burialsRef.current);
        pendingBurialsFocusRef.current = false;
      }

      syncAllMapVisuals(
        map,
        markersRef,
        sectorPopupRef,
        burialPopupRef,
        pinnedBurialPopupRef,
        pendingReturnBurialIdRef,
        cemeteriesRef.current,
        sectorsRef.current,
        burialsRef.current,
        selectedSectorIdRef.current,
        showBoundaryRef.current,
        showSectorsRef.current,
        showBurialsRef.current,
        autoPinSingleBurialRef.current,
        autoPinNonce,
        lastAutoPinNonceRef,
        pinnedBurialIdRef,
        onPinnedPopupChangeRef.current,
        suppressPopupCallbacksRef
      );

      if (styleTimeoutRef.current) {
        clearTimeout(styleTimeoutRef.current);
        styleTimeoutRef.current = null;
      }

      setMapReady(true);
      setStyleEpoch((prev) => prev + 1);
    };

    const onStyleLoad = () => {
      finalizeStyleLoad();
    };

    const onMapError = () => {
      if (awaitingStyleLoadRef.current && map.isStyleLoaded()) {
        finalizeStyleLoad();
      }
    };

    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      const clickTarget = event.originalEvent.target;
      if (clickTarget instanceof HTMLElement && clickTarget.closest('.maplibregl-marker')) {
        return;
      }

      if (!showSectorsRef.current) return;
      if (!map.isStyleLoaded()) return;
      if (!map.getLayer(LAYERS.sectorsFill)) return;

      const features = map.queryRenderedFeatures(event.point, { layers: [LAYERS.sectorsFill] });
      const feature = features[0];

      if (!feature) {
        setSelectedSectorId(null);
        closeSectorPopup(sectorPopupRef);
        return;
      }

      const sectorId = Number(feature.properties?.id);
      const sectorName = String(feature.properties?.name ?? 'Квартал');
      setSelectedSectorId(Number.isFinite(sectorId) ? sectorId : null);

      closeSectorPopup(sectorPopupRef);

      sectorPopupRef.current = new maplibregl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false,
        className: 'modern-popup',
      })
        .setLngLat(event.lngLat)
        .setDOMContent(buildSectorPopupContent(sectorName, () => closeSectorPopup(sectorPopupRef)))
        .addTo(map);
    };

    const onMouseMove = (event: maplibregl.MapMouseEvent) => {
      if (!showSectorsRef.current || !map.isStyleLoaded() || !map.getLayer(LAYERS.sectorsFill)) {
        map.getCanvas().style.cursor = '';
        return;
      }

      const features = map.queryRenderedFeatures(event.point, { layers: [LAYERS.sectorsFill] });
      map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('style.load', onStyleLoad);
    map.on('load', onStyleLoad);
    map.on('error', onMapError);
    map.on('click', onMapClick);
    map.on('mousemove', onMouseMove);
    map.on('mouseleave', onMouseLeave);

    mapRef.current = map;
    onStyleLoad();

    return () => {
      suppressPopupCallbacksRef.current = true;
      map.off('style.load', onStyleLoad);
      map.off('load', onStyleLoad);
      map.off('error', onMapError);
      map.off('click', onMapClick);
      map.off('mousemove', onMouseMove);
      map.off('mouseleave', onMouseLeave);

      if (styleTimeoutRef.current) clearTimeout(styleTimeoutRef.current);

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      closeSectorPopup(sectorPopupRef);
      closeBurialPopup(burialPopupRef);
      pinnedBurialPopupRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, [initialCenter, initialZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const themeKey: ThemeKey = resolvedTheme === 'dark' ? 'dark' : 'light';
    const nextStyleUrl = STYLES[themeKey] ?? STYLES.light;
    const cachedStyle = stylesCacheRef.current[themeKey];
    const nextStyle = cachedStyle ? cloneStyleSpec(cachedStyle) : nextStyleUrl;
    if (nextStyleUrl === styleUrlRef.current) return;

    styleUrlRef.current = nextStyleUrl;

    cameraBeforeStyleRef.current = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };

    closeSectorPopup(sectorPopupRef);
    if (pinnedBurialIdRef.current !== null) {
      pendingReturnBurialIdRef.current = pinnedBurialIdRef.current;
    }
    closeBurialPopup(burialPopupRef);
    pinnedBurialPopupRef.current = null;

    setMapReady(false);
    awaitingStyleLoadRef.current = true;
    map.setStyle(nextStyle);

    const pollStyleReady = (attempt: number) => {
      if (!awaitingStyleLoadRef.current) return;

      if (map.isStyleLoaded()) {
        awaitingStyleLoadRef.current = false;
        syncAllMapVisuals(
          map,
          markersRef,
          sectorPopupRef,
          burialPopupRef,
          pinnedBurialPopupRef,
          pendingReturnBurialIdRef,
          cemeteriesRef.current,
          sectorsRef.current,
          burialsRef.current,
          selectedSectorIdRef.current,
          showBoundaryRef.current,
          showSectorsRef.current,
          showBurialsRef.current,
          autoPinSingleBurialRef.current,
          autoPinNonce,
          lastAutoPinNonceRef,
          pinnedBurialIdRef,
          onPinnedPopupChangeRef.current,
          suppressPopupCallbacksRef
        );
        setStyleEpoch((prev) => prev + 1);
        setMapReady(true);
        return;
      }

      if (attempt >= 40) {
        awaitingStyleLoadRef.current = false;
        setMapReady(true);
        return;
      }

      styleTimeoutRef.current = setTimeout(() => pollStyleReady(attempt + 1), 150);
    };

    if (styleTimeoutRef.current) clearTimeout(styleTimeoutRef.current);
    styleTimeoutRef.current = setTimeout(() => pollStyleReady(0), 150);
  }, [resolvedTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (fitToBurials && burials?.length) {
      if (!map.isStyleLoaded()) {
        pendingBurialsFocusRef.current = true;
        return;
      }
      closeSectorPopup(sectorPopupRef);
      setSelectedSectorId(null);
      fitMapToBurials(map, burials);
      return;
    }

    pendingBurialsFocusRef.current = false;
    if (lastFocusKeyRef.current === focusKey) return;
    lastFocusKeyRef.current = focusKey;

    if (cemeteriesToRender.length) {
      if (!map.isStyleLoaded()) {
        pendingFocusRef.current = cemeteriesToRender;
        return;
      }

      fitToCemeteries(map, cemeteriesToRender);
      return;
    }

    pendingFocusRef.current = null;
    closeSectorPopup(sectorPopupRef);
    setSelectedSectorId(null);
    map.flyTo({
      center: initialCenter,
      zoom: initialZoom,
      duration: 900,
    });
  }, [burials, cemeteriesToRender, fitToBurials, focusKey, initialCenter, initialZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.isStyleLoaded()) {
      syncAllMapVisuals(
        map,
        markersRef,
        sectorPopupRef,
        burialPopupRef,
        pinnedBurialPopupRef,
        pendingReturnBurialIdRef,
        cemeteriesToRender,
        sectors,
        burials,
        selectedSectorId,
        showBoundary,
        showSectors,
        showBurials,
        autoPinSingleBurialRef.current,
        autoPinNonce,
        lastAutoPinNonceRef,
        pinnedBurialIdRef,
        onPinnedPopupChangeRef.current,
        suppressPopupCallbacksRef
      );
      return;
    }

    const onStyleLoad = () => {
      syncAllMapVisuals(
        map,
        markersRef,
        sectorPopupRef,
        burialPopupRef,
        pinnedBurialPopupRef,
        pendingReturnBurialIdRef,
        cemeteriesToRender,
        sectors,
        burials,
        selectedSectorId,
        showBoundary,
        showSectors,
        showBurials,
        autoPinSingleBurialRef.current,
        autoPinNonce,
        lastAutoPinNonceRef,
        pinnedBurialIdRef,
        onPinnedPopupChangeRef.current,
        suppressPopupCallbacksRef
      );
    };
    map.once('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [
    cemeteriesToRender,
    sectors,
    burials,
    selectedSectorId,
    showBoundary,
    showSectors,
    showBurials,
    mapReady,
    styleEpoch,
    autoPinNonce,
    syncNonce,
  ]);

  useEffect(() => {
    if (showSectors) return;
    setSelectedSectorId(null);
    closeSectorPopup(sectorPopupRef);
  }, [showSectors]);

  useEffect(() => {
    setSelectedSectorId(null);
    closeSectorPopup(sectorPopupRef);
    closeBurialPopup(burialPopupRef);
    pinnedBurialPopupRef.current = null;
  }, [cemeterySelectionSignature]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />
      {!mapReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-100/40 backdrop-blur-sm dark:bg-slate-900/40">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--accent)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
