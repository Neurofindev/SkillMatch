import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { MobileAppNavigation } from '@/components/navigation/AppNavigation';

describe('navigation applicative mobile', () => {
  it('rend la gestion des missions directement accessible', () => {
    render(
      <MemoryRouter>
        <MobileAppNavigation />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Navigation principale mobile',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Missions' }),
    ).toHaveAttribute('href', '/espace/missions');
  });
});
