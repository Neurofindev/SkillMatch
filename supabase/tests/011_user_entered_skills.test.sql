begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select lives_ok(
  $$select * from public.find_or_create_skill('Photographie   culinaire')$$,
  'an authenticated user can enter a new skill'
);
select is(
  (
    select count(*)
    from public.skills
    where normalized_name = 'photographie culinaire'
  ),
  1::bigint,
  'the entered skill is normalized and persisted once'
);
select lives_ok(
  $$select * from public.find_or_create_skill('  photographie culinaire  ')$$,
  'spacing and case variants resolve safely'
);
select is(
  (
    select count(*)
    from public.skills
    where normalized_name = 'photographie culinaire'
  ),
  1::bigint,
  'a normalized duplicate does not create another skill'
);
select throws_ok(
  $$select * from public.find_or_create_skill('x')$$,
  '22023',
  null,
  'a skill shorter than two characters is rejected'
);
select throws_ok(
  $$select * from public.find_or_create_skill('<script>')$$,
  '22023',
  null,
  'unsafe markup characters are rejected'
);
select throws_ok(
  $$insert into public.skills (slug, name, category) values ('direct-write', 'Direct write', 'Test')$$,
  '42501',
  null,
  'a normal user cannot bypass the controlled skill RPC with a direct insert'
);

reset role;
insert into public.skills (slug, name, category, is_active)
values ('competence-masquee', 'Compétence masquée', 'Test', false);
select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.find_or_create_skill('Compétence masquée')$$,
  '22023',
  null,
  'a user cannot reactivate a moderated skill'
);

reset role;
insert into private.skill_creation_events (user_id)
select 'd0000000-0000-0000-0000-000000000003'::uuid
from generate_series(1, 30);
select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.find_or_create_skill('Trentième compétence suivante')$$,
  '54000',
  null,
  'skill creation is rate limited per authenticated user'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok(
  $$select * from public.find_or_create_skill('Compétence anonyme')$$,
  '42501',
  null,
  'an anonymous visitor cannot create a skill'
);

select * from finish();
rollback;
