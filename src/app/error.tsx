'use client';

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Ошибка загрузки страницы</h2>
      <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
        {error.message || 'Не удалось получить данные. Попробуйте еще раз.'}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
      >
        Повторить
      </button>
    </div>
  );
}
