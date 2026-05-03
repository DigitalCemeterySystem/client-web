import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('does not render when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Удалить запись?"
        description="Это действие нельзя отменить."
        confirmLabel="Удалить"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls cancel and confirm handlers', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDialog
        open
        title="Удалить запись?"
        description="Это действие нельзя отменить."
        confirmLabel="Удалить"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks actions while pending', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDialog
        open
        pending
        title="Выход"
        description="Завершить текущую сессию?"
        confirmLabel="Выйти"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByRole('button', { name: 'Выполняем...' })).toBeDisabled();
    await user.keyboard('{Escape}');

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
