-- SkillMatch phase 03: least-privilege grants, reusable authorization helpers,
-- and row-level policies for every application table.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.is_moderator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_user_id
        and ur.role in ('admin', 'moderator')
    );
$$;

create function private.users_are_blocked(p_first_user_id uuid, p_second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_first_user_id is not null
    and p_second_user_id is not null
    and exists (
      select 1
      from public.blocks b
      where (b.blocker_id = p_first_user_id and b.blocked_id = p_second_user_id)
         or (b.blocker_id = p_second_user_id and b.blocked_id = p_first_user_id)
    );
$$;

create function private.is_public_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.onboarding_completed
      and p.deleted_at is null
  );
$$;

create function private.is_match_participant(
  p_match_id uuid,
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
      from public.matches m
      where m.id = p_match_id
        and p_user_id in (m.client_id, m.talent_id)
    );
$$;

create function private.is_mission_participant(
  p_mission_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and (
      exists (
        select 1
        from public.missions ms
        where ms.id = p_mission_id
          and p_user_id in (ms.owner_id, ms.assigned_talent_id)
      )
      or exists (
        select 1
        from public.matches mt
        where mt.mission_id = p_mission_id
          and p_user_id in (mt.client_id, mt.talent_id)
      )
    );
$$;

create function private.is_conversation_member(
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
      from public.conversation_members cm
      where cm.conversation_id = p_conversation_id
        and cm.profile_id = p_user_id
    );
$$;

create function private.can_view_mission(
  p_mission_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.missions ms
    where ms.id = p_mission_id
      and ms.deleted_at is null
      and (
        (p_user_id is not null and ms.owner_id = p_user_id)
        or (p_user_id is not null and ms.assigned_talent_id = p_user_id)
        or ms.status in ('published', 'selecting')
        or private.is_moderator(p_user_id)
        or private.is_mission_participant(ms.id, p_user_id)
      )
  );
$$;

create function private.can_edit_mission(
  p_mission_id uuid,
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
      from public.missions ms
      where ms.id = p_mission_id
        and ms.owner_id = p_user_id
        and ms.status in ('draft', 'published', 'selecting')
        and ms.deleted_at is null
    );
$$;

create function private.can_apply_to_mission(
  p_mission_id uuid,
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
      from public.missions ms
      join public.profiles applicant on applicant.id = p_user_id
      where ms.id = p_mission_id
        and ms.status in ('published', 'selecting')
        and ms.deleted_at is null
        and ms.owner_id <> p_user_id
        and applicant.can_work
        and applicant.deleted_at is null
        and not private.users_are_blocked(ms.owner_id, p_user_id)
    );
$$;

create function private.can_view_availability(
  p_profile_id uuid,
  p_visibility public.availability_visibility,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_user_id is not null and p_profile_id = p_user_id)
    or private.is_moderator(p_user_id)
    or p_visibility = 'public'
    or (
      p_visibility = 'matched'
      and p_user_id is not null
      and exists (
        select 1
        from public.matches mt
        where mt.status = 'active'
          and (
            (mt.client_id = p_profile_id and mt.talent_id = p_user_id)
            or (mt.talent_id = p_profile_id and mt.client_id = p_user_id)
          )
      )
    );
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;

-- Public data remains deliberately narrow. The base profiles table is never a
-- public directory; a later RPC exposes only an allow-list of columns.
create policy profiles_select_private
on public.profiles
for select
to authenticated
using (id = auth.uid() or private.is_moderator());

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid() and deleted_at is null);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy skills_select_active
on public.skills
for select
to anon, authenticated
using (is_active or private.is_moderator());

create policy skills_insert_moderator
on public.skills
for insert
to authenticated
with check (private.is_moderator());

create policy skills_update_moderator
on public.skills
for update
to authenticated
using (private.is_moderator())
with check (private.is_moderator());

create policy skills_delete_moderator
on public.skills
for delete
to authenticated
using (private.is_moderator());

create policy profile_skills_select_visible
on public.profile_skills
for select
to anon, authenticated
using (
  profile_id = auth.uid()
  or private.is_public_profile(profile_id)
  or private.is_moderator()
);

create policy profile_skills_insert_own
on public.profile_skills
for insert
to authenticated
with check (profile_id = auth.uid());

create policy profile_skills_update_own
on public.profile_skills
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy profile_skills_delete_own
on public.profile_skills
for delete
to authenticated
using (profile_id = auth.uid());

create policy availability_slots_select_visible
on public.availability_slots
for select
to anon, authenticated
using (private.can_view_availability(profile_id, visibility));

create policy availability_slots_insert_own
on public.availability_slots
for insert
to authenticated
with check (profile_id = auth.uid());

create policy availability_slots_update_own
on public.availability_slots
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy availability_slots_delete_own
on public.availability_slots
for delete
to authenticated
using (profile_id = auth.uid());

create policy missions_select_visible
on public.missions
for select
to authenticated
using (private.can_view_mission(id));

create policy missions_insert_own_draft
on public.missions
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and status = 'draft'
  and assigned_talent_id is null
  and deleted_at is null
  and lock_version = 1
);

create policy missions_update_editable
on public.missions
for update
to authenticated
using (private.can_edit_mission(id))
with check (owner_id = auth.uid());

create policy mission_private_locations_select_participant
on public.mission_private_locations
for select
to authenticated
using (
  private.is_mission_participant(mission_id)
  or private.is_moderator()
);

create policy mission_private_locations_insert_owner
on public.mission_private_locations
for insert
to authenticated
with check (private.can_edit_mission(mission_id));

create policy mission_private_locations_update_owner
on public.mission_private_locations
for update
to authenticated
using (private.can_edit_mission(mission_id))
with check (private.can_edit_mission(mission_id));

create policy mission_private_locations_delete_owner
on public.mission_private_locations
for delete
to authenticated
using (private.can_edit_mission(mission_id));

create policy mission_skills_select_visible
on public.mission_skills
for select
to authenticated
using (private.can_view_mission(mission_id));

create policy mission_skills_insert_owner
on public.mission_skills
for insert
to authenticated
with check (private.can_edit_mission(mission_id));

create policy mission_skills_update_owner
on public.mission_skills
for update
to authenticated
using (private.can_edit_mission(mission_id))
with check (private.can_edit_mission(mission_id));

create policy mission_skills_delete_owner
on public.mission_skills
for delete
to authenticated
using (private.can_edit_mission(mission_id));

create policy applications_select_parties
on public.applications
for select
to authenticated
using (
  applicant_id = auth.uid()
  or private.is_moderator()
  or exists (
    select 1
    from public.missions ms
    where ms.id = applications.mission_id
      and ms.owner_id = auth.uid()
  )
);

create policy applications_insert_own
on public.applications
for insert
to authenticated
with check (
  applicant_id = auth.uid()
  and status = 'submitted'
  and deleted_at is null
  and lock_version = 1
  and relevance_score is null
  and score_version is null
  and relevance_details = '{}'::jsonb
  and private.can_apply_to_mission(mission_id)
);

create policy swipes_select_own
on public.swipes
for select
to authenticated
using (author_id = auth.uid());

create policy swipes_insert_own
on public.swipes
for insert
to authenticated
with check (
  author_id = auth.uid()
  and (target_profile_id is null or private.is_public_profile(target_profile_id))
  and (target_mission_id is null or private.can_view_mission(target_mission_id))
);

create policy swipes_update_own
on public.swipes
for update
to authenticated
using (author_id = auth.uid())
with check (
  author_id = auth.uid()
  and (target_profile_id is null or private.is_public_profile(target_profile_id))
  and (target_mission_id is null or private.can_view_mission(target_mission_id))
);

create policy swipes_delete_own
on public.swipes
for delete
to authenticated
using (author_id = auth.uid());

create policy matches_select_participants
on public.matches
for select
to authenticated
using (auth.uid() in (client_id, talent_id) or private.is_moderator());

create policy agreements_select_participants
on public.agreements
for select
to authenticated
using (private.is_match_participant(match_id) or private.is_moderator());

create policy conversations_select_members
on public.conversations
for select
to authenticated
using (private.is_conversation_member(id) or private.is_moderator());

create policy conversation_members_select_members
on public.conversation_members
for select
to authenticated
using (private.is_conversation_member(conversation_id) or private.is_moderator());

create policy conversation_members_update_own
on public.conversation_members
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy messages_select_members
on public.messages
for select
to authenticated
using (private.is_conversation_member(conversation_id) or private.is_moderator());

create policy messages_insert_member
on public.messages
for insert
to authenticated
with check (
  author_id = auth.uid()
  and private.is_conversation_member(conversation_id)
);

create policy messages_update_author
on public.messages
for update
to authenticated
using (author_id = auth.uid() and private.is_conversation_member(conversation_id))
with check (author_id = auth.uid() and private.is_conversation_member(conversation_id));

create policy mission_events_select_participants
on public.mission_events
for select
to authenticated
using (private.is_mission_participant(mission_id) or private.is_moderator());

create policy completion_confirmations_select_participants
on public.completion_confirmations
for select
to authenticated
using (private.is_match_participant(match_id) or private.is_moderator());

create policy completion_confirmations_insert_own
on public.completion_confirmations
for insert
to authenticated
with check (
  participant_id = auth.uid()
  and private.is_match_participant(match_id)
);

create policy notifications_select_recipient
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid() or private.is_moderator());

create policy notifications_update_recipient
on public.notifications
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy reviews_select_public
on public.reviews
for select
to anon, authenticated
using (true);

create policy reviews_insert_participant
on public.reviews
for insert
to authenticated
with check (
  author_id = auth.uid()
  and private.is_match_participant(match_id)
  and recipient_id <> auth.uid()
);

create policy favorites_select_own
on public.favorites
for select
to authenticated
using (profile_id = auth.uid());

create policy favorites_insert_own
on public.favorites
for insert
to authenticated
with check (profile_id = auth.uid() and private.can_view_mission(mission_id));

create policy favorites_delete_own
on public.favorites
for delete
to authenticated
using (profile_id = auth.uid());

create policy blocks_select_own
on public.blocks
for select
to authenticated
using (blocker_id = auth.uid());

create policy blocks_insert_own
on public.blocks
for insert
to authenticated
with check (blocker_id = auth.uid());

create policy blocks_delete_own
on public.blocks
for delete
to authenticated
using (blocker_id = auth.uid());

create policy user_roles_select_authorized
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or private.is_moderator());

create policy reports_select_authorized
on public.reports
for select
to authenticated
using (reporter_id = auth.uid() or private.is_moderator());

create policy reports_insert_own
on public.reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and status = 'submitted'
  and resolved_at is null
);

create policy reports_update_moderator
on public.reports
for update
to authenticated
using (private.is_moderator())
with check (private.is_moderator());

-- Table grants are intentionally narrower than the policies. In particular,
-- status, participant and role columns are not directly writable by clients.
grant select, insert on public.profiles to authenticated;
grant update (
  username, display_name, headline, bio, primary_mode, can_work, can_hire,
  avatar_path, city, country_code, remote_available, adult_confirmed,
  onboarding_completed, deleted_at
) on public.profiles to authenticated;

grant select on public.skills to anon, authenticated;
grant insert, update, delete on public.skills to authenticated;
grant usage, select on sequence public.skills_id_seq to authenticated;

grant select on public.profile_skills to anon, authenticated;
grant insert, update, delete on public.profile_skills to authenticated;
grant select on public.availability_slots to anon, authenticated;
grant insert, update, delete on public.availability_slots to authenticated;

grant select, insert on public.missions to authenticated;
grant update (
  title, description, category, work_mode, public_city, public_region,
  country_code, budget_model, budget_min, budget_max, currency_code,
  starts_on, ends_on, flexible_schedule, required_level, max_applications,
  deleted_at
) on public.missions to authenticated;

grant select, insert, update, delete on public.mission_private_locations to authenticated;
grant select, insert, update, delete on public.mission_skills to authenticated;
grant select, insert on public.applications to authenticated;
grant select, insert, update, delete on public.swipes to authenticated;
grant select on public.matches to authenticated;
grant select on public.agreements to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant update (last_read_at, archived_at) on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant update (body, attachment_path, edited_at, deleted_at) on public.messages to authenticated;
grant select on public.mission_events to authenticated;
grant select, insert on public.completion_confirmations to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert on public.reports to authenticated;
grant update (status, resolved_at) on public.reports to authenticated;

comment on schema private is
  'Non-exposed authorization helpers used by RLS and controlled RPCs.';
comment on function private.users_are_blocked(uuid, uuid) is
  'A block in either direction prevents new applications, matches and messages; existing history remains readable to its participants.';
