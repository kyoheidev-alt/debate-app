-- =========================================================================
-- 0004_room_topics.sql
-- Splits a room's chat when the chair saves a different theme.
--
-- The room, invite link, roster, and nicknames stay. Message content is
-- not deleted or blanked. Each debate prompt is a row in room_topics.
-- messages.topic_id keeps every post on the prompt it was written under.
-- rooms.current_topic_id is the live prompt. Older topics stay readable.
--
-- Existing rooms are backfilled with one OPEN topic (the current theme)
-- and every existing message is attached to it. That does not archive
-- anything; the next theme change does.
-- =========================================================================

create table public.room_topics (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  theme text not null,
  ordinal int not null check (ordinal > 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (room_id, ordinal)
);

-- One live prompt per room. Closing the previous row happens before insert.
create unique index room_topics_one_open_idx
  on public.room_topics (room_id)
  where ended_at is null;

create index room_topics_room_ordinal_idx
  on public.room_topics (room_id, ordinal);

alter table public.rooms
  add column current_topic_id uuid;

alter table public.messages
  add column topic_id uuid;

-- Backfill: one open topic per room, using the theme already on the room.
insert into public.room_topics (room_id, theme, ordinal, started_at)
select r.id, r.theme, 1, r.created_at
from public.rooms r;

update public.rooms r
set current_topic_id = t.id
from public.room_topics t
where t.room_id = r.id
  and t.ordinal = 1
  and r.current_topic_id is null;

update public.messages m
set topic_id = r.current_topic_id
from public.rooms r
where m.room_id = r.id
  and m.topic_id is null
  and r.current_topic_id is not null;

alter table public.messages
  alter column topic_id set not null;

alter table public.messages
  add constraint messages_topic_id_fkey
  foreign key (topic_id) references public.room_topics(id) on delete cascade;

create index messages_room_topic_created_idx
  on public.messages (room_id, topic_id, created_at);

-- New rooms start on topic 1. Runs as the table owner so it can insert
-- the topic row (clients have no insert policy on room_topics).
create or replace function public.create_initial_room_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic uuid;
begin
  insert into public.room_topics (room_id, theme, ordinal, started_at)
  values (new.id, new.theme, 1, coalesce(new.created_at, now()))
  returning id into v_topic;

  update public.rooms
  set current_topic_id = v_topic
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists rooms_create_initial_topic on public.rooms;
create trigger rooms_create_initial_topic
  after insert on public.rooms
  for each row execute function public.create_initial_room_topic();

-- Changing rooms.theme to different text closes the live topic and opens
-- a new one. The same text (ignoring surrounding whitespace) does not
-- archive. Message rows are not updated.
create or replace function public.archive_room_on_theme_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next text;
  v_prev text;
  v_ordinal int;
  v_topic uuid;
begin
  if new.theme is not distinct from old.theme then
    return new;
  end if;

  v_next := btrim(new.theme);
  v_prev := btrim(old.theme);

  if v_next = '' then
    raise exception 'テーマを入力してください';
  end if;

  if v_next = v_prev then
    new.theme := old.theme;
    new.current_topic_id := old.current_topic_id;
    return new;
  end if;

  update public.room_topics
  set ended_at = now()
  where room_id = new.id
    and ended_at is null;

  select coalesce(max(ordinal), 0) + 1
    into v_ordinal
  from public.room_topics
  where room_id = new.id;

  insert into public.room_topics (room_id, theme, ordinal)
  values (new.id, v_next, v_ordinal)
  returning id into v_topic;

  new.theme := v_next;
  new.current_topic_id := v_topic;
  return new;
end;
$$;

drop trigger if exists rooms_archive_on_theme_change on public.rooms;
create trigger rooms_archive_on_theme_change
  before update of theme on public.rooms
  for each row execute function public.archive_room_on_theme_change();

-- Posts always belong to the live topic, even if a client sends another id.
create or replace function public.assign_message_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic uuid;
begin
  select current_topic_id into v_topic
  from public.rooms
  where id = new.room_id;

  if v_topic is null then
    raise exception '議題が未設定です';
  end if;

  new.topic_id := v_topic;
  return new;
end;
$$;

drop trigger if exists messages_assign_topic on public.messages;
create trigger messages_assign_topic
  before insert on public.messages
  for each row execute function public.assign_message_topic();

-- Topic membership is fixed at insert. Edits cannot move a post back
-- into the live chat or into another archive.
create or replace function public.preserve_message_topic()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.topic_id := old.topic_id;
  return new;
end;
$$;

drop trigger if exists messages_preserve_topic on public.messages;
create trigger messages_preserve_topic
  before update on public.messages
  for each row execute function public.preserve_message_topic();

revoke all on function public.create_initial_room_topic() from public, anon, authenticated;
revoke all on function public.archive_room_on_theme_change() from public, anon, authenticated;
revoke all on function public.assign_message_topic() from public, anon, authenticated;
revoke all on function public.preserve_message_topic() from public, anon, authenticated;

alter table public.room_topics enable row level security;

create policy room_topics_select on public.room_topics
  for select to authenticated
  using (
    public.is_app_admin()
    or room_id = public.current_room_id()
    or public.is_chair_of(room_id)
  );

revoke all on public.room_topics from anon, authenticated;
grant select on public.room_topics to authenticated;
grant select on public.room_topics to supabase_realtime_admin;
grant all on public.room_topics to service_role;

-- Open clients learn the new theme and current_topic_id from this table.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end$$;
