import { describe, expect, it } from 'vitest';

import {
  defaultMissionValues,
  deliverablesFromText,
  missionFormSchema,
} from '@/features/missions/missionSchemas';

const validMission = {
  ...defaultMissionValues,
  applicationDeadline: '2026-09-10',
  budgetMax: 800,
  budgetMin: 500,
  deliverablesText: 'Interface responsive\nDocumentation accessible',
  description:
    'Créer une interface professionnelle, accessible au clavier et correctement documentée.',
  endsOn: '2026-10-15',
  skills: [{ level: 'advanced' as const, skillId: 1 }],
  startsOn: '2026-09-20',
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
      applicationDeadline: '2026-09-25',
      budgetMax: 200,
    });
    expect(result.success).toBe(false);
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
