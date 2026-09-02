-- SkillMatch phase 03: narrow public profile projection, derived counters and
-- reputation, real-event weekly ranking, and path-scoped Storage policies.

create function private.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create function private.can_send_to_conversation(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.conversations c
      join public.matches mt on mt.id = c.match_id
      where c.id = p_conversation_id
        and mt.status = 'active'
        and p_user_id in (mt.client_id, mt.talent_id)
        and not private.users_are_blocked(mt.client_id, mt.talent_id)
    );
$$;

revoke execute on function private.safe_uuid(text) from public, anon, authenticated;
revoke execute on function private.can_send_to_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function private.safe_uuid(text) to anon, authenticated;
grant execute on function private.can_send_to_conversation(uuid, uuid) to authenticated;

create function public.get_public_profiles(p_profile_id uuid default null)
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
    p.city,
    p.country_code,
    p.remote_available,
    p.created_at
  from public.profiles p
  where p.onboarding_completed
    and p.deleted_at is null
    and (p_profile_id is null or p.id = p_profile_id)
  order by p.display_name, p.id;
$$;

create function public.get_application_counts()
returns table (
  mission_id uuid,
  total_count bigint,
  submitted_count bigint,
  viewed_count bigint,
  shortlisted_count bigint,
  accepted_count bigint,
  closed_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  select
    ms.id,
    count(a.id),
    count(a.id) filter (where a.status = 'submitted'),
    count(a.id) filter (where a.status = 'viewed'),
    count(a.id) filter (where a.status = 'shortlisted'),
    count(a.id) filter (where a.status = 'accepted'),
    count(a.id) filter (where a.status in ('rejected', 'withdrawn'))
  from public.missions ms
  left join public.applications a
    on a.mission_id = ms.id
   and a.deleted_at is null
  where ms.owner_id = v_actor_id
    and ms.deleted_at is null
  group by ms.id
  order by ms.id;
end;
$$;

create function public.get_unread_counts()
returns table (
  unread_notifications bigint,
  unread_messages bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  select
    (
      select count(*)
      from public.notifications n
      where n.recipient_id = v_actor_id
        and n.read_at is null
    ),
    (
      select count(*)
      from public.conversation_members cm
      join public.messages msg on msg.conversation_id = cm.conversation_id
      where cm.profile_id = v_actor_id
        and cm.archived_at is null
        and msg.deleted_at is null
        and msg.author_id is distinct from v_actor_id
        and msg.created_at > coalesce(cm.last_read_at, cm.joined_at)
    );
end;
$$;

create function public.get_dashboard_stats()
returns table (
  owned_missions bigint,
  active_applications bigint,
  active_matches bigint,
  completed_matches bigint,
  unread_notifications bigint,
  unread_messages bigint,
  average_rating numeric,
  review_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  select
    (select count(*) from public.missions ms where ms.owner_id = v_actor_id and ms.deleted_at is null),
    (
      select count(*)
      from public.applications a
      where a.applicant_id = v_actor_id
        and a.deleted_at is null
        and a.status in ('submitted', 'viewed', 'shortlisted', 'accepted')
    ),
    (
      select count(*)
      from public.matches mt
      where v_actor_id in (mt.client_id, mt.talent_id)
        and mt.status = 'active'
    ),
    (
      select count(*)
      from public.matches mt
      where v_actor_id in (mt.client_id, mt.talent_id)
        and mt.status = 'completed'
    ),
    (
      select count(*)
      from public.notifications n
      where n.recipient_id = v_actor_id
        and n.read_at is null
    ),
    (
      select count(*)
      from public.conversation_members cm
      join public.messages msg on msg.conversation_id = cm.conversation_id
      where cm.profile_id = v_actor_id
        and cm.archived_at is null
        and msg.deleted_at is null
        and msg.author_id is distinct from v_actor_id
        and msg.created_at > coalesce(cm.last_read_at, cm.joined_at)
    ),
    (
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.recipient_id = v_actor_id
    ),
    (
      select count(*)
      from public.reviews r
      where r.recipient_id = v_actor_id
    );
end;
$$;

create function public.get_reputation(p_profile_id uuid)
returns table (
  profile_id uuid,
  reputation_score numeric,
  average_rating numeric,
  review_count bigint,
  completed_matches bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    round(avg(r.rating)::numeric * 20, 2),
    round(avg(r.rating)::numeric, 2),
    count(distinct r.id),
    count(distinct mt.id) filter (where mt.status = 'completed')
  from public.profiles p
  left join public.reviews r on r.recipient_id = p.id
  left join public.matches mt
    on p.id in (mt.client_id, mt.talent_id)
  where p.id = p_profile_id
    and p.onboarding_completed
    and p.deleted_at is null
  group by p.id;
$$;

create function public.get_weekly_ranking(p_limit integer default 10)
returns table (
  rank_position bigint,
  profile_id uuid,
  display_name text,
  completed_missions bigint,
  average_rating numeric,
  ranking_score numeric,
  period_start timestamptz,
  period_end timestamptz,
  formula_version text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period_end timestamptz := statement_timestamp();
  v_period_start timestamptz := v_period_end - interval '7 days';
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_limit not between 1 and 100 then
    raise exception 'ranking limit must be between 1 and 100'
      using errcode = '22023';
  end if;

  return query
  with completed as (
    select
      mt.talent_id,
      count(distinct me.id) as completed_count
    from public.mission_events me
    join public.matches mt on mt.mission_id = me.mission_id
    where me.event_type = 'mission_completed'
      and me.created_at >= v_period_start
      and me.created_at < v_period_end
      and mt.status = 'completed'
    group by mt.talent_id
  ), scored as (
    select
      p.id as profile_id,
      p.display_name,
      c.completed_count,
      round(avg(r.rating)::numeric, 2) as average_rating,
      (
        c.completed_count * 100
        + coalesce(round(avg(r.rating)::numeric, 2), 0) * 10
      )::numeric as ranking_score
    from completed c
    join public.profiles p on p.id = c.talent_id
    left join public.reviews r on r.recipient_id = p.id
    where p.deleted_at is null
      and p.onboarding_completed
    group by p.id, p.display_name, c.completed_count
  )
  select
    dense_rank() over (order by s.ranking_score desc, s.profile_id) as rank_position,
    s.profile_id,
    s.display_name,
    s.completed_count,
    s.average_rating,
    s.ranking_score,
    v_period_start,
    v_period_end,
    'weekly-completions-v1'::text
  from scored s
  order by rank_position, s.profile_id
  limit p_limit;
end;
$$;

revoke execute on function public.get_public_profiles(uuid) from public;
revoke execute on function public.get_application_counts() from public, anon;
revoke execute on function public.get_unread_counts() from public, anon;
revoke execute on function public.get_dashboard_stats() from public, anon;
revoke execute on function public.get_reputation(uuid) from public;
revoke execute on function public.get_weekly_ranking(integer) from public, anon;

grant execute on function public.get_public_profiles(uuid) to anon, authenticated;
grant execute on function public.get_application_counts() to authenticated;
grant execute on function public.get_unread_counts() to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.get_reputation(uuid) to anon, authenticated;
grant execute on function public.get_weekly_ranking(integer) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'message-attachments',
    'message-attachments',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Avatars use <owner-uuid>/<filename>. The bucket is public for reads, while
-- every write remains bound to auth.uid().
create policy avatars_select_public
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy avatars_insert_own_path
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_update_own_path
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_delete_own_path
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Private attachments use <conversation-uuid>/<owner-uuid>/<filename>.
create policy message_attachments_select_members
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and private.is_conversation_member(
    private.safe_uuid((storage.foldername(name))[1])
  )
);

create policy message_attachments_insert_member_path
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and private.can_send_to_conversation(
    private.safe_uuid((storage.foldername(name))[1])
  )
);

create policy message_attachments_update_member_path
on storage.objects
for update
to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and private.is_conversation_member(
    private.safe_uuid((storage.foldername(name))[1])
  )
)
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and private.can_send_to_conversation(
    private.safe_uuid((storage.foldername(name))[1])
  )
);

create policy message_attachments_delete_own_path
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and private.is_conversation_member(
    private.safe_uuid((storage.foldername(name))[1])
  )
);

comment on function public.get_public_profiles(uuid) is
  'Allow-listed public profile projection; private onboarding and deletion fields never leave the base table.';
comment on function public.get_reputation(uuid) is
  'Real review average normalized to 0-100 with source counts; null until at least one eligible review exists.';
comment on function public.get_weekly_ranking(integer) is
  'Seven-day ranking derived from recorded mission_completed events and completed matches, formula weekly-completions-v1; no stored counter or synthetic rank.';
