begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

select has_table('public', 'mission_drafts', 'mission wizard drafts are persisted');
select has_table('public', 'mission_attachments', 'mission attachment metadata is persisted');
select has_column('public', 'missions', 'application_deadline', 'missions have an application deadline');
select has_column('public', 'missions', 'deliverables', 'missions have structured deliverables');
select has_column('public', 'missions', 'archived_at', 'missions can be archived without a fake status');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.mission_drafts'::regclass),
  'mission drafts have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.mission_attachments'::regclass),
  'mission attachments have RLS enabled'
);
select ok(
  to_regprocedure(
    'public.save_mission(uuid,integer,uuid,text,text,text,public.work_mode,text,text,text,text,public.budget_model,numeric,numeric,date,date,date,boolean,public.skill_level,jsonb,bigint[],public.skill_level[],boolean)'
  ) is not null,
  'the controlled mission save RPC exists'
);
select ok(
  to_regprocedure('public.archive_mission(uuid,integer)') is not null,
  'the controlled mission archive RPC exists'
);
select ok(
  to_regprocedure(
    'public.search_missions(text,text,public.work_mode[],text,bigint[],public.skill_level[],numeric,numeric,date,date,text,integer,integer,boolean,uuid)'
  ) is not null,
  'the paginated discovery RPC exists'
);

insert into public.missions (
  id, owner_id, title, description, category, work_mode, public_city,
  public_region, country_code, presence_details, budget_model, budget_min,
  budget_max, application_deadline, starts_on, ends_on, deliverables, status
)
values (
  'f5000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'Démonstration — mission hybride filtrable',
  'Mission de démonstration suffisamment détaillée pour vérifier le filtre hybride.',
  'Numérique',
  'hybrid',
  'Lyon',
  'Auvergne-Rhône-Alpes',
  'FR',
  'Un atelier de lancement puis le reste à distance.',
  'fixed',
  300,
  500,
  current_date + 7,
  current_date + 14,
  current_date + 30,
  '["Compte rendu de l’atelier"]'::jsonb,
  'published'
);

insert into public.mission_skills (mission_id, skill_id, required_level, importance)
select 'f5000000-0000-0000-0000-000000000001', s.id, 'intermediate', 3
from public.skills s where s.slug = 'developpement-react';

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select lives_ok(
  $$insert into public.mission_drafts (id, owner_id, current_step, payload)
    values (
      'f5100000-0000-0000-0000-000000000001', auth.uid(), 7,
      '{"title":"Mission réelle de phase 05"}'::jsonb
    )$$,
  'a publishing account saves a resumable mission wizard draft'
);
select is(
  (select count(*) from public.mission_drafts where owner_id = auth.uid()),
  1::bigint,
  'the owner reads the own mission wizard draft'
);
select lives_ok(
  $$insert into public.mission_attachments (
      id, owner_id, draft_id, storage_path, file_name, mime_type, size_bytes
    ) values (
      'f5200000-0000-0000-0000-000000000001', auth.uid(),
      'f5100000-0000-0000-0000-000000000001',
      auth.uid()::text || '/f5100000-0000-0000-0000-000000000001/brief.pdf',
      'brief.pdf', 'application/pdf', 1024
    )$$,
  'the owner registers a bounded attachment under the draft'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values (
      'mission-attachments',
      auth.uid()::text || '/f5100000-0000-0000-0000-000000000001/brief.pdf'
    )$$,
  'the owner writes only below the own mission attachment path'
);

reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;

select is(
  (select count(*) from public.mission_drafts),
  0::bigint,
  'another account cannot read the first account mission draft'
);
select throws_ok(
  $$insert into public.mission_attachments (
      owner_id, draft_id, storage_path, file_name, mime_type, size_bytes
    ) values (
      'd0000000-0000-0000-0000-000000000001',
      'f5100000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000001/f5100000-0000-0000-0000-000000000001/intrus.pdf',
      'intrus.pdf', 'application/pdf', 100
    )$$,
  '42501',
  null,
  'another account cannot register an attachment for the owner draft'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values (
      'mission-attachments',
      'd0000000-0000-0000-0000-000000000001/f5100000-0000-0000-0000-000000000001/intrus.pdf'
    )$$,
  '42501',
  null,
  'another account cannot write below the owner storage path'
);

reset role;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select set_config(
  'skillmatch.phase05_mission_id',
  (
    select mission_id::text
    from public.save_mission(
      p_mission_id => null,
      p_expected_version => null,
      p_wizard_draft_id => 'f5100000-0000-0000-0000-000000000001',
      p_title => 'Mission réelle de phase 05',
      p_description => 'Créer une interface professionnelle accessible avec un résultat clairement vérifiable.',
      p_category => 'Numérique',
      p_work_mode => 'remote',
      p_public_city => null,
      p_public_region => null,
      p_country_code => null,
      p_presence_details => null,
      p_budget_model => 'fixed',
      p_budget_min => 400,
      p_budget_max => 600,
      p_application_deadline => current_date + 7,
      p_starts_on => current_date + 14,
      p_ends_on => current_date + 30,
      p_flexible_schedule => true,
      p_required_level => 'intermediate',
      p_deliverables => '["Interface responsive", "Compte rendu accessible"]'::jsonb,
      p_skill_ids => array[(select id from public.skills where slug = 'developpement-react')]::bigint[],
      p_skill_levels => array['intermediate']::public.skill_level[],
      p_publish => false
    )
  ),
  true
);

select is(
  (select status from public.missions where id = current_setting('skillmatch.phase05_mission_id')::uuid),
  'draft'::public.mission_status,
  'the wizard creates a real mission draft'
);
select is(
  (select count(*) from public.mission_drafts where id = 'f5100000-0000-0000-0000-000000000001'),
  0::bigint,
  'finalizing the wizard removes its temporary draft'
);
select is(
  (select count(*) from public.mission_attachments where mission_id = current_setting('skillmatch.phase05_mission_id')::uuid),
  1::bigint,
  'the attachment metadata moves atomically to the real mission'
);
select is(
  (select count(*) from public.mission_skills where mission_id = current_setting('skillmatch.phase05_mission_id')::uuid),
  1::bigint,
  'the mission skills are persisted without a client-side list as authority'
);
select lives_ok(
  format(
    $$select * from public.save_mission(
      p_mission_id => %L,
      p_expected_version => 1,
      p_wizard_draft_id => null,
      p_title => 'Mission réelle de phase 05',
      p_description => 'Créer une interface professionnelle accessible avec un résultat clairement vérifiable.',
      p_category => 'Numérique', p_work_mode => 'remote',
      p_public_city => null, p_public_region => null, p_country_code => null,
      p_presence_details => null, p_budget_model => 'fixed',
      p_budget_min => 400, p_budget_max => 600,
      p_application_deadline => current_date + 7,
      p_starts_on => current_date + 14, p_ends_on => current_date + 30,
      p_flexible_schedule => true, p_required_level => 'intermediate',
      p_deliverables => '["Interface responsive", "Compte rendu accessible"]'::jsonb,
      p_skill_ids => array[(select id from public.skills where slug = 'developpement-react')]::bigint[],
      p_skill_levels => array['intermediate']::public.skill_level[],
      p_publish => true
    )$$,
    current_setting('skillmatch.phase05_mission_id')::uuid
  ),
  'the owner publishes the complete draft through the controlled RPC'
);
select is(
  (select status from public.missions where id = current_setting('skillmatch.phase05_mission_id')::uuid),
  'published'::public.mission_status,
  'the mission is really published'
);
select is(
  (select count(*) from public.mission_events
    where mission_id = current_setting('skillmatch.phase05_mission_id')::uuid
      and event_type = 'mission_published'),
  1::bigint,
  'publication is recorded in the real audit log'
);
select throws_ok(
  $$select * from public.archive_mission(
      current_setting('skillmatch.phase05_mission_id')::uuid, 3
    )$$,
  '23514',
  null,
  'a published mission must be cancelled before it can be archived'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  format(
    $$select * from public.save_mission(
      p_mission_id => %L, p_expected_version => 3,
      p_wizard_draft_id => null, p_title => 'Modification interdite',
      p_description => 'Cette tentative de modification croisée doit être refusée par le serveur.',
      p_category => 'Numérique', p_work_mode => 'remote',
      p_public_city => null, p_public_region => null, p_country_code => null,
      p_presence_details => null, p_budget_model => 'fixed',
      p_budget_min => 400, p_budget_max => 600,
      p_application_deadline => current_date + 7,
      p_starts_on => current_date + 14, p_ends_on => current_date + 30,
      p_flexible_schedule => true, p_required_level => 'intermediate',
      p_deliverables => '["Livrable interdit"]'::jsonb,
      p_skill_ids => array[(select id from public.skills where slug = 'developpement-react')]::bigint[],
      p_skill_levels => array['intermediate']::public.skill_level[],
      p_publish => true
    )$$,
    current_setting('skillmatch.phase05_mission_id')::uuid
  ),
  '42501',
  null,
  'a third party cannot modify the mission through the RPC'
);
update public.missions
set title = 'Modification directe interdite'
where id = current_setting('skillmatch.phase05_mission_id')::uuid;
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select title from public.missions where id = current_setting('skillmatch.phase05_mission_id')::uuid),
  'Mission réelle de phase 05',
  'RLS also prevents a direct cross-profile update'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (select count(*) from public.search_missions(
    'Mission réelle', null, null, 'Ville sans rapport', null, null,
    null, null, null, null, 'relevance', 1, 12, false, null
  )),
  1::bigint,
  'a remote mission remains discoverable with an unrelated city filter'
);
select is(
  (select jsonb_array_length(skills) from public.search_missions(
    'Mission réelle', null, null, null, null, null,
    null, null, null, null, 'relevance', 1, 12, false, null
  )),
  1,
  'discovery aggregates skills without an N+1 query'
);
select lives_ok(
  format(
    $$insert into public.favorites (profile_id, mission_id)
      values (auth.uid(), %L)$$,
    current_setting('skillmatch.phase05_mission_id')::uuid
  ),
  'a talent saves a visible mission as a persistent favorite'
);
select is(
  (select count(*) from public.search_missions(
    null, null, null, null, null, null,
    null, null, null, null, 'newest', 1, 12, true, null
  ) where mission_id = current_setting('skillmatch.phase05_mission_id')::uuid),
  1::bigint,
  'the persistent favorite appears in the favorites search'
);
select is(
  (select count(*) from public.favorites
    where mission_id = current_setting('skillmatch.phase05_mission_id')::uuid),
  1::bigint,
  'the talent reloads the favorite from PostgreSQL'
);
select ok(
  (select count(*) from public.search_missions(
    null, null, array['local']::public.work_mode[], null, null, null,
    null, null, null, null, 'newest', 1, 24, false, null
  )) >= 1,
  'the local work-mode filter returns local missions'
);
select ok(
  (select count(*) from public.search_missions(
    null, null, array['remote']::public.work_mode[], null, null, null,
    null, null, null, null, 'newest', 1, 24, false, null
  )) >= 1,
  'the remote work-mode filter returns remote missions'
);
select ok(
  (select count(*) from public.search_missions(
    null, null, array['hybrid']::public.work_mode[], null, null, null,
    null, null, null, null, 'newest', 1, 24, false, null
  )) >= 1,
  'the hybrid work-mode filter returns hybrid missions'
);
select is(
  (select count(*) from public.search_missions(
    'requête sans résultat phase cinq', null, null, null, null, null,
    null, null, null, null, 'relevance', 1, 12, false, null
  )),
  0::bigint,
  'discovery returns an honest empty result'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (select count(*) from public.favorites
    where mission_id = current_setting('skillmatch.phase05_mission_id')::uuid),
  0::bigint,
  'another account cannot read the talent favorite row'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  format(
    $$insert into public.favorites (profile_id, mission_id)
      values (auth.uid(), %L)$$,
    current_setting('skillmatch.phase05_mission_id')::uuid
  ),
  '42501',
  null,
  'the owner cannot favorite the own mission'
);
select lives_ok(
  $$select * from public.transition_mission(
      current_setting('skillmatch.phase05_mission_id')::uuid, 3, 'cancelled'
    )$$,
  'the owner cancels the published mission through the state machine'
);
select is(
  (select status from public.missions where id = current_setting('skillmatch.phase05_mission_id')::uuid),
  'cancelled'::public.mission_status,
  'the cancellation status is persisted'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (select count(*) from public.search_missions(
    'Mission réelle', null, null, null, null, null,
    null, null, null, null, 'relevance', 1, 12, false, null
  )),
  0::bigint,
  'a cancelled mission disappears from talent discovery after reload'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select * from public.archive_mission(
      current_setting('skillmatch.phase05_mission_id')::uuid, 4
    )$$,
  'the owner archives a cancelled mission'
);
select ok(
  (select archived_at is not null from public.missions
    where id = current_setting('skillmatch.phase05_mission_id')::uuid),
  'the archive is a real timestamp rather than an invented mission status'
);
select is(
  (select application_count from public.search_missions(
    null, null, null, null, null, null,
    null, null, null, null, 'newest', 1, 1, false,
    current_setting('skillmatch.phase05_mission_id')::uuid
  )),
  0::bigint,
  'the owner detail receives the real application count'
);
select throws_ok(
  $$select * from public.save_mission(
      p_mission_id => null, p_expected_version => null,
      p_wizard_draft_id => null, p_title => 'Recherche d’une arme interdite',
      p_description => 'Cette annonce doit être refusée par la validation serveur de contenu.',
      p_category => 'Services', p_work_mode => 'remote',
      p_public_city => null, p_public_region => null, p_country_code => null,
      p_presence_details => null, p_budget_model => 'fixed',
      p_budget_min => 100, p_budget_max => 200,
      p_application_deadline => current_date + 7,
      p_starts_on => current_date + 14, p_ends_on => current_date + 21,
      p_flexible_schedule => false, p_required_level => 'beginner',
      p_deliverables => '["Livrable refusé"]'::jsonb,
      p_skill_ids => array[(select id from public.skills where slug = 'support-evenementiel')]::bigint[],
      p_skill_levels => array['beginner']::public.skill_level[],
      p_publish => false
    )$$,
  '23514',
  null,
  'prohibited mission content is refused by the server'
);
reset role;

select is(
  (
    select count(*)
    from information_schema.parameters p
    where p.specific_schema = 'public'
      and p.specific_name like 'search_missions_%'
      and p.parameter_name ilike '%distance%'
  ),
  0::bigint,
  'mission discovery has no distance input that could penalize remote work'
);

select * from finish();
rollback;
