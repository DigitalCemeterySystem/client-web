import Link from 'next/link';
import { Map, Users, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12">
      <div className="text-center max-w-2xl space-y-4 animate-fade-in">
        <h1 className="text-5xl font-extrabold tracking-tight text-stone-900 sm:text-6xl">
          Управление <span className="text-primary-600">Цифровыми</span> Кладбищами
        </h1>
        <p className="text-lg text-stone-600">
          Единая платформа для инвентаризации, поиска захоронений и генерации биографий
          на основе открытых данных и AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl animate-slide-up">
        {/* Карточка 1 */}
        <Link href="/cemeteries" className="group glass p-8 rounded-2xl hover:bg-white/90 hover:shadow-xl transition-all cursor-pointer">
          <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Map className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Реестр кладбищ</h2>
          <p className="text-stone-600 mb-6">
            Управление секторами, участками и геозонами. Интерактивная карта объектов.
          </p>
          <div className="flex items-center text-primary-600 font-semibold group-hover:translate-x-2 transition-transform">
            <span>Перейти в реестр</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </div>
        </Link>

        {/* Карточка 2 */}
        <Link href="/burials" className="group glass p-8 rounded-2xl hover:bg-white/90 hover:shadow-xl transition-all cursor-pointer">
          <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Захоронения</h2>
          <p className="text-stone-600 mb-6">
            База усопших, поиск по ФИО, локация на карте и автоматическая генерация биографий.
          </p>
          <div className="flex items-center text-primary-600 font-semibold group-hover:translate-x-2 transition-transform">
            <span>Найти захоронение</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}
