-- Prompt 4 cloud/social hardening for save schema v29.
-- Apply after 20260625_optional_cloud_saves.sql.

alter table public.profiles
  add column if not exists avatar_key text not null default 'crosshair',
  add column if not exists public_profile boolean not null default false;

update public.profiles
set display_name = null
where display_name is not null
  and display_name !~ '^[A-Za-z0-9 _-]{3,24}$';

alter table public.profiles
  drop constraint if exists profiles_display_name_format,
  add constraint profiles_display_name_format
    check (display_name is null or display_name ~ '^[A-Za-z0-9 _-]{3,24}$'),
  drop constraint if exists profiles_avatar_key,
  add constraint profiles_avatar_key
    check (avatar_key in ('crosshair', 'case', 'knife', 'gloves', 'crown'));

create unique index if not exists profiles_display_name_unique
  on public.profiles (lower(display_name))
  where display_name is not null;

create or replace function public.create_player_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if requested_name !~ '^[A-Za-z0-9 _-]{3,24}$' then
    requested_name := 'Player-' || left(new.id::text, 8);
  end if;

  insert into public.profiles (user_id, display_name)
  values (new.id, requested_name)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.create_player_profile() from public, anon, authenticated;

drop trigger if exists create_player_profile_after_signup on auth.users;
create trigger create_player_profile_after_signup
after insert on auth.users
for each row execute function public.create_player_profile();

create table if not exists public.public_player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inventory_value numeric not null default 0 check (inventory_value >= 0 and inventory_value <= 1000000000000),
  most_valuable_skin numeric not null default 0 check (most_valuable_skin >= 0 and most_valuable_skin <= 1000000000),
  cases_opened bigint not null default 0 check (cases_opened >= 0),
  total_profit numeric not null default 0,
  prestige_level integer not null default 0 check (prestige_level >= 0),
  rare_patterns integer not null default 0 check (rare_patterns >= 0),
  achievement_count integer not null default 0 check (achievement_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.public_player_stats enable row level security;

alter table public.public_trophy_rooms alter column share_slug drop not null;

drop policy if exists "profiles_select_public_or_self" on public.profiles;
create policy "profiles_select_public_or_self"
on public.profiles for select
to anon, authenticated
using (public_profile = true or (select auth.uid()) = user_id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "game_saves_select_self" on public.game_saves;
create policy "game_saves_select_self"
on public.game_saves for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "game_saves_insert_self" on public.game_saves;
create policy "game_saves_insert_self"
on public.game_saves for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "game_saves_update_self" on public.game_saves;
create policy "game_saves_update_self"
on public.game_saves for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "public_stats_select_opted_in" on public.public_player_stats;
create policy "public_stats_select_opted_in"
on public.public_player_stats for select
to anon, authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = public_player_stats.user_id
      and (profiles.public_profile = true or (select auth.uid()) = profiles.user_id)
  )
);

drop policy if exists "public_stats_insert_self" on public.public_player_stats;
create policy "public_stats_insert_self"
on public.public_player_stats for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "public_stats_update_self" on public.public_player_stats;
create policy "public_stats_update_self"
on public.public_player_stats for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "public_trophy_select_public" on public.public_trophy_rooms;
create policy "public_trophy_select_public"
on public.public_trophy_rooms for select
to anon, authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = public_trophy_rooms.user_id
      and (profiles.public_trophy_room = true or (select auth.uid()) = profiles.user_id)
  )
);

drop policy if exists "public_trophy_upsert_self" on public.public_trophy_rooms;
drop policy if exists "public_trophy_insert_self" on public.public_trophy_rooms;
create policy "public_trophy_insert_self"
on public.public_trophy_rooms for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "public_trophy_update_self" on public.public_trophy_rooms;
create policy "public_trophy_update_self"
on public.public_trophy_rooms for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.game_saves from anon;
revoke all on public.game_saves from authenticated;
grant select, insert, update on public.game_saves to authenticated;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
revoke all on public.public_player_stats from anon, authenticated;
grant select on public.public_player_stats to anon;
grant select, insert, update on public.public_player_stats to authenticated;
revoke all on public.public_trophy_rooms from anon, authenticated;
grant select on public.public_trophy_rooms to anon;
grant select, insert, update on public.public_trophy_rooms to authenticated;

create or replace function public.save_game_if_revision(
  p_expected_revision integer,
  p_save_data jsonb
)
returns setof public.game_saves
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.game_saves%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_expected_revision = 0 then
    insert into public.game_saves (user_id, save_data, revision, updated_at)
    values ((select auth.uid()), p_save_data, 1, now())
    on conflict (user_id) do nothing
    returning * into saved;
  else
    update public.game_saves
    set save_data = p_save_data,
        revision = revision + 1,
        updated_at = now()
    where user_id = (select auth.uid())
      and revision = p_expected_revision
    returning * into saved;
  end if;

  if saved.user_id is null then
    raise exception 'revision_conflict' using errcode = 'P0001';
  end if;

  return next saved;
end;
$$;

revoke execute on function public.save_game_if_revision(integer, jsonb) from public, anon;
grant execute on function public.save_game_if_revision(integer, jsonb) to authenticated;

drop view if exists public.leaderboard_entries;
create view public.leaderboard_entries
with (security_invoker = true)
as
select
  stats.user_id,
  coalesce(nullif(profiles.display_name, ''), 'Anonymous') as display_name,
  stats.inventory_value,
  stats.most_valuable_skin,
  stats.prestige_level,
  stats.cases_opened,
  stats.total_profit,
  stats.rare_patterns,
  stats.achievement_count,
  stats.updated_at
from public.public_player_stats stats
join public.profiles on profiles.user_id = stats.user_id
where profiles.public_profile = true;

drop view if exists public.public_player_profiles;
create view public.public_player_profiles
with (security_invoker = true)
as
select
  profiles.user_id,
  profiles.display_name,
  profiles.avatar_key,
  profiles.created_at,
  profiles.updated_at,
  stats.inventory_value,
  stats.most_valuable_skin,
  stats.prestige_level,
  stats.cases_opened,
  stats.total_profit,
  stats.rare_patterns,
  stats.achievement_count,
  case when profiles.public_trophy_room then trophies.trophy_data else '[]'::jsonb end as trophy_data
from public.profiles
left join public.public_player_stats stats on stats.user_id = profiles.user_id
left join public.public_trophy_rooms trophies on trophies.user_id = profiles.user_id
where profiles.public_profile = true;

grant select on public.leaderboard_entries to anon, authenticated;
grant select on public.public_player_profiles to anon, authenticated;

comment on view public.leaderboard_entries is
  'Client-reported simulator summaries. RLS/public opt-in protects privacy but does not make scores cheat-proof.';
