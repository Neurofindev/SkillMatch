import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('expose et bloque son état de chargement', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button isLoading loadingLabel="Enregistrement" onClick={onClick}>
        Enregistrer
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Enregistrement' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
