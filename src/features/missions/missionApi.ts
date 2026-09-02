import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  defaultMissionValues,
  deliverablesFromText,
  type MissionFormValues,
  type SkillLevel,
  type WorkMode,
} from '@/features/missions/missionSchemas';
import type { Database, Json } from '@/types/database.generated';

export type MissionStatus = Database['public']['Enums']['mission_status'];
export type MissionRow = Database['public']['Tables']['missions']['Row'];
export type SkillOption = Database['public']['Tables']['skills']['Row'];
export type MissionAttachment =
  Database['public']['Tables']['mission_attachments']['Row'];
export type MissionWizardDraft =
  Database['public']['Tables']['mission_drafts']['Row'];

const searchSkillSchema = z.object({
  category: z.string(),
  id: z.number(),
  importance: z.number(),
  name: z.string(),
  requiredLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
});

export interface MissionSearchSkill {
  category: string;
  id: number;
  importance: number;
  name: string;
  requiredLevel: SkillLevel;
}

export interface MissionSummary {
  applicationCount: number | null;
  applicationDeadline: string | null;
  budgetMax: number | null;
  budgetMin: number | null;
  budgetModel: 'fixed' | 'hourly';
  category: string;
  countryCode: string | null;
  createdAt: string;
  currencyCode: string;
  deliverables: string[];
  description: string;
  endsOn: string | null;
  flexibleSchedule: boolean;
  id: string;
  isFavorite: boolean;
  owner: {
    avatarPath: string | null;
    displayName: string;
    emailVerified: boolean;
    headline: string | null;
    id: string;
    username: string;
  };
  presenceDetails: string | null;
  publicCity: string | null;
  publicRegion: string | null;
  requiredLevel: SkillLevel;
  skills: MissionSearchSkill[];
  startsOn: string | null;
  status: MissionStatus;
  title: string;
  updatedAt: string;
  workMode: WorkMode;
}

export interface MissionSearchFilters {
  budgetMax?: number;
  budgetMin?: number;
  category?: string;
  city?: string;
  endsAfter?: string;
  favoritesOnly?: boolean;
  missionId?: string;
  page: number;
  pageSize: number;
  query?: string;
  requiredLevels: SkillLevel[];
  skillIds: number[];
  sort: 'relevance' | 'newest' | 'budget_desc';
  startsBefore?: string;
  workModes: WorkMode[];
}

export interface MissionSearchResult {
  items: MissionSummary[];
  total: number;
}

export interface OwnMissionListItem {
  applicationCount: number;
  archivedAt: string | null;
  category: string;
  id: string;
  lockVersion: number;
  status: MissionStatus;
  title: string;
  updatedAt: string;
  workMode: WorkMode;
}

export interface OwnMissionDetails {
  attachments: MissionAttachment[];
  mission: MissionRow;
  skills: Array<{ required_level: SkillLevel; skill_id: number }>;
}

export const missionQueryKeys = {
  all: ['missions'] as const,
  catalog: ['missions', 'catalog'] as const,
  detail: (id: string) => ['missions', 'detail', id] as const,
  discovery: (filters: MissionSearchFilters) =>
    ['missions', 'discovery', filters] as const,
  drafts: ['missions', 'wizard-drafts'] as const,
  favorites: ['missions', 'favorites'] as const,
  mine: ['missions', 'mine'] as const,
};

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function nullable<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}

function parseStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseSearchSkills(value: Json): MissionSearchSkill[] {
  const result = z.array(searchSkillSchema).safeParse(value);
  return result.success ? result.data : [];
}

export function getFrenchMissionError(error: unknown): string {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : undefined;
  const code = candidate?.code;
  const message = candidate?.message?.toLowerCase() ?? '';
  if (
    error instanceof TypeError ||
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'Connexion impossible. Le brouillon reste affiché : réessayez lorsque le réseau revient.';
  }
  if (code === '42501') {
    return 'Vous n’êtes pas autorisé à modifier cette mission.';
  }
  if (code === '40001' || message.includes('stale mission')) {
    return 'La mission a changé ailleurs. Rechargez-la avant de recommencer.';
  }
  if (message.includes('content is not allowed')) {
    return 'Ce besoin appartient à une catégorie de mission interdite.';
  }
  if (message.includes('publishing capability')) {
    return 'Activez la capacité « publier une mission » dans votre profil.';
  }
  if (code === '23514' || code === '22023') {
    return 'Certaines informations sont incomplètes ou incohérentes. Vérifiez le formulaire.';
  }
  return 'L’opération sur la mission a échoué. Vérifiez les informations puis réessayez.';
}

export async function listMissionSkillOptions(
  client: SupabaseClient<Database>,
): Promise<SkillOption[]> {
  const { data, error } = await client
    .from('skills')
    .select('id, slug, name, category, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) throw error;
  return data;
}

export async function searchMissions(
  client: SupabaseClient<Database>,
  filters: MissionSearchFilters,
): Promise<MissionSearchResult> {
  const { data, error } = await client.rpc('search_missions', {
    p_budget_max: nullable(filters.budgetMax),
    p_budget_min: nullable(filters.budgetMin),
    p_category: nullable(filters.category),
    p_city: nullable(filters.city),
    p_ends_after: nullable(filters.endsAfter),
    p_favorites_only: Boolean(filters.favoritesOnly),
    p_mission_id: nullable(filters.missionId),
    p_page: filters.page,
    p_page_size: filters.pageSize,
    p_query: nullable(filters.query),
    p_required_levels: filters.requiredLevels,
    p_skill_ids: filters.skillIds,
    p_sort: filters.sort,
    p_starts_before: nullable(filters.startsBefore),
    p_work_modes: filters.workModes,
  });
  if (error) throw error;
  const items = data.map((row) => ({
    applicationCount: row.application_count,
    applicationDeadline: row.application_deadline,
    budgetMax: row.budget_max,
    budgetMin: row.budget_min,
    budgetModel: row.budget_model,
    category: row.category,
    countryCode: row.country_code,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    deliverables: parseStringArray(row.deliverables),
    description: row.description,
    endsOn: row.ends_on,
    flexibleSchedule: row.flexible_schedule,
    id: row.mission_id,
    isFavorite: row.is_favorite,
    owner: {
      avatarPath: row.owner_avatar_path,
      displayName: row.owner_display_name,
      emailVerified: row.owner_email_verified,
      headline: row.owner_headline,
      id: row.owner_id,
      username: row.owner_username,
    },
    presenceDetails: row.presence_details,
    publicCity: row.public_city,
    publicRegion: row.public_region,
    requiredLevel: row.required_level,
    skills: parseSearchSkills(row.skills),
    startsOn: row.starts_on,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
    workMode: row.work_mode,
  }));
  return { items, total: data[0]?.total_count ?? 0 };
}

export async function listMissionWizardDrafts(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<MissionWizardDraft[]> {
  const { data, error } = await client
    .from('mission_drafts')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMissionWizardDraft(
  client: SupabaseClient<Database>,
  userId: string,
  draftId?: string,
): Promise<{
  attachments: MissionAttachment[];
  draft: MissionWizardDraft;
} | null> {
  let query = client
    .from('mission_drafts')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (draftId) query = query.eq('id', draftId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const attachments = await listMissionAttachments(client, {
    draftId: data.id,
  });
  return { attachments, draft: data };
}

export async function saveMissionWizardDraft(
  client: SupabaseClient<Database>,
  userId: string,
  currentStep: number,
  values: MissionFormValues,
  draftId?: string,
): Promise<MissionWizardDraft> {
  if (draftId) {
    const { data, error } = await client
      .from('mission_drafts')
      .update({ current_step: currentStep, payload: asJson(values) })
      .eq('id', draftId)
      .eq('owner_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client
    .from('mission_drafts')
    .insert({
      current_step: currentStep,
      owner_id: userId,
      payload: asJson(values),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function draftPayloadToValues(payload: Json): MissionFormValues {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return defaultMissionValues;
  }
  return {
    ...defaultMissionValues,
    ...(payload as Partial<MissionFormValues>),
  };
}

export async function deleteMissionWizardDraft(
  client: SupabaseClient<Database>,
  userId: string,
  draftId: string,
): Promise<void> {
  const attachments = await listMissionAttachments(client, { draftId });
  if (attachments.length) {
    const { error: storageError } = await client.storage
      .from('mission-attachments')
      .remove(attachments.map((item) => item.storage_path));
    if (storageError) throw storageError;
  }
  const { error } = await client
    .from('mission_drafts')
    .delete()
    .eq('id', draftId)
    .eq('owner_id', userId);
  if (error) throw error;
}

export async function saveMission(
  client: SupabaseClient<Database>,
  values: MissionFormValues,
  options: {
    draftId?: string;
    expectedVersion?: number;
    missionId?: string;
    publish: boolean;
  },
): Promise<{ lockVersion: number; missionId: string; status: MissionStatus }> {
  const isRemote = values.workMode === 'remote';
  const { data, error } = await client.rpc('save_mission', {
    p_application_deadline: values.applicationDeadline,
    p_budget_max: values.budgetMax,
    p_budget_min: values.budgetMin,
    p_budget_model: values.budgetModel,
    p_category: values.category,
    p_country_code: nullable(
      isRemote ? undefined : values.countryCode || undefined,
    ),
    p_deliverables: asJson(deliverablesFromText(values.deliverablesText)),
    p_description: values.description,
    p_ends_on: values.endsOn,
    p_expected_version: nullable(options.expectedVersion),
    p_flexible_schedule: values.flexibleSchedule,
    p_mission_id: nullable(options.missionId),
    p_presence_details: nullable(
      values.workMode === 'hybrid' ? values.presenceDetails : undefined,
    ),
    p_public_city: nullable(
      isRemote ? undefined : values.publicCity || undefined,
    ),
    p_public_region: nullable(
      isRemote ? undefined : values.publicRegion || undefined,
    ),
    p_publish: options.publish,
    p_required_level: values.requiredLevel,
    p_skill_ids: values.skills.map((skill) => skill.skillId),
    p_skill_levels: values.skills.map((skill) => skill.level),
    p_starts_on: values.startsOn,
    p_title: values.title,
    p_wizard_draft_id: nullable(options.draftId),
    p_work_mode: values.workMode,
  });
  if (error) throw error;
  const result = data[0];
  if (!result) throw new Error('MISSION_SAVE_EMPTY');
  return {
    lockVersion: result.lock_version,
    missionId: result.mission_id,
    status: result.status,
  };
}

export async function listOwnMissions(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<OwnMissionListItem[]> {
  const [missionsResult, countsResult] = await Promise.all([
    client
      .from('missions')
      .select(
        'id, title, category, work_mode, status, lock_version, archived_at, updated_at',
      )
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    client.rpc('get_application_counts'),
  ]);
  const error = missionsResult.error ?? countsResult.error;
  if (error) throw error;
  const counts = new Map(
    (countsResult.data ?? []).map((item) => [
      item.mission_id,
      Number(item.total_count),
    ]),
  );
  return (missionsResult.data ?? []).map((mission) => ({
    applicationCount: counts.get(mission.id) ?? 0,
    archivedAt: mission.archived_at,
    category: mission.category,
    id: mission.id,
    lockVersion: mission.lock_version,
    status: mission.status,
    title: mission.title,
    updatedAt: mission.updated_at,
    workMode: mission.work_mode,
  }));
}

export async function getOwnMissionDetails(
  client: SupabaseClient<Database>,
  missionId: string,
  userId: string,
): Promise<OwnMissionDetails> {
  const [missionResult, skillsResult, attachmentsResult] = await Promise.all([
    client
      .from('missions')
      .select('*')
      .eq('id', missionId)
      .eq('owner_id', userId)
      .single(),
    client
      .from('mission_skills')
      .select('skill_id, required_level')
      .eq('mission_id', missionId),
    client
      .from('mission_attachments')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at'),
  ]);
  const error =
    missionResult.error ?? skillsResult.error ?? attachmentsResult.error;
  if (error) throw error;
  if (!missionResult.data) throw new Error('MISSION_NOT_FOUND');
  return {
    attachments: attachmentsResult.data ?? [],
    mission: missionResult.data,
    skills: (skillsResult.data ?? []) as OwnMissionDetails['skills'],
  };
}

export function ownMissionToValues(
  details: OwnMissionDetails,
): MissionFormValues {
  const mission = details.mission;
  return {
    applicationDeadline: mission.application_deadline ?? '',
    budgetMax: mission.budget_max ?? 0,
    budgetMin: mission.budget_min ?? 0,
    budgetModel: mission.budget_model,
    category: mission.category as MissionFormValues['category'],
    countryCode: mission.country_code ?? '',
    deliverablesText: parseStringArray(mission.deliverables).join('\n'),
    description: mission.description,
    endsOn: mission.ends_on ?? '',
    flexibleSchedule: mission.flexible_schedule,
    presenceDetails: mission.presence_details ?? '',
    publicCity: mission.public_city ?? '',
    publicRegion: mission.public_region ?? '',
    requiredLevel: mission.required_level,
    skills: details.skills.map((skill) => ({
      level: skill.required_level,
      skillId: skill.skill_id,
    })),
    startsOn: mission.starts_on ?? '',
    title: mission.title,
    workMode: mission.work_mode,
  };
}

export async function transitionMission(
  client: SupabaseClient<Database>,
  missionId: string,
  expectedVersion: number,
  status: 'published' | 'cancelled',
): Promise<void> {
  const { error } = await client.rpc('transition_mission', {
    p_expected_version: expectedVersion,
    p_mission_id: missionId,
    p_new_status: status,
  });
  if (error) throw error;
}

export async function archiveMission(
  client: SupabaseClient<Database>,
  missionId: string,
  expectedVersion: number,
): Promise<void> {
  const { error } = await client.rpc('archive_mission', {
    p_expected_version: expectedVersion,
    p_mission_id: missionId,
  });
  if (error) throw error;
}

export async function setFavorite(
  client: SupabaseClient<Database>,
  userId: string,
  missionId: string,
  favorite: boolean,
): Promise<void> {
  const query = client
    .from('favorites')
    .delete()
    .eq('profile_id', userId)
    .eq('mission_id', missionId);
  const result = favorite
    ? await client
        .from('favorites')
        .insert({ mission_id: missionId, profile_id: userId })
    : await query;
  if (result.error) throw result.error;
}

const allowedAttachmentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

function safeAttachmentName(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-100);
  return normalized || 'document';
}

export async function uploadMissionAttachment(
  client: SupabaseClient<Database>,
  file: File,
  userId: string,
  target: { draftId?: string; missionId?: string },
): Promise<MissionAttachment> {
  if (!allowedAttachmentTypes.has(file.type)) {
    throw new Error('ATTACHMENT_TYPE');
  }
  if (file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw new Error('ATTACHMENT_SIZE');
  }
  const targetId = target.draftId ?? target.missionId;
  if (!targetId) throw new Error('ATTACHMENT_TARGET');
  const path = `${userId}/${targetId}/${crypto.randomUUID()}-${safeAttachmentName(file.name)}`;
  const { error: uploadError } = await client.storage
    .from('mission-attachments')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from('mission_attachments')
    .insert({
      draft_id: target.draftId ?? null,
      file_name: file.name,
      mime_type: file.type,
      mission_id: target.missionId ?? null,
      owner_id: userId,
      size_bytes: file.size,
      storage_path: path,
    })
    .select('*')
    .single();
  if (error) {
    await client.storage.from('mission-attachments').remove([path]);
    throw error;
  }
  return data;
}

export async function removeMissionAttachment(
  client: SupabaseClient<Database>,
  attachment: MissionAttachment,
): Promise<void> {
  const { error: storageError } = await client.storage
    .from('mission-attachments')
    .remove([attachment.storage_path]);
  if (storageError) throw storageError;
  const { error } = await client
    .from('mission_attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw error;
}

export async function listMissionAttachments(
  client: SupabaseClient<Database>,
  target: { draftId?: string; missionId?: string },
): Promise<MissionAttachment[]> {
  let query = client.from('mission_attachments').select('*');
  if (target.draftId) query = query.eq('draft_id', target.draftId);
  if (target.missionId) query = query.eq('mission_id', target.missionId);
  const { data, error } = await query.order('created_at');
  if (error) throw error;
  return data;
}
