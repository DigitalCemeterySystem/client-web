import { Suspense } from 'react';
import VerifyEmailContent from '@/components/features/auth/VerifyEmailContent';

function VerifyEmailFallback() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="surface-card w-full rounded-3xl p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">Подтверждение e-mail</p>
        <h1 className="display-font mt-4 text-4xl text-[color:var(--ink)] sm:text-5xl">Подождите пару секунд</h1>
        <p className="mt-4 text-base leading-relaxed text-[color:var(--ink-muted)]">
          Проверяем ссылку подтверждения...
        </p>
      </section>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
