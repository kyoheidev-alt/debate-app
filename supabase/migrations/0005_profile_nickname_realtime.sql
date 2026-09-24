-- Open clients learn a mid-debate nickname change from `profiles`.
-- Messages keep only user_id; the chat reads the live nickname from the
-- profile row. This publication change does not update any room, message,
-- or nickname.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end$$;
