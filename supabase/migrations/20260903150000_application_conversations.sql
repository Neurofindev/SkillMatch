-- Conversations start from a real application and are reused by the later match.

alter table public.conversations
  add column application_id uuid;

update public.conversations c
set application_id = mt.accepted_application_id
from public.matches mt
where mt.id = c.match_id;

alter table public.conversations
  alter column application_id set not null,
  alter column match_id drop not null;

alter table public.applications
  add constraint applications_id_mission_unique unique (id, mission_id);

alter table public.conversations
  add constraint conversations_application_unique unique (application_id),
  add constraint conversations_application_mission_fk
    foreign key (application_id, mission_id)
    references public.applications (id, mission_id)
    on delete cascade;

create function public.validate_conversation_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_mission_id uuid;
  v_match_application_id uuid;
  v_match_mission_id uuid;
begin
  select a.mission_id
  into v_application_mission_id
  from public.applications a
  where a.id = new.application_id;

  if v_application_mission_id is null
     or v_application_mission_id <> new.mission_id then
    raise exception 'conversation application and mission must match'
      using errcode = '23514';
  end if;

  if new.match_id is not null then
    select mt.accepted_application_id, mt.mission_id
    into v_match_application_id, v_match_mission_id
    from public.matches mt
    where mt.id = new.match_id;

    if v_match_application_id is null
       or v_match_application_id <> new.application_id
       or v_match_mission_id <> new.mission_id then
      raise exception 'conversation match must belong to its application and mission'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger conversations_validate_links
before insert or update of application_id, match_id, mission_id
on public.conversations
for each row execute function public.validate_conversation_links();

create or replace function public.validate_conversation_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_talent_id uuid;
begin
  select ms.owner_id, a.applicant_id
  into v_client_id, v_talent_id
  from public.conversations c
  join public.applications a on a.id = c.application_id
  join public.missions ms on ms.id = c.mission_id
  where c.id = new.conversation_id;

  if v_client_id is null then
    raise exception 'conversation application was not found' using errcode = '23514';
  end if;

  if new.profile_id not in (v_client_id, v_talent_id) then
    raise exception 'conversation members must be application participants'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.can_send_to_conversation(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.conversations c
      join public.applications a on a.id = c.application_id
      join public.missions ms on ms.id = c.mission_id
      left join public.matches mt on mt.id = c.match_id
      where c.id = p_conversation_id
        and p_user_id in (ms.owner_id, a.applicant_id)
        and private.is_active_profile(ms.owner_id)
        and private.is_active_profile(a.applicant_id)
        and not private.users_are_blocked(ms.owner_id, a.applicant_id)
        and (
          (
            c.match_id is null
            and a.deleted_at is null
            and a.status in ('submitted', 'viewed', 'shortlisted')
            and ms.deleted_at is null
            and ms.status in ('published', 'selecting')
          )
          or (
            c.match_id is not null
            and mt.status = 'active'
            and mt.accepted_application_id = a.id
          )
        )
    );
$$;

create or replace function public.validate_message_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_talent_id uuid;
  v_other_user_id uuid;
begin
  select ms.owner_id, a.applicant_id
  into v_client_id, v_talent_id
  from public.conversations c
  join public.applications a on a.id = c.application_id
  join public.missions ms on ms.id = c.mission_id
  where c.id = new.conversation_id;

  if new.author_id is null or new.author_id not in (v_client_id, v_talent_id) then
    raise exception 'message authors must be conversation participants'
      using errcode = '23514';
  end if;

  v_other_user_id := case
    when new.author_id = v_client_id then v_talent_id
    else v_client_id
  end;
  perform private.lock_user_pair(new.author_id, v_other_user_id);

  if private.users_are_blocked(new.author_id, v_other_user_id) then
    raise exception 'a block prevents new messages' using errcode = '42501';
  end if;

  if not private.can_send_to_conversation(new.conversation_id, new.author_id) then
    raise exception 'conversation is read-only' using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.get_application_conversation_state(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_application public.applications%rowtype;
  v_owner_id uuid;
  v_mission_status public.mission_status;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select a.*
  into v_application
  from public.applications a
  where a.id = p_application_id;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  select ms.owner_id, ms.status
  into strict v_owner_id, v_mission_status
  from public.missions ms
  where ms.id = v_application.mission_id;
  if v_actor_id not in (v_owner_id, v_application.applicant_id) then
    raise exception 'application conversation access is not authorized'
      using errcode = '42501';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.application_id = v_application.id;

  return jsonb_build_object(
    'conversationId', v_conversation_id,
    'canStart',
      v_conversation_id is null
      and v_application.deleted_at is null
      and v_application.status in ('submitted', 'viewed', 'shortlisted')
      and v_mission_status in ('published', 'selecting')
      and private.is_active_profile(v_owner_id)
      and private.is_active_profile(v_application.applicant_id)
      and not private.users_are_blocked(v_owner_id, v_application.applicant_id)
  );
end;
$$;

create function public.get_or_create_application_conversation(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_application public.applications%rowtype;
  v_owner_id uuid;
  v_mission_status public.mission_status;
  v_match_id uuid;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select a.*
  into v_application
  from public.applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  select ms.owner_id, ms.status
  into strict v_owner_id, v_mission_status
  from public.missions ms
  where ms.id = v_application.mission_id;
  if v_actor_id not in (v_owner_id, v_application.applicant_id) then
    raise exception 'application conversation access is not authorized'
      using errcode = '42501';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.application_id = v_application.id;
  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  if v_application.deleted_at is not null
     or v_application.status not in ('submitted', 'viewed', 'shortlisted')
     or v_mission_status not in ('published', 'selecting') then
    raise exception 'conversation can only be created for an active application'
      using errcode = '23514';
  end if;

  perform private.lock_user_pair(v_owner_id, v_application.applicant_id);
  if not private.is_active_profile(v_owner_id)
     or not private.is_active_profile(v_application.applicant_id) then
    raise exception 'active profiles are required for a conversation'
      using errcode = '42501';
  end if;
  if private.users_are_blocked(v_owner_id, v_application.applicant_id) then
    raise exception 'a block prevents this conversation' using errcode = '42501';
  end if;

  select mt.id into v_match_id
  from public.matches mt
  where mt.accepted_application_id = v_application.id;

  insert into public.conversations (application_id, match_id, mission_id)
  values (v_application.id, v_match_id, v_application.mission_id)
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, profile_id)
  values
    (v_conversation_id, v_owner_id),
    (v_conversation_id, v_application.applicant_id)
  on conflict do nothing;

  return v_conversation_id;
end;
$$;

drop function public.list_conversations(text, boolean, integer, integer);

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
      c.match_id,
      ms.id as mission_id,
      ms.title as mission_title,
      ms.status as mission_status,
      mt.status as match_status,
      case when ms.owner_id = v_actor_id then 'client' else 'talent' end
        as participant_role,
      counterpart.id as counterpart_id,
      counterpart.username::text as counterpart_username,
      counterpart.display_name as counterpart_display_name,
      counterpart.headline as counterpart_headline,
      counterpart.avatar_path as counterpart_avatar_path,
      latest.id as last_message_id,
      case when latest.deleted_at is not null then 'Message supprimé' else latest.body end
        as last_message_body,
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
    join public.applications a on a.id = c.application_id
    join public.missions ms on ms.id = c.mission_id
    left join public.matches mt on mt.id = c.match_id
    join public.profiles counterpart
      on counterpart.id = case
        when ms.owner_id = v_actor_id then a.applicant_id
        else ms.owner_id
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
  select visible.*, count(*) over() as total_count
  from visible
  order by coalesce(visible.last_message_at, '-infinity'::timestamptz) desc,
           visible.conversation_id
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

create or replace function public.get_conversation_workspace(p_conversation_id uuid)
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
      'canSend', private.can_send_to_conversation(c.id, v_actor_id),
      'isBlocked', private.users_are_blocked(ms.owner_id, a.applicant_id),
      'blockedByMe', exists (
        select 1 from public.blocks b
        where b.blocker_id = v_actor_id and b.blocked_id = counterpart.id
      )
    ),
    'application', jsonb_build_object('id', a.id, 'status', a.status),
    'match', case when mt.id is null then null else jsonb_build_object(
      'id', mt.id,
      'status', mt.status,
      'role', case when mt.client_id = v_actor_id then 'client' else 'talent' end
    ) end,
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
      'city', case when counterpart.show_approximate_location then counterpart.city end,
      'countryCode', case when counterpart.show_approximate_location then counterpart.country_code end,
      'remoteAvailable', counterpart.remote_available
    ),
    'agreement', case when agreement.id is null then null else jsonb_build_object(
      'id', agreement.id,
      'version', agreement.version,
      'status', agreement.status
    ) end
  ) into v_result
  from public.conversations c
  join public.conversation_members cm
    on cm.conversation_id = c.id and cm.profile_id = v_actor_id
  join public.applications a on a.id = c.application_id
  join public.missions ms on ms.id = c.mission_id
  left join public.matches mt on mt.id = c.match_id
  join public.profiles counterpart
    on counterpart.id = case
      when ms.owner_id = v_actor_id then a.applicant_id
      else ms.owner_id
    end
  left join lateral (
    select agreement_row.id, agreement_row.version, agreement_row.status
    from public.agreements agreement_row
    where agreement_row.match_id = mt.id
    order by agreement_row.version desc
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

create or replace function public.send_message(
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
  v_application public.applications%rowtype;
  v_client_id uuid;
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

  select a.*
  into v_application
  from public.conversations c
  join public.applications a on a.id = c.application_id
  where c.id = p_conversation_id;

  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  select ms.owner_id, ms.title
  into strict v_client_id, v_mission_title
  from public.missions ms
  where ms.id = v_application.mission_id;
  if v_actor_id not in (v_client_id, v_application.applicant_id) then
    raise exception 'conversation access is not authorized' using errcode = '42501';
  end if;

  v_counterpart_id := case
    when v_actor_id = v_client_id then v_application.applicant_id
    else v_client_id
  end;
  perform private.lock_user_pair(v_actor_id, v_counterpart_id);
  if private.users_are_blocked(v_actor_id, v_counterpart_id) then
    raise exception 'a block prevents new messages' using errcode = '42501';
  end if;
  if not private.can_send_to_conversation(p_conversation_id, v_actor_id) then
    raise exception 'conversation is read-only' using errcode = '23514';
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
    or p_attachment_name ~ '[/\\[:cntrl:]]'
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

create or replace function public.set_conversation_block(
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

  select case when ms.owner_id = v_actor_id then a.applicant_id else ms.owner_id end
  into v_counterpart_id
  from public.conversations c
  join public.applications a on a.id = c.application_id
  join public.missions ms on ms.id = c.mission_id
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

create or replace function public.report_conversation_participant(
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

  select case when ms.owner_id = v_actor_id then a.applicant_id else ms.owner_id end
  into v_counterpart_id
  from public.conversations c
  join public.applications a on a.id = c.application_id
  join public.missions ms on ms.id = c.mission_id
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

create or replace function public.accept_application(
  p_application_id uuid,
  p_expected_mission_version integer,
  p_expected_application_version integer
)
returns table (
  match_id uuid,
  conversation_id uuid,
  mission_status public.mission_status,
  mission_lock_version integer,
  application_status public.application_status,
  application_lock_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_application public.applications%rowtype;
  v_mission public.missions%rowtype;
  v_match_id uuid;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_expected_mission_version < 1 or p_expected_application_version < 1 then
    raise exception 'expected versions must be positive' using errcode = '22023';
  end if;

  select ms.* into v_mission
  from public.missions ms
  join public.applications a on a.mission_id = ms.id
  where a.id = p_application_id
  for update of ms;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_mission.owner_id <> v_actor_id then
    raise exception 'only the mission owner can accept an application'
      using errcode = '42501';
  end if;

  select a.* into v_application
  from public.applications a
  where a.id = p_application_id and a.mission_id = v_mission.id
  for update;

  select mt.id, c.id
  into v_match_id, v_conversation_id
  from public.matches mt
  left join public.conversations c on c.application_id = v_application.id
  where mt.mission_id = v_mission.id
    and mt.accepted_application_id = v_application.id;

  if v_match_id is not null
     and v_application.status = 'accepted'
     and v_mission.assigned_talent_id = v_application.applicant_id then
    if v_conversation_id is null then
      insert into public.conversations (application_id, match_id, mission_id)
      values (v_application.id, v_match_id, v_mission.id)
      returning id into v_conversation_id;
    end if;
    insert into public.conversation_members (conversation_id, profile_id)
    values
      (v_conversation_id, v_mission.owner_id),
      (v_conversation_id, v_application.applicant_id)
    on conflict do nothing;
    perform private.ensure_initial_agreement(
      v_match_id, v_mission.id, v_application.id, v_actor_id
    );
    match_id := v_match_id;
    conversation_id := v_conversation_id;
    mission_status := v_mission.status;
    mission_lock_version := v_mission.lock_version;
    application_status := v_application.status;
    application_lock_version := v_application.lock_version;
    return next;
    return;
  end if;

  if v_mission.lock_version <> p_expected_mission_version then
    raise exception 'stale mission version' using errcode = '40001';
  end if;
  if v_application.lock_version <> p_expected_application_version then
    raise exception 'stale application version' using errcode = '40001';
  end if;
  if v_mission.status <> 'selecting' or v_mission.assigned_talent_id is not null then
    raise exception 'mission is not ready for acceptance' using errcode = '23514';
  end if;
  if v_application.status <> 'shortlisted' or v_application.deleted_at is not null then
    raise exception 'application is not ready for acceptance' using errcode = '23514';
  end if;

  perform private.lock_user_pair(v_mission.owner_id, v_application.applicant_id);
  if private.users_are_blocked(v_mission.owner_id, v_application.applicant_id) then
    raise exception 'a block prevents this acceptance' using errcode = '42501';
  end if;

  update public.applications a
  set status = 'accepted'
  where a.id = v_application.id
  returning a.status, a.lock_version
  into application_status, application_lock_version;

  with rejected as (
    update public.applications a
    set status = 'rejected'
    where a.mission_id = v_mission.id
      and a.id <> v_application.id
      and a.deleted_at is null
      and a.status in ('submitted', 'viewed', 'shortlisted')
    returning a.applicant_id
  )
  insert into public.notifications (recipient_id, type, title, body, internal_path)
  select
    rejected.applicant_id,
    'application_status_changed',
    'Candidature clôturée',
    'Une autre candidature a été retenue pour cette mission.',
    '/espace/candidatures'
  from rejected;

  update public.missions ms
  set status = 'assigned', assigned_talent_id = v_application.applicant_id
  where ms.id = v_mission.id
  returning ms.status, ms.lock_version
  into mission_status, mission_lock_version;

  insert into public.matches (
    mission_id, accepted_application_id, client_id, talent_id
  ) values (
    v_mission.id, v_application.id, v_mission.owner_id, v_application.applicant_id
  ) returning id into v_match_id;

  select c.id into v_conversation_id
  from public.conversations c
  where c.application_id = v_application.id
  for update;

  if v_conversation_id is null then
    insert into public.conversations (application_id, match_id, mission_id)
    values (v_application.id, v_match_id, v_mission.id)
    returning id into v_conversation_id;
  else
    update public.conversations c
    set match_id = v_match_id
    where c.id = v_conversation_id;
  end if;

  insert into public.conversation_members (conversation_id, profile_id)
  values
    (v_conversation_id, v_mission.owner_id),
    (v_conversation_id, v_application.applicant_id)
  on conflict do nothing;

  insert into public.mission_events (
    mission_id, actor_id, event_type, old_values, new_values, metadata
  ) values (
    v_mission.id,
    v_actor_id,
    'talent_assigned',
    jsonb_build_object('status', v_mission.status, 'lock_version', v_mission.lock_version),
    jsonb_build_object('status', mission_status, 'lock_version', mission_lock_version),
    jsonb_build_object('application_id', v_application.id, 'match_id', v_match_id)
  );

  perform private.ensure_initial_agreement(
    v_match_id, v_mission.id, v_application.id, v_actor_id
  );

  insert into public.notifications (recipient_id, type, title, body, internal_path)
  values (
    v_application.applicant_id,
    'match_created',
    'Candidature acceptée',
    'Votre candidature a été acceptée. L’accord de mission doit maintenant être confirmé.',
    '/espace/matches/' || v_match_id::text
  );

  match_id := v_match_id;
  conversation_id := v_conversation_id;
  return next;
end;
$$;

revoke execute on function public.validate_conversation_links()
  from public, anon, authenticated;
revoke execute on function public.get_application_conversation_state(uuid)
  from public, anon;
revoke execute on function public.get_or_create_application_conversation(uuid)
  from public, anon;
revoke execute on function public.list_conversations(text, boolean, integer, integer)
  from public, anon;

grant execute on function public.get_application_conversation_state(uuid)
  to authenticated;
grant execute on function public.get_or_create_application_conversation(uuid)
  to authenticated;
grant execute on function public.list_conversations(text, boolean, integer, integer)
  to authenticated;

comment on column public.conversations.application_id is
  'The real application that authorizes the private conversation before and after acceptance.';
comment on function public.get_or_create_application_conversation(uuid) is
  'Idempotently creates one participant-only conversation for an active real application.';
comment on function public.send_message(uuid, uuid, text, text, text, text, integer) is
  'Idempotent participant-only send for an active application or active match, with block, rate, attachment and notification controls.';
comment on function public.accept_application(uuid, integer, integer) is
  'Atomically accepts one shortlisted application and reuses its unique conversation while creating the unique match, agreement, events and notifications.';
