import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('s’ouvre au clavier, se ferme avec Échap et restitue le focus', async () => {
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        description="La décision doit être confirmée."
        onConfirm={vi.fn()}
        title="Confirmer l’action"
        trigger={<Button>Ouvrir</Button>}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(
      await screen.findByRole('dialog', { name: 'Confirmer l’action' }),
    ).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
