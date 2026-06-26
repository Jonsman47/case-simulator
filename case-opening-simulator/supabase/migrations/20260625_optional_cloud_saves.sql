-- Optional cloud-save backend for Case Opening Simulator.
-- Apply this migration in Supabase when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_anonymous boolean not null default false,
  public_trophy_room boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null,
  revision integer not null default 1,
  inventory_value numeric not null default 0,
  prestige_level integer not null default 0,
  cases_opened integer not null default 0,
  total_profit numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.public_trophy_rooms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_slug text not null unique,
  trophy_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;
alter table public.public_trophy_rooms enable row level security;

drop policy if exists "profiles_select_public_or_self" on public.profiles;
create policy "profiles_select_public_or_self"
on public.profiles for select
using (public_trophy_room = true or auth.uid() = user_id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "game_saves_select_self" on public.game_saves;
create policy "game_saves_select_self"
on public.game_saves for select
using (auth.uid() = user_id);

drop policy if exists "game_saves_insert_self" on public.game_saves;
create policy "game_saves_insert_self"
on public.game_saves for insert
with check (auth.uid() = user_id);

drop policy if exists "game_saves_update_self" on public.game_saves;
create policy "game_saves_update_self"
on public.game_saves for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public_trophy_select_public" on public.public_trophy_rooms;
create policy "public_trophy_select_public"
on public.public_trophy_rooms for select
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = public_trophy_rooms.user_id
      and profiles.public_trophy_room = true
  )
  or auth.uid() = user_id
);

drop policy if exists "public_trophy_upsert_self" on public.public_trophy_rooms;
create policy "public_trophy_upsert_self"
on public.public_trophy_rooms for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace view public.leaderboard_entries as
select
  game_saves.user_id,
  coalesce(nullif(profiles.display_name, ''), 'Anonymous') as display_name,
  game_saves.inventory_value,
  game_saves.prestige_level,
  game_saves.cases_opened,
  game_saves.total_profit,
  game_saves.updated_at
from public.game_saves
left join public.profiles on profiles.user_id = game_saves.user_id;

grant select on public.leaderboard_entries to anon, authenticated;
