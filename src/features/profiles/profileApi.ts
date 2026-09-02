import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database.generated';
import type {
  OnboardingValues,
  ProfileFormValues,
  SkillLevel,
} from '@/features/profiles/profileSchemas';

export type SkillOption = Database['public']['Tables']['skills']['Row'];
export type OwnProfile = Database['public']['Tables']['profiles']['Row'];
export type AvailabilitySlot =
  Database['public']['Tables']['availability_slots']['Row'];
export type OwnProfileSkill =
  Database['public']['Tables']['profile_skills']['Row'];

export interface OwnProfileDetails {
  availability: AvailabilitySlot | null;
  profile: OwnProfile;
  skills: OwnProfileSkill[];
}

export interface OnboardingDraft {
  currentStep: number;
  values: OnboardingValues;
}

function toJson(value: OnboardingValues): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toAvailabilityIso(date: string, endOfDay: boolean): string {
  return new Date(
    `${date}T${endOfDay ? '18:00:00' : '09:00:00'}`,
  ).toISOString();
}

export function getFrenchProfileError(error: unknown): string {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : undefined;
  const code = candidate?.code;
  const message = candidate?.message?.toLowerCase() ?? '';

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    error instanceof TypeError
  ) {
    return 'Connexion au service impossible. Vos informations restent affichées pour vous permettre de réessayer.';
  }
  if (code === '23505' || message.includes('username unavailable')) {
    return 'Ce username est déjà utilisé. Choisissez-en un autre.';
  }
  if (code === '42501') {
    return 'Vous n’êtes pas autorisé à modifier ce profil.';
  }
  if (message.includes('email confirmation required')) {
    return 'Confirmez votre adresse e-mail avant de terminer l’onboarding.';
  }
  if (code === '23503' || message.includes('skill')) {
    return 'Une compétence sélectionnée n’est plus disponible. Actualisez la liste.';
  }
  return 'L’enregistrement a échoué. Vérifiez les informations puis réessayez.';
}

export async function listSkills(
  client: SupabaseClient<Database>,
): Promise<SkillOption[]> {
  const { data, error } = await client
    .from('skills')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getOnboardingDraft(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<{ current_step: number; payload: Json } | null> {
  const { data, error } = await client
    .from('onboarding_drafts')
    .select('current_step, payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveOnboardingDraft(
  client: SupabaseClient<Database>,
  userId: string,
  currentStep: number,
  values: OnboardingValues,
): Promise<void> {
  const { error } = await client.from('onboarding_drafts').upsert(
    {
      current_step: currentStep,
      payload: toJson(values),
      user_id: userId,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function isUsernameAvailable(
  client: SupabaseClient<Database>,
  username: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('is_username_available', {
    p_username: username,
  });
  if (error) throw error;
  return data;
}

export async function saveProfile(
  client: SupabaseClient<Database>,
  userId: string,
  values: ProfileFormValues,
  completeOnboarding: boolean,
  adultConfirmed: boolean,
): Promise<void> {
  const { error } = await client.rpc('save_profile', {
    p_adult_confirmed: adultConfirmed,
    p_avatar_path: values.avatarPath ?? '',
    p_availability_end: toAvailabilityIso(values.availabilityEnd, true),
    p_availability_start: toAvailabilityIso(values.availabilityStart, false),
    p_availability_timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    p_availability_visibility: values.availabilityVisibility,
    p_bio: values.bio,
    p_capability: values.capability,
    p_city: values.city,
    p_complete_onboarding: completeOnboarding,
    p_country_code: values.countryCode,
    p_display_name: values.displayName,
    p_headline: values.headline,
    p_profile_id: userId,
    p_show_approximate_location: values.showApproximateLocation,
    p_skill_ids: values.skills.map((skill) => skill.skillId),
    p_skill_levels: values.skills.map((skill) => skill.level),
    p_username: values.username,
    p_work_preference: values.workPreference,
  });
  if (error) throw error;
}

export async function getOwnProfileDetails(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<OwnProfileDetails> {
  const [profileResult, skillsResult, availabilityResult] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).single(),
    client.from('profile_skills').select('*').eq('profile_id', userId),
    client
      .from('availability_slots')
      .select('*')
      .eq('profile_id', userId)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
  ]);
  const error =
    profileResult.error ?? skillsResult.error ?? availabilityResult.error;
  if (error) throw error;
  if (!profileResult.data || !skillsResult.data) {
    throw new Error('PROFILE_NOT_FOUND');
  }
  return {
    availability: availabilityResult.data,
    profile: profileResult.data,
    skills: skillsResult.data,
  };
}

export function inferCapability(
  profile: OwnProfile,
): ProfileFormValues['capability'] {
  if (profile.can_work && profile.can_hire) return 'both';
  return profile.can_work ? 'find' : 'publish';
}

export function inferWorkPreference(
  profile: OwnProfile,
): ProfileFormValues['workPreference'] {
  if (!profile.remote_available) return 'local';
  return profile.city ? 'both' : 'remote';
}

export function detailsToFormValues(
  details: OwnProfileDetails,
): ProfileFormValues {
  const { availability, profile, skills } = details;
  const defaults = {
    availabilityEnd: availability?.ends_at.slice(0, 10) ?? '',
    availabilityStart: availability?.starts_at.slice(0, 10) ?? '',
  };
  return {
    avatarPath: profile.avatar_path,
    availabilityEnd: defaults.availabilityEnd,
    availabilityStart: defaults.availabilityStart,
    availabilityVisibility: availability?.visibility ?? 'matched',
    bio: profile.bio ?? '',
    capability: inferCapability(profile),
    city: profile.city ?? '',
    countryCode: profile.country_code ?? '',
    displayName: profile.display_name,
    headline: profile.headline ?? '',
    showApproximateLocation: profile.show_approximate_location,
    skills: skills.map((skill) => ({
      level: skill.declared_level as SkillLevel,
      skillId: skill.skill_id,
    })),
    username: profile.username,
    workPreference: inferWorkPreference(profile),
  };
}
