-- =========================================================================
-- 0002_rls.sql
-- Helpers and Row Level Security policies for the debate chat app.
--
-- Model:
--   - app_admin: profiles.role = 'app_admin'  → can do anything
--   - chair:    rooms.chair_id = auth.uid()   → manages their own rooms
--   - user:     authenticated, can self-service own row, post in current room
--
-- Writes that touch other users' rows are performed via the Service Role
-- from API routes / server actions (e.g. chair adds users, kicks users,
-- inserts notifications for unknown login attempts).
-- =========================================================================

-- ---------- Helper functions ----------
create or replace function public.current_room_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select room_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_app_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = 'app_admin',
    false
  )
$$;

create or replace function public.is_chair_of(rid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rooms
    where id = rid and chair_id = auth.uid()
  )
$$;

create or replace function public.chair_room_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.rooms where chair_id = auth.uid()
$$;

revoke all on function public.current_room_id()  from public;
revoke all on function public.is_app_admin()     from public;
revoke all on function public.is_chair_of(uuid)  from public;
revoke all on function public.chair_room_ids()   from public;
grant execute on function public.current_room_id()  to authenticated;
grant execute on function public.is_app_admin()     to authenticated;
grant execute on function public.is_chair_of(uuid)  to authenticated;
grant execute on function public.chair_room_ids()   to authenticated;

-- ---------- Enable RLS ----------
alter table public.profiles          enable row level security;
alter table public.rooms             enable row level security;
alter table public.messages          enable row level security;
alter table public.stances           enable row level security;
alter table public.notifications     enable row level security;
alter table public.room_participants enable row level security;
alter table public.message_likes     enable row level security;

-- ---------- profiles ----------
-- Read: own row, app_admin, same-room, or chair of any room the target
-- profile currently belongs to.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_app_admin()
    or (room_id is not null and room_id = public.current_room_id())
    or (room_id is not null and room_id in (select public.chair_room_ids()))
  );

-- Update: only your own row (nickname etc), or app_admin.
-- Chair-driven kicks/assignments go through Service Role from API routes.
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_app_admin())
  with check (id = auth.uid() or public.is_app_admin());

-- Insert/Delete are not allowed from the client; only the trigger or
-- the Service Role may insert/delete profiles.

-- ---------- rooms ----------
-- Read: a member of the room, the chair of the room, or an app_admin.
create policy rooms_select on public.rooms
  for select to authenticated
  using (
    public.is_app_admin()
    or chair_id = auth.uid()
    or id = public.current_room_id()
  );

-- Insert: anyone authenticated may create a room and must list themselves
-- as the chair.
create policy rooms_insert on public.rooms
  for insert to authenticated
  with check (chair_id = auth.uid() or public.is_app_admin());

create policy rooms_update on public.rooms
  for update to authenticated
  using (chair_id = auth.uid() or public.is_app_admin())
  with check (chair_id = auth.uid() or public.is_app_admin());

create policy rooms_delete on public.rooms
  for delete to authenticated
  using (chair_id = auth.uid() or public.is_app_admin());

-- ---------- messages ----------
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.is_app_admin()
    or room_id = public.current_room_id()
    or public.is_chair_of(room_id)
  );

-- Students post 'pro' / 'con' messages in the room they belong to.
-- Chair (or app_admin) posts neutral 'chair' messages in any room they
-- moderate, without needing to be a "member" via profiles.room_id.
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_important = false
    and (
      (stance in ('pro', 'con') and room_id = public.current_room_id())
      or (stance = 'chair'
          and (public.is_chair_of(room_id) or public.is_app_admin()))
    )
  );

-- Update / delete:
--   - Chair of the room and app_admin: full moderation (is_important toggle,
--     edit any content, soft-delete via deleted_at).
--   - Message author: may edit their own content (train-of-thought fix).
--   - Actual hard delete is routed through a chair-only server action
--     for replies, but DELETE policy still allows authors to remove their
--     own message.
create policy messages_update on public.messages
  for update to authenticated
  using (
    public.is_chair_of(room_id)
    or public.is_app_admin()
    or user_id = auth.uid()
  )
  with check (
    public.is_chair_of(room_id)
    or public.is_app_admin()
    or user_id = auth.uid()
  );

create policy messages_delete on public.messages
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_chair_of(room_id)
    or public.is_app_admin()
  );

-- ---------- stances ----------
create policy stances_select on public.stances
  for select to authenticated
  using (
    public.is_app_admin()
    or room_id = public.current_room_id()
    or public.is_chair_of(room_id)
  );

create policy stances_insert on public.stances
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and room_id = public.current_room_id()
  );

create policy stances_update on public.stances
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and room_id = public.current_room_id());

create policy stances_delete on public.stances
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_chair_of(room_id)
    or public.is_app_admin()
  );

-- ---------- message_likes ----------
-- Read: anyone who can read the underlying message (same room member, chair,
-- or app_admin). We re-check via EXISTS on messages so RLS on messages
-- transitively applies.
create policy message_likes_select on public.message_likes
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and (
          public.is_app_admin()
          or m.room_id = public.current_room_id()
          or public.is_chair_of(m.room_id)
        )
    )
  );

-- Insert: only yourself, and only when:
--   - the target message is in a room with likes_enabled = true,
--   - the target message is NOT your own (UI also hides the button),
--   - the target message is not soft-deleted.
create policy message_likes_insert on public.message_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages m
      join public.rooms r on r.id = m.room_id
      where m.id = message_id
        and r.likes_enabled = true
        and m.user_id <> auth.uid()
        and m.deleted_at is null
    )
  );

-- Delete: only your own like row (to unlike).
create policy message_likes_delete on public.message_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------- notifications ----------
-- Read / update (mark as read) / delete: chair of the room or app_admin.
-- Insert is restricted to the Service Role (server actions); the unknown
-- login attempt may originate from an unauthenticated visitor, so no
-- client-side INSERT policy is granted.
create policy notifications_select on public.notifications
  for select to authenticated
  using (public.is_app_admin() or public.is_chair_of(room_id));

create policy notifications_update on public.notifications
  for update to authenticated
  using (public.is_app_admin() or public.is_chair_of(room_id))
  with check (public.is_app_admin() or public.is_chair_of(room_id));

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (public.is_app_admin() or public.is_chair_of(room_id));

-- ---------- room_participants ----------
-- Read:
--   - Own row (so the student can verify they are still seen as "in").
--   - Chair of the room or app_admin (for the live roster on /manage).
create policy room_participants_select on public.room_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_app_admin()
    or public.is_chair_of(room_id)
  );

-- Update: only your own row's heartbeat. The Service Role bypasses RLS
-- and is used in confirmEnter() for upsert with a fresh entry_token.
create policy room_participants_update on public.room_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delete: own row (explicit exit), or chair/app_admin (force kick).
-- The /api/leave endpoint uses Service Role with a token check.
create policy room_participants_delete on public.room_participants
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_app_admin()
    or public.is_chair_of(room_id)
  );

-- INSERT is intentionally not granted to clients; only Service Role
-- (confirmEnter()) creates rows so we can enforce the active-session
-- check and emit the duplicate_entry_attempt notification atomically.
