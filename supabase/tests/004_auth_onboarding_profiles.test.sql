begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'f0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'phase04-one@skillmatch.invalid',
    extensions.crypt('phase04-local-password', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"adult_confirmed":true}'::jsonb, now(), now()
  ),
  (
    'f0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'phase04-two@skillmatch.invalid',
    extensions.crypt('phase04-local-password', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"adult_confirmed":true}'::jsonb, now(), now()
  ),
  (
    'f0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
    'phase04-unconfirmed@skillmatch.invalid',
    extensions.crypt('phase04-local-password', extensions.gen_salt('bf')),
    null, '{"provider":"email","providers":["email"]}'::jsonb,
    '{"adult_confirmed":true}'::jsonb, now(), now()
  );

select has_table(
  'public',
  'onboarding_drafts',
  'resumable onboarding has a dedicated private table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.onboarding_drafts'::regclass),
  'onboarding drafts have RLS enabled'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'onboarding_drafts'),
  4::bigint,
  'onboarding drafts have explicit own-row policies for every operation'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select ok(
  public.is_username_available('phase04-double'),
  'an authenticated account can check a valid available username'
);
select lives_ok(
  $$insert into public.onboarding_drafts (user_id, current_step, payload)
    values (auth.uid(), 4, '{"displayName":"Phase 04"}'::jsonb)$$,
  'an account saves an own onboarding draft'
);
select is(
  (select count(*) from public.onboarding_drafts where user_id = auth.uid()),
  1::bigint,
  'the owner can resume the own onboarding draft'
);
reset role;

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (select count(*) from public.onboarding_drafts),
  0::bigint,
  'another account cannot read the first account onboarding draft'
);
select throws_ok(
  $$insert into public.onboarding_drafts (user_id, current_step, payload)
    values ('f0000000-0000-0000-0000-000000000001', 2, '{}'::jsonb)$$,
  '42501',
  null,
  'another account cannot write the first account onboarding draft'
);
select throws_ok(
  $$insert into public.profiles (
      id, username, display_name, primary_mode, can_work, adult_confirmed,
      onboarding_completed
    ) values (
      auth.uid(), 'direct-bypass', 'Direct bypass', 'talent', true, true, true
    )$$,
  '42501',
  null,
  'direct profile insertion cannot bypass authoritative onboarding completion'
);
reset role;

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select * from public.save_profile(
    auth.uid(), 'Compte double Phase 04', 'phase04-double', '',
    'Profil réel créé par le test transactionnel de la phase quatre.',
    'both', 'both', 'Lyon', 'fr',
    array[(select min(id) from public.skills)],
    array['advanced'::public.skill_level],
    now() + interval '1 day', now() + interval '31 days', 'Europe/Paris',
    'matched', '', false, true, true
  )$$,
  'the controlled RPC completes a confirmed account onboarding atomically'
);
reset role;

select ok(
  (select onboarding_completed and adult_confirmed from public.profiles where id = 'f0000000-0000-0000-0000-000000000001'),
  'the completed profile records onboarding and the adult declaration'
);
select ok(
  (select can_work and can_hire from public.profiles where id = 'f0000000-0000-0000-0000-000000000001'),
  'one account can activate both find and publish capabilities'
);
select is(
  (select count(*) from public.profile_skills where profile_id = 'f0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'profile skills are persisted by the same transaction'
);
select is(
  (select count(*) from public.availability_slots where profile_id = 'f0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'availability is persisted by the same transaction'
);
select is(
  (select count(*) from public.onboarding_drafts where user_id = 'f0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the completed onboarding removes its resumable draft'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select ok(
  public.is_username_available('PHASE04-DOUBLE'),
  'username availability is case-insensitive and keeps the own current value available while editing'
);
reset role;

set local role anon;
select is(
  (select city from public.get_public_profiles('f0000000-0000-0000-0000-000000000001')),
  null::text,
  'the public projection hides an approximate location when privacy is disabled'
);
select ok(
  (select email_verified from public.get_public_profiles('f0000000-0000-0000-0000-000000000001')),
  'the e-mail badge source is the real Auth confirmation timestamp'
);
reset role;

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$select * from public.save_profile(
    'f0000000-0000-0000-0000-000000000001', 'Intrus Phase 04',
    'phase04-intrus', '', 'Tentative interdite de modification du profil voisin.',
    'find', 'remote', '', '', array[(select min(id) from public.skills)],
    array['beginner'::public.skill_level], now() + interval '1 day',
    now() + interval '10 days', 'UTC', 'private', '', false, true, true
  )$$,
  '42501',
  null,
  'an authenticated account cannot update another profile through the RPC'
);
select throws_ok(
  $$select * from public.save_profile(
    auth.uid(), 'Compte mineur non déclaré', 'phase04-no-adult', '',
    'Ce profil ne doit jamais être validé sans déclaration de majorité.',
    'find', 'remote', '', '', array[(select min(id) from public.skills)],
    array['beginner'::public.skill_level], now() + interval '1 day',
    now() + interval '10 days', 'UTC', 'private', '', false, true, false
  )$$,
  '23514',
  null,
  'onboarding completion requires the adult declaration'
);
select throws_ok(
  $$select * from public.save_profile(
    auth.uid(), 'Compte local sans zone', 'phase04-no-location', '',
    'Ce profil local ne doit jamais être validé sans zone approximative.',
    'find', 'local', '', '', array[(select min(id) from public.skills)],
    array['beginner'::public.skill_level], now() + interval '1 day',
    now() + interval '10 days', 'UTC', 'private', '', false, true, true
  )$$,
  '23514',
  null,
  'a local preference requires an approximate city and country'
);
reset role;

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$select * from public.save_profile(
    auth.uid(), 'Compte non confirmé', 'phase04-unconfirmed', '',
    'Ce profil ne doit pas être validé avant confirmation réelle de son e-mail.',
    'find', 'remote', '', '', array[(select min(id) from public.skills)],
    array['beginner'::public.skill_level], now() + interval '1 day',
    now() + interval '10 days', 'UTC', 'private', '', false, true, true
  )$$,
  '23514',
  null,
  'an unconfirmed Auth e-mail cannot complete onboarding'
);
reset role;

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in ('is_username_available', 'save_profile', 'get_public_profiles')
      and not ('search_path=""' = any (coalesce(p.proconfig, array[]::text[])))
  ),
  'every phase 04 security-definer RPC fixes an empty search_path'
);
select ok(
  not exists (
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
  ),
  'the added public table does not leave any application table without RLS policy'
);

select * from finish();
rollback;
