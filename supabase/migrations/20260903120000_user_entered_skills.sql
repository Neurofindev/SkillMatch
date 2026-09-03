-- Skills are entered by authenticated users. The normalized catalog remains an
-- internal matching primitive; it is no longer a predefined list in the UI.
alter table public.skills
  add column normalized_name text
  generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored;

create unique index skills_normalized_name_unique_idx
  on public.skills (normalized_name);

alter table public.skills
  add constraint skills_name_safe_text_check
  check (name !~ '[[:cntrl:]<>]');

create table private.skill_creation_events (
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create index skill_creation_events_user_recent_idx
  on private.skill_creation_events (user_id, created_at desc);

create or replace function public.find_or_create_skill(p_name text)
returns table (
  id bigint,
  name text,
  category text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_normalized text;
  v_slug_base text;
  v_skill_id bigint;
  v_is_active boolean;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception using
      errcode = '22023',
      message = 'skill name length invalid';
  end if;
  if v_name ~ '[[:cntrl:]<>]' then
    raise exception using
      errcode = '22023',
      message = 'skill name contains unsafe characters';
  end if;

  v_normalized := lower(v_name);
  select s.id, s.is_active
  into v_skill_id, v_is_active
  from public.skills s
  where s.normalized_name = v_normalized
  limit 1;

  if found then
    if not v_is_active then
      raise exception using
        errcode = '22023',
        message = 'skill unavailable';
    end if;
    return query
    select s.id, s.name, s.category
    from public.skills s
    where s.id = v_skill_id;
    return;
  end if;

  if (
    select count(*)
    from private.skill_creation_events e
    where e.user_id = auth.uid()
      and e.created_at >= now() - interval '24 hours'
  ) >= 30 then
    raise exception using
      errcode = '54000',
      message = 'skill creation rate exceeded';
  end if;

  v_slug_base := trim(both '-' from regexp_replace(
    translate(
      lower(v_name),
      'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  if v_slug_base = '' then
    v_slug_base := 'competence';
  end if;

  insert into public.skills (slug, name, category, is_active)
  values (
    left(v_slug_base, 60) || '-' || substr(md5(v_normalized), 1, 10),
    v_name,
    'Saisie utilisateur',
    true
  )
  on conflict (normalized_name) do nothing
  returning public.skills.id into v_skill_id;

  if v_skill_id is not null then
    insert into private.skill_creation_events (user_id)
    values (auth.uid());
  end if;

  return query
  select s.id, s.name, s.category
  from public.skills s
  where s.normalized_name = v_normalized
    and s.is_active
  limit 1;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'skill unavailable';
  end if;
end;
$$;

revoke all on function public.find_or_create_skill(text) from public, anon;
grant execute on function public.find_or_create_skill(text) to authenticated;

comment on function public.find_or_create_skill(text) is
  'Validates and resolves a user-entered skill to the normalized matching catalog.';

-- Remove the temporary production reference entries when they have not been
-- selected. Referenced entries remain valid historical user data.
delete from public.skills s
where s.slug in (
  'accessibilite-web',
  'developpement-react',
  'redaction-francaise',
  'support-evenementiel'
)
and not exists (
  select 1 from public.profile_skills ps where ps.skill_id = s.id
)
and not exists (
  select 1 from public.mission_skills ms where ms.skill_id = s.id
);
