begin;

create extension if not exists pgtap with schema extensions;

select plan(67);

-- Dedicated transactional fixtures; the outer rollback leaves the local seed
-- unchanged after the suite.
insert into public.missions (
  id, owner_id, title, description, category, work_mode,
  budget_model, budget_min, budget_max, application_deadline,
  starts_on, ends_on, deliverables, status
)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — sélection transactionnelle',
    'Fixture de sécurité suffisamment longue pour tester une acceptation transactionnelle.',
    'Numérique',
    'remote',
    'fixed',
    100,
    200,
    current_date + 7,
    current_date + 14,
    current_date + 21,
    '["Livrable de sécurité"]'::jsonb,
    'selecting'
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — sélection ensuite bloquée',
    'Fixture de sécurité suffisamment longue pour tester le refus d’un match après blocage.',
    'Numérique',
    'remote',
    'fixed',
    100,
    200,
    current_date + 7,
    current_date + 14,
    current_date + 21,
    '["Livrable de sécurité"]'::jsonb,
    'selecting'
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — brouillon privé',
    'Fixture de sécurité suffisamment longue pour tester la confidentialité des brouillons.',
    'Services',
    'remote',
    'fixed',
    50,
    80,
    current_date + 7,
    current_date + 14,
    current_date + 21,
    '["Livrable de sécurité"]'::jsonb,
    'draft'
  );

insert into public.mission_skills (
  mission_id, skill_id, required_level, importance
)
select
  'e1000000-0000-0000-0000-000000000003',
  s.id,
  'beginner',
  3
from public.skills s
where s.slug = 'support-evenementiel';

insert into public.applications (
  id, mission_id, applicant_id, message, availability_note, status
)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'Candidature de sécurité présélectionnée pour le premier scénario.',
    'Disponible immédiatement pour cette fixture.',
    'shortlisted'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    'Candidature concurrente présélectionnée pour vérifier sa clôture.',
    'Disponible immédiatement pour cette fixture.',
    'shortlisted'
  ),
  (
    'e2000000-0000-0000-0000-000000000003',
    'e1000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'Candidature présélectionnée qui ne doit pas produire de match après blocage.',
    'Disponible immédiatement pour cette fixture.',
    'shortlisted'
  );

set local role anon;
select is(
  (select count(*) from public.get_public_profiles('d0000000-0000-0000-0000-000000000002')),
  1::bigint,
  'anonymous visitors can read the allow-listed public profile projection'
);
select throws_ok(
  $$select adult_confirmed from public.profiles where id = 'd0000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'anonymous visitors cannot read private profile columns from the base table'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select count(*) from public.profiles where id = auth.uid()),
  1::bigint,
  'an authenticated owner reads the complete own profile'
);
update public.profiles
set display_name = 'Tentative interdite'
where id = 'd0000000-0000-0000-0000-000000000002';
reset role;
select is(
  (select display_name from public.profiles where id = 'd0000000-0000-0000-0000-000000000002'),
  'Démonstration — Tania Talent',
  'profile A cannot modify profile B'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$insert into public.skills (slug, name, category) values ('test-interdit', 'Test interdit', 'Tests')$$,
  '42501',
  null,
  'a normal user cannot modify the skill taxonomy'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select lives_ok(
  $$insert into public.skills (slug, name, category) values ('test-moderation', 'Test modération', 'Tests')$$,
  'a server-granted moderator can modify the skill taxonomy'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select count(*) from public.applications where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  0::bigint,
  'an authenticated third party cannot see applications'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (select count(*) from public.applications where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  2::bigint,
  'the mission owner sees received applications'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (select count(*) from public.applications where mission_id = 'd1000000-0000-0000-0000-000000000002'),
  1::bigint,
  'an applicant sees only the own application on another owner mission'
);
select is(
  (select count(*) from public.missions where id = 'e1000000-0000-0000-0000-000000000003'),
  0::bigint,
  'a draft is invisible to another authenticated user'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select count(*) from public.missions where id = 'e1000000-0000-0000-0000-000000000003'),
  1::bigint,
  'a mission owner reads the own draft'
);
select throws_ok(
  $$update public.missions set status = 'published' where id = 'e1000000-0000-0000-0000-000000000003'$$,
  '42501',
  null,
  'mission status cannot be written directly even by its owner'
);
select lives_ok(
  $$select * from public.transition_mission('e1000000-0000-0000-0000-000000000003', 1, 'published')$$,
  'the authorized mission transition RPC publishes the owner draft'
);
select lives_ok(
  $$select * from public.accept_application('e2000000-0000-0000-0000-000000000001', 1, 1)$$,
  'the mission owner can atomically accept one shortlisted application'
);
reset role;

select is(
  (select status from public.applications where id = 'e2000000-0000-0000-0000-000000000001'),
  'accepted'::public.application_status,
  'the selected application is accepted'
);
select is(
  (select status from public.applications where id = 'e2000000-0000-0000-0000-000000000002'),
  'rejected'::public.application_status,
  'the competing application is closed explicitly'
);
select is(
  (select status from public.missions where id = 'e1000000-0000-0000-0000-000000000001'),
  'assigned'::public.mission_status,
  'acceptance assigns the mission'
);
select is(
  (select count(*) from public.matches where mission_id = 'e1000000-0000-0000-0000-000000000001'),
  1::bigint,
  'acceptance creates exactly one match'
);
select is(
  (
    select count(*)
    from public.conversations c
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'acceptance creates exactly one conversation'
);
select is(
  (
    select count(*)
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
  ),
  2::bigint,
  'acceptance creates exactly the two conversation members'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select * from public.accept_application('e2000000-0000-0000-0000-000000000001', 1, 1)$$,
  'retrying the same acceptance is idempotent despite stale initial versions'
);
reset role;
select is(
  (select count(*) from public.matches where mission_id = 'e1000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an idempotent retry does not duplicate the match'
);

select set_config(
  'skillmatch.test_conversation_id',
  (
    select c.id::text
    from public.conversations c
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
  ),
  true
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (
    select count(*)
    from public.conversations c
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'the client participant reads the conversation'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (
    select count(*)
    from public.conversations c
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'the talent participant reads the conversation'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (
    select count(*)
    from public.conversations c
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'an authenticated third party cannot read the conversation'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select * from public.send_message(
      current_setting('skillmatch.test_conversation_id')::uuid,
      'f8000000-0000-0000-0000-000000000001'::uuid,
      'Message autorisé du membre client.'
    )$$,
  'a conversation member can write through the controlled RPC while the match is active'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$insert into public.messages (conversation_id, author_id, body)
    values (
      current_setting('skillmatch.test_conversation_id')::uuid,
      auth.uid(),
      'Message interdit du tiers.'
    )$$,
  '42501',
  null,
  'a third party cannot write in the conversation'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$insert into public.reviews (match_id, mission_id, author_id, recipient_id, rating)
    select mt.id, mt.mission_id, auth.uid(), mt.talent_id, 5
    from public.matches mt
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'a participant cannot bypass the controlled review RPC before mission completion'
);
reset role;

select set_config(
  'skillmatch.test_agreement_id',
  (
    select a.id::text
    from public.agreements a
    join public.matches mt on mt.id = a.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
    order by a.version desc
    limit 1
  ),
  true
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  format(
    $$select * from public.confirm_agreement(%L, 1)$$,
    current_setting('skillmatch.test_agreement_id')
  ),
  'the client can record the first agreement confirmation'
);
reset role;
select is(
  (
    select status from public.agreements
    where id = current_setting('skillmatch.test_agreement_id')::uuid
  ),
  'client_confirmed'::public.agreement_status,
  'the first confirmation remains distinct'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  format(
    $$select * from public.confirm_agreement(%L, 1)$$,
    current_setting('skillmatch.test_agreement_id')
  ),
  'retrying the same participant confirmation is idempotent'
);
reset role;
select is(
  (
    select count(*)
    from public.mission_events
    where event_type = 'agreement_updated'
      and metadata ->> 'agreement_id' = current_setting('skillmatch.test_agreement_id')
      and metadata ->> 'action' = 'agreement_confirmed'
  ),
  1::bigint,
  'an idempotent confirmation retry does not duplicate the audit event'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select lives_ok(
  format(
    $$select * from public.confirm_agreement(%L, 2)$$,
    current_setting('skillmatch.test_agreement_id')
  ),
  'the talent can record the second distinct confirmation'
);
reset role;
select is(
  (
    select status from public.agreements
    where id = current_setting('skillmatch.test_agreement_id')::uuid
  ),
  'confirmed'::public.agreement_status,
  'two distinct participant confirmations atomically confirm the agreement'
);
select is(
  (
    select count(*)
    from public.mission_events
    where event_type = 'agreement_updated'
      and metadata ->> 'agreement_id' = current_setting('skillmatch.test_agreement_id')
      and metadata ->> 'action' = 'agreement_confirmed'
  ),
  2::bigint,
  'both distinct agreement confirmations are auditable'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('avatars', 'd0000000-0000-0000-0000-000000000002/avatar.png')$$,
  'an authenticated user can write an avatar below the own path'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('avatars', 'd0000000-0000-0000-0000-000000000003/avatar.png')$$,
  '42501',
  null,
  'an authenticated user cannot write another profile avatar path'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values (
      'message-attachments',
      current_setting('skillmatch.test_conversation_id')
        || '/d0000000-0000-0000-0000-000000000002/note.txt'
    )$$,
  'a conversation member can write below the private conversation and own path'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values (
      'message-attachments',
      current_setting('skillmatch.test_conversation_id')
        || '/d0000000-0000-0000-0000-000000000003/note.txt'
    )$$,
  '42501',
  null,
  'a conversation outsider cannot write a private attachment'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.submit_report(
      'mission', 'd1000000-0000-0000-0000-000000000002', 'spam',
      'Description de signalement de sécurité suffisamment longue.', true
    )$$,
  'a reporter can create an authorized report through the controlled RPC'
);
select is(
  (select count(*) from public.reports where reporter_id = auth.uid()),
  1::bigint,
  'a reporter reads the own report'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (select count(*) from public.reports),
  0::bigint,
  'a normal third party cannot read another user report'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is(
  (select count(*) from public.reports),
  1::bigint,
  'a server-granted moderator can read submitted reports'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select lives_ok(
  $$update public.notifications set read_at = statement_timestamp() where recipient_id = auth.uid()$$,
  'a notification recipient can mark the own notifications as read'
);
update public.notifications
set read_at = statement_timestamp()
where recipient_id = 'd0000000-0000-0000-0000-000000000003';
reset role;
select is(
  (
    select count(*)
    from public.notifications
    where recipient_id = 'd0000000-0000-0000-0000-000000000003'
      and read_at is not null
  ),
  0::bigint,
  'a recipient cannot mark another user notification as read'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.set_profile_block(
      'd0000000-0000-0000-0000-000000000002', true
    )$$,
  'a user can block another user through the controlled RPC'
);
select throws_ok(
  $$insert into public.messages (conversation_id, author_id, body)
    select c.id, auth.uid(), 'Message interdit après blocage.'
    from public.conversations c
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'a block prevents a new message in an existing interaction'
);
select is(
  (
    select count(*)
    from public.messages msg
    join public.conversations c on c.id = msg.conversation_id
    join public.matches mt on mt.id = c.match_id
    where mt.mission_id = 'e1000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'existing conversation history remains readable after a block'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$insert into public.applications (mission_id, applicant_id, message, availability_note)
    values (
      'd1000000-0000-0000-0000-000000000001',
      auth.uid(),
      'Nouvelle candidature interdite après le blocage des deux participants.',
      'Disponible pour la fixture de blocage.'
    )$$,
  '42501',
  null,
  'a block prevents a new application'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.set_profile_block(
      'd0000000-0000-0000-0000-000000000003', true
    )$$,
  'the match fixture participants can be blocked through the controlled RPC before acceptance'
);
select throws_ok(
  $$select * from public.accept_application('e2000000-0000-0000-0000-000000000003', 1, 1)$$,
  '42501',
  null,
  'a block prevents the controlled match creation path'
);
reset role;
select is(
  (select count(*) from public.matches where mission_id = 'e1000000-0000-0000-0000-000000000002'),
  0::bigint,
  'a blocked acceptance leaves no partial match'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$insert into public.user_roles (user_id, role, granted_by) values (auth.uid(), 'admin', null)$$,
  '42501',
  null,
  'a normal user cannot self-assign a sensitive role'
);
select is(
  (select count(*) from public.user_roles),
  0::bigint,
  'a normal user cannot inspect another user moderator grant'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is(
  (select count(*) from public.user_roles where role = 'moderator'),
  1::bigint,
  'a server-granted moderator can inspect sensitive grants'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select ok(
  exists (
    select 1
    from public.get_application_counts()
    where mission_id = 'd1000000-0000-0000-0000-000000000002'
      and total_count = 2
  ),
  'application counts are derived from current rows for their mission owner'
);
select is(
  (select count(*) from public.get_unread_counts()),
  1::bigint,
  'the unread counter RPC returns one aggregate row'
);
select is(
  (select count(*) from public.get_dashboard_stats()),
  1::bigint,
  'the dashboard statistics RPC returns one real aggregate row'
);
reset role;

set local role anon;
select is(
  (
    select reputation_score
    from public.get_reputation('d0000000-0000-0000-0000-000000000002')
  ),
  100.00::numeric,
  'reputation is derived from the completed seeded review and normalized to 100'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select ok(
  (public.get_weekly_ranking(10) ->> 'formulaVersion') = 'weekly-completions-v2'
  and (public.get_weekly_ranking(10) ->> 'sampleCompletedMissions')::bigint >= 1
  and not (public.get_weekly_ranking(10) ->> 'sufficientData')::boolean,
  'weekly activity counts the recorded completion but suppresses ranking below the real sample threshold'
);
reset role;

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  ),
  'every exposed application table has RLS enabled'
);

select ok(
  not exists (
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1
        from pg_policies p
        where p.schemaname = n.nspname
          and p.tablename = c.relname
      )
  ),
  'no public application table is left without an explicit policy'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name = 'user_roles'
      and g.grantee in ('anon', 'authenticated')
      and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'no API user receives a direct sensitive-role write grant'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.grantee = 'anon'
      and g.table_name not in (
        'skills', 'reviews', 'profile_skills', 'availability_slots'
      )
  ),
  'anonymous grants are limited to explicitly public profile resources'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'avatars_%'
       or schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'message_attachments_%'
  ),
  8::bigint,
  'both Storage buckets have explicit path-scoped policies'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'accept_application', 'transition_application', 'transition_mission',
        'confirm_agreement', 'transition_agreement', 'get_public_profiles',
        'get_application_counts', 'get_unread_counts', 'get_dashboard_stats',
        'get_reputation', 'get_weekly_ranking'
      )
      and not ('search_path=""' = any (coalesce(p.proconfig, array[]::text[])))
  ),
  'every exposed security-definer RPC fixes an empty search_path'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and lower(p.proname) ~ '(wallet|payment|payout|invoice|bank|escrow|ledger|transaction)'
  ),
  'no function introduces a forbidden financial workflow'
);

select * from finish();
rollback;
