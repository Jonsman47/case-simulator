-- Save schema v31: persistent simulated marketplace entities and idempotent commands.
-- Apply after 20261016_social_cloud_v29.sql. NPC supply rows are written only by a
-- trusted service/cron job; authenticated clients may browse active rows.

create table if not exists public.marketplace_npcs (
  id uuid primary key default gen_random_uuid(),
  identity_seed bigint not null unique,
  username text not null,
  avatar_hue smallint not null check (avatar_hue between 0 and 359),
  behavior jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_npc_id uuid references public.marketplace_npcs(id),
  owner_user_id uuid references auth.users(id) on delete cascade,
  item_instance jsonb not null,
  asking_price numeric(20,2) not null check (asking_price > 0),
  reservation_price numeric(20,2) check (reservation_price > 0),
  fair_market_value numeric(20,2) not null check (fair_market_value >= 0),
  liquidity_score numeric not null check (liquidity_score between 0 and 1),
  scarcity_score numeric not null check (scarcity_score between 0 and 1),
  listing_kind text not null check (listing_kind in ('npc', 'player')),
  status text not null default 'active' check (status in ('active', 'offer-received', 'sold', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sold_at timestamptz,
  buyer_user_id uuid references auth.users(id)
);

create index if not exists marketplace_listings_active_idx
  on public.marketplace_listings (listing_kind, status, expires_at, created_at desc);
create index if not exists marketplace_listings_owner_idx
  on public.marketplace_listings (owner_user_id, status, created_at desc);

create table if not exists public.marketplace_negotiations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  round integer not null default 0,
  best_offer numeric(20,2) not null default 0,
  current_counter_offer numeric(20,2),
  patience_remaining integer not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'walked-away')),
  messages jsonb not null default '[]'::jsonb,
  cooldown_until timestamptz,
  updated_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

create table if not exists public.marketplace_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.marketplace_listings(id),
  transaction_type text not null,
  item_instance jsonb not null,
  price numeric(20,2) not null check (price >= 0),
  fair_market_value numeric(20,2) not null check (fair_market_value >= 0),
  counterparty text,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_transactions_user_idx
  on public.marketplace_transactions (user_id, created_at desc);

create table if not exists public.economy_request_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  command text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.marketplace_npcs enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_negotiations enable row level security;
alter table public.marketplace_transactions enable row level security;
alter table public.economy_request_ledger enable row level security;

drop policy if exists marketplace_npcs_read on public.marketplace_npcs;
create policy marketplace_npcs_read on public.marketplace_npcs for select to authenticated using (true);
drop policy if exists marketplace_listings_read on public.marketplace_listings;
create policy marketplace_listings_read on public.marketplace_listings for select to authenticated
  using ((listing_kind = 'npc' and status = 'active') or owner_user_id = auth.uid() or buyer_user_id = auth.uid());
drop policy if exists marketplace_negotiations_self on public.marketplace_negotiations;
create policy marketplace_negotiations_self on public.marketplace_negotiations for select to authenticated using (user_id = auth.uid());
drop policy if exists marketplace_transactions_self on public.marketplace_transactions;
create policy marketplace_transactions_self on public.marketplace_transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists economy_request_ledger_self on public.economy_request_ledger;
create policy economy_request_ledger_self on public.economy_request_ledger for select to authenticated using (user_id = auth.uid());

-- Atomic Buy Now. The function locks both listing and cloud save, uses the
-- request ledger for replay protection, transfers the exact stored instance,
-- and removes currency in the same database transaction.
create or replace function public.marketplace_buy_now(p_listing_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_listing public.marketplace_listings%rowtype;
  v_save public.game_saves%rowtype;
  v_existing jsonb;
  v_money numeric;
  v_inventory jsonb;
  v_result jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select response into v_existing from public.economy_request_ledger
    where user_id = v_user and request_id = p_request_id;
  if v_existing is not null then return v_existing; end if;

  select * into v_listing from public.marketplace_listings
    where id = p_listing_id and listing_kind = 'npc' and status = 'active' and expires_at > now()
    for update;
  if not found then raise exception 'listing unavailable'; end if;

  select * into v_save from public.game_saves where user_id = v_user for update;
  if not found then raise exception 'cloud save required'; end if;
  v_money := coalesce((v_save.save_data #>> '{state,money}')::numeric, 0);
  if v_money < v_listing.asking_price then raise exception 'insufficient funds'; end if;
  v_inventory := coalesce(v_save.save_data #> '{state,inventory}', '[]'::jsonb);
  if exists (
    select 1 from jsonb_array_elements(v_inventory) owned
    where owned->>'instanceId' = v_listing.item_instance->>'instanceId'
  ) then raise exception 'item already owned'; end if;

  update public.game_saves set
    save_data = jsonb_set(
      jsonb_set(save_data, '{state,money}', to_jsonb(v_money - v_listing.asking_price), true),
      '{state,inventory}', v_inventory || jsonb_build_array(v_listing.item_instance), true
    ),
    revision = revision + 1,
    updated_at = now()
  where user_id = v_user;

  update public.marketplace_listings set status = 'sold', buyer_user_id = v_user, sold_at = now()
    where id = p_listing_id;
  insert into public.marketplace_transactions
    (user_id, listing_id, transaction_type, item_instance, price, fair_market_value, counterparty)
  values
    (v_user, p_listing_id, 'npc-purchase', v_listing.item_instance, v_listing.asking_price, v_listing.fair_market_value,
     (select username from public.marketplace_npcs where id = v_listing.seller_npc_id));

  v_result := jsonb_build_object('ok', true, 'listingId', p_listing_id, 'item', v_listing.item_instance,
    'price', v_listing.asking_price, 'revision', v_save.revision + 1);
  insert into public.economy_request_ledger(user_id, request_id, command, response)
    values (v_user, p_request_id, 'marketplace_buy_now', v_result);
  return v_result;
end;
$$;

revoke all on function public.marketplace_buy_now(uuid, uuid) from public;
grant execute on function public.marketplace_buy_now(uuid, uuid) to authenticated;

-- Direct table writes stay unavailable to clients; mutations go through
-- SECURITY DEFINER commands after server-side validation.
revoke insert, update, delete on public.marketplace_npcs from anon, authenticated;
revoke insert, update, delete on public.marketplace_listings from anon, authenticated;
revoke insert, update, delete on public.marketplace_negotiations from anon, authenticated;
revoke insert, update, delete on public.marketplace_transactions from anon, authenticated;
revoke insert, update, delete on public.economy_request_ledger from anon, authenticated;
