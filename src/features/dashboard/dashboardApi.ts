import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Database } from '@/types/database.generated';

type OverviewRow =
  Database['public']['Functions']['get_dashboard_overview']['Returns'][number];
type DeadlineRow =
  Database['public']['Functions']['list_dashboard_deadlines']['Returns'][number];

export interface DashboardOverview {
  agreementsToConfirm: number;
  canHire: boolean;
  canWork: boolean;
  clientActiveMissions: number;
  onboardingCompleted: boolean;
  pendingApplications: number;
  profileMissingFields: string[];
  reviewsToLeave: number;
  talentActiveMissions: number;
  unreadMessages: number;
  upcomingDeadlines: number;
}

export interface DashboardDeadline {
  endsOn: string;
  internalPath: string;
  matchId: string;
  missionId: string;
  missionTitle: string;
  role: 'client' | 'talent';
}

const rankingItemSchema = z.object({
  averageRating: z.number().nullable(),
  avatarPath: z.string().nullable(),
  displayName: z.string(),
  profileId: z.string().uuid(),
  rankPosition: z.number().int().positive(),
  reviewCount: z.number().int().nonnegative(),
  username: z.string(),
  weeklyCompletions: z.number().int().positive(),
});

export const weeklyRankingSchema = z.object({
  formulaVersion: z.literal('weekly-completions-v2'),
  items: z.array(rankingItemSchema),
  minimumCompletedMissions: z.number().int().positive(),
  minimumProfiles: z.number().int().positive(),
  periodEnd: z.string(),
  periodStart: z.string(),
  sampleCompletedMissions: z.number().int().nonnegative(),
  sampleProfiles: z.number().int().nonnegative(),
  sufficientData: z.boolean(),
});

export type WeeklyRanking = z.infer<typeof weeklyRankingSchema>;

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  deadlines: ['dashboard', 'deadlines'] as const,
  overview: ['dashboard', 'overview'] as const,
  ranking: ['dashboard', 'weekly-ranking'] as const,
};

function mapOverview(row: OverviewRow): DashboardOverview {
  return {
    agreementsToConfirm: Number(row.agreements_to_confirm),
    canHire: row.can_hire,
    canWork: row.can_work,
    clientActiveMissions: Number(row.client_active_missions),
    onboardingCompleted: row.onboarding_completed,
    pendingApplications: Number(row.pending_applications),
    profileMissingFields: row.profile_missing_fields,
    reviewsToLeave: Number(row.reviews_to_leave),
    talentActiveMissions: Number(row.talent_active_missions),
    unreadMessages: Number(row.unread_messages),
    upcomingDeadlines: Number(row.upcoming_deadlines),
  };
}

function mapDeadline(row: DeadlineRow): DashboardDeadline {
  return {
    endsOn: row.ends_on,
    internalPath: row.internal_path,
    matchId: row.match_id,
    missionId: row.mission_id,
    missionTitle: row.mission_title,
    role: row.participant_role === 'client' ? 'client' : 'talent',
  };
}

export async function getDashboardOverview(
  client: SupabaseClient<Database>,
): Promise<DashboardOverview> {
  const { data, error } = await client.rpc('get_dashboard_overview');
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('DASHBOARD_EMPTY');
  return mapOverview(row);
}

export async function listDashboardDeadlines(
  client: SupabaseClient<Database>,
): Promise<DashboardDeadline[]> {
  const { data, error } = await client.rpc('list_dashboard_deadlines', {
    p_limit: 6,
  });
  if (error) throw error;
  return data.map(mapDeadline);
}

export async function getWeeklyRanking(
  client: SupabaseClient<Database>,
): Promise<WeeklyRanking> {
  const { data, error } = await client.rpc('get_weekly_ranking', {
    p_limit: 5,
  });
  if (error) throw error;
  return weeklyRankingSchema.parse(data);
}

export function getFrenchDashboardError(): string {
  return 'Les données réelles du tableau de bord ne sont pas disponibles. Réessayez sans perdre votre travail.';
}
