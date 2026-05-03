import { getRolePresentation } from './role-presentation';

describe('getRolePresentation', () => {
  it('returns human-readable labels for supported roles', () => {
    expect(getRolePresentation('USER').label).toBe('Пользователь');
    expect(getRolePresentation('MODERATOR').label).toBe('Модератор');
    expect(getRolePresentation('ADMIN').label).toBe('Администратор');
  });
});
