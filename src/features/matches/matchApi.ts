import type { SupabaseClient } from '@supabase/supabase-js';

import type { ApplicationItem } from '@/features/applications/applicationApi';
import {
  matchWorkspaceSchema,
  type MatchWorkspace,
} from '@/features/matches/matchSchemas';
import type { Database } from '@/types/database.generated';

type MatchListRow =
  Database['public']['Functions']['list_match_workspaces']['Returns'][number];

export interface MatchListItem {
  agreementId: string | null;
  agreementStatus: Database['public']['Enums']['agreement_status'] | null;
  agreementVersion: number | null;
  conversationId: string | null;
  counterpart: {
    avatarPath: string | null;
    displayName: string;
    headline: string | null;
    id: string;
    username: string;
  };
  id: string;
  matchedAt: string;
  mission: {
    id: string;
    lockVersion: number;
    status: Database['public']['Enums']['mission_status'];
    title: string;
  };
  role: 'client' | 'talent';
  status: Database['public']['Enums']['match_status'];
}

export const matchQueryKeys = {
  all: ['matches'] as const,
  detail: (matchId: string) => ['matches', 'detail', matchId] as const,
  list: ['matches', 'list'] as const,
};

export function getFrenchMatchError(error: unknown): string {
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
  if (candidate?.code === '40001' || message.includes('stale')) {
    return 'Cet espace a changé ailleurs. Rechargez les données avant de recommencer.';
  }
  if (candidate?.code === 'P0002' || message.includes('not found')) {
    return 'Cette ressource a été supprimée ou n’existe plus.';
  }
  if (candidate?.code === '42501') {
    return 'Vous n’êtes pas autorisé à accéder à cette collaboration.';
  }
  if (message.includes('already assigned')) {
    return 'Un autre talent a déjà été retenu pour cette mission.';
  }
  if (message.includes('already treated')) {
    return 'Cette candidature a déjà été traitée.';
  }
  if (message.includes('both participants must confirm')) {
    return 'Les deux participants doivent confirmer avant cette étape.';
  }
  if (candidate?.code === '23514' || candidate?.code === '22023') {
    return 'Cette action n’est plus permise dans l’état actuel.';
  }
  return 'L’opération a échoué. Rechargez les données puis réessayez.';
}

function mapListRow(row: MatchListRow): MatchListItem {
  return {
    agreementId: row.agreement_id ?? null,
    agreementStatus: row.agreement_status ?? null,
    agreementVersion: row.agreement_version ?? null,
    conversationId: row.conversation_id ?? null,
    counterpart: {
      avatarPath: row.counterpart_avatar_path ?? null,
      displayName: row.counterpart_display_name,
      headline: row.counterpart_headline ?? null,
      id: row.counterpart_id,
      username: row.counterpart_username,
    },
    id: row.match_id,
    matchedAt: row.matched_at,
    mission: {
      id: row.mission_id,
      lockVersion: row.mission_lock_version,
      status: row.mission_status,
      title: row.mission_title,
    },
    role: row.participant_role === 'client' ? 'client' : 'talent',
    status: row.match_status,
  };
}

export async function listMatches(
  client: SupabaseClient<Database>,
): Promise<MatchListItem[]> {
  const { data, error } = await client.rpc('list_match_workspaces');
  if (error) throw error;
  return data.map(mapListRow);
}

export async function getMatchWorkspace(
  client: SupabaseClient<Database>,
  matchId: string,
): Promise<MatchWorkspace> {
  const { data, error } = await client.rpc('get_match_workspace', {
    p_match_id: matchId,
  });
  if (error) throw error;
  return matchWorkspaceSchema.parse(data);
}

export async function acceptApplication(
  client: SupabaseClient<Database>,
  application: Pick<ApplicationItem, 'id' | 'lockVersion' | 'mission'>,
): Promise<string> {
  const { data: mission, error: missionError } = await client
    .from('missions')
    .select('lock_version')
    .eq('id', application.mission.id)
    .single();
  if (missionError) throw missionError;
  const { data, error } = await client.rpc('accept_application', {
    p_application_id: application.id,
    p_expected_application_version: application.lockVersion,
    p_expected_mission_version: mission.lock_version,
  });
  if (error) throw error;
  const result = data[0];
  if (!result) throw new Error('MATCH_ACCEPT_EMPTY');
  return result.match_id;
}

export async function confirmAgreement(
  client: SupabaseClient<Database>,
  workspace: MatchWorkspace,
): Promise<void> {
  if (!workspace.agreement) throw new Error('AGREEMENT_NOT_FOUND');
  const { error } = await client.rpc('confirm_agreement', {
    p_agreement_id: workspace.agreement.id,
    p_expected_version: workspace.agreement.lockVersion,
  });
  if (error) throw error;
}

export async function startMatch(
  client: SupabaseClient<Database>,
  workspace: MatchWorkspace,
): Promise<void> {
  if (!workspace.agreement) throw new Error('AGREEMENT_NOT_FOUND');
  const { error } = await client.rpc('start_match', {
    p_expected_agreement_version: workspace.agreement.lockVersion,
    p_expected_mission_version: workspace.mission.lockVersion,
    p_match_id: workspace.match.id,
  });
  if (error) throw error;
}

export async function addProgress(
  client: SupabaseClient<Database>,
  matchId: string,
  kind: 'progress' | 'delivery',
  note: string,
): Promise<void> {
  const { error } = await client.rpc('add_mission_progress', {
    p_kind: kind,
    p_match_id: matchId,
    p_note: note,
  });
  if (error) throw error;
}

export async function submitCompletion(
  client: SupabaseClient<Database>,
  matchId: string,
  decision: 'confirmed' | 'disputed',
  note: string,
): Promise<void> {
  const { error } = await client.rpc('submit_completion_confirmation', {
    p_decision: decision,
    p_match_id: matchId,
    ...(note ? { p_note: note } : {}),
  });
  if (error) throw error;
}

export async function completeMatch(
  client: SupabaseClient<Database>,
  workspace: MatchWorkspace,
): Promise<void> {
  if (!workspace.agreement) throw new Error('AGREEMENT_NOT_FOUND');
  const { error } = await client.rpc('complete_match', {
    p_expected_agreement_version: workspace.agreement.lockVersion,
    p_expected_mission_version: workspace.mission.lockVersion,
    p_match_id: workspace.match.id,
  });
  if (error) throw error;
}

export async function cancelMatch(
  client: SupabaseClient<Database>,
  workspace: MatchWorkspace,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc('cancel_match_mission', {
    p_expected_mission_version: workspace.mission.lockVersion,
    p_match_id: workspace.match.id,
    p_reason: reason,
  });
  if (error) throw error;
}
