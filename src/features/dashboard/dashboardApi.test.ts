import { describe, expect, it } from 'vitest';

import { weeklyRankingSchema } from '@/features/dashboard/dashboardApi';

const baseRanking = {
  formulaVersion: 'weekly-completions-v2',
  items: [],
  minimumCompletedMissions: 3,
  minimumProfiles: 3,
  periodEnd: '2026-08-31T10:00:00Z',
  periodStart: '2026-08-24T10:00:00Z',
  sampleCompletedMissions: 2,
  sampleProfiles: 2,
  sufficientData: false,
} as const;

describe('weeklyRankingSchema', () => {
  it('accepte un classement honnêtement vide sous le seuil', () => {
    expect(weeklyRankingSchema.parse(baseRanking).sufficientData).toBe(false);
  });

  it('refuse une ancienne formule non documentée', () => {
    expect(() =>
      weeklyRankingSchema.parse({
        ...baseRanking,
        formulaVersion: 'opaque-score-v1',
      }),
    ).toThrow();
  });

  it('valide une activité réelle avec une note toujours accompagnée du nombre', () => {
    const parsed = weeklyRankingSchema.parse({
      ...baseRanking,
      sufficientData: true,
      sampleCompletedMissions: 3,
      sampleProfiles: 3,
      items: [
        {
          averageRating: 4.5,
          avatarPath: null,
          displayName: 'Talent réel',
          profileId: '11111111-1111-4111-8111-111111111111',
          rankPosition: 1,
          reviewCount: 2,
          username: 'talent-reel',
          weeklyCompletions: 1,
        },
      ],
    });
    expect(parsed.items[0]).toMatchObject({
      averageRating: 4.5,
      reviewCount: 2,
      weeklyCompletions: 1,
    });
  });
});
