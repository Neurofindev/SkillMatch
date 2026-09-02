-- SkillMatch phase 09: verified reviews, reputation, dashboard and honest weekly ranking.

alter table public.notifications
  add column source_review_id uuid references public.reviews (id) on delete set null;

create unique index notifications_review_source_once_idx
  on public.notifications (recipient_id, source_review_id)
  where source_review_id is not null and type = 'review_received';

create index reviews_author_created_idx
  on public.reviews (author_id, created_at desc);

create function public.submit_review(
  p_match_id uuid,
  p_rating integer,
  p_comment text,
  p_communication integer,
  p_reliability integer,
  p_quality integer
)
returns table (
  review_id uuid,
  recipient_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mission_status public.mission_status;
  v_comment text := nullif(btrim(p_comment), '');
  v_recipient_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_rating not between 1 and 5
     or p_communication not between 1 and 5
     or p_reliability not between 1 and 5
     or p_quality not between 1 and 5 then
    raise exception 'review ratings must be integers between 1 and 5'
      using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) not between 3 and 2000 then
    raise exception 'review comment length is invalid' using errcode = '22023';
  end if;

  select mt.* into v_match
  from public.matches mt
  where mt.id = p_match_id
  for update;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'only match participants can submit a review'
      using errcode = '42501';
  end if;

  select ms.status into v_mission_status
  from public.missions ms
  where ms.id = v_match.mission_id;
  if v_match.status <> 'completed' or v_mission_status <> 'completed' then
    raise exception 'reviews require a completed mission and match'
      using errcode = '23514';
  end if;

  v_recipient_id := case
    when v_actor_id = v_match.client_id then v_match.talent_id
    else v_match.client_id
  end;

  if exists (
    select 1
    from public.reviews r
    where r.match_id = v_match.id
      and r.mission_id = v_match.mission_id
      and r.author_id = v_actor_id
      and r.recipient_id = v_recipient_id
  ) then
    raise exception 'review already submitted' using errcode = '23505';
  end if;

  insert into public.reviews (
    match_id,
    mission_id,
    author_id,
    recipient_id,
    rating,
    comment,
    criteria
  )
  values (
    v_match.id,
    v_match.mission_id,
    v_actor_id,
    v_recipient_id,
    p_rating,
    v_comment,
    jsonb_build_object(
      'communication', p_communication,
      'reliability', p_reliability,
      'quality', p_quality
    )
  )
  returning reviews.id, reviews.created_at
  into review_id, created_at;

  insert into public.notifications (
    recipient_id,
    type,
    title,
    body,
    internal_path,
    source_review_id
  )
  values (
    v_recipient_id,
    'review_received',
    'Nouvel avis vérifié',
    'Un participant a publié un avis relié à une mission réellement terminée.',
    '/espace/avis',
    review_id
  );

  recipient_id := v_recipient_id;
  return next;
end;
$$;

create function public.list_review_opportunities()
returns table (
  match_id uuid,
  mission_id uuid,
  mission_title text,
  completed_at timestamptz,
  participant_role text,
  counterpart_id uuid,
  counterpart_display_name text,
  counterpart_username text,
  counterpart_avatar_path text,
  own_review_id uuid,
  own_rating smallint,
  own_review_created_at timestamptz,
  counterpart_has_reviewed boolean
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
    mt.id,
    mt.mission_id,
    ms.title,
    mt.completed_at,
    case when mt.client_id = v_actor_id then 'client' else 'talent' end,
    counterpart.id,
    counterpart.display_name,
    counterpart.username::text,
    counterpart.avatar_path,
    own_review.id,
    own_review.rating,
    own_review.created_at,
    exists (
      select 1
      from public.reviews other_review
      where other_review.match_id = mt.id
        and other_review.author_id = counterpart.id
        and other_review.recipient_id = v_actor_id
    )
  from public.matches mt
  join public.missions ms on ms.id = mt.mission_id
  join public.profiles counterpart
    on counterpart.id = case
      when mt.client_id = v_actor_id then mt.talent_id
      else mt.client_id
    end
  left join public.reviews own_review
    on own_review.match_id = mt.id
   and own_review.author_id = v_actor_id
   and own_review.recipient_id = counterpart.id
  where v_actor_id in (mt.client_id, mt.talent_id)
    and mt.status = 'completed'
    and ms.status = 'completed'
    and counterpart.deleted_at is null
  order by mt.completed_at desc, mt.id;
end;
$$;

create function public.list_received_reviews(
  p_profile_id uuid,
  p_page integer default 1,
  p_page_size integer default 10
)
returns table (
  review_id uuid,
  match_id uuid,
  mission_id uuid,
  mission_title text,
  author_id uuid,
  author_display_name text,
  author_username text,
  rating smallint,
  comment text,
  criteria jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_profile_id is null or p_page < 1 or p_page_size not between 1 and 50 then
    raise exception 'invalid review pagination' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.onboarding_completed
      and p.deleted_at is null
  ) then
    return;
  end if;

  return query
  select
    r.id,
    r.match_id,
    r.mission_id,
    ms.title,
    author.id,
    author.display_name,
    author.username::text,
    r.rating,
    r.comment,
    r.criteria,
    r.created_at,
    count(*) over()
  from public.reviews r
  join public.matches mt
    on mt.id = r.match_id and mt.mission_id = r.mission_id
  join public.missions ms on ms.id = r.mission_id
  join public.profiles author on author.id = r.author_id
  where r.recipient_id = p_profile_id
    and mt.status = 'completed'
    and ms.status = 'completed'
    and author.deleted_at is null
  order by r.created_at desc, r.id desc
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

create function public.get_reputation_summary(p_profile_id uuid)
returns table (
  profile_id uuid,
  average_rating numeric,
  review_count bigint,
  rating_1_count bigint,
  rating_2_count bigint,
  rating_3_count bigint,
  rating_4_count bigint,
  rating_5_count bigint,
  completed_missions bigint,
  is_new_profile boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with review_stats as (
    select
      count(*) as review_count,
      round(avg(r.rating)::numeric, 2) as average_rating,
      count(*) filter (where r.rating = 1) as rating_1_count,
      count(*) filter (where r.rating = 2) as rating_2_count,
      count(*) filter (where r.rating = 3) as rating_3_count,
      count(*) filter (where r.rating = 4) as rating_4_count,
      count(*) filter (where r.rating = 5) as rating_5_count
    from public.reviews r
    join public.matches mt
      on mt.id = r.match_id
     and mt.mission_id = r.mission_id
     and mt.status = 'completed'
    join public.missions ms
      on ms.id = r.mission_id
     and ms.status = 'completed'
    where r.recipient_id = p_profile_id
  ),
  completion_stats as (
    select count(distinct mt.mission_id) as completed_missions
    from public.matches mt
    join public.missions ms on ms.id = mt.mission_id
    where p_profile_id in (mt.client_id, mt.talent_id)
      and mt.status = 'completed'
      and ms.status = 'completed'
  )
  select
    p.id,
    rs.average_rating,
    rs.review_count,
    rs.rating_1_count,
    rs.rating_2_count,
    rs.rating_3_count,
    rs.rating_4_count,
    rs.rating_5_count,
    cs.completed_missions,
    rs.review_count = 0
  from public.profiles p
  cross join review_stats rs
  cross join completion_stats cs
  where p.id = p_profile_id
    and p.onboarding_completed
    and p.deleted_at is null;
$$;

create function public.get_dashboard_overview()
returns table (
  can_work boolean,
  can_hire boolean,
  onboarding_completed boolean,
  profile_missing_fields text[],
  pending_applications bigint,
  client_active_missions bigint,
  talent_active_missions bigint,
  agreements_to_confirm bigint,
  unread_messages bigint,
  upcoming_deadlines bigint,
  reviews_to_leave bigint
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
    p.can_work,
    p.can_hire,
    p.onboarding_completed,
    array_remove(array[
      case when not p.onboarding_completed then 'onboarding' end,
      case when nullif(btrim(p.headline), '') is null then 'headline' end,
      case when nullif(btrim(p.bio), '') is null then 'bio' end,
      case when not exists (
        select 1 from public.profile_skills ps where ps.profile_id = p.id
      ) then 'skills' end,
      case when p.can_work and not exists (
        select 1 from public.availability_slots av where av.profile_id = p.id
      ) then 'availability' end
    ], null),
    (
      select count(*)
      from public.applications a
      where a.applicant_id = v_actor_id
        and a.deleted_at is null
        and a.status in ('submitted', 'viewed', 'shortlisted')
    ),
    (
      select count(*)
      from public.missions ms
      where ms.owner_id = v_actor_id
        and ms.deleted_at is null
        and ms.status in ('published', 'selecting', 'assigned', 'in_progress')
    ),
    (
      select count(*)
      from public.matches mt
      join public.missions ms on ms.id = mt.mission_id
      where mt.talent_id = v_actor_id
        and mt.status = 'active'
        and ms.status in ('assigned', 'in_progress')
    ),
    (
      select count(*)
      from public.agreements ag
      join public.matches mt on mt.id = ag.match_id
      where v_actor_id in (mt.client_id, mt.talent_id)
        and mt.status = 'active'
        and ag.status in ('draft', 'client_confirmed', 'talent_confirmed')
        and not exists (
          select 1 from public.agreements newer
          where newer.match_id = ag.match_id and newer.version > ag.version
        )
        and (
          (v_actor_id = mt.client_id and ag.client_confirmed_at is null)
          or (v_actor_id = mt.talent_id and ag.talent_confirmed_at is null)
        )
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
      select count(distinct ms.id)
      from public.missions ms
      left join public.matches mt
        on mt.mission_id = ms.id
       and v_actor_id in (mt.client_id, mt.talent_id)
      where ms.deleted_at is null
        and ms.ends_on between current_date and current_date + 14
        and (
          (ms.owner_id = v_actor_id and ms.status in ('published', 'selecting', 'assigned', 'in_progress'))
          or (mt.talent_id = v_actor_id and mt.status = 'active' and ms.status in ('assigned', 'in_progress'))
        )
    ),
    (
      select count(*)
      from public.matches mt
      join public.missions ms on ms.id = mt.mission_id
      where v_actor_id in (mt.client_id, mt.talent_id)
        and mt.status = 'completed'
        and ms.status = 'completed'
        and not exists (
          select 1
          from public.reviews r
          where r.match_id = mt.id and r.author_id = v_actor_id
        )
    )
  from public.profiles p
  where p.id = v_actor_id and p.deleted_at is null;
end;
$$;

create function public.list_dashboard_deadlines(p_limit integer default 5)
returns table (
  mission_id uuid,
  mission_title text,
  ends_on date,
  participant_role text,
  match_id uuid,
  internal_path text
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
  if p_limit not between 1 and 20 then
    raise exception 'deadline limit must be between 1 and 20'
      using errcode = '22023';
  end if;

  return query
  select
    ms.id,
    ms.title,
    ms.ends_on,
    case when ms.owner_id = v_actor_id then 'client' else 'talent' end,
    mt.id,
    case
      when mt.id is not null then '/espace/matches/' || mt.id::text
      else '/espace/missions/' || ms.id::text
    end
  from public.missions ms
  left join public.matches mt
    on mt.mission_id = ms.id
   and v_actor_id in (mt.client_id, mt.talent_id)
   and mt.status = 'active'
  where ms.deleted_at is null
    and ms.ends_on >= current_date
    and (
      (ms.owner_id = v_actor_id and ms.status in ('published', 'selecting', 'assigned', 'in_progress'))
      or (mt.talent_id = v_actor_id and ms.status in ('assigned', 'in_progress'))
    )
  order by ms.ends_on, ms.id
  limit p_limit;
end;
$$;

drop function public.get_weekly_ranking(integer);

create function public.get_weekly_ranking(p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period_end timestamptz := statement_timestamp();
  v_period_start timestamptz := v_period_end - interval '7 days';
  v_minimum_completed_missions constant integer := 3;
  v_minimum_profiles constant integer := 3;
  v_sample_completed_missions bigint;
  v_sample_profiles bigint;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_limit not between 1 and 100 then
    raise exception 'ranking limit must be between 1 and 100'
      using errcode = '22023';
  end if;

  with eligible_completions as (
    select distinct me.mission_id, mt.talent_id
    from public.mission_events me
    join public.matches mt
      on mt.mission_id = me.mission_id
     and mt.status = 'completed'
    join public.missions ms
      on ms.id = me.mission_id
     and ms.status = 'completed'
    where me.event_type = 'mission_completed'
      and me.created_at >= v_period_start
      and me.created_at < v_period_end
  )
  select count(*), count(distinct talent_id)
  into v_sample_completed_missions, v_sample_profiles
  from eligible_completions;

  if v_sample_completed_missions >= v_minimum_completed_missions
     and v_sample_profiles >= v_minimum_profiles then
    with eligible_completions as (
      select distinct me.mission_id, mt.talent_id
      from public.mission_events me
      join public.matches mt
        on mt.mission_id = me.mission_id
       and mt.status = 'completed'
      join public.missions ms
        on ms.id = me.mission_id
       and ms.status = 'completed'
      where me.event_type = 'mission_completed'
        and me.created_at >= v_period_start
        and me.created_at < v_period_end
    ),
    completions as (
      select ec.talent_id, count(*) as completed_count
      from eligible_completions ec
      group by ec.talent_id
    ),
    ranked as (
      select
        row_number() over (order by c.completed_count desc, p.id) as rank_position,
        p.id as profile_id,
        p.display_name,
        p.username,
        p.avatar_path,
        c.completed_count,
        round(avg(r.rating)::numeric, 2) as average_rating,
        count(distinct r.id) as review_count
      from completions c
      join public.profiles p on p.id = c.talent_id
      left join public.reviews r on r.recipient_id = p.id
      where p.onboarding_completed and p.deleted_at is null
      group by p.id, p.display_name, c.completed_count
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rankPosition', ranked.rank_position,
          'profileId', ranked.profile_id,
          'displayName', ranked.display_name,
          'username', ranked.username,
          'avatarPath', ranked.avatar_path,
          'weeklyCompletions', ranked.completed_count,
          'completedMissions', ranked.completed_count,
          'averageRating', ranked.average_rating,
          'reviewCount', ranked.review_count
        )
        order by ranked.rank_position
      ),
      '[]'::jsonb
    )
    into v_items
    from (select * from ranked order by rank_position limit p_limit) ranked;
  else
    v_items := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'formulaVersion', 'weekly-completions-v2',
    'periodStart', v_period_start,
    'periodEnd', v_period_end,
    'sampleCompletedMissions', v_sample_completed_missions,
    'sampleProfiles', v_sample_profiles,
    'minimumCompletedMissions', v_minimum_completed_missions,
    'minimumProfiles', v_minimum_profiles,
    'sufficientData',
      v_sample_completed_missions >= v_minimum_completed_missions
      and v_sample_profiles >= v_minimum_profiles,
    'items', v_items
  );
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
  elsif v_path = '/espace/candidatures'
     or v_path = '/espace/matches'
     or v_path = '/espace/missions'
     or v_path = '/espace/profil'
     or v_path = '/espace/avis' then
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

revoke insert on public.reviews from authenticated;

revoke execute on function public.submit_review(uuid, integer, text, integer, integer, integer)
  from public, anon;
revoke execute on function public.list_review_opportunities() from public, anon;
revoke execute on function public.list_received_reviews(uuid, integer, integer) from public;
revoke execute on function public.get_reputation_summary(uuid) from public;
revoke execute on function public.get_dashboard_overview() from public, anon;
revoke execute on function public.list_dashboard_deadlines(integer) from public, anon;
revoke execute on function public.get_weekly_ranking(integer) from public, anon;

grant execute on function public.submit_review(uuid, integer, text, integer, integer, integer)
  to authenticated;
grant execute on function public.list_review_opportunities() to authenticated;
grant execute on function public.list_received_reviews(uuid, integer, integer)
  to anon, authenticated;
grant execute on function public.get_reputation_summary(uuid) to anon, authenticated;
grant execute on function public.get_dashboard_overview() to authenticated;
grant execute on function public.list_dashboard_deadlines(integer) to authenticated;
grant execute on function public.get_weekly_ranking(integer) to authenticated;

comment on function public.submit_review(uuid, integer, text, integer, integer, integer) is
  'Creates one verified review per participant direction after a completed match and mission, with controlled criteria and one real notification.';
comment on function public.get_dashboard_overview() is
  'User-scoped aggregate dashboard counts derived at query time from profiles, applications, missions, agreements, messages and reviews.';
comment on function public.get_weekly_ranking(integer) is
  'Rolling seven-day completion activity. It returns no ranking items below three completed missions from three distinct talents and never presents activity as quality.';
