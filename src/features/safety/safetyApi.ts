import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database.generated';

export type ReportReason = Database['public']['Enums']['report_reason'];
export type ReportTargetType =
  Database['public']['Enums']['report_target_type'];
export type ModerationStatus = Database['public']['Enums']['moderation_status'];

export interface BlockedProfile {
  avatarPath: string | null;
  blockedAt: string;
  displayName: string;
  id: string;
  username: string;
}

export interface ModerationReportListItem {
  createdAt: string;
  description: string | null;
  id: string;
  lockVersion: number;
  reason: ReportReason;
  status: ModerationStatus;
  targetLabel: string;
  targetType: ReportTargetType;
  totalCount: number;
}

export interface ModerationReportDetail {
  actions: Array<{
    action: string;
    createdAt: string;
    id: number;
    moderatorId: string;
    reason: string;
  }>;
  report: {
    createdAt: string;
    description: string | null;
    id: string;
    lockVersion: number;
    reason: ReportReason;
    resolutionNote: string | null;
    resolvedAt: string | null;
    status: ModerationStatus;
    targetType: ReportTargetType;
  };
  reporter: { displayName: string; id: string; username: string };
  target: Record<string, unknown>;
}

function asObject(value: Json): Record<string, Json | undefined> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return value;
}

export function getFrenchSafetyError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  const message = value.message?.toLowerCase() ?? '';
  if (message.includes('duplicate report') || value.code === '23505') {
    return 'Un signalement identique est déjà en cours d’examen.';
  }
  if (message.includes('rate limit')) {
    return 'Trop de signalements ont été envoyés récemment. Réessayez plus tard.';
  }
  if (message.includes('version conflict') || value.code === '40001') {
    return 'Ce signalement a changé. Rechargez la page avant de poursuivre.';
  }
  if (value.code === '42501' || message.includes('not authorized')) {
    return 'Cette action n’est pas autorisée pour votre compte.';
  }
  if (value.code === 'P0002')
    return 'La ressource demandée n’est plus disponible.';
  if (value.code === '23514' || value.code === '22023') {
    return 'Certaines informations sont incomplètes ou invalides.';
  }
  return 'L’action de sécurité n’a pas abouti. Réessayez sans partager de donnée sensible.';
}

export async function submitReport(
  client: SupabaseClient<Database>,
  input: {
    confirmed: true;
    description: string;
    reason: ReportReason;
    targetId: string;
    targetType: ReportTargetType;
  },
): Promise<string> {
  const { data, error } = await client.rpc('submit_report', {
    p_confirmed: input.confirmed,
    p_description: input.description,
    p_reason: input.reason,
    p_target_id: input.targetId,
    p_target_type: input.targetType,
  });
  if (error) throw error;
  return data;
}

export async function setProfileBlock(
  client: SupabaseClient<Database>,
  profileId: string,
  blocked: boolean,
): Promise<boolean> {
  const { data, error } = await client.rpc('set_profile_block', {
    p_blocked: blocked,
    p_profile_id: profileId,
  });
  if (error) throw error;
  return data;
}

export async function listBlockedProfiles(
  client: SupabaseClient<Database>,
): Promise<BlockedProfile[]> {
  const { data, error } = await client.rpc('list_blocked_profiles');
  if (error) throw error;
  return data.map((item) => ({
    avatarPath: item.avatar_path,
    blockedAt: item.blocked_at,
    displayName: item.display_name,
    id: item.profile_id,
    username: item.username,
  }));
}

export async function getModerationAccess(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  const { data, error } = await client.rpc('get_moderation_access');
  if (error) throw error;
  return data;
}

export async function listModerationReports(
  client: SupabaseClient<Database>,
  status: ModerationStatus | null,
  page: number,
): Promise<{ items: ModerationReportListItem[]; total: number }> {
  const { data, error } = await client.rpc('list_moderation_reports', {
    p_page: page,
    p_page_size: 20,
    ...(status ? { p_status: status } : {}),
  });
  if (error) throw error;
  return {
    items: data.map((item) => ({
      createdAt: item.created_at,
      description: item.description,
      id: item.report_id,
      lockVersion: item.lock_version,
      reason: item.reason,
      status: item.status,
      targetLabel: item.target_label,
      targetType: item.target_type,
      totalCount: Number(item.total_count),
    })),
    total: Number(data[0]?.total_count ?? 0),
  };
}

export async function getModerationReport(
  client: SupabaseClient<Database>,
  reportId: string,
): Promise<ModerationReportDetail> {
  const { data, error } = await client.rpc('get_moderation_report', {
    p_report_id: reportId,
  });
  if (error) throw error;
  const root = asObject(data);
  return root as unknown as ModerationReportDetail;
}

export async function moderateReport(
  client: SupabaseClient<Database>,
  input: {
    action:
      'triage' | 'dismiss' | 'resolve' | 'hide_mission' | 'suspend_profile';
    expectedVersion: number;
    reason: string;
    reportId: string;
  },
): Promise<void> {
  const { error } = await client.rpc('moderate_report', {
    p_action: input.action,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason,
    p_report_id: input.reportId,
  });
  if (error) throw error;
}

export async function getAccountExport(
  client: SupabaseClient<Database>,
): Promise<Json> {
  const { data, error } = await client.rpc('get_account_export');
  if (error) throw error;
  return data;
}

export async function requestAccountDeletion(
  client: SupabaseClient<Database>,
  confirmation: string,
  reason: string,
): Promise<{ id: string; requestedAt: string; status: string }> {
  const { data, error } = await client.rpc('request_account_deletion', {
    p_confirmation: confirmation,
    ...(reason ? { p_reason: reason } : {}),
  });
  if (error) throw error;
  const item = data[0];
  if (!item) throw new Error('ACCOUNT_REQUEST_EMPTY');
  return {
    id: item.request_id,
    requestedAt: item.requested_at,
    status: item.status,
  };
}
