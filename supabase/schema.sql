-- Run in the Supabase SQL editor. Safe to run again after pulling changes.

create table if not exists public.games (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  primary key (user_id, id)
);

alter table public.games enable row level security;

drop policy if exists "Users manage their own games" on public.games;
create policy "Users manage their own games" on public.games
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Last-writer-wins upsert: an older copy of a game can never overwrite a newer one.
create or replace function public.upsert_game(p_id text, p_data jsonb, p_updated_at bigint)
returns void
language sql
security invoker
as $$
  insert into public.games (user_id, id, data, updated_at)
  values (auth.uid(), p_id, p_data, p_updated_at)
  on conflict (user_id, id) do update
    set data = excluded.data, updated_at = excluded.updated_at
    where public.games.updated_at < excluded.updated_at;
$$;

-- Live updates to other open devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

-- Daily scan quota. Users can't read or write this table directly (RLS on, no policies);
-- only the two functions below touch it, and only for the calling user's own row.
create table if not exists public.scan_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.scan_usage enable row level security;

-- Scans the calling user has made today (UTC).
create or replace function public.scans_today()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select count from public.scan_usage where user_id = auth.uid() and day = (now() at time zone 'utc')::date),
    0
  );
$$;

-- Records one successful scan for the calling user. Calling it directly only uses up your own quota.
create or replace function public.record_scan()
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.scan_usage (user_id, day, count)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.scan_usage.count + 1
  returning count;
$$;

-- Deletes the calling user's account. Their games and scan usage go with it (on delete cascade).
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.scans_today(), public.record_scan(), public.delete_my_account() from public, anon;
grant execute on function public.scans_today(), public.record_scan(), public.delete_my_account() to authenticated;
