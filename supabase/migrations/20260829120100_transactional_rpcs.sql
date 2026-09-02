-- SkillMatch phase 03: authoritative transitions, atomic acceptance, bilateral
-- agreement confirmation, and block-aware interaction guards.

create function private.lock_user_pair(p_first_user_id uuid, p_second_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(p_first_user_id::text, p_second_user_id::text)
      || ':' || greatest(p_first_user_id::text, p_second_user_id::text),
      0
    )
  );
$$;

create function public.protect_sensitive_workflow_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_table_name = 'missions'
     and (
       old.status is distinct from new.status
       or old.assigned_talent_id is distinct from new.assigned_talent_id
     ) then
    raise exception 'mission status and assignment require a controlled RPC'
      using errcode = '42501';
  elsif tg_table_name = 'applications'
     and (
       old.status is distinct from new.status
       or old.relevance_score is distinct from new.relevance_score
       or old.relevance_details is distinct from new.relevance_details
       or old.score_version is distinct from new.score_version
     ) then
    raise exception 'application workflow fields require a controlled RPC'
      using errcode = '42501';
  elsif tg_table_name = 'agreements'
     and (
       old.status is distinct from new.status
       or old.client_confirmed_at is distinct from new.client_confirmed_at
       or old.talent_confirmed_at is distinct from new.talent_confirmed_at
     ) then
    raise exception 'agreement confirmation requires a controlled RPC'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function public.validate_application_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_status public.mission_status;
begin
  select ms.owner_id, ms.status
  into v_owner_id, v_status
  from public.missions ms
  where ms.id = new.mission_id
    and ms.deleted_at is null;

  if v_owner_id is null then
    return new;
  end if;

  perform private.lock_user_pair(v_owner_id, new.applicant_id);

  if v_status not in ('published', 'selecting') then
    raise exception 'applications require a discoverable mission'
      using errcode = '23514';
  end if;

  if private.users_are_blocked(v_owner_id, new.applicant_id) then
    raise exception 'a block prevents this application'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function public.validate_match_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_user_pair(new.client_id, new.talent_id);

  if private.users_are_blocked(new.client_id, new.talent_id) then
    raise exception 'a block prevents this match'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function public.validate_message_interaction()
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
    raise exception 'message authors must be conversation participants'
      using errcode = '23514';
  end if;

  if v_match_status <> 'active' then
    raise exception 'new messages require an active match'
      using errcode = '23514';
  end if;

  v_other_user_id := case
    when new.author_id = v_client_id then v_talent_id
    else v_client_id
  end;

  perform private.lock_user_pair(new.author_id, v_other_user_id);

  if private.users_are_blocked(new.author_id, v_other_user_id) then
    raise exception 'a block prevents new messages'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function public.serialize_block_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_user_pair(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

create trigger missions_protect_workflow_columns
before update on public.missions
for each row execute function public.protect_sensitive_workflow_columns();

create trigger applications_protect_workflow_columns
before update on public.applications
for each row execute function public.protect_sensitive_workflow_columns();

create trigger agreements_protect_workflow_columns
before update on public.agreements
for each row execute function public.protect_sensitive_workflow_columns();

create trigger applications_validate_new_interaction
before insert on public.applications
for each row execute function public.validate_application_interaction();

create trigger matches_validate_new_interaction
before insert on public.matches
for each row execute function public.validate_match_interaction();

create trigger messages_validate_new_interaction
before insert on public.messages
for each row execute function public.validate_message_interaction();

create trigger blocks_serialize_creation
before insert on public.blocks
for each row execute function public.serialize_block_creation();

create function public.accept_application(
  p_application_id uuid,
  p_expected_mission_version integer,
  p_expected_application_version integer
)
returns table (
  match_id uuid,
  conversation_id uuid,
  mission_status public.mission_status,
  mission_lock_version integer,
  application_status public.application_status,
  application_lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_application public.applications%rowtype;
  v_mission public.missions%rowtype;
  v_match_id uuid;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_expected_mission_version < 1 or p_expected_application_version < 1 then
    raise exception 'expected versions must be positive' using errcode = '22023';
  end if;

  select ms.*
  into v_mission
  from public.missions ms
  join public.applications a on a.mission_id = ms.id
  where a.id = p_application_id
  for update of ms;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if v_mission.owner_id <> v_actor_id then
    raise exception 'only the mission owner can accept an application'
      using errcode = '42501';
  end if;

  select a.*
  into v_application
  from public.applications a
  where a.id = p_application_id
    and a.mission_id = v_mission.id
  for update;

  select mt.id, c.id
  into v_match_id, v_conversation_id
  from public.matches mt
  left join public.conversations c on c.match_id = mt.id
  where mt.mission_id = v_mission.id
    and mt.accepted_application_id = v_application.id;

  if v_match_id is not null
     and v_application.status = 'accepted'
     and v_mission.assigned_talent_id = v_application.applicant_id then
    match_id := v_match_id;
    conversation_id := v_conversation_id;
    mission_status := v_mission.status;
    mission_lock_version := v_mission.lock_version;
    application_status := v_application.status;
    application_lock_version := v_application.lock_version;
    return next;
    return;
  end if;

  if v_mission.lock_version <> p_expected_mission_version then
    raise exception 'stale mission version' using errcode = '40001';
  end if;

  if v_application.lock_version <> p_expected_application_version then
    raise exception 'stale application version' using errcode = '40001';
  end if;

  if v_mission.status <> 'selecting' or v_mission.assigned_talent_id is not null then
    raise exception 'mission is not ready for acceptance' using errcode = '23514';
  end if;

  if v_application.status <> 'shortlisted' or v_application.deleted_at is not null then
    raise exception 'application is not ready for acceptance' using errcode = '23514';
  end if;

  perform private.lock_user_pair(v_mission.owner_id, v_application.applicant_id);

  if private.users_are_blocked(v_mission.owner_id, v_application.applicant_id) then
    raise exception 'a block prevents this acceptance' using errcode = '42501';
  end if;

  update public.applications a
  set status = 'accepted'
  where a.id = v_application.id
  returning a.status, a.lock_version
  into application_status, application_lock_version;

  with rejected as (
    update public.applications a
    set status = 'rejected'
    where a.mission_id = v_mission.id
      and a.id <> v_application.id
      and a.deleted_at is null
      and a.status in ('submitted', 'viewed', 'shortlisted')
    returning a.applicant_id
  )
  insert into public.notifications (recipient_id, type, title, body, internal_path)
  select
    rejected.applicant_id,
    'application_status_changed',
    'Candidature clôturée',
    'Une autre candidature a été retenue pour cette mission.',
    '/applications'
  from rejected;

  update public.missions ms
  set status = 'assigned',
      assigned_talent_id = v_application.applicant_id
  where ms.id = v_mission.id
  returning ms.status, ms.lock_version
  into mission_status, mission_lock_version;

  insert into public.matches (
    mission_id,
    accepted_application_id,
    client_id,
    talent_id
  )
  values (
    v_mission.id,
    v_application.id,
    v_mission.owner_id,
    v_application.applicant_id
  )
  returning id into v_match_id;

  insert into public.conversations (match_id, mission_id)
  values (v_match_id, v_mission.id)
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, profile_id)
  values
    (v_conversation_id, v_mission.owner_id),
    (v_conversation_id, v_application.applicant_id);

  insert into public.mission_events (
    mission_id,
    actor_id,
    event_type,
    old_values,
    new_values,
    metadata
  )
  values (
    v_mission.id,
    v_actor_id,
    'talent_assigned',
    jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
    jsonb_build_object('status', mission_status, 'lock_version', mission_lock_version),
    jsonb_build_object('application_id', v_application.id, 'match_id', v_match_id)
  );

  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_application.applicant_id,
    'match_created',
    'Candidature acceptée',
    'Votre candidature a été acceptée et une conversation est disponible.',
    '/matches/' || v_match_id::text
  );

  match_id := v_match_id;
  conversation_id := v_conversation_id;
  return next;
end;
$$;

create function public.transition_application(
  p_application_id uuid,
  p_expected_version integer,
  p_new_status public.application_status
)
returns table (
  application_id uuid,
  status public.application_status,
  lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_application public.applications%rowtype;
  v_owner_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select a.*
  into v_application
  from public.applications a
  where a.id = p_application_id
  for update of a;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  select ms.owner_id
  into strict v_owner_id
  from public.missions ms
  where ms.id = v_application.mission_id;

  if v_application.status = p_new_status then
    application_id := v_application.id;
    status := v_application.status;
    lock_version := v_application.lock_version;
    return next;
    return;
  end if;

  if v_application.lock_version <> p_expected_version then
    raise exception 'stale application version' using errcode = '40001';
  end if;

  if p_new_status = 'accepted' then
    raise exception 'acceptance requires accept_application' using errcode = '42501';
  end if;

  if v_actor_id = v_application.applicant_id then
    if p_new_status <> 'withdrawn' then
      raise exception 'applicants may only withdraw their application'
        using errcode = '42501';
    end if;
  elsif v_actor_id = v_owner_id then
    if p_new_status not in ('viewed', 'shortlisted', 'rejected') then
      raise exception 'mission owners cannot perform this application transition'
        using errcode = '42501';
    end if;
  else
    raise exception 'application transition is not authorized'
      using errcode = '42501';
  end if;

  update public.applications a
  set status = p_new_status
  where a.id = v_application.id
  returning a.id, a.status, a.lock_version
  into application_id, status, lock_version;

  if v_actor_id = v_owner_id then
    insert into public.notifications (recipient_id, type, title, body, internal_path)
    values (
      v_application.applicant_id,
      'application_status_changed',
      'Candidature mise à jour',
      'Le statut de votre candidature a changé.',
      '/applications'
    );
  else
    insert into public.notifications (recipient_id, type, title, body, internal_path)
    values (
      v_owner_id,
      'application_status_changed',
      'Candidature retirée',
      'Un talent a retiré sa candidature.',
      '/missions/' || v_application.mission_id::text || '/applications'
    );
  end if;

  return next;
end;
$$;

create function public.transition_mission(
  p_mission_id uuid,
  p_expected_version integer,
  p_new_status public.mission_status
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
  v_event_type public.mission_event_type;
  v_confirmed_count integer;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select ms.*
  into v_mission
  from public.missions ms
  where ms.id = p_mission_id
  for update;

  if not found then
    raise exception 'mission not found' using errcode = 'P0002';
  end if;

  if v_mission.status = p_new_status then
    mission_id := v_mission.id;
    status := v_mission.status;
    lock_version := v_mission.lock_version;
    return next;
    return;
  end if;

  if v_mission.lock_version <> p_expected_version then
    raise exception 'stale mission version' using errcode = '40001';
  end if;

  if p_new_status = 'assigned' then
    raise exception 'assignment requires accept_application' using errcode = '42501';
  end if;

  if p_new_status in ('published', 'selecting', 'cancelled') then
    if v_actor_id <> v_mission.owner_id then
      raise exception 'only the mission owner can perform this transition'
        using errcode = '42501';
    end if;
  elsif p_new_status = 'in_progress' then
    if v_actor_id not in (v_mission.owner_id, v_mission.assigned_talent_id) then
      raise exception 'only a mission participant can start the work'
        using errcode = '42501';
    end if;
  elsif p_new_status = 'completed' then
    if v_actor_id not in (v_mission.owner_id, v_mission.assigned_talent_id) then
      raise exception 'only a mission participant can complete the mission'
        using errcode = '42501';
    end if;

    select count(*)
    into v_confirmed_count
    from public.completion_confirmations cc
    where cc.mission_id = v_mission.id
      and cc.decision = 'confirmed';

    if v_confirmed_count <> 2 then
      raise exception 'both participants must confirm completion'
        using errcode = '23514';
    end if;
  else
    raise exception 'unsupported mission transition' using errcode = '42501';
  end if;

  update public.missions ms
  set status = p_new_status
  where ms.id = v_mission.id
  returning ms.id, ms.status, ms.lock_version
  into mission_id, status, lock_version;

  if p_new_status = 'completed' then
    update public.matches mt
    set status = 'completed', completed_at = statement_timestamp()
    where mt.mission_id = v_mission.id
      and mt.status = 'active';
  elsif p_new_status = 'cancelled' then
    update public.matches mt
    set status = 'cancelled', cancelled_at = statement_timestamp()
    where mt.mission_id = v_mission.id
      and mt.status = 'active';
  end if;

  v_event_type := case p_new_status
    when 'published' then 'mission_published'::public.mission_event_type
    when 'selecting' then 'selection_started'::public.mission_event_type
    when 'in_progress' then 'work_started'::public.mission_event_type
    when 'completed' then 'mission_completed'::public.mission_event_type
    when 'cancelled' then 'mission_cancelled'::public.mission_event_type
    else null::public.mission_event_type
  end;

  if v_event_type is not null then
    insert into public.mission_events (
      mission_id, actor_id, event_type, old_values, new_values
    )
    values (
      v_mission.id,
      v_actor_id,
      v_event_type,
      jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
      jsonb_build_object('status', status, 'lock_version', lock_version)
    );
  end if;

  insert into public.notifications (recipient_id, type, title, body, internal_path)
  select
    participant_id,
    'mission_status_changed',
    'Mission mise à jour',
    'Le statut de la mission a changé.',
    '/missions/' || v_mission.id::text
  from (
    values (v_mission.owner_id), (v_mission.assigned_talent_id)
  ) as participants(participant_id)
  where participant_id is not null
    and participant_id <> v_actor_id;

  return next;
end;
$$;

create function public.confirm_agreement(
  p_agreement_id uuid,
  p_expected_version integer
)
returns table (
  agreement_id uuid,
  status public.agreement_status,
  lock_version integer,
  client_confirmed_at timestamptz,
  talent_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_match public.matches%rowtype;
  v_new_status public.agreement_status;
  v_party text;
  v_other_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select a.*
  into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception 'agreement not found' using errcode = 'P0002';
  end if;

  select mt.*
  into strict v_match
  from public.matches mt
  where mt.id = v_agreement.match_id;

  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'only match participants can confirm an agreement'
      using errcode = '42501';
  end if;

  if (v_actor_id = v_match.client_id and v_agreement.client_confirmed_at is not null)
     or (v_actor_id = v_match.talent_id and v_agreement.talent_confirmed_at is not null) then
    agreement_id := v_agreement.id;
    status := v_agreement.status;
    lock_version := v_agreement.lock_version;
    client_confirmed_at := v_agreement.client_confirmed_at;
    talent_confirmed_at := v_agreement.talent_confirmed_at;
    return next;
    return;
  end if;

  if v_agreement.lock_version <> p_expected_version then
    raise exception 'stale agreement version' using errcode = '40001';
  end if;

  if v_agreement.status not in ('draft', 'client_confirmed', 'talent_confirmed') then
    raise exception 'agreement cannot be confirmed in its current status'
      using errcode = '23514';
  end if;

  if v_actor_id = v_match.client_id then
    v_new_status := case
      when v_agreement.talent_confirmed_at is null
        then 'client_confirmed'::public.agreement_status
      else 'confirmed'::public.agreement_status
    end;
    v_party := 'client';
    v_other_user_id := v_match.talent_id;

    update public.agreements a
    set client_confirmed_at = statement_timestamp(),
        status = v_new_status
    where a.id = v_agreement.id
    returning a.id, a.status, a.lock_version,
      a.client_confirmed_at, a.talent_confirmed_at
    into agreement_id, status, lock_version,
      client_confirmed_at, talent_confirmed_at;
  else
    v_new_status := case
      when v_agreement.client_confirmed_at is null
        then 'talent_confirmed'::public.agreement_status
      else 'confirmed'::public.agreement_status
    end;
    v_party := 'talent';
    v_other_user_id := v_match.client_id;

    update public.agreements a
    set talent_confirmed_at = statement_timestamp(),
        status = v_new_status
    where a.id = v_agreement.id
    returning a.id, a.status, a.lock_version,
      a.client_confirmed_at, a.talent_confirmed_at
    into agreement_id, status, lock_version,
      client_confirmed_at, talent_confirmed_at;
  end if;

  insert into public.mission_events (
    mission_id, actor_id, event_type, old_values, new_values, metadata
  )
  values (
    v_agreement.mission_id,
    v_actor_id,
    'agreement_updated',
    jsonb_build_object('status', v_agreement.status, 'lock_version', v_agreement.lock_version),
    jsonb_build_object('status', status, 'lock_version', lock_version),
    jsonb_build_object(
      'agreement_id', v_agreement.id,
      'agreement_version', v_agreement.version,
      'confirmed_by', v_party
    )
  );

  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_other_user_id,
    'agreement_updated',
    'Accord mis à jour',
    'L’autre participant a confirmé la version actuelle de l’accord.',
    '/matches/' || v_match.id::text || '/agreement'
  );

  return next;
end;
$$;

create function public.transition_agreement(
  p_agreement_id uuid,
  p_expected_version integer,
  p_new_status public.agreement_status
)
returns table (
  agreement_id uuid,
  status public.agreement_status,
  lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_match public.matches%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select a.*
  into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception 'agreement not found' using errcode = 'P0002';
  end if;

  select mt.*
  into strict v_match
  from public.matches mt
  where mt.id = v_agreement.match_id;

  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'only match participants can transition an agreement'
      using errcode = '42501';
  end if;

  if v_agreement.status = p_new_status then
    agreement_id := v_agreement.id;
    status := v_agreement.status;
    lock_version := v_agreement.lock_version;
    return next;
    return;
  end if;

  if v_agreement.lock_version <> p_expected_version then
    raise exception 'stale agreement version' using errcode = '40001';
  end if;

  if not (
    (v_agreement.status = 'confirmed' and p_new_status = 'active')
    or (
      v_agreement.status = 'active'
      and p_new_status = 'completed'
      and v_match.status = 'completed'
    )
  ) then
    raise exception 'agreement transition is not authorized in the current state'
      using errcode = '23514';
  end if;

  update public.agreements a
  set status = p_new_status
  where a.id = v_agreement.id
  returning a.id, a.status, a.lock_version
  into agreement_id, status, lock_version;

  insert into public.mission_events (
    mission_id, actor_id, event_type, old_values, new_values, metadata
  )
  values (
    v_agreement.mission_id,
    v_actor_id,
    'agreement_updated',
    jsonb_build_object('status', v_agreement.status, 'lock_version', v_agreement.lock_version),
    jsonb_build_object('status', status, 'lock_version', lock_version),
    jsonb_build_object(
      'agreement_id', v_agreement.id,
      'agreement_version', v_agreement.version
    )
  );

  insert into public.notifications (recipient_id, type, title, body, internal_path)
  select
    participant_id,
    'agreement_updated',
    'Accord mis à jour',
    'Le statut de l’accord de mission a changé.',
    '/matches/' || v_match.id::text || '/agreement'
  from (values (v_match.client_id), (v_match.talent_id)) participants(participant_id)
  where participant_id <> v_actor_id;

  return next;
end;
$$;

revoke execute on function private.lock_user_pair(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.protect_sensitive_workflow_columns() from public, anon, authenticated;
revoke execute on function public.validate_application_interaction() from public, anon, authenticated;
revoke execute on function public.validate_match_interaction() from public, anon, authenticated;
revoke execute on function public.validate_message_interaction() from public, anon, authenticated;
revoke execute on function public.serialize_block_creation() from public, anon, authenticated;

revoke execute on function public.accept_application(uuid, integer, integer) from public, anon;
revoke execute on function public.transition_application(uuid, integer, public.application_status) from public, anon;
revoke execute on function public.transition_mission(uuid, integer, public.mission_status) from public, anon;
revoke execute on function public.confirm_agreement(uuid, integer) from public, anon;
revoke execute on function public.transition_agreement(uuid, integer, public.agreement_status) from public, anon;

grant execute on function public.accept_application(uuid, integer, integer) to authenticated;
grant execute on function public.transition_application(uuid, integer, public.application_status) to authenticated;
grant execute on function public.transition_mission(uuid, integer, public.mission_status) to authenticated;
grant execute on function public.confirm_agreement(uuid, integer) to authenticated;
grant execute on function public.transition_agreement(uuid, integer, public.agreement_status) to authenticated;

comment on function public.accept_application(uuid, integer, integer) is
  'Atomically accepts one shortlisted application, closes competing applications, assigns the talent, and creates the match, conversation, audit event, and notifications under a mission row lock.';
comment on function public.confirm_agreement(uuid, integer) is
  'Records one participant confirmation under a row lock; retrying the same participant is idempotent and the second distinct confirmation produces confirmed.';
comment on function public.transition_mission(uuid, integer, public.mission_status) is
  'Performs authorized mission transitions with optimistic concurrency and auditable events.';
comment on function public.transition_application(uuid, integer, public.application_status) is
  'Allows candidate withdrawal and owner review transitions; acceptance is intentionally excluded.';
comment on function public.transition_agreement(uuid, integer, public.agreement_status) is
  'Allows only confirmed-to-active and completed-match-to-completed agreement transitions.';
