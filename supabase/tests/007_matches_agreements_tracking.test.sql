create extension if not exists pgtap with schema extensions;

begin;
select plan(73);

select has_function('public', 'accept_application', array['uuid', 'integer', 'integer'], 'acceptance RPC exists');
select has_function('public', 'list_match_workspaces', array[]::text[], 'match list RPC exists');
select has_function('public', 'get_match_workspace', array['uuid'], 'participant workspace RPC exists');
select has_function('public', 'confirm_agreement', array['uuid', 'integer'], 'bilateral confirmation RPC exists');
select has_function('public', 'start_match', array['uuid', 'integer', 'integer'], 'coupled start RPC exists');
select has_function('public', 'add_mission_progress', array['uuid', 'text', 'text'], 'progress RPC exists');
select has_function('public', 'submit_completion_confirmation', array['uuid', 'completion_decision', 'text'], 'completion decision RPC exists');
select has_function('public', 'complete_match', array['uuid', 'integer', 'integer'], 'coupled completion RPC exists');
select has_function('public', 'cancel_match_mission', array['uuid', 'integer', 'text'], 'audited cancellation RPC exists');

select ok(
  has_function_privilege('authenticated', 'public.start_match(uuid,integer,integer)', 'EXECUTE'),
  'authenticated participants can execute the controlled start RPC'
);
select ok(
  not has_function_privilege('anon', 'public.start_match(uuid,integer,integer)', 'EXECUTE'),
  'anonymous users cannot execute the controlled start RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.completion_confirmations', 'INSERT'),
  'completion decisions cannot bypass the controlled RPC'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select lives_ok(
  $$select * from public.accept_application('d2000000-0000-0000-0000-000000000002', 1, 1)$$,
  'the mission owner atomically accepts the shortlisted application'
);
reset role;

select set_config(
  'skillmatch.phase07_match_id',
  (select id::text from public.matches where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  true
);
select set_config(
  'skillmatch.phase07_agreement_id',
  (
    select a.id::text
    from public.agreements a
    where a.match_id = current_setting('skillmatch.phase07_match_id')::uuid
    order by a.version desc limit 1
  ),
  true
);

select is(
  (select count(*) from public.matches where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  1::bigint,
  'acceptance creates one match'
);
select is(
  (select count(*) from public.conversations where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  1::bigint,
  'acceptance creates one conversation'
);
select is(
  (
    select count(*) from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where c.match_id = current_setting('skillmatch.phase07_match_id')::uuid
  ),
  2::bigint,
  'the unique conversation contains exactly the two participants'
);
select is(
  (select count(*) from public.agreements where match_id = current_setting('skillmatch.phase07_match_id')::uuid),
  1::bigint,
  'acceptance creates one initial agreement'
);
select is(
  (select status from public.applications where id = 'd2000000-0000-0000-0000-000000000001'),
  'rejected'::public.application_status,
  'other open applications are closed according to the documented rule'
);
select is(
  (
    select platform_notice from public.agreements
    where id = current_setting('skillmatch.phase07_agreement_id')::uuid
  ),
  'SkillMatch facilite la mise en relation et ne traite aucun paiement. Les modalités de rémunération sont gérées directement entre les participants.',
  'the mandatory non-payment notice is stored exactly'
);
select ok(
  exists (
    select 1 from public.agreements
    where id = current_setting('skillmatch.phase07_agreement_id')::uuid
      and budget_min = 210 and budget_max = 210 and currency_code = 'EUR'
  ),
  'the accepted proposal is frozen as informational budget data'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select lives_ok(
  $$select * from public.accept_application('d2000000-0000-0000-0000-000000000002', 1, 1)$$,
  'retrying the accepted application is idempotent'
);
reset role;
select is(
  (select count(*) from public.matches where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  1::bigint,
  'an idempotent retry does not duplicate the match'
);
select is(
  (select count(*) from public.agreements where match_id = current_setting('skillmatch.phase07_match_id')::uuid),
  1::bigint,
  'an idempotent retry does not duplicate the agreement'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.list_match_workspaces() where match_id = current_setting('skillmatch.phase07_match_id')::uuid), 1::bigint, 'the client sees the match workspace');
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is((select count(*) from public.list_match_workspaces() where match_id = current_setting('skillmatch.phase07_match_id')::uuid), 1::bigint, 'the retained talent sees the match workspace');
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is((select count(*) from public.list_match_workspaces() where match_id = current_setting('skillmatch.phase07_match_id')::uuid), 0::bigint, 'a third party cannot list the match workspace');
select throws_ok(
  format($$select public.get_match_workspace(%L)$$, current_setting('skillmatch.phase07_match_id')),
  '42501', null, 'a third party cannot open the match workspace'
);
select is(
  (select count(*) from public.agreements where match_id = current_setting('skillmatch.phase07_match_id')::uuid),
  0::bigint,
  'agreement RLS hides participant data from a third party'
);
select throws_ok(
  format($$select * from public.start_match(%L, 2, 1)$$, current_setting('skillmatch.phase07_match_id')),
  '42501', null, 'a third party cannot start a match'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  format($$select * from public.start_match(%L, 2, 1)$$, current_setting('skillmatch.phase07_match_id')),
  '23514', null, 'work cannot start before both agreement confirmations'
);
select lives_ok(
  format($$select * from public.confirm_agreement(%L, 1)$$, current_setting('skillmatch.phase07_agreement_id')),
  'the client records a separate agreement confirmation'
);
reset role;
select is(
  (select status from public.agreements where id = current_setting('skillmatch.phase07_agreement_id')::uuid),
  'client_confirmed'::public.agreement_status,
  'one confirmation remains visibly incomplete'
);
select ok(
  exists (
    select 1 from public.agreements
    where id = current_setting('skillmatch.phase07_agreement_id')::uuid
      and client_confirmed_at is not null and talent_confirmed_at is null
  ),
  'the two confirmation timestamps are independent'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  format($$select * from public.confirm_agreement(%L, 1)$$, current_setting('skillmatch.phase07_agreement_id')),
  '40001', null, 'a stale agreement version reports a conflict'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.confirm_agreement(%L, 1)$$, current_setting('skillmatch.phase07_agreement_id')),
  'repeating the same participant confirmation is a safe idempotent retry'
);
reset role;
select is(
  (
    select count(*) from public.mission_events
    where event_type = 'agreement_updated'
      and metadata ->> 'agreement_id' = current_setting('skillmatch.phase07_agreement_id')
      and metadata ->> 'action' = 'agreement_confirmed'
  ),
  1::bigint,
  'the confirmation retry creates no duplicate audit event'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.confirm_agreement(%L, 2)$$, current_setting('skillmatch.phase07_agreement_id')),
  'the talent records the second confirmation'
);
reset role;
select is(
  (select status from public.agreements where id = current_setting('skillmatch.phase07_agreement_id')::uuid),
  'confirmed'::public.agreement_status,
  'two distinct confirmations make the agreement confirmed'
);
select ok(
  exists (
    select 1 from public.agreements
    where id = current_setting('skillmatch.phase07_agreement_id')::uuid
      and client_confirmed_at is not null and talent_confirmed_at is not null
  ),
  'both confirmations are independently timestamped'
);

select throws_ok(
  format($$update public.agreements set status = 'active' where id = %L$$, current_setting('skillmatch.phase07_agreement_id')),
  '42501', null, 'an agreement cannot be activated outside start_match'
);
select throws_ok(
  $$update public.missions set status = 'in_progress' where id = 'd1000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'an assigned mission cannot be started outside start_match'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.start_match(%L, 2, 3)$$, current_setting('skillmatch.phase07_match_id')),
  'a participant atomically starts the confirmed agreement and mission'
);
reset role;
select ok(
  exists (
    select 1 from public.matches mt
    join public.missions ms on ms.id = mt.mission_id
    join public.agreements a on a.match_id = mt.id
    where mt.id = current_setting('skillmatch.phase07_match_id')::uuid
      and mt.status = 'active' and ms.status = 'in_progress' and a.status = 'active'
  ),
  'start_match keeps match, mission and agreement states coherent'
);
select is(
  (select count(*) from public.mission_events where mission_id = 'd1000000-0000-0000-0000-000000000002' and event_type = 'work_started'),
  1::bigint,
  'starting work writes one real timeline event'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.add_mission_progress(%L, 'progress', 'Le cadrage éditorial est terminé.')$$, current_setting('skillmatch.phase07_match_id')),
  'the client can add a traced progress note'
);
select throws_ok(
  format($$select * from public.add_mission_progress(%L, 'delivery', 'Livraison client interdite.')$$, current_setting('skillmatch.phase07_match_id')),
  '42501', null, 'only the retained talent can record a delivery'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.add_mission_progress(%L, 'delivery', 'La synthèse éditoriale finale est livrée.')$$, current_setting('skillmatch.phase07_match_id')),
  'the retained talent records a real delivery event'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  format($$select * from public.add_mission_progress(%L, 'progress', 'Note tierce interdite.')$$, current_setting('skillmatch.phase07_match_id')),
  '42501', null, 'a third party cannot append progress'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
select ok(
  public.get_match_workspace(current_setting('skillmatch.phase07_match_id')::uuid) -> 'events'
    @> '[{"type":"progress_updated","metadata":{"note":"Le cadrage éditorial est terminé."}},{"type":"delivery_submitted","metadata":{"note":"La synthèse éditoriale finale est livrée."}}]'::jsonb,
  'progress and delivery notes persist in the participant timeline'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  format($$select * from public.complete_match(%L, 3, 4)$$, current_setting('skillmatch.phase07_match_id')),
  '23514', null, 'completion is impossible before two participant decisions'
);
select lives_ok(
  format($$select * from public.submit_completion_confirmation(%L, 'confirmed', 'Livrables reçus et vérifiés.')$$, current_setting('skillmatch.phase07_match_id')),
  'the client records a completion decision'
);
select throws_ok(
  format(
    $$insert into public.completion_confirmations (match_id, mission_id, participant_id, decision) values (%L, 'd1000000-0000-0000-0000-000000000002', auth.uid(), 'confirmed')$$,
    current_setting('skillmatch.phase07_match_id')
  ),
  '42501', null, 'the client cannot bypass the completion RPC with a direct insert'
);
select throws_ok(
  format($$select * from public.complete_match(%L, 3, 4)$$, current_setting('skillmatch.phase07_match_id')),
  '23514', null, 'one completion confirmation is not enough'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.submit_completion_confirmation(%L, 'confirmed', 'Mission terminée et livrée.')$$, current_setting('skillmatch.phase07_match_id')),
  'the talent records the second completion decision'
);
reset role;
select is(
  (select count(*) from public.completion_confirmations where match_id = current_setting('skillmatch.phase07_match_id')::uuid and decision = 'confirmed'),
  2::bigint,
  'two distinct participant completion decisions are persisted'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.complete_match(%L, 3, 4)$$, current_setting('skillmatch.phase07_match_id')),
  'a participant atomically closes a fully confirmed mission'
);
reset role;
select ok(
  exists (
    select 1 from public.matches mt
    join public.missions ms on ms.id = mt.mission_id
    join public.agreements a on a.match_id = mt.id
    where mt.id = current_setting('skillmatch.phase07_match_id')::uuid
      and mt.status = 'completed' and ms.status = 'completed' and a.status = 'completed'
      and mt.completed_at is not null
  ),
  'completion closes match, mission and agreement coherently'
);
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select lives_ok(
  format($$select * from public.complete_match(%L, 3, 4)$$, current_setting('skillmatch.phase07_match_id')),
  'a repeated completion call is idempotent'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  format($$select * from public.cancel_match_mission(%L, 4, 'Cette mission terminée ne doit pas être annulée.')$$, current_setting('skillmatch.phase07_match_id')),
  '23514', null, 'a completed mission cannot be cancelled'
);
reset role;
select throws_ok(
  $$update public.missions set status = 'published' where id = 'd1000000-0000-0000-0000-000000000002'$$,
  '23514', null, 'a completed mission cannot return to a discoverable state'
);
select ok(
  not exists (
    select required.event_type
    from unnest(array[
      'talent_assigned', 'agreement_updated', 'work_started', 'progress_updated',
      'delivery_submitted', 'completion_confirmed', 'mission_completed'
    ]::public.mission_event_type[]) required(event_type)
    where not exists (
      select 1 from public.mission_events me
      where me.mission_id = 'd1000000-0000-0000-0000-000000000002'
        and me.event_type = required.event_type
    )
  ),
  'the persisted timeline contains every real lifecycle stage reached'
);
select is(
  public.get_match_workspace(current_setting('skillmatch.phase07_match_id')::uuid) #>> '{match,status}',
  'completed',
  'the reloaded workspace reports the real completed state'
);
select is(
  jsonb_array_length(public.get_match_workspace(current_setting('skillmatch.phase07_match_id')::uuid) -> 'events'),
  (select count(*)::integer from public.mission_events where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  'workspace timeline length is derived only from persisted mission events'
);

insert into public.applications (
  id, mission_id, applicant_id, message, proposed_amount, availability_note, status
)
values (
  'f7000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'Candidature de test pour vérifier une annulation réellement auditée.',
  100,
  'Disponible pour cette mission locale.',
  'shortlisted'
);
update public.missions
set status = 'selecting'
where id = 'd1000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  format(
    $$select * from public.accept_application('f7000000-0000-0000-0000-000000000001', %s, 1)$$,
    (select lock_version from public.missions where id = 'd1000000-0000-0000-0000-000000000001')
  ),
  'a second fixture is accepted for the cancellation path'
);
reset role;
select set_config(
  'skillmatch.phase07_cancel_match_id',
  (select id::text from public.matches where mission_id = 'd1000000-0000-0000-0000-000000000001'),
  true
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  format(
    $$select * from public.cancel_match_mission(%L, %s, 'court')$$,
    current_setting('skillmatch.phase07_cancel_match_id'),
    (select lock_version from public.missions where id = 'd1000000-0000-0000-0000-000000000001')
  ),
  '22023', null, 'an assigned mission cancellation requires a meaningful reason'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  format(
    $$select * from public.cancel_match_mission(%L, %s, 'Le talent ne peut pas annuler unilatéralement cette mission.')$$,
    current_setting('skillmatch.phase07_cancel_match_id'),
    (select lock_version from public.missions where id = 'd1000000-0000-0000-0000-000000000001')
  ),
  '42501', null, 'the talent cannot perform the owner cancellation action'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  format(
    $$select * from public.cancel_match_mission(%L, %s, 'Le besoin a été retiré ; le motif est conservé dans le suivi partagé.')$$,
    current_setting('skillmatch.phase07_cancel_match_id'),
    (select lock_version from public.missions where id = 'd1000000-0000-0000-0000-000000000001')
  ),
  'the client cancels with a participant-visible audit reason'
);
reset role;
select ok(
  exists (
    select 1 from public.matches mt
    join public.missions ms on ms.id = mt.mission_id
    where mt.id = current_setting('skillmatch.phase07_cancel_match_id')::uuid
      and mt.status = 'cancelled' and ms.status = 'cancelled'
      and mt.cancelled_at is not null
  ),
  'cancellation closes the match and mission together'
);
select is(
  (
    select metadata ->> 'reason' from public.mission_events
    where mission_id = 'd1000000-0000-0000-0000-000000000001'
      and event_type = 'mission_cancelled'
    order by id desc limit 1
  ),
  'Le besoin a été retiré ; le motif est conservé dans le suivi partagé.',
  'the cancellation reason is persisted in the append-only timeline'
);
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  format(
    $$select * from public.confirm_agreement((select id from public.agreements where match_id = %L), 1)$$,
    current_setting('skillmatch.phase07_cancel_match_id')
  ),
  '23514', null, 'agreement confirmation closes after cancellation'
);
reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  format($$select public.get_match_workspace(%L)$$, current_setting('skillmatch.phase07_cancel_match_id')),
  '42501', null, 'a third party cannot read a cancelled participant workspace'
);
reset role;

select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and lower(p.proname) ~ '(wallet|payment|payout|invoice|bank|escrow|ledger|transaction)'
  ),
  'phase 07 introduces no financial workflow function'
);
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.proname in (
        'accept_application', 'confirm_agreement', 'start_match',
        'add_mission_progress', 'submit_completion_confirmation',
        'complete_match', 'cancel_match_mission', 'list_match_workspaces',
        'get_match_workspace', 'ensure_initial_agreement'
      )
      and not ('search_path=""' = any(coalesce(p.proconfig, array[]::text[])))
  ),
  'every phase 07 security-definer function fixes an empty search_path'
);

select * from finish();
rollback;
