'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { BurialResponse, CemeteryResponse, CoordinateDTO } from '@/types';

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

const MAP_SOURCES = {
  cemeteries: 'add-burial-cemeteries',
  sectors: 'add-burial-sectors',
};

const MAP_LAYERS = {
  cemeteryFill: 'add-burial-cemeteries-fill',
  cemeteryLine: 'add-burial-cemeteries-line',
  sectorFill: 'add-burial-sectors-fill',
  sectorLine: 'add-burial-sectors-line',
};

type MapPoint = {
  latitude: number;
  longitude: number;
};

type CameraSnapshot = {
  center: maplibregl.LngLatLike;
  zoom: number;
  bearing: number;
  pitch: number;
};

type FixedMarkerPoint = {
  id: string;
  latitude: number;
  longitude: number;
  variant?: 'current' | 'next';
};

type BurialRequestLocationMapProps = {
  cemeteries: CemeteryResponse[];
  burials: BurialResponse[];
  selectedCemeteryId: number | null;
  point: MapPoint | null;
  fixedMarkers?: FixedMarkerPoint[];
  showCenterPin?: boolean;
  showBoundary: boolean;
  showSectors: boolean;
  showBurials: boolean;
  interactive: boolean;
  onPointChange: (point: MapPoint) => void;
};

const POINT_FOCUS_ZOOM = 15.6;

function toRing(points: CoordinateDTO[]) {
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

function buildPolygonFeature(points: CoordinateDTO[], properties: Record<string, unknown>) {
  const ring = toRing(points);
  if (ring.length < 4) return null;

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
    properties,
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

function ensureLayerVisibility(map: maplibregl.Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

function fitToCemeteryBounds(map: maplibregl.Map, cemeteries: CemeteryResponse[]) {
  const bounds = new maplibregl.LngLatBounds();
  let hasData = false;

  cemeteries.forEach((cemetery) => {
    cemetery.boundary.forEach((point) => {
      bounds.extend([point.longitude, point.latitude]);
      hasData = true;
    });
  });

  if (hasData) {
    map.fitBounds(bounds, { padding: 54, duration: 450, maxZoom: 15.4 });
    return;
  }

  map.easeTo({ center: [82.9, 55.03], zoom: 10, duration: 450 });
}

function syncAreaLayers(
  map: maplibregl.Map,
  cemeteryData: GeoJSON.FeatureCollection,
  sectorData: GeoJSON.FeatureCollection,
  showBoundary: boolean,
  showSectors: boolean
) {
  setSourceData(map, MAP_SOURCES.cemeteries, cemeteryData);
  setSourceData(map, MAP_SOURCES.sectors, sectorData);

  if (!map.getLayer(MAP_LAYERS.cemeteryFill)) {
    map.addLayer({
      id: MAP_LAYERS.cemeteryFill,
      type: 'fill',
      source: MAP_SOURCES.cemeteries,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.1,
      },
    });
  }

  if (!map.getLayer(MAP_LAYERS.cemeteryLine)) {
    map.addLayer({
      id: MAP_LAYERS.cemeteryLine,
      type: 'line',
      source: MAP_SOURCES.cemeteries,
      paint: {
        'line-color': '#1d4ed8',
        'line-width': 2.8,
      },
    });
  }

  if (!map.getLayer(MAP_LAYERS.sectorFill)) {
    map.addLayer({
      id: MAP_LAYERS.sectorFill,
      type: 'fill',
      source: MAP_SOURCES.sectors,
      paint: {
        'fill-color': '#22c55e',
        'fill-opacity': 0.07,
      },
    });
  }

  if (!map.getLayer(MAP_LAYERS.sectorLine)) {
    map.addLayer({
      id: MAP_LAYERS.sectorLine,
      type: 'line',
      source: MAP_SOURCES.sectors,
      paint: {
        'line-color': '#16a34a',
        'line-width': 1.5,
        'line-opacity': 0.9,
      },
    });
  }

  ensureLayerVisibility(map, MAP_LAYERS.cemeteryFill, showBoundary);
  ensureLayerVisibility(map, MAP_LAYERS.cemeteryLine, showBoundary);
  ensureLayerVisibility(map, MAP_LAYERS.sectorFill, showSectors);
  ensureLayerVisibility(map, MAP_LAYERS.sectorLine, showSectors);
}

function clearMarkers(markersRef: MutableRefObject<maplibregl.Marker[]>) {
  markersRef.current.forEach((marker) => marker.remove());
  markersRef.current = [];
}

function fitToFixedMarkers(map: maplibregl.Map, points: FixedMarkerPoint[]) {
  if (!points.length) return;

  if (points.length === 1) {
    const point = points[0];
    map.easeTo({
      center: [point.longitude, point.latitude],
      zoom: Math.max(map.getZoom(), POINT_FOCUS_ZOOM),
      duration: 320,
    });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  points.forEach((point) => {
    bounds.extend([point.longitude, point.latitude]);
  });
  map.fitBounds(bounds, { padding: 62, duration: 360, maxZoom: 16.1 });
}

function syncBurialMarkers(
  map: maplibregl.Map,
  markersRef: MutableRefObject<maplibregl.Marker[]>,
  burials: BurialResponse[],
  showBurials: boolean
) {
  clearMarkers(markersRef);
  if (!showBurials) return;

  burials.forEach((burial) => {
    const latitude = Number(burial.latitude);
    const longitude = Number(burial.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const markerElement = document.createElement('div');
    markerElement.className = 'burial-marker burial-marker--tiny';
    markerElement.innerHTML = '<span class="burial-marker__halo"></span><span class="burial-marker__pin"></span>';
    markerElement.setAttribute('aria-hidden', 'true');

    const marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
      .setLngLat([longitude, latitude])
      .addTo(map);

    markersRef.current.push(marker);
  });
}

function syncFixedMarkers(
  map: maplibregl.Map,
  markersRef: MutableRefObject<maplibregl.Marker[]>,
  points: FixedMarkerPoint[]
) {
  clearMarkers(markersRef);
  if (!points.length) return;

  points.forEach((point) => {
    const markerElement = document.createElement('div');
    markerElement.className = `request-fixed-marker request-fixed-marker--${point.variant === 'current' ? 'current' : 'next'}`;
    markerElement.innerHTML = '<span class=\"request-fixed-marker__halo\"></span><span class=\"request-fixed-marker__dot\"></span>';
    markerElement.setAttribute('aria-hidden', 'true');

    const marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
      .setLngLat([point.longitude, point.latitude])
      .addTo(map);

    markersRef.current.push(marker);
  });
}

function arePointsClose(first: MapPoint, second: MapPoint) {
  return Math.abs(first.latitude - second.latitude) < 0.000001 && Math.abs(first.longitude - second.longitude) < 0.000001;
}

function setMapInteractivity(map: maplibregl.Map, interactive: boolean) {
  const method = interactive ? 'enable' : 'disable';
  map.dragPan[method]();
  map.scrollZoom[method]();
  map.boxZoom[method]();
  map.dragRotate[method]();
  map.keyboard[method]();
  map.doubleClickZoom[method]();
  map.touchZoomRotate[method]();

  const controls = map.getContainer().querySelector<HTMLElement>('.maplibregl-control-container');
  if (controls) {
    controls.style.pointerEvents = interactive ? 'auto' : 'none';
    controls.style.opacity = interactive ? '1' : '0.52';
  }
}

export default function BurialRequestLocationMap({
  cemeteries,
  burials,
  selectedCemeteryId,
  point,
  fixedMarkers = [],
  showCenterPin = true,
  showBoundary,
  showSectors,
  showBurials,
  interactive,
  onPointChange,
}: BurialRequestLocationMapProps) {
  const { resolvedTheme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const fixedMarkersRef = useRef<maplibregl.Marker[]>([]);
  const onPointChangeRef = useRef(onPointChange);
  const isProgrammaticMoveRef = useRef(false);
  const styleUrlRef = useRef(STYLES.light);
  const cameraBeforeStyleRef = useRef<CameraSnapshot | null>(null);

  const filteredCemeteries = useMemo(
    () => (selectedCemeteryId == null ? cemeteries : cemeteries.filter((cemetery) => cemetery.id === selectedCemeteryId)),
    [cemeteries, selectedCemeteryId]
  );

  const filteredBurials = useMemo(
    () =>
      (selectedCemeteryId == null ? burials : burials.filter((burial) => burial.cemeteryId === selectedCemeteryId)).filter(
        (burial) => burial.latitude != null && burial.longitude != null
      ),
    [burials, selectedCemeteryId]
  );

  const cemeteryData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: filteredCemeteries
        .map((cemetery) => buildPolygonFeature(cemetery.boundary ?? [], { id: cemetery.id, name: cemetery.name }))
        .filter(Boolean) as GeoJSON.Feature[],
    }),
    [filteredCemeteries]
  );

  const sectorData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: filteredCemeteries
        .flatMap((cemetery) => cemetery.sectors ?? [])
        .map((sector) => buildPolygonFeature(sector.boundary ?? [], { id: sector.id, name: sector.name }))
        .filter(Boolean) as GeoJSON.Feature[],
    }),
    [filteredCemeteries]
  );

  const cemeteryDataRef = useRef(cemeteryData);
  const sectorDataRef = useRef(sectorData);
  const filteredBurialsRef = useRef(filteredBurials);
  const showBoundaryRef = useRef(showBoundary);
  const showSectorsRef = useRef(showSectors);
  const showBurialsRef = useRef(showBurials);
  const pointRef = useRef(point);
  const fixedPointsRef = useRef(fixedMarkers);
  const filteredCemeteriesRef = useRef(filteredCemeteries);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    cemeteryDataRef.current = cemeteryData;
    sectorDataRef.current = sectorData;
    filteredBurialsRef.current = filteredBurials;
    showBoundaryRef.current = showBoundary;
    showSectorsRef.current = showSectors;
    showBurialsRef.current = showBurials;
    pointRef.current = point;
    fixedPointsRef.current = fixedMarkers;
    filteredCemeteriesRef.current = filteredCemeteries;
  }, [cemeteryData, sectorData, filteredBurials, showBoundary, showSectors, showBurials, point, fixedMarkers, filteredCemeteries]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    styleUrlRef.current = resolvedTheme === 'dark' ? STYLES.dark : STYLES.light;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrlRef.current,
      center: [82.9, 55.03],
      zoom: 10,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    const syncVisuals = () => {
      syncAreaLayers(map, cemeteryDataRef.current, sectorDataRef.current, showBoundaryRef.current, showSectorsRef.current);
      syncBurialMarkers(map, markersRef, filteredBurialsRef.current, showBurialsRef.current);
      syncFixedMarkers(map, fixedMarkersRef, fixedPointsRef.current);
    };

    const handleMove = () => {
      if (isProgrammaticMoveRef.current) return;
      const center = map.getCenter();
      onPointChangeRef.current({
        latitude: Number(center.lat.toFixed(6)),
        longitude: Number(center.lng.toFixed(6)),
      });
    };

    map.on('load', () => {
      syncVisuals();

      if (pointRef.current) {
        map.jumpTo({
          center: [pointRef.current.longitude, pointRef.current.latitude],
          zoom: Math.max(map.getZoom(), POINT_FOCUS_ZOOM),
        });
      } else if (fixedPointsRef.current.length) {
        fitToFixedMarkers(map, fixedPointsRef.current);
      } else {
        fitToCemeteryBounds(map, filteredCemeteriesRef.current);
        const center = map.getCenter();
        onPointChangeRef.current({
          latitude: Number(center.lat.toFixed(6)),
          longitude: Number(center.lng.toFixed(6)),
        });
      }

      setMapInteractivity(map, interactive);
      setMapReady(true);
    });

    map.on('style.load', syncVisuals);
    map.on('move', handleMove);

    mapRef.current = map;

    return () => {
      map.off('style.load', syncVisuals);
      map.off('move', handleMove);
      clearMarkers(markersRef);
      clearMarkers(fixedMarkersRef);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = resolvedTheme === 'dark' ? STYLES.dark : STYLES.light;
    if (styleUrlRef.current === nextStyle) return;

    cameraBeforeStyleRef.current = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };

    const restoreStyleVisuals = () => {
      if (cameraBeforeStyleRef.current) {
        map.jumpTo(cameraBeforeStyleRef.current);
        cameraBeforeStyleRef.current = null;
      }
      syncAreaLayers(map, cemeteryDataRef.current, sectorDataRef.current, showBoundaryRef.current, showSectorsRef.current);
      syncBurialMarkers(map, markersRef, filteredBurialsRef.current, showBurialsRef.current);
      syncFixedMarkers(map, fixedMarkersRef, fixedPointsRef.current);
      setMapInteractivity(map, interactive);
      setMapReady(true);
    };

    setMapReady(false);
    map.once('style.load', restoreStyleVisuals);
    map.once('idle', restoreStyleVisuals);

    styleUrlRef.current = nextStyle;
    map.setStyle(nextStyle);
  }, [interactive, resolvedTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncAreaLayers(map, cemeteryData, sectorData, showBoundary, showSectors);
    syncBurialMarkers(map, markersRef, filteredBurials, showBurials);
    syncFixedMarkers(map, fixedMarkersRef, fixedMarkers);
  }, [cemeteryData, sectorData, showBoundary, showSectors, filteredBurials, showBurials, fixedMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;

    const center = map.getCenter();
    const currentPoint = {
      latitude: Number(center.lat.toFixed(6)),
      longitude: Number(center.lng.toFixed(6)),
    };

    if (arePointsClose(currentPoint, point)) return;

    isProgrammaticMoveRef.current = true;
    map.easeTo({
      center: [point.longitude, point.latitude],
      duration: 280,
    });
    window.setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 320);
  }, [point]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setMapInteractivity(map, interactive);
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (point) return;
    if (fixedMarkers.length) {
      fitToFixedMarkers(map, fixedMarkers);
      return;
    }
    fitToCemeteryBounds(map, filteredCemeteries);
  }, [filteredCemeteries, point, fixedMarkers]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />
      {!mapReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-100/40 backdrop-blur-sm dark:bg-slate-900/40">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--accent)] border-t-transparent" />
        </div>
      )}
      {showCenterPin && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="add-burial-center-pin" aria-hidden="true">
            <span className="add-burial-center-pin__halo" />
            <span className="add-burial-center-pin__dot" />
          </div>
        </div>
      )}
    </div>
  );
}
