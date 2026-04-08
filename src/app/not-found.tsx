import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">Страница не найдена</h1>
      <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
        Запрошенный раздел отсутствует или был перемещен.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
      >
        На главную
      </Link>
    </div>
  );
}
