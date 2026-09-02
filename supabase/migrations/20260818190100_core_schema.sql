-- SkillMatch phase 02: relational schema and declarative constraints.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique,
  display_name text not null,
  headline text,
  bio text,
  primary_mode public.account_mode not null,
  can_work boolean not null default false,
  can_hire boolean not null default false,
  avatar_path text,
  city text,
  country_code varchar(2),
  remote_available boolean not null default true,
  adult_confirmed boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_username_format_check
    check (username::text ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$'),
  constraint profiles_display_name_length_check
    check (char_length(btrim(display_name)) between 2 and 80),
  constraint profiles_headline_length_check
    check (headline is null or char_length(btrim(headline)) between 3 and 140),
  constraint profiles_bio_length_check
    check (bio is null or char_length(btrim(bio)) between 20 and 2000),
  constraint profiles_avatar_path_check
    check (
      avatar_path is null
      or (
        char_length(avatar_path) between 1 and 500
        and avatar_path !~ '(^/|\.\.)'
      )
    ),
  constraint profiles_city_length_check
    check (city is null or char_length(btrim(city)) between 2 and 100),
  constraint profiles_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint profiles_has_capability_check check (can_work or can_hire),
  constraint profiles_primary_capability_check
    check (
      (primary_mode = 'talent' and can_work)
      or (primary_mode = 'client' and can_hire)
    ),
  constraint profiles_onboarding_adult_check
    check (not onboarding_completed or adult_confirmed),
  constraint profiles_deleted_at_check
    check (deleted_at is null or deleted_at >= created_at)
);

create table public.skills (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint skills_name_length_check check (char_length(btrim(name)) between 2 and 80),
  constraint skills_category_length_check check (char_length(btrim(category)) between 2 and 80)
);

create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id bigint not null references public.skills (id) on delete restrict,
  declared_level public.skill_level not null,
  years_experience numeric(4, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, skill_id),
  constraint profile_skills_experience_check
    check (years_experience is null or years_experience between 0 and 80)
);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.availability_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  recurrence_rule text,
  visibility public.availability_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_slots_dates_check check (ends_at > starts_at),
  constraint availability_slots_timezone_length_check
    check (char_length(btrim(timezone)) between 1 and 64),
  constraint availability_slots_recurrence_check
    check (
      (kind = 'one_time' and recurrence_rule is null)
      or (
        kind = 'recurring'
        and char_length(btrim(recurrence_rule)) between 3 and 500
      )
    )
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  description text not null,
  category text not null,
  work_mode public.work_mode not null,
  public_city text,
  public_region text,
  country_code varchar(2),
  budget_model public.budget_model not null,
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  currency_code varchar(3) not null default 'EUR',
  starts_on date,
  ends_on date,
  flexible_schedule boolean not null default false,
  required_level public.skill_level not null default 'intermediate',
  max_applications smallint,
  status public.mission_status not null default 'draft',
  assigned_talent_id uuid references public.profiles (id) on delete set null,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, owner_id),
  constraint missions_title_length_check check (char_length(btrim(title)) between 5 and 140),
  constraint missions_description_length_check
    check (char_length(btrim(description)) between 30 and 10000),
  constraint missions_category_length_check check (char_length(btrim(category)) between 2 and 80),
  constraint missions_public_city_length_check
    check (public_city is null or char_length(btrim(public_city)) between 2 and 100),
  constraint missions_public_region_length_check
    check (public_region is null or char_length(btrim(public_region)) between 2 and 140),
  constraint missions_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint missions_location_by_mode_check
    check (
      work_mode = 'remote'
      or (public_city is not null or public_region is not null)
    ),
  constraint missions_budget_min_check check (budget_min is null or budget_min >= 0),
  constraint missions_budget_max_check check (budget_max is null or budget_max >= 0),
  constraint missions_budget_range_check
    check (
      (budget_min is null and budget_max is null)
      or (budget_min is not null and (budget_max is null or budget_min <= budget_max))
    ),
  constraint missions_currency_check check (currency_code = 'EUR'),
  constraint missions_dates_check
    check (starts_on is null or ends_on is null or starts_on <= ends_on),
  constraint missions_max_applications_check
    check (max_applications is null or max_applications between 1 and 500),
  constraint missions_assigned_talent_check
    check (assigned_talent_id is null or assigned_talent_id <> owner_id),
  constraint missions_lock_version_check check (lock_version >= 1),
  constraint missions_deleted_at_check check (deleted_at is null or deleted_at >= created_at)
);

create table public.mission_private_locations (
  mission_id uuid primary key references public.missions (id) on delete cascade,
  exact_address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  access_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_private_locations_address_length_check
    check (exact_address is null or char_length(btrim(exact_address)) between 5 and 300),
  constraint mission_private_locations_coordinates_pair_check
    check ((latitude is null) = (longitude is null)),
  constraint mission_private_locations_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint mission_private_locations_longitude_check
    check (longitude is null or longitude between -180 and 180),
  constraint mission_private_locations_content_check
    check (exact_address is not null or latitude is not null),
  constraint mission_private_locations_notes_length_check
    check (access_notes is null or char_length(btrim(access_notes)) between 3 and 1000)
);

create table public.mission_skills (
  mission_id uuid not null references public.missions (id) on delete cascade,
  skill_id bigint not null references public.skills (id) on delete restrict,
  required_level public.skill_level not null,
  importance smallint not null default 3,
  created_at timestamptz not null default now(),
  primary key (mission_id, skill_id),
  constraint mission_skills_importance_check check (importance between 1 and 5)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete restrict,
  message text not null,
  proposed_amount numeric(12, 2),
  proposed_currency_code varchar(3) not null default 'EUR',
  availability_note text not null,
  status public.application_status not null default 'submitted',
  relevance_score numeric(5, 2),
  relevance_details jsonb not null default '{}'::jsonb,
  score_version text,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, mission_id, applicant_id),
  constraint applications_message_length_check
    check (char_length(btrim(message)) between 20 and 3000),
  constraint applications_proposed_amount_check
    check (proposed_amount is null or proposed_amount >= 0),
  constraint applications_currency_check check (proposed_currency_code = 'EUR'),
  constraint applications_availability_length_check
    check (char_length(btrim(availability_note)) between 3 and 1000),
  constraint applications_relevance_score_check
    check (relevance_score is null or relevance_score between 0 and 100),
  constraint applications_relevance_details_check
    check (jsonb_typeof(relevance_details) = 'object'),
  constraint applications_score_version_check
    check (score_version is null or char_length(btrim(score_version)) between 1 and 40),
  constraint applications_lock_version_check check (lock_version >= 1),
  constraint applications_deleted_at_check
    check (deleted_at is null or deleted_at >= created_at)
);

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.swipe_target_type not null,
  target_profile_id uuid references public.profiles (id) on delete cascade,
  target_mission_id uuid references public.missions (id) on delete cascade,
  decision public.swipe_decision not null,
  created_at timestamptz not null default now(),
  constraint swipes_typed_target_check
    check (
      (target_type = 'profile' and target_profile_id is not null and target_mission_id is null)
      or (target_type = 'mission' and target_profile_id is null and target_mission_id is not null)
    ),
  constraint swipes_no_self_profile_check
    check (target_profile_id is null or target_profile_id <> author_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null,
  accepted_application_id uuid not null unique,
  client_id uuid not null,
  talent_id uuid not null,
  status public.match_status not null default 'active',
  matched_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, mission_id),
  constraint matches_mission_client_fk
    foreign key (mission_id, client_id)
    references public.missions (id, owner_id)
    on delete restrict,
  constraint matches_application_talent_fk
    foreign key (accepted_application_id, mission_id, talent_id)
    references public.applications (id, mission_id, applicant_id)
    on delete restrict,
  constraint matches_distinct_participants_check check (client_id <> talent_id),
  constraint matches_status_dates_check
    check (
      (status = 'active' and completed_at is null and cancelled_at is null)
      or (status = 'completed' and completed_at is not null and cancelled_at is null)
      or (status = 'cancelled' and cancelled_at is not null and completed_at is null)
    )
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  mission_id uuid not null,
  version integer not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  scope_snapshot text not null,
  deliverables jsonb not null default '[]'::jsonb,
  starts_on date,
  ends_on date,
  budget_model public.budget_model not null,
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  currency_code varchar(3) not null default 'EUR',
  platform_notice text not null default 'SkillMatch facilite la mise en relation et ne traite aucun paiement. Les modalités de rémunération sont gérées directement entre les participants.',
  client_confirmed_at timestamptz,
  talent_confirmed_at timestamptz,
  status public.agreement_status not null default 'draft',
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, version),
  constraint agreements_match_mission_fk
    foreign key (match_id, mission_id)
    references public.matches (id, mission_id)
    on delete restrict,
  constraint agreements_version_check check (version >= 1),
  constraint agreements_scope_length_check
    check (char_length(btrim(scope_snapshot)) between 20 and 10000),
  constraint agreements_deliverables_check check (jsonb_typeof(deliverables) = 'array'),
  constraint agreements_dates_check
    check (starts_on is null or ends_on is null or starts_on <= ends_on),
  constraint agreements_budget_min_check check (budget_min is null or budget_min >= 0),
  constraint agreements_budget_max_check check (budget_max is null or budget_max >= 0),
  constraint agreements_budget_range_check
    check (
      (budget_min is null and budget_max is null)
      or (budget_min is not null and (budget_max is null or budget_min <= budget_max))
    ),
  constraint agreements_currency_check check (currency_code = 'EUR'),
  constraint agreements_platform_notice_check
    check (platform_notice = 'SkillMatch facilite la mise en relation et ne traite aucun paiement. Les modalités de rémunération sont gérées directement entre les participants.'),
  constraint agreements_confirmation_state_check
    check (
      (status = 'draft' and client_confirmed_at is null and talent_confirmed_at is null)
      or (status = 'client_confirmed' and client_confirmed_at is not null and talent_confirmed_at is null)
      or (status = 'talent_confirmed' and client_confirmed_at is null and talent_confirmed_at is not null)
      or (status in ('confirmed', 'active', 'completed') and client_confirmed_at is not null and talent_confirmed_at is not null)
    ),
  constraint agreements_lock_version_check check (lock_version >= 1)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique,
  mission_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_match_mission_fk
    foreign key (match_id, mission_id)
    references public.matches (id, mission_id)
    on delete cascade
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  last_read_at timestamptz,
  archived_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id),
  constraint conversation_members_read_date_check
    check (last_read_at is null or last_read_at >= joined_at),
  constraint conversation_members_archive_date_check
    check (archived_at is null or archived_at >= joined_at)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  attachment_path text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_body_length_check check (char_length(btrim(body)) between 1 and 5000),
  constraint messages_attachment_path_check
    check (
      attachment_path is null
      or (
        char_length(attachment_path) between 1 and 500
        and attachment_path !~ '(^/|\.\.)'
      )
    ),
  constraint messages_edited_at_check check (edited_at is null or edited_at >= created_at),
  constraint messages_deleted_at_check check (deleted_at is null or deleted_at >= created_at)
);

create table public.mission_events (
  id bigint generated always as identity primary key,
  mission_id uuid not null references public.missions (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type public.mission_event_type not null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint mission_events_old_values_check
    check (old_values is null or jsonb_typeof(old_values) = 'object'),
  constraint mission_events_new_values_check
    check (new_values is null or jsonb_typeof(new_values) = 'object'),
  constraint mission_events_metadata_check
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8192)
);

create table public.completion_confirmations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  mission_id uuid not null,
  participant_id uuid not null references public.profiles (id) on delete restrict,
  decision public.completion_decision not null,
  note text,
  created_at timestamptz not null default now(),
  unique (match_id, participant_id),
  constraint completion_confirmations_match_mission_fk
    foreign key (match_id, mission_id)
    references public.matches (id, mission_id)
    on delete restrict,
  constraint completion_confirmations_note_length_check
    check (note is null or char_length(btrim(note)) between 3 and 2000)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  internal_path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_length_check check (char_length(btrim(title)) between 3 and 120),
  constraint notifications_body_length_check check (char_length(btrim(body)) between 3 and 500),
  constraint notifications_internal_path_check
    check (
      internal_path is null
      or (
        char_length(internal_path) between 1 and 500
        and internal_path ~ '^/[A-Za-z0-9/_?&=.%#-]*$'
        and internal_path !~ '^//'
      )
    ),
  constraint notifications_read_at_check check (read_at is null or read_at >= created_at)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  mission_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete restrict,
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  rating smallint not null,
  comment text,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, author_id, recipient_id),
  constraint reviews_match_mission_fk
    foreign key (match_id, mission_id)
    references public.matches (id, mission_id)
    on delete restrict,
  constraint reviews_distinct_participants_check check (author_id <> recipient_id),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_comment_length_check
    check (comment is null or char_length(btrim(comment)) between 3 and 2000),
  constraint reviews_criteria_check check (jsonb_typeof(criteria) = 'object')
);

create table public.favorites (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, mission_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_check check (blocker_id <> blocked_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role),
  constraint user_roles_no_self_grant_check check (granted_by is null or granted_by <> user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete restrict,
  target_type public.report_target_type not null,
  target_profile_id uuid references public.profiles (id) on delete restrict,
  target_mission_id uuid references public.missions (id) on delete restrict,
  target_message_id uuid references public.messages (id) on delete restrict,
  target_review_id uuid references public.reviews (id) on delete restrict,
  reason public.report_reason not null,
  description text,
  status public.moderation_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_typed_target_check
    check (
      (target_type = 'profile' and target_profile_id is not null and target_mission_id is null and target_message_id is null and target_review_id is null)
      or (target_type = 'mission' and target_profile_id is null and target_mission_id is not null and target_message_id is null and target_review_id is null)
      or (target_type = 'message' and target_profile_id is null and target_mission_id is null and target_message_id is not null and target_review_id is null)
      or (target_type = 'review' and target_profile_id is null and target_mission_id is null and target_message_id is null and target_review_id is not null)
    ),
  constraint reports_no_self_profile_check
    check (target_profile_id is null or target_profile_id <> reporter_id),
  constraint reports_description_length_check
    check (description is null or char_length(btrim(description)) between 10 and 3000),
  constraint reports_resolution_check
    check (
      (status in ('submitted', 'triaged') and resolved_at is null)
      or (status in ('actioned', 'dismissed') and resolved_at is not null)
    )
);

comment on table public.mission_private_locations is
  'Exact mission locations are isolated from publicly discoverable mission fields.';
comment on column public.missions.budget_min is
  'Informational range only; it never initiates or records a transfer of funds.';
comment on column public.missions.budget_max is
  'Informational range only; it never initiates or records a transfer of funds.';
comment on column public.applications.proposed_amount is
  'Informational proposal only; it never initiates or records a transfer of funds.';
comment on column public.agreements.platform_notice is
  'Mandatory immutable notice describing SkillMatch limited role.';
comment on table public.mission_events is
  'Append-only business transition log without precise location tracking.';
comment on table public.user_roles is
  'Sensitive administrative grants kept outside user-editable profiles.';
