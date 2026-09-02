begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'skills', 'skills table exists');
select has_table('public', 'profile_skills', 'profile_skills table exists');
select has_table('public', 'availability_slots', 'availability_slots table exists');
select has_table('public', 'missions', 'missions table exists');
select has_table('public', 'mission_private_locations', 'private mission locations are isolated');
select has_table('public', 'mission_skills', 'mission_skills table exists');
select has_table('public', 'applications', 'applications table exists');
select has_table('public', 'swipes', 'swipes table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'agreements', 'agreements table exists');
select has_table('public', 'conversations', 'conversations table exists');
select has_table('public', 'conversation_members', 'conversation_members table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'mission_events', 'mission_events table exists');
select has_table('public', 'completion_confirmations', 'completion confirmations table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'reviews', 'reviews table exists');
select has_table('public', 'favorites', 'favorites table exists');
select has_table('public', 'reports', 'reports table exists');
select has_table('public', 'blocks', 'blocks table exists');
select has_table('public', 'user_roles', 'sensitive roles are separated from profiles');

select has_type('public', 'mission_status', 'mission states use a closed enum');
select has_type('public', 'application_status', 'application states use a closed enum');
select has_type('public', 'agreement_status', 'agreement states use a closed enum');
select has_type('public', 'work_mode', 'work modes use a closed enum');

select has_index(
  'public',
  'applications',
  'applications_one_active_per_talent_mission_idx',
  'active application uniqueness is indexed'
);
select has_index(
  'public',
  'matches',
  'matches_one_active_per_mission_idx',
  'active match uniqueness is indexed'
);
select has_index(
  'public',
  'notifications',
  'notifications_unread_idx',
  'unread notifications are indexed'
);
select has_index(
  'public',
  'missions',
  'missions_discovery_idx',
  'mission discovery is indexed'
);

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in (
        'profiles', 'skills', 'profile_skills', 'availability_slots',
        'missions', 'mission_private_locations', 'mission_skills',
        'applications', 'swipes', 'matches', 'agreements', 'conversations',
        'conversation_members', 'messages', 'mission_events',
        'completion_confirmations', 'notifications', 'reviews', 'favorites',
        'reports', 'blocks', 'user_roles'
      )
  ),
  'RLS is enabled on every application table'
);

select ok(
  not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and lower(table_name) = any (
        array['wallet', 'wallets', 'payment', 'payments', 'payout', 'payouts', 'invoice', 'invoices', 'bank_account', 'bank_accounts', 'escrow', 'ledger']
      )
  ),
  'no forbidden financial table exists'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and lower(column_name) = any (
        array['wallet_id', 'payment_id', 'payout_id', 'invoice_id', 'bank_account_id', 'escrow_id', 'ledger_id']
      )
  ),
  'no forbidden financial reference column exists'
);

select ok(
  not exists (
    select required.table_name
    from unnest(array[
      'profiles', 'skills', 'profile_skills', 'availability_slots',
      'missions', 'mission_private_locations', 'mission_skills',
      'applications', 'swipes', 'matches', 'agreements', 'conversations',
      'conversation_members', 'messages', 'mission_events',
      'completion_confirmations', 'notifications', 'reviews', 'favorites',
      'reports', 'blocks', 'user_roles'
    ]) as required(table_name)
    where not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = required.table_name
    )
  ),
  'every application table has an explicit RLS policy'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      and table_name in (
        'matches', 'agreements', 'conversations', 'mission_events', 'user_roles'
      )
  ),
  'sensitive workflow and role tables have no direct API write grants'
);

select * from finish();
rollback;
