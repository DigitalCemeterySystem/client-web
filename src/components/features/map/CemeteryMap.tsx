'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { CemeteryResponse, SectorResponse, BurialResponse } from '@/types';

interface CemeteryMapProps {
  cemetery?: CemeteryResponse | null;
  sectors?: SectorResponse[];
  burials?: BurialResponse[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  showBoundary?: boolean;
  showSectors?: boolean;
  showBurials?: boolean;
}

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', // Более яркий дизайн
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};

export default function CemeteryMap({ 
  cemetery,
  sectors,
  burials, 
  center = [82.9, 55.0], 
  zoom = 10,
  showBoundary = true,
  showSectors = true,
  showBurials = true
}: CemeteryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLES[resolvedTheme as keyof typeof STYLES] || STYLES.light,
      center: center,
      zoom: zoom,
      attributionControl: false,
    });

    mapInstance.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    const map = mapInstance.current;
    
    map.on('load', () => {
      setMapLoaded(true);
    });

    // Когда стиль меняется, слои стираются. Нужно перерисовать.
    map.on('styledata', () => {
       if (map.isStyleLoaded()) {
          // Инициируем перерисовку слоев
          setMapLoaded(false);
          setTimeout(() => setMapLoaded(true), 50);
       }
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync theme
  useEffect(() => {
    if (!mapInstance.current) return;
    mapInstance.current.setStyle(STYLES[resolvedTheme as keyof typeof STYLES] || STYLES.light);
  }, [resolvedTheme]);

  // Центрируем камеру только при смене выбранного кладбища!
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current || !cemetery?.boundary || cemetery.boundary.length === 0) return;
    
    // Считаем центр (Average point of polygon)
    const lats = cemetery.boundary.map(c => c.latitude);
    const lngs = cemetery.boundary.map(c => c.longitude);
    const centerPoint: [number, number] = [
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
      lats.reduce((a, b) => a + b, 0) / lats.length
    ];

    mapInstance.current.flyTo({ center: centerPoint, zoom: 15.5, duration: 1500 });
  }, [cemetery?.id, mapLoaded]);

  // Draw GeoJSON Layers
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    const map = mapInstance.current;
    
    const drawGeoLayer = (id: string, data: GeoJSON.FeatureCollection, color: string, fillOpacity: number) => {
      // Удаляем если есть (актуально при смене стиля)
      if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
      if (map.getLayer(`${id}-glow`)) map.removeLayer(`${id}-glow`);
      if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
      if (map.getSource(id)) map.removeSource(id);

      map.addSource(id, { type: 'geojson', data });

      // Заполнение
      map.addLayer({
        id: `${id}-fill`,
        type: 'fill',
        source: id,
        paint: { 'fill-color': color, 'fill-opacity': fillOpacity }
      });

      // Неоновое свечение (мягкая линия)
      map.addLayer({
        id: `${id}-glow`,
        type: 'line',
        source: id,
        paint: { 
          'line-color': color, 
          'line-width': 8, 
          'line-blur': 4,
          'line-opacity': 0.6 
        }
      });

      // Четкая линия
      map.addLayer({
        id: `${id}-line`,
        type: 'line',
        source: id,
        paint: { 'line-color': color, 'line-width': 2 }
      });

      const visibility = (id.includes('cemetery') ? showBoundary : showSectors) ? 'visible' : 'none';
      [`${id}-fill`, `${id}-glow`, `${id}-line`].forEach(lId => {
        if (map.getLayer(lId)) map.setLayoutProperty(lId, 'visibility', visibility);
      });
    };

    // Cemetery Boundary
    const cemeteryData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: cemetery?.boundary ? [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [cemetery.boundary.map(c => [c.longitude, c.latitude])]
        },
        properties: {}
      }] : []
    };
    drawGeoLayer('cemetery-boundary', cemeteryData, '#3b82f6', 0.05);

    // Sectors
    const sectorsData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: (sectors || []).map(s => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [s.boundary.map(c => [c.longitude, c.latitude])]
        },
        properties: { id: s.id, name: s.name }
      }))
    };
    drawGeoLayer('sectors-boundary', sectorsData, '#10b981', 0.15);

  }, [cemetery, sectors, mapLoaded, showBoundary, showSectors]);

  // Handle Burials as markers
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (showBurials && burials) {
      burials.forEach(burial => {
        if (!burial.latitude || !burial.longitude) return;

        const el = document.createElement('div');
        el.className = 'group relative flex items-center justify-center';
        el.innerHTML = `
          <div class="w-4 h-4 bg-stone-900 dark:bg-stone-100 rounded-full border-2 border-white dark:border-stone-900 shadow-lg cursor-pointer hover:scale-125 hover:bg-blue-600 transition-all z-10"></div>
          <div class="absolute -top-1 w-2 h-2 bg-blue-500 rounded-full blur-[2px] opacity-0 group-hover:opacity-100 animate-ping"></div>
        `;

        const picUrl = burial.photoUrl || (burial as any).photo;
        const bioText = burial.biography || (burial as any).shortInfo || '';

        const popup = new maplibregl.Popup({ offset: 25, maxWidth: '300px', className: 'modern-popup' })
          .setHTML(`
            <div class="overflow-hidden rounded-xl bg-white dark:bg-slate-900 dark:text-slate-100 border dark:border-slate-700/50 shadow-2xl">
              ${picUrl ? `<img src="${picUrl}" referrerPolicy="no-referrer" class="w-full h-40 object-cover" />` : '<div class="h-12 bg-slate-100 dark:bg-slate-800"></div>'}
              <div class="p-4">
                <h3 class="font-bold text-lg leading-tight text-slate-800 dark:text-slate-100">${burial.fullName}</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-semibold">${burial.birthDate || '?'} — ${burial.deathDate || '?'}</p>
                <div class="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">${bioText}</div>
                <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
                   <span class="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md font-bold shadow-sm">Сектор ${burial.sectorName || '?'}</span>
                   <button class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:underline font-bold transition-colors">Биография</button>
                </div>
              </div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([burial.longitude, burial.latitude])
          .setPopup(popup)
          .addTo(mapInstance.current!);
        
        markersRef.current.push(marker);
      });
    }
  }, [burials, mapLoaded, showBurials]);

  return (
    <div className="relative w-full h-full group/map">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Кастомный оверлей для статуса загрузки */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-sm z-50">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

