-- Phase 07: atomic acceptance handoff, participant match workspace,
-- bilateral agreement confirmation, real timeline and controlled completion.

create function private.ensure_initial_agreement(
  p_match_id uuid,
  p_mission_id uuid,
  p_application_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.missions%rowtype;
  v_application public.applications%rowtype;
  v_agreement_id uuid;
begin
  select ms.* into strict v_mission
  from public.missions ms
  where ms.id = p_mission_id;

  select a.* into strict v_application
  from public.applications a
  where a.id = p_application_id and a.mission_id = p_mission_id;

  insert into public.agreements (
    match_id,
    mission_id,
    version,
    created_by,
    scope_snapshot,
    deliverables,
    starts_on,
    ends_on,
    budget_model,
    budget_min,
    budget_max,
    currency_code
  )
  values (
    p_match_id,
    p_mission_id,
    1,
    p_created_by,
    v_mission.description,
    v_mission.deliverables,
    v_mission.starts_on,
    v_mission.ends_on,
    v_mission.budget_model,
    coalesce(v_application.proposed_amount, v_mission.budget_min),
    case
      when v_application.proposed_amount is not null then v_application.proposed_amount
      else v_mission.budget_max
    end,
    coalesce(v_application.proposed_currency_code, v_mission.currency_code)
  )
  on conflict (match_id, version) do nothing
  returning id into v_agreement_id;

  if v_agreement_id is not null then
    insert into public.mission_events (
      mission_id, actor_id, event_type, old_values, new_values, metadata
    )
    values (
      p_mission_id,
      p_created_by,
      'agreement_updated',
      null,
      jsonb_build_object('status', 'draft', 'version', 1),
      jsonb_build_object(
        'action', 'agreement_created',
        'agreement_id', v_agreement_id,
        'agreement_version', 1
      )
    );
  else
    select a.id into strict v_agreement_id
    from public.agreements a
    where a.match_id = p_match_id and a.version = 1;
  end if;

  return v_agreement_id;
end;
$$;

create or replace function public.confirm_agreement(
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
  v_mission_status public.mission_status;
  v_new_status public.agreement_status;
  v_party text;
  v_other_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select a.* into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception 'agreement not found' using errcode = 'P0002';
  end if;

  select mt.* into strict v_match
  from public.matches mt where mt.id = v_agreement.match_id;

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

  select ms.status into strict v_mission_status
  from public.missions ms where ms.id = v_agreement.mission_id;

  if v_match.status <> 'active' or v_mission_status <> 'assigned' then
    raise exception 'agreement confirmation is closed for this match'
      using errcode = '23514';
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
    set client_confirmed_at = statement_timestamp(), status = v_new_status
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
    set talent_confirmed_at = statement_timestamp(), status = v_new_status
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
      'action', 'agreement_confirmed',
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
    '/espace/matches/' || v_match.id::text
  );

  return next;
end;
$$;

create function public.start_match(
  p_match_id uuid,
  p_expected_mission_version integer,
  p_expected_agreement_version integer
)
returns table (
  match_id uuid,
  mission_status public.mission_status,
  mission_lock_version integer,
  agreement_status public.agreement_status,
  agreement_lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mission public.missions%rowtype;
  v_agreement public.agreements%rowtype;
  v_other_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select mt.* into v_match
  from public.matches mt where mt.id = p_match_id for update;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'only match participants can start the mission'
      using errcode = '42501';
  end if;

  select ms.* into strict v_mission
  from public.missions ms where ms.id = v_match.mission_id for update;
  select a.* into v_agreement
  from public.agreements a
  where a.match_id = v_match.id
  order by a.version desc
  limit 1
  for update;
  if not found then
    raise exception 'agreement not found' using errcode = 'P0002';
  end if;

  if v_mission.status = 'in_progress' and v_agreement.status = 'active' then
    match_id := v_match.id;
    mission_status := v_mission.status;
    mission_lock_version := v_mission.lock_version;
    agreement_status := v_agreement.status;
    agreement_lock_version := v_agreement.lock_version;
    return next;
    return;
  end if;

  if v_match.status <> 'active'
     or v_mission.status <> 'assigned'
     or v_agreement.status <> 'confirmed' then
    raise exception 'both participants must confirm before the mission starts'
      using errcode = '23514';
  end if;
  if v_mission.lock_version <> p_expected_mission_version
     or v_agreement.lock_version <> p_expected_agreement_version then
    raise exception 'stale match workspace version' using errcode = '40001';
  end if;

  perform set_config('skillmatch.phase07_action', 'start', true);
  update public.agreements a
  set status = 'active'
  where a.id = v_agreement.id
  returning a.status, a.lock_version
  into agreement_status, agreement_lock_version;
  update public.missions ms
  set status = 'in_progress'
  where ms.id = v_mission.id
  returning ms.status, ms.lock_version
  into mission_status, mission_lock_version;
  perform set_config('skillmatch.phase07_action', '', true);

  insert into public.mission_events (
    mission_id, actor_id, event_type, old_values, new_values, metadata
  )
  values
  (
    v_mission.id,
    v_actor_id,
    'agreement_updated',
    jsonb_build_object('status', v_agreement.status, 'lock_version', v_agreement.lock_version),
    jsonb_build_object('status', agreement_status, 'lock_version', agreement_lock_version),
    jsonb_build_object(
      'action', 'agreement_activated',
      'agreement_id', v_agreement.id,
      'agreement_version', v_agreement.version
    )
  ),
  (
    v_mission.id,
    v_actor_id,
    'work_started',
    jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
    jsonb_build_object('status', mission_status, 'lock_version', mission_lock_version),
    jsonb_build_object('match_id', v_match.id)
  );

  v_other_user_id := case
    when v_actor_id = v_match.client_id then v_match.talent_id else v_match.client_id
  end;
  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_other_user_id,
    'mission_status_changed',
    'Mission démarrée',
    'La mission et son accord sont maintenant en cours.',
    '/espace/matches/' || v_match.id::text
  );

  match_id := v_match.id;
  return next;
end;
$$;

create function public.add_mission_progress(
  p_match_id uuid,
  p_kind text,
  p_note text
)
returns table (event_id bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mission_status public.mission_status;
  v_event_type public.mission_event_type;
  v_other_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_kind not in ('progress', 'delivery')
     or char_length(btrim(coalesce(p_note, ''))) not between 3 and 2000 then
    raise exception 'invalid progress note' using errcode = '22023';
  end if;

  select mt.* into v_match
  from public.matches mt where mt.id = p_match_id for update;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'only match participants can add progress'
      using errcode = '42501';
  end if;
  if p_kind = 'delivery' and v_actor_id <> v_match.talent_id then
    raise exception 'only the retained talent can record a delivery'
      using errcode = '42501';
  end if;

  select ms.status into strict v_mission_status
  from public.missions ms where ms.id = v_match.mission_id;
  if v_match.status <> 'active' or v_mission_status <> 'in_progress' then
    raise exception 'progress requires an active mission' using errcode = '23514';
  end if;

  v_event_type := case p_kind
    when 'delivery' then 'delivery_submitted'::public.mission_event_type
    else 'progress_updated'::public.mission_event_type
  end;

  insert into public.mission_events (
    mission_id, actor_id, event_type, metadata
  )
  values (
    v_match.mission_id,
    v_actor_id,
    v_event_type,
    jsonb_build_object('match_id', v_match.id, 'note', btrim(p_note))
  )
  returning mission_events.id, mission_events.created_at
  into event_id, created_at;

  v_other_user_id := case
    when v_actor_id = v_match.client_id then v_match.talent_id else v_match.client_id
  end;
  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_other_user_id,
    'mission_status_changed',
    case when p_kind = 'delivery' then 'Livraison ajoutée' else 'Avancement ajouté' end,
    case
      when p_kind = 'delivery' then 'Le talent a ajouté une livraison au suivi.'
      else 'Un participant a ajouté une note d’avancement.'
    end,
    '/espace/matches/' || v_match.id::text
  );

  return next;
end;
$$;

create function public.submit_completion_confirmation(
  p_match_id uuid,
  p_decision public.completion_decision,
  p_note text default null
)
returns table (
  confirmation_id uuid,
  decision public.completion_decision,
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
  v_existing public.completion_confirmations%rowtype;
  v_other_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_note is not null and char_length(btrim(p_note)) not between 3 and 2000 then
    raise exception 'invalid completion note' using errcode = '22023';
  end if;
  if p_decision = 'disputed'
     and char_length(btrim(coalesce(p_note, ''))) < 10 then
    raise exception 'a dispute requires a reason' using errcode = '22023';
  end if;

  select mt.* into v_match
  from public.matches mt where mt.id = p_match_id for update;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'only match participants can confirm completion'
      using errcode = '42501';
  end if;
  select ms.status into strict v_mission_status
  from public.missions ms where ms.id = v_match.mission_id;
  if v_match.status <> 'active' or v_mission_status <> 'in_progress' then
    raise exception 'completion confirmation requires an active mission'
      using errcode = '23514';
  end if;

  select cc.* into v_existing
  from public.completion_confirmations cc
  where cc.match_id = v_match.id and cc.participant_id = v_actor_id
  for update;
  if found then
    if v_existing.decision = p_decision
       and coalesce(v_existing.note, '') = coalesce(nullif(btrim(p_note), ''), '') then
      confirmation_id := v_existing.id;
      decision := v_existing.decision;
      created_at := v_existing.created_at;
      return next;
      return;
    end if;
    raise exception 'a completion decision is already recorded'
      using errcode = '23514';
  end if;

  insert into public.completion_confirmations (
    match_id, mission_id, participant_id, decision, note
  )
  values (
    v_match.id,
    v_match.mission_id,
    v_actor_id,
    p_decision,
    nullif(btrim(p_note), '')
  )
  returning completion_confirmations.id,
    completion_confirmations.decision,
    completion_confirmations.created_at
  into confirmation_id, decision, created_at;

  insert into public.mission_events (
    mission_id, actor_id, event_type, metadata
  )
  values (
    v_match.mission_id,
    v_actor_id,
    case p_decision
      when 'confirmed' then 'completion_confirmed'::public.mission_event_type
      else 'completion_disputed'::public.mission_event_type
    end,
    jsonb_build_object(
      'match_id', v_match.id,
      'decision', p_decision,
      'note', nullif(btrim(p_note), '')
    )
  );

  v_other_user_id := case
    when v_actor_id = v_match.client_id then v_match.talent_id else v_match.client_id
  end;
  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_other_user_id,
    'mission_status_changed',
    case when p_decision = 'confirmed' then 'Fin confirmée' else 'Fin contestée' end,
    case
      when p_decision = 'confirmed' then 'L’autre participant a confirmé la fin de la mission.'
      else 'L’autre participant a contesté la fin de la mission.'
    end,
    '/espace/matches/' || v_match.id::text
  );

  return next;
end;
$$;

create function public.complete_match(
  p_match_id uuid,
  p_expected_mission_version integer,
  p_expected_agreement_version integer
)
returns table (
  match_id uuid,
  match_status public.match_status,
  mission_status public.mission_status,
  mission_lock_version integer,
  agreement_status public.agreement_status,
  agreement_lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mission public.missions%rowtype;
  v_agreement public.agreements%rowtype;
  v_confirmed_count integer;
  v_other_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select mt.* into v_match
  from public.matches mt where mt.id = p_match_id for update;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'only match participants can close the mission'
      using errcode = '42501';
  end if;
  select ms.* into strict v_mission
  from public.missions ms where ms.id = v_match.mission_id for update;
  select a.* into v_agreement
  from public.agreements a
  where a.match_id = v_match.id
  order by a.version desc
  limit 1
  for update;
  if not found then
    raise exception 'agreement not found' using errcode = 'P0002';
  end if;

  if v_match.status = 'completed'
     and v_mission.status = 'completed'
     and v_agreement.status = 'completed' then
    match_id := v_match.id;
    match_status := v_match.status;
    mission_status := v_mission.status;
    mission_lock_version := v_mission.lock_version;
    agreement_status := v_agreement.status;
    agreement_lock_version := v_agreement.lock_version;
    return next;
    return;
  end if;

  if v_match.status <> 'active'
     or v_mission.status <> 'in_progress'
     or v_agreement.status <> 'active' then
    raise exception 'the match is not ready for completion' using errcode = '23514';
  end if;
  if v_mission.lock_version <> p_expected_mission_version
     or v_agreement.lock_version <> p_expected_agreement_version then
    raise exception 'stale match workspace version' using errcode = '40001';
  end if;

  select count(*)::integer into v_confirmed_count
  from public.completion_confirmations cc
  where cc.match_id = v_match.id and cc.decision = 'confirmed';
  if v_confirmed_count <> 2 then
    raise exception 'both participants must confirm completion'
      using errcode = '23514';
  end if;

  perform set_config('skillmatch.phase07_action', 'complete', true);
  update public.missions ms
  set status = 'completed'
  where ms.id = v_mission.id
  returning ms.status, ms.lock_version
  into mission_status, mission_lock_version;
  update public.matches mt
  set status = 'completed', completed_at = statement_timestamp()
  where mt.id = v_match.id
  returning mt.status into match_status;
  update public.agreements a
  set status = 'completed'
  where a.id = v_agreement.id
  returning a.status, a.lock_version
  into agreement_status, agreement_lock_version;
  perform set_config('skillmatch.phase07_action', '', true);

  insert into public.mission_events (
    mission_id, actor_id, event_type, old_values, new_values, metadata
  )
  values
  (
    v_mission.id,
    v_actor_id,
    'agreement_updated',
    jsonb_build_object('status', v_agreement.status, 'lock_version', v_agreement.lock_version),
    jsonb_build_object('status', agreement_status, 'lock_version', agreement_lock_version),
    jsonb_build_object(
      'action', 'agreement_completed',
      'agreement_id', v_agreement.id,
      'agreement_version', v_agreement.version
    )
  ),
  (
    v_mission.id,
    v_actor_id,
    'mission_completed',
    jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
    jsonb_build_object('status', mission_status, 'lock_version', mission_lock_version),
    jsonb_build_object('match_id', v_match.id)
  );

  v_other_user_id := case
    when v_actor_id = v_match.client_id then v_match.talent_id else v_match.client_id
  end;
  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_other_user_id,
    'mission_status_changed',
    'Mission terminée',
    'La mission a été clôturée après les deux confirmations.',
    '/espace/matches/' || v_match.id::text
  );

  match_id := v_match.id;
  return next;
end;
$$;

create function public.cancel_match_mission(
  p_match_id uuid,
  p_expected_mission_version integer,
  p_reason text
)
returns table (
  match_id uuid,
  match_status public.match_status,
  mission_status public.mission_status,
  mission_lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mission public.missions%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'a cancellation reason is required' using errcode = '22023';
  end if;

  select mt.* into v_match
  from public.matches mt where mt.id = p_match_id for update;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  select ms.* into strict v_mission
  from public.missions ms where ms.id = v_match.mission_id for update;

  if v_actor_id <> v_match.client_id then
    raise exception 'only the mission owner can cancel an assigned mission'
      using errcode = '42501';
  end if;
  if v_match.status = 'cancelled' and v_mission.status = 'cancelled' then
    match_id := v_match.id;
    match_status := v_match.status;
    mission_status := v_mission.status;
    mission_lock_version := v_mission.lock_version;
    return next;
    return;
  end if;
  if v_match.status <> 'active'
     or v_mission.status not in ('assigned', 'in_progress') then
    raise exception 'the mission can no longer be cancelled' using errcode = '23514';
  end if;
  if v_mission.lock_version <> p_expected_mission_version then
    raise exception 'stale mission version' using errcode = '40001';
  end if;

  perform set_config('skillmatch.phase07_action', 'cancel', true);
  update public.missions ms
  set status = 'cancelled'
  where ms.id = v_mission.id
  returning ms.status, ms.lock_version
  into mission_status, mission_lock_version;
  update public.matches mt
  set status = 'cancelled', cancelled_at = statement_timestamp()
  where mt.id = v_match.id
  returning mt.status into match_status;
  perform set_config('skillmatch.phase07_action', '', true);

  insert into public.mission_events (
    mission_id, actor_id, event_type, old_values, new_values, metadata
  )
  values (
    v_mission.id,
    v_actor_id,
    'mission_cancelled',
    jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
    jsonb_build_object('status', mission_status, 'lock_version', mission_lock_version),
    jsonb_build_object(
      'match_id', v_match.id,
      'reason', btrim(p_reason)
    )
  );

  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_match.talent_id,
    'mission_status_changed',
    'Mission annulée',
    'Le client a annulé la mission avec un motif enregistré dans le suivi.',
    '/espace/matches/' || v_match.id::text
  );

  match_id := v_match.id;
  return next;
end;
$$;

revoke insert on public.completion_confirmations from authenticated;

create or replace function public.accept_application(
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
    perform private.ensure_initial_agreement(
      v_match_id, v_mission.id, v_application.id, v_actor_id
    );
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
    '/espace/candidatures'
  from rejected;

  update public.missions ms
  set status = 'assigned',
      assigned_talent_id = v_application.applicant_id
  where ms.id = v_mission.id
  returning ms.status, ms.lock_version
  into mission_status, mission_lock_version;

  insert into public.matches (
    mission_id, accepted_application_id, client_id, talent_id
  )
  values (
    v_mission.id, v_application.id, v_mission.owner_id, v_application.applicant_id
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
    mission_id, actor_id, event_type, old_values, new_values, metadata
  )
  values (
    v_mission.id,
    v_actor_id,
    'talent_assigned',
    jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
    jsonb_build_object('status', mission_status, 'lock_version', mission_lock_version),
    jsonb_build_object('application_id', v_application.id, 'match_id', v_match_id)
  );

  perform private.ensure_initial_agreement(
    v_match_id, v_mission.id, v_application.id, v_actor_id
  );

  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_application.applicant_id,
    'match_created',
    'Candidature acceptée',
    'Votre candidature a été acceptée. L’accord de mission doit maintenant être confirmé.',
    '/espace/matches/' || v_match_id::text
  );

  match_id := v_match_id;
  conversation_id := v_conversation_id;
  return next;
end;
$$;

create function public.sync_mission_selection_on_shortlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.missions%rowtype;
  v_new_version integer;
begin
  if old.status is distinct from new.status and new.status = 'shortlisted' then
    select ms.* into v_mission
    from public.missions ms
    where ms.id = new.mission_id
    for update;

    if v_mission.status = 'published' then
      update public.missions ms
      set status = 'selecting'
      where ms.id = v_mission.id
      returning lock_version into v_new_version;

      insert into public.mission_events (
        mission_id, actor_id, event_type, old_values, new_values, metadata
      )
      values (
        v_mission.id,
        auth.uid(),
        'selection_started',
        jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
        jsonb_build_object('status', 'selecting', 'lock_version', v_new_version),
        jsonb_build_object('application_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger applications_sync_selection_on_shortlist
after update of status on public.applications
for each row execute function public.sync_mission_selection_on_shortlist();

create function public.enforce_coupled_mission_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_action text := coalesce(current_setting('skillmatch.phase07_action', true), '');
begin
  if old.status = 'assigned' and new.status = 'in_progress' and v_action <> 'start' then
    raise exception 'starting an assigned mission requires start_match'
      using errcode = '42501';
  elsif old.status = 'in_progress' and new.status = 'completed' and v_action <> 'complete' then
    raise exception 'completing a mission requires complete_match'
      using errcode = '42501';
  elsif old.status in ('assigned', 'in_progress')
        and new.status = 'cancelled' and v_action <> 'cancel' then
    raise exception 'cancelling an assigned mission requires a reason'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger missions_enforce_coupled_workflow
before update of status on public.missions
for each row execute function public.enforce_coupled_mission_workflow();

create function public.enforce_coupled_agreement_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_action text := coalesce(current_setting('skillmatch.phase07_action', true), '');
begin
  if old.status = 'confirmed' and new.status = 'active' and v_action <> 'start' then
    raise exception 'activating an agreement requires start_match'
      using errcode = '42501';
  elsif old.status = 'active' and new.status = 'completed' and v_action <> 'complete' then
    raise exception 'completing an agreement requires complete_match'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger agreements_enforce_coupled_workflow
before update of status on public.agreements
for each row execute function public.enforce_coupled_agreement_workflow();

create function public.list_match_workspaces()
returns table (
  match_id uuid,
  mission_id uuid,
  mission_title text,
  mission_status public.mission_status,
  mission_lock_version integer,
  match_status public.match_status,
  matched_at timestamptz,
  participant_role text,
  counterpart_id uuid,
  counterpart_display_name text,
  counterpart_username text,
  counterpart_headline text,
  counterpart_avatar_path text,
  conversation_id uuid,
  agreement_id uuid,
  agreement_status public.agreement_status,
  agreement_version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mt.id,
    mt.mission_id,
    ms.title,
    ms.status,
    ms.lock_version,
    mt.status,
    mt.matched_at,
    case when auth.uid() = mt.client_id then 'client' else 'talent' end,
    counterpart.id,
    counterpart.display_name,
    counterpart.username::text,
    counterpart.headline,
    counterpart.avatar_path,
    conversation.id,
    agreement.id,
    agreement.status,
    agreement.version
  from public.matches mt
  join public.missions ms on ms.id = mt.mission_id
  join public.profiles counterpart
    on counterpart.id = case
      when auth.uid() = mt.client_id then mt.talent_id
      else mt.client_id
    end
  left join public.conversations conversation on conversation.match_id = mt.id
  left join lateral (
    select a.id, a.status, a.version
    from public.agreements a
    where a.match_id = mt.id
    order by a.version desc
    limit 1
  ) agreement on true
  where auth.uid() in (mt.client_id, mt.talent_id)
  order by mt.matched_at desc, mt.id;
$$;

create function public.get_match_workspace(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mission public.missions%rowtype;
  v_client public.profiles%rowtype;
  v_talent public.profiles%rowtype;
  v_conversation_id uuid;
  v_agreement jsonb;
  v_events jsonb;
  v_confirmations jsonb;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select mt.* into v_match
  from public.matches mt
  where mt.id = p_match_id;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'match access is not authorized' using errcode = '42501';
  end if;

  select ms.* into strict v_mission
  from public.missions ms where ms.id = v_match.mission_id;
  select p.* into strict v_client
  from public.profiles p where p.id = v_match.client_id;
  select p.* into strict v_talent
  from public.profiles p where p.id = v_match.talent_id;
  select c.id into v_conversation_id
  from public.conversations c where c.match_id = v_match.id;

  select jsonb_build_object(
    'id', a.id,
    'version', a.version,
    'scope', a.scope_snapshot,
    'deliverables', a.deliverables,
    'startsOn', a.starts_on,
    'endsOn', a.ends_on,
    'budgetModel', a.budget_model,
    'budgetMin', a.budget_min,
    'budgetMax', a.budget_max,
    'currencyCode', a.currency_code,
    'platformNotice', a.platform_notice,
    'status', a.status,
    'lockVersion', a.lock_version,
    'clientConfirmedAt', a.client_confirmed_at,
    'talentConfirmedAt', a.talent_confirmed_at,
    'createdAt', a.created_at,
    'updatedAt', a.updated_at
  ) into v_agreement
  from public.agreements a
  where a.match_id = v_match.id
  order by a.version desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', me.id,
        'type', me.event_type,
        'actorId', me.actor_id,
        'actorDisplayName', actor.display_name,
        'oldValues', me.old_values,
        'newValues', me.new_values,
        'metadata', me.metadata,
        'createdAt', me.created_at
      ) order by me.created_at, me.id
    ),
    '[]'::jsonb
  ) into v_events
  from public.mission_events me
  left join public.profiles actor on actor.id = me.actor_id
  where me.mission_id = v_match.mission_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cc.id,
        'participantId', cc.participant_id,
        'participantDisplayName', participant.display_name,
        'decision', cc.decision,
        'note', cc.note,
        'createdAt', cc.created_at
      ) order by cc.created_at, cc.id
    ),
    '[]'::jsonb
  ) into v_confirmations
  from public.completion_confirmations cc
  join public.profiles participant on participant.id = cc.participant_id
  where cc.match_id = v_match.id;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'status', v_match.status,
      'matchedAt', v_match.matched_at,
      'completedAt', v_match.completed_at,
      'cancelledAt', v_match.cancelled_at,
      'role', case when v_actor_id = v_match.client_id then 'client' else 'talent' end,
      'conversationId', v_conversation_id
    ),
    'mission', jsonb_build_object(
      'id', v_mission.id,
      'title', v_mission.title,
      'description', v_mission.description,
      'status', v_mission.status,
      'lockVersion', v_mission.lock_version,
      'workMode', v_mission.work_mode,
      'publicCity', v_mission.public_city,
      'publicRegion', v_mission.public_region,
      'countryCode', v_mission.country_code,
      'startsOn', v_mission.starts_on,
      'endsOn', v_mission.ends_on,
      'deliverables', v_mission.deliverables
    ),
    'client', jsonb_build_object(
      'id', v_client.id,
      'displayName', v_client.display_name,
      'username', v_client.username::text,
      'headline', v_client.headline,
      'avatarPath', v_client.avatar_path,
      'emailVerified', exists (
        select 1 from auth.users u
        where u.id = v_client.id and u.email_confirmed_at is not null
      )
    ),
    'talent', jsonb_build_object(
      'id', v_talent.id,
      'displayName', v_talent.display_name,
      'username', v_talent.username::text,
      'headline', v_talent.headline,
      'avatarPath', v_talent.avatar_path,
      'emailVerified', exists (
        select 1 from auth.users u
        where u.id = v_talent.id and u.email_confirmed_at is not null
      )
    ),
    'agreement', v_agreement,
    'events', v_events,
    'completionConfirmations', v_confirmations
  );
end;
$$;

revoke execute on function private.ensure_initial_agreement(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.sync_mission_selection_on_shortlist()
  from public, anon, authenticated;
revoke execute on function public.enforce_coupled_mission_workflow()
  from public, anon, authenticated;
revoke execute on function public.enforce_coupled_agreement_workflow()
  from public, anon, authenticated;

revoke execute on function public.list_match_workspaces() from public, anon;
revoke execute on function public.get_match_workspace(uuid) from public, anon;
revoke execute on function public.start_match(uuid, integer, integer) from public, anon;
revoke execute on function public.add_mission_progress(uuid, text, text) from public, anon;
revoke execute on function public.submit_completion_confirmation(uuid, public.completion_decision, text)
  from public, anon;
revoke execute on function public.complete_match(uuid, integer, integer) from public, anon;
revoke execute on function public.cancel_match_mission(uuid, integer, text) from public, anon;

grant execute on function public.list_match_workspaces() to authenticated;
grant execute on function public.get_match_workspace(uuid) to authenticated;
grant execute on function public.start_match(uuid, integer, integer) to authenticated;
grant execute on function public.add_mission_progress(uuid, text, text) to authenticated;
grant execute on function public.submit_completion_confirmation(uuid, public.completion_decision, text)
  to authenticated;
grant execute on function public.complete_match(uuid, integer, integer) to authenticated;
grant execute on function public.cancel_match_mission(uuid, integer, text) to authenticated;

comment on function public.accept_application(uuid, integer, integer) is
  'Atomically accepts one shortlisted application, rejects open competitors, assigns the talent and creates one match, conversation, two members, initial informative agreement, events and notifications.';
comment on function public.get_match_workspace(uuid) is
  'Returns one participant-only match workspace with the latest agreement, completion confirmations and the real append-only timeline.';
comment on function public.start_match(uuid, integer, integer) is
  'Atomically activates a bilaterally confirmed agreement and starts the assigned mission.';
comment on function public.complete_match(uuid, integer, integer) is
  'Atomically closes mission, match and agreement after two distinct completion confirmations.';
comment on function public.cancel_match_mission(uuid, integer, text) is
  'Cancels an assigned or active match for its client owner only, with a mandatory participant-visible audit reason.';
