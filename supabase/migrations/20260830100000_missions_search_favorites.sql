-- SkillMatch phase 05: resumable mission wizard, controlled publication,
-- private mission attachments, indexed discovery and persistent favorites.

alter table public.missions
  add column application_deadline date,
  add column presence_details text,
  add column deliverables jsonb not null default '[]'::jsonb,
  add column archived_at timestamptz;

update public.missions
set presence_details = 'Présence ponctuelle à convenir entre les participants.'
where work_mode = 'hybrid';

alter table public.missions
  add constraint missions_application_deadline_check
    check (
      application_deadline is null
      or starts_on is null
      or application_deadline <= starts_on
    ),
  add constraint missions_presence_details_check
    check (
      (work_mode <> 'hybrid' and presence_details is null)
      or (
        work_mode = 'hybrid'
        and char_length(btrim(presence_details)) between 5 and 1000
      )
    ),
  add constraint missions_deliverables_check
    check (
      jsonb_typeof(deliverables) = 'array'
      and pg_column_size(deliverables) <= 8192
    ),
  add constraint missions_archived_at_check
    check (archived_at is null or archived_at >= created_at);

create table public.mission_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  current_step smallint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint mission_drafts_step_check check (current_step between 1 and 9),
  constraint mission_drafts_payload_check check (
    jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 65536
  )
);

create table public.mission_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  draft_id uuid,
  mission_id uuid,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  constraint mission_attachments_draft_owner_fk
    foreign key (draft_id, owner_id)
    references public.mission_drafts (id, owner_id)
    on delete cascade,
  constraint mission_attachments_mission_owner_fk
    foreign key (mission_id, owner_id)
    references public.missions (id, owner_id)
    on delete cascade,
  constraint mission_attachments_single_parent_check check (
    (draft_id is not null and mission_id is null)
    or (draft_id is null and mission_id is not null)
  ),
  constraint mission_attachments_path_check check (
    char_length(storage_path) between 40 and 500
    and storage_path !~ '(^/|\.\.)'
    and split_part(storage_path, '/', 1) = owner_id::text
  ),
  constraint mission_attachments_name_check check (
    char_length(btrim(file_name)) between 1 and 180
    and file_name !~ '[/\\]'
  ),
  constraint mission_attachments_mime_check check (
    mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'
    )
  ),
  constraint mission_attachments_size_check check (
    size_bytes between 1 and 5242880
  )
);

create trigger mission_drafts_set_updated_at
before update on public.mission_drafts
for each row execute function public.set_updated_at();

create function public.validate_mission_attachment_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.draft_id is not null then
    perform 1
    from public.mission_drafts md
    where md.id = new.draft_id and md.owner_id = new.owner_id
    for update;

    select count(*) into v_count
    from public.mission_attachments ma
    where ma.draft_id = new.draft_id
      and ma.id <> new.id;
  else
    perform 1
    from public.missions ms
    where ms.id = new.mission_id and ms.owner_id = new.owner_id
    for update;

    select count(*) into v_count
    from public.mission_attachments ma
    where ma.mission_id = new.mission_id
      and ma.id <> new.id;
  end if;

  if v_count >= 3 then
    raise exception 'a mission accepts at most three attachments'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger mission_attachments_validate_limit
before insert or update of draft_id, mission_id on public.mission_attachments
for each row execute function public.validate_mission_attachment_limit();

create function private.is_mission_content_allowed(p_content text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_content, '') !~* (
    '(arme|explosif|drogue|stupéfiant|violence|piratage|rançongiciel|'
    || 'diagnostic médical|prescription médicale|ordonnance|'
    || 'conseil en investissement|crédit réglementé|blanchiment|'
    || 'mot de passe|numéro de carte|données bancaires|pièce d.identité)'
  );
$$;

create function public.validate_mission_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_mission_content_allowed(
    new.title || ' ' || new.description || ' ' || coalesce(new.presence_details, '')
  ) then
    raise exception 'mission content is not allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger missions_validate_content
before insert or update of title, description, presence_details on public.missions
for each row execute function public.validate_mission_content();

create function public.validate_mission_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_skill_count integer;
begin
  if old.status <> 'published' and new.status = 'published' then
    select count(*) into v_skill_count
    from public.mission_skills ms
    where ms.mission_id = new.id;

    if v_skill_count < 1 or v_skill_count > 12 then
      raise exception 'publication requires between one and twelve skills'
        using errcode = '23514';
    end if;

    if new.budget_min is null or new.budget_max is null
      or new.starts_on is null or new.ends_on is null
      or new.application_deadline is null
      or jsonb_array_length(new.deliverables) not between 1 and 10
      or exists (
        select 1
        from jsonb_array_elements(new.deliverables) item
        where jsonb_typeof(item) <> 'string'
          or char_length(btrim(item #>> '{}')) not between 3 and 300
      ) then
      raise exception 'publication requires budget, dates, deadline and deliverables'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger missions_validate_publication
before update of status on public.missions
for each row execute function public.validate_mission_publication();

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
        (p_user_id is not null and ms.owner_id = p_user_id)
        or (p_user_id is not null and ms.assigned_talent_id = p_user_id)
        or private.is_moderator(p_user_id)
        or private.is_mission_participant(ms.id, p_user_id)
        or (
          ms.archived_at is null
          and ms.status in ('published', 'selecting')
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
    and exists (
      select 1
      from public.missions ms
      where ms.id = p_mission_id
        and ms.owner_id = p_user_id
        and ms.status in ('draft', 'published', 'selecting')
        and ms.deleted_at is null
        and ms.archived_at is null
    );
$$;

drop policy missions_insert_own_draft on public.missions;
create policy missions_insert_own_draft
on public.missions
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and status = 'draft'
  and assigned_talent_id is null
  and deleted_at is null
  and archived_at is null
  and lock_version = 1
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.can_hire
      and p.onboarding_completed
      and p.deleted_at is null
  )
);

drop policy favorites_insert_own on public.favorites;
create policy favorites_insert_own
on public.favorites
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and private.can_view_mission(mission_id)
  and not exists (
    select 1 from public.missions ms
    where ms.id = mission_id and ms.owner_id = auth.uid()
  )
);

alter table public.mission_drafts enable row level security;
alter table public.mission_attachments enable row level security;

create policy mission_drafts_select_own
on public.mission_drafts for select to authenticated
using (owner_id = auth.uid());

create policy mission_drafts_insert_own
on public.mission_drafts for insert to authenticated
with check (owner_id = auth.uid());

create policy mission_drafts_update_own
on public.mission_drafts for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy mission_drafts_delete_own
on public.mission_drafts for delete to authenticated
using (owner_id = auth.uid());

create policy mission_attachments_select_own
on public.mission_attachments for select to authenticated
using (owner_id = auth.uid());

create policy mission_attachments_insert_own
on public.mission_attachments for insert to authenticated
with check (owner_id = auth.uid());

create policy mission_attachments_delete_own
on public.mission_attachments for delete to authenticated
using (owner_id = auth.uid());

grant select, insert, update, delete on public.mission_drafts to authenticated;
grant select, insert, delete on public.mission_attachments to authenticated;

create index mission_drafts_owner_updated_idx
  on public.mission_drafts (owner_id, updated_at desc);
create index mission_attachments_draft_idx
  on public.mission_attachments (draft_id, created_at)
  where draft_id is not null;
create index mission_attachments_mission_idx
  on public.mission_attachments (mission_id, created_at)
  where mission_id is not null;
create index missions_discovery_category_idx
  on public.missions (category, status, created_at desc)
  where deleted_at is null and archived_at is null;
create index missions_discovery_budget_idx
  on public.missions (status, budget_min, budget_max)
  where deleted_at is null and archived_at is null;
create index missions_discovery_city_idx
  on public.missions (lower(public_city), status, created_at desc)
  where deleted_at is null and archived_at is null and work_mode <> 'remote';
create index missions_search_document_idx
  on public.missions using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')
    )
  )
  where deleted_at is null and archived_at is null;

create function public.save_mission(
  p_mission_id uuid,
  p_expected_version integer,
  p_wizard_draft_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_work_mode public.work_mode,
  p_public_city text,
  p_public_region text,
  p_country_code text,
  p_presence_details text,
  p_budget_model public.budget_model,
  p_budget_min numeric,
  p_budget_max numeric,
  p_application_deadline date,
  p_starts_on date,
  p_ends_on date,
  p_flexible_schedule boolean,
  p_required_level public.skill_level,
  p_deliverables jsonb,
  p_skill_ids bigint[],
  p_skill_levels public.skill_level[],
  p_publish boolean
)
returns table (
  mission_id uuid,
  status public.mission_status,
  lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_skill_count integer;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id
      and p.can_hire
      and p.onboarding_completed
      and p.adult_confirmed
      and p.deleted_at is null
  ) then
    raise exception 'publishing capability is required' using errcode = '42501';
  end if;

  if not private.is_mission_content_allowed(
    p_title || ' ' || p_description || ' ' || coalesce(p_presence_details, '')
  ) then
    raise exception 'mission content is not allowed' using errcode = '23514';
  end if;

  if char_length(btrim(p_title)) not between 5 and 140
    or char_length(btrim(p_description)) not between 30 and 10000
    or char_length(btrim(p_category)) not between 2 and 80 then
    raise exception 'invalid mission text lengths' using errcode = '22023';
  end if;

  if p_work_mode in ('local', 'hybrid')
    and nullif(btrim(coalesce(p_public_city, '')), '') is null
    and nullif(btrim(coalesce(p_public_region, '')), '') is null then
    raise exception 'local and hybrid missions require an approximate area'
      using errcode = '22023';
  end if;

  if p_work_mode = 'remote' and (
    p_public_city is not null or p_public_region is not null
    or p_country_code is not null or p_presence_details is not null
  ) then
    raise exception 'remote missions do not store a geographic area'
      using errcode = '22023';
  end if;

  if p_work_mode = 'hybrid'
    and char_length(btrim(coalesce(p_presence_details, ''))) not between 5 and 1000 then
    raise exception 'hybrid missions require presence details' using errcode = '22023';
  end if;

  if p_budget_min is null or p_budget_max is null
    or p_budget_min < 0 or p_budget_max < p_budget_min then
    raise exception 'invalid informational budget range' using errcode = '22023';
  end if;

  if p_application_deadline is null or p_starts_on is null or p_ends_on is null
    or p_application_deadline > p_starts_on or p_starts_on > p_ends_on then
    raise exception 'invalid mission dates' using errcode = '22023';
  end if;

  if jsonb_typeof(p_deliverables) <> 'array'
    or jsonb_array_length(p_deliverables) not between 1 and 10
    or pg_column_size(p_deliverables) > 8192
    or exists (
      select 1
      from jsonb_array_elements(p_deliverables) item
      where jsonb_typeof(item) <> 'string'
        or char_length(btrim(item #>> '{}')) not between 3 and 300
    ) then
    raise exception 'invalid mission deliverables' using errcode = '22023';
  end if;

  v_skill_count := coalesce(cardinality(p_skill_ids), 0);
  if v_skill_count not between 1 and 12
    or cardinality(p_skill_levels) <> v_skill_count
    or (select count(distinct skill_id) from unnest(p_skill_ids) skill_id) <> v_skill_count
    or (
      select count(*) from public.skills s
      where s.id = any(p_skill_ids) and s.is_active
    ) <> v_skill_count then
    raise exception 'invalid mission skills' using errcode = '22023';
  end if;

  if p_wizard_draft_id is not null and not exists (
    select 1 from public.mission_drafts md
    where md.id = p_wizard_draft_id and md.owner_id = v_actor_id
  ) then
    raise exception 'mission draft not found' using errcode = 'P0002';
  end if;

  if p_mission_id is null then
    insert into public.missions (
      owner_id, title, description, category, work_mode, public_city,
      public_region, country_code, presence_details, budget_model,
      budget_min, budget_max, application_deadline, starts_on, ends_on,
      flexible_schedule, required_level, deliverables, status
    )
    values (
      v_actor_id, btrim(p_title), btrim(p_description), btrim(p_category),
      p_work_mode,
      case when p_work_mode = 'remote' then null else nullif(btrim(p_public_city), '') end,
      case when p_work_mode = 'remote' then null else nullif(btrim(p_public_region), '') end,
      case when p_work_mode = 'remote' then null else nullif(upper(btrim(p_country_code)), '') end,
      case when p_work_mode = 'hybrid' then btrim(p_presence_details) else null end,
      p_budget_model, p_budget_min, p_budget_max, p_application_deadline,
      p_starts_on, p_ends_on, p_flexible_schedule, p_required_level,
      p_deliverables, 'draft'
    )
    returning * into v_mission;

    insert into public.mission_events (
      mission_id, actor_id, event_type, new_values
    ) values (
      v_mission.id, v_actor_id, 'mission_created',
      jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version)
    );
  else
    select * into v_mission
    from public.missions ms
    where ms.id = p_mission_id
    for update;

    if not found or v_mission.owner_id <> v_actor_id then
      raise exception 'mission update is not authorized' using errcode = '42501';
    end if;
    if v_mission.status not in ('draft', 'published', 'selecting')
      or v_mission.deleted_at is not null or v_mission.archived_at is not null then
      raise exception 'mission is not editable in its current state' using errcode = '23514';
    end if;
    if p_expected_version is null or v_mission.lock_version <> p_expected_version then
      raise exception 'stale mission version' using errcode = '40001';
    end if;

    update public.missions ms set
      title = btrim(p_title),
      description = btrim(p_description),
      category = btrim(p_category),
      work_mode = p_work_mode,
      public_city = case when p_work_mode = 'remote' then null else nullif(btrim(p_public_city), '') end,
      public_region = case when p_work_mode = 'remote' then null else nullif(btrim(p_public_region), '') end,
      country_code = case when p_work_mode = 'remote' then null else nullif(upper(btrim(p_country_code)), '') end,
      presence_details = case when p_work_mode = 'hybrid' then btrim(p_presence_details) else null end,
      budget_model = p_budget_model,
      budget_min = p_budget_min,
      budget_max = p_budget_max,
      application_deadline = p_application_deadline,
      starts_on = p_starts_on,
      ends_on = p_ends_on,
      flexible_schedule = p_flexible_schedule,
      required_level = p_required_level,
      deliverables = p_deliverables
    where ms.id = v_mission.id
    returning * into v_mission;
  end if;

  delete from public.mission_skills ms where ms.mission_id = v_mission.id;
  insert into public.mission_skills (
    mission_id, skill_id, required_level, importance
  )
  select v_mission.id, skill.skill_id, skill.required_level, 3
  from unnest(p_skill_ids, p_skill_levels) as skill(skill_id, required_level);

  if p_publish and v_mission.status = 'draft' then
    update public.missions ms
    set status = 'published'
    where ms.id = v_mission.id
    returning * into v_mission;

    insert into public.mission_events (
      mission_id, actor_id, event_type, old_values, new_values
    ) values (
      v_mission.id, v_actor_id, 'mission_published',
      jsonb_build_object('status', 'draft'),
      jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version)
    );
  end if;

  if p_wizard_draft_id is not null then
    update public.mission_attachments ma
    set draft_id = null, mission_id = v_mission.id
    where ma.draft_id = p_wizard_draft_id
      and ma.owner_id = v_actor_id;

    delete from public.mission_drafts md
    where md.id = p_wizard_draft_id and md.owner_id = v_actor_id;
  end if;

  mission_id := v_mission.id;
  status := v_mission.status;
  lock_version := v_mission.lock_version;
  return next;
end;
$$;

create function public.archive_mission(
  p_mission_id uuid,
  p_expected_version integer
)
returns table (
  mission_id uuid,
  archived_at timestamptz,
  lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_mission from public.missions ms
  where ms.id = p_mission_id for update;

  if not found or v_mission.owner_id <> v_actor_id then
    raise exception 'mission archive is not authorized' using errcode = '42501';
  end if;
  if v_mission.lock_version <> p_expected_version then
    raise exception 'stale mission version' using errcode = '40001';
  end if;
  if v_mission.status not in ('draft', 'cancelled', 'completed') then
    raise exception 'cancel an active mission before archiving it' using errcode = '23514';
  end if;

  update public.missions ms
  set archived_at = statement_timestamp()
  where ms.id = v_mission.id
  returning ms.id, ms.archived_at, ms.lock_version
  into mission_id, archived_at, lock_version;
  return next;
end;
$$;

create function public.search_missions(
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
        (
          ms.archived_at is null
          and ms.status in ('published', 'selecting')
          and (p_mission_id is not null or ms.owner_id <> v_actor_id)
        )
        or (
          p_mission_id is not null
          and ms.owner_id = v_actor_id
        )
      )
      and (p_mission_id is null or ms.id = p_mission_id)
      and not private.users_are_blocked(ms.owner_id, v_actor_id)
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
  join public.profiles p on p.id = c.owner_id and p.deleted_at is null
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

revoke execute on function public.validate_mission_attachment_limit() from public, anon, authenticated;
revoke execute on function public.validate_mission_content() from public, anon, authenticated;
revoke execute on function public.validate_mission_publication() from public, anon, authenticated;
revoke execute on function private.is_mission_content_allowed(text) from public, anon, authenticated;

revoke execute on function public.save_mission(
  uuid, integer, uuid, text, text, text, public.work_mode, text, text, text,
  text, public.budget_model, numeric, numeric, date, date, date, boolean,
  public.skill_level, jsonb, bigint[], public.skill_level[], boolean
) from public, anon;
grant execute on function public.save_mission(
  uuid, integer, uuid, text, text, text, public.work_mode, text, text, text,
  text, public.budget_model, numeric, numeric, date, date, date, boolean,
  public.skill_level, jsonb, bigint[], public.skill_level[], boolean
) to authenticated;

revoke execute on function public.archive_mission(uuid, integer) from public, anon;
grant execute on function public.archive_mission(uuid, integer) to authenticated;

revoke execute on function public.search_missions(
  text, text, public.work_mode[], text, bigint[], public.skill_level[], numeric,
  numeric, date, date, text, integer, integer, boolean, uuid
) from public, anon;
grant execute on function public.search_missions(
  text, text, public.work_mode[], text, bigint[], public.skill_level[], numeric,
  numeric, date, date, text, integer, integer, boolean, uuid
) to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'mission-attachments',
  'mission-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy mission_attachments_storage_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'mission-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy mission_attachments_storage_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mission-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy mission_attachments_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'mission-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on table public.mission_drafts is
  'Private resumable wizard state; it is not a discoverable mission.';
comment on table public.mission_attachments is
  'Owner-private metadata for at most three bounded mission briefing files.';
comment on function public.save_mission(
  uuid, integer, uuid, text, text, text, public.work_mode, text, text, text,
  text, public.budget_model, numeric, numeric, date, date, date, boolean,
  public.skill_level, jsonb, bigint[], public.skill_level[], boolean
) is
  'Creates or edits one owner mission, replaces skills atomically, moves draft attachments and optionally publishes under server validation.';
comment on function public.search_missions(
  text, text, public.work_mode[], text, bigint[], public.skill_level[], numeric,
  numeric, date, date, text, integer, integer, boolean, uuid
) is
  'Paginated allow-listed mission discovery with aggregated skills/profile, persistent favorites and no distance input or contribution for remote work.';
