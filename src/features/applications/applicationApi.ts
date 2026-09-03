import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database.generated';

export type ApplicationStatus =
  Database['public']['Enums']['application_status'];
export type ApplicationSwipeDecision =
  Database['public']['Enums']['application_swipe_decision'];
export type MissionSwipeDecision =
  Database['public']['Enums']['swipe_decision'];

const componentSchema = z.object({
  detail: z.string(),
  label: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100),
});

const relevanceSchema = z.object({
  calculatedAt: z.string(),
  components: z.object({
    availability: componentSchema,
    budget: componentSchema,
    mode: componentSchema,
    reputation: componentSchema,
    skills: componentSchema,
  }),
  evidence: z.object({
    completedMissionCount: z.number(),
    reviewCount: z.number(),
  }),
  factors: z.array(z.object({ label: z.string(), value: z.number() })),
  missingData: z.array(z.string()),
  notice: z.string(),
  score: z.number().min(0).max(100),
  version: z.string(),
});

export type RelevanceDetails = z.infer<typeof relevanceSchema>;

const skillSchema = z.object({
  category: z.string(),
  id: z.number(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  name: z.string(),
  yearsExperience: z.number().nullable(),
});

export interface ApplicationItem {
  applicant: {
    avatarPath: string | null;
    bio: string | null;
    city: string | null;
    completedCount: number;
    countryCode: string | null;
    displayName: string;
    emailVerified: boolean;
    experienceYears: number;
    headline: string | null;
    id: string;
    remoteAvailable: boolean;
    reputation: number | null;
    reviewCount: number;
    skills: z.infer<typeof skillSchema>[];
    username: string;
  };
  availabilityNote: string;
  conversationId: string | null;
  createdAt: string;
  id: string;
  lockVersion: number;
  message: string;
  mission: {
    budgetMax: number | null;
    budgetMin: number | null;
    budgetModel: Database['public']['Enums']['budget_model'];
    countryCode: string | null;
    endsOn: string | null;
    id: string;
    publicCity: string | null;
    publicRegion: string | null;
    startsOn: string | null;
    status: Database['public']['Enums']['mission_status'];
    title: string;
    workMode: Database['public']['Enums']['work_mode'];
  };
  owner: {
    avatarPath: string | null;
    displayName: string;
    emailVerified: boolean;
    headline: string | null;
    id: string;
    username: string;
  };
  proposedAmount: number | null;
  proposedCurrencyCode: string;
  relevance: RelevanceDetails;
  relevanceScore: number;
  scoreVersion: string;
  status: ApplicationStatus;
  swipeDecision: ApplicationSwipeDecision | null;
  updatedAt: string;
}

export interface ApplicationFilters {
  applicationId?: string;
  missionId?: string;
  page: number;
  pageSize: number;
  query?: string;
  scope: 'received' | 'talent';
  sort:
    | 'availability'
    | 'experience'
    | 'newest'
    | 'proposal_asc'
    | 'proposal_desc'
    | 'reputation'
    | 'score_desc';
  statuses: ApplicationStatus[];
}

export const applicationQueryKeys = {
  all: ['applications'] as const,
  detail: (id: string) => ['applications', 'detail', id] as const,
  list: (filters: ApplicationFilters) =>
    ['applications', 'list', filters] as const,
  swipeDeck: (scope: 'client' | 'talent') =>
    ['applications', 'swipe-deck', scope] as const,
};

function parseRelevance(value: Json, fallbackScore: number): RelevanceDetails {
  const parsed = relevanceSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return {
    calculatedAt: '',
    components: {
      availability: {
        detail: 'Donnée indisponible.',
        label: 'Disponibilité',
        score: 50,
        weight: 20,
      },
      budget: {
        detail: 'Donnée indisponible.',
        label: 'Budget informatif',
        score: 50,
        weight: 10,
      },
      mode: {
        detail: 'Donnée indisponible.',
        label: 'Mode',
        score: 50,
        weight: 15,
      },
      reputation: {
        detail: 'Valeur neutre en l’absence de données.',
        label: 'Réputation',
        score: 50,
        weight: 10,
      },
      skills: {
        detail: 'Donnée indisponible.',
        label: 'Compétences',
        score: 50,
        weight: 45,
      },
    },
    evidence: { completedMissionCount: 0, reviewCount: 0 },
    factors: [],
    missingData: ['Détail du score indisponible'],
    notice: 'Ce score aide au tri et ne prédit pas une embauche.',
    score: fallbackScore,
    version: 'indisponible',
  };
}

function parseSkills(value: Json): ApplicationItem['applicant']['skills'] {
  const parsed = z.array(skillSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function getFrenchApplicationError(error: unknown): string {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : undefined;
  const message = candidate?.message?.toLowerCase() ?? '';
  if (
    error instanceof TypeError ||
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'Connexion impossible. Vérifiez le réseau puis réessayez.';
  }
  if (candidate?.code === '40001' || message.includes('stale application')) {
    return 'Cette candidature a changé ailleurs. Rechargez la liste avant de recommencer.';
  }
  if (candidate?.code === '23505') {
    return 'Vous avez déjà une candidature active pour cette mission.';
  }
  if (message.includes('own mission')) {
    return 'Vous ne pouvez pas candidater à votre propre mission.';
  }
  if (message.includes('active work capability')) {
    return 'Activez « trouver une mission » dans votre profil avant de candidater.';
  }
  if (message.includes('deadline')) {
    return 'L’échéance de candidature est dépassée.';
  }
  if (message.includes('application limit')) {
    return 'Cette mission a atteint sa limite de candidatures.';
  }
  if (
    message.includes('discoverable mission') ||
    message.includes('visible mission')
  ) {
    return 'Cette mission n’accepte plus de nouvelles candidatures.';
  }
  if (message.includes('explicit application confirmation')) {
    return 'Confirmez explicitement l’envoi de cette candidature.';
  }
  if (message.includes('invalid application content')) {
    return 'Vérifiez le message, la disponibilité et la proposition avant de recommencer.';
  }
  if (message.includes('block prevents')) {
    return 'Cette interaction n’est pas disponible en raison d’un blocage.';
  }
  if (message.includes('active profiles are required')) {
    return 'Cette candidature n’est pas disponible pour l’un de ces profils.';
  }
  if (message.includes('three applications')) {
    return 'La comparaison est limitée à trois candidatures.';
  }
  if (candidate?.code === '42501') {
    return 'Vous n’êtes pas autorisé à effectuer cette action.';
  }
  if (candidate?.code === '23514' || candidate?.code === '22023') {
    return 'Cette action n’est plus permise dans l’état actuel.';
  }
  return 'L’opération sur la candidature a échoué. Réessayez.';
}

export async function listApplications(
  client: SupabaseClient<Database>,
  filters: ApplicationFilters,
): Promise<{ items: ApplicationItem[]; total: number }> {
  const { data, error } = await client.rpc('list_applications', {
    ...(filters.applicationId
      ? { p_application_id: filters.applicationId }
      : {}),
    ...(filters.missionId ? { p_mission_id: filters.missionId } : {}),
    p_page: filters.page,
    p_page_size: filters.pageSize,
    ...(filters.query ? { p_query: filters.query } : {}),
    p_scope: filters.scope,
    p_sort: filters.sort,
    p_statuses: filters.statuses,
  });
  if (error) throw error;
  const items: ApplicationItem[] = data.map((row) => ({
    applicant: {
      avatarPath: row.applicant_avatar_path ?? null,
      bio: row.applicant_bio ?? null,
      city: row.applicant_city ?? null,
      completedCount: Number(row.applicant_completed_count ?? 0),
      countryCode: row.applicant_country_code ?? null,
      displayName: row.applicant_display_name,
      emailVerified: row.applicant_email_verified,
      experienceYears: Number(row.applicant_experience_years ?? 0),
      headline: row.applicant_headline ?? null,
      id: row.applicant_id,
      remoteAvailable: row.applicant_remote_available,
      reputation:
        row.applicant_reputation === null
          ? null
          : Number(row.applicant_reputation),
      reviewCount: Number(row.applicant_review_count ?? 0),
      skills: parseSkills(row.applicant_skills),
      username: row.applicant_username,
    },
    availabilityNote: row.availability_note,
    conversationId: row.conversation_id ?? null,
    createdAt: row.created_at,
    id: row.application_id,
    lockVersion: row.lock_version,
    message: row.message,
    mission: {
      budgetMax: row.mission_budget_max ?? null,
      budgetMin: row.mission_budget_min ?? null,
      budgetModel: row.mission_budget_model,
      countryCode: row.mission_country_code ?? null,
      endsOn: row.mission_ends_on ?? null,
      id: row.mission_id,
      publicCity: row.mission_public_city ?? null,
      publicRegion: row.mission_public_region ?? null,
      startsOn: row.mission_starts_on ?? null,
      status: row.mission_status,
      title: row.mission_title,
      workMode: row.mission_work_mode,
    },
    owner: {
      avatarPath: row.owner_avatar_path ?? null,
      displayName: row.owner_display_name,
      emailVerified: row.owner_email_verified,
      headline: row.owner_headline ?? null,
      id: row.owner_id,
      username: row.owner_username,
    },
    proposedAmount: row.proposed_amount ?? null,
    proposedCurrencyCode: row.proposed_currency_code,
    relevance: parseRelevance(row.relevance_details, row.relevance_score),
    relevanceScore: Number(row.relevance_score),
    scoreVersion: row.score_version,
    status: row.application_status,
    swipeDecision: row.swipe_decision ?? null,
    updatedAt: row.updated_at,
  }));
  return { items, total: Number(data[0]?.total_count ?? 0) };
}

export async function getApplication(
  client: SupabaseClient<Database>,
  applicationId: string,
): Promise<{ item: ApplicationItem; scope: 'received' | 'talent' } | null> {
  for (const scope of ['received', 'talent'] as const) {
    const result = await listApplications(client, {
      applicationId,
      page: 1,
      pageSize: 1,
      scope,
      sort: 'newest',
      statuses: [],
    });
    if (result.items[0]) return { item: result.items[0], scope };
  }
  return null;
}

export async function submitApplication(
  client: SupabaseClient<Database>,
  values: {
    availabilityNote: string;
    message: string;
    missionId: string;
    proposedAmount?: number;
  },
): Promise<string> {
  const { data, error } = await client.rpc('submit_application', {
    p_availability_note: values.availabilityNote,
    p_confirmed: true,
    p_message: values.message,
    p_mission_id: values.missionId,
    ...(values.proposedAmount !== undefined
      ? { p_proposed_amount: values.proposedAmount }
      : {}),
  });
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('APPLICATION_SUBMIT_EMPTY');
  return row.application_id;
}

export async function transitionApplication(
  client: SupabaseClient<Database>,
  application: Pick<ApplicationItem, 'id' | 'lockVersion'>,
  status: 'rejected' | 'shortlisted' | 'viewed' | 'withdrawn',
): Promise<void> {
  const { error } = await client.rpc('transition_application', {
    p_application_id: application.id,
    p_expected_version: application.lockVersion,
    p_new_status: status,
  });
  if (error) throw error;
}

export async function recordMissionSwipe(
  client: SupabaseClient<Database>,
  missionId: string,
  decision: MissionSwipeDecision,
): Promise<void> {
  const { error } = await client.rpc('record_mission_swipe', {
    p_decision: decision,
    p_mission_id: missionId,
  });
  if (error) throw error;
}

export async function undoLastMissionSwipe(
  client: SupabaseClient<Database>,
): Promise<void> {
  const { error } = await client.rpc('undo_last_mission_swipe');
  if (error) throw error;
}

export async function recordApplicationSwipe(
  client: SupabaseClient<Database>,
  application: Pick<ApplicationItem, 'id' | 'lockVersion'>,
  decision: ApplicationSwipeDecision,
): Promise<void> {
  const { error } = await client.rpc('record_application_swipe', {
    p_application_id: application.id,
    p_decision: decision,
    p_expected_version: application.lockVersion,
  });
  if (error) throw error;
}

export async function undoLastApplicationSwipe(
  client: SupabaseClient<Database>,
): Promise<void> {
  const { error } = await client.rpc('undo_last_application_swipe');
  if (error) throw error;
}
