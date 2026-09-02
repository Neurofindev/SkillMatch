import type { SupabaseClient } from '@supabase/supabase-js';

import type { ReviewFormValues } from '@/features/reviews/reviewSchemas';
import type { Database, Json } from '@/types/database.generated';

type OpportunityRow =
  Database['public']['Functions']['list_review_opportunities']['Returns'][number];
type ReceivedReviewRow =
  Database['public']['Functions']['list_received_reviews']['Returns'][number];
type ReputationRow =
  Database['public']['Functions']['get_reputation_summary']['Returns'][number];

export interface ReviewOpportunity {
  completedAt: string;
  counterpart: {
    avatarPath: string | null;
    displayName: string;
    id: string;
    username: string;
  };
  counterpartHasReviewed: boolean;
  matchId: string;
  missionId: string;
  missionTitle: string;
  ownRating: number | null;
  ownReviewCreatedAt: string | null;
  ownReviewId: string | null;
  role: 'client' | 'talent';
}

export interface ReviewCriteria {
  communication: number;
  quality: number;
  reliability: number;
}

export interface ReceivedReview {
  author: {
    displayName: string;
    id: string;
    username: string;
  };
  comment: string | null;
  createdAt: string;
  criteria: ReviewCriteria | null;
  id: string;
  matchId: string;
  mission: {
    id: string;
    title: string;
  };
  rating: number;
  total: number;
}

export interface ReputationSummary {
  averageRating: number | null;
  completedMissions: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  isNewProfile: boolean;
  profileId: string;
  reviewCount: number;
}

export const reviewQueryKeys = {
  all: ['reviews'] as const,
  opportunities: ['reviews', 'opportunities'] as const,
  received: (profileId: string, page: number) =>
    ['reviews', 'received', profileId, page] as const,
  reputation: (profileId: string) =>
    ['reviews', 'reputation', profileId] as const,
};

function mapOpportunity(row: OpportunityRow): ReviewOpportunity {
  return {
    completedAt: row.completed_at,
    counterpart: {
      avatarPath: row.counterpart_avatar_path ?? null,
      displayName: row.counterpart_display_name,
      id: row.counterpart_id,
      username: row.counterpart_username,
    },
    counterpartHasReviewed: row.counterpart_has_reviewed,
    matchId: row.match_id,
    missionId: row.mission_id,
    missionTitle: row.mission_title,
    ownRating: row.own_rating ?? null,
    ownReviewCreatedAt: row.own_review_created_at ?? null,
    ownReviewId: row.own_review_id ?? null,
    role: row.participant_role === 'client' ? 'client' : 'talent',
  };
}

function parseCriteria(value: Json): ReviewCriteria | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const communication = value.communication;
  const reliability = value.reliability;
  const quality = value.quality;
  if (
    typeof communication !== 'number' ||
    typeof reliability !== 'number' ||
    typeof quality !== 'number'
  ) {
    return null;
  }
  return { communication, quality, reliability };
}

function mapReceived(row: ReceivedReviewRow): ReceivedReview {
  return {
    author: {
      displayName: row.author_display_name,
      id: row.author_id,
      username: row.author_username,
    },
    comment: row.comment ?? null,
    createdAt: row.created_at,
    criteria: parseCriteria(row.criteria),
    id: row.review_id,
    matchId: row.match_id,
    mission: { id: row.mission_id, title: row.mission_title },
    rating: row.rating,
    total: Number(row.total_count),
  };
}

export function getFrenchReviewError(error: unknown): string {
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
    return 'Connexion impossible. Votre avis reste affiché pour vous permettre de réessayer.';
  }
  if (candidate?.code === '23505' || message.includes('already submitted')) {
    return 'Vous avez déjà publié un avis pour cette mission.';
  }
  if (candidate?.code === '42501') {
    return 'Vous n’êtes pas autorisé à laisser cet avis.';
  }
  if (candidate?.code === '23514' || message.includes('completed')) {
    return 'Un avis devient disponible uniquement après la clôture réelle de la mission.';
  }
  if (candidate?.code === 'P0002') {
    return 'Cette collaboration n’existe plus.';
  }
  return 'L’avis n’a pas pu être enregistré. Vérifiez les informations puis réessayez.';
}

export async function listReviewOpportunities(
  client: SupabaseClient<Database>,
): Promise<ReviewOpportunity[]> {
  const { data, error } = await client.rpc('list_review_opportunities');
  if (error) throw error;
  return data.map(mapOpportunity);
}

export async function listReceivedReviews(
  client: SupabaseClient<Database>,
  profileId: string,
  page: number,
): Promise<{ items: ReceivedReview[]; total: number }> {
  const { data, error } = await client.rpc('list_received_reviews', {
    p_page: page,
    p_page_size: 10,
    p_profile_id: profileId,
  });
  if (error) throw error;
  const items = data.map(mapReceived);
  return { items, total: items[0]?.total ?? 0 };
}

export async function getReputationSummary(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<ReputationSummary | null> {
  const { data, error } = await client.rpc('get_reputation_summary', {
    p_profile_id: profileId,
  });
  if (error) throw error;
  const row: ReputationRow | undefined = data[0];
  if (!row) return null;
  return {
    averageRating:
      row.average_rating === null ? null : Number(row.average_rating),
    completedMissions: Number(row.completed_missions),
    distribution: {
      1: Number(row.rating_1_count),
      2: Number(row.rating_2_count),
      3: Number(row.rating_3_count),
      4: Number(row.rating_4_count),
      5: Number(row.rating_5_count),
    },
    isNewProfile: row.is_new_profile,
    profileId: row.profile_id,
    reviewCount: Number(row.review_count),
  };
}

export async function submitReview(
  client: SupabaseClient<Database>,
  matchId: string,
  values: ReviewFormValues,
): Promise<string> {
  const { data, error } = await client.rpc('submit_review', {
    p_comment: values.comment,
    p_communication: values.communication,
    p_match_id: matchId,
    p_quality: values.quality,
    p_rating: values.rating,
    p_reliability: values.reliability,
  });
  if (error) throw error;
  const result = data[0];
  if (!result) throw new Error('REVIEW_EMPTY');
  return result.review_id;
}
