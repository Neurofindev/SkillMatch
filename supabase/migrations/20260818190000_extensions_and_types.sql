-- SkillMatch phase 02: extensions, closed vocabularies, and shared timestamp helpers.

create schema if not exists extensions;

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.account_mode as enum ('talent', 'client');
create type public.work_mode as enum ('local', 'remote', 'hybrid');
create type public.skill_level as enum ('beginner', 'intermediate', 'advanced', 'expert');
create type public.availability_kind as enum ('one_time', 'recurring');
create type public.availability_visibility as enum ('private', 'matched', 'public');
create type public.budget_model as enum ('fixed', 'hourly');

create type public.mission_status as enum (
  'draft',
  'published',
  'selecting',
  'assigned',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.application_status as enum (
  'submitted',
  'viewed',
  'shortlisted',
  'accepted',
  'rejected',
  'withdrawn'
);

create type public.swipe_target_type as enum ('profile', 'mission');
create type public.swipe_decision as enum ('pass', 'save', 'interested');
create type public.match_status as enum ('active', 'completed', 'cancelled');

create type public.agreement_status as enum (
  'draft',
  'client_confirmed',
  'talent_confirmed',
  'confirmed',
  'active',
  'completed'
);

create type public.mission_event_type as enum (
  'mission_created',
  'mission_published',
  'selection_started',
  'talent_assigned',
  'work_started',
  'mission_completed',
  'mission_cancelled',
  'agreement_updated',
  'completion_confirmed',
  'completion_disputed',
  'moderation_updated'
);

create type public.completion_decision as enum ('confirmed', 'disputed');

create type public.notification_type as enum (
  'application_received',
  'application_status_changed',
  'match_created',
  'agreement_updated',
  'new_message',
  'mission_status_changed',
  'review_received',
  'moderation_updated'
);

create type public.report_target_type as enum ('profile', 'mission', 'message', 'review');
create type public.report_reason as enum (
  'harassment',
  'spam',
  'illegal_activity',
  'dangerous_activity',
  'sensitive_data',
  'impersonation',
  'other'
);
create type public.moderation_status as enum ('submitted', 'triaged', 'actioned', 'dismissed');
create type public.user_role as enum ('admin', 'moderator');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function public.set_updated_at_and_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  new.lock_version := old.lock_version + 1;
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains server-owned updated_at timestamps.';
comment on function public.set_updated_at_and_version() is
  'Maintains updated_at and increments the optimistic concurrency version.';
