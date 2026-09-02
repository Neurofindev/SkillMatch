-- SkillMatch phase 04: resumable onboarding, authoritative profile writes,
-- privacy-aware public profiles, and verified e-mail status.

alter table public.profiles
add column show_approximate_location boolean not null default true;

create table public.onboarding_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_step smallint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_drafts_step_check check (current_step between 1 and 9),
  constraint onboarding_drafts_payload_check check (
    jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 16384
  )
);

create trigger onboarding_drafts_set_updated_at
before update on public.onboarding_drafts
for each row execute function public.set_updated_at();

alter table public.onboarding_drafts enable row level security;

create policy onboarding_drafts_select_own
on public.onboarding_drafts
for select
to authenticated
using (user_id = auth.uid());

create policy onboarding_drafts_insert_own
on public.onboarding_drafts
for insert
to authenticated
with check (user_id = auth.uid());

create policy onboarding_drafts_update_own
on public.onboarding_drafts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy onboarding_drafts_delete_own
on public.onboarding_drafts
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.onboarding_drafts to authenticated;

-- Completion can only happen through save_profile, where cross-table
-- requirements (active skills and availability) are checked atomically.
revoke insert on public.profiles from authenticated;
revoke update (adult_confirmed, onboarding_completed) on public.profiles from authenticated;
grant update (show_approximate_location) on public.profiles to authenticated;

create function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_username is not null
    and btrim(p_username) ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$'
    and not exists (
      select 1
      from public.profiles p
      where p.username = lower(btrim(p_username))::extensions.citext
        and p.id is distinct from auth.uid()
    );
$$;

create function public.save_profile(
  p_profile_id uuid,
  p_display_name text,
  p_username text,
  p_headline text,
  p_bio text,
  p_capability text,
  p_work_preference text,
  p_city text,
  p_country_code text,
  p_skill_ids bigint[],
  p_skill_levels public.skill_level[],
  p_availability_start timestamptz,
  p_availability_end timestamptz,
  p_availability_timezone text,
  p_availability_visibility public.availability_visibility,
  p_avatar_path text,
  p_show_approximate_location boolean,
  p_complete_onboarding boolean,
  p_adult_confirmed boolean
)
returns table (
  profile_id uuid,
  onboarding_completed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_existing public.profiles%rowtype;
  v_can_work boolean;
  v_can_hire boolean;
  v_remote_available boolean;
  v_primary_mode public.account_mode;
  v_city text := nullif(btrim(p_city), '');
  v_country_code text := nullif(upper(btrim(p_country_code)), '');
  v_headline text := nullif(btrim(p_headline), '');
  v_avatar_path text := nullif(btrim(p_avatar_path), '');
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_profile_id is distinct from v_actor_id then
    raise exception 'profile ownership required' using errcode = '42501';
  end if;

  select * into v_existing
  from public.profiles p
  where p.id = v_actor_id
  for update;

  if not p_complete_onboarding
    and (v_existing.id is null or not v_existing.onboarding_completed) then
    raise exception 'completed profile required' using errcode = '23514';
  end if;

  if p_complete_onboarding and v_existing.onboarding_completed then
    raise exception 'onboarding already completed' using errcode = '23514';
  end if;

  if p_complete_onboarding and not p_adult_confirmed then
    raise exception 'adult confirmation required' using errcode = '23514';
  end if;

  if p_complete_onboarding and not exists (
    select 1
    from auth.users u
    where u.id = v_actor_id
      and u.email_confirmed_at is not null
  ) then
    raise exception 'email confirmation required' using errcode = '23514';
  end if;

  if p_display_name is null
    or char_length(btrim(p_display_name)) not between 2 and 80 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;

  if p_username is null
    or btrim(p_username) !~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$' then
    raise exception 'invalid username' using errcode = '22023';
  end if;

  if p_headline is not null
    and v_headline is not null
    and char_length(v_headline) not between 3 and 140 then
    raise exception 'invalid headline' using errcode = '22023';
  end if;

  if p_bio is null or char_length(btrim(p_bio)) not between 20 and 2000 then
    raise exception 'invalid bio' using errcode = '22023';
  end if;

  if p_capability not in ('find', 'publish', 'both') then
    raise exception 'invalid capability' using errcode = '22023';
  end if;

  if p_work_preference not in ('local', 'remote', 'both') then
    raise exception 'invalid work preference' using errcode = '22023';
  end if;

  if p_work_preference in ('local', 'both')
    and (v_city is null or v_country_code is null) then
    raise exception 'approximate location required' using errcode = '23514';
  end if;

  if v_city is not null and char_length(v_city) not between 2 and 100 then
    raise exception 'invalid city' using errcode = '22023';
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_skill_ids), 0) not between 1 and 12
    or cardinality(p_skill_ids) is distinct from cardinality(p_skill_levels) then
    raise exception 'invalid skills selection' using errcode = '22023';
  end if;

  if (select count(distinct selected.skill_id) from unnest(p_skill_ids) selected(skill_id))
    <> cardinality(p_skill_ids) then
    raise exception 'duplicate skill selection' using errcode = '22023';
  end if;

  if (select count(*) from public.skills s where s.id = any (p_skill_ids) and s.is_active)
    <> cardinality(p_skill_ids) then
    raise exception 'inactive or unknown skill' using errcode = '23503';
  end if;

  if p_availability_start is null
    or p_availability_end is null
    or p_availability_end <= p_availability_start
    or p_availability_end > p_availability_start + interval '1 year' then
    raise exception 'invalid availability' using errcode = '22023';
  end if;

  if p_availability_timezone is null
    or char_length(btrim(p_availability_timezone)) not between 1 and 64 then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  if v_avatar_path is not null
    and v_avatar_path <> v_actor_id::text || '/avatar.webp' then
    raise exception 'invalid avatar path' using errcode = '22023';
  end if;

  v_can_work := p_capability in ('find', 'both');
  v_can_hire := p_capability in ('publish', 'both');
  v_primary_mode := case
    when v_can_work then 'talent'::public.account_mode
    else 'client'::public.account_mode
  end;
  v_remote_available := p_work_preference in ('remote', 'both');

  insert into public.profiles (
    id, username, display_name, headline, bio, primary_mode, can_work,
    can_hire, avatar_path, city, country_code, remote_available,
    adult_confirmed, onboarding_completed, show_approximate_location
  )
  values (
    v_actor_id,
    lower(btrim(p_username)),
    btrim(p_display_name),
    v_headline,
    btrim(p_bio),
    v_primary_mode,
    v_can_work,
    v_can_hire,
    v_avatar_path,
    v_city,
    v_country_code,
    v_remote_available,
    case when p_complete_onboarding then p_adult_confirmed else v_existing.adult_confirmed end,
    case when p_complete_onboarding then true else v_existing.onboarding_completed end,
    p_show_approximate_location
  )
  on conflict (id) do update
  set username = excluded.username,
      display_name = excluded.display_name,
      headline = excluded.headline,
      bio = excluded.bio,
      primary_mode = excluded.primary_mode,
      can_work = excluded.can_work,
      can_hire = excluded.can_hire,
      avatar_path = excluded.avatar_path,
      city = excluded.city,
      country_code = excluded.country_code,
      remote_available = excluded.remote_available,
      adult_confirmed = excluded.adult_confirmed,
      onboarding_completed = excluded.onboarding_completed,
      show_approximate_location = excluded.show_approximate_location,
      deleted_at = null;

  delete from public.profile_skills ps where ps.profile_id = v_actor_id;
  insert into public.profile_skills (profile_id, skill_id, declared_level)
  select v_actor_id, selected.skill_id, selected.declared_level
  from unnest(p_skill_ids, p_skill_levels) selected(skill_id, declared_level);

  delete from public.availability_slots av where av.profile_id = v_actor_id;
  insert into public.availability_slots (
    profile_id, kind, starts_at, ends_at, timezone, visibility
  )
  values (
    v_actor_id, 'one_time', p_availability_start, p_availability_end,
    btrim(p_availability_timezone), p_availability_visibility
  );

  if p_complete_onboarding then
    delete from public.onboarding_drafts od where od.user_id = v_actor_id;
  end if;

  return query select v_actor_id, true;
exception
  when unique_violation then
    raise exception 'username unavailable' using errcode = '23505';
end;
$$;

drop function public.get_public_profiles(uuid);

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
    and (p_profile_id is null or p.id = p_profile_id)
  order by p.display_name, p.id;
$$;

revoke execute on function public.is_username_available(text) from public, anon;
revoke execute on function public.save_profile(
  uuid, text, text, text, text, text, text, text, text, bigint[],
  public.skill_level[], timestamptz, timestamptz, text,
  public.availability_visibility, text, boolean, boolean, boolean
) from public, anon;
revoke execute on function public.get_public_profiles(uuid) from public;

grant execute on function public.is_username_available(text) to authenticated;
grant execute on function public.save_profile(
  uuid, text, text, text, text, text, text, text, text, bigint[],
  public.skill_level[], timestamptz, timestamptz, text,
  public.availability_visibility, text, boolean, boolean, boolean
) to authenticated;
grant execute on function public.get_public_profiles(uuid) to anon, authenticated;

comment on table public.onboarding_drafts is
  'Private, size-bounded resumable onboarding state owned by one Auth user.';
comment on function public.is_username_available(text) is
  'Checks username availability without exposing private or incomplete profiles.';
comment on function public.save_profile(
  uuid, text, text, text, text, text, text, text, text, bigint[],
  public.skill_level[], timestamptz, timestamptz, text,
  public.availability_visibility, text, boolean, boolean, boolean
) is
  'Atomically completes onboarding or updates the caller profile, skills and availability.';
comment on function public.get_public_profiles(uuid) is
  'Allow-listed public profile projection with privacy-aware location and Auth-backed e-mail verification.';
