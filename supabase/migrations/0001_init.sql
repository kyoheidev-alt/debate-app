-- =========================================================================
-- 0001_init.sql
-- Schema for the anonymous debate chat app.
--
-- Roles:
--   profiles.role = 'user' | 'app_admin'
--   chair-ness is per-room via rooms.chair_id
--
-- Entry flow:
--   profiles.has_set_nickname is flipped to true after the student finishes
--   the STEP3 nickname setup.
--   notifications carries chair-only events such as unknown_login_attempt.
-- =========================================================================

create extension if not exists pgcrypto;

-- ---------- profiles ----------
-- Linked 1:1 to auth.users. Holds nickname, real name, role, and current room.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  login_id text not null unique,
  nickname text not null,
  role text not null default 'user' check (role in ('user', 'app_admin')),
  room_id uuid,                              -- FK added after rooms exists
  has_set_nickname boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- rooms ----------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  theme text not null,
  chair_id uuid not null references public.profiles(id) on delete cascade,
  is_name_visible boolean not null default false,
  -- When false, the "like" (heart) UI is hidden from everyone in the room
  -- and message_likes inserts are rejected by RLS.
  likes_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index rooms_chair_idx on public.rooms (chair_id);

-- Now that rooms exists, attach the FK from profiles.room_id.
alter table public.profiles
  add constraint profiles_room_id_fkey
  foreign key (room_id) references public.rooms(id) on delete set null;

-- ---------- messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Soft-deleted messages keep the row (so replies/likes stay anchored)
  -- but we blank the content from the client-visible payload.
  content text not null check (length(content) between 0 and 2000),
  -- 'pro' / 'con' = student stances (left/right in chat).
  -- 'chair'      = neutral message from chair / app_admin (center, badge).
  stance text not null check (stance in ('pro', 'con', 'chair')),
  is_important boolean not null default false,
  parent_id uuid references public.messages(id) on delete cascade,
  -- Set when the author edits their content. UI shows "(編集済み)".
  edited_at timestamptz,
  -- Set by the chair / app_admin on soft-delete. UI replaces the body
  -- with "[議長により削除されました]". Replies and likes are preserved.
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_room_created_idx
  on public.messages (room_id, created_at);
create index messages_parent_idx
  on public.messages (parent_id);
create index messages_room_important_idx
  on public.messages (room_id, is_important)
  where is_important;

-- ---------- stances ----------
-- The current stance (pro/con) of each user in each room.
create table public.stances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  stance text not null check (stance in ('pro', 'con')),
  updated_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

create index stances_room_idx on public.stances (room_id);

-- ---------- message_likes ----------
-- One "like" per (message, user). Enabled/disabled per-room via
-- rooms.likes_enabled (enforced by RLS). Chairs/app_admins may like too.
-- Users cannot like their own message (enforced by RLS + UI).
create table public.message_likes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_likes_message_idx on public.message_likes (message_id);
create index message_likes_user_idx    on public.message_likes (user_id);

-- ---------- room_participants ----------
-- Tracks which students are currently "in" a room (presence).
--   - INSERT/UPSERT happens in `confirmEnter` (Service Role) and assigns a
--     fresh `entry_token` so we can detect when a different browser tries
--     to claim the same student. The token is also written to an httpOnly
--     cookie so the client's heartbeat can prove it owns the row.
--   - Heartbeat updates `last_seen_at` every ~30s. A row whose last_seen_at
--     is older than 60s is considered stale and may be replaced by a new
--     entry (the original holder will get { stillIn: false } on its next
--     heartbeat and be redirected out).
--   - Chairs/app_admins are NOT recorded here (they may use multiple
--     devices simultaneously for moderation).
create table public.room_participants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_token uuid not null default gen_random_uuid(),
  joined_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_participants_room_seen_idx
  on public.room_participants (room_id, last_seen_at);

-- ---------- notifications ----------
-- Per-room notifications consumed by the chair (e.g. unknown login attempts
-- from the student entry flow). INSERT is performed via the Service Role
-- only; chairs read/update/delete via RLS.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  kind text not null check (
    kind in ('unknown_login_attempt', 'duplicate_entry_attempt')
  ),
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_room_created_idx
  on public.notifications (room_id, created_at desc);

create index notifications_room_unread_idx
  on public.notifications (room_id)
  where read_at is null;

-- ---------- handle_new_user trigger ----------
-- Auto-create a profile row whenever a new auth.users row is inserted.
--
-- Two creation paths:
--   1. Chair / app_admin: uses the public Supabase signUp() with a real
--      email (e.g. tanaka@example.com). No login_id is provided, so we
--      use the full email as login_id (UNIQUE-safe and easy to look up).
--   2. Student: chair calls Service Role admin.createUser with a synthetic
--      email <id>@debate.local AND user_metadata.login_id = '<id>'.
--      We use that explicit login_id so chairs can reference students by
--      their student number.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login_id text;
  v_name     text;
  v_nickname text;
begin
  v_login_id := coalesce(
    new.raw_user_meta_data->>'login_id',
    new.email
  );
  v_name     := coalesce(new.raw_user_meta_data->>'name',     v_login_id);
  v_nickname := coalesce(new.raw_user_meta_data->>'nickname', v_login_id);

  insert into public.profiles (id, name, login_id, nickname, role)
  values (new.id, v_name, v_login_id, v_nickname, 'user')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- grants ----------
-- Supabase normally sets default privileges so newly-created tables in the
-- `public` schema are accessible by `anon`, `authenticated`,
-- `service_role`, `authenticator`, and `supabase_realtime_admin`, but
-- those defaults are wiped if the schema is dropped and recreated.
--
-- IMPORTANT: `supabase_realtime_admin` MUST have USAGE on `public` and
-- SELECT on every table participating in the `supabase_realtime`
-- publication. Without it, the Realtime service silently fails to
-- connect ("UnableToConnectToProject") and `postgres_changes`
-- subscriptions never fire on the client.
--
-- RLS policies in 0002_rls.sql still gate every row for `anon` /
-- `authenticated`. `service_role` bypasses RLS by design and is only
-- used from server-side code (API routes / server actions) that enforces
-- its own authorization checks (see `lib/auth.ts`).
grant usage on schema public to
  anon, authenticated, service_role, authenticator, supabase_realtime_admin;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant select on all tables in schema public to anon;
grant select on all tables in schema public to supabase_realtime_admin;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant select on tables to supabase_realtime_admin;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;

-- ---------- realtime publication ----------
-- Enable realtime for the tables clients subscribe to.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.stances;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.message_likes;
