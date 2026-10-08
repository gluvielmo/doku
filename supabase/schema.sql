-- Run once in the Supabase SQL editor.

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
alter publication supabase_realtime add table public.games;
