'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { BurialResponse, CemeteryResponse, SectorResponse } from '@/types';

interface CemeteryMapProps {
  cemetery?: CemeteryResponse | null;
  sectors?: SectorResponse[];
  burials?: BurialResponse[];
  center?: [number, number];
  zoom?: number;
  showBoundary?: boolean;
  showSectors?: boolean;
  showBurials?: boolean;
  focusKey?: number;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getPopupData(burial: BurialResponse) {
  const legacy = burial as BurialLegacyFields;
  return {
    photo: burial.photoUrl ?? legacy.photo ?? null,
    bio: burial.biography ?? legacy.shortInfo ?? '',
  };
}

function polygonFromPoints(points: { longitude: number; latitude: number }[]) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [points.map((point) => [point.longitude, point.latitude])],
    },
    properties: {},
  };
}

function buildCemeteryData(cemetery?: CemeteryResponse | null): GeoJSON.FeatureCollection {
  if (!cemetery?.boundary?.length) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: [polygonFromPoints(cemetery.boundary)],
  };
}

function buildSectorsData(sectors?: SectorResponse[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (sectors ?? []).map((sector) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [sector.boundary.map((point) => [point.longitude, point.latitude])],
      },
      properties: {
        id: sector.id,
        name: sector.name,
      },
    })),
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

function clearMarkers(markersRef: MutableRefObject<maplibregl.Marker[]>) {
  markersRef.current.forEach((marker) => marker.remove());
  markersRef.current = [];
}

function syncMapState(
  map: maplibregl.Map,
  markersRef: MutableRefObject<maplibregl.Marker[]>,
  cemetery: CemeteryResponse | null | undefined,
  sectors: SectorResponse[] | undefined,
  burials: BurialResponse[] | undefined,
  selectedSectorId: number | null,
  showBoundary: boolean,
  showSectors: boolean,
  showBurials: boolean
) {
  if (!map.isStyleLoaded()) return;

  const cemeteryData = buildCemeteryData(cemetery);
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

  clearMarkers(markersRef);
  if (!showBurials || !burials?.length) return;

  burials.forEach((burial) => {
    const latitude = Number(burial.latitude);
    const longitude = Number(burial.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const markerElement = document.createElement('div');
    markerElement.className = 'group relative flex items-center justify-center';
    markerElement.innerHTML = `
      <div class="h-4 w-4 cursor-pointer rounded-full border-2 border-white bg-red-600 shadow-lg transition-all hover:scale-125 hover:bg-red-500"></div>
      <div class="absolute -top-1 h-2 w-2 rounded-full bg-red-400 opacity-0 blur-[2px] transition group-hover:opacity-100"></div>
    `;

    const popupData = getPopupData(burial);
    const fullName = escapeHtml(burial.fullName);
    const dates = `${escapeHtml(burial.birthDate ?? '?')} - ${escapeHtml(burial.deathDate ?? '?')}`;
    const sector = escapeHtml(burial.sectorName || '?');
    const bio = escapeHtml(popupData.bio);

    const popup = new maplibregl.Popup({ offset: 22, maxWidth: '340px', className: 'modern-popup' }).setHTML(`
      <article class="burial-popup-card">
        <header class="burial-popup-head">
          <div class="burial-popup-title">${fullName}</div>
          <div class="burial-popup-dates">${dates}</div>
        </header>
        ${
          popupData.photo
            ? `<img src="${escapeHtml(popupData.photo)}" referrerPolicy="no-referrer" class="burial-popup-image" />`
            : ''
        }
        <div class="burial-popup-body">
          <div class="burial-popup-sector">Квартал: ${sector}</div>
          <p class="burial-popup-bio">${bio || 'Биография отсутствует.'}</p>
        </div>
      </article>
    `);

    const marker = new maplibregl.Marker({ element: markerElement })
      .setLngLat([longitude, latitude])
      .setPopup(popup)
      .addTo(map);

    markersRef.current.push(marker);
  });
}

export default function CemeteryMap({
  cemetery,
  sectors,
  burials,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  showBoundary = true,
  showSectors = true,
  showBurials = true,
  focusKey = 0,
}: CemeteryMapProps) {
  const { resolvedTheme } = useTheme();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const sectorPopupRef = useRef<maplibregl.Popup | null>(null);
  const styleUrlRef = useRef(STYLES.light);
  const cameraBeforeStyleRef = useRef<CameraSnapshot | null>(null);
  const pendingFocusRef = useRef<CemeteryResponse | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSectorsRef = useRef(showSectors);
  const showBoundaryRef = useRef(showBoundary);
  const showBurialsRef = useRef(showBurials);
  const cemeteryRef = useRef(cemetery);
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
    showSectorsRef.current = showSectors;
    showBoundaryRef.current = showBoundary;
    showBurialsRef.current = showBurials;
    cemeteryRef.current = cemetery;
    sectorsRef.current = sectors;
    burialsRef.current = burials;
    selectedSectorIdRef.current = selectedSectorId;
  }, [burials, cemetery, sectors, selectedSectorId, showBoundary, showBurials, showSectors]);

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

      if (pendingFocusRef.current) {
        fitToCemetery(map, pendingFocusRef.current);
        pendingFocusRef.current = null;
      }

      syncMapState(
        map,
        markersRef,
        cemeteryRef.current,
        sectorsRef.current,
        burialsRef.current,
        selectedSectorIdRef.current,
        showBoundaryRef.current,
        showSectorsRef.current,
        showBurialsRef.current
      );

      if (styleTimeoutRef.current) {
        clearTimeout(styleTimeoutRef.current);
        styleTimeoutRef.current = null;
      }

      setMapReady(true);
      setStyleEpoch((prev) => prev + 1);
    };

    const onStyleData = () => {
      finalizeStyleLoad();
    };

    const onMapError = () => {
      if (styleTimeoutRef.current) {
        clearTimeout(styleTimeoutRef.current);
        styleTimeoutRef.current = null;
      }
      setMapReady(true);
    };

    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      if (!showSectorsRef.current) return;
      if (!map.isStyleLoaded()) return;
      if (!map.getLayer(LAYERS.sectorsFill)) return;

      const features = map.queryRenderedFeatures(event.point, { layers: [LAYERS.sectorsFill] });
      const feature = features[0];

      if (!feature) {
        setSelectedSectorId(null);
        if (sectorPopupRef.current) {
          sectorPopupRef.current.remove();
          sectorPopupRef.current = null;
        }
        return;
      }

      const sectorId = Number(feature.properties?.id);
      const sectorName = String(feature.properties?.name ?? 'Сектор');
      setSelectedSectorId(Number.isFinite(sectorId) ? sectorId : null);

      if (sectorPopupRef.current) {
        sectorPopupRef.current.remove();
      }

      sectorPopupRef.current = new maplibregl.Popup({ offset: 14, closeButton: false, closeOnClick: false, className: 'modern-popup' })
        .setLngLat(event.lngLat)
        .setHTML(`
          <div class="sector-popup-card">
            <div class="sector-popup-label">Сектор</div>
            <div class="sector-popup-name">${escapeHtml(sectorName)}</div>
          </div>
        `)
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

    map.on('styledata', onStyleData);
    map.on('load', onStyleData);
    map.on('error', onMapError);
    map.on('click', onMapClick);
    map.on('mousemove', onMouseMove);
    map.on('mouseleave', () => {
      map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;
    onStyleData();

    return () => {
      map.off('styledata', onStyleData);
      map.off('load', onStyleData);
      map.off('error', onMapError);
      map.off('click', onMapClick);
      map.off('mousemove', onMouseMove);

      if (styleTimeoutRef.current) clearTimeout(styleTimeoutRef.current);

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      if (sectorPopupRef.current) {
        sectorPopupRef.current.remove();
        sectorPopupRef.current = null;
      }

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

    if (sectorPopupRef.current) {
      sectorPopupRef.current.remove();
      sectorPopupRef.current = null;
    }

    awaitingStyleLoadRef.current = true;
    map.setStyle(nextStyle);

    if (styleTimeoutRef.current) clearTimeout(styleTimeoutRef.current);
    styleTimeoutRef.current = setTimeout(() => {
      setMapReady(true);
    }, 5000);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!cemetery?.boundary?.length) return;

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      pendingFocusRef.current = cemetery;
      return;
    }

    fitToCemetery(map, cemetery);
  }, [focusKey, cemetery?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

    syncMapState(map, markersRef, cemetery, sectors, burials, selectedSectorId, showBoundary, showSectors, showBurials);
  }, [burials, cemetery, sectors, selectedSectorId, showBoundary, showBurials, showSectors, mapReady, styleEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (!showBurials || !burials?.length) return;

    burials.forEach((burial) => {
      const latitude = Number(burial.latitude);
      const longitude = Number(burial.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const markerElement = document.createElement('div');
      markerElement.className = 'group relative flex items-center justify-center';
      markerElement.innerHTML = `
        <div class="h-4 w-4 cursor-pointer rounded-full border-2 border-white bg-red-600 shadow-lg transition-all hover:scale-125 hover:bg-red-500"></div>
        <div class="absolute -top-1 h-2 w-2 rounded-full bg-red-400 opacity-0 blur-[2px] transition group-hover:opacity-100"></div>
      `;

      const popupData = getPopupData(burial);
      const fullName = escapeHtml(burial.fullName);
      const dates = `${escapeHtml(burial.birthDate ?? '?')} - ${escapeHtml(burial.deathDate ?? '?')}`;
      const sector = escapeHtml(burial.sectorName || '?');
      const bio = escapeHtml(popupData.bio);

      const popup = new maplibregl.Popup({ offset: 22, maxWidth: '340px', className: 'modern-popup' }).setHTML(`
        <article class="burial-popup-card">
          <header class="burial-popup-head">
            <div class="burial-popup-title">${fullName}</div>
            <div class="burial-popup-dates">${dates}</div>
          </header>
          ${
            popupData.photo
              ? `<img src="${escapeHtml(popupData.photo)}" referrerPolicy="no-referrer" class="burial-popup-image" />`
              : ''
          }
          <div class="burial-popup-body">
            <div class="burial-popup-sector">Сектор: ${sector}</div>
            <p class="burial-popup-bio">${bio || 'Биография отсутствует.'}</p>
          </div>
        </article>
      `);

      const marker = new maplibregl.Marker({ element: markerElement })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [burials, showBurials, mapReady, cemetery?.id, focusKey, styleEpoch]);

  useEffect(() => {
    if (showSectors) return;
    setSelectedSectorId(null);
    if (sectorPopupRef.current) {
      sectorPopupRef.current.remove();
      sectorPopupRef.current = null;
    }
  }, [showSectors]);

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
