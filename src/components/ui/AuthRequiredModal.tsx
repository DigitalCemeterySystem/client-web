'use client';

import Link from 'next/link';

type AuthRequiredModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
};

export default function AuthRequiredModal({
  open,
  title = 'Нужна авторизация',
  description = 'Сначала авторизуйтесь, чтобы отправлять заявки на изменение данных.',
  onClose,
}: AuthRequiredModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={onClose} aria-label="Закрыть окно" />
      <section className="surface-card relative z-[91] w-full max-w-md rounded-3xl p-6 sm:p-7">
        <h3 className="text-xl font-semibold text-[color:var(--ink)]">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-muted)]">{description}</p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
          >
            Отмена
          </button>
          <Link href="/login" className="pill-action px-5 py-2.5 text-sm font-semibold" onClick={onClose}>
            Войти
          </Link>
        </div>
      </section>
    </div>
  );
}
