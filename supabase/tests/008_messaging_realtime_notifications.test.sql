begin;

select no_plan();

insert into public.missions (
  id, owner_id, title, description, category, work_mode, budget_model,
  budget_min, budget_max, currency_code, starts_on, ends_on, deliverables,
  status, assigned_talent_id
) values (
  'f1000000-0000-0000-0000-000000000008',
  'd0000000-0000-0000-0000-000000000001',
  'Mission de test messagerie phase 08',
  'Mission persistée uniquement dans la transaction pgTAP de la messagerie privée.',
  'Développement', 'remote', 'fixed', 300, 500, 'EUR',
  current_date, current_date + 7, '["Conversation testée"]'::jsonb,
  'published', null
);

insert into public.applications (
  id, mission_id, applicant_id, message, availability_note, status
) values (
  'f2000000-0000-0000-0000-000000000008',
  'f1000000-0000-0000-0000-000000000008',
  'd0000000-0000-0000-0000-000000000002',
  'Candidature de test pour créer le match de messagerie.',
  'Disponible pendant toute la période de test.',
  'accepted'
);

update public.missions set status = 'selecting'
where id = 'f1000000-0000-0000-0000-000000000008';

update public.missions
set status = 'assigned', assigned_talent_id = 'd0000000-0000-0000-0000-000000000002'
where id = 'f1000000-0000-0000-0000-000000000008';

insert into public.matches (
  id, mission_id, accepted_application_id, client_id, talent_id
) values (
  'f3000000-0000-0000-0000-000000000008',
  'f1000000-0000-0000-0000-000000000008',
  'f2000000-0000-0000-0000-000000000008',
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002'
);

insert into public.conversations (id, application_id, match_id, mission_id)
values (
  'f4000000-0000-0000-0000-000000000008',
  'f2000000-0000-0000-0000-000000000008',
  'f3000000-0000-0000-0000-000000000008',
  'f1000000-0000-0000-0000-000000000008'
);

insert into public.conversation_members (conversation_id, profile_id)
values
  ('f4000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000002');

update public.conversation_members
set joined_at = statement_timestamp() - interval '1 minute'
where conversation_id = 'f4000000-0000-0000-0000-000000000008';

select has_column('messages', 'client_message_id');
select has_column('messages', 'attachment_mime_type');
select has_column('messages', 'attachment_size_bytes');
select has_column('notifications', 'source_message_id');
select has_function('public', 'list_conversations', array['text', 'boolean', 'integer', 'integer']);
select has_function('public', 'list_messages', array['uuid', 'timestamptz', 'uuid', 'integer']);
select has_function('public', 'send_message', array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'integer']);
select has_function('public', 'mark_conversation_read', array['uuid']);
select has_function('public', 'set_conversation_block', array['uuid', 'boolean']);
select has_function('public', 'list_notifications', array['integer', 'integer']);

select ok(
  has_function_privilege('authenticated', 'public.send_message(uuid,uuid,text,text,text,text,integer)', 'EXECUTE'),
  'authenticated can execute the controlled send function'
);
select ok(
  not has_function_privilege('anon', 'public.send_message(uuid,uuid,text,text,text,text,integer)', 'EXECUTE'),
  'anonymous cannot execute the controlled send function'
);
select ok(
  not has_table_privilege('authenticated', 'public.messages', 'INSERT'),
  'direct message insertion is revoked from authenticated clients'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ),
  'messages are explicitly published to Supabase Realtime'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ),
  'notifications are explicitly published to Supabase Realtime'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select count(*) from public.list_conversations(null, false, 1, 20)
   where conversation_id = 'f4000000-0000-0000-0000-000000000008'),
  1::bigint,
  'the client lists the match-created conversation'
);
select lives_ok(
  $$select * from public.send_message(
      'f4000000-0000-0000-0000-000000000008',
      'f5000000-0000-0000-0000-000000000001',
      'Premier message persistant de la phase 08.'
    )$$,
  'the client sends through the server-authoritative function'
);
select lives_ok(
  $$select * from public.send_message(
      'f4000000-0000-0000-0000-000000000008',
      'f5000000-0000-0000-0000-000000000001',
      'Premier message persistant de la phase 08.'
    )$$,
  'retrying the same client message id is idempotent'
);
reset role;

select is(
  (select count(*) from public.messages
   where conversation_id = 'f4000000-0000-0000-0000-000000000008'
     and client_message_id = 'f5000000-0000-0000-0000-000000000001'),
  1::bigint,
  'the retry does not duplicate the persisted message'
);
select is(
  (select count(*) from public.notifications
   where source_message_id = (
     select id from public.messages
     where client_message_id = 'f5000000-0000-0000-0000-000000000001'
   )),
  1::bigint,
  'the retry does not duplicate the real message notification'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$select * from public.send_message(
      'f4000000-0000-0000-0000-000000000008',
      'f5000000-0000-0000-0000-000000000001',
      'Contenu différent interdit.'
    )$$,
  '23505', null,
  'a client message id cannot be reused for different content'
);
select throws_ok(
  $$insert into public.messages (conversation_id, author_id, body)
    values (
      'f4000000-0000-0000-0000-000000000008', auth.uid(),
      'Insertion directe interdite.'
    )$$,
  '42501', null,
  'a member cannot bypass the controlled send function'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (select count(*) from public.list_conversations(null, false, 1, 20)
   where conversation_id = 'f4000000-0000-0000-0000-000000000008'),
  0::bigint,
  'a third party does not list the conversation'
);
select throws_ok(
  $$select * from public.list_messages(
      'f4000000-0000-0000-0000-000000000008', null, null, 30
    )$$,
  '42501', null,
  'a third party cannot read messages by guessing the conversation id'
);
select throws_ok(
  $$select * from public.send_message(
      'f4000000-0000-0000-0000-000000000008', gen_random_uuid(),
      'Message tiers interdit.'
    )$$,
  '42501', null,
  'a third party cannot send by guessing the conversation id'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is(
  (select count(*) from public.list_messages(
    'f4000000-0000-0000-0000-000000000008', null, null, 30
  )),
  1::bigint,
  'the other participant reads the persisted message'
);
select is(
  (select unread_count from public.list_conversations(null, false, 1, 20)
   where conversation_id = 'f4000000-0000-0000-0000-000000000008'),
  1::bigint,
  'the unread count is derived from the unread real message'
);
select lives_ok(
  $$select public.mark_conversation_read('f4000000-0000-0000-0000-000000000008')$$,
  'the participant marks the conversation as read'
);
select is(
  (select unread_count from public.list_conversations(null, false, 1, 20)
   where conversation_id = 'f4000000-0000-0000-0000-000000000008'),
  0::bigint,
  'the unread count becomes zero after a real read mutation'
);
select lives_ok(
  $$select public.set_conversation_archived('f4000000-0000-0000-0000-000000000008', true)$$,
  'a participant archives only the own membership state'
);
select is(
  (select count(*) from public.list_conversations(null, true, 1, 20)
   where conversation_id = 'f4000000-0000-0000-0000-000000000008'),
  1::bigint,
  'the archived conversation moves to the archived list'
);
reset role;

select is(
  (select count(*) from public.conversation_members
   where conversation_id = 'f4000000-0000-0000-0000-000000000008'
     and profile_id = 'd0000000-0000-0000-0000-000000000001'
     and archived_at is not null),
  0::bigint,
  'archiving does not change the other participant membership'
);

insert into storage.objects (bucket_id, name)
values (
  'message-attachments',
  'f4000000-0000-0000-0000-000000000008/d0000000-0000-0000-0000-000000000001/f6000000-0000-0000-0000-000000000001.txt'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$select * from public.send_message(
      'f4000000-0000-0000-0000-000000000008', gen_random_uuid(),
      'Pièce jointe invalide.', 'autre/conversation/fichier.exe',
      'fichier.exe', 'application/octet-stream', 100
    )$$,
  '23514', null,
  'invalid attachment metadata and unsafe paths are rejected server-side'
);
select lives_ok(
  $$select * from public.send_message(
      'f4000000-0000-0000-0000-000000000008',
      'f5000000-0000-0000-0000-000000000002',
      'Voici la pièce jointe demandée.',
      'f4000000-0000-0000-0000-000000000008/d0000000-0000-0000-0000-000000000001/f6000000-0000-0000-0000-000000000001.txt',
      'notes.txt', 'text/plain', 100
    )$$,
  'a safe participant-owned attachment can be linked to a message'
);
select lives_ok(
  $$select public.report_conversation_participant(
      'f4000000-0000-0000-0000-000000000008', 'harassment',
      'Signalement détaillé conservé pour la modération.'
    )$$,
  'a participant can report the counterpart from the conversation'
);
select lives_ok(
  $$select public.set_conversation_block(
      'f4000000-0000-0000-0000-000000000008', true
    )$$,
  'a participant can persist a block against the counterpart'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$select * from public.send_message(
      'f4000000-0000-0000-0000-000000000008', gen_random_uuid(),
      'Le blocage doit refuser cette écriture.'
    )$$,
  '42501', null,
  'blocking refuses writes at the database boundary in either direction'
);
select is(
  (select count(*) from public.list_messages(
    'f4000000-0000-0000-0000-000000000008', null, null, 30
  )),
  2::bigint,
  'blocking preserves readable conversation history'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.set_conversation_block(
      'f4000000-0000-0000-0000-000000000008', false
    )$$,
  'the blocker can reverse the own block'
);
select lives_ok(
  $$select public.delete_message(
      (select id from public.messages where client_message_id = 'f5000000-0000-0000-0000-000000000002')
    )$$,
  'an author can mark the own message as deleted'
);
select is(
  (select body from public.list_messages(
    'f4000000-0000-0000-0000-000000000008', null, null, 30
  ) where client_message_id = 'f5000000-0000-0000-0000-000000000002'),
  'Message supprimé',
  'deleted message content is redacted from the participant projection'
);
reset role;

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$select public.delete_message(
      (select id from public.messages where client_message_id = 'f5000000-0000-0000-0000-000000000001')
    )$$,
  '42501', null,
  'the other participant cannot delete a message they did not author'
);
select lives_ok(
  $$select public.mark_notification_read(
      (select id from public.notifications
       where source_message_id = (
         select id from public.messages
         where client_message_id = 'f5000000-0000-0000-0000-000000000001'
       ))
    )$$,
  'the notification recipient can mark one notification as read'
);
select lives_ok(
  $$select public.mark_all_notifications_read()$$,
  'the notification recipient can mark all own notifications as read'
);
select is(
  (select count(*) from public.notifications
   where recipient_id = auth.uid() and read_at is null),
  0::bigint,
  'all notification read states are persisted'
);
reset role;

insert into public.notifications (recipient_id, type, title, body, internal_path)
values (
  'd0000000-0000-0000-0000-000000000001', 'moderation_updated',
  'Lien de test', 'Le lien arbitraire ne doit jamais être exposé.', '/route-inconnue'
);
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select internal_path from public.list_notifications(1, 50)
   where title = 'Lien de test'),
  '/espace/notifications',
  'an arbitrary stored relative path is replaced by a safe internal fallback'
);
reset role;

update public.messages
set created_at = statement_timestamp() - interval '2 minutes'
where author_id = 'd0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select * from public.send_message('f4000000-0000-0000-0000-000000000008', 'f5000000-0000-0000-0000-000000000011', 'Message de cadence 1.')$$,
  'first rate-limited window message is accepted'
);
select lives_ok(
  $$select * from public.send_message('f4000000-0000-0000-0000-000000000008', 'f5000000-0000-0000-0000-000000000012', 'Message de cadence 2.')$$,
  'second rate-limited window message is accepted'
);
select lives_ok(
  $$select * from public.send_message('f4000000-0000-0000-0000-000000000008', 'f5000000-0000-0000-0000-000000000013', 'Message de cadence 3.')$$,
  'third rate-limited window message is accepted'
);
select lives_ok(
  $$select * from public.send_message('f4000000-0000-0000-0000-000000000008', 'f5000000-0000-0000-0000-000000000014', 'Message de cadence 4.')$$,
  'fourth rate-limited window message is accepted'
);
select lives_ok(
  $$select * from public.send_message('f4000000-0000-0000-0000-000000000008', 'f5000000-0000-0000-0000-000000000015', 'Message de cadence 5.')$$,
  'fifth rate-limited window message is accepted'
);
select throws_ok(
  $$select * from public.send_message('f4000000-0000-0000-0000-000000000008', 'f5000000-0000-0000-0000-000000000016', 'Message de cadence 6 interdit.')$$,
  'P0001', null,
  'the server rejects excessive message frequency'
);
reset role;

select ok(
  not exists (
    select 1 from pg_catalog.pg_type t
    join pg_catalog.pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel in ('payment', 'wallet', 'deposit', 'escrow')
  ),
  'no financial notification type exists'
);

select * from finish();
rollback;
