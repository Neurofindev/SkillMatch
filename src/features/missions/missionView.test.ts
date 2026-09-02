import { describe, expect, it } from 'vitest';

import {
  formatMissionBudget,
  formatMissionDate,
  formatMissionStatus,
  formatSkillLevel,
  getMissionLocation,
  missionFiltersFromParams,
  setCsvParam,
} from '@/features/missions/missionView';

describe('présentation et filtres des missions', () => {
  it('formate en français les budgets strictement informatifs', () => {
    expect(
      formatMissionBudget({
        budgetMax: 750,
        budgetMin: 500,
        budgetModel: 'fixed',
        currencyCode: 'EUR',
      }),
    ).toMatch(/^500\s?€ – 750\s?€ · budget informatif$/);
    expect(
      formatMissionBudget({
        budgetMax: 50,
        budgetMin: 50,
        budgetModel: 'hourly',
        currencyCode: 'EUR',
      }),
    ).toMatch(/^50\s?€ \/ heure · budget informatif$/);
  });

  it('formate les dates, niveaux et statuts pour un lecteur francophone', () => {
    expect(formatMissionDate('2026-09-15')).toBe('15 septembre 2026');
    expect(formatMissionDate(null)).toBe('À convenir');
    expect(formatSkillLevel('intermediate')).toBe('Intermédiaire');
    expect(formatMissionStatus('in_progress')).toBe('En cours');
  });

  it('n’affiche aucune distance pour une mission remote', () => {
    expect(
      getMissionLocation({
        publicCity: 'Paris',
        publicRegion: 'Île-de-France',
        workMode: 'remote',
      }),
    ).toBe('À distance · aucune distance calculée');
  });

  it('restaure les filtres utiles depuis l’URL', () => {
    const filters = missionFiltersFromParams(
      new URLSearchParams(
        'q=react&modes=remote,hybrid&competences=2,5&niveaux=advanced&page=3&tri=newest',
      ),
    );
    expect(filters).toMatchObject({
      page: 3,
      query: 'react',
      requiredLevels: ['advanced'],
      skillIds: [2, 5],
      sort: 'newest',
      workModes: ['remote', 'hybrid'],
    });
  });

  it('ignore les valeurs de filtre inconnues', () => {
    const filters = missionFiltersFromParams(
      new URLSearchParams('modes=remote,anywhere&niveaux=wizard&page=-2'),
    );
    expect(filters.workModes).toEqual(['remote']);
    expect(filters.requiredLevels).toEqual([]);
    expect(filters.page).toBe(1);
  });

  it('sérialise et retire une sélection multiple', () => {
    const params = new URLSearchParams();
    setCsvParam(params, 'modes', ['local', 'remote']);
    expect(params.get('modes')).toBe('local,remote');
    setCsvParam(params, 'modes', []);
    expect(params.has('modes')).toBe(false);
  });
});
