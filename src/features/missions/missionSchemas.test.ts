import { describe, expect, it } from 'vitest';

import {
  defaultMissionValues,
  deliverablesFromText,
  getTodayIsoDate,
  missionFormSchema,
} from '@/features/missions/missionSchemas';

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getTodayIsoDate(date);
}

const validMission = {
  ...defaultMissionValues,
  applicationDeadline: futureDate(6),
  budgetMax: 800,
  budgetMin: 500,
  deliverablesText: 'Interface responsive\nDocumentation accessible',
  description:
    'Créer une interface professionnelle, accessible au clavier et correctement documentée.',
  endsOn: futureDate(41),
  skills: [{ level: 'advanced' as const, skillId: 1 }],
  startsOn: futureDate(16),
  title: 'Interface React accessible',
};

describe('missionFormSchema', () => {
  it('valide une mission remote sans aucune donnée géographique', () => {
    expect(missionFormSchema.safeParse(validMission).success).toBe(true);
  });

  it('exige une zone approximative pour une mission locale', () => {
    const result = missionFormSchema.safeParse({
      ...validMission,
      workMode: 'local',
    });
    expect(result.success).toBe(false);
  });

  it('exige le détail des présences pour une mission hybride', () => {
    const result = missionFormSchema.safeParse({
      ...validMission,
      publicCity: 'Lyon',
      workMode: 'hybrid',
    });
    expect(result.success).toBe(false);
  });

  it('refuse une plage budgétaire ou des dates incohérentes', () => {
    const result = missionFormSchema.safeParse({
      ...validMission,
      applicationDeadline: futureDate(20),
      budgetMax: 200,
    });
    expect(result.success).toBe(false);
  });

  it('refuse une échéance passée ou une année tronquée', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(
      missionFormSchema.safeParse({
        ...validMission,
        applicationDeadline: getTodayIsoDate(yesterday),
      }).success,
    ).toBe(false);
    expect(
      missionFormSchema.safeParse({
        ...validMission,
        applicationDeadline: '0026-09-05',
      }).success,
    ).toBe(false);
  });

  it('refuse les catégories de contenu interdites côté client', () => {
    const result = missionFormSchema.safeParse({
      ...validMission,
      title: 'Recherche conseil en investissement',
    });
    expect(result.success).toBe(false);
  });

  it('structure les livrables sans lignes vides', () => {
    expect(deliverablesFromText(' Maquette \n\n Documentation ')).toEqual([
      'Maquette',
      'Documentation',
    ]);
  });
});
