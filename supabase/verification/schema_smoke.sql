do $$
declare
  required_tables text[] := array[
    'profiles', 'onboarding_drafts', 'skills', 'profile_skills', 'availability_slots',
    'missions', 'mission_drafts', 'mission_attachments',
    'mission_private_locations', 'mission_skills',
    'applications', 'swipes', 'matches', 'agreements', 'conversations',
    'conversation_members', 'messages', 'mission_events',
    'completion_confirmations', 'notifications', 'reviews', 'favorites',
    'reports', 'blocks', 'user_roles'
  ];
  current_table text;
  missing_count integer;
begin
  foreach current_table in array required_tables loop
    if to_regclass(format('public.%I', current_table)) is null then
      raise exception 'required table is missing: %', current_table;
    end if;
  end loop;

  select count(*)
  into missing_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(required_tables)
    and not c.relrowsecurity;

  if missing_count <> 0 then
    raise exception '% application tables do not have RLS enabled', missing_count;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and lower(table_name) = any (
        array['wallet', 'wallets', 'payment', 'payments', 'payout', 'payouts', 'invoice', 'invoices', 'bank_account', 'bank_accounts', 'escrow', 'ledger']
      )
  ) then
    raise exception 'a forbidden financial table exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and lower(column_name) = any (
        array['wallet_id', 'payment_id', 'payout_id', 'invoice_id', 'bank_account_id', 'escrow_id', 'ledger_id']
      )
  ) then
    raise exception 'a forbidden financial reference column exists';
  end if;

  select count(*)
  into missing_count
  from unnest(required_tables) required(table_name)
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = required.table_name
  );

  if missing_count <> 0 then
    raise exception '% application tables do not have an explicit RLS policy', missing_count;
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      and table_name in (
        'matches', 'agreements', 'conversations', 'mission_events', 'user_roles'
      )
  ) then
    raise exception 'a sensitive workflow table has a direct API write grant';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'accept_application', 'transition_application', 'transition_mission',
        'confirm_agreement', 'transition_agreement', 'get_public_profiles',
        'get_application_counts', 'get_unread_counts', 'get_dashboard_stats',
        'get_reputation', 'get_weekly_ranking', 'is_username_available',
        'save_profile', 'save_mission', 'archive_mission', 'search_missions'
      )
      and not ('search_path=""' = any (coalesce(p.proconfig, array[]::text[])))
  ) then
    raise exception 'an exposed security-definer RPC has no fixed empty search_path';
  end if;

  raise notice 'SkillMatch schema and RLS contract smoke tests passed';
end;
$$;
