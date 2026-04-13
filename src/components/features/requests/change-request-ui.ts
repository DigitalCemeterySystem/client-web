import {
  CheckCircle2,
  Clock3,
  MapPinned,
  Landmark,
  PencilLine,
  PlusCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ChangeRequestOperationType, ChangeRequestStatus, ChangeRequestTargetType } from '@/types';

export const statusLabels: Record<ChangeRequestStatus, string> = {
  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
};

export const operationLabels: Record<ChangeRequestOperationType, string> = {
  ADD: 'Добавление',
  EDIT: 'Редактирование',
};

export const targetLabels: Record<ChangeRequestTargetType, string> = {
  BURIAL: 'Захоронение',
  CEMETERY: 'Кладбище',
};

export const operationIcons: Record<ChangeRequestOperationType, LucideIcon> = {
  ADD: PlusCircle,
  EDIT: PencilLine,
};

export const targetIcons: Record<ChangeRequestTargetType, LucideIcon> = {
  BURIAL: MapPinned,
  CEMETERY: Landmark,
};

export const statusIcons: Record<ChangeRequestStatus, LucideIcon> = {
  PENDING: Clock3,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
};

export function getStatusClassName(status: ChangeRequestStatus) {
  if (status === 'APPROVED') return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
  if (status === 'REJECTED') return 'bg-[#d04f3f]/10 text-[#9e3024]';
  return 'bg-amber-500/12 text-amber-700 dark:text-amber-300';
}

export function formatDateTime(value: string | null) {
  if (!value) return 'Не указано';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function getRequestTitle(requestId: number) {
  return `Заявка #${requestId}`;
}
