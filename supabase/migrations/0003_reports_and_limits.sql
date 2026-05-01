-- =========================================================================
-- 0003_reports_and_limits.sql
-- Adds:
--   1) message_reports — students can report dangerous chat messages
--      directly to the app_admin. Chairs CANNOT see reports (the chair
--      themselves may be the offender).
--   2) app_settings — singleton table holding the global default for
--      max registered users per room (used by all rooms unless overridden).
--   3) rooms.user_limit — per-room override for the user cap (NULL falls
--      back to app_settings.default_room_user_limit).
--   4) effective_room_user_limit(rid) — resolves the effective cap.
-- =========================================================================

-- ---------- message_reports ----------
create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  -- Denormalized so RLS can match the reporter's current_room_id at
  -- INSERT time without joining messages.
  room_id    uuid not null references public.rooms(id)    on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete set null,
  reason text not null check (length(reason) between 0 and 500),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolution_note text,
  created_at timestamptz not null default now()
);

create index message_reports_unresolved_idx
  on public.message_reports (created_at desc)
  where resolved_at is null;

create index message_reports_message_idx
  on public.message_reports (message_id);

alter table public.message_reports enable row level security;

-- INSERT: only your own row, only against a message in your current room
-- and only against someone else's message. RLS deliberately gates the
-- whole flow so we don't need a Service Role for student reports.
create policy message_reports_insert on public.message_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and room_id = public.current_room_id()
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.room_id = room_id
        and m.user_id <> auth.uid()
    )
  );

-- SELECT / UPDATE / DELETE: app_admin ONLY. Chairs cannot read reports
-- (since they may themselves be the subject of a report). Reporters
-- also cannot read their own reports back — they got an HTTP 200 from
-- /api/reports and that is enough; this protects them from inferring
-- whether other students reported the same message.
create policy message_reports_select on public.message_reports
  for select to authenticated
  using (public.is_app_admin());

create policy message_reports_update on public.message_reports
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy message_reports_delete on public.message_reports
  for delete to authenticated
  using (public.is_app_admin());

-- Realtime: app_admin's /sys page subscribes for live new-report toasts.
alter publication supabase_realtime add table public.message_reports;

-- ---------- app_settings ----------
-- Singleton row keyed by `id = true` (CHECK ensures only one row).
create table public.app_settings (
  id boolean primary key default true check (id),
  default_room_user_limit int not null default 50
    check (default_room_user_limit > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.app_settings (id) values (true)
  on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- SELECT: every authenticated user can read the global default (chairs
-- need it to display "current default = N" in their room settings).
create policy app_settings_select on public.app_settings
  for select to authenticated
  using (true);

-- UPDATE: app_admin only. INSERT/DELETE are not granted to clients —
-- the seed row is created here and never recreated.
create policy app_settings_update on public.app_settings
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------- rooms.user_limit ----------
alter table public.rooms
  add column user_limit int
  check (user_limit is null or user_limit > 0);

-- ---------- effective_room_user_limit(rid) ----------
create or replace function public.effective_room_user_limit(rid uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select user_limit from public.rooms where id = rid),
    (select default_room_user_limit from public.app_settings where id = true)
  )
$$;

revoke all on function public.effective_room_user_limit(uuid) from public;
grant execute on function public.effective_room_user_limit(uuid)
  to authenticated, service_role;
