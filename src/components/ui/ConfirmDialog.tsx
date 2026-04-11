'use client';

import { useEffect } from 'react';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        onCancel();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onCancel, pending]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <button
        aria-label="Закрыть диалог"
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
        onClick={() => {
          if (!pending) {
            onCancel();
          }
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="surface-card relative z-[81] w-full max-w-md rounded-3xl p-6 sm:p-7"
      >
        <h2 id="confirm-dialog-title" className="text-xl font-semibold text-[color:var(--ink)]">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-muted)]">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-full border border-[#9e3024]/30 bg-[#d04f3f]/10 px-5 py-2.5 text-sm font-semibold text-[#9e3024] transition hover:bg-[#d04f3f]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Выполняем...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
