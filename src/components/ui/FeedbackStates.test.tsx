import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  EmptyState,
  ErrorState,
  OfflineState,
  SuccessState,
} from '@/components/ui/FeedbackStates';

describe('feedback states', () => {
  it('présente un état vide nommé et actionnable', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <EmptyState
        action={{ label: 'Créer', onClick }}
        description="Aucun élément pour le moment."
        title="Liste vide"
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Liste vide' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('annonce immédiatement un état d’erreur', () => {
    render(
      <ErrorState
        description="Réessayez plus tard."
        title="Échec du chargement"
      />,
    );

    expect(screen.getByRole('alert')).toHaveAccessibleName(
      'Échec du chargement',
    );
  });

  it('annonce les états hors ligne et de réussite', () => {
    render(
      <>
        <OfflineState
          description="La connexion sera retestée."
          title="Vous êtes hors ligne"
        />
        <SuccessState description="La demande est prête." title="Terminé" />
      </>,
    );

    expect(screen.getByText('Vous êtes hors ligne')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Terminé' })).toBeInTheDocument();
  });
});
