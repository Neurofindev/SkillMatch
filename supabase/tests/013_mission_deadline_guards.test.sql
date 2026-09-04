begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select throws_ok(
  $$select * from public.save_mission(
    null, null, null,
    'Démonstration — échéance passée refusée',
    'Cette mission vérifie que le serveur refuse une publication dont l’échéance est déjà dépassée.',
    'Numérique', 'remote', null, null, null, null,
    'fixed', 100, 200, current_date - 1, current_date + 1,
    current_date + 2, false, 'intermediate',
    '["Livrable vérifiable"]'::jsonb,
    array[(select id from public.skills where slug = 'developpement-react')]::bigint[],
    array['intermediate']::public.skill_level[], true
  )$$,
  '23514',
  'application deadline must not be in the past',
  'the server refuses publication with a past application deadline'
);

select set_config(
  'skillmatch.deadline_guard_mission',
  (
    select mission_id::text from public.save_mission(
      null, null, null,
      'Démonstration — échéance valide',
      'Cette mission vérifie qu’une chronologie future et cohérente reste publiable après le correctif.',
      'Numérique', 'remote', null, null, null, null,
      'fixed', 100, 200, current_date + 2, current_date + 3,
      current_date + 4, false, 'intermediate',
      '["Livrable vérifiable"]'::jsonb,
      array[(select id from public.skills where slug = 'developpement-react')]::bigint[],
      array['intermediate']::public.skill_level[], true
    )
  ),
  true
);

select is(
  (select status from public.missions
   where id = current_setting('skillmatch.deadline_guard_mission')::uuid),
  'published'::public.mission_status,
  'a coherent future mission remains publishable'
);

reset role;

select throws_ok(
  format(
    $$update public.missions set application_deadline = current_date - 1 where id = %L$$,
    current_setting('skillmatch.deadline_guard_mission')::uuid
  ),
  '23514',
  'application deadline must not be in the past',
  'a discoverable mission cannot be edited to use a past deadline'
);

select lives_ok(
  format(
    $$update public.missions set status = 'selecting' where id = %L$$,
    current_setting('skillmatch.deadline_guard_mission')::uuid
  ),
  'a published mission can enter selection without changing its valid dates'
);

select * from finish();
rollback;
