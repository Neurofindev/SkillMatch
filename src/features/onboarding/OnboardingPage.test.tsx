import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingPage } from '@/features/onboarding/OnboardingPage';

const mocks = vi.hoisted(() => ({
  auth: {
    refreshProfile: vi.fn(),
    session: null as null | { user: { user_metadata: Record<string, unknown> } },
    user: undefined as
      | undefined
      | { emailConfirmed: boolean; id: string },
  },
  getOnboardingDraft: vi.fn(),
  listSkills: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));

vi.mock('@/features/profiles/profileApi', () => ({
  getFrenchProfileError: () => 'Une erreur est survenue.',
  getOnboardingDraft: mocks.getOnboardingDraft,
  isUsernameAvailable: vi.fn(),
  listSkills: mocks.listSkills,
  saveOnboardingDraft: vi.fn(),
  saveProfile: vi.fn(),
}));

function TestTree() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('reprise de l’onboarding', () => {
  beforeEach(() => {
    mocks.auth.session = null;
    mocks.auth.user = undefined;
    mocks.getOnboardingDraft.mockReset();
    mocks.listSkills.mockReset();
    mocks.listSkills.mockResolvedValue([]);
    mocks.getOnboardingDraft.mockResolvedValue({
      current_step: 5,
      payload: {
        adultConfirmed: true,
        avatarPath: null,
        availabilityEnd: '2026-10-02',
        availabilityStart: '2026-09-02',
        availabilityVisibility: 'matched',
        bio: 'Une présentation suffisamment détaillée.',
        capability: 'both',
        city: 'Fort-de-France',
        countryCode: 'MQ',
        displayName: 'Profil test',
        headline: '',
        showApproximateLocation: true,
        skills: [{ level: 'advanced', skillId: 1 }],
        username: 'profil-test',
        workPreference: 'both',
      },
    });
  });

  it('attend la restauration de session avant de charger le brouillon', async () => {
    const view = render(<TestTree />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Identité publique' }),
    ).toBeVisible();

    mocks.auth.user = { emailConfirmed: true, id: 'user-restored' };
    view.rerender(<TestTree />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Compétences' }),
    ).toBeVisible();
    expect(mocks.getOnboardingDraft).toHaveBeenCalledTimes(1);
  });
});
