'use client';

import Link from 'next/link';
import { FileText, Filter, PencilLine, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { changeRequestService } from '@/core/api/change-request.service';
import { getRolePresentation } from '@/core/auth/role-presentation';
import {
  formatDateTime,
  getRequestTitle,
  getStatusClassName,
  operationIcons,
  operationLabels,
  statusIcons,
  statusLabels,
  targetIcons,
  targetLabels,
} from '@/components/features/requests/change-request-ui';
import type {
  ChangeRequestOperationType,
  ChangeRequestResponse,
  ChangeRequestStatus,
  ChangeRequestTargetType,
  UserProfileResponse,
} from '@/types';

type RequestsScope = 'my' | 'users';

type ChangeRequestsPanelProps = {
  currentUser: UserProfileResponse;
  scope: RequestsScope;
  initialRequestId?: number | null;
};

export default function ChangeRequestsPanel({
  currentUser,
  scope,
  initialRequestId = null,
}: ChangeRequestsPanelProps) {
  const canModerate = currentUser.role === 'MODERATOR' || currentUser.role === 'ADMIN';
  const [requests, setRequests] = useState<ChangeRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightedRequestId, setHighlightedRequestId] = useState<number | null>(initialRequestId);

  const [statusFilter, setStatusFilter] = useState<'ALL' | ChangeRequestStatus>('ALL');
  const [operationFilter, setOperationFilter] = useState<'ALL' | ChangeRequestOperationType>('ALL');
  const [targetFilter, setTargetFilter] = useState<'ALL' | ChangeRequestTargetType>('ALL');

  useEffect(() => {
    let active = true;

    async function loadRequests() {
      if (scope === 'users' && !canModerate) {
        setRequests([]);
        setLoading(false);
        setError('Раздел доступен только модераторам и администраторам.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const loaded = scope === 'users' ? await changeRequestService.getAll() : await changeRequestService.getMy();
        if (!active) return;

        setRequests(loaded);
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить заявки.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRequests();
    return () => {
      active = false;
    };
  }, [canModerate, scope]);

  useEffect(() => {
    setHighlightedRequestId(initialRequestId);
    if (!initialRequestId) return;

    const timeout = window.setTimeout(() => {
      setHighlightedRequestId((current) => (current === initialRequestId ? null : current));
    }, 3800);

    return () => window.clearTimeout(timeout);
  }, [initialRequestId]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (statusFilter !== 'ALL' && request.status !== statusFilter) return false;
      if (operationFilter !== 'ALL' && request.operationType !== operationFilter) return false;
      if (targetFilter !== 'ALL' && request.targetType !== targetFilter) return false;
      return true;
    });
  }, [operationFilter, requests, statusFilter, targetFilter]);

  const sortedRequests = useMemo(() => {
    return filteredRequests
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }, [filteredRequests]);

  function resetFilters() {
    setStatusFilter('ALL');
    setOperationFilter('ALL');
    setTargetFilter('ALL');
  }

  if (loading) {
    return (
      <section className="surface-muted rounded-3xl p-6 sm:p-8">
        <p className="text-sm text-[color:var(--ink-muted)]">Загружаем заявки...</p>
      </section>
    );
  }

  return (
    <section className="surface-muted rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--ink)]">
              {scope === 'users' ? 'Заявки пользователей' : 'Мои заявки'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">
              Показано заявок по текущим фильтрам: <span className="font-semibold text-[color:var(--ink)]">{sortedRequests.length}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
          >
            <RotateCcw size={14} />
            Сбросить фильтры
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <FilterSelect label="Статус" value={statusFilter} onChange={setStatusFilter} options={['ALL', 'PENDING', 'APPROVED', 'REJECTED']} />
          <FilterSelect label="Вид" value={operationFilter} onChange={setOperationFilter} options={['ALL', 'ADD', 'EDIT']} />
          <FilterSelect label="Тип" value={targetFilter} onChange={setTargetFilter} options={['ALL', 'BURIAL', 'CEMETERY']} />
        </div>

        {error && <p className="rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}

        {sortedRequests.length > 0 ? (
          <div className="space-y-3">
            {sortedRequests.map((request) => {
              const StatusIcon = statusIcons[request.status];
              const OperationIcon = operationIcons[request.operationType];
              const TargetIcon = targetIcons[request.targetType];
              const reviewerRolePresentation = request.reviewedByRole ? getRolePresentation(request.reviewedByRole) : null;
              const canEditOwnPending =
                scope === 'my' && request.authorUserId === currentUser.id && request.status === 'PENDING';

              return (
                <article
                  key={request.id}
                  className={[
                    'surface-card rounded-3xl p-5 transition',
                    highlightedRequestId === request.id ? 'ring-2 ring-[color:var(--accent)]/35 animate-pulse' : '',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(request.status)}`}>
                          <StatusIcon size={13} />
                          {statusLabels[request.status]}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-strong)]">
                          <OperationIcon size={13} />
                          {operationLabels[request.operationType]}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--bg-elevated)] px-3 py-1 text-xs font-semibold text-[color:var(--ink-muted)]">
                          <TargetIcon size={13} />
                          {targetLabels[request.targetType]}
                        </span>
                      </div>

                      <h3 className="text-2xl font-semibold text-[color:var(--ink)]">{getRequestTitle(request.id)}</h3>

                      {scope === 'users' && (
                        <p className="text-sm text-[color:var(--ink-muted)]">
                          Автор: <span className="font-medium text-[color:var(--ink)]">{request.authorUsername}</span>
                        </p>
                      )}

                      <div className="grid gap-2 text-sm text-[color:var(--ink-muted)] sm:grid-cols-2">
                        <p>Создана: {formatDateTime(request.createdAt)}</p>
                        <p>Изменена: {formatDateTime(request.updatedAt)}</p>
                        {request.status !== 'PENDING' && (
                          <>
                            <p>Когда рассмотрена: {formatDateTime(request.reviewedAt)}</p>
                            <div className="sm:col-span-2 inline-flex items-center gap-2 whitespace-nowrap">
                              Кем рассмотрена:{' '}
                              <span className="font-medium text-[color:var(--ink)]">
                                {request.reviewedByUsername ?? 'Не указано'}
                              </span>
                              {reviewerRolePresentation && (
                                <span
                                  className={[
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                    reviewerRolePresentation.className,
                                  ].join(' ')}
                                >
                                  <reviewerRolePresentation.Icon className="h-3.5 w-3.5" />
                                  {reviewerRolePresentation.label}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between gap-4 lg:min-w-[180px] lg:self-stretch">
                      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 text-right">
                        <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                          <FileText className="h-3 w-3" />
                          Полей
                        </p>
                        <p className="mt-1 text-xl font-semibold text-[color:var(--ink)]">{request.fields.length}</p>
                      </div>

                      <div className="flex w-full flex-wrap justify-end gap-2">
                        {canEditOwnPending && (
                          <Link
                            href={`/add/burial?mode=draft&requestId=${request.id}`}
                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                          >
                            <PencilLine className="mr-1.5 h-4 w-4" />
                            Редактировать
                          </Link>
                        )}
                        <Link
                          href={`/profile/requests/${request.id}?scope=${scope}`}
                          className="pill-action inline-flex items-center justify-center px-4 py-2 text-sm font-semibold"
                        >
                          Подробнее
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-4 py-10 text-center text-sm text-[color:var(--ink-muted)]">
            По текущим фильтрам заявок не найдено.
          </div>
        )}
      </div>
    </section>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: T[];
}) {
  return (
    <label className="block">
      <span className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
        <Filter size={13} />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'ALL'
              ? 'Все'
              : statusLabels[option as ChangeRequestStatus] ||
                operationLabels[option as ChangeRequestOperationType] ||
                targetLabels[option as ChangeRequestTargetType]}
          </option>
        ))}
      </select>
    </label>
  );
}
