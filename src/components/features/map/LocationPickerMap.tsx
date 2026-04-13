'use client';

import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { CemeteryResponse, CoordinateDTO, SectorResponse } from '@/types';

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

type LocationPickerMapProps = {
  cemeteries: CemeteryResponse[];
  sectors?: SectorResponse[];
  value: { latitude: number; longitude: number } | null;
  onSelect: (value: { latitude: number; longitude: number }) => void;
};

function toRing(points: CoordinateDTO[]) {
  const ring = points.map((point) => [point.longitude, point.latitude] as [number, number]);
  if (ring.length < 3) return [];

  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    ring.push([firstLng, firstLat]);
  }

  return ring;
}

function toPolygonFeature(points: CoordinateDTO[], props: Record<string, unknown>) {
  const ring = toRing(points);
  if (ring.length < 4) return null;

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
    properties: props,
  };
}

function buildBounds(map: maplibregl.Map, cemeteries: CemeteryResponse[]) {
  const bounds = new maplibregl.LngLatBounds();
  let hasBounds = false;

  cemeteries.forEach((cemetery) => {
    cemetery.boundary.forEach((point) => {
      bounds.extend([point.longitude, point.latitude]);
      hasBounds = true;
    });
  });

  if (hasBounds) {
    map.fitBounds(bounds, { padding: 56, duration: 0, maxZoom: 14.2 });
  } else if (cemeteries.length === 0) {
    map.jumpTo({ center: [82.9, 55.03], zoom: 10 });
  }
}

export default function LocationPickerMap({
  cemeteries,
  sectors = [],
  value,
  onSelect,
}: LocationPickerMapProps) {
  const { resolvedTheme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const cemeteryData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: cemeteries
        .map((cemetery) => toPolygonFeature(cemetery.boundary ?? [], { id: cemetery.id, name: cemetery.name }))
        .filter(Boolean) as GeoJSON.Feature[],
    }),
    [cemeteries]
  );

  const sectorData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: sectors
        .map((sector) => toPolygonFeature(sector.boundary ?? [], { id: sector.id, name: sector.name }))
        .filter(Boolean) as GeoJSON.Feature[],
    }),
    [sectors]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: resolvedTheme === 'dark' ? STYLES.dark : STYLES.light,
      center: [82.9, 55.03],
      zoom: 10,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      map.addSource('picker-cemeteries', { type: 'geojson', data: cemeteryData });
      map.addSource('picker-sectors', { type: 'geojson', data: sectorData });

      map.addLayer({
        id: 'picker-cemeteries-fill',
        type: 'fill',
        source: 'picker-cemeteries',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.08,
        },
      });
      map.addLayer({
        id: 'picker-cemeteries-line',
        type: 'line',
        source: 'picker-cemeteries',
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 2.8,
        },
      });
      map.addLayer({
        id: 'picker-sectors-line',
        type: 'line',
        source: 'picker-sectors',
        paint: {
          'line-color': '#16a34a',
          'line-width': 1.4,
          'line-opacity': 0.85,
        },
      });

      buildBounds(map, cemeteries);
    });

    map.on('click', (event) => {
      onSelect({
        latitude: Number(event.lngLat.lat.toFixed(6)),
        longitude: Number(event.lngLat.lng.toFixed(6)),
      });
    });

    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [cemeteries, cemeteryData, onSelect, resolvedTheme, sectorData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const cemeterySource = map.getSource('picker-cemeteries') as maplibregl.GeoJSONSource | undefined;
    const sectorSource = map.getSource('picker-sectors') as maplibregl.GeoJSONSource | undefined;
    cemeterySource?.setData(cemeteryData);
    sectorSource?.setData(sectorData);
    buildBounds(map, cemeteries);
  }, [cemeteries, cemeteryData, sectorData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const markerElement = document.createElement('div');
    markerElement.className = 'burial-marker is-active';
    markerElement.innerHTML = '<span class="burial-marker__halo"></span><span class="burial-marker__pin"></span>';

    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
      .setLngLat([value.longitude, value.latitude])
      .addTo(map);

    map.easeTo({
      center: [value.longitude, value.latitude],
      zoom: Math.max(map.getZoom(), 16),
      duration: 350,
    });
  }, [value]);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}
