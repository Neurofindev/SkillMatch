do $$
declare
  v_match_count integer;
  v_conversation_count integer;
  v_agreement_count integer;
  v_member_count integer;
  v_accepted_count integer;
  v_rejected_count integer;
  v_assigned_talent_id uuid;
begin
  select count(*)
  into v_match_count
  from public.matches
  where mission_id = 'f1000000-0000-0000-0000-000000000001';

  select count(*)
  into v_conversation_count
  from public.conversations
  where mission_id = 'f1000000-0000-0000-0000-000000000001';

  select count(*)
  into v_agreement_count
  from public.agreements a
  join public.matches mt on mt.id = a.match_id
  where mt.mission_id = 'f1000000-0000-0000-0000-000000000001';

  select count(*)
  into v_member_count
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id
  where c.mission_id = 'f1000000-0000-0000-0000-000000000001';

  select
    count(*) filter (where status = 'accepted'),
    count(*) filter (where status = 'rejected')
  into v_accepted_count, v_rejected_count
  from public.applications
  where mission_id = 'f1000000-0000-0000-0000-000000000001';

  select assigned_talent_id
  into v_assigned_talent_id
  from public.missions
  where id = 'f1000000-0000-0000-0000-000000000001'
    and status = 'assigned';

  if v_match_count <> 1
     or v_conversation_count <> 1
     or v_agreement_count <> 1
     or v_member_count <> 2
     or v_accepted_count <> 1
     or v_rejected_count <> 1
     or v_assigned_talent_id is null then
    raise exception
      'concurrency invariant failed: matches %, conversations %, agreements %, members %, accepted %, rejected %, assigned %',
      v_match_count,
      v_conversation_count,
      v_agreement_count,
      v_member_count,
      v_accepted_count,
      v_rejected_count,
      v_assigned_talent_id;
  end if;
end;
$$;
