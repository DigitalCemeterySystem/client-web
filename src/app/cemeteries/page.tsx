'use client';

import { useCemeteries } from '@/hooks/useCemeteries';
import { useBurials } from '@/hooks/useBurials';
import type { CemeteryResponse } from '@/types';
import dynamic from 'next/dynamic';
import { Loader2, ChevronLeft, ChevronRight, Layers, Eye, Map as MapIcon, Users } from 'lucide-react';
import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CemeteryMap = dynamic(() => import('@/components/features/map/CemeteryMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full min-h-[400px] bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
});

export default function CemeteriesPage() {
  const { cemeteries, loading: cLoading, error: cError } = useCemeteries();
  const { burials, loading: bLoading } = useBurials();
  
  const [selectedCemetery, setSelectedCemetery] = useState<CemeteryResponse | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Layer visibility state
  const [layers, setLayers] = useState({
    boundary: true,
    sectors: true,
    burials: true
  });

  if (cLoading) {
    return (
      <div className="flex-1 flex justify-center items-center dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-[calc(100vh-64px)] overflow-hidden relative dark:bg-slate-950 font-sans">
      
      {/* Левая панель: Список кладбищ */}
      <aside className={cn(
        "bg-white dark:bg-slate-900 border-r dark:border-slate-800 transition-all duration-300 ease-in-out z-20 flex flex-col shadow-xl flex-shrink-0 h-full",
        isSidebarOpen ? "w-80 md:w-96 translate-x-0" : "w-0 -translate-x-full overflow-hidden opacity-0 border-none"
      )}>
        <div className="p-5 border-b dark:border-slate-800 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Кладбища</h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {cemeteries.map(cemetery => (
            <button 
              key={cemetery.id}
              onClick={() => setSelectedCemetery(cemetery)}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all group shrink-0",
                selectedCemetery?.id === cemetery.id 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-1 ring-blue-500/50" 
                  : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50/50 dark:bg-slate-800/30"
              )}
            >
              <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                {cemetery.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{cemetery.address}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                  ID {cemetery.id}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {cemetery.sectors?.length || 0} Секторов
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Кнопка открытия панели (если закрыта) */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-30 p-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border dark:border-slate-800 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-slate-700 dark:text-slate-300 hover:text-blue-600"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Контейнер Карты */}
      <main className="flex-1 relative bg-slate-100 dark:bg-slate-950 overflow-hidden">
        
        {/* Виджет управления слоями (справа сверху) */}
        <div className="absolute top-4 right-4 z-10">
          {/* Панель слоев */}
          <div className="p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border dark:border-slate-800 rounded-xl shadow-lg flex flex-col gap-2 min-w-[140px]">
             <div className="flex items-center gap-2 mb-1 px-1">
               <Layers size={14} className="text-slate-400" />
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Слои</span>
             </div>
             
             <LayerToggle 
               active={layers.boundary} 
               onClick={() => setLayers(l => ({ ...l, boundary: !l.boundary }))}
               icon={<MapIcon size={14} />} 
               label="Границы" 
             />
             <LayerToggle 
               active={layers.sectors} 
               onClick={() => setLayers(l => ({ ...l, sectors: !l.sectors }))}
               icon={<Layers size={14} />} 
               label="Сектора" 
             />
             <LayerToggle 
               active={layers.burials} 
               onClick={() => setLayers(l => ({ ...l, burials: !l.burials }))}
               icon={<Users size={14} />} 
               label="Захоронения" 
             />
          </div>
        </div>

        {/* Сама карта */}
        <div className="w-full h-full">
          <CemeteryMap 
            cemetery={selectedCemetery}
            sectors={selectedCemetery?.sectors}
            burials={selectedCemetery ? burials.filter(b => b.cemeteryName === selectedCemetery.name) : []}
            showBoundary={layers.boundary}
            showSectors={layers.sectors}
            showBurials={layers.burials}
          />
        </div>

        {/* Лоадер данных */}
        {bLoading && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border dark:border-slate-800 rounded-full shadow-2xl flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-blue-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Загрузка данных...</span>
          </div>
        )}
      </main>
    </div>
  );
}

function LayerToggle({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-xs font-semibold w-full",
        active 
          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
      )}
    >
      {icon}
      <span>{label}</span>
      <div className={cn(
        "ml-auto w-1.5 h-1.5 rounded-full transition-all duration-300",
        active ? "bg-white scale-125 shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "bg-slate-400 dark:bg-slate-600"
      )} />
    </button>
  );
}

