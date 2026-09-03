import { describe, expect, it } from 'vitest';

import {
  getApplicationEligibility,
  type ApplicationEligibilityReason,
} from '@/features/applications/applicationEligibility';
import type { MissionSummary } from '@/features/missions/missionApi';

function mission(overrides: Partial<MissionSummary> = {}): MissionSummary {
  return {
    applicationCount: null,
    applicationDeadline: '2026-09-10',
    budgetMax: null,
    budgetMin: null,
    budgetModel: 'fixed',
    category: 'Design',
    countryCode: null,
    createdAt: '2026-09-01T00:00:00Z',
    currencyCode: 'EUR',
    deliverables: [],
    description: 'Une mission suffisamment décrite pour le test.',
    endsOn: '2026-09-20',
    flexibleSchedule: false,
    id: 'mission-1',
    isFavorite: false,
    owner: {
      avatarPath: null,
      displayName: 'Client',
      emailVerified: true,
      headline: null,
      id: 'owner-1',
      username: 'client',
    },
    presenceDetails: null,
    publicCity: null,
    publicRegion: null,
    requiredLevel: 'intermediate',
    skills: [],
    startsOn: '2026-09-15',
    status: 'published',
    title: 'Mission test',
    updatedAt: '2026-09-01T00:00:00Z',
    workMode: 'remote',
    ...overrides,
  };
}

function reason(
  value: MissionSummary,
  actor = { canWork: true, id: 'talent-1' },
): ApplicationEligibilityReason {
  return getApplicationEligibility(value, actor, '2026-09-03').reason;
}

describe('éligibilité à une candidature', () => {
  it('autorise un talent sur une mission publiée avant l’échéance', () => {
    expect(reason(mission())).toBe('allowed');
  });

  it('guide un compte configuré uniquement pour publier', () => {
    const result = getApplicationEligibility(
      mission(),
      { canWork: false, id: 'client-2' },
      '2026-09-03',
    );

    expect(result.reason).toBe('work-capability-required');
    expect(result.description).toContain('Activez « trouver une mission »');
  });

  it.each([
    ['owner', mission(), { canWork: true, id: 'owner-1' }],
    [
      'deadline-passed',
      mission({ applicationDeadline: '2026-09-02' }),
      { canWork: true, id: 'talent-1' },
    ],
    [
      'mission-closed',
      mission({ status: 'assigned' }),
      { canWork: true, id: 'talent-1' },
    ],
  ] satisfies Array<
    [
      ApplicationEligibilityReason,
      MissionSummary,
      { canWork: boolean; id: string },
    ]
  >)('refuse le cas %s avant l’envoi', (expected, value, actor) => {
    expect(reason(value, actor)).toBe(expected);
  });
});
