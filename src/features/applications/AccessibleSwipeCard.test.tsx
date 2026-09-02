import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AccessibleSwipeCard } from '@/features/applications/AccessibleSwipeCard';

describe('AccessibleSwipeCard', () => {
  it('expose des boutons équivalents aux gestes', async () => {
    const user = userEvent.setup();
    const pass = vi.fn();
    const compare = vi.fn();
    const shortlist = vi.fn();
    render(
      <AccessibleSwipeCard
        leftAction={{ label: 'Passer', onAction: pass }}
        middleAction={{ label: 'Comparer', onAction: compare }}
        rightAction={{ label: 'Présélectionner', onAction: shortlist }}
      >
        <h2>Candidature réelle</h2>
      </AccessibleSwipeCard>,
    );

    await user.click(screen.getByRole('button', { name: /Passer/ }));
    await user.click(screen.getByRole('button', { name: /Comparer/ }));
    await user.click(screen.getByRole('button', { name: /Présélectionner/ }));
    expect(pass).toHaveBeenCalledTimes(1);
    expect(compare).toHaveBeenCalledTimes(1);
    expect(shortlist).toHaveBeenCalledTimes(1);
  });

  it('fonctionne au clavier sans déclencher un envoi automatique', async () => {
    const user = userEvent.setup();
    const pass = vi.fn();
    const save = vi.fn();
    const open = vi.fn();
    render(
      <AccessibleSwipeCard
        leftAction={{ label: 'Passer', onAction: pass }}
        onOpen={open}
        openLabel="Ouvrir la candidature"
        rightAction={{ label: 'Enregistrer', onAction: save }}
      >
        <h2>Mission réelle</h2>
      </AccessibleSwipeCard>,
    );
    const card = screen.getByRole('group');
    card.focus();
    await user.keyboard('{ArrowLeft}{ArrowRight}{Enter}');
    expect(pass).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Envoyer/ })).toBeNull();
  });

  it('accepte un geste pointeur et conserve les boutons', () => {
    const pass = vi.fn();
    const save = vi.fn();
    render(
      <AccessibleSwipeCard
        leftAction={{ label: 'Passer', onAction: pass }}
        rightAction={{ label: 'Enregistrer', onAction: save }}
      >
        <h2>Mission tactile</h2>
      </AccessibleSwipeCard>,
    );
    const card = screen.getByRole('group');
    Object.defineProperty(card, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    fireEvent.pointerDown(card, { clientX: 160, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 60, pointerId: 1 });
    expect(pass).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Passer/ })).toBeVisible();
  });
});
