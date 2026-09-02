import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { RelevanceScore } from '@/features/applications/RelevanceScore';
import type { RelevanceDetails } from '@/features/applications/applicationApi';

const details: RelevanceDetails = {
  calculatedAt: '2026-09-01T12:00:00.000Z',
  components: {
    availability: {
      detail: 'Dates compatibles.',
      label: 'Disponibilité',
      score: 80,
      weight: 20,
    },
    budget: {
      detail: 'Proposition dans la fourchette informative.',
      label: 'Budget informatif',
      score: 100,
      weight: 10,
    },
    mode: {
      detail: 'Mission à distance, aucune distance calculée.',
      label: 'Mode de travail',
      score: 100,
      weight: 15,
    },
    reputation: {
      detail: 'Nouveau profil : valeur neutre.',
      label: 'Réputation',
      score: 50,
      weight: 10,
    },
    skills: {
      detail: 'Niveaux adaptés.',
      label: 'Compétences',
      score: 90,
      weight: 45,
    },
  },
  evidence: { completedMissionCount: 0, reviewCount: 0 },
  factors: [
    { label: 'Compétences', value: 90 },
    { label: 'Mode de travail', value: 100 },
  ],
  missingData: ['Aucun avis vérifié'],
  notice: 'Ce score aide au tri et ne prédit pas une embauche.',
  score: 86,
  version: 'relevance-v1',
};

describe('RelevanceScore', () => {
  it('présente une pertinence explicable sans probabilité d’embauche', () => {
    render(<RelevanceScore details={details} />);
    expect(screen.getByRole('region')).toHaveAccessibleName(
      'Pertinence 86 sur 100',
    );
    expect(screen.getByText('86/100')).toBeVisible();
    expect(screen.getByText(/ne prédit pas une embauche/i)).toBeVisible();
    expect(screen.queryByText(/chance/i)).not.toBeInTheDocument();
    expect(screen.getByText('Aucun avis vérifié')).toBeVisible();
  });

  it('rend chaque composante compréhensible par son libellé', async () => {
    const user = userEvent.setup();
    render(<RelevanceScore details={details} />);
    await user.click(screen.getByText('Voir la formule détaillée'));
    expect(
      screen.getByRole('progressbar', { name: 'Compétences 90 sur 100' }),
    ).toHaveAttribute('value', '90');
    expect(screen.getByText(/aucune distance calculée/i)).toBeVisible();
    expect(screen.getByText(/valeur neutre/i)).toBeVisible();
  });
});
