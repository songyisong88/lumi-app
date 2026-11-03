-- LUMI 0030: backend hardening / future-proofing (owner request t201u: "plan for the future, prevent problems early").
-- Backend only: no screen changes. Numbered 0030 so the community/stories work (0020-0029) can land in between.
-- Every limit lives in private.settings so the LUMI team can tune it later without a code change.
--  A  grants hygiene: no TRUNCATE/REFERENCES/TRIGGER for app roles; coupon code length cap
--  B  DB-side rate limits (posts, comments, reactions, follows, chat, stories, mentions, reports, uploads ...) + signup flood guard
--  C  account restrictions set by staff (mute posting / ban, with expiry), checked on every throttled write
--  D  reports table: auto-hide posts/comments/stories after N different reporters; moderators resolve; everything audited
--  E  block / mute between users (blocked users cannot comment, react, follow, mention, chat; their content is hidden both ways)
--  F  banned-content rules (regex, block or flag); flags open a system report for moderators
--  G  virus-scan pipeline: scan_jobs (basic + deep tiers, scanner-agnostic), program/code files need a clean deep scan
--     before a listing can go live or be downloaded
--  H  recycle bin (private.trash) for deleted posts/comments/stories/reviews/drafts/products, restorable by admins (30 days)
--  I  indexes for unindexed foreign keys + new tables
--  J  PDPA: export_my_data() — a user downloads everything LUMI stores about them
--  K  storage abstraction: product_files.store ('supabase' today, 'r2' later)

-- =====================================================================================================
-- A. grants hygiene
do $$ declare t record; begin
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m') loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;
do $$ begin
  alter table public.orders add constraint orders_coupon_code_len check (char_length(coupon_code) <= 40) not valid;
exception when duplicate_object then null; end $$;
alter table public.orders validate constraint orders_coupon_code_len;

-- =====================================================================================================
-- settings (do nothing if already there, so later tuning by the team survives re-runs)
insert into private.settings (key, value) values
('rate_limits', '{
  "post": [[5, 600], [30, 86400]],
  "comment": [[20, 600], [300, 86400]],
  "reaction": [[150, 600]],
  "save": [[150, 600]],
  "follow": [[60, 3600]],
  "message": [[40, 60], [1000, 86400]],
  "chat_open": [[20, 3600]],
  "story": [[10, 3600]],
  "story_reaction": [[150, 600]],
  "mention": [[60, 600]],
  "report": [[10, 3600], [50, 86400]],
  "upload": [[60, 3600]],
  "draft": [[30, 3600]],
  "review": [[20, 3600]],
  "refund": [[5, 86400]],
  "account_request": [[3, 86400]],
  "favorite": [[150, 600]],
  "cart": [[150, 600]],
  "order": [[30, 3600]],
  "challenge_entry": [[10, 3600]],
  "vote": [[150, 600]],
  "group_join": [[30, 3600]],
  "block": [[60, 3600]],
  "export": [[3, 86400]],
  "signup_global": [[300, 3600], [3000, 86400]]
}'::jsonb),
('moderation', '{"auto_hide_reports": 3, "auto_hide_types": ["post", "comment", "story"], "trash_days": 30}'::jsonb),
('scan', '{"enforce": true,
  "deep_required_types": ["sw", "game", "bot"],
  "deep_required_exts": ["exe","msi","dmg","pkg","apk","aab","ipa","xapk","appimage","deb","rpm","jar","dll","so","dylib","scr","com","bat","cmd","ps1","vbs","sh","crx","xpi","vsix"],
  "basic_engine": "basic"}'::jsonb)
on conflict (key) do nothing;

-- =====================================================================================================
-- B. rate limits
create table if not exists private.rate_events (
  user_id uuid,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_lookup on private.rate_events (action, user_id, at desc);
create index if not exists rate_events_at on private.rate_events (at);
revoke all on private.rate_events from public, anon, authenticated;

-- C. staff restrictions (mute posting / ban) — checked inside throttle so every write path is covered
create table if not exists private.user_sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('mute','ban')),
  reason text check (char_length(reason) <= 300),
  until timestamptz,                 -- null = until lifted
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz
);
create index if not exists user_sanctions_user on private.user_sanctions (user_id) where lifted_at is null;
revoke all on private.user_sanctions from public, anon, authenticated;

create or replace function private.active_sanction(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.kind from private.user_sanctions s
  where s.user_id = p_user and s.lifted_at is null and (s.until is null or s.until > now())
  order by case s.kind when 'ban' then 0 else 1 end limit 1
$$;

-- actions a muted user may still do (buying, reading, managing own stuff); everything else is "posting"
create or replace function private.throttle(p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); lim jsonb; w jsonb; n int; s text;
begin
  if uid is null or private.bypass() then return; end if;
  s := private.active_sanction(uid);
  if s = 'ban' and p_action not in ('export', 'account_request') then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = 'P0001', hint = 'บัญชีนี้ถูกระงับการใช้งานชั่วคราว ติดต่อทีม LUMI ได้ที่หน้าช่วยเหลือ';
  elsif s = 'mute' and p_action in ('post','comment','message','chat_open','story','mention','review','challenge_entry','upload','draft') then
    raise exception 'ACCOUNT_MUTED' using errcode = 'P0001', hint = 'บัญชีนี้ถูกจำกัดการโพสต์ชั่วคราว';
  end if;
  if private.is_staff() then return; end if;
  lim := private.setting('rate_limits') -> p_action;
  if lim is null or jsonb_typeof(lim) <> 'array' then return; end if;
  for w in select * from jsonb_array_elements(lim) loop
    select count(*) into n from private.rate_events e
      where e.action = p_action and e.user_id = uid and e.at > now() - make_interval(secs => (w ->> 1)::int);
    if n >= (w ->> 0)::int then
      raise exception 'RATE_LIMITED' using errcode = 'P0001', hint = 'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
    end if;
  end loop;
  insert into private.rate_events (user_id, action) values (uid, p_action);
  if random() < 0.01 then delete from private.rate_events where at < now() - interval '2 days'; end if;
end $$;

create or replace function private.throttle_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.throttle(tg_argv[0]); return new; end $$;

do $$ declare r record; begin
  for r in select * from (values
    ('posts','post'), ('comments','comment'), ('post_likes','reaction'), ('comment_likes','reaction'), ('post_saves','save'),
    ('follows','follow'), ('messages','message'), ('chat_threads','chat_open'), ('stories','story'), ('story_reactions','story_reaction'),
    ('mentions','mention'), ('product_files','upload'), ('listing_drafts','draft'), ('reviews','review'), ('refund_requests','refund'),
    ('account_requests','account_request'), ('favorites','favorite'), ('cart_items','cart'), ('orders','order'),
    ('challenge_entries','challenge_entry'), ('challenge_votes','vote'), ('room_members','group_join')) v(t, a) loop
    if to_regclass('public.' || r.t) is not null then
      execute format('create or replace trigger a_throttle before insert on public.%I for each row execute function private.throttle_row(%L)', r.t, r.a);
    end if;
  end loop;
end $$;

-- signup flood guard (whole site, not per person: Supabase Auth also has its own per-IP limits in the dashboard)
create or replace function private.signup_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim jsonb := private.setting('rate_limits') -> 'signup_global'; w jsonb; n int;
begin
  if lim is not null and jsonb_typeof(lim) = 'array' then
    for w in select * from jsonb_array_elements(lim) loop
      select count(*) into n from private.rate_events e
        where e.action = 'signup' and e.at > now() - make_interval(secs => (w ->> 1)::int);
      if n >= (w ->> 0)::int then
        raise exception 'SIGNUPS_PAUSED' using errcode = 'P0001', hint = 'มีการสมัครจำนวนมากผิดปกติ ระบบพักการสมัครชั่วคราว กรุณาลองใหม่ภายหลัง';
      end if;
    end loop;
  end if;
  insert into private.rate_events (user_id, action) values (null, 'signup');
  return new;
end $$;
drop trigger if exists lumi_signup_guard on auth.users;
create trigger lumi_signup_guard before insert on auth.users for each row execute function private.signup_guard();

-- =====================================================================================================
-- E. block / mute
create table if not exists public.user_blocks (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'block' check (kind in ('block','mute')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  check (user_id <> target_id)
);
create index if not exists user_blocks_target on public.user_blocks (target_id, user_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (target_id, kind), update (kind) on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
drop policy if exists "own blocks" on public.user_blocks;
create policy "own blocks" on public.user_blocks for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "block someone" on public.user_blocks;
create policy "block someone" on public.user_blocks for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "change own block" on public.user_blocks;
create policy "change own block" on public.user_blocks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "unblock" on public.user_blocks;
create policy "unblock" on public.user_blocks for delete to authenticated using (user_id = (select auth.uid()));

create or replace function private.user_blocks_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not private.bypass() then new.user_id := auth.uid(); new.created_at := now(); end if;
  return new;
end $$;
drop trigger if exists user_blocks_before on public.user_blocks;
create trigger user_blocks_before before insert on public.user_blocks for each row execute function private.user_blocks_before();
create or replace trigger a_throttle before insert on public.user_blocks for each row execute function private.throttle_row('block');

-- a block also removes follows both ways (like Facebook / Instagram)
create or replace function private.user_blocks_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'block' then
    perform private.set_bypass(true);
    delete from public.follows where (follower_id = new.user_id and creator_id = new.target_id) or (follower_id = new.target_id and creator_id = new.user_id);
    perform private.set_bypass(false);
  end if;
  return null;
end $$;
drop trigger if exists user_blocks_after on public.user_blocks;
create trigger user_blocks_after after insert or update of kind on public.user_blocks for each row execute function private.user_blocks_after();

-- true when the two people have a *block* in either direction
create or replace function private.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.user_blocks x where x.kind = 'block'
      and ((x.user_id = a and x.target_id = b) or (x.user_id = b and x.target_id = a)))
$$;
-- true when the viewer should not see content by p_author: they blocked me, or I blocked / muted them
create or replace function private.hidden_author(p_author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and p_author is not null and p_author <> auth.uid() and exists (
    select 1 from public.user_blocks x
    where (x.user_id = auth.uid() and x.target_id = p_author)
       or (x.user_id = p_author and x.target_id = auth.uid() and x.kind = 'block'))
$$;
grant execute on function private.hidden_author(uuid) to anon, authenticated, service_role;

create or replace function private.block_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare other uuid; other2 uuid;
begin
  if private.bypass() or auth.uid() is null then return new; end if;
  case tg_table_name
    when 'comments' then
      select author_id into other from public.posts where id = new.post_id;
      if new.reply_to is not null then select author_id into other2 from public.comments where id = new.reply_to; end if;
    when 'post_likes' then select author_id into other from public.posts where id = new.post_id;
    when 'comment_likes' then select author_id into other from public.comments where id = new.comment_id;
    when 'follows' then other := new.creator_id;
    when 'mentions' then other := new.mentioned_id;
    when 'messages' then
      select case when t.buyer_id = auth.uid() then t.seller_id else t.buyer_id end into other from public.chat_threads t where t.id = new.thread_id;
    when 'chat_threads' then other := case when new.buyer_id = auth.uid() then new.seller_id else new.buyer_id end;
    when 'story_reactions' then select author_id into other from public.stories where id = new.story_id;
    else return new;
  end case;
  if private.blocked_between(auth.uid(), other) or private.blocked_between(auth.uid(), other2) then
    raise exception 'BLOCKED' using errcode = 'P0001', hint = 'ทำรายการนี้กับผู้ใช้คนนี้ไม่ได้';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['comments','post_likes','comment_likes','follows','mentions','messages','chat_threads','story_reactions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('create or replace trigger b_block_guard before insert on public.%I for each row execute function private.block_guard()', t);
    end if;
  end loop;
end $$;

-- =====================================================================================================
-- D. hidden state for comments / stories (posts already have status visible|hidden|removed)
alter table public.comments add column if not exists hidden_at timestamptz;
alter table public.stories add column if not exists hidden_at timestamptz;

drop policy if exists "comments on visible posts" on public.comments;
create policy "comments on visible posts" on public.comments for select to anon, authenticated
  using ((select private.post_visible(post_id))
         and (hidden_at is null or author_id = (select auth.uid()) or (select private.is_staff('moderator')))
         and not private.hidden_author(author_id));
drop policy if exists "visible or own posts" on public.posts;
create policy "visible or own posts" on public.posts for select to anon, authenticated
  using ((status = 'visible' and not private.hidden_author(author_id)) or author_id = (select auth.uid()) or (select private.is_staff('moderator')));
drop policy if exists "live stories are public" on public.stories;
create policy "live stories are public" on public.stories for select to anon, authenticated
  using ((expires_at > now() and hidden_at is null and not private.hidden_author(author_id)) or author_id = (select auth.uid()) or (select private.is_staff('moderator')));
grant execute on function private.is_staff(text) to anon;   -- used inside the read policies above; returns false for guests

-- reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles(id) on delete set null,   -- null = raised by LUMI (content rule)
  source text not null default 'user' check (source in ('user','system')),
  target_type text not null check (target_type in ('post','comment','story','product','profile','message','review','group')),
  target_id text not null check (char_length(target_id) between 1 and 64),
  target_owner uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 120),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  auto_hidden boolean not null default false,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists reports_one_per_reporter on public.reports (reporter_id, target_type, target_id) where reporter_id is not null;
create index if not exists reports_queue on public.reports (status, created_at desc);
create index if not exists reports_target on public.reports (target_type, target_id);
create index if not exists reports_owner on public.reports (target_owner);
create index if not exists reports_handled_by on public.reports (handled_by);
alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;
grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;
grant all on public.reports to service_role;
drop policy if exists "own reports, moderators all" on public.reports;
create policy "own reports, moderators all" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_staff('moderator')));
drop policy if exists "file a report" on public.reports;
create policy "file a report" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create or replace trigger a_throttle before insert on public.reports for each row execute function private.throttle_row('report');

create or replace function private.report_target_owner(p_type text, p_id text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid; i uuid;
begin
  if p_type = 'group' then
    if to_regclass('public.rooms') is null then return null; end if;
    execute 'select owner_id from public.rooms where id = $1' into u using p_id;   -- column added by 0020
    return u;
  end if;
  begin i := p_id::uuid; exception when others then return null; end;
  case p_type
    when 'post' then select author_id into u from public.posts where id = i and (status = 'visible' or author_id = auth.uid());
    when 'comment' then select author_id into u from public.comments where id = i;
    when 'story' then select author_id into u from public.stories where id = i;
    when 'product' then select creator_id into u from public.products where id = i and private.product_visible(i);
    when 'profile' then select id into u from public.profiles where id = i;
    when 'message' then select m.sender_id into u from public.messages m where m.id = i and private.is_thread_member(m.thread_id);
    when 'review' then select author_id into u from public.reviews where id = i;
    else u := null;
  end case;
  return u;
end $$;

create or replace function private.reports_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.bypass() then
    new.target_owner := coalesce(new.target_owner, private.report_target_owner(new.target_type, new.target_id));
    return new;
  end if;
  new.reporter_id := auth.uid(); new.source := 'user'; new.status := 'open'; new.auto_hidden := false;
  new.handled_by := null; new.handled_at := null; new.created_at := now();
  new.target_owner := private.report_target_owner(new.target_type, new.target_id);
  if new.target_owner is null and new.target_type <> 'group' then
    raise exception 'REPORT_TARGET_NOT_FOUND' using errcode = 'P0001', hint = 'ไม่พบสิ่งที่ต้องการรายงาน';
  end if;
  if new.target_owner = auth.uid() then
    raise exception 'REPORT_OWN' using errcode = 'P0001', hint = 'รายงานโพสต์หรือผลงานของตัวเองไม่ได้';
  end if;
  return new;
end $$;
drop trigger if exists reports_before on public.reports;
create trigger reports_before before insert on public.reports for each row execute function private.reports_before();

-- hide / unhide one piece of content (moderation helpers, trusted code only)
create or replace function private.set_content_hidden(p_type text, p_id text, p_hidden boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare i uuid; n int := 0;
begin
  begin i := p_id::uuid; exception when others then return false; end;
  perform private.set_bypass(true);
  if p_type = 'post' then
    update public.posts set status = case when p_hidden then 'hidden' else 'visible' end
      where id = i and status = case when p_hidden then 'visible' else 'hidden' end;
  elsif p_type = 'comment' then
    update public.comments set hidden_at = case when p_hidden then now() else null end where id = i and (hidden_at is null) = p_hidden;
  elsif p_type = 'story' then
    update public.stories set hidden_at = case when p_hidden then now() else null end where id = i and (hidden_at is null) = p_hidden;
  end if;
  get diagnostics n = row_count;
  perform private.set_bypass(false);
  return n > 0;
end $$;

create or replace function private.reports_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cfg jsonb := coalesce(private.setting('moderation'), '{}'::jsonb); n int; lim int := coalesce((cfg ->> 'auto_hide_reports')::int, 3);
begin
  select count(distinct reporter_id) into n from public.reports
    where target_type = new.target_type and target_id = new.target_id and status = 'open' and source = 'user';
  if n >= lim then
    if coalesce(cfg -> 'auto_hide_types' ? new.target_type, false) and private.set_content_hidden(new.target_type, new.target_id, true) then
      update public.reports set auto_hidden = true where target_type = new.target_type and target_id = new.target_id and status = 'open';
      perform set_config('lumi.actor_role', 'auto_moderation', true);
      perform private.audit('report.auto_hidden', new.target_type, new.target_id, null, jsonb_build_object('reporters', n));
      perform set_config('lumi.actor_role', '', true);
      perform private.notify(new.target_owner, 'moderation',
        'เนื้อหาของคุณถูกซ่อนไว้ชั่วคราว เพราะมีผู้ใช้หลายคนรายงาน ทีม LUMI จะตรวจสอบและแจ้งผลอีกครั้ง', null, null);
    elsif n = lim then
      perform set_config('lumi.actor_role', 'auto_moderation', true);
      perform private.audit('report.threshold', new.target_type, new.target_id, null, jsonb_build_object('reporters', n));
      perform set_config('lumi.actor_role', '', true);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists reports_after on public.reports;
create trigger reports_after after insert on public.reports for each row execute function private.reports_after();

-- moderators: dismiss (restore what was auto-hidden) or remove the reported content
create or replace function private.resolve_reports(p_type text, p_id text, p_action text, p_note text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; i uuid;
begin
  if not private.is_staff('moderator') then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_action not in ('dismiss','remove') then raise exception 'bad action' using errcode = '22023'; end if;
  if p_action = 'dismiss' then
    perform private.set_content_hidden(p_type, p_id, false);
  else
    begin i := p_id::uuid; exception when others then i := null; end;
    perform private.set_bypass(true);
    if p_type = 'post' then update public.posts set status = 'removed' where id = i;
    elsif p_type in ('comment','story') then perform private.set_content_hidden(p_type, p_id, true);
    elsif p_type = 'product' then update public.products set status = 'removed' where id = i;
    elsif p_type = 'review' then delete from public.reviews where id = i;
    end if;
    perform private.set_bypass(false);
  end if;
  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end,
    handled_by = auth.uid(), handled_at = now()
    where target_type = p_type and target_id = p_id and status = 'open';
  get diagnostics n = row_count;
  perform private.audit('report.' || p_action, p_type, p_id, null, jsonb_build_object('reports', n, 'note', left(p_note, 300)));
  return n;
end $$;
create or replace function public.resolve_reports(p_type text, p_id text, p_action text, p_note text default null) returns int
language sql set search_path = '' as $$ select private.resolve_reports(p_type, p_id, p_action, p_note) $$;

-- admins: restrict an account (mute posting / ban) for N hours (null = until lifted), or lift it
create or replace function private.sanction_user(p_user uuid, p_kind text, p_hours int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff('admin') then raise exception 'admins only' using errcode = '42501'; end if;
  if p_kind = 'lift' then
    update private.user_sanctions set lifted_at = now() where user_id = p_user and lifted_at is null;
  elsif p_kind in ('mute','ban') then
    insert into private.user_sanctions (user_id, kind, reason, until, created_by)
      values (p_user, p_kind, left(p_reason, 300), case when p_hours is null then null else now() + make_interval(hours => p_hours) end, auth.uid());
  else raise exception 'bad kind' using errcode = '22023';
  end if;
  perform private.audit('user.' || p_kind, 'user', p_user::text, null, jsonb_build_object('hours', p_hours, 'reason', left(p_reason, 300)));
end $$;
create or replace function public.sanction_user(p_user uuid, p_kind text, p_hours int default null, p_reason text default null) returns void
language sql set search_path = '' as $$ select private.sanction_user(p_user, p_kind, p_hours, p_reason) $$;

-- =====================================================================================================
-- F. banned-content rules
create table if not exists private.content_rules (
  id bigint generated always as identity primary key,
  pattern text not null,                       -- case-insensitive POSIX regex
  action text not null check (action in ('block','flag')),
  applies_to text[] not null default '{post,comment,story,message,profile,product}',
  note text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
revoke all on private.content_rules from public, anon, authenticated;
insert into private.content_rules (pattern, action, applies_to, note)
select * from (values
  ('(keygen|warez|nulled|cracked|crack\s*(version|ver\.?|ไฟล์)|แคร็ก|แคร็ค)', 'flag', '{post,comment,product,story}'::text[], 'ของเถื่อน/แคร็ก (ห้องโค้ด: ห้ามแจกไฟล์แคร็ก)')
) v(p, a, t, n)
where not exists (select 1 from private.content_rules);

-- returns the first matching rule for this kind of content
create or replace function private.match_content_rule(p_kind text, p_text text) returns private.content_rules
language sql stable security definer set search_path = '' as $$
  select r.* from private.content_rules r
  where r.enabled and p_kind = any (r.applies_to) and coalesce(p_text, '') ~* r.pattern
  order by case r.action when 'block' then 0 else 1 end, r.id limit 1
$$;

-- the text a rule is matched against, per table (works on to_jsonb(row) so one function serves every table)
create or replace function private.content_text(p_table text, r jsonb) returns text
language sql immutable set search_path = '' as $$
  select case p_table
    when 'posts' then concat_ws(' ', r ->> 'body', r ->> 'prompt')
    when 'comments' then r ->> 'body'
    when 'stories' then r ->> 'caption'
    when 'messages' then r ->> 'body'
    when 'profiles' then concat_ws(' ', r ->> 'display_name', r ->> 'bio')
    when 'products' then concat_ws(' ', r ->> 'title', r ->> 'use_text', r ->> 'description') end
$$;

create or replace function private.content_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; txt text; r private.content_rules; d jsonb := to_jsonb(new); owner uuid;
begin
  k := case tg_table_name when 'posts' then 'post' when 'comments' then 'comment' when 'stories' then 'story'
                          when 'messages' then 'message' when 'profiles' then 'profile' when 'products' then 'product' end;
  if k is null then return new; end if;
  txt := private.content_text(tg_table_name, d);
  if tg_op = 'UPDATE' and txt is not distinct from private.content_text(tg_table_name, to_jsonb(old)) then return new; end if;
  r := private.match_content_rule(k, txt);
  if r.id is null then return new; end if;
  if tg_when = 'BEFORE' then
    if r.action = 'block' and not private.bypass() then
      raise exception 'CONTENT_BLOCKED' using errcode = 'P0001', hint = 'ข้อความนี้มีคำหรือเนื้อหาที่ LUMI ไม่อนุญาต กรุณาแก้ไขแล้วลองใหม่';
    end if;
    return new;
  end if;
  if r.action = 'flag' then
    owner := coalesce(d ->> 'author_id', d ->> 'sender_id', d ->> 'creator_id', case when k = 'profile' then d ->> 'id' end)::uuid;
    perform private.set_bypass(true);
    insert into public.reports (reporter_id, source, target_type, target_id, target_owner, reason, details)
      values (null, 'system', k, d ->> 'id', owner, 'content_rule', left('ตรงกฎเนื้อหา #' || r.id || ': ' || r.note, 1000));
    perform private.set_bypass(false);
  end if;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['posts','comments','stories','messages','profiles','products'] loop
    execute format('create or replace trigger c_content_guard before insert or update on public.%I for each row execute function private.content_guard()', t);
    execute format('create or replace trigger z_content_flag after insert or update on public.%I for each row execute function private.content_guard()', t);
  end loop;
end $$;

-- =====================================================================================================
-- G. virus-scan pipeline (scanner-agnostic). tier basic = the scan-file edge function (size, EICAR, disguised programs,
-- file signature vs extension). tier deep = a real antivirus worker (ClamAV now, any engine later) that claims jobs
-- with scan_claim() and reports with scan_finish() using the service key.
alter table public.product_files add column if not exists store text not null default 'supabase' check (store in ('supabase','r2'));

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.product_files(id) on delete cascade,
  tier text not null check (tier in ('basic','deep')),
  engine text check (char_length(engine) <= 40),
  status text not null default 'queued' check (status in ('queued','running','clean','infected','error')),
  signature text check (char_length(signature) <= 300),
  detail jsonb not null default '{}' check (octet_length(detail::text) <= 8000),
  attempts int not null default 0,
  worker text check (char_length(worker) <= 80),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (file_id, tier)
);
create index if not exists scan_jobs_queue on public.scan_jobs (tier, status, queued_at) where status in ('queued','running','error');
alter table public.scan_jobs enable row level security;
revoke all on public.scan_jobs from public, anon, authenticated;
grant select on public.scan_jobs to authenticated;
grant all on public.scan_jobs to service_role;
drop policy if exists "own file scans, staff all" on public.scan_jobs;
create policy "own file scans, staff all" on public.scan_jobs for select to authenticated
  using (exists (select 1 from public.product_files f where f.id = file_id and f.owner_id = (select auth.uid())) or (select private.is_staff('support')));

create or replace function private.file_needs_deep(p_file uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.setting('scan') ->> 'enforce', 'true') = 'true' and exists (
    select 1 from public.product_files f
    left join public.products p on p.id = f.product_id
    left join public.listing_drafts d on d.id = f.draft_id
    where f.id = p_file and (
      coalesce(private.setting('scan') -> 'deep_required_types' ? coalesce(p.sell_type::text, d.type::text, ''), false)
      or coalesce(private.setting('scan') -> 'deep_required_exts' ? lower(coalesce(substring(f.name from '\.([A-Za-z0-9]+)$'), '')), false)))
$$;
create or replace function private.file_deep_ok(p_file uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.file_needs_deep(p_file)
      or exists (select 1 from public.scan_jobs j where j.file_id = p_file and j.tier = 'deep' and j.status = 'clean')
$$;

create or replace function private.scan_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.scan_jobs (file_id, tier, engine, status, finished_at)
      values (new.id, 'basic', case when new.scan = 'ok' then 'legacy' end,
              case new.scan when 'ok' then 'clean' when 'fail' then 'infected' else 'queued' end,
              case when new.scan in ('ok','fail') then now() end)
      on conflict (file_id, tier) do nothing;
  elsif new.scan is distinct from old.scan and new.scan in ('ok','fail') then
    update public.scan_jobs set status = case when new.scan = 'ok' then 'clean' else 'infected' end,
      engine = coalesce(engine, 'basic'), finished_at = now()
      where file_id = new.id and tier = 'basic' and status in ('queued','running');
  elsif new.scan is distinct from old.scan and new.scan = 'scanning' then
    update public.scan_jobs set status = 'running', started_at = now(), attempts = attempts + 1
      where file_id = new.id and tier = 'basic' and status = 'queued';
  end if;
  if private.file_needs_deep(new.id) and new.scan <> 'fail' then
    insert into public.scan_jobs (file_id, tier) values (new.id, 'deep') on conflict (file_id, tier) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists scan_enqueue on public.product_files;
create trigger scan_enqueue after insert or update of scan, product_id, draft_id, name on public.product_files
  for each row execute function private.scan_enqueue();

-- worker side (service key only)
create or replace function private.scan_claim(p_tier text, p_engine text, p_worker text)
returns table (job_id uuid, file_id uuid, bucket text, path text, name text, size_bytes bigint, store text)
language plpgsql security definer set search_path = '' as $$
declare j public.scan_jobs;
begin
  if not private.is_service() then raise exception 'service only' using errcode = '42501'; end if;
  select * into j from public.scan_jobs s
    where s.tier = p_tier and (s.status = 'queued' or (s.status = 'running' and s.started_at < now() - interval '15 minutes')
                               or (s.status = 'error' and s.attempts < 5 and s.finished_at < now() - interval '5 minutes'))
    order by s.queued_at for update skip locked limit 1;
  if not found then return; end if;
  update public.scan_jobs set status = 'running', engine = left(p_engine, 40), worker = left(p_worker, 80),
    started_at = now(), attempts = attempts + 1 where id = j.id;
  return query select j.id, f.id, f.bucket, f.path, f.name, f.size_bytes, f.store from public.product_files f where f.id = j.file_id;
end $$;

create or replace function private.scan_finish(p_job uuid, p_status text, p_signature text, p_detail jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.scan_jobs; f public.product_files;
begin
  if not private.is_service() then raise exception 'service only' using errcode = '42501'; end if;
  if p_status not in ('clean','infected','error') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.scan_jobs set status = p_status, signature = left(p_signature, 300), detail = coalesce(p_detail, '{}'::jsonb), finished_at = now()
    where id = p_job returning * into j;
  if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
  select * into f from public.product_files where id = j.file_id;
  if p_status = 'infected' then
    perform private.set_bypass(true);
    update public.product_files set scan = 'fail' where id = f.id;
    perform private.set_bypass(false);
    perform set_config('lumi.actor_role', 'scanner', true);
    perform private.audit('scan.infected', 'file', f.id::text, null, jsonb_build_object('tier', j.tier, 'engine', j.engine, 'signature', left(p_signature, 300), 'product', f.product_id));
    perform set_config('lumi.actor_role', '', true);
    perform private.notify(f.owner_id, 'moderation', 'ไฟล์ “' || f.name || '” ไม่ผ่านการสแกนไวรัส จึงถูกนำออก กรุณาตรวจเครื่องของคุณแล้วอัปโหลดไฟล์ใหม่', null, null);
  end if;
end $$;

create or replace function public.scan_claim(p_tier text, p_engine text, p_worker text default null)
returns table (job_id uuid, file_id uuid, bucket text, path text, name text, size_bytes bigint, store text)
language sql set search_path = '' as $$ select * from private.scan_claim(p_tier, p_engine, p_worker) $$;
create or replace function public.scan_finish(p_job uuid, p_status text, p_signature text default null, p_detail jsonb default null) returns void
language sql set search_path = '' as $$ select private.scan_finish(p_job, p_status, p_signature, p_detail) $$;

-- gate 1: a listing cannot go live while any of its files still needs a clean deep scan (applies to moderator approval too)
create or replace function private.scan_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and new.review_status = 'live'
     and (tg_op = 'INSERT' or old.review_status is distinct from 'live' or old.status is distinct from 'published')
     and exists (select 1 from public.product_files f where f.product_id = new.id and f.role = 'deliverable' and not private.file_deep_ok(f.id)) then
    raise exception 'SCAN_REQUIRED' using errcode = 'P0001',
      hint = 'ไฟล์ประเภทโปรแกรมหรือโค้ดต้องผ่านการสแกนไวรัสแบบเต็มก่อนขึ้นร้าน';
  end if;
  return new;
end $$;
drop trigger if exists products_scan_gate on public.products;
create trigger products_scan_gate before insert or update on public.products
  for each row execute function private.scan_gate();

-- gate 1b: an edit (listing_revisions) of a live listing that brings new program files waits for the deep scan too.
-- errcode 55000 (not P0001) so decide_internal's "incomplete data" handler does not swallow it: the moderator sees why.
create or replace function private.revision_scan_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
     and exists (select 1 from public.product_files f where f.id = any (new.file_ids) and f.role = 'deliverable' and not private.file_deep_ok(f.id)) then
    raise exception 'SCAN_REQUIRED' using errcode = '55000',
      hint = 'ไฟล์ประเภทโปรแกรมหรือโค้ดต้องผ่านการสแกนไวรัสแบบเต็มก่อนขึ้นร้าน';
  end if;
  return new;
end $$;
drop trigger if exists revisions_scan_gate on public.listing_revisions;
create trigger revisions_scan_gate before update on public.listing_revisions for each row execute function private.revision_scan_gate();

-- gate 2: downloads (same body as 0015 + the deep-scan check)
create or replace function private.download_check(p_file uuid) returns table (bucket text, path text, name text)
language plpgsql security definer set search_path = '' as $$
declare f public.product_files;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into f from public.product_files where id = p_file;
  if not found or f.bucket <> 'deliverables' or not private.can_download(f.bucket, f.path) then
    raise exception 'no access to this file' using errcode = '42501';
  end if;
  if not private.file_deep_ok(f.id) then
    raise exception 'SCAN_PENDING' using errcode = 'P0001', hint = 'ไฟล์นี้กำลังรอสแกนไวรัส ดาวน์โหลดได้เมื่อสแกนผ่านแล้ว';
  end if;
  insert into public.download_events (user_id, file_id, product_id) values (auth.uid(), f.id, f.product_id);
  return query select f.bucket, f.path, f.name;
end $$;

-- backfill: every existing file gets its basic job (already scanned files are recorded as clean/legacy)
insert into public.scan_jobs (file_id, tier, engine, status, finished_at)
select f.id, 'basic', case when f.scan in ('ok','fail') then 'legacy' end,
       case f.scan when 'ok' then 'clean' when 'fail' then 'infected' when 'scanning' then 'running' else 'queued' end,
       case when f.scan in ('ok','fail') then now() end
from public.product_files f on conflict (file_id, tier) do nothing;
insert into public.scan_jobs (file_id, tier)
select f.id, 'deep' from public.product_files f where f.scan <> 'fail' and private.file_needs_deep(f.id) on conflict (file_id, tier) do nothing;

-- =====================================================================================================
-- H. recycle bin
create table if not exists private.trash (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text not null,
  owner_id uuid,
  data jsonb not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now()
);
create index if not exists trash_lookup on private.trash (table_name, row_id);
create index if not exists trash_owner on private.trash (owner_id);
create index if not exists trash_at on private.trash (deleted_at);
revoke all on private.trash from public, anon, authenticated;

create or replace function private.to_trash() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d jsonb := to_jsonb(old);
begin
  insert into private.trash (table_name, row_id, owner_id, data, deleted_by)
  values (tg_table_name, coalesce(d ->> 'id', d ->> 'post_id'),
          coalesce(d ->> 'author_id', d ->> 'creator_id', d ->> 'owner_id', d ->> 'user_id')::uuid, d, auth.uid());
  if random() < 0.01 then
    delete from private.trash where deleted_at < now() - make_interval(days => coalesce((private.setting('moderation') ->> 'trash_days')::int, 30));
  end if;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['posts','comments','stories','reviews','listing_drafts','products','product_files'] loop
    execute format('create or replace trigger z_trash after delete on public.%I for each row execute function private.to_trash()', t);
  end loop;
end $$;

create or replace function private.restore_deleted(p_trash bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare t private.trash;
begin
  if not private.is_staff('admin') then raise exception 'admins only' using errcode = '42501'; end if;
  select * into t from private.trash where id = p_trash;
  if not found then raise exception 'not in the recycle bin' using errcode = 'P0002'; end if;
  perform private.set_bypass(true);
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', t.table_name, t.table_name) using t.data;
  perform private.set_bypass(false);
  delete from private.trash where id = p_trash;
  perform private.audit('trash.restored', t.table_name, t.row_id, null, null);
  return t.table_name || ':' || t.row_id;
end $$;
create or replace function public.restore_deleted(p_trash bigint) returns text
language sql set search_path = '' as $$ select private.restore_deleted(p_trash) $$;

-- =====================================================================================================
-- I. indexes (advisor: unindexed foreign keys) — "if not exists" so a later migration with the same idea is harmless
create index if not exists admin_roles_granted_by_idx on public.admin_roles (granted_by);
create index if not exists listing_revisions_decided_by_idx on public.listing_revisions (decided_by);
create index if not exists stories_author_idx on public.stories (author_id, created_at desc);
create index if not exists stories_product_idx on public.stories (product_id);
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rooms' and column_name = 'owner_id') then
    create index if not exists rooms_owner_id_idx on public.rooms (owner_id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rooms' and column_name = 'pinned_post_id') then
    create index if not exists rooms_pinned_post_id_idx on public.rooms (pinned_post_id);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'room_members' and column_name = 'invited_by') then
    create index if not exists room_members_invited_by_idx on public.room_members (invited_by);
  end if;
end $$;
create index if not exists posts_visible_feed_idx on public.posts (created_at desc) where status = 'visible';
create index if not exists comments_hidden_idx on public.comments (post_id) where hidden_at is not null;

-- =====================================================================================================
-- J. PDPA: a signed-in user exports their own data
create or replace function private.export_my_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform private.throttle('export');
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = u),
    'private_profile', (select to_jsonb(p) - 'payout_recipient_ref' from public.profile_private p where p.id = u),
    'posts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.posts x where x.author_id = u),
    'comments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.comments x where x.author_id = u),
    'stories', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.stories x where x.author_id = u),
    'products', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.products x where x.creator_id = u),
    'drafts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.listing_drafts x where x.owner_id = u),
    'files', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.product_files x where x.owner_id = u),
    'orders', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.orders x where x.buyer_id = u),
    'entitlements', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.entitlements x where x.user_id = u),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.reviews x where x.author_id = u),
    'follows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.follows x where x.follower_id = u),
    'favorites', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.favorites x where x.user_id = u),
    'messages_sent', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.messages x where x.sender_id = u),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.notifications x where x.user_id = u),
    'reports_filed', (select coalesce(jsonb_agg(to_jsonb(x) - 'handled_by'), '[]') from public.reports x where x.reporter_id = u),
    'blocks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.user_blocks x where x.user_id = u),
    'downloads', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.download_events x where x.user_id = u),
    'account_requests', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.account_requests x where x.user_id = u));
end $$;
create or replace function public.export_my_data() returns jsonb
language sql set search_path = '' as $$ select private.export_my_data() $$;

-- =====================================================================================================
-- permissions for everything above
revoke execute on function private.active_sanction(uuid), private.throttle(text), private.throttle_row(), private.signup_guard(),
  private.user_blocks_before(), private.user_blocks_after(), private.blocked_between(uuid, uuid), private.block_guard(),
  private.report_target_owner(text, text), private.reports_before(), private.set_content_hidden(text, text, boolean), private.reports_after(),
  private.resolve_reports(text, text, text, text), private.sanction_user(uuid, text, int, text),
  private.match_content_rule(text, text), private.content_text(text, jsonb), private.content_guard(),
  private.file_needs_deep(uuid), private.file_deep_ok(uuid), private.scan_enqueue(), private.scan_claim(text, text, text), private.scan_finish(uuid, text, text, jsonb),
  private.scan_gate(), private.revision_scan_gate(), private.to_trash(), private.restore_deleted(bigint), private.export_my_data()
  from public, anon, authenticated;
grant execute on function private.resolve_reports(text, text, text, text), private.sanction_user(uuid, text, int, text),
  private.restore_deleted(bigint), private.export_my_data() to authenticated;
grant execute on function private.scan_claim(text, text, text), private.scan_finish(uuid, text, text, jsonb) to service_role;
revoke execute on function public.resolve_reports(text, text, text, text), public.sanction_user(uuid, text, int, text),
  public.restore_deleted(bigint), public.export_my_data(), public.scan_claim(text, text, text), public.scan_finish(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.resolve_reports(text, text, text, text), public.sanction_user(uuid, text, int, text),
  public.restore_deleted(bigint), public.export_my_data() to authenticated, service_role;
grant execute on function public.scan_claim(text, text, text), public.scan_finish(uuid, text, text, jsonb) to service_role;
