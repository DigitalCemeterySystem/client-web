import { ShieldAlert, ShieldCheck, UserRound } from 'lucide-react';
import { UserRole } from '@/types';

export type RolePresentation = {
  label: string;
  Icon: typeof UserRound;
  className: string;
};

const rolePresentationMap: Record<UserRole, RolePresentation> = {
  USER: {
    label: 'Пользователь',
    Icon: UserRound,
    className: 'bg-emerald-100 text-emerald-700',
  },
  MODERATOR: {
    label: 'Модератор',
    Icon: ShieldCheck,
    className: 'bg-amber-100 text-amber-700',
  },
  ADMIN: {
    label: 'Администратор',
    Icon: ShieldAlert,
    className: 'bg-rose-100 text-rose-700',
  },
};

export function getRolePresentation(role: UserRole): RolePresentation {
  return rolePresentationMap[role];
}
