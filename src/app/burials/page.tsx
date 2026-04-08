export default function BurialsPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">Захоронения</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600 dark:text-stone-300">
          Раздел подготовки. Здесь будет поиск захоронений, карточки персон и фильтры по кладбищу и сектору.
        </p>
      </header>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
        Базовый маршрут добавлен, чтобы навигация работала корректно без ошибок 404.
      </div>
    </section>
  );
}
