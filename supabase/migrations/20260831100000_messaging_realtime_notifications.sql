-- SkillMatch phase 08: participant-only messaging, idempotent sends,
-- read/archive state, safety actions, validated notifications and Realtime.

alter table public.messages
  add column client_message_id uuid not null default gen_random_uuid(),
  add column attachment_name text,
  add column attachment_mime_type text,
  add column attachment_size_bytes integer;

alter table public.messages
  add constraint messages_attachment_metadata_check
  check (
    (
      attachment_path is null
      and attachment_name is null
      and attachment_mime_type is null
      and attachment_size_bytes is null
    )
    or (
      attachment_path is not null
      and char_length(btrim(attachment_name)) between 1 and 120
      and attachment_name !~ '[/\\\\[:cntrl:]]'
      and attachment_mime_type in (
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'
      )
      and attachment_size_bytes between 1 and 10485760
    )
  );

create unique index messages_conversation_client_message_unique
  on public.messages (conversation_id, client_message_id);
create index messages_conversation_keyset_idx
  on public.messages (conversation_id, created_at desc, id desc);

alter table public.notifications
  add column source_message_id uuid references public.messages (id) on delete set null;

create unique index notifications_new_message_source_unique
  on public.notifications (recipient_id, source_message_id)
  where source_message_id is not null;

create function public.list_conversations(
  p_query text default null,
  p_archived boolean default false,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  conversation_id uuid,
  match_id uuid,
  mission_id uuid,
  mission_title text,
  mission_status public.mission_status,
  match_status public.match_status,
  participant_role text,
  counterpart_id uuid,
  counterpart_username text,
  counterpart_display_name text,
  counterpart_headline text,
  counterpart_avatar_path text,
  last_message_id uuid,
  last_message_body text,
  last_message_author_id uuid,
  last_message_attachment_name text,
  last_message_deleted_at timestamptz,
  last_message_at timestamptz,
  unread_count bigint,
  archived_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_page < 1 or p_page_size not between 1 and 50 then
    raise exception 'invalid pagination' using errcode = '22023';
  end if;

  return query
  with visible as (
    select
      c.id as conversation_id,
      mt.id as match_id,
      ms.id as mission_id,
      ms.title as mission_title,
      ms.status as mission_status,
      mt.status as match_status,
      case when mt.client_id = v_actor_id then 'client' else 'talent' end as participant_role,
      counterpart.id as counterpart_id,
      counterpart.username::text as counterpart_username,
      counterpart.display_name as counterpart_display_name,
      counterpart.headline as counterpart_headline,
      counterpart.avatar_path as counterpart_avatar_path,
      latest.id as last_message_id,
      case
        when latest.deleted_at is not null then 'Message supprimé'
        else latest.body
      end as last_message_body,
      latest.author_id as last_message_author_id,
      case when latest.deleted_at is null then latest.attachment_name end
        as last_message_attachment_name,
      latest.deleted_at as last_message_deleted_at,
      latest.created_at as last_message_at,
      (
        select count(*)
        from public.messages unread
        where unread.conversation_id = c.id
          and unread.author_id is distinct from v_actor_id
          and unread.deleted_at is null
          and unread.created_at > coalesce(cm.last_read_at, cm.joined_at)
      ) as unread_count,
      cm.archived_at
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    join public.matches mt on mt.id = c.match_id
    join public.missions ms on ms.id = c.mission_id
    join public.profiles counterpart
      on counterpart.id = case
        when mt.client_id = v_actor_id then mt.talent_id
        else mt.client_id
      end
    left join lateral (
      select msg.*
      from public.messages msg
      where msg.conversation_id = c.id
      order by msg.created_at desc, msg.id desc
      limit 1
    ) latest on true
    where cm.profile_id = v_actor_id
      and (
        (not p_archived and cm.archived_at is null)
        or (p_archived and cm.archived_at is not null)
      )
      and (
        v_query is null
        or ms.title ilike '%' || v_query || '%'
        or counterpart.display_name ilike '%' || v_query || '%'
        or counterpart.username::text ilike '%' || v_query || '%'
      )
  )
  select
    visible.*,
    count(*) over() as total_count
  from visible
  order by coalesce(visible.last_message_at, '-infinity'::timestamptz) desc,
           visible.conversation_id
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

create function public.get_conversation_workspace(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', c.id,
      'archivedAt', cm.archived_at,
      'joinedAt', cm.joined_at,
      'lastReadAt', cm.last_read_at,
      'canSend', mt.status = 'active'
        and not private.users_are_blocked(mt.client_id, mt.talent_id),
      'isBlocked', private.users_are_blocked(mt.client_id, mt.talent_id),
      'blockedByMe', exists (
        select 1 from public.blocks b
        where b.blocker_id = v_actor_id and b.blocked_id = counterpart.id
      )
    ),
    'match', jsonb_build_object(
      'id', mt.id,
      'status', mt.status,
      'role', case when mt.client_id = v_actor_id then 'client' else 'talent' end
    ),
    'mission', jsonb_build_object(
      'id', ms.id,
      'title', ms.title,
      'status', ms.status,
      'workMode', ms.work_mode
    ),
    'counterpart', jsonb_build_object(
      'id', counterpart.id,
      'username', counterpart.username::text,
      'displayName', counterpart.display_name,
      'headline', counterpart.headline,
      'bio', counterpart.bio,
      'avatarPath', counterpart.avatar_path,
      'city', counterpart.city,
      'countryCode', counterpart.country_code,
      'remoteAvailable', counterpart.remote_available
    ),
    'agreement', case when agreement.id is null then null else jsonb_build_object(
      'id', agreement.id,
      'version', agreement.version,
      'status', agreement.status
    ) end
  )
  into v_result
  from public.conversations c
  join public.conversation_members cm
    on cm.conversation_id = c.id and cm.profile_id = v_actor_id
  join public.matches mt on mt.id = c.match_id
  join public.missions ms on ms.id = c.mission_id
  join public.profiles counterpart
    on counterpart.id = case
      when mt.client_id = v_actor_id then mt.talent_id
      else mt.client_id
    end
  left join lateral (
    select a.id, a.version, a.status
    from public.agreements a
    where a.match_id = mt.id
    order by a.version desc
    limit 1
  ) agreement on true
  where c.id = p_conversation_id;

  if v_result is null then
    if exists (select 1 from public.conversations c where c.id = p_conversation_id) then
      raise exception 'conversation access is not authorized' using errcode = '42501';
    end if;
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

create function public.list_messages(
  p_conversation_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_page_size integer default 30
)
returns table (
  message_id uuid,
  client_message_id uuid,
  author_id uuid,
  author_display_name text,
  body text,
  attachment_path text,
  attachment_name text,
  attachment_mime_type text,
  attachment_size_bytes integer,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_page_size not between 1 and 50
     or ((p_before_created_at is null) <> (p_before_id is null)) then
    raise exception 'invalid message pagination' using errcode = '22023';
  end if;
  if not private.is_conversation_member(p_conversation_id, v_actor_id) then
    if exists (select 1 from public.conversations c where c.id = p_conversation_id) then
      raise exception 'conversation access is not authorized' using errcode = '42501';
    end if;
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;

  return query
  select
    msg.id,
    msg.client_message_id,
    msg.author_id,
    coalesce(author.display_name, 'Compte supprimé'),
    case when msg.deleted_at is null then msg.body else 'Message supprimé' end,
    case when msg.deleted_at is null then msg.attachment_path end,
    case when msg.deleted_at is null then msg.attachment_name end,
    case when msg.deleted_at is null then msg.attachment_mime_type end,
    case when msg.deleted_at is null then msg.attachment_size_bytes end,
    msg.created_at,
    msg.edited_at,
    msg.deleted_at
  from public.messages msg
  left join public.profiles author on author.id = msg.author_id
  where msg.conversation_id = p_conversation_id
    and (
      p_before_created_at is null
      or (msg.created_at, msg.id) < (p_before_created_at, p_before_id)
    )
  order by msg.created_at desc, msg.id desc
  limit p_page_size;
end;
$$;

create function public.send_message(
  p_conversation_id uuid,
  p_client_message_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_mime_type text default null,
  p_attachment_size_bytes integer default null
)
returns table (
  message_id uuid,
  client_message_id uuid,
  author_id uuid,
  body text,
  attachment_path text,
  attachment_name text,
  attachment_mime_type text,
  attachment_size_bytes integer,
  created_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_existing public.messages%rowtype;
  v_message public.messages%rowtype;
  v_match public.matches%rowtype;
  v_counterpart_id uuid;
  v_mission_title text;
  v_has_attachment boolean := p_attachment_path is not null;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_client_message_id is null then
    raise exception 'client message id is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_conversation_id::text || ':' || v_actor_id::text, 0)
  );

  select msg.* into v_existing
  from public.messages msg
  where msg.conversation_id = p_conversation_id
    and msg.client_message_id = p_client_message_id;

  if found then
    if v_existing.author_id <> v_actor_id
       or v_existing.body <> btrim(coalesce(p_body, ''))
       or v_existing.attachment_path is distinct from p_attachment_path
       or v_existing.attachment_name is distinct from nullif(btrim(coalesce(p_attachment_name, '')), '')
       or v_existing.attachment_mime_type is distinct from p_attachment_mime_type
       or v_existing.attachment_size_bytes is distinct from p_attachment_size_bytes then
      raise exception 'client message id was already used for different content'
        using errcode = '23505';
    end if;
    return query select
      v_existing.id, v_existing.client_message_id, v_existing.author_id,
      v_existing.body, v_existing.attachment_path, v_existing.attachment_name,
      v_existing.attachment_mime_type, v_existing.attachment_size_bytes,
      v_existing.created_at, v_existing.deleted_at;
    return;
  end if;

  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception 'message body length is invalid' using errcode = '23514';
  end if;
  if v_has_attachment <> (p_attachment_name is not null)
     or v_has_attachment <> (p_attachment_mime_type is not null)
     or v_has_attachment <> (p_attachment_size_bytes is not null) then
    raise exception 'attachment metadata is incomplete' using errcode = '23514';
  end if;

  select mt.*
  into v_match
  from public.conversations c
  join public.matches mt on mt.id = c.match_id
  where c.id = p_conversation_id;

  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  select ms.title into strict v_mission_title
  from public.missions ms where ms.id = v_match.mission_id;
  if v_actor_id not in (v_match.client_id, v_match.talent_id) then
    raise exception 'conversation access is not authorized' using errcode = '42501';
  end if;
  if v_match.status <> 'active' then
    raise exception 'new messages require an active match' using errcode = '23514';
  end if;

  v_counterpart_id := case
    when v_actor_id = v_match.client_id then v_match.talent_id
    else v_match.client_id
  end;
  perform private.lock_user_pair(v_actor_id, v_counterpart_id);
  if private.users_are_blocked(v_actor_id, v_counterpart_id) then
    raise exception 'a block prevents new messages' using errcode = '42501';
  end if;

  if (
    select count(*) from public.messages recent
    where recent.author_id = v_actor_id
      and recent.created_at > statement_timestamp() - interval '10 seconds'
  ) >= 5
  or (
    select count(*) from public.messages recent
    where recent.author_id = v_actor_id
      and recent.created_at > statement_timestamp() - interval '1 minute'
  ) >= 30 then
    raise exception 'message rate limit exceeded' using errcode = 'P0001';
  end if;

  if v_has_attachment then
    if p_attachment_path !~ (
      '^' || p_conversation_id::text || '/' || v_actor_id::text
      || '/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|pdf|txt)$'
    )
    or char_length(btrim(p_attachment_name)) not between 1 and 120
    or p_attachment_name ~ '[/\\\\[:cntrl:]]'
    or p_attachment_mime_type not in (
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'
    )
    or p_attachment_size_bytes not between 1 and 10485760
    or not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'message-attachments'
        and object.name = p_attachment_path
    ) then
      raise exception 'attachment is not valid or is not owned by the sender'
        using errcode = '23514';
    end if;
  end if;

  insert into public.messages (
    conversation_id, client_message_id, author_id, body, attachment_path,
    attachment_name, attachment_mime_type, attachment_size_bytes
  ) values (
    p_conversation_id, p_client_message_id, v_actor_id, btrim(p_body),
    p_attachment_path, nullif(btrim(coalesce(p_attachment_name, '')), ''),
    p_attachment_mime_type, p_attachment_size_bytes
  ) returning * into v_message;

  update public.conversations c
  set updated_at = statement_timestamp()
  where c.id = p_conversation_id;
  update public.conversation_members cm
  set last_read_at = statement_timestamp()
  where cm.conversation_id = p_conversation_id and cm.profile_id = v_actor_id;
  update public.conversation_members cm
  set archived_at = null
  where cm.conversation_id = p_conversation_id and cm.profile_id = v_counterpart_id;

  insert into public.notifications (
    recipient_id, type, title, body, internal_path, source_message_id
  ) values (
    v_counterpart_id,
    'new_message',
    'Nouveau message',
    'Vous avez reçu un message concernant « ' || left(v_mission_title, 120) || ' ».',
    '/espace/messages/' || p_conversation_id::text,
    v_message.id
  ) on conflict (recipient_id, source_message_id)
    where source_message_id is not null do nothing;

  return query select
    v_message.id, v_message.client_message_id, v_message.author_id,
    v_message.body, v_message.attachment_path, v_message.attachment_name,
    v_message.attachment_mime_type, v_message.attachment_size_bytes,
    v_message.created_at, v_message.deleted_at;
end;
$$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_read_at timestamptz;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  update public.conversation_members cm
  set last_read_at = greatest(statement_timestamp(), cm.joined_at)
  where cm.conversation_id = p_conversation_id and cm.profile_id = v_actor_id
  returning cm.last_read_at into v_read_at;
  if v_read_at is null then
    raise exception 'conversation access is not authorized' using errcode = '42501';
  end if;
  return v_read_at;
end;
$$;

create function public.set_conversation_archived(
  p_conversation_id uuid,
  p_archived boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_archived_at timestamptz;
  v_found boolean;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  update public.conversation_members cm
  set archived_at = case when p_archived then statement_timestamp() else null end
  where cm.conversation_id = p_conversation_id and cm.profile_id = v_actor_id
  returning true, cm.archived_at into v_found, v_archived_at;
  if not coalesce(v_found, false) then
    raise exception 'conversation access is not authorized' using errcode = '42501';
  end if;
  return v_archived_at;
end;
$$;

create function public.delete_message(p_message_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_attachment_path text;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  update public.messages msg
  set deleted_at = coalesce(msg.deleted_at, statement_timestamp())
  where msg.id = p_message_id and msg.author_id = v_actor_id
  returning msg.attachment_path into v_attachment_path;
  if not found then
    raise exception 'message deletion is not authorized' using errcode = '42501';
  end if;
  return v_attachment_path;
end;
$$;

create function public.set_conversation_block(
  p_conversation_id uuid,
  p_blocked boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_counterpart_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select case when mt.client_id = v_actor_id then mt.talent_id else mt.client_id end
  into v_counterpart_id
  from public.conversations c
  join public.matches mt on mt.id = c.match_id
  join public.conversation_members cm
    on cm.conversation_id = c.id and cm.profile_id = v_actor_id
  where c.id = p_conversation_id;
  if v_counterpart_id is null then
    raise exception 'conversation access is not authorized' using errcode = '42501';
  end if;
  perform private.lock_user_pair(v_actor_id, v_counterpart_id);
  if p_blocked then
    insert into public.blocks (blocker_id, blocked_id)
    values (v_actor_id, v_counterpart_id)
    on conflict do nothing;
  else
    delete from public.blocks b
    where b.blocker_id = v_actor_id and b.blocked_id = v_counterpart_id;
  end if;
  return p_blocked;
end;
$$;

create function public.report_conversation_participant(
  p_conversation_id uuid,
  p_reason public.report_reason,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_counterpart_id uuid;
  v_report_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) not between 10 and 3000 then
    raise exception 'report description length is invalid' using errcode = '23514';
  end if;
  select case when mt.client_id = v_actor_id then mt.talent_id else mt.client_id end
  into v_counterpart_id
  from public.conversations c
  join public.matches mt on mt.id = c.match_id
  join public.conversation_members cm
    on cm.conversation_id = c.id and cm.profile_id = v_actor_id
  where c.id = p_conversation_id;
  if v_counterpart_id is null then
    raise exception 'conversation access is not authorized' using errcode = '42501';
  end if;
  insert into public.reports (
    reporter_id, target_type, target_profile_id, reason, description
  ) values (
    v_actor_id, 'profile', v_counterpart_id, p_reason, btrim(p_description)
  ) returning id into v_report_id;
  return v_report_id;
end;
$$;

create function private.valid_notification_path(p_path text, p_recipient_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_path text := p_path;
  v_resource_id uuid;
begin
  if v_path = '/applications' or v_path like '/missions/%/applications' then
    return '/espace/candidatures';
  elsif v_path like '/missions/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 3));
    if private.can_view_mission(v_resource_id, p_recipient_id) then
      return '/espace/missions/' || v_resource_id::text;
    end if;
    return '/espace/missions';
  elsif v_path like '/matches/%/agreement' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 3));
    if private.is_match_participant(v_resource_id, p_recipient_id) then
      return '/espace/matches/' || v_resource_id::text;
    end if;
    return '/espace/matches';
  elsif v_path = '/profile' then
    return '/espace/profil';
  elsif v_path = '/espace/candidatures'
     or v_path = '/espace/matches'
     or v_path = '/espace/missions'
     or v_path = '/espace/profil' then
    return v_path;
  elsif v_path like '/espace/messages/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 4));
    if private.is_conversation_member(v_resource_id, p_recipient_id) then
      return '/espace/messages/' || v_resource_id::text;
    end if;
  elsif v_path like '/espace/matches/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 4));
    if private.is_match_participant(v_resource_id, p_recipient_id) then
      return '/espace/matches/' || v_resource_id::text;
    end if;
  elsif v_path like '/espace/missions/%' then
    v_resource_id := private.safe_uuid(split_part(v_path, '/', 4));
    if private.can_view_mission(v_resource_id, p_recipient_id) then
      return '/espace/missions/' || v_resource_id::text;
    end if;
  end if;
  return '/espace/notifications';
end;
$$;

create function public.list_notifications(
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  notification_id uuid,
  type public.notification_type,
  title text,
  body text,
  internal_path text,
  read_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_page < 1 or p_page_size not between 1 and 50 then
    raise exception 'invalid pagination' using errcode = '22023';
  end if;
  return query
  select
    n.id,
    n.type,
    n.title,
    n.body,
    private.valid_notification_path(n.internal_path, v_actor_id),
    n.read_at,
    n.created_at,
    count(*) over()
  from public.notifications n
  where n.recipient_id = v_actor_id
  order by n.created_at desc, n.id desc
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

create function public.mark_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_read_at timestamptz;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  update public.notifications n
  set read_at = coalesce(n.read_at, statement_timestamp())
  where n.id = p_notification_id and n.recipient_id = v_actor_id
  returning n.read_at into v_read_at;
  if v_read_at is null then
    raise exception 'notification access is not authorized' using errcode = '42501';
  end if;
  return v_read_at;
end;
$$;

create function public.mark_all_notifications_read()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_count bigint;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  update public.notifications n
  set read_at = statement_timestamp()
  where n.recipient_id = v_actor_id and n.read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke insert, update, delete on public.messages from authenticated;
grant select on public.messages to authenticated;

revoke execute on function private.valid_notification_path(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.list_conversations(text, boolean, integer, integer)
  from public, anon;
revoke execute on function public.get_conversation_workspace(uuid) from public, anon;
revoke execute on function public.list_messages(uuid, timestamptz, uuid, integer)
  from public, anon;
revoke execute on function public.send_message(uuid, uuid, text, text, text, text, integer)
  from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.set_conversation_archived(uuid, boolean) from public, anon;
revoke execute on function public.delete_message(uuid) from public, anon;
revoke execute on function public.set_conversation_block(uuid, boolean) from public, anon;
revoke execute on function public.report_conversation_participant(uuid, public.report_reason, text)
  from public, anon;
revoke execute on function public.list_notifications(integer, integer) from public, anon;
revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;

grant execute on function public.list_conversations(text, boolean, integer, integer)
  to authenticated;
grant execute on function public.get_conversation_workspace(uuid) to authenticated;
grant execute on function public.list_messages(uuid, timestamptz, uuid, integer)
  to authenticated;
grant execute on function public.send_message(uuid, uuid, text, text, text, text, integer)
  to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
grant execute on function public.delete_message(uuid) to authenticated;
grant execute on function public.set_conversation_block(uuid, boolean) to authenticated;
grant execute on function public.report_conversation_participant(uuid, public.report_reason, text)
  to authenticated;
grant execute on function public.list_notifications(integer, integer) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

alter table public.messages replica identity full;
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

comment on function public.send_message(uuid, uuid, text, text, text, text, integer) is
  'Idempotent participant-only send with server identity, active-match/block checks, rate limiting, attachment ownership and one real notification.';
comment on function public.list_messages(uuid, timestamptz, uuid, integer) is
  'Keyset-paginated participant-only message projection that redacts deleted content.';
comment on function public.list_notifications(integer, integer) is
  'Recipient-only notification center with internal resource links normalized and authorized server-side.';
