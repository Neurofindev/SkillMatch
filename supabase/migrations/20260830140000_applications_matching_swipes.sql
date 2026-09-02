-- Phase 06: controlled applications, deterministic relevance and secondary swipe.

create type public.application_swipe_decision as enum ('pass', 'compare', 'shortlist');

alter table public.applications
add column submission_confirmed_at timestamptz not null default statement_timestamp();

comment on column public.applications.submission_confirmed_at is
  'Server insertion timestamp. Authenticated creation is restricted to submit_application, which requires an explicit confirmation flag.';

create table public.application_swipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  decision public.application_swipe_decision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, application_id)
);

alter table public.application_swipes enable row level security;

create index application_swipes_owner_updated_idx
  on public.application_swipes (owner_id, updated_at desc);

create policy application_swipes_select_own
on public.application_swipes
for select
to authenticated
using (owner_id = auth.uid());

-- All writes go through the controlled RPCs below. Direct client writes would
-- otherwise be able to attach a decision to an unrelated application.
grant select on public.application_swipes to authenticated;

alter table public.swipes
  add column favorite_created_by_swipe boolean not null default false;

-- The bookkeeping flag must remain server-owned so an undo cannot delete a
-- favorite that existed before the swipe.
revoke insert, update, delete on public.swipes from authenticated;

create function private.skill_level_value(p_level public.skill_level)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select case p_level
    when 'beginner' then 1::numeric
    when 'intermediate' then 2::numeric
    when 'advanced' then 3::numeric
    when 'expert' then 4::numeric
  end;
$$;

create function private.calculate_application_relevance(
  p_mission_id uuid,
  p_applicant_id uuid,
  p_proposed_amount numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mission public.missions%rowtype;
  v_profile public.profiles%rowtype;
  v_skill_score numeric := 0.5;
  v_availability_score numeric := 0.5;
  v_mode_score numeric := 0.5;
  v_budget_score numeric := 0.5;
  v_reputation_score numeric := 0.5;
  v_total_score numeric;
  v_skill_count integer := 0;
  v_availability_count integer := 0;
  v_review_count integer := 0;
  v_completed_count integer := 0;
  v_missing text[] := array[]::text[];
begin
  select ms.*
  into v_mission
  from public.missions ms
  where ms.id = p_mission_id
    and ms.deleted_at is null;

  if not found then
    raise exception 'mission not found' using errcode = 'P0002';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.id = p_applicant_id
    and p.deleted_at is null;

  if not found then
    raise exception 'applicant profile not found' using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    coalesce(
      sum(
        ms.importance::numeric
        * case
            when ps.declared_level is null then 0::numeric
            else least(
              private.skill_level_value(ps.declared_level)
              / private.skill_level_value(ms.required_level),
              1::numeric
            )
          end
      ) / nullif(sum(ms.importance::numeric), 0),
      0.5::numeric
    )
  into v_skill_count, v_skill_score
  from public.mission_skills ms
  left join public.profile_skills ps
    on ps.profile_id = p_applicant_id
   and ps.skill_id = ms.skill_id
  where ms.mission_id = p_mission_id;

  if v_skill_count = 0 then
    v_missing := array_append(v_missing, 'Compétences requises non renseignées');
  end if;

  if v_mission.starts_on is null or v_mission.ends_on is null then
    v_missing := array_append(v_missing, 'Calendrier de mission non renseigné');
  else
    select count(*)::integer,
      coalesce(
        max(
          greatest(
            0::numeric,
            (
              least(v_mission.ends_on, av.ends_at::date)
              - greatest(v_mission.starts_on, av.starts_at::date)
              + 1
            )::numeric
            / nullif((v_mission.ends_on - v_mission.starts_on + 1)::numeric, 0)
          )
        ),
        0.5::numeric
      )
    into v_availability_count, v_availability_score
    from public.availability_slots av
    where av.profile_id = p_applicant_id
      and av.ends_at::date >= v_mission.starts_on
      and av.starts_at::date <= v_mission.ends_on;

    if v_availability_count = 0 then
      v_availability_score := 0.5;
      v_missing := array_append(v_missing, 'Disponibilité structurée non renseignée pour ces dates');
    end if;
  end if;

  -- There is deliberately no distance input. Remote uses only the declared
  -- remote capability. Local and hybrid use approximate locality, never an
  -- exact address or private coordinates.
  if v_mission.work_mode = 'remote' then
    v_mode_score := case when v_profile.remote_available then 1::numeric else 0::numeric end;
  elsif v_profile.city is null or v_profile.country_code is null then
    v_mode_score := 0.5;
    v_missing := array_append(v_missing, 'Zone approximative du talent non renseignée');
  elsif lower(btrim(v_profile.city)) = lower(btrim(coalesce(v_mission.public_city, '')))
        and v_profile.country_code = v_mission.country_code then
    v_mode_score := case
      when v_mission.work_mode = 'hybrid' and not v_profile.remote_available then 0.5::numeric
      else 1::numeric
    end;
  elsif v_profile.country_code = v_mission.country_code then
    v_mode_score := case
      when v_mission.work_mode = 'hybrid' and v_profile.remote_available then 0.65::numeric
      else 0.5::numeric
    end;
  else
    v_mode_score := 0::numeric;
  end if;

  if p_proposed_amount is null
     or (v_mission.budget_min is null and v_mission.budget_max is null) then
    v_budget_score := 0.5;
    v_missing := array_append(v_missing, 'Proposition ou budget informatif non renseigné');
  elsif p_proposed_amount >= coalesce(v_mission.budget_min, p_proposed_amount)
        and p_proposed_amount <= coalesce(v_mission.budget_max, p_proposed_amount) then
    v_budget_score := 1;
  elsif v_mission.budget_min is not null and p_proposed_amount < v_mission.budget_min then
    v_budget_score := greatest(0::numeric, p_proposed_amount / nullif(v_mission.budget_min, 0));
  else
    v_budget_score := greatest(
      0::numeric,
      coalesce(v_mission.budget_max, v_mission.budget_min, 0)
      / nullif(p_proposed_amount, 0)
    );
  end if;

  select count(*)::integer, avg(r.rating)::numeric / 5::numeric
  into v_review_count, v_reputation_score
  from public.reviews r
  where r.recipient_id = p_applicant_id;

  select count(*)::integer
  into v_completed_count
  from public.matches mt
  where mt.talent_id = p_applicant_id
    and mt.status = 'completed';

  if v_review_count = 0 then
    v_reputation_score := 0.5;
    v_missing := array_append(v_missing, 'Aucun avis issu d’une mission terminée');
  end if;

  v_skill_score := least(1::numeric, greatest(0::numeric, v_skill_score));
  v_availability_score := least(1::numeric, greatest(0::numeric, v_availability_score));
  v_mode_score := least(1::numeric, greatest(0::numeric, v_mode_score));
  v_budget_score := least(1::numeric, greatest(0::numeric, v_budget_score));
  v_reputation_score := least(1::numeric, greatest(0::numeric, v_reputation_score));

  v_total_score := round(
    100 * (
      0.45 * v_skill_score
      + 0.20 * v_availability_score
      + 0.15 * v_mode_score
      + 0.10 * v_budget_score
      + 0.10 * v_reputation_score
    )
  );

  return jsonb_build_object(
    'version', 'relevance-v1',
    'score', v_total_score,
    'calculatedAt', statement_timestamp(),
    'notice', 'Ce score aide au tri et ne prédit pas une embauche.',
    'components', jsonb_build_object(
      'skills', jsonb_build_object(
        'label', 'Compétences', 'weight', 45,
        'score', round(v_skill_score * 100, 2),
        'detail', 'Correspondance pondérée des compétences et niveaux déclarés.'
      ),
      'availability', jsonb_build_object(
        'label', 'Disponibilité', 'weight', 20,
        'score', round(v_availability_score * 100, 2),
        'detail', 'Recouvrement des disponibilités structurées avec le calendrier.'
      ),
      'mode', jsonb_build_object(
        'label', 'Mode et zone approximative', 'weight', 15,
        'score', round(v_mode_score * 100, 2),
        'detail', case
          when v_mission.work_mode = 'remote'
            then 'Compatibilité à distance, sans donnée ni facteur de distance.'
          when v_mission.work_mode = 'hybrid'
            then 'Compatibilité remote et zone approximative pour la présence.'
          else 'Compatibilité de zone approximative, sans adresse exacte.'
        end
      ),
      'budget', jsonb_build_object(
        'label', 'Budget informatif', 'weight', 10,
        'score', round(v_budget_score * 100, 2),
        'detail', 'Alignement indicatif de la proposition avec la fourchette publiée.'
      ),
      'reputation', jsonb_build_object(
        'label', 'Réputation vérifiable', 'weight', 10,
        'score', round(v_reputation_score * 100, 2),
        'detail', case when v_review_count = 0
          then 'Valeur neutre pour un nouveau profil sans avis.'
          else 'Moyenne des avis reliés à des missions terminées.'
        end
      )
    ),
    'factors', jsonb_build_array(
      jsonb_build_object('label', 'Compétences', 'value', round(v_skill_score * 100, 2)),
      jsonb_build_object('label', 'Disponibilité', 'value', round(v_availability_score * 100, 2)),
      jsonb_build_object(
        'label', case when v_mission.work_mode = 'remote' then 'Mode à distance' else 'Mode et zone' end,
        'value', round(v_mode_score * 100, 2)
      )
    ),
    'missingData', to_jsonb(v_missing),
    'evidence', jsonb_build_object(
      'reviewCount', v_review_count,
      'completedMissionCount', v_completed_count
    )
  );
end;
$$;

create function public.set_application_relevance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.relevance_details := private.calculate_application_relevance(
    new.mission_id,
    new.applicant_id,
    new.proposed_amount
  );
  new.relevance_score := (new.relevance_details ->> 'score')::numeric;
  new.score_version := new.relevance_details ->> 'version';
  return new;
end;
$$;

create trigger applications_00_set_relevance
before insert on public.applications
for each row execute function public.set_application_relevance();

drop policy applications_insert_own on public.applications;
revoke insert on public.applications from authenticated;

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
  v_can_work boolean;
  v_onboarding_completed boolean;
begin
  select ms.owner_id, ms.status, ms.application_deadline, ms.max_applications
  into v_owner_id, v_status, v_deadline, v_max_applications
  from public.missions ms
  where ms.id = new.mission_id
    and ms.deleted_at is null;

  if v_owner_id is null then
    return new;
  end if;

  perform private.lock_user_pair(v_owner_id, new.applicant_id);

  if v_owner_id = new.applicant_id then
    raise exception 'mission owners cannot apply to their own mission'
      using errcode = '23514';
  end if;

  if v_status not in ('published', 'selecting') then
    raise exception 'applications require a discoverable mission'
      using errcode = '23514';
  end if;

  if v_deadline is not null and v_deadline < current_date then
    raise exception 'the application deadline has passed' using errcode = '23514';
  end if;

  select p.can_work, p.onboarding_completed
  into v_can_work, v_onboarding_completed
  from public.profiles p
  where p.id = new.applicant_id
    and p.deleted_at is null;

  if not coalesce(v_can_work, false) or not coalesce(v_onboarding_completed, false) then
    raise exception 'a complete talent profile is required' using errcode = '42501';
  end if;

  if v_max_applications is not null then
    select count(*)::integer
    into v_active_count
    from public.applications a
    where a.mission_id = new.mission_id
      and a.deleted_at is null
      and a.status in ('submitted', 'viewed', 'shortlisted');
    if v_active_count >= v_max_applications then
      raise exception 'the mission application limit has been reached' using errcode = '23514';
    end if;
  end if;

  if private.users_are_blocked(v_owner_id, new.applicant_id) then
    raise exception 'a block prevents this application'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function public.submit_application(
  p_mission_id uuid,
  p_message text,
  p_availability_note text,
  p_confirmed boolean,
  p_proposed_amount numeric default null
)
returns table (
  application_id uuid,
  status public.application_status,
  lock_version integer,
  relevance_score numeric,
  relevance_details jsonb,
  score_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_application public.applications%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_confirmed is not true then
    raise exception 'explicit application confirmation is required'
      using errcode = '23514';
  end if;

  if char_length(btrim(coalesce(p_message, ''))) not between 20 and 3000
     or char_length(btrim(coalesce(p_availability_note, ''))) not between 3 and 1000
     or p_proposed_amount < 0 then
    raise exception 'invalid application content' using errcode = '22023';
  end if;

  insert into public.applications (
    mission_id, applicant_id, message, availability_note, proposed_amount,
    submission_confirmed_at
  )
  values (
    p_mission_id, v_actor_id, btrim(p_message), btrim(p_availability_note),
    p_proposed_amount, statement_timestamp()
  )
  returning * into v_application;

  application_id := v_application.id;
  status := v_application.status;
  lock_version := v_application.lock_version;
  relevance_score := v_application.relevance_score;
  relevance_details := v_application.relevance_details;
  score_version := v_application.score_version;
  return next;
end;
$$;

create function public.list_applications(
  p_scope text,
  p_query text default null,
  p_statuses public.application_status[] default null,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 12,
  p_mission_id uuid default null,
  p_application_id uuid default null
)
returns table (
  application_id uuid,
  mission_id uuid,
  mission_title text,
  mission_status public.mission_status,
  mission_work_mode public.work_mode,
  mission_public_city text,
  mission_public_region text,
  mission_country_code text,
  mission_starts_on date,
  mission_ends_on date,
  mission_budget_model public.budget_model,
  mission_budget_min numeric,
  mission_budget_max numeric,
  application_status public.application_status,
  message text,
  availability_note text,
  proposed_amount numeric,
  proposed_currency_code text,
  relevance_score numeric,
  relevance_details jsonb,
  score_version text,
  lock_version integer,
  created_at timestamptz,
  updated_at timestamptz,
  applicant_id uuid,
  applicant_display_name text,
  applicant_username text,
  applicant_headline text,
  applicant_bio text,
  applicant_avatar_path text,
  applicant_city text,
  applicant_country_code text,
  applicant_remote_available boolean,
  applicant_email_verified boolean,
  applicant_skills jsonb,
  applicant_reputation numeric,
  applicant_review_count bigint,
  applicant_completed_count bigint,
  applicant_experience_years numeric,
  owner_id uuid,
  owner_display_name text,
  owner_username text,
  owner_headline text,
  owner_avatar_path text,
  owner_email_verified boolean,
  conversation_id uuid,
  swipe_decision public.application_swipe_decision,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select auth.uid() as id
  ), filtered as (
    select
      a.*,
      ms.title as mission_title,
      ms.status as mission_status,
      ms.work_mode as mission_work_mode,
      ms.public_city as mission_public_city,
      ms.public_region as mission_public_region,
      ms.country_code as mission_country_code,
      ms.starts_on as mission_starts_on,
      ms.ends_on as mission_ends_on,
      ms.budget_model as mission_budget_model,
      ms.budget_min as mission_budget_min,
      ms.budget_max as mission_budget_max,
      ms.owner_id,
      applicant.display_name as applicant_display_name,
      applicant.username::text as applicant_username,
      applicant.headline as applicant_headline,
      applicant.bio as applicant_bio,
      applicant.avatar_path as applicant_avatar_path,
      case when applicant.show_approximate_location then applicant.city else null end as applicant_city,
      case when applicant.show_approximate_location then applicant.country_code else null end as applicant_country_code,
      applicant.remote_available as applicant_remote_available,
      applicant_user.email_confirmed_at is not null as applicant_email_verified,
      owner_profile.display_name as owner_display_name,
      owner_profile.username::text as owner_username,
      owner_profile.headline as owner_headline,
      owner_profile.avatar_path as owner_avatar_path,
      owner_user.email_confirmed_at is not null as owner_email_verified,
      coalesce(skills.items, '[]'::jsonb) as applicant_skills,
      reputation.average_rating as applicant_reputation,
      coalesce(reputation.review_count, 0)::bigint as applicant_review_count,
      coalesce(completed.completed_count, 0)::bigint as applicant_completed_count,
      coalesce(skills.experience_years, 0)::numeric as applicant_experience_years,
      conversation.id as conversation_id,
      app_swipe.decision as swipe_decision
    from public.applications a
    join public.missions ms on ms.id = a.mission_id
    join public.profiles applicant on applicant.id = a.applicant_id
    join auth.users applicant_user on applicant_user.id = applicant.id
    join public.profiles owner_profile on owner_profile.id = ms.owner_id
    join auth.users owner_user on owner_user.id = owner_profile.id
    cross join actor
    left join lateral (
      select
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'category', s.category,
            'level', ps.declared_level,
            'yearsExperience', ps.years_experience
          ) order by s.category, s.name
        ) as items,
        sum(coalesce(ps.years_experience, 0)) as experience_years
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
      where ps.profile_id = a.applicant_id
    ) skills on true
    left join lateral (
      select avg(r.rating)::numeric as average_rating, count(*)::bigint as review_count
      from public.reviews r
      where r.recipient_id = a.applicant_id
    ) reputation on true
    left join lateral (
      select count(*)::bigint as completed_count
      from public.matches mt
      where mt.talent_id = a.applicant_id and mt.status = 'completed'
    ) completed on true
    left join public.matches matched on matched.accepted_application_id = a.id
    left join public.conversations conversation on conversation.match_id = matched.id
    left join public.application_swipes app_swipe
      on app_swipe.application_id = a.id and app_swipe.owner_id = actor.id
    where actor.id is not null
      and a.deleted_at is null
      and (
        (p_scope = 'talent' and a.applicant_id = actor.id)
        or (p_scope = 'received' and ms.owner_id = actor.id)
      )
      and (p_application_id is null or a.id = p_application_id)
      and (p_mission_id is null or a.mission_id = p_mission_id)
      and (p_statuses is null or cardinality(p_statuses) = 0 or a.status = any(p_statuses))
      and (
        nullif(btrim(p_query), '') is null
        or ms.title ilike '%' || btrim(p_query) || '%'
        or a.message ilike '%' || btrim(p_query) || '%'
        or applicant.display_name ilike '%' || btrim(p_query) || '%'
        or applicant.username::text ilike '%' || btrim(p_query) || '%'
      )
  ), counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    c.id,
    c.mission_id,
    c.mission_title,
    c.mission_status,
    c.mission_work_mode,
    c.mission_public_city,
    c.mission_public_region,
    c.mission_country_code,
    c.mission_starts_on,
    c.mission_ends_on,
    c.mission_budget_model,
    c.mission_budget_min,
    c.mission_budget_max,
    c.status,
    c.message,
    c.availability_note,
    c.proposed_amount,
    c.proposed_currency_code,
    c.relevance_score,
    c.relevance_details,
    c.score_version,
    c.lock_version,
    c.created_at,
    c.updated_at,
    c.applicant_id,
    c.applicant_display_name,
    c.applicant_username,
    c.applicant_headline,
    c.applicant_bio,
    c.applicant_avatar_path,
    c.applicant_city,
    c.applicant_country_code,
    c.applicant_remote_available,
    c.applicant_email_verified,
    c.applicant_skills,
    c.applicant_reputation,
    c.applicant_review_count,
    c.applicant_completed_count,
    c.applicant_experience_years,
    c.owner_id,
    c.owner_display_name,
    c.owner_username,
    c.owner_headline,
    c.owner_avatar_path,
    c.owner_email_verified,
    c.conversation_id,
    c.swipe_decision,
    c.total_count
  from counted c
  order by
    case when p_sort = 'score_desc' then c.relevance_score end desc nulls last,
    case when p_sort = 'availability' then (c.relevance_details #>> '{components,availability,score}')::numeric end desc nulls last,
    case when p_sort = 'proposal_asc' then c.proposed_amount end asc nulls last,
    case when p_sort = 'proposal_desc' then c.proposed_amount end desc nulls last,
    case when p_sort = 'reputation' then c.applicant_reputation end desc nulls last,
    case when p_sort = 'experience' then c.applicant_experience_years end desc nulls last,
    c.created_at desc,
    c.id
  limit least(greatest(p_page_size, 1), 50)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 50);
$$;

create function public.record_mission_swipe(
  p_mission_id uuid,
  p_decision public.swipe_decision
)
returns table (swipe_id uuid, decision public.swipe_decision, decided_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_owner_id uuid;
  v_existing_swipe_id uuid;
  v_favorite_created_by_swipe boolean := false;
  v_favorite_existed boolean := false;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select ms.owner_id into v_owner_id
  from public.missions ms
  where ms.id = p_mission_id
    and ms.status in ('published', 'selecting')
    and ms.deleted_at is null;

  if not found then
    raise exception 'mission not found' using errcode = 'P0002';
  end if;
  if v_owner_id = v_actor_id then
    raise exception 'owners cannot swipe their own mission' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.can_work
      and p.onboarding_completed
      and p.deleted_at is null
  ) then
    raise exception 'a complete talent profile is required' using errcode = '42501';
  end if;

  perform private.lock_user_pair(v_actor_id, v_owner_id);

  if private.users_are_blocked(v_actor_id, v_owner_id) then
    raise exception 'a block prevents this swipe' using errcode = '42501';
  end if;

  select s.id, s.favorite_created_by_swipe
  into v_existing_swipe_id, v_favorite_created_by_swipe
  from public.swipes s
  where s.author_id = v_actor_id
    and s.target_mission_id = p_mission_id
  for update;

  select exists (
    select 1 from public.favorites f
    where f.profile_id = v_actor_id and f.mission_id = p_mission_id
  ) into v_favorite_existed;

  if p_decision = 'save' then
    v_favorite_created_by_swipe :=
      coalesce(v_favorite_created_by_swipe, false) or not v_favorite_existed;
    insert into public.favorites (profile_id, mission_id)
    values (v_actor_id, p_mission_id)
    on conflict do nothing;
  elsif coalesce(v_favorite_created_by_swipe, false) then
    delete from public.favorites f
    where f.profile_id = v_actor_id and f.mission_id = p_mission_id;
    v_favorite_created_by_swipe := false;
  else
    v_favorite_created_by_swipe := false;
  end if;

  if v_existing_swipe_id is null then
    insert into public.swipes (
      author_id, target_type, target_profile_id, target_mission_id, decision,
      favorite_created_by_swipe, created_at
    )
    values (
      v_actor_id, 'mission', null, p_mission_id, p_decision,
      v_favorite_created_by_swipe, statement_timestamp()
    )
    returning id, swipes.decision, created_at
    into swipe_id, decision, decided_at;
  else
    update public.swipes s
    set decision = p_decision,
        favorite_created_by_swipe = v_favorite_created_by_swipe,
        created_at = statement_timestamp()
    where s.id = v_existing_swipe_id
    returning s.id, s.decision, s.created_at
    into swipe_id, decision, decided_at;
  end if;

  return next;
end;
$$;

create function public.undo_last_mission_swipe()
returns table (mission_id uuid, decision public.swipe_decision)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_swipe public.swipes%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select s.* into v_swipe
  from public.swipes s
  where s.author_id = v_actor_id and s.target_type = 'mission'
  order by s.created_at desc, s.id desc
  limit 1
  for update;

  if not found then return; end if;

  delete from public.swipes s where s.id = v_swipe.id;
  if v_swipe.decision = 'save' and v_swipe.favorite_created_by_swipe then
    delete from public.favorites f
    where f.profile_id = v_actor_id and f.mission_id = v_swipe.target_mission_id;
  end if;
  mission_id := v_swipe.target_mission_id;
  decision := v_swipe.decision;
  return next;
end;
$$;

create function public.record_application_swipe(
  p_application_id uuid,
  p_expected_version integer,
  p_decision public.application_swipe_decision
)
returns table (
  application_swipe_id uuid,
  decision public.application_swipe_decision,
  application_status public.application_status,
  application_lock_version integer,
  undo_available boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_application public.applications%rowtype;
  v_owner_id uuid;
  v_compare_count integer;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select a.*
  into v_application
  from public.applications a
  join public.missions ms on ms.id = a.mission_id
  where a.id = p_application_id
  for update of a;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  select ms.owner_id
  into strict v_owner_id
  from public.missions ms
  where ms.id = v_application.mission_id;
  if v_owner_id <> v_actor_id then
    raise exception 'only the mission owner can review this application' using errcode = '42501';
  end if;
  if v_application.lock_version <> p_expected_version then
    raise exception 'stale application version' using errcode = '40001';
  end if;
  if v_application.status not in ('submitted', 'viewed', 'shortlisted') then
    raise exception 'this application can no longer be swiped' using errcode = '23514';
  end if;

  if p_decision = 'compare' then
    select count(*)::integer into v_compare_count
    from public.application_swipes aps
    join public.applications compared_application
      on compared_application.id = aps.application_id
    where aps.owner_id = v_actor_id
      and aps.decision = 'compare'
      and aps.application_id <> p_application_id
      and compared_application.mission_id = v_application.mission_id;
    if v_compare_count >= 3 then
      raise exception 'at most three applications can be compared' using errcode = '23514';
    end if;
  end if;

  if p_decision = 'shortlist' and v_application.status <> 'shortlisted' then
    if v_application.status = 'submitted' then
      update public.applications a set status = 'viewed' where a.id = p_application_id
      returning * into v_application;
    end if;
    update public.applications a set status = 'shortlisted' where a.id = p_application_id
    returning * into v_application;
  end if;

  insert into public.application_swipes (owner_id, application_id, decision)
  values (v_actor_id, p_application_id, p_decision)
  on conflict (owner_id, application_id)
  do update set decision = excluded.decision, updated_at = statement_timestamp()
  returning id, application_swipes.decision
  into application_swipe_id, decision;

  application_status := v_application.status;
  application_lock_version := v_application.lock_version;
  undo_available := p_decision in ('pass', 'compare');
  return next;
end;
$$;

create function public.undo_last_application_swipe()
returns table (application_id uuid, decision public.application_swipe_decision)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_swipe public.application_swipes%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select aps.* into v_swipe
  from public.application_swipes aps
  where aps.owner_id = v_actor_id
    and aps.decision in ('pass', 'compare')
  order by aps.updated_at desc, aps.id desc
  limit 1
  for update;

  if not found then return; end if;
  delete from public.application_swipes aps where aps.id = v_swipe.id;
  application_id := v_swipe.application_id;
  decision := v_swipe.decision;
  return next;
end;
$$;

revoke execute on function private.skill_level_value(public.skill_level) from public, anon, authenticated;
revoke execute on function private.calculate_application_relevance(uuid, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.set_application_relevance() from public, anon, authenticated;

revoke execute on function public.submit_application(uuid, text, text, boolean, numeric) from public, anon;
revoke execute on function public.list_applications(text, text, public.application_status[], text, integer, integer, uuid, uuid) from public, anon;
revoke execute on function public.record_mission_swipe(uuid, public.swipe_decision) from public, anon;
revoke execute on function public.undo_last_mission_swipe() from public, anon;
revoke execute on function public.record_application_swipe(uuid, integer, public.application_swipe_decision) from public, anon;
revoke execute on function public.undo_last_application_swipe() from public, anon;

grant execute on function public.submit_application(uuid, text, text, boolean, numeric) to authenticated;
grant execute on function public.list_applications(text, text, public.application_status[], text, integer, integer, uuid, uuid) to authenticated;
grant execute on function public.record_mission_swipe(uuid, public.swipe_decision) to authenticated;
grant execute on function public.undo_last_mission_swipe() to authenticated;
grant execute on function public.record_application_swipe(uuid, integer, public.application_swipe_decision) to authenticated;
grant execute on function public.undo_last_application_swipe() to authenticated;

comment on function private.calculate_application_relevance(uuid, uuid, numeric) is
  'Deterministic relevance-v1: skills 45%, availability 20%, work mode/approximate zone 15%, informational budget 10%, completed-mission reputation 10%. It never reads sensitive identity attributes or distance for remote missions.';
comment on function public.submit_application(uuid, text, text, boolean, numeric) is
  'Creates one explicitly confirmed application under auth.uid(); the proposal is informational only and the server persists relevance-v1.';
comment on function public.list_applications(text, text, public.application_status[], text, integer, integer, uuid, uuid) is
  'Returns a paginated, party-limited application projection with stored explainable relevance and authorized public profile fields.';
comment on table public.application_swipes is
  'Secondary client swipe decisions on applications actually received; pass never rejects and compare never changes application status.';
