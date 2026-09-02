begin;

select no_plan();

select has_column('notifications', 'source_review_id');
select has_function(
  'public',
  'submit_review',
  array['uuid', 'integer', 'text', 'integer', 'integer', 'integer']
);
select has_function('public', 'list_review_opportunities', array[]::text[]);
select has_function(
  'public',
  'list_received_reviews',
  array['uuid', 'integer', 'integer']
);
select has_function('public', 'get_reputation_summary', array['uuid']);
select has_function('public', 'get_dashboard_overview', array[]::text[]);
select has_function('public', 'list_dashboard_deadlines', array['integer']);

select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_review(uuid,integer,text,integer,integer,integer)',
    'EXECUTE'
  ),
  'authenticated participants can use the controlled review RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_review(uuid,integer,text,integer,integer,integer)',
    'EXECUTE'
  ),
  'anonymous visitors cannot submit reviews'
);
select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'INSERT'),
  'direct review insertion is revoked from authenticated clients'
);

insert into public.missions (
  id, owner_id, title, description, category, work_mode, budget_model,
  budget_min, budget_max, starts_on, ends_on, deliverables, status,
  assigned_talent_id
)
values (
  'f1000000-0000-0000-0000-000000000009',
  'd0000000-0000-0000-0000-000000000001',
  'Mission active sans avis phase 09',
  'Mission de test encore active qui doit refuser tout avis avant sa clôture réelle.',
  'Numérique', 'remote', 'fixed', 300, 500,
  current_date, current_date + 5, '["Livrable de test"]'::jsonb,
  'published', null
);
insert into public.applications (
  id, mission_id, applicant_id, message, availability_note, status
)
values (
  'f2000000-0000-0000-0000-000000000009',
  'f1000000-0000-0000-0000-000000000009',
  'd0000000-0000-0000-0000-000000000002',
  'Candidature de test suffisamment détaillée pour la mission active.',
  'Disponible pendant la période annoncée.',
  'accepted'
);
update public.missions set status = 'selecting'
where id = 'f1000000-0000-0000-0000-000000000009';
update public.missions
set status = 'assigned',
    assigned_talent_id = 'd0000000-0000-0000-0000-000000000002'
where id = 'f1000000-0000-0000-0000-000000000009';
insert into public.matches (
  id, mission_id, accepted_application_id, client_id, talent_id
)
values (
  'f3000000-0000-0000-0000-000000000009',
  'f1000000-0000-0000-0000-000000000009',
  'f2000000-0000-0000-0000-000000000009',
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002'
);

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.submit_review(
    'f3000000-0000-0000-0000-000000000009',
    5,
    'Avis prématuré interdit.',
    5,
    5,
    5
  )$$,
  '23514',
  null,
  'a review is rejected before both mission and match are completed'
);
select throws_ok(
  $$insert into public.reviews (
    match_id, mission_id, author_id, recipient_id, rating, criteria
  ) values (
    'f3000000-0000-0000-0000-000000000009',
    'f1000000-0000-0000-0000-000000000009',
    auth.uid(),
    'd0000000-0000-0000-0000-000000000002',
    5,
    '{}'::jsonb
  )$$,
  '42501',
  null,
  'a participant cannot bypass the controlled review RPC'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.submit_review(
    'd3000000-0000-0000-0000-000000000001',
    4,
    'Le tiers ne participe pas à cette mission.',
    4,
    4,
    4
  )$$,
  '42501',
  null,
  'a third party cannot review either participant'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.submit_review(
    'd3000000-0000-0000-0000-000000000001',
    3,
    'Communication claire et périmètre correctement suivi.',
    4,
    3,
    3
  )$$,
  'the talent can review the client after the real completion'
);
select throws_ok(
  $$select * from public.submit_review(
    'd3000000-0000-0000-0000-000000000001',
    4,
    'Un second avis dans le même sens est interdit.',
    4,
    4,
    4
  )$$,
  '23505',
  null,
  'a duplicate review in the same direction is rejected'
);
select is(
  (
    select count(*)
    from public.list_review_opportunities()
    where match_id = 'd3000000-0000-0000-0000-000000000001'
      and own_review_id is not null
      and counterpart_has_reviewed
  ),
  1::bigint,
  'the completed collaboration reports both real review directions'
);
reset role;

select is(
  (
    select count(*)
    from public.notifications
    where source_review_id = (
      select id
      from public.reviews
      where match_id = 'd3000000-0000-0000-0000-000000000001'
        and author_id = 'd0000000-0000-0000-0000-000000000002'
    )
  ),
  1::bigint,
  'one submitted review creates exactly one real notification'
);

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;
select is(
  (
    select internal_path
    from public.list_notifications(1, 50)
    where type = 'review_received'
      and title = 'Nouvel avis vérifié'
  ),
  '/espace/avis',
  'a review notification opens the validated review center'
);
select is(
  (
    select average_rating
    from public.get_reputation_summary(auth.uid())
  ),
  3.00::numeric,
  'the client reputation average is exact'
);
select is(
  (
    select review_count
    from public.get_reputation_summary(auth.uid())
  ),
  1::bigint,
  'the reputation always carries its real review count'
);
select is(
  (
    select rating_3_count
    from public.get_reputation_summary(auth.uid())
  ),
  1::bigint,
  'the rating distribution is derived from the stored review'
);
select is(
  (
    select completed_missions
    from public.get_reputation_summary(auth.uid())
  ),
  1::bigint,
  'completed mission volume is derived from completed matches and missions'
);
select is(
  (
    select count(*)
    from public.list_received_reviews(auth.uid(), 1, 10)
    where rating = 3
      and criteria ->> 'communication' = '4'
  ),
  1::bigint,
  'the received review projection returns controlled criteria'
);
select ok(
  (
    select can_hire and not can_work
      and client_active_missions >= 1
      and reviews_to_leave = 0
    from public.get_dashboard_overview()
  ),
  'the client dashboard is scoped to real client capability and actions'
);
select is(
  (
    select count(*)
    from public.list_dashboard_deadlines(5)
    where mission_id = 'f1000000-0000-0000-0000-000000000009'
      and participant_role = 'client'
  ),
  1::bigint,
  'the client deadline list contains its real upcoming mission'
);
select ok(
  not (public.get_weekly_ranking(10) ->> 'sufficientData')::boolean
  and jsonb_array_length(public.get_weekly_ranking(10) -> 'items') = 0,
  'the weekly ranking is hidden below the minimum real sample'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;
select ok(
  (
    select can_work and not can_hire
      and pending_applications >= 1
      and talent_active_missions >= 1
    from public.get_dashboard_overview()
  ),
  'the talent dashboard exposes only its real talent activity'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;
select ok(
  (
    select can_work and can_hire
      and 'availability' = any(profile_missing_fields)
    from public.get_dashboard_overview()
  ),
  'a single double-capability account receives both dashboard universes and honest profile work'
);
select ok(
  (
    select is_new_profile and review_count = 0
    from public.get_reputation_summary(auth.uid())
  ),
  'a profile without reviews stays a neutral new profile'
);
reset role;

-- Complete two additional missions for two distinct talents so that the rolling
-- sample contains three completions from three profiles including the seed.
insert into public.missions (
  id, owner_id, title, description, category, work_mode, budget_model,
  budget_min, budget_max, deliverables, status
)
values
  (
    'f1000000-0000-0000-0000-000000000091',
    'd0000000-0000-0000-0000-000000000001',
    'Mission classée pour le talent double mode',
    'Mission terminée utilisée uniquement pour dépasser honnêtement le seuil du classement.',
    'Numérique', 'remote', 'fixed', 100, 150,
    '["Livrable classé"]'::jsonb, 'published'
  ),
  (
    'f1000000-0000-0000-0000-000000000092',
    'd0000000-0000-0000-0000-000000000001',
    'Mission classée pour le troisième talent',
    'Deuxième mission terminée utilisée uniquement pour la vérification du seuil réel.',
    'Numérique', 'remote', 'fixed', 100, 150,
    '["Livrable classé"]'::jsonb, 'published'
  );
insert into public.applications (
  id, mission_id, applicant_id, message, availability_note, status
)
values
  (
    'f2000000-0000-0000-0000-000000000091',
    'f1000000-0000-0000-0000-000000000091',
    'd0000000-0000-0000-0000-000000000003',
    'Candidature classée suffisamment détaillée pour la première mission.',
    'Disponible pendant toute la période.',
    'accepted'
  ),
  (
    'f2000000-0000-0000-0000-000000000092',
    'f1000000-0000-0000-0000-000000000092',
    'd0000000-0000-0000-0000-000000000004',
    'Candidature classée suffisamment détaillée pour la deuxième mission.',
    'Disponible pendant toute la période.',
    'accepted'
  );
update public.missions set status = 'selecting'
where id in (
  'f1000000-0000-0000-0000-000000000091',
  'f1000000-0000-0000-0000-000000000092'
);
update public.missions
set status = 'assigned',
    assigned_talent_id = case id
      when 'f1000000-0000-0000-0000-000000000091'
        then 'd0000000-0000-0000-0000-000000000003'::uuid
      else 'd0000000-0000-0000-0000-000000000004'::uuid
    end
where id in (
  'f1000000-0000-0000-0000-000000000091',
  'f1000000-0000-0000-0000-000000000092'
);
insert into public.matches (
  id, mission_id, accepted_application_id, client_id, talent_id
)
values
  (
    'f3000000-0000-0000-0000-000000000091',
    'f1000000-0000-0000-0000-000000000091',
    'f2000000-0000-0000-0000-000000000091',
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003'
  ),
  (
    'f3000000-0000-0000-0000-000000000092',
    'f1000000-0000-0000-0000-000000000092',
    'f2000000-0000-0000-0000-000000000092',
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000004'
  );
select set_config('skillmatch.phase07_action', 'start', true);
update public.missions set status = 'in_progress'
where id in (
  'f1000000-0000-0000-0000-000000000091',
  'f1000000-0000-0000-0000-000000000092'
);
select set_config('skillmatch.phase07_action', 'complete', true);
update public.missions set status = 'completed'
where id in (
  'f1000000-0000-0000-0000-000000000091',
  'f1000000-0000-0000-0000-000000000092'
);
select set_config('skillmatch.phase07_action', '', true);
update public.matches
set status = 'completed', completed_at = statement_timestamp()
where id in (
  'f3000000-0000-0000-0000-000000000091',
  'f3000000-0000-0000-0000-000000000092'
);
insert into public.mission_events (
  mission_id, actor_id, event_type, metadata
)
values
  (
    'f1000000-0000-0000-0000-000000000091',
    'd0000000-0000-0000-0000-000000000001',
    'mission_completed',
    '{"test":"phase09-ranking"}'::jsonb
  ),
  (
    'f1000000-0000-0000-0000-000000000092',
    'd0000000-0000-0000-0000-000000000001',
    'mission_completed',
    '{"test":"phase09-ranking"}'::jsonb
  );

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;
select ok(
  (public.get_weekly_ranking(10) ->> 'sufficientData')::boolean
  and (public.get_weekly_ranking(10) ->> 'sampleCompletedMissions')::integer = 3
  and (public.get_weekly_ranking(10) ->> 'sampleProfiles')::integer = 3
  and jsonb_array_length(public.get_weekly_ranking(10) -> 'items') = 3
  and public.get_weekly_ranking(10) #>> '{items,0,username}' is not null
  and jsonb_typeof(
    public.get_weekly_ranking(10) #> '{items,0,weeklyCompletions}'
  ) = 'number',
  'the weekly activity list appears only after the documented real sample threshold'
);
select is(
  public.get_weekly_ranking(10) ->> 'formulaVersion',
  'weekly-completions-v2',
  'the weekly metric exposes its documented formula version'
);
reset role;

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and lower(p.proname) ~ '(wallet|payment|payout|invoice|bank|escrow|ledger|transaction)'
  ),
  'phase 09 introduces no financial function'
);

select * from finish();
rollback;
