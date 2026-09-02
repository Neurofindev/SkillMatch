import type {
  MissionSearchFilters,
  MissionStatus,
  MissionSummary,
} from '@/features/missions/missionApi';
import {
  SKILL_LEVELS,
  WORK_MODES,
  type SkillLevel,
  type WorkMode,
} from '@/features/missions/missionSchemas';

const statusLabels: Record<MissionStatus, string> = {
  assigned: 'Attribuée',
  cancelled: 'Annulée',
  completed: 'Terminée',
  draft: 'Brouillon',
  in_progress: 'En cours',
  published: 'Publiée',
  selecting: 'Sélection en cours',
};

const levelLabels: Record<SkillLevel, string> = {
  advanced: 'Avancé',
  beginner: 'Débutant',
  expert: 'Expert',
  intermediate: 'Intermédiaire',
};

export function formatMissionStatus(status: MissionStatus): string {
  return statusLabels[status];
}

export function formatSkillLevel(level: SkillLevel): string {
  return levelLabels[level];
}

export function formatMissionBudget(mission: {
  budgetMax: number | null;
  budgetMin: number | null;
  budgetModel: 'fixed' | 'hourly';
  currencyCode: string;
}): string {
  const formatter = new Intl.NumberFormat('fr-FR', {
    currency: mission.currencyCode,
    maximumFractionDigits: 0,
    style: 'currency',
  });
  const min = mission.budgetMin;
  const max = mission.budgetMax;
  const amount =
    min !== null && max !== null && min !== max
      ? `${formatter.format(min)} – ${formatter.format(max)}`
      : formatter.format(max ?? min ?? 0);
  return `${amount}${mission.budgetModel === 'hourly' ? ' / heure' : ''} · budget informatif`;
}

export function formatMissionDate(value: string | null): string {
  if (!value) return 'À convenir';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function getMissionLocation(
  mission: Pick<MissionSummary, 'publicCity' | 'publicRegion' | 'workMode'>,
): string {
  if (mission.workMode === 'remote') {
    return 'À distance · aucune distance calculée';
  }
  const zone = [mission.publicCity, mission.publicRegion]
    .filter(Boolean)
    .join(', ');
  return mission.workMode === 'hybrid'
    ? `Hybride · ${zone || 'zone approximative'}`
    : `Sur place · ${zone || 'zone approximative'}`;
}

function parseCsv<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] {
  if (!value) return [];
  return value
    .split(',')
    .filter((item): item is T => allowed.includes(item as T));
}

function parsePositiveNumbers(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map(Number)
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function missionFiltersFromParams(
  params: URLSearchParams,
  favoritesOnly = false,
): MissionSearchFilters {
  const requestedPage = Number(params.get('page'));
  const sort = params.get('tri');
  const budgetMax = parseOptionalNumber(params.get('budgetMax'));
  const budgetMin = parseOptionalNumber(params.get('budgetMin'));
  const category = params.get('categorie');
  const city = params.get('ville');
  const endsAfter = params.get('finApres');
  const query = params.get('q');
  const startsBefore = params.get('debutAvant');
  return {
    ...(budgetMax !== undefined ? { budgetMax } : {}),
    ...(budgetMin !== undefined ? { budgetMin } : {}),
    ...(category ? { category } : {}),
    ...(city ? { city } : {}),
    ...(endsAfter ? { endsAfter } : {}),
    favoritesOnly,
    page:
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: 9,
    ...(query ? { query } : {}),
    requiredLevels: parseCsv<SkillLevel>(params.get('niveaux'), SKILL_LEVELS),
    skillIds: parsePositiveNumbers(params.get('competences')),
    sort: sort === 'newest' || sort === 'budget_desc' ? sort : 'relevance',
    ...(startsBefore ? { startsBefore } : {}),
    workModes: parseCsv<WorkMode>(params.get('modes'), WORK_MODES),
  };
}

export function setCsvParam(
  params: URLSearchParams,
  key: string,
  values: readonly (number | string)[],
): void {
  if (values.length) params.set(key, values.join(','));
  else params.delete(key);
}
