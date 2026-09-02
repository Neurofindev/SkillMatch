alter type public.report_reason add value if not exists 'fraud';
alter type public.report_reason add value if not exists 'discrimination';
alter type public.report_reason add value if not exists 'abuse';

alter table public.profiles
  add column suspended_at timestamptz,
  add column suspension_reason text,
  add column suspended_by uuid references public.profiles (id) on delete restrict,
  add constraint profiles_suspension_consistency_check check (
    (suspended_at is null and suspension_reason is null and suspended_by is null)
    or (
      suspended_at is not null
      and char_length(btrim(suspension_reason)) between 10 and 1000
      and suspended_by is not null
    )
  );

alter table public.missions
  add column moderation_hidden_at timestamptz,
  add column moderation_reason text,
  add column moderated_by uuid references public.profiles (id) on delete restrict,
  add constraint missions_moderation_consistency_check check (
    (moderation_hidden_at is null and moderation_reason is null and moderated_by is null)
    or (
      moderation_hidden_at is not null
      and char_length(btrim(moderation_reason)) between 10 and 1000
      and moderated_by is not null
    )
  );

alter table public.reports
  add column lock_version integer not null default 1,
  add column resolved_by uuid references public.profiles (id) on delete restrict,
  add column resolution_note text,
  add constraint reports_lock_version_check check (lock_version >= 1),
  add constraint reports_resolution_actor_check check (
    (status in ('submitted', 'triaged') and resolved_by is null and resolution_note is null)
    or (
      status in ('actioned', 'dismissed')
      and resolved_by is not null
      and char_length(btrim(resolution_note)) between 10 and 1000
    )
  );

create table public.moderation_actions (
  id bigint generated always as identity primary key,
  moderator_id uuid not null references public.profiles (id) on delete restrict,
  report_id uuid not null references public.reports (id) on delete restrict,
  action text not null,
  target_type public.report_target_type not null,
  target_profile_id uuid references public.profiles (id) on delete restrict,
  target_mission_id uuid references public.missions (id) on delete restrict,
  target_message_id uuid references public.messages (id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint moderation_actions_action_check check (
    action in ('triaged', 'dismissed', 'resolved', 'mission_hidden', 'profile_suspended')
  ),
  constraint moderation_actions_reason_check
    check (char_length(btrim(reason)) between 10 and 1000)
);

create table public.account_action_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  request_type text not null default 'deletion',
  status text not null default 'submitted',
  reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles (id) on delete restrict,
  resolution_note text,
  constraint account_action_requests_type_check check (request_type = 'deletion'),
  constraint account_action_requests_status_check
    check (status in ('submitted', 'processing', 'completed', 'rejected')),
  constraint account_action_requests_reason_check
    check (reason is null or char_length(btrim(reason)) between 10 and 1000),
  constraint account_action_requests_resolution_check check (
    (status in ('submitted', 'processing') and processed_at is null and processed_by is null)
    or (status in ('completed', 'rejected') and processed_at is not null and processed_by is not null)
  )
);

create unique index account_action_requests_one_open_idx
  on public.account_action_requests (profile_id, request_type)
  where status in ('submitted', 'processing');
create index moderation_actions_report_created_idx
  on public.moderation_actions (report_id, created_at desc);
create index profiles_public_active_idx
  on public.profiles (display_name, id)
  where onboarding_completed and deleted_at is null and suspended_at is null;
create index missions_moderation_visible_idx
  on public.missions (status, created_at desc)
  where deleted_at is null and moderation_hidden_at is null;

create or replace function private.is_active_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id is not null and exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.onboarding_completed
      and p.deleted_at is null
      and p.suspended_at is null
  );
$$;

create or replace function private.is_public_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_profile(p_profile_id);
$$;

create or replace function private.can_view_mission(
  p_mission_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.missions ms
    where ms.id = p_mission_id
      and ms.deleted_at is null
      and (
        private.is_moderator(p_user_id)
        or (
          ms.moderation_hidden_at is null
          and (
            (p_user_id is not null and ms.owner_id = p_user_id)
            or (p_user_id is not null and ms.assigned_talent_id = p_user_id)
            or private.is_mission_participant(ms.id, p_user_id)
            or (
              ms.archived_at is null
              and ms.status in ('published', 'selecting')
              and private.is_active_profile(ms.owner_id)
              and not private.users_are_blocked(ms.owner_id, p_user_id)
            )
          )
        )
        or (
          ms.moderation_hidden_at is not null
          and p_user_id is not null
          and (
            ms.owner_id = p_user_id
            or ms.assigned_talent_id = p_user_id
            or private.is_mission_participant(ms.id, p_user_id)
          )
        )
      )
  );
$$;

create or replace function private.can_edit_mission(
  p_mission_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and private.is_active_profile(p_user_id)
    and exists (
      select 1
      from public.missions ms
      where ms.id = p_mission_id
        and ms.owner_id = p_user_id
        and ms.status in ('draft', 'published', 'selecting')
        and ms.deleted_at is null
        and ms.archived_at is null
        and ms.moderation_hidden_at is null
    );
$$;

create or replace function private.can_apply_to_mission(
  p_mission_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and private.is_active_profile(p_user_id)
    and exists (
      select 1
      from public.missions ms
      where ms.id = p_mission_id
        and ms.status in ('published', 'selecting')
        and ms.deleted_at is null
        and ms.archived_at is null
        and ms.moderation_hidden_at is null
        and ms.owner_id <> p_user_id
        and private.is_active_profile(ms.owner_id)
        and not private.users_are_blocked(ms.owner_id, p_user_id)
    );
$$;

create or replace function public.validate_application_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_status public.mission_status;
  v_deadline date;
  v_max_applications integer;
  v_active_count integer;
begin
  select ms.owner_id, ms.status, ms.application_deadline, ms.max_applications
  into v_owner_id, v_status, v_deadline, v_max_applications
  from public.missions ms
  where ms.id = new.mission_id
    and ms.deleted_at is null
    and ms.archived_at is null
    and ms.moderation_hidden_at is null;

  if v_owner_id is null then
    raise exception 'applications require a visible mission' using errcode = '42501';
  end if;
  perform private.lock_user_pair(v_owner_id, new.applicant_id);
  if v_owner_id = new.applicant_id then
    raise exception 'mission owners cannot apply to their own mission' using errcode = '23514';
  end if;
  if v_status not in ('published', 'selecting') then
    raise exception 'applications require a discoverable mission' using errcode = '23514';
  end if;
  if v_deadline is not null and v_deadline < current_date then
    raise exception 'the application deadline has passed' using errcode = '23514';
  end if;
  if not private.is_active_profile(new.applicant_id)
     or not private.is_active_profile(v_owner_id) then
    raise exception 'active profiles are required' using errcode = '42501';
  end if;
  if v_max_applications is not null then
    select count(*)::integer into v_active_count
    from public.applications a
    where a.mission_id = new.mission_id
      and a.deleted_at is null
      and a.status in ('submitted', 'viewed', 'shortlisted');
    if v_active_count >= v_max_applications then
      raise exception 'the mission application limit has been reached' using errcode = '23514';
    end if;
  end if;
  if private.users_are_blocked(v_owner_id, new.applicant_id) then
    raise exception 'a block prevents this application' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_match_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_user_pair(new.client_id, new.talent_id);
  if not private.is_active_profile(new.client_id)
     or not private.is_active_profile(new.talent_id) then
    raise exception 'active profiles are required for a new match' using errcode = '42501';
  end if;
  if private.users_are_blocked(new.client_id, new.talent_id) then
    raise exception 'a block prevents this match' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_message_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_talent_id uuid;
  v_other_user_id uuid;
  v_match_status public.match_status;
begin
  select mt.client_id, mt.talent_id, mt.status
  into v_client_id, v_talent_id, v_match_status
  from public.conversations c
  join public.matches mt on mt.id = c.match_id
  where c.id = new.conversation_id;
  if new.author_id is null or new.author_id not in (v_client_id, v_talent_id) then
    raise exception 'message authors must be conversation participants' using errcode = '23514';
  end if;
  if v_match_status <> 'active' then
    raise exception 'new messages require an active match' using errcode = '23514';
  end if;
  v_other_user_id := case when new.author_id = v_client_id then v_talent_id else v_client_id end;
  perform private.lock_user_pair(new.author_id, v_other_user_id);
  if not private.is_active_profile(new.author_id)
     or not private.is_active_profile(v_other_user_id) then
    raise exception 'active profiles are required for new messages' using errcode = '42501';
  end if;
  if private.users_are_blocked(new.author_id, v_other_user_id) then
    raise exception 'a block prevents new messages' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function public.protect_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator(auth.uid()) and (
    new.suspended_at is distinct from old.suspended_at
    or new.suspension_reason is distinct from old.suspension_reason
    or new.suspended_by is distinct from old.suspended_by
  ) then
    raise exception 'profile moderation fields are server controlled' using errcode = '42501';
  end if;
  if old.suspended_at is not null and auth.uid() = old.id then
    raise exception 'suspended profiles cannot be edited' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_moderation_columns
before update on public.profiles
for each row execute function public.protect_moderation_columns();

create function public.protect_mission_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator(auth.uid()) and (
    new.moderation_hidden_at is distinct from old.moderation_hidden_at
    or new.moderation_reason is distinct from old.moderation_reason
    or new.moderated_by is distinct from old.moderated_by
  ) then
    raise exception 'mission moderation fields are server controlled' using errcode = '42501';
  end if;
  if old.moderation_hidden_at is not null and auth.uid() = old.owner_id then
    raise exception 'hidden missions cannot be edited' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger missions_protect_moderation_columns
before update on public.missions
for each row execute function public.protect_mission_moderation_columns();

create function public.validate_active_mission_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_profile(new.owner_id) then
    raise exception 'an active profile is required to create a mission' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger missions_validate_active_owner
before insert on public.missions
for each row execute function public.validate_active_mission_owner();

create or replace function public.get_public_profiles(p_profile_id uuid default null)
returns table (
  id uuid,
  username text,
  display_name text,
  headline text,
  bio text,
  primary_mode public.account_mode,
  can_work boolean,
  can_hire boolean,
  avatar_path text,
  city text,
  country_code varchar(2),
  remote_available boolean,
  email_verified boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username::text,
    p.display_name,
    p.headline,
    p.bio,
    p.primary_mode,
    p.can_work,
    p.can_hire,
    p.avatar_path,
    case when p.show_approximate_location then p.city else null end,
    case when p.show_approximate_location then p.country_code else null end,
    p.remote_available,
    u.email_confirmed_at is not null,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.onboarding_completed
    and p.deleted_at is null
    and p.suspended_at is null
    and (p_profile_id is null or p.id = p_profile_id)
    and (
      auth.uid() is null
      or p.id = auth.uid()
      or not private.users_are_blocked(p.id, auth.uid())
    )
  order by p.display_name, p.id;
$$;

create function public.submit_report(
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason public.report_reason,
  p_description text,
  p_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_report_id uuid;
  v_target_profile_id uuid;
  v_target_mission_id uuid;
  v_target_message_id uuid;
  v_target_review_id uuid;
  v_allowed boolean := false;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.is_active_profile(v_actor_id) then
    raise exception 'an active profile is required' using errcode = '42501';
  end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'explicit report confirmation required' using errcode = '23514';
  end if;
  if p_target_id is null then
    raise exception 'report target required' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) not between 20 and 1500 then
    raise exception 'report description length is invalid' using errcode = '23514';
  end if;

  if p_target_type = 'profile' then
    v_target_profile_id := p_target_id;
    v_allowed := p_target_id <> v_actor_id and (
      private.is_public_profile(p_target_id)
      or exists (
        select 1 from public.matches mt
        where v_actor_id in (mt.client_id, mt.talent_id)
          and p_target_id in (mt.client_id, mt.talent_id)
      )
    );
  elsif p_target_type = 'mission' then
    v_target_mission_id := p_target_id;
    v_allowed := private.can_view_mission(p_target_id, v_actor_id)
      and not exists (
        select 1 from public.missions ms
        where ms.id = p_target_id and ms.owner_id = v_actor_id
      );
  elsif p_target_type = 'message' then
    v_target_message_id := p_target_id;
    v_allowed := exists (
      select 1
      from public.messages msg
      join public.conversation_members cm on cm.conversation_id = msg.conversation_id
      where msg.id = p_target_id
        and cm.profile_id = v_actor_id
        and msg.author_id <> v_actor_id
    );
  elsif p_target_type = 'review' then
    v_target_review_id := p_target_id;
    v_allowed := exists (
      select 1 from public.reviews r
      where r.id = p_target_id and r.author_id <> v_actor_id
    );
  end if;
  if not v_allowed then
    raise exception 'report target is not accessible' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text || ':reports', 0));
  if (select count(*) from public.reports r
      where r.reporter_id = v_actor_id
        and r.created_at > statement_timestamp() - interval '1 hour') >= 10
     or (select count(*) from public.reports r
      where r.reporter_id = v_actor_id
        and r.created_at > statement_timestamp() - interval '1 day') >= 25 then
    raise exception 'report rate limit reached' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.reports r
    where r.reporter_id = v_actor_id
      and r.status in ('submitted', 'triaged')
      and r.target_type = p_target_type
      and r.reason = p_reason
      and r.target_profile_id is not distinct from v_target_profile_id
      and r.target_mission_id is not distinct from v_target_mission_id
      and r.target_message_id is not distinct from v_target_message_id
      and r.target_review_id is not distinct from v_target_review_id
  ) then
    raise exception 'an open duplicate report already exists' using errcode = '23505';
  end if;

  insert into public.reports (
    reporter_id, target_type, target_profile_id, target_mission_id,
    target_message_id, target_review_id, reason, description
  ) values (
    v_actor_id, p_target_type, v_target_profile_id, v_target_mission_id,
    v_target_message_id, v_target_review_id, p_reason, btrim(p_description)
  ) returning id into v_report_id;
  return v_report_id;
end;
$$;

create or replace function public.report_conversation_participant(
  p_conversation_id uuid,
  p_reason public.report_reason,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_counterpart_id uuid;
begin
  select case when mt.client_id = v_actor_id then mt.talent_id else mt.client_id end
  into v_counterpart_id
  from public.conversations c
  join public.matches mt on mt.id = c.match_id
  join public.conversation_members cm
    on cm.conversation_id = c.id and cm.profile_id = v_actor_id
  where c.id = p_conversation_id;
  if v_counterpart_id is null then
    raise exception 'conversation access is not authorized' using errcode = '42501';
  end if;
  return public.submit_report('profile', v_counterpart_id, p_reason, p_description, true);
end;
$$;

create function public.set_profile_block(p_profile_id uuid, p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.is_active_profile(v_actor_id) then
    raise exception 'an active profile is required' using errcode = '42501';
  end if;
  if p_profile_id is null or p_profile_id = v_actor_id then
    raise exception 'invalid block target' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id) then
    raise exception 'block target is unavailable' using errcode = 'P0002';
  end if;
  perform private.lock_user_pair(v_actor_id, p_profile_id);
  if p_blocked then
    insert into public.blocks (blocker_id, blocked_id)
    values (v_actor_id, p_profile_id)
    on conflict do nothing;
  else
    delete from public.blocks b
    where b.blocker_id = v_actor_id and b.blocked_id = p_profile_id;
  end if;
  return p_blocked;
end;
$$;

create function public.list_blocked_profiles()
returns table (
  profile_id uuid,
  username text,
  display_name text,
  avatar_path text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.blocked_id,
    case when p.deleted_at is null then p.username::text else 'compte-indisponible' end,
    case when p.deleted_at is null then p.display_name else 'Compte indisponible' end,
    case when p.deleted_at is null and p.suspended_at is null then p.avatar_path else null end,
    b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

create function public.get_moderation_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and private.is_moderator(auth.uid());
$$;

create function public.list_moderation_reports(
  p_status public.moderation_status default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  report_id uuid,
  target_type public.report_target_type,
  reason public.report_reason,
  description text,
  status public.moderation_status,
  target_label text,
  lock_version integer,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator(auth.uid()) then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  if p_page < 1 or p_page_size not between 1 and 50 then
    raise exception 'invalid pagination' using errcode = '22023';
  end if;
  return query
  select
    r.id,
    r.target_type,
    r.reason,
    r.description,
    r.status,
    coalesce(
      target_profile.display_name,
      target_mission.title,
      case when target_message.id is not null then 'Message ' || left(target_message.id::text, 8) end,
      case when target_review.id is not null then 'Avis ' || left(target_review.id::text, 8) end,
      'Ressource indisponible'
    ),
    r.lock_version,
    r.created_at,
    count(*) over()
  from public.reports r
  left join public.profiles target_profile on target_profile.id = r.target_profile_id
  left join public.missions target_mission on target_mission.id = r.target_mission_id
  left join public.messages target_message on target_message.id = r.target_message_id
  left join public.reviews target_review on target_review.id = r.target_review_id
  where p_status is null or r.status = p_status
  order by
    case r.status when 'submitted' then 1 when 'triaged' then 2 else 3 end,
    r.created_at,
    r.id
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

create function public.get_moderation_report(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_target jsonb;
  v_result jsonb;
begin
  if not private.is_moderator(auth.uid()) then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  select * into v_report from public.reports r where r.id = p_report_id;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  if v_report.target_type = 'profile' then
    select jsonb_build_object(
      'id', p.id,
      'displayName', p.display_name,
      'username', p.username::text,
      'headline', p.headline,
      'suspendedAt', p.suspended_at
    ) into v_target from public.profiles p where p.id = v_report.target_profile_id;
  elsif v_report.target_type = 'mission' then
    select jsonb_build_object(
      'id', ms.id,
      'title', ms.title,
      'description', ms.description,
      'ownerId', ms.owner_id,
      'status', ms.status,
      'hiddenAt', ms.moderation_hidden_at
    ) into v_target from public.missions ms where ms.id = v_report.target_mission_id;
  elsif v_report.target_type = 'message' then
    select jsonb_build_object(
      'id', msg.id,
      'body', case when msg.deleted_at is null then msg.body else 'Message supprimé' end,
      'authorId', msg.author_id,
      'conversationId', msg.conversation_id,
      'createdAt', msg.created_at
    ) into v_target from public.messages msg where msg.id = v_report.target_message_id;
  else
    select jsonb_build_object(
      'id', rv.id,
      'comment', rv.comment,
      'rating', rv.rating,
      'authorId', rv.author_id
    ) into v_target from public.reviews rv where rv.id = v_report.target_review_id;
  end if;
  select jsonb_build_object(
    'report', jsonb_build_object(
      'id', v_report.id,
      'targetType', v_report.target_type,
      'reason', v_report.reason,
      'description', v_report.description,
      'status', v_report.status,
      'lockVersion', v_report.lock_version,
      'createdAt', v_report.created_at,
      'resolvedAt', v_report.resolved_at,
      'resolutionNote', v_report.resolution_note
    ),
    'reporter', jsonb_build_object(
      'id', reporter.id,
      'displayName', reporter.display_name,
      'username', reporter.username::text
    ),
    'target', coalesce(v_target, jsonb_build_object('unavailable', true)),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ma.id,
        'action', ma.action,
        'reason', ma.reason,
        'moderatorId', ma.moderator_id,
        'createdAt', ma.created_at
      ) order by ma.created_at, ma.id)
      from public.moderation_actions ma where ma.report_id = v_report.id
    ), '[]'::jsonb)
  ) into v_result
  from public.profiles reporter where reporter.id = v_report.reporter_id;
  return v_result;
end;
$$;

create function public.moderate_report(
  p_report_id uuid,
  p_action text,
  p_reason text,
  p_expected_version integer
)
returns table (
  report_id uuid,
  status public.moderation_status,
  lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_report public.reports%rowtype;
  v_status public.moderation_status;
  v_target_profile_id uuid;
  v_target_mission_id uuid;
begin
  if not private.is_moderator(v_actor_id) then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  if p_action not in ('triage', 'dismiss', 'resolve', 'hide_mission', 'suspend_profile') then
    raise exception 'unsupported moderation action' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'moderation reason length is invalid' using errcode = '23514';
  end if;
  select * into v_report from public.reports r where r.id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  if v_report.lock_version <> p_expected_version then
    raise exception 'report version conflict' using errcode = '40001';
  end if;
  if v_report.status in ('actioned', 'dismissed') then
    raise exception 'report is already resolved' using errcode = '23514';
  end if;

  if p_action = 'triage' then
    v_status := 'triaged';
  elsif p_action = 'dismiss' then
    v_status := 'dismissed';
  else
    v_status := 'actioned';
  end if;

  if p_action = 'hide_mission' then
    if v_report.target_type <> 'mission' then
      raise exception 'this report does not target a mission' using errcode = '23514';
    end if;
    v_target_mission_id := v_report.target_mission_id;
    update public.missions ms
    set moderation_hidden_at = coalesce(ms.moderation_hidden_at, statement_timestamp()),
        moderation_reason = btrim(p_reason),
        moderated_by = v_actor_id,
        lock_version = ms.lock_version + 1
    where ms.id = v_target_mission_id;
  elsif p_action = 'suspend_profile' then
    v_target_profile_id := case
      when v_report.target_type = 'profile' then v_report.target_profile_id
      when v_report.target_type = 'mission' then (
        select ms.owner_id from public.missions ms where ms.id = v_report.target_mission_id
      )
      when v_report.target_type = 'message' then (
        select msg.author_id from public.messages msg where msg.id = v_report.target_message_id
      )
      when v_report.target_type = 'review' then (
        select rv.author_id from public.reviews rv where rv.id = v_report.target_review_id
      )
    end;
    if v_target_profile_id is null or v_target_profile_id = v_actor_id then
      raise exception 'profile suspension target is invalid' using errcode = '23514';
    end if;
    update public.profiles p
    set suspended_at = coalesce(p.suspended_at, statement_timestamp()),
        suspension_reason = btrim(p_reason),
        suspended_by = v_actor_id
    where p.id = v_target_profile_id;
  end if;

  update public.reports r
  set status = v_status,
      lock_version = r.lock_version + 1,
      resolved_at = case when v_status in ('actioned', 'dismissed') then statement_timestamp() else null end,
      resolved_by = case when v_status in ('actioned', 'dismissed') then v_actor_id else null end,
      resolution_note = case when v_status in ('actioned', 'dismissed') then btrim(p_reason) else null end
  where r.id = v_report.id
  returning r.id, r.status, r.lock_version into report_id, status, lock_version;

  insert into public.moderation_actions (
    moderator_id, report_id, action, target_type,
    target_profile_id, target_mission_id, target_message_id, reason
  ) values (
    v_actor_id,
    v_report.id,
    case p_action
      when 'triage' then 'triaged'
      when 'dismiss' then 'dismissed'
      when 'resolve' then 'resolved'
      when 'hide_mission' then 'mission_hidden'
      else 'profile_suspended'
    end,
    v_report.target_type,
    coalesce(v_target_profile_id, v_report.target_profile_id),
    coalesce(v_target_mission_id, v_report.target_mission_id),
    v_report.target_message_id,
    btrim(p_reason)
  );

  if v_status in ('actioned', 'dismissed') then
    insert into public.notifications (recipient_id, type, title, body, internal_path)
    values (
      v_report.reporter_id,
      'moderation_updated',
      'Signalement traité',
      'La modération a terminé l’examen de votre signalement.',
      '/espace/securite'
    );
  end if;
  return next;
end;
$$;

create function public.get_account_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_export jsonb;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'profile', jsonb_build_object(
      'id', p.id,
      'username', p.username::text,
      'displayName', p.display_name,
      'headline', p.headline,
      'bio', p.bio,
      'capabilities', jsonb_build_object('canWork', p.can_work, 'canHire', p.can_hire),
      'approximateLocation', jsonb_build_object('city', p.city, 'countryCode', p.country_code),
      'createdAt', p.created_at
    ),
    'missions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ms.id, 'title', ms.title, 'status', ms.status, 'createdAt', ms.created_at
    ) order by ms.created_at) from public.missions ms where ms.owner_id = v_actor_id), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'missionId', a.mission_id, 'status', a.status, 'createdAt', a.created_at
    ) order by a.created_at) from public.applications a where a.applicant_id = v_actor_id), '[]'::jsonb),
    'messagesAuthored', coalesce((select jsonb_agg(jsonb_build_object(
      'id', msg.id, 'conversationId', msg.conversation_id,
      'body', case when msg.deleted_at is null then msg.body else null end,
      'createdAt', msg.created_at, 'deletedAt', msg.deleted_at
    ) order by msg.created_at) from public.messages msg where msg.author_id = v_actor_id), '[]'::jsonb),
    'reviewsAuthored', coalesce((select jsonb_agg(jsonb_build_object(
      'id', rv.id, 'missionId', rv.mission_id, 'recipientId', rv.recipient_id,
      'rating', rv.rating, 'comment', rv.comment, 'createdAt', rv.created_at
    ) order by rv.created_at) from public.reviews rv where rv.author_id = v_actor_id), '[]'::jsonb),
    'reportsSubmitted', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'targetType', r.target_type, 'reason', r.reason,
      'description', r.description, 'status', r.status, 'createdAt', r.created_at
    ) order by r.created_at) from public.reports r where r.reporter_id = v_actor_id), '[]'::jsonb)
  ) into v_export
  from public.profiles p where p.id = v_actor_id;
  if v_export is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  return v_export;
end;
$$;

create function public.request_account_deletion(
  p_confirmation text,
  p_reason text default null
)
returns table (
  request_id uuid,
  status text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_confirmation <> 'SUPPRIMER MON COMPTE' then
    raise exception 'account deletion confirmation is invalid' using errcode = '23514';
  end if;
  if p_reason is not null and char_length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'account deletion reason length is invalid' using errcode = '23514';
  end if;
  insert into public.account_action_requests (profile_id, reason)
  values (v_actor_id, nullif(btrim(p_reason), ''))
  on conflict (profile_id, request_type)
    where account_action_requests.status in ('submitted', 'processing')
  do update set reason = coalesce(excluded.reason, public.account_action_requests.reason)
  returning id, account_action_requests.status, account_action_requests.requested_at
  into request_id, status, requested_at;
  return next;
end;
$$;

create or replace function private.valid_notification_path(
  p_path text,
  p_recipient_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_path text := p_path;
  v_resource_id uuid;
begin
  if v_path = '/applications' or v_path like '/missions/%/applications' then
    return '/espace/candidatures';
  elsif v_path like '/missions/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 3));
    if private.can_view_mission(v_resource_id, p_recipient_id) then
      return '/espace/missions/' || v_resource_id::text;
    end if;
    return '/espace/missions';
  elsif v_path like '/matches/%/agreement' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 3));
    if private.is_match_participant(v_resource_id, p_recipient_id) then
      return '/espace/matches/' || v_resource_id::text;
    end if;
    return '/espace/matches';
  elsif v_path = '/profile' then
    return '/espace/profil';
  elsif v_path in (
    '/espace/candidatures', '/espace/matches', '/espace/missions',
    '/espace/profil', '/espace/avis', '/espace/securite'
  ) then
    return v_path;
  elsif v_path like '/espace/messages/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 4));
    if private.is_conversation_member(v_resource_id, p_recipient_id) then
      return '/espace/messages/' || v_resource_id::text;
    end if;
  elsif v_path like '/espace/matches/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 4));
    if private.is_match_participant(v_resource_id, p_recipient_id) then
      return '/espace/matches/' || v_resource_id::text;
    end if;
  elsif v_path like '/espace/missions/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 4));
    if private.can_view_mission(v_resource_id, p_recipient_id) then
      return '/espace/missions/' || v_resource_id::text;
    end if;
  end if;
  return '/espace/notifications';
end;
$$;

alter table public.moderation_actions enable row level security;
alter table public.account_action_requests enable row level security;

create policy moderation_actions_select_moderator
on public.moderation_actions for select to authenticated
using (private.is_moderator());

create policy account_action_requests_select_own_or_moderator
on public.account_action_requests for select to authenticated
using (profile_id = auth.uid() or private.is_moderator());

revoke insert, update on public.reports from authenticated;
revoke update (status, resolved_at) on public.reports from authenticated;
revoke insert, delete on public.blocks from authenticated;
revoke update (deleted_at) on public.profiles from authenticated;
revoke all on public.moderation_actions from anon, authenticated;
revoke all on public.account_action_requests from anon, authenticated;
grant select on public.moderation_actions to authenticated;
grant select on public.account_action_requests to authenticated;

revoke execute on function private.is_active_profile(uuid) from public, anon, authenticated;
revoke execute on function public.protect_moderation_columns() from public, anon, authenticated;
revoke execute on function public.protect_mission_moderation_columns() from public, anon, authenticated;
revoke execute on function public.validate_active_mission_owner() from public, anon, authenticated;
revoke execute on function public.submit_report(public.report_target_type, uuid, public.report_reason, text, boolean) from public, anon;
revoke execute on function public.set_profile_block(uuid, boolean) from public, anon;
revoke execute on function public.list_blocked_profiles() from public, anon;
revoke execute on function public.get_moderation_access() from public, anon;
revoke execute on function public.list_moderation_reports(public.moderation_status, integer, integer) from public, anon;
revoke execute on function public.get_moderation_report(uuid) from public, anon;
revoke execute on function public.moderate_report(uuid, text, text, integer) from public, anon;
revoke execute on function public.get_account_export() from public, anon;
revoke execute on function public.request_account_deletion(text, text) from public, anon;

grant execute on function public.submit_report(public.report_target_type, uuid, public.report_reason, text, boolean) to authenticated;
grant execute on function public.set_profile_block(uuid, boolean) to authenticated;
grant execute on function public.list_blocked_profiles() to authenticated;
grant execute on function public.get_moderation_access() to authenticated;
grant execute on function public.list_moderation_reports(public.moderation_status, integer, integer) to authenticated;
grant execute on function public.get_moderation_report(uuid) to authenticated;
grant execute on function public.moderate_report(uuid, text, text, integer) to authenticated;
grant execute on function public.get_account_export() to authenticated;
grant execute on function public.request_account_deletion(text, text) to authenticated;

comment on table public.moderation_actions is
  'Append-only moderator audit log. Clients cannot insert, update or delete entries.';
comment on table public.account_action_requests is
  'Honest server-side request queue: a submitted deletion request does not claim that account erasure is complete.';
comment on function public.submit_report(public.report_target_type, uuid, public.report_reason, text, boolean) is
  'Creates a confirmed, accessible-target report with bounded content, duplicate protection and per-user rate limits.';
comment on function public.set_profile_block(uuid, boolean) is
  'Controls one directional block under a serialized user-pair lock; existing shared history stays readable.';
comment on function public.moderate_report(uuid, text, text, integer) is
  'Performs versioned moderator-only report transitions and content actions atomically while writing an audit entry.';
comment on function public.get_account_export() is
  'Returns an allow-listed export of the caller data without Auth internals or other participants private profile data.';
comment on column public.missions.moderation_hidden_at is
  'A hidden mission is excluded from discovery and new interactions; owners and existing participants retain historical access.';

create or replace function public.search_missions(
  p_query text,
  p_category text,
  p_work_modes public.work_mode[],
  p_city text,
  p_skill_ids bigint[],
  p_required_levels public.skill_level[],
  p_budget_min numeric,
  p_budget_max numeric,
  p_starts_before date,
  p_ends_after date,
  p_sort text,
  p_page integer,
  p_page_size integer,
  p_favorites_only boolean,
  p_mission_id uuid
)
returns table (
  mission_id uuid,
  title text,
  description text,
  category text,
  work_mode public.work_mode,
  public_city text,
  public_region text,
  country_code varchar,
  presence_details text,
  budget_model public.budget_model,
  budget_min numeric,
  budget_max numeric,
  currency_code varchar,
  application_deadline date,
  starts_on date,
  ends_on date,
  flexible_schedule boolean,
  required_level public.skill_level,
  deliverables jsonb,
  status public.mission_status,
  created_at timestamptz,
  updated_at timestamptz,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_headline text,
  owner_avatar_path text,
  owner_email_verified boolean,
  skills jsonb,
  is_favorite boolean,
  application_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_query text := nullif(btrim(p_query), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 12), 1), 24);
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.is_active_profile(v_actor_id) and not private.is_moderator(v_actor_id) then
    raise exception 'an active profile is required' using errcode = '42501';
  end if;
  if coalesce(p_sort, 'relevance') not in ('relevance', 'newest', 'budget_desc') then
    raise exception 'unsupported mission sort' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select
      ms.*,
      case when v_query is null then 0::real else
        ts_rank(
          to_tsvector(
            'simple',
            coalesce(ms.title, '') || ' ' || coalesce(ms.description, '') || ' ' || coalesce(ms.category, '')
          ),
          plainto_tsquery('simple', v_query)
        )
      end as relevance
    from public.missions ms
    where ms.deleted_at is null
      and (
        ms.moderation_hidden_at is null
        or (
          p_mission_id is not null
          and (ms.owner_id = v_actor_id or private.is_moderator(v_actor_id))
        )
      )
      and (
        (
          ms.archived_at is null
          and ms.status in ('published', 'selecting')
          and (p_mission_id is not null or ms.owner_id <> v_actor_id)
        )
        or (
          p_mission_id is not null
          and (ms.owner_id = v_actor_id or private.is_moderator(v_actor_id))
        )
      )
      and (p_mission_id is null or ms.id = p_mission_id)
      and (
        ms.owner_id = v_actor_id
        or private.is_moderator(v_actor_id)
        or not private.users_are_blocked(ms.owner_id, v_actor_id)
      )
      and (v_query is null or to_tsvector(
        'simple',
        coalesce(ms.title, '') || ' ' || coalesce(ms.description, '') || ' ' || coalesce(ms.category, '')
      ) @@ plainto_tsquery('simple', v_query))
      and (p_category is null or ms.category = p_category)
      and (coalesce(cardinality(p_work_modes), 0) = 0 or ms.work_mode = any(p_work_modes))
      and (
        nullif(btrim(p_city), '') is null
        or ms.work_mode = 'remote'
        or lower(ms.public_city) = lower(btrim(p_city))
        or lower(ms.public_region) = lower(btrim(p_city))
      )
      and (
        coalesce(cardinality(p_skill_ids), 0) = 0
        or exists (
          select 1 from public.mission_skills msk
          where msk.mission_id = ms.id and msk.skill_id = any(p_skill_ids)
        )
      )
      and (
        coalesce(cardinality(p_required_levels), 0) = 0
        or ms.required_level = any(p_required_levels)
      )
      and (p_budget_min is null or coalesce(ms.budget_max, ms.budget_min) >= p_budget_min)
      and (p_budget_max is null or coalesce(ms.budget_min, ms.budget_max) <= p_budget_max)
      and (p_starts_before is null or ms.starts_on is null or ms.starts_on <= p_starts_before)
      and (p_ends_after is null or ms.ends_on is null or ms.ends_on >= p_ends_after)
      and (
        not coalesce(p_favorites_only, false)
        or exists (
          select 1 from public.favorites f
          where f.profile_id = v_actor_id and f.mission_id = ms.id
        )
      )
  )
  select
    c.id,
    c.title,
    c.description,
    c.category,
    c.work_mode,
    c.public_city,
    c.public_region,
    c.country_code,
    c.presence_details,
    c.budget_model,
    c.budget_min,
    c.budget_max,
    c.currency_code,
    c.application_deadline,
    c.starts_on,
    c.ends_on,
    c.flexible_schedule,
    c.required_level,
    c.deliverables,
    c.status,
    c.created_at,
    c.updated_at,
    c.owner_id,
    p.username::text,
    p.display_name,
    p.headline,
    p.avatar_path,
    (u.email_confirmed_at is not null),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'category', s.category,
          'requiredLevel', msk.required_level,
          'importance', msk.importance
        ) order by msk.importance desc, s.name
      )
      from public.mission_skills msk
      join public.skills s on s.id = msk.skill_id
      where msk.mission_id = c.id and s.is_active
    ), '[]'::jsonb),
    exists (
      select 1 from public.favorites f
      where f.profile_id = v_actor_id and f.mission_id = c.id
    ),
    case when c.owner_id = v_actor_id then (
      select count(*) from public.applications a
      where a.mission_id = c.id and a.deleted_at is null
    ) else null end,
    count(*) over()
  from candidates c
  join public.profiles p
    on p.id = c.owner_id
    and p.deleted_at is null
    and (p.suspended_at is null or private.is_moderator(v_actor_id))
  join auth.users u on u.id = c.owner_id
  order by
    case when coalesce(p_sort, 'relevance') = 'relevance' then c.relevance end desc,
    case when p_sort = 'newest' then c.created_at end desc,
    case when p_sort = 'budget_desc' then coalesce(c.budget_max, c.budget_min) end desc nulls last,
    c.created_at desc,
    c.id
  limit v_page_size
  offset (v_page - 1) * v_page_size;
end;
$$;

comment on function public.search_missions(
  text, text, public.work_mode[], text, bigint[], public.skill_level[], numeric,
  numeric, date, date, text, integer, integer, boolean, uuid
) is
  'Paginated allow-listed mission discovery excluding hidden content, suspended owners and blocked relationships.';
