import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { MissionCard } from '@/features/missions/MissionCard';
import type { MissionSummary } from '@/features/missions/missionApi';

const mission: MissionSummary = {
  applicationCount: null,
  applicationDeadline: '2026-09-10',
  budgetMax: 750,
  budgetMin: 500,
  budgetModel: 'fixed',
  category: 'Numérique',
  countryCode: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  currencyCode: 'EUR',
  deliverables: ['Interface accessible'],
  description: 'Audit et correction d’une interface existante.',
  endsOn: '2026-10-15',
  flexibleSchedule: true,
  id: '11111111-1111-4111-8111-111111111111',
  isFavorite: false,
  owner: {
    avatarPath: null,
    displayName: 'Camille Client',
    emailVerified: true,
    headline: 'Produit numérique',
    id: '22222222-2222-4222-8222-222222222222',
    username: 'camille-client',
  },
  presenceDetails: null,
  publicCity: null,
  publicRegion: null,
  requiredLevel: 'advanced',
  skills: [
    {
      category: 'Numérique',
      id: 1,
      importance: 5,
      name: 'Accessibilité web',
      requiredLevel: 'advanced',
    },
  ],
  startsOn: '2026-09-15',
  status: 'published',
  title: 'Audit accessible à distance',
  updatedAt: '2026-09-01T12:00:00.000Z',
  workMode: 'remote',
};

describe('MissionCard', () => {
  it('expose les informations réelles, le budget informatif et aucune distance remote', () => {
    render(
      <MemoryRouter>
        <MissionCard
          mission={mission}
          onShare={vi.fn()}
          onToggleFavorite={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      mission.title,
    );
    expect(screen.getByText(/aucune distance calculée/i)).toBeVisible();
    expect(screen.getByText(/budget informatif/i)).toBeVisible();
    expect(screen.getByText('E-mail vérifié')).toHaveAccessibleName(
      'E-mail confirmé par Supabase',
    );
  });

  it('conserve des boutons nommés pour le favori et le partage', async () => {
    const user = userEvent.setup();
    const favorite = vi.fn();
    const share = vi.fn();
    render(
      <MemoryRouter>
        <MissionCard
          mission={mission}
          onShare={share}
          onToggleFavorite={favorite}
        />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', {
        name: `Ajouter ${mission.title} aux favoris`,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Partager' }));
    expect(favorite).toHaveBeenCalledWith(mission);
    expect(share).toHaveBeenCalledWith(mission);
  });
});
