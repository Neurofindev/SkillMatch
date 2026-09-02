begin;

select no_plan();

select has_table('public', 'moderation_actions', 'moderation actions are auditable');
select has_table('public', 'account_action_requests', 'account action requests are persisted');
select has_column('profiles', 'suspended_at');
select has_column('missions', 'moderation_hidden_at');
select has_column('reports', 'lock_version');
select has_function(
  'public', 'submit_report',
  array['report_target_type', 'uuid', 'report_reason', 'text', 'boolean']
);
select has_function('public', 'set_profile_block', array['uuid', 'boolean']);
select has_function(
  'public', 'moderate_report', array['uuid', 'text', 'text', 'integer']
);
select has_function('public', 'get_account_export', array[]::text[]);
select has_function('public', 'request_account_deletion', array['text', 'text']);

select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_report(report_target_type,uuid,report_reason,text,boolean)',
    'EXECUTE'
  ),
  'authenticated users can call the controlled reporting function'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_report(report_target_type,uuid,report_reason,text,boolean)',
    'EXECUTE'
  ),
  'anonymous users cannot submit reports'
);
select ok(
  not has_table_privilege('authenticated', 'public.reports', 'INSERT'),
  'reports cannot bypass target authorization and throttling with direct inserts'
);
select ok(
  not has_table_privilege('authenticated', 'public.reports', 'UPDATE'),
  'report state cannot be changed directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.blocks', 'INSERT'),
  'blocks cannot bypass the controlled RPC with direct inserts'
);
select ok(
  not has_table_privilege('authenticated', 'public.moderation_actions', 'INSERT'),
  'moderation audit entries are append-only through controlled RPCs'
);

create temporary table phase10_ids (
  key text primary key,
  value uuid not null
) on commit drop;
grant select, insert on phase10_ids to authenticated;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select is(public.get_moderation_access(), false, 'a normal user has no moderator access');
select throws_ok(
  $$select * from public.list_moderation_reports(null, 1, 20)$$,
  '42501', null,
  'a normal user cannot open the moderation queue'
);
select throws_ok(
  $$insert into public.user_roles (user_id, role, granted_by)
    values (auth.uid(), 'moderator', auth.uid())$$,
  '42501', null,
  'a user cannot self-assign a sensitive role'
);
select throws_ok(
  $$select public.submit_report(
      'mission', 'd1000000-0000-0000-0000-000000000001', 'spam',
      'Description confirmée mais indicateur de confirmation absent.', false
    )$$,
  '23514', null,
  'a report requires explicit confirmation'
);

insert into phase10_ids (key, value)
select 'mission_report', public.submit_report(
  'mission',
  'd1000000-0000-0000-0000-000000000001',
  'fraud',
  'Cette mission semble demander une action frauduleuse et doit être vérifiée.',
  true
);
select ok(
  (select value is not null from phase10_ids where key = 'mission_report'),
  'a real mission report is persisted'
);
select throws_ok(
  $$select public.submit_report(
      'mission', 'd1000000-0000-0000-0000-000000000001', 'fraud',
      'Deuxième signalement identique encore ouvert et volontairement refusé.', true
    )$$,
  '23505', null,
  'obvious duplicate reports are refused'
);

insert into phase10_ids (key, value)
select 'message_report', public.submit_report(
  'message',
  (
    select msg.id from public.messages msg
    where msg.conversation_id = 'd4000000-0000-0000-0000-000000000001'
      and msg.author_id = 'd0000000-0000-0000-0000-000000000001'
    order by msg.created_at limit 1
  ),
  'harassment',
  'Ce message reçu dans ma conversation contient un comportement à examiner.',
  true
);
select ok(
  (select value is not null from phase10_ids where key = 'message_report'),
  'a conversation member can report a received message'
);

insert into phase10_ids (key, value)
select 'profile_report', public.submit_report(
  'profile',
  'd0000000-0000-0000-0000-000000000003',
  'abuse',
  'Ce profil public présente un comportement abusif qui nécessite un examen.',
  true
);

select is(
  public.set_profile_block('d0000000-0000-0000-0000-000000000001', true),
  true,
  'a user can block a relevant public profile through the controlled RPC'
);
select is(
  (select count(*) from public.list_blocked_profiles()
   where profile_id = 'd0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'the block is persisted and listed only for its owner'
);
select is(
  (select count(*) from public.search_missions(
    null, null, '{}'::public.work_mode[], null, '{}'::bigint[],
    '{}'::public.skill_level[], null, null, null, null,
    'newest', 1, 24, false, null
  ) where owner_id = 'd0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'blocking removes the blocked owner missions from discovery'
);
select throws_ok(
  $$select * from public.submit_application(
      'd1000000-0000-0000-0000-000000000001',
      'Cette candidature devrait être refusée car les comptes sont bloqués.',
      'Disponible selon les dates publiées.', true, null
    )$$,
  '42501', null,
  'blocking prevents a new application at the database boundary'
);
select is(
  (select count(*) from public.list_messages(
    'd4000000-0000-0000-0000-000000000001', null, null, 30
  )),
  2::bigint,
  'existing conversation history remains readable after a block'
);
select is(
  public.set_profile_block('d0000000-0000-0000-0000-000000000001', false),
  false,
  'the blocker can reverse their own block'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (select count(*) from public.reports),
  0::bigint,
  'a third party cannot read reports submitted by somebody else'
);
select throws_ok(
  $$select public.submit_report(
      'message',
      (select msg.id from public.messages msg
       where msg.conversation_id = 'd4000000-0000-0000-0000-000000000001'
       order by msg.created_at limit 1),
      'spam', 'Je tente de signaler un message que je ne peux pas consulter.', true
    )$$,
  '22023', null,
  'a third party private-message lookup yields no usable report target'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is(public.get_moderation_access(), true, 'the local seeded moderator has server-verified access');
select throws_ok(
  $$update public.reports
    set status = 'triaged'
    where id = (select value from phase10_ids where key = 'mission_report')$$,
  '42501', null,
  'even a moderator cannot bypass the audited moderation RPC with a direct update'
);
select is(
  (select count(*) from public.list_moderation_reports(null, 1, 20)),
  3::bigint,
  'the moderator queue exposes the three real reports to the moderator only'
);
select ok(
  not (public.get_moderation_report(
    (select value from phase10_ids where key = 'mission_report')
  )::text ~* '(email|exact_address|latitude|longitude)'),
  'moderation detail omits Auth data and exact location fields'
);
select lives_ok(
  $$select * from public.moderate_report(
      (select value from phase10_ids where key = 'mission_report'),
      'triage', 'Signalement recevable, vérification du contenu en cours.', 1
    )$$,
  'a moderator can triage a report through the versioned RPC'
);
select is(
  (select lock_version from public.reports
   where id = (select value from phase10_ids where key = 'mission_report')),
  2,
  'triage advances the report version'
);
select lives_ok(
  $$select * from public.moderate_report(
      (select value from phase10_ids where key = 'mission_report'),
      'hide_mission', 'Le contenu enfreint les règles de communauté relatives à la fraude.', 2
    )$$,
  'a moderator can hide the reported mission atomically'
);
select ok(
  (select moderation_hidden_at is not null
   from public.missions where id = 'd1000000-0000-0000-0000-000000000001'),
  'the moderation action really hides the mission'
);
select is(
  (select count(*) from public.moderation_actions
   where report_id = (select value from phase10_ids where key = 'mission_report')),
  2::bigint,
  'triage and hide actions are both audited'
);
select lives_ok(
  $$select * from public.moderate_report(
      (select value from phase10_ids where key = 'profile_report'),
      'suspend_profile',
      'Suspension limitée au produit après examen du comportement abusif signalé.', 1
    )$$,
  'a moderator can suspend the author targeted by a report'
);
select ok(
  (select suspended_at is not null
   from public.profiles where id = 'd0000000-0000-0000-0000-000000000003'),
  'profile suspension is stored outside user-editable profile fields'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select count(*) from public.get_public_profiles(
    'd0000000-0000-0000-0000-000000000003'
  )),
  0::bigint,
  'a suspended profile is absent from the public projection'
);
select is(
  (select count(*) from public.search_missions(
    null, null, '{}'::public.work_mode[], null, '{}'::bigint[],
    '{}'::public.skill_level[], null, null, null, null,
    'newest', 1, 24, false, null
  ) where mission_id = 'd1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a hidden mission is absent from public discovery'
);
select ok(
  not (public.get_account_export()::text ~* '(email|encrypted_password|exact_address|latitude|longitude)'),
  'the account export excludes Auth internals and exact location data'
);
select throws_ok(
  $$select * from public.request_account_deletion('supprimer', null)$$,
  '23514', null,
  'account deletion requires the exact explicit confirmation'
);
select lives_ok(
  $$select * from public.request_account_deletion(
      'SUPPRIMER MON COMPTE', 'Je souhaite demander la suppression de mon compte de test.'
    )$$,
  'a confirmed account deletion request is persisted honestly'
);
select is(
  (select status from public.account_action_requests
   where profile_id = auth.uid()),
  'submitted',
  'the deletion request is clearly pending instead of claiming completion'
);
select ok(
  (select deleted_at is null from public.profiles where id = auth.uid()),
  'submitting a request does not falsely mark the account as deleted'
);
reset role;

insert into storage.objects (id, bucket_id, name, metadata)
values (
  'fa000000-0000-0000-0000-000000000010',
  'message-attachments',
  'd4000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001/private.txt',
  '{"mimetype":"text/plain","size":10}'::jsonb
);
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (select count(*) from storage.objects
   where id = 'fa000000-0000-0000-0000-000000000010'),
  0::bigint,
  'a third party cannot read a private conversation attachment object'
);
reset role;

select ok(
  not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name in ('wallet', 'balance', 'payment_status', 'transaction_id')
  ),
  'moderation does not introduce any financial control or wallet field'
);

select * from finish();
rollback;
