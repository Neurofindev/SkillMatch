begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'client@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'talent@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'other@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'extra@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now());

insert into public.profiles (
  id, username, display_name, primary_mode, can_work, can_hire,
  adult_confirmed, onboarding_completed
)
values
  ('00000000-0000-0000-0000-000000000001', 'client-test', 'Client Test', 'client', false, true, true, true),
  ('00000000-0000-0000-0000-000000000002', 'talent-test', 'Talent Test', 'talent', true, false, true, true),
  ('00000000-0000-0000-0000-000000000003', 'other-test', 'Autre Talent', 'talent', true, false, true, true),
  ('00000000-0000-0000-0000-000000000004', 'extra-test', 'Profil Extra', 'talent', true, false, true, true);

insert into public.missions (
  id, owner_id, title, description, category, work_mode,
  budget_model, budget_min, budget_max, status
)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Mission de test valide',
  'Description suffisamment longue pour valider la mission de test.',
  'Développement',
  'remote',
  'fixed',
  100,
  200,
  'published'
);

select throws_ok(
  $$update public.profiles set username = 'CLIENT-TEST' where id = '00000000-0000-0000-0000-000000000002'$$,
  '23505',
  null,
  'usernames are unique without case sensitivity'
);

select throws_ok(
  $$update public.missions set status = 'unknown' where id = '10000000-0000-0000-0000-000000000001'$$,
  '22P02',
  null,
  'invalid mission states are rejected by the enum'
);

select throws_ok(
  $$update public.missions set budget_min = -1 where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'negative mission budget is rejected'
);

select throws_ok(
  $$update public.missions set budget_min = 300, budget_max = 200 where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'reversed mission budget range is rejected'
);

select throws_ok(
  $$update public.missions set starts_on = '2026-09-02', ends_on = '2026-09-01' where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'incoherent mission dates are rejected'
);

select throws_ok(
  $$update public.missions set work_mode = 'local' where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'local missions require an approximate public zone'
);

select throws_ok(
  $$insert into public.applications (mission_id, applicant_id, message, availability_note) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Message de candidature suffisamment long.', 'Disponible immédiatement')$$,
  '23514',
  null,
  'mission owners cannot apply to their own mission'
);

select lives_ok(
  $$insert into public.applications (id, mission_id, applicant_id, message, availability_note) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Message de candidature suffisamment long.', 'Disponible la semaine prochaine')$$,
  'a valid first application is accepted'
);

select throws_ok(
  $$insert into public.applications (mission_id, applicant_id, message, availability_note) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Une seconde candidature active est interdite.', 'Toujours disponible')$$,
  '23505',
  null,
  'a talent cannot have two active applications for one mission'
);

select throws_ok(
  $$update public.applications set status = 'accepted' where id = '20000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'application states cannot skip required steps'
);

select lives_ok(
  $$update public.applications set status = 'viewed' where id = '20000000-0000-0000-0000-000000000001'$$,
  'submitted application can become viewed'
);
select lives_ok(
  $$update public.applications set status = 'shortlisted' where id = '20000000-0000-0000-0000-000000000001'$$,
  'viewed application can become shortlisted'
);
select lives_ok(
  $$update public.applications set status = 'accepted' where id = '20000000-0000-0000-0000-000000000001'$$,
  'shortlisted application can become accepted'
);

insert into public.applications (
  id, mission_id, applicant_id, message, availability_note
)
values (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'Deuxième candidature valide pour tester la concurrence.',
  'Disponible prochainement'
);
update public.applications set status = 'viewed' where id = '20000000-0000-0000-0000-000000000002';
update public.applications set status = 'shortlisted' where id = '20000000-0000-0000-0000-000000000002';
update public.applications set status = 'accepted' where id = '20000000-0000-0000-0000-000000000002';

select lives_ok(
  $$insert into public.matches (id, mission_id, accepted_application_id, client_id, talent_id) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$$,
  'a coherent match is accepted'
);

select throws_ok(
  $$insert into public.matches (mission_id, accepted_application_id, client_id, talent_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')$$,
  '23505',
  null,
  'a mission cannot have two active matches'
);

update public.missions set status = 'assigned', assigned_talent_id = '00000000-0000-0000-0000-000000000002' where id = '10000000-0000-0000-0000-000000000001';
select set_config('skillmatch.phase07_action', 'start', true);
update public.missions set status = 'in_progress' where id = '10000000-0000-0000-0000-000000000001';
select set_config('skillmatch.phase07_action', 'complete', true);
update public.missions set status = 'completed' where id = '10000000-0000-0000-0000-000000000001';
select set_config('skillmatch.phase07_action', '', true);
update public.matches set status = 'completed', completed_at = now() where id = '30000000-0000-0000-0000-000000000001';

select throws_ok(
  $$insert into public.reviews (match_id, mission_id, author_id, recipient_id, rating) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 6)$$,
  '23514',
  null,
  'review ratings outside one to five are rejected'
);

select throws_ok(
  $$insert into public.reviews (match_id, mission_id, author_id, recipient_id, rating) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 5)$$,
  '23514',
  null,
  'self reviews are rejected'
);

select throws_ok(
  $$insert into public.reviews (match_id, mission_id, author_id, recipient_id, rating) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 5)$$,
  '23514',
  null,
  'review authors must be match participants'
);

select lives_ok(
  $$insert into public.reviews (id, match_id, mission_id, author_id, recipient_id, rating, comment) values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 5, 'Collaboration claire et professionnelle.')$$,
  'a completed match participant can leave a review'
);

select throws_ok(
  $$insert into public.reviews (match_id, mission_id, author_id, recipient_id, rating) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 4)$$,
  '23505',
  null,
  'a review direction is unique for a mission'
);

select throws_ok(
  $$insert into public.reviews (match_id, mission_id, author_id, recipient_id, rating) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 4)$$,
  '23503',
  null,
  'incoherent match and mission references are rejected'
);

select throws_ok(
  $$insert into public.agreements (match_id, mission_id, version, created_by, scope_snapshot, budget_model, budget_min, budget_max) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000001', 'Périmètre de mission suffisamment détaillé pour le test.', 'fixed', 300, 200)$$,
  '23514',
  null,
  'invalid agreement budget range is rejected'
);

select throws_ok(
  $$insert into public.agreements (match_id, mission_id, version, created_by, scope_snapshot, budget_model, status) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000001', 'Périmètre de mission suffisamment détaillé pour le test.', 'fixed', 'confirmed')$$,
  '23514',
  null,
  'confirmed agreement requires both confirmation timestamps'
);

insert into public.agreements (
  id, match_id, mission_id, version, created_by, scope_snapshot, budget_model
)
values (
  '50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  1,
  '00000000-0000-0000-0000-000000000001',
  'Périmètre de mission suffisamment détaillé pour le test.',
  'fixed'
);

select throws_ok(
  $$update public.agreements set status = 'active', client_confirmed_at = now(), talent_confirmed_at = now() where id = '50000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'agreement states cannot skip confirmations'
);

select throws_ok(
  $$update public.missions set status = 'published' where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'completed missions cannot return to published'
);

select throws_ok(
  $$update public.applications set status = 'withdrawn' where id = '20000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'accepted applications cannot be withdrawn'
);

select throws_ok(
  $$insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'profiles cannot block themselves'
);

select throws_ok(
  $$insert into public.notifications (recipient_id, type, title, body, internal_path) values ('00000000-0000-0000-0000-000000000001', 'match_created', 'Nouveau match', 'Une nouvelle mise en relation est disponible.', 'https://example.test')$$,
  '23514',
  null,
  'notification links must be internal paths'
);

select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_mission_id, reason) values ('00000000-0000-0000-0000-000000000001', 'profile', '10000000-0000-0000-0000-000000000001', 'spam')$$,
  '23514',
  null,
  'report target type must match its reference'
);

insert into public.conversations (id, match_id, mission_id)
values (
  '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

select throws_ok(
  $$insert into public.messages (conversation_id, author_id, body) values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '')$$,
  '23514',
  null,
  'empty message bodies are rejected'
);

select throws_ok(
  $$insert into public.conversation_members (conversation_id, profile_id) values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')$$,
  '23514',
  null,
  'conversation members must belong to the match'
);

select throws_ok(
  $$insert into public.completion_confirmations (match_id, mission_id, participant_id, decision) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'confirmed')$$,
  '23514',
  null,
  'completion confirmations require a match participant'
);

insert into public.mission_events (
  id, mission_id, actor_id, event_type, metadata
)
overriding system value
values (
  900001,
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'mission_completed',
  '{}'::jsonb
);

select throws_ok(
  $$update public.mission_events set metadata = '{"changed":true}' where id = 900001$$,
  '55000',
  null,
  'mission events cannot be updated'
);

select throws_ok(
  $$delete from public.mission_events where id = 900001$$,
  '55000',
  null,
  'mission events cannot be deleted'
);

select throws_ok(
  $$insert into public.mission_private_locations (mission_id, latitude) values ('10000000-0000-0000-0000-000000000001', 45.000001)$$,
  '23514',
  null,
  'exact coordinates must be stored as a complete private pair'
);

select * from finish();
rollback;
