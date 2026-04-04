'use client';

import Link from 'next/link';
import { Map, Users, Search, Activity, Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="fixed top-0 w-full h-16 z-50 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center space-x-8">
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="bg-blue-600 p-1.5 rounded-lg group-hover:rotate-12 transition-transform shadow-lg shadow-blue-600/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white uppercase transition-colors">DCS</span>
        </Link>
        
        <div className="hidden lg:flex items-center space-x-1">
          <NavLink href="/cemeteries" icon={<Map className="h-4 w-4" />} text="Кладбища" />
          <NavLink href="/burials" icon={<Users className="h-4 w-4" />} text="Захоронения" />
          <NavLink href="/search" icon={<Search className="h-4 w-4" />} text="Поиск" />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {mounted && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg dark:text-slate-400 transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-slate-600" />}
          </button>
        )}
        
        <button className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
          <Bell size={20} />
        </button>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
        <button className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/10 transition-all active:scale-95">
          Войти
        </button>
      </div>
    </nav>
  );
}

function NavLink({ href, icon, text }: { href: string; icon: React.ReactNode; text: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-bold px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm"
    >
      {icon}
      <span>{text}</span>
    </Link>
  );
}

