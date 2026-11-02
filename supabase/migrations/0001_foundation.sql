-- LUMI 0001: privileges, private schema, helpers, enums, profiles
-- Exposure is opt-in: new objects in public get no automatic grants for anon/authenticated.
alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon, authenticated;

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public;

-- ---------- enums
create type public.sell_type as enum ('img','tpl','sw','game','bot','course','font','hire','media','skill','data');
create type public.product_status as enum ('draft','published','unpublished','removed');
create type public.scan_status as enum ('pending','scanning','ok','fail');
create type public.file_role as enum ('deliverable','attachment','delivery');
create type public.order_status as enum ('pending','paid','cancelled','failed','refunded');
create type public.job_status as enum ('briefed','quoted','accepted','paid','in_progress','delivered','revision','completed','cancelled','disputed');
create type public.escrow_status as enum ('none','held','released','disputed','refunded');
create type public.offer_status as enum ('pending','accepted','declined','withdrawn');
create type public.ledger_status as enum ('held','released','disputed','refunded','paid_out');
create type public.msg_kind as enum ('text','brief','offer','progress','delivery','key','file','image','product','system','sticker','tip','coupon');
create type public.notif_kind as enum ('order','chat','like','follow','system','community','sale');

-- ---------- helpers (private, not exposed through the Data API)
create or replace function private.is_service() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or (auth.role() is null and session_user <> 'authenticator')
$$;
-- set by trusted (security definer) code paths; nesting-safe depth counter, transaction-local
create or replace function private.bypass() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('lumi.bypass', true), '')::int, 0) > 0 or private.is_service()
$$;
create or replace function private.set_bypass(v boolean) returns void
language sql volatile set search_path = '' as $$
  select set_config('lumi.bypass', greatest(coalesce(nullif(current_setting('lumi.bypass', true), '')::int, 0) + case when v then 1 else -1 end, 0)::text, true)
$$;
revoke execute on function private.set_bypass(boolean) from anon, authenticated;
grant execute on function private.is_service(), private.bypass() to anon, authenticated, service_role;

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- profiles (public creator card) + private profile data
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  display_name text not null default 'ผู้ใช้ LUMI' check (char_length(display_name) between 1 and 60),
  avatar_path text check (char_length(avatar_path) <= 300),
  cover_path text check (char_length(cover_path) <= 300),
  bio text check (char_length(bio) <= 500),
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10),
  mode text not null default 'buyer' check (mode in ('buyer','creator')),
  is_creator boolean not null default false,
  verified boolean not null default false,
  follower_count int not null default 0,
  following_count int not null default 0,
  product_count int not null default 0,
  sales_count int not null default 0,
  rating numeric(3,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();

create table public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  phone text check (char_length(phone) <= 20),
  legal_name text check (char_length(legal_name) <= 120),
  kyc_status text not null default 'none' check (kyc_status in ('none','pending','verified','rejected')),
  payout_recipient_ref text,      -- payment-provider recipient id, set by server only
  pdpa_consent_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger profile_private_touch before update on public.profile_private for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_path)
  values (new.id,
          left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), 'ผู้ใช้ LUMI'), 60),
          null)
  on conflict (id) do nothing;
  insert into public.profile_private (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function private.handle_new_user() from anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

grant select on public.profiles to anon, authenticated;
grant update (handle, display_name, avatar_path, cover_path, bio, links, mode, is_creator) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles, public.profile_private to service_role;
grant select on public.profile_private to authenticated;
grant update (phone, legal_name, pdpa_consent_at) on public.profile_private to authenticated;

create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "read own private profile" on public.profile_private for select to authenticated using (id = (select auth.uid()));
create policy "edit own private profile" on public.profile_private for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
