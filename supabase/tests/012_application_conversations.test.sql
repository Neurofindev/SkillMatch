begin;

select no_plan();

select has_column('conversations', 'application_id');
select col_is_null('conversations', 'match_id');
select col_not_null('conversations', 'application_id');
select has_function('public', 'get_application_conversation_state', array['uuid']);
select has_function('public', 'get_or_create_application_conversation', array['uuid']);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_or_create_application_conversation(uuid)',
    'EXECUTE'
  ),
  'authenticated participants can use the controlled conversation function'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_or_create_application_conversation(uuid)',
    'EXECUTE'
  ),
  'anonymous visitors cannot create application conversations'
);

insert into public.missions (
  id, owner_id, title, description, category, work_mode, budget_model,
  currency_code, deliverables, status
) values
  (
    'fa100000-0000-0000-0000-000000000012',
    'd0000000-0000-0000-0000-000000000001',
    'Mission conversation avant acceptation',
    'Mission réelle de test pour vérifier un échange privé dès la candidature.',
    'Développement', 'remote', 'fixed', 'EUR', '[]'::jsonb, 'published'
  ),
  (
    'fa100000-0000-0000-0000-000000000013',
    'd0000000-0000-0000-0000-000000000001',
    'Mission conversation conservée après acceptation',
    'Mission réelle de test pour vérifier la réutilisation de la conversation.',
    'Développement', 'remote', 'fixed', 'EUR', '[]'::jsonb, 'published'
  );

insert into public.applications (
  id, mission_id, applicant_id, message, availability_note, status
) values
  (
    'fa200000-0000-0000-0000-000000000012',
    'fa100000-0000-0000-0000-000000000012',
    'd0000000-0000-0000-0000-000000000002',
    'Candidature persistée permettant une conversation avant acceptation.',
    'Disponible immédiatement pour échanger sur cette mission.',
    'submitted'
  ),
  (
    'fa200000-0000-0000-0000-000000000013',
    'fa100000-0000-0000-0000-000000000013',
    'd0000000-0000-0000-0000-000000000002',
    'Candidature dont la conversation doit survivre à son acceptation.',
    'Disponible immédiatement pour échanger puis commencer la mission.',
    'submitted'
  );

create temporary table application_conversation_ids (
  application_id uuid primary key,
  conversation_id uuid not null
) on commit drop;
grant select, insert, update, delete on application_conversation_ids to authenticated;

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;
select is(
  (public.get_application_conversation_state(
    'fa200000-0000-0000-0000-000000000012'
  ) ->> 'canStart')::boolean,
  true,
  'the applicant can start a conversation after confirmed submission'
);
insert into application_conversation_ids (application_id, conversation_id)
values (
  'fa200000-0000-0000-0000-000000000012',
  public.get_or_create_application_conversation(
    'fa200000-0000-0000-0000-000000000012'
  )
), (
  'fa200000-0000-0000-0000-000000000013',
  public.get_or_create_application_conversation(
    'fa200000-0000-0000-0000-000000000013'
  )
);
select lives_ok(
  format(
    'select * from public.send_message(%L, %L, %L)',
    (select conversation_id from application_conversation_ids
      where application_id = 'fa200000-0000-0000-0000-000000000012'),
    'fa500000-0000-0000-0000-000000000012',
    'Bonjour, je souhaite préciser ma disponibilité avant la sélection.'
  ),
  'the applicant sends before acceptance'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;
select is(
  public.get_or_create_application_conversation(
    'fa200000-0000-0000-0000-000000000012'
  ),
  (select conversation_id from application_conversation_ids
    where application_id = 'fa200000-0000-0000-0000-000000000012'),
  'the publisher receives the same unique conversation'
);
select lives_ok(
  format(
    'select * from public.send_message(%L, %L, %L)',
    (select conversation_id from application_conversation_ids
      where application_id = 'fa200000-0000-0000-0000-000000000012'),
    'fa500000-0000-0000-0000-000000000013',
    'Merci, voici une précision utile concernant le besoin publié.'
  ),
  'the publisher replies before acceptance'
);
select is(
  (select count(*) from public.conversation_members
    where conversation_id = (
      select conversation_id from application_conversation_ids
      where application_id = 'fa200000-0000-0000-0000-000000000012'
    )),
  2::bigint,
  'the private conversation has exactly the two application participants'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.get_or_create_application_conversation(
      'fa200000-0000-0000-0000-000000000012'
    )$$,
  '42501', null,
  'a third party cannot open a guessed application conversation'
);
select throws_ok(
  format(
    'select * from public.list_messages(%L, null, null, 30)',
    (select conversation_id from application_conversation_ids
      where application_id = 'fa200000-0000-0000-0000-000000000012')
  ),
  '42501', null,
  'a third party cannot read the conversation history'
);
reset role;

update public.applications
set status = 'withdrawn'
where id = 'fa200000-0000-0000-0000-000000000012';

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;
select throws_ok(
  format(
    'select * from public.send_message(%L, gen_random_uuid(), %L)',
    (select conversation_id from application_conversation_ids
      where application_id = 'fa200000-0000-0000-0000-000000000012'),
    'Ce message doit être refusé après le retrait.'
  ),
  '23514', null,
  'withdrawal makes the existing conversation read-only'
);
select is(
  (select count(*) from public.list_messages(
    (select conversation_id from application_conversation_ids
      where application_id = 'fa200000-0000-0000-0000-000000000012'),
    null, null, 30
  )),
  2::bigint,
  'the history remains readable after withdrawal'
);
reset role;

update public.applications
set status = 'viewed'
where id = 'fa200000-0000-0000-0000-000000000013';
update public.applications
set status = 'shortlisted'
where id = 'fa200000-0000-0000-0000-000000000013';

select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;
select is(
  (select accepted.conversation_id
   from public.accept_application(
     'fa200000-0000-0000-0000-000000000013',
     (select lock_version from public.missions
      where id = 'fa100000-0000-0000-0000-000000000013'),
     (select lock_version from public.applications
      where id = 'fa200000-0000-0000-0000-000000000013')
   ) accepted),
  (select conversation_id from application_conversation_ids
    where application_id = 'fa200000-0000-0000-0000-000000000013'),
  'acceptance reuses the application conversation instead of duplicating it'
);
reset role;

select is(
  (select count(*) from public.conversations
    where application_id = 'fa200000-0000-0000-0000-000000000013'),
  1::bigint,
  'one application keeps exactly one conversation after acceptance'
);
select ok(
  exists (
    select 1 from public.conversations c
    join public.matches mt on mt.id = c.match_id
    where c.application_id = 'fa200000-0000-0000-0000-000000000013'
      and mt.accepted_application_id = c.application_id
  ),
  'the reused conversation is attached to the unique accepted match'
);

select * from finish();
rollback;
