-- Repair the single observed century-truncated deadline when its intended
-- 2000-based value is coherent with the mission start date and still open.
update public.missions
set application_deadline = (application_deadline + interval '2000 years')::date
where application_deadline < date '2000-01-01'
  and (application_deadline + interval '2000 years')::date <= starts_on
  and (application_deadline + interval '2000 years')::date >= current_date;

create or replace function public.validate_mission_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_skill_count integer;
  v_is_publication boolean := old.status <> 'published' and new.status = 'published';
  v_dates_changed boolean :=
    old.application_deadline is distinct from new.application_deadline
    or old.starts_on is distinct from new.starts_on
    or old.ends_on is distinct from new.ends_on;
begin
  if v_is_publication then
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

  if new.status in ('published', 'selecting')
    and (v_is_publication or v_dates_changed)
    and (
      new.application_deadline is null
      or new.starts_on is null
      or new.ends_on is null
      or new.application_deadline > new.starts_on
      or new.starts_on > new.ends_on
    ) then
    raise exception 'invalid mission dates' using errcode = '23514';
  end if;

  if new.status in ('published', 'selecting')
    and (v_is_publication or old.application_deadline is distinct from new.application_deadline)
    and new.application_deadline < current_date then
    raise exception 'application deadline must not be in the past'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists missions_validate_publication on public.missions;
create trigger missions_validate_publication
before update of status, application_deadline, starts_on, ends_on on public.missions
for each row execute function public.validate_mission_publication();

revoke execute on function public.validate_mission_publication()
from public, anon, authenticated;

comment on function public.validate_mission_publication() is
  'Requires coherent, non-expired publication dates and revalidates any date change while a mission is discoverable.';
