begin;

create extension if not exists pgtap with schema extensions;

select plan(55);

select has_table('public', 'application_swipes', 'client application swipe decisions are persisted');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.application_swipes'::regclass),
  'application swipes have RLS enabled'
);
select ok(
  to_regprocedure('public.submit_application(uuid,text,text,boolean,numeric)') is not null,
  'the controlled application submission RPC exists'
);
select ok(
  to_regprocedure('public.list_applications(text,text,public.application_status[],text,integer,integer,uuid,uuid)') is not null,
  'the party-limited application list RPC exists'
);
select ok(
  to_regprocedure('public.record_mission_swipe(uuid,public.swipe_decision)') is not null,
  'the talent mission swipe RPC exists'
);
select ok(
  to_regprocedure('public.record_application_swipe(uuid,integer,public.application_swipe_decision)') is not null,
  'the client application swipe RPC exists'
);
select function_privs_are(
  'private',
  'calculate_application_relevance',
  array['uuid', 'uuid', 'numeric'],
  'authenticated',
  array[]::text[],
  'the internal formula cannot be called directly by an authenticated client'
);
select ok(
  not has_table_privilege('authenticated', 'public.swipes', 'INSERT')
  and not has_table_privilege('authenticated', 'public.swipes', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.swipes', 'DELETE'),
  'mission swipe writes are restricted to controlled RPCs'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'f6000000-0000-0000-0000-000000000005',
  'authenticated', 'authenticated', 'phase06-extra@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.profiles (
  id, username, display_name, primary_mode, can_work, can_hire,
  adult_confirmed, onboarding_completed, city, country_code
)
values (
  'f6000000-0000-0000-0000-000000000005',
  'phase06-extra', 'Talent supplémentaire Phase 06', 'talent', true, false,
  true, true, 'Lille', 'FR'
);

insert into public.availability_slots (
  id, profile_id, kind, starts_at, ends_at, timezone, visibility
)
values (
  'f6000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'one_time',
  (current_date + 5)::timestamptz,
  (current_date + 60)::timestamptz,
  'UTC',
  'private'
);

insert into public.missions (
  id, owner_id, title, description, category, work_mode,
  public_city, public_region, country_code, budget_model, budget_min,
  budget_max, application_deadline, starts_on, ends_on, deliverables, status
)
values
  (
    'f6100000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — score remote de référence',
    'Mission suffisamment détaillée pour vérifier le score distant sans aucune donnée de distance.',
    'Numérique', 'remote', null, null, null, 'fixed', 100, 200,
    current_date + 4, current_date + 10, current_date + 20,
    '["Interface accessible"]'::jsonb, 'published'
  ),
  (
    'f6100000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — score remote après changement de ville',
    'Mission jumelle suffisamment détaillée pour prouver que la ville ne modifie jamais le score remote.',
    'Numérique', 'remote', null, null, null, 'fixed', 100, 200,
    current_date + 4, current_date + 10, current_date + 20,
    '["Interface accessible"]'::jsonb, 'published'
  ),
  (
    'f6100000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — score local approximatif',
    'Mission suffisamment détaillée pour vérifier la zone approximative sans adresse ni coordonnée exacte.',
    'Numérique', 'local', 'Lyon', 'Auvergne-Rhône-Alpes', 'FR', 'fixed', 100, 200,
    current_date + 4, current_date + 10, current_date + 20,
    '["Interface accessible"]'::jsonb, 'published'
  ),
  (
    'f6100000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — nouveau profil neutre',
    'Mission suffisamment détaillée pour vérifier les valeurs neutres lorsque des données sont absentes.',
    'Numérique', 'remote', null, null, null, 'fixed', 100, 200,
    current_date + 4, current_date + 10, current_date + 20,
    '["Interface accessible"]'::jsonb, 'published'
  );

insert into public.mission_skills (mission_id, skill_id, required_level, importance)
select mission_id, s.id, 'advanced', 5
from (
  values
    ('f6100000-0000-0000-0000-000000000001'::uuid),
    ('f6100000-0000-0000-0000-000000000002'::uuid),
    ('f6100000-0000-0000-0000-000000000003'::uuid),
    ('f6100000-0000-0000-0000-000000000004'::uuid)
) fixture(mission_id)
cross join public.skills s
where s.slug = 'developpement-react';

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$select * from public.submit_application(
      'f6100000-0000-0000-0000-000000000001',
      'Le propriétaire ne doit jamais candidater à sa propre mission.',
      'Disponible immédiatement', true, 150
    )$$,
  '23514',
  null,
  'a mission owner cannot apply to the own mission through the RPC'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select throws_ok(
  $$select * from public.submit_application(
      'f6100000-0000-0000-0000-000000000001',
      'Une candidature non confirmée ne doit jamais être envoyée par le serveur.',
      'Disponible sur toute la période indiquée.', false, 150
    )$$,
  '23514', null,
  'the server refuses an application without explicit confirmation'
);
select throws_ok(
  $$insert into public.applications (
      mission_id, applicant_id, message, availability_note, proposed_amount
    ) values (
      'f6100000-0000-0000-0000-000000000001', auth.uid(),
      'Une écriture directe ne peut pas contourner le formulaire de confirmation.',
      'Disponible sur toute la période indiquée.', 150
    )$$,
  '42501', null,
  'authenticated clients cannot bypass confirmation with a direct insert'
);

select set_config(
  'skillmatch.phase06_remote_one',
  (
    select application_id::text from public.submit_application(
      'f6100000-0000-0000-0000-000000000001',
      'Je confirme cette candidature réelle après avoir relu le message et les disponibilités.',
      'Disponible sur toute la période indiquée.', true, 150
    )
  ), true
);
select is(
  (select relevance_score from public.applications
    where id = current_setting('skillmatch.phase06_remote_one')::uuid),
  100.00::numeric,
  'matching skills, availability, remote mode, budget and verified reputation score 100'
);
select is(
  (select score_version from public.applications
    where id = current_setting('skillmatch.phase06_remote_one')::uuid),
  'relevance-v1',
  'the score formula version is persisted'
);
select is(
  (select relevance_details #>> '{components,mode,detail}' from public.applications
    where id = current_setting('skillmatch.phase06_remote_one')::uuid),
  'Compatibilité à distance, sans donnée ni facteur de distance.',
  'the remote component explicitly excludes distance'
);
select is(
  (select status from public.missions where id = 'f6100000-0000-0000-0000-000000000001'),
  'published'::public.mission_status,
  'submitting an application does not silently change the mission workflow'
);
select throws_ok(
  $$select * from public.submit_application(
      'f6100000-0000-0000-0000-000000000001',
      'Cette seconde candidature active identique doit être refusée.',
      'Toujours disponible', true, 150
    )$$,
  '23505',
  null,
  'a duplicate active application is refused by the database'
);

reset role;
update public.profiles
set city = 'La Paz', country_code = 'BO'
where id = 'd0000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select set_config(
  'skillmatch.phase06_remote_two',
  (
    select application_id::text from public.submit_application(
      'f6100000-0000-0000-0000-000000000002',
      'Je confirme cette seconde candidature distante après vérification complète de son contenu.',
      'Disponible sur toute la période indiquée.', true, 150
    )
  ), true
);
select is(
  (select relevance_score from public.applications
    where id = current_setting('skillmatch.phase06_remote_two')::uuid),
  (select relevance_score from public.applications
    where id = current_setting('skillmatch.phase06_remote_one')::uuid),
  'changing only the approximate city and country cannot alter a remote score'
);

select set_config(
  'skillmatch.phase06_local',
  (
    select application_id::text from public.submit_application(
      'f6100000-0000-0000-0000-000000000003',
      'Je confirme cette candidature locale après vérification complète de la zone approximative.',
      'Disponible sur toute la période indiquée.', true, 150
    )
  ), true
);
select is(
  (select relevance_score from public.applications
    where id = current_setting('skillmatch.phase06_local')::uuid),
  85.00::numeric,
  'an incompatible approximate local zone affects only the 15 point mode component'
);
select is(
  (select relevance_details #>> '{components,mode,score}' from public.applications
    where id = current_setting('skillmatch.phase06_local')::uuid),
  '0.00',
  'the local mode component is normalized between zero and one hundred'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select set_config(
  'skillmatch.phase06_new_profile',
  (
    select application_id::text from public.submit_application(
      'f6100000-0000-0000-0000-000000000004',
      'Je confirme cette candidature de nouveau profil malgré les informations encore manquantes.',
      'Disponibilité à préciser avec le client.', true, null
    )
  ), true
);
select is(
  (select relevance_score from public.applications
    where id = current_setting('skillmatch.phase06_new_profile')::uuid),
  35.00::numeric,
  'a new profile receives neutral missing-data values rather than a reputation penalty'
);
select is(
  (select relevance_details #>> '{components,reputation,score}' from public.applications
    where id = current_setting('skillmatch.phase06_new_profile')::uuid),
  '50.00',
  'a new profile without reviews has a neutral reputation component'
);
select ok(
  (select relevance_details -> 'missingData' ? 'Aucun avis issu d’une mission terminée'
    from public.applications where id = current_setting('skillmatch.phase06_new_profile')::uuid),
  'missing reputation evidence is disclosed'
);
select is(
  (select count(*) from public.list_applications(
    'talent', null, null, 'newest', 1, 12, null,
    current_setting('skillmatch.phase06_new_profile')::uuid
  )),
  1::bigint,
  'a talent reloads the own persistent application'
);
select is(
  (select count(*) from public.list_applications(
    'received', null, null, 'newest', 1, 12,
    'f6100000-0000-0000-0000-000000000001', null
  )),
  0::bigint,
  'another talent cannot use the received scope to read the client applications'
);
select lives_ok(
  format(
    $$select * from public.transition_application(%L, 1, 'withdrawn')$$,
    current_setting('skillmatch.phase06_new_profile')::uuid
  ),
  'a talent withdraws an application while it is not accepted'
);
select is(
  (select status from public.applications
    where id = current_setting('skillmatch.phase06_new_profile')::uuid),
  'withdrawn'::public.application_status,
  'the withdrawn status is persisted'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select set_config(
  'skillmatch.phase06_compare_two',
  (
    select application_id::text from public.submit_application(
      'f6100000-0000-0000-0000-000000000001',
      'Candidature supplémentaire confirmée pour comparer plusieurs talents sur la même mission.',
      'Disponibilité structurée à préciser.', true, 140
    )
  ), true
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select set_config(
  'skillmatch.phase06_compare_three',
  (
    select application_id::text from public.submit_application(
      'f6100000-0000-0000-0000-000000000001',
      'Troisième candidature confirmée pour comparer plusieurs talents sur la même mission réelle.',
      'Disponible pendant toute la période.', true, 160
    )
  ), true
);
reset role;

select set_config('request.jwt.claim.sub', 'f6000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select set_config(
  'skillmatch.phase06_compare_four',
  (
    select application_id::text from public.submit_application(
      'f6100000-0000-0000-0000-000000000001',
      'Quatrième candidature confirmée destinée à vérifier la limite de comparaison côté serveur.',
      'Disponible pendant toute la période.', true, 170
    )
  ), true
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select count(*) from public.list_applications(
    'received', null, null, 'score_desc', 1, 12,
    'f6100000-0000-0000-0000-000000000001', null
  )),
  4::bigint,
  'the mission owner lists every received application for the mission'
);
select is(
  (select applicant_display_name from public.list_applications(
    'received', null, null, 'score_desc', 1, 12,
    null, current_setting('skillmatch.phase06_remote_one')::uuid
  )),
  'Démonstration — Tania Talent',
  'the owner receives only the authorized public applicant identity'
);
select throws_ok(
  format(
    $$select * from public.transition_application(%L, 99, 'viewed')$$,
    current_setting('skillmatch.phase06_remote_one')::uuid
  ),
  '40001', null,
  'a stale owner transition reports a concurrent change'
);
select lives_ok(
  format(
    $$select * from public.transition_application(%L, 1, 'viewed')$$,
    current_setting('skillmatch.phase06_remote_one')::uuid
  ),
  'the owner marks a received application viewed'
);
select is(
  (select status from public.applications
    where id = current_setting('skillmatch.phase06_remote_one')::uuid),
  'viewed'::public.application_status,
  'viewed is persisted rather than simulated by a toast'
);
select lives_ok(
  format(
    $$select * from public.record_application_swipe(%L, 2, 'pass')$$,
    current_setting('skillmatch.phase06_remote_one')::uuid
  ),
  'the owner can pass through the secondary swipe interface'
);
select is(
  (select status from public.applications
    where id = current_setting('skillmatch.phase06_remote_one')::uuid),
  'viewed'::public.application_status,
  'a pass swipe never rejects the application'
);
select is(
  (select application_id from public.undo_last_application_swipe()),
  current_setting('skillmatch.phase06_remote_one')::uuid,
  'only the latest reversible application swipe can be undone'
);
select is(
  (select count(*) from public.application_swipes
    where application_id = current_setting('skillmatch.phase06_remote_one')::uuid),
  0::bigint,
  'undo removes the persisted reversible swipe decision'
);
select lives_ok(
  format(
    $$select * from public.record_application_swipe(%L, 2, 'compare')$$,
    current_setting('skillmatch.phase06_remote_one')::uuid
  ),
  'the owner adds a real received application to comparison'
);
select lives_ok(
  format(
    $$select * from public.record_application_swipe(%L, 1, 'compare')$$,
    current_setting('skillmatch.phase06_compare_two')::uuid
  ),
  'the owner adds a second application to comparison'
);
select lives_ok(
  format(
    $$select * from public.record_application_swipe(%L, 1, 'compare')$$,
    current_setting('skillmatch.phase06_compare_three')::uuid
  ),
  'the owner adds a third application to comparison'
);
select throws_ok(
  format(
    $$select * from public.record_application_swipe(%L, 1, 'compare')$$,
    current_setting('skillmatch.phase06_compare_four')::uuid
  ),
  '23514', null,
  'the database refuses a fourth candidate in the same comparison'
);
select throws_ok(
  format(
    $$select * from public.record_application_swipe(%L, 1, 'shortlist')$$,
    current_setting('skillmatch.phase06_remote_one')::uuid
  ),
  '40001', null,
  'shortlisting a compared application cannot bypass stale concurrency state'
);
select is(
  (select count(*) from public.application_swipes
    where owner_id = auth.uid() and decision = 'compare'),
  3::bigint,
  'comparison remains capped at three persisted candidates'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (select count(*) from public.applications
    where applicant_id = auth.uid() and mission_id = 'f6100000-0000-0000-0000-000000000002'),
  1::bigint,
  'the talent has one application before opening another candidature form from swipe'
);
select lives_ok(
  $$select * from public.record_mission_swipe(
      'f6100000-0000-0000-0000-000000000004', 'interested'
    )$$,
  'the talent records interest without submitting an application'
);
select is(
  (select count(*) from public.applications
    where applicant_id = auth.uid() and mission_id = 'f6100000-0000-0000-0000-000000000004'),
  0::bigint,
  'an interested swipe never sends an application silently'
);
select lives_ok(
  $$select * from public.record_mission_swipe(
      'f6100000-0000-0000-0000-000000000003', 'save'
    )$$,
  'the visible save action persists a mission swipe and favorite'
);
select is(
  (select count(*) from public.favorites
    where profile_id = auth.uid() and mission_id = 'f6100000-0000-0000-0000-000000000003'),
  1::bigint,
  'the save swipe has a persistent favorite equivalent'
);
select is(
  (select mission_id from public.undo_last_mission_swipe()),
  'f6100000-0000-0000-0000-000000000003'::uuid,
  'the talent undoes only the latest reversible mission decision'
);
select is(
  (select count(*) from public.favorites
    where profile_id = auth.uid() and mission_id = 'f6100000-0000-0000-0000-000000000003'),
  0::bigint,
  'undo restores the favorite state coherently'
);
insert into public.favorites (profile_id, mission_id)
values (auth.uid(), 'f6100000-0000-0000-0000-000000000004');
select lives_ok(
  $$select * from public.record_mission_swipe(
      'f6100000-0000-0000-0000-000000000004', 'save'
    )$$,
  'saving a mission that was already a favorite remains valid'
);
select lives_ok(
  $$select * from public.undo_last_mission_swipe()$$,
  'the latest save decision can be undone'
);
select is(
  (select count(*) from public.favorites
    where profile_id = auth.uid() and mission_id = 'f6100000-0000-0000-0000-000000000004'),
  1::bigint,
  'undo preserves a favorite that existed before the swipe'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  format(
    $$select * from public.record_application_swipe(%L, 2, 'pass')$$,
    current_setting('skillmatch.phase06_remote_one')::uuid
  ),
  '42501', null,
  'a third party cannot swipe or modify another client application'
);
select is(
  (select count(*) from public.application_swipes),
  0::bigint,
  'RLS hides another client application swipe rows from a third party'
);
reset role;

select is(
  (
    select count(*) from information_schema.parameters p
    where p.specific_schema = 'private'
      and p.specific_name like 'calculate_application_relevance_%'
      and p.parameter_name ilike any(array['%age%', '%gender%', '%sex%', '%origin%', '%name%', '%photo%', '%distance%'])
  ),
  0::bigint,
  'the formula signature accepts no sensitive attribute or distance input'
);
select is(
  (select count(*) from public.application_swipes where decision = 'shortlist'),
  0::bigint,
  'no failed or ambiguous gesture produced a shortlist side effect'
);

select * from finish();
rollback;
