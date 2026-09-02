import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MatchTimeline } from '@/features/matches/MatchTimeline';
import type { MatchEvent } from '@/features/matches/matchSchemas';

const events: MatchEvent[] = [
  {
    actorDisplayName: 'Camille',
    actorId: 'd0000000-0000-0000-0000-000000000001',
    createdAt: '2026-08-30T12:00:00.000Z',
    id: 1,
    metadata: { action: 'agreement_created' },
    newValues: { status: 'draft' },
    oldValues: null,
    type: 'agreement_updated',
  },
  {
    actorDisplayName: 'Tania',
    actorId: 'd0000000-0000-0000-0000-000000000002',
    createdAt: '2026-08-30T13:00:00.000Z',
    id: 2,
    metadata: { note: 'Rapport final livré.' },
    newValues: null,
    oldValues: null,
    type: 'delivery_submitted',
  },
  {
    actorDisplayName: 'Camille',
    actorId: 'd0000000-0000-0000-0000-000000000001',
    createdAt: '2026-08-30T14:00:00.000Z',
    id: 3,
    metadata: { reason: 'Le besoin a été retiré.' },
    newValues: { status: 'cancelled' },
    oldValues: { status: 'assigned' },
    type: 'mission_cancelled',
  },
];

describe('MatchTimeline', () => {
  it('renders only the persisted events and their audit content', () => {
    render(<MatchTimeline events={events} />);
    expect(screen.getByRole('list')).toHaveAccessibleName(
      'Suivi réel de la mission',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Accord à confirmer')).toBeInTheDocument();
    expect(screen.getByText('Livraison ajoutée')).toBeInTheDocument();
    expect(screen.getByText('Rapport final livré.')).toBeInTheDocument();
    expect(
      screen.getByText('Motif : Le besoin a été retiré.'),
    ).toBeInTheDocument();
  });

  it('states honestly when no event exists', () => {
    render(<MatchTimeline events={[]} />);
    expect(
      screen.getByText('Aucun événement réel n’a encore été enregistré.'),
    ).toBeInTheDocument();
  });
});
