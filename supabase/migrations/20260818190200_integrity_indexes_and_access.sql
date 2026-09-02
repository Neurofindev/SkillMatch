-- SkillMatch phase 02: state machines, cross-table invariants, indexes, and deny-by-default access.

create function public.validate_mission_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('published', 'cancelled'))
    or (old.status = 'published' and new.status in ('selecting', 'cancelled'))
    or (old.status = 'selecting' and new.status in ('published', 'assigned', 'cancelled'))
    or (old.status = 'assigned' and new.status in ('in_progress', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'invalid mission status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status in ('assigned', 'in_progress', 'completed') and new.assigned_talent_id is null then
    raise exception 'assigned talent is required for mission status %', new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.validate_application_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'submitted' and new.status in ('viewed', 'rejected', 'withdrawn'))
    or (old.status = 'viewed' and new.status in ('shortlisted', 'rejected', 'withdrawn'))
    or (old.status = 'shortlisted' and new.status in ('accepted', 'rejected', 'withdrawn'))
  ) then
    raise exception 'invalid application status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.validate_match_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> new.status and not (
    old.status = 'active' and new.status in ('completed', 'cancelled')
  ) then
    raise exception 'invalid match status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.validate_agreement_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('client_confirmed', 'talent_confirmed'))
    or (old.status in ('client_confirmed', 'talent_confirmed') and new.status = 'confirmed')
    or (old.status = 'confirmed' and new.status = 'active')
    or (old.status = 'active' and new.status = 'completed')
  ) then
    raise exception 'invalid agreement status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.validate_application_parties()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mission_owner uuid;
  applicant_can_work boolean;
begin
  select owner_id
  into mission_owner
  from public.missions
  where id = new.mission_id and deleted_at is null;

  select can_work and deleted_at is null
  into applicant_can_work
  from public.profiles
  where id = new.applicant_id;

  if mission_owner is not null and mission_owner = new.applicant_id then
    raise exception 'mission owners cannot apply to their own mission'
      using errcode = '23514';
  end if;

  if applicant_can_work is false then
    raise exception 'application requires an active work capability'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.validate_conversation_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  match_client uuid;
  match_talent uuid;
begin
  select m.client_id, m.talent_id
  into match_client, match_talent
  from public.conversations c
  join public.matches m on m.id = c.match_id
  where c.id = new.conversation_id;

  if match_client is not null and new.profile_id not in (match_client, match_talent) then
    raise exception 'conversation members must be match participants'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.validate_completion_participant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  match_client uuid;
  match_talent uuid;
begin
  select client_id, talent_id
  into match_client, match_talent
  from public.matches
  where id = new.match_id and mission_id = new.mission_id;

  if match_client is not null and new.participant_id not in (match_client, match_talent) then
    raise exception 'completion confirmation requires a match participant'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.validate_review_participants()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  match_client uuid;
  match_talent uuid;
  current_match_status public.match_status;
  current_mission_status public.mission_status;
begin
  select m.client_id, m.talent_id, m.status, ms.status
  into match_client, match_talent, current_match_status, current_mission_status
  from public.matches m
  join public.missions ms on ms.id = m.mission_id
  where m.id = new.match_id and m.mission_id = new.mission_id;

  if match_client is null then
    return new;
  end if;

  if current_match_status <> 'completed' or current_mission_status <> 'completed' then
    raise exception 'reviews require a completed mission and match'
      using errcode = '23514';
  end if;

  if not (
    (new.author_id = match_client and new.recipient_id = match_talent)
    or (new.author_id = match_talent and new.recipient_id = match_client)
  ) then
    raise exception 'review participants must match the client and talent'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.prevent_mission_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'mission events are append-only' using errcode = '55000';
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger skills_set_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

create trigger profile_skills_set_updated_at
before update on public.profile_skills
for each row execute function public.set_updated_at();

create trigger availability_slots_set_updated_at
before update on public.availability_slots
for each row execute function public.set_updated_at();

create trigger missions_validate_transition
before update of status on public.missions
for each row execute function public.validate_mission_transition();

create trigger missions_set_updated_at_and_version
before update on public.missions
for each row execute function public.set_updated_at_and_version();

create trigger mission_private_locations_set_updated_at
before update on public.mission_private_locations
for each row execute function public.set_updated_at();

create trigger applications_validate_parties
before insert or update of mission_id, applicant_id on public.applications
for each row execute function public.validate_application_parties();

create trigger applications_validate_transition
before update of status on public.applications
for each row execute function public.validate_application_transition();

create trigger applications_set_updated_at_and_version
before update on public.applications
for each row execute function public.set_updated_at_and_version();

create trigger matches_validate_transition
before update of status on public.matches
for each row execute function public.validate_match_transition();

create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create trigger agreements_validate_transition
before update of status on public.agreements
for each row execute function public.validate_agreement_transition();

create trigger agreements_set_updated_at_and_version
before update on public.agreements
for each row execute function public.set_updated_at_and_version();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create trigger conversation_members_validate_participant
before insert or update of conversation_id, profile_id on public.conversation_members
for each row execute function public.validate_conversation_member();

create trigger completion_confirmations_validate_participant
before insert or update of match_id, mission_id, participant_id on public.completion_confirmations
for each row execute function public.validate_completion_participant();

create trigger reviews_validate_participants
before insert or update of match_id, mission_id, author_id, recipient_id on public.reviews
for each row execute function public.validate_review_participants();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create trigger mission_events_reject_update
before update on public.mission_events
for each row execute function public.prevent_mission_event_mutation();

create trigger mission_events_reject_delete
before delete on public.mission_events
for each row execute function public.prevent_mission_event_mutation();

create index profiles_capabilities_idx
  on public.profiles (can_work, can_hire)
  where deleted_at is null;
create index profile_skills_skill_idx on public.profile_skills (skill_id, declared_level);
create index availability_slots_profile_time_idx
  on public.availability_slots (profile_id, starts_at, ends_at);

create index missions_discovery_idx
  on public.missions (status, work_mode, created_at desc)
  where deleted_at is null;
create index missions_owner_status_idx
  on public.missions (owner_id, status, updated_at desc)
  where deleted_at is null;
create index missions_schedule_idx
  on public.missions (starts_on, ends_on)
  where deleted_at is null and status in ('published', 'selecting');
create index mission_skills_skill_idx
  on public.mission_skills (skill_id, required_level, importance);

create unique index applications_one_active_per_talent_mission_idx
  on public.applications (mission_id, applicant_id)
  where deleted_at is null and status in ('submitted', 'viewed', 'shortlisted', 'accepted');
create index applications_mission_status_idx
  on public.applications (mission_id, status, created_at desc)
  where deleted_at is null;
create index applications_applicant_status_idx
  on public.applications (applicant_id, status, updated_at desc)
  where deleted_at is null;

create unique index swipes_profile_target_once_idx
  on public.swipes (author_id, target_profile_id)
  where target_type = 'profile';
create unique index swipes_mission_target_once_idx
  on public.swipes (author_id, target_mission_id)
  where target_type = 'mission';
create index swipes_author_created_idx on public.swipes (author_id, created_at desc);

create unique index matches_one_active_per_mission_idx
  on public.matches (mission_id)
  where status = 'active';
create index matches_client_status_idx on public.matches (client_id, status, updated_at desc);
create index matches_talent_status_idx on public.matches (talent_id, status, updated_at desc);
create index agreements_match_status_idx on public.agreements (match_id, status, version desc);

create index conversation_members_unread_idx
  on public.conversation_members (profile_id, last_read_at)
  where archived_at is null;
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc)
  where deleted_at is null;
create index mission_events_mission_created_idx
  on public.mission_events (mission_id, created_at desc);

create index notifications_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;
create index reviews_recipient_created_idx
  on public.reviews (recipient_id, created_at desc);
create index favorites_mission_idx on public.favorites (mission_id, created_at desc);
create index blocks_blocked_idx on public.blocks (blocked_id, created_at desc);
create index user_roles_role_idx on public.user_roles (role, user_id);
create index reports_status_created_idx on public.reports (status, created_at);
create index reports_reporter_created_idx on public.reports (reporter_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;
alter table public.availability_slots enable row level security;
alter table public.missions enable row level security;
alter table public.mission_private_locations enable row level security;
alter table public.mission_skills enable row level security;
alter table public.applications enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.agreements enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.mission_events enable row level security;
alter table public.completion_confirmations enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.blocks enable row level security;
alter table public.user_roles enable row level security;
alter table public.reports enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

comment on function public.validate_mission_transition() is
  'Enforces draft -> published -> selecting -> assigned -> in_progress -> completed, with controlled cancellation branches.';
comment on function public.validate_application_transition() is
  'Enforces submitted -> viewed -> shortlisted -> accepted and the permitted rejected/withdrawn branches.';
comment on function public.validate_agreement_transition() is
  'Enforces separate participant confirmation before confirmed, active, and completed.';
