-- 0040 access log (Computer Crimes Act B.E. 2550 s.26: keep computer traffic data >= 90 days)
-- Why our own table: Supabase Free keeps API / Auth / Postgres logs for 1 day only (Pro 7, Team 28, Enterprise 90 days),
-- and the auth audit table (auth.audit_log_entries) is empty on this project. So every important action is written here,
-- with who (user id), what (event + target), when (timestamptz) and the client IP / user agent taken from the request
-- headers the Supabase API gateway (Cloudflare) passes to Postgres (cf-connecting-ip, x-real-ip, x-forwarded-for).
--  * append-only: no update / delete / truncate, except the retention purge below
--  * retention: private.settings 'access_log' {retention_days (never below 90), hold_until (legal hold: officials may
--    order longer keeping, up to 2 years)} - purged daily by pg_cron at 03:00 Asia/Bangkok
--  * read: admins only (RLS); no content text is stored (PDPA data minimisation), only ids
--  * never blocks the real action: logging errors are swallowed
-- No front-end change.

create extension if not exists pg_cron;

create table if not exists public.access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,                                    -- no FK on purpose: the record must outlive a deleted account (legal duty)
  actor_role text not null default 'user' check (char_length(actor_role) <= 40),
  event text not null check (char_length(event) between 1 and 60),
  target_type text check (char_length(target_type) <= 30),
  target_id text check (char_length(target_id) <= 64),
  ip inet,
  ip_chain text check (char_length(ip_chain) <= 300),   -- raw x-forwarded-for, for forensic checks
  country text check (char_length(country) <= 4),
  user_agent text check (char_length(user_agent) <= 300),
  source text not null default 'db' check (source in ('db','client','edge','auth','system')),
  detail jsonb check (detail is null or pg_column_size(detail) <= 2000)
);
create index if not exists access_log_at on public.access_log (at);
create index if not exists access_log_user on public.access_log (user_id, at desc);
create index if not exists access_log_ip on public.access_log (ip, at desc);
create index if not exists access_log_target on public.access_log (target_type, target_id);
alter table public.access_log enable row level security;
revoke all on public.access_log from public, anon, authenticated, service_role;
grant select on public.access_log to authenticated;
grant select, insert on public.access_log to service_role;          -- edge functions write their own rows (real client IP)
grant usage on sequence public.access_log_id_seq to service_role;
drop policy if exists "admins read the access log" on public.access_log;
create policy "admins read the access log" on public.access_log for select to authenticated using ((select private.is_staff('admin')));
drop policy if exists "service writes the access log" on public.access_log;
create policy "service writes the access log" on public.access_log for insert to service_role with check (true);

create or replace function private.access_log_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('lumi.log_purge', true) = 'on' then return old; end if;
  raise exception 'access_log is append-only' using errcode = '42501';
end $$;
drop trigger if exists access_log_no_change on public.access_log;
create trigger access_log_no_change before update or delete on public.access_log for each row execute function private.access_log_immutable();
drop trigger if exists access_log_no_truncate on public.access_log;
create trigger access_log_no_truncate before truncate on public.access_log for each statement execute function private.access_log_immutable();

insert into private.settings (key, value) values ('access_log', '{"retention_days": 120, "hold_until": null}'::jsonb)
on conflict (key) do nothing;

-- request headers as Postgres sees them (PostgREST sets request.headers); null outside an API request (cron, dashboard)
create or replace function private.req_header(p_name text) returns text
language sql stable set search_path = '' as $$
  select nullif(btrim((nullif(current_setting('request.headers', true), '')::jsonb) ->> lower(p_name)), '')
$$;
create or replace function private.safe_inet(p text) returns inet
language plpgsql immutable set search_path = '' as $$
begin return nullif(btrim(p), '')::inet; exception when others then return null; end $$;
-- Cloudflare's cf-connecting-ip cannot be set by the client; x-forwarded-for's first hop can, so it is only a fallback
create or replace function private.client_ip() returns inet
language sql stable set search_path = '' as $$
  select coalesce(private.safe_inet(private.req_header('cf-connecting-ip')),
                  private.safe_inet(private.req_header('x-real-ip')),
                  private.safe_inet(split_part(private.req_header('x-forwarded-for'), ',', 1)))
$$;

create or replace function private.log_access(p_event text, p_type text default null, p_id text default null,
  p_detail jsonb default null, p_source text default 'db') returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.access_log (user_id, actor_role, event, target_type, target_id, ip, ip_chain, country, user_agent, source, detail)
  values (auth.uid(),
          coalesce(nullif(current_setting('lumi.actor_role', true), ''),
                   case when private.is_service() then 'system' when auth.uid() is null then 'anon' else 'user' end),
          left(p_event, 60), left(p_type, 30), left(p_id, 64), private.client_ip(),
          left(private.req_header('x-forwarded-for'), 300), left(private.req_header('cf-ipcountry'), 4),
          left(private.req_header('user-agent'), 300), p_source, p_detail);
exception when others then
  raise warning 'access_log write failed: %', sqlerrm;   -- never break the real action
end $$;
revoke execute on function private.log_access(text, text, text, jsonb, text) from public, anon, authenticated;

-- row trigger: tg_argv[0] = event, tg_argv[1] = target type
create or replace function private.access_log_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(new);
begin
  if tg_op = 'UPDATE' then   -- nested ifs: OLD / NEW fields differ per table
    if tg_table_name = 'profiles' then
      if (to_jsonb(old) - 'updated_at' - 'follower_count' - 'following_count' - 'product_count' - 'sales_count' - 'rating')
         = (r - 'updated_at' - 'follower_count' - 'following_count' - 'product_count' - 'sales_count' - 'rating') then return null; end if;
    elsif (to_jsonb(old) ->> 'status') is not distinct from (r ->> 'status') then return null;
    end if;
  end if;
  perform private.log_access(tg_argv[0], tg_argv[1], coalesce(r ->> 'id', r ->> 'post_id'),
    case when tg_table_name = 'products' then jsonb_build_object('status', r ->> 'status')
         when tg_table_name = 'product_files' then jsonb_build_object('size', r ->> 'size_bytes', 'role', r ->> 'role')
         when tg_table_name = 'messages' then jsonb_build_object('thread', r ->> 'thread_id')
         when tg_table_name = 'comments' then jsonb_build_object('post', r ->> 'post_id')
         else null end);
  return null;
exception when others then return null;
end $$;

do $$
declare t text[];
begin
  foreach t slice 1 in array array[
    array['posts','post.create','post','INSERT'],
    array['comments','comment.create','comment','INSERT'],
    array['stories','story.create','story','INSERT'],
    array['messages','message.send','message','INSERT'],
    array['reviews','review.create','review','INSERT'],
    array['reports','report.create','report','INSERT'],
    array['products','listing.publish','product','INSERT'],
    array['products','listing.status','product','UPDATE OF status'],
    array['product_files','file.upload','file','INSERT'],
    array['orders','order.create','order','INSERT'],
    array['refund_requests','refund.request','refund','INSERT'],
    array['account_requests','account.request','account','INSERT'],
    array['profiles','profile.update','profile','UPDATE']]
  loop
    if to_regclass('public.' || t[1]) is null then continue; end if;
    execute format('drop trigger if exists zz_access_log_%s on public.%I', lower(split_part(t[4], ' ', 1)), t[1]);
    execute format('create trigger zz_access_log_%s after %s on public.%I for each row execute function private.access_log_row(%L, %L)',
                   lower(split_part(t[4], ' ', 1)), t[4], t[1], t[2], t[3]);
  end loop;
end $$;

-- downloads: download_check (called by the get-download edge function) already writes download_events;
-- the edge function adds an access_log row itself with the buyer's real IP (the DB only sees the edge function's IP).

-- client events the database cannot see (sign-in happens in Supabase Auth, not PostgREST): the app calls this right after
-- sign-in / before sign-out. The IP still comes from the gateway headers, not from the app.
create or replace function public.log_session(p_event text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if p_event not in ('auth.sign_in', 'auth.sign_up', 'auth.sign_out', 'auth.password_change', 'app.open') then
    raise exception 'bad event' using errcode = '22023';
  end if;
  -- same user + event + IP within 5 minutes = one row (spam guard)
  if exists (select 1 from public.access_log where user_id = auth.uid() and event = p_event and at > now() - interval '5 minutes'
             and ip is not distinct from private.client_ip()) then return; end if;
  perform private.log_access(p_event, 'user', auth.uid()::text, null, 'client');
end $$;
revoke execute on function public.log_session(text) from public, anon;
grant execute on function public.log_session(text) to authenticated;

-- retention purge (daily). Never below 90 days; skipped completely while a legal hold is set.
create or replace function private.purge_access_log() returns bigint
language plpgsql security definer set search_path = '' as $$
declare cfg jsonb := coalesce(private.setting('access_log'), '{}'::jsonb);
        days int := greatest(coalesce((cfg ->> 'retention_days')::int, 120), 90);
        hold timestamptz := nullif(cfg ->> 'hold_until', '')::timestamptz; n bigint;
begin
  if not (private.is_service() or private.is_staff('admin')) then raise exception 'admins only' using errcode = '42501'; end if;
  if hold is not null and hold > now() then return 0; end if;
  perform set_config('lumi.log_purge', 'on', true);
  delete from public.access_log where at < now() - make_interval(days => days);
  get diagnostics n = row_count;
  perform set_config('lumi.log_purge', '', true);
  perform set_config('lumi.actor_role', 'system', true);
  if n > 0 then perform private.audit('access_log.purge', 'access_log', null, null, jsonb_build_object('rows', n, 'older_than_days', days)); end if;
  perform set_config('lumi.actor_role', '', true);
  return n;
end $$;
revoke execute on function private.purge_access_log() from public, anon, authenticated;

-- admins: set retention (>= 90 days) or a legal hold date
create or replace function public.set_access_log_retention(p_days int, p_hold_until timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not private.is_staff('admin') then raise exception 'admins only' using errcode = '42501'; end if;
  if p_days is null or p_days < 90 or p_days > 730 then raise exception 'retention must be 90-730 days' using errcode = '22023'; end if;
  v := jsonb_build_object('retention_days', p_days, 'hold_until', p_hold_until);
  insert into private.settings (key, value) values ('access_log', v) on conflict (key) do update set value = excluded.value;
  perform private.audit('access_log.retention', 'settings', 'access_log', null, v);
  return v;
end $$;
revoke execute on function public.set_access_log_retention(int, timestamptz) from public, anon;
grant execute on function public.set_access_log_retention(int, timestamptz) to authenticated;

select cron.schedule('pixeeno-access-log-purge', '0 20 * * *', $$select private.purge_access_log()$$);   -- 20:00 UTC = 03:00 Asia/Bangkok
