import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders } from '@/app/providers/AppProviders';
import { createTestRouter } from '@/app/router';

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => null,
  getSupabaseConfigurationIssue: () =>
    'La configuration publique Supabase est absente.',
  hasSupabaseConfiguration: () => false,
}));

function renderRoute(path: string) {
  const router = createTestRouter([path]);
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('application routing', () => {
  it('rend l’accueil et navigue vers le fonctionnement au clavier', async () => {
    const user = userEvent.setup();
    const router = renderRoute('/');

    expect(
      await screen.findByRole(
        'heading',
        {
          level: 1,
          name: 'Une mission à publier. Une compétence à proposer.',
        },
        { timeout: 5_000 },
      ),
    ).toBeVisible();

    const link = screen.getByRole('link', { name: 'Fonctionnement' });
    link.focus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole(
        'heading',
        {
          level: 1,
          name: 'Un parcours commun, deux points de vue.',
        },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/fonctionnement');
  });

  it('affiche une vraie page 404 pour une route inconnue', async () => {
    renderRoute('/route-inconnue');
    expect(
      await screen.findByRole(
        'heading',
        {
          level: 1,
          name: 'Cette page n’existe pas.',
        },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
  });

  it('refuse l’espace applicatif lorsque Supabase n’est pas configuré', async () => {
    renderRoute('/espace');
    expect(
      await screen.findByRole(
        'heading',
        {
          level: 2,
          name: 'Connexion Supabase non configurée',
        },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
  });
});
