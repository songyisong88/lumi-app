-- LUMI 0012: listing review flow, test-mode switches, stories, refunds, review replies, account requests, moderators

-- ---------- settings (server-side switches; test mode until a real payment provider is connected)
create table if not exists private.settings (key text primary key, value jsonb not null);
revoke all on private.settings from public, anon, authenticated;
insert into private.settings (key, value) values
  ('test_payments', 'true'::jsonb),        -- pay_order_test() marks orders paid without money. MUST be false in production.
  ('test_auto_review_seconds', '20'::jsonb) -- listings pass review by themselves after N seconds (no moderators yet). null = off
on conflict (key) do nothing;
create or replace function private.setting(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$ select value from private.settings where key = p_key $$;
revoke execute on function private.setting(text) from public, anon, authenticated;

create table if not exists private.moderators (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
revoke all on private.moderators from public, anon, authenticated;
create or replace function private.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$ select exists (select 1 from private.moderators where user_id = auth.uid()) $$;
grant execute on function private.is_moderator() to authenticated;

-- ---------- listing review status
alter table public.products
  add column if not exists review_status text not null default 'pending' check (review_status in ('pending','live','rejected')),
  add column if not exists review_reason text check (char_length(review_reason) <= 300),
  add column if not exists submitted_at timestamptz;
alter table public.listing_drafts
  add column if not exists submitted_at timestamptz,
  add column if not exists review_reason text check (char_length(review_reason) <= 300);
create index if not exists products_live_idx on public.products (review_status, status, published_at desc);

-- any (re)publish or content change by the creator goes back to review; moderators/trusted code use the bypass
create or replace function private.products_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  if tg_op = 'INSERT' then
    new.review_status := 'pending'; new.review_reason := null; new.submitted_at := now(); return new;
  end if;
  if (new.review_status, new.review_reason) is distinct from (old.review_status, old.review_reason) then
    raise exception 'only the LUMI team can change review status' using errcode = '42501';
  end if;
  if (new.spec, new.title, new.use_text, new.description, new.covers, new.is_free, new.sell_type)
       is distinct from (old.spec, old.title, old.use_text, old.description, old.covers, old.is_free, old.sell_type)
     or (new.status = 'published' and old.status <> 'published' and old.review_status <> 'live') then
    new.review_status := 'pending'; new.review_reason := null; new.submitted_at := now();
  end if;
  return new;
end $$;
drop trigger if exists products_review on public.products;
create trigger products_review before insert or update on public.products for each row execute function private.products_review();

-- public sees only published AND approved listings; creators always see their own; buyers keep seeing what they bought
drop policy if exists "published or own products" on public.products;
create policy "live, own or bought products" on public.products for select to anon, authenticated
  using ((status = 'published' and review_status = 'live') or creator_id = (select auth.uid()) or (select private.has_entitlement(id)));
create or replace function private.product_visible(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p where p.id = p_product
    and ((p.status = 'published' and p.review_status = 'live') or p.creator_id = auth.uid()))
$$;

-- edits of a live listing wait in the draft until approved; buyers keep the old version meanwhile
create or replace function private.submit_edit(p_draft uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.listing_drafts set submitted_at = now(), review_reason = null
    where id = p_draft and owner_id = auth.uid() and published_product_id is not null;
  if not found then raise exception 'draft not found' using errcode = 'P0002'; end if;
end $$;
create or replace function public.submit_edit(p_draft uuid) returns void
language sql security invoker set search_path = '' as $$ select private.submit_edit(p_draft) $$;

-- approve / reject (moderator), or the test-mode automatic pass (owner, after N seconds)
create or replace function private.finish_review(p_product uuid, p_draft uuid, p_pass boolean, p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.products; d public.listing_drafts; secs int := (private.setting('test_auto_review_seconds'))::text::int; moder boolean := private.is_moderator(); t text;
begin
  if p_draft is not null then
    select * into d from public.listing_drafts where id = p_draft and submitted_at is not null;
    if not found then return 'none'; end if;
    if not moder and not (d.owner_id = auth.uid() and secs is not null and p_pass and d.submitted_at <= now() - make_interval(secs => secs)) then return 'wait'; end if;
    if not p_pass then
      update public.listing_drafts set submitted_at = null, review_reason = left(coalesce(p_reason, 'ไม่ผ่านการตรวจ'), 300) where id = d.id;
      perform private.notify(d.owner_id, 'system', 'การแก้ไข “' || d.title || '” ยังไม่ผ่านการตรวจ: ' || coalesce(p_reason, ''), '/product/' || d.published_product_id);
      return 'rejected';
    end if;
    perform private.set_bypass(true);
    perform public.publish_listing(d.id, false, false);
    perform private.set_bypass(false);
    perform private.notify(d.owner_id, 'system', 'การแก้ไข “' || d.title || '” ผ่านการตรวจแล้ว · ผู้ซื้อเห็นฉบับใหม่แล้ว', '/product/' || d.published_product_id);
    return 'live';
  end if;
  select * into p from public.products where id = p_product and review_status = 'pending' and status = 'published';
  if not found then return 'none'; end if;
  if not moder and not (p.creator_id = auth.uid() and secs is not null and p_pass and p.submitted_at <= now() - make_interval(secs => secs)) then return 'wait'; end if;
  perform private.set_bypass(true);
  update public.products set review_status = case when p_pass then 'live' else 'rejected' end,
    review_reason = case when p_pass then null else left(coalesce(p_reason, 'ไม่ผ่านการตรวจ'), 300) end where id = p.id;
  perform private.set_bypass(false);
  t := case when p_pass then '“' || p.title || '” ผ่านการตรวจแล้ว · ขึ้นขายบนหน้าแรก หน้าค้นหา และหน้าร้านแล้ว'
            else '“' || p.title || '” ยังไม่ผ่านการตรวจ: ' || coalesce(p_reason, '') || ' · แก้ไขแล้วส่งตรวจใหม่ได้' end;
  perform private.notify(p.creator_id, 'system', t, '/product/' || p.id, null, p.covers[1]);
  return case when p_pass then 'live' else 'rejected' end;
end $$;
create or replace function public.finish_review(p_product uuid default null, p_draft uuid default null, p_pass boolean default true, p_reason text default null) returns text
language sql security invoker set search_path = '' as $$ select private.finish_review(p_product, p_draft, p_pass, p_reason) $$;

-- ---------- test-mode payment (no money moves). Turn private.settings.test_payments off before going live.
create or replace function private.pay_order_test(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if coalesce((private.setting('test_payments'))::text, 'false') <> 'true' then raise exception 'test payments are off' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order and buyer_id = auth.uid();
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  perform private.mark_order_paid(o.id, 'test_' || replace(gen_random_uuid()::text, '-', ''), o.total);
end $$;
create or replace function public.pay_order_test(p_order uuid) returns void
language sql security invoker set search_path = '' as $$ select private.pay_order_test(p_order) $$;

-- ---------- review replies (creator answers under a buyer review)
alter table public.reviews add column if not exists reply text check (char_length(reply) <= 500), add column if not exists reply_at timestamptz;
create or replace function private.reply_review(p_review uuid, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.reviews r set reply = nullif(left(btrim(coalesce(p_text, '')), 500), ''), reply_at = now()
    where r.id = p_review and exists (select 1 from public.products p where p.id = r.product_id and p.creator_id = auth.uid());
  if not found then raise exception 'only the creator of this listing can reply' using errcode = '42501'; end if;
end $$;
create or replace function public.reply_review(p_review uuid, p_text text) returns void
language sql security invoker set search_path = '' as $$ select private.reply_review(p_review, p_text) $$;

-- ---------- refunds / problem reports
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references public.order_items(id) on delete cascade,
  thread_id uuid references public.chat_threads(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete cascade,
  amount int not null default 0,
  reason text not null check (char_length(reason) between 1 and 120),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open','refunded','declined','escalated')),
  creator_note text check (char_length(creator_note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists refund_requests_creator_idx on public.refund_requests (creator_id, created_at desc);
create index if not exists refund_requests_buyer_idx on public.refund_requests (buyer_id, created_at desc);
create index if not exists refund_requests_item_idx on public.refund_requests (order_item_id);
create index if not exists refund_requests_thread_idx on public.refund_requests (thread_id);
alter table public.refund_requests enable row level security;
create or replace function private.refund_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare i public.order_items;
begin
  if private.bypass() then return new; end if;
  new.buyer_id := auth.uid(); new.status := 'open'; new.resolved_at := null; new.creator_note := null;
  if new.order_item_id is not null then
    select oi.* into i from public.order_items oi join public.orders o on o.id = oi.order_id
      where oi.id = new.order_item_id and o.buyer_id = auth.uid() and o.status = 'paid';
    if not found then raise exception 'not your order' using errcode = '42501'; end if;
    new.creator_id := i.creator_id; new.amount := i.unit_price - i.discount;
  elsif new.thread_id is not null then
    select seller_id into new.creator_id from public.chat_threads where id = new.thread_id and buyer_id = auth.uid();
    if not found then raise exception 'not your thread' using errcode = '42501'; end if;
  else raise exception 'order item or thread required' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists refund_before on public.refund_requests;
create trigger refund_before before insert on public.refund_requests for each row execute function private.refund_before();
grant select on public.refund_requests to authenticated;
grant insert (order_item_id, thread_id, reason, note) on public.refund_requests to authenticated;
grant all on public.refund_requests to service_role;
create policy "buyer or creator reads refund" on public.refund_requests for select to authenticated
  using (buyer_id = (select auth.uid()) or creator_id = (select auth.uid()));
create policy "buyer asks refund" on public.refund_requests for insert to authenticated with check (buyer_id = (select auth.uid()));

-- creator answers: refund (test mode: ledger refunded + access revoked; no money moves) or decline (LUMI team decides later)
create or replace function private.answer_refund(p_id uuid, p_refund boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.refund_requests;
begin
  select * into r from public.refund_requests where id = p_id and creator_id = auth.uid() and status = 'open' for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  update public.refund_requests set status = case when p_refund then 'refunded' else 'escalated' end,
    creator_note = left(p_note, 500), resolved_at = now() where id = r.id;
  if p_refund and r.order_item_id is not null then
    update public.ledger set status = 'refunded' where order_item_id = r.order_item_id and status in ('held','released');
    update public.entitlements set revoked_at = now() where order_item_id = r.order_item_id;
  end if;
  perform private.notify(r.buyer_id, 'order', case when p_refund then 'ครีเอเตอร์ยอมรับคืนเงิน ฿' || r.amount || ' (ทดลอง ยังไม่มีการโอนเงินจริง)'
    else 'ครีเอเตอร์ไม่ยอมรับคำขอคืนเงิน · ทีม LUMI จะตรวจสอบและตัดสิน' end, '/library');
end $$;
create or replace function public.answer_refund(p_id uuid, p_refund boolean, p_note text default null) returns void
language sql security invoker set search_path = '' as $$ select private.answer_refund(p_id, p_refund, p_note) $$;

-- ---------- stories (image / short video, 24 h)
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  media_path text not null check (char_length(media_path) <= 300),
  media_kind text not null default 'image' check (media_kind in ('image','video')),
  caption text not null default '' check (char_length(caption) <= 200),
  product_id uuid references public.products(id) on delete set null,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_live_idx on public.stories (expires_at desc, author_id);
create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index if not exists story_views_viewer_idx on public.story_views (viewer_id);
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
create or replace function private.stories_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  new.author_id := auth.uid(); new.view_count := 0; new.created_at := now(); new.expires_at := now() + interval '24 hours';
  if new.media_path not like auth.uid()::text || '/%' then raise exception 'media must be in your own folder' using errcode = '22023'; end if;
  if (select count(*) from public.stories s where s.author_id = auth.uid() and s.expires_at > now()) >= 20 then
    raise exception 'ลงสตอรี่ได้สูงสุด 20 อันใน 24 ชั่วโมง' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists stories_before on public.stories;
create trigger stories_before before insert on public.stories for each row execute function private.stories_before();
create or replace function private.story_views_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin update public.stories set view_count = view_count + 1 where id = new.story_id; return new; end $$;
drop trigger if exists story_views_after on public.story_views;
create trigger story_views_after after insert on public.story_views for each row execute function private.story_views_after();
grant select on public.stories to anon, authenticated;
grant insert (media_path, media_kind, caption, product_id) on public.stories to authenticated;
grant delete on public.stories to authenticated;
grant select, insert (story_id) on public.story_views to authenticated;
grant all on public.stories, public.story_views to service_role;
create policy "live stories are public" on public.stories for select to anon, authenticated
  using (expires_at > now() or author_id = (select auth.uid()));
create policy "post own story" on public.stories for insert to authenticated with check (author_id = (select auth.uid()));
create policy "delete own story" on public.stories for delete to authenticated using (author_id = (select auth.uid()));
create policy "own views or views of my stories" on public.story_views for select to authenticated
  using (viewer_id = (select auth.uid()) or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid())));
create policy "record own view" on public.story_views for insert to authenticated
  with check (viewer_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id and s.expires_at > now()));

-- ---------- account: deletion requests (handled by the LUMI team within 30 days, PDPA)
create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null default 'delete' check (kind in ('delete','export')),
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'open' check (status in ('open','done','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists account_requests_user_idx on public.account_requests (user_id);
alter table public.account_requests enable row level security;
grant select, insert (kind, reason), delete on public.account_requests to authenticated;
grant all on public.account_requests to service_role;
create policy "own requests" on public.account_requests for select to authenticated using (user_id = (select auth.uid()));
create policy "file own request" on public.account_requests for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cancel own request" on public.account_requests for delete to authenticated using (user_id = (select auth.uid()) and status = 'open');

-- function grants (exposed wrappers are security invoker; the definer code lives in private)
revoke execute on function public.submit_edit(uuid), public.finish_review(uuid, uuid, boolean, text), public.pay_order_test(uuid),
  public.reply_review(uuid, text), public.answer_refund(uuid, boolean, text) from public, anon;
grant execute on function public.submit_edit(uuid), public.finish_review(uuid, uuid, boolean, text), public.pay_order_test(uuid),
  public.reply_review(uuid, text), public.answer_refund(uuid, boolean, text) to authenticated, service_role;
revoke execute on function private.submit_edit(uuid), private.finish_review(uuid, uuid, boolean, text), private.pay_order_test(uuid),
  private.reply_review(uuid, text), private.answer_refund(uuid, boolean, text) from public, anon;
grant execute on function private.submit_edit(uuid), private.finish_review(uuid, uuid, boolean, text), private.pay_order_test(uuid),
  private.reply_review(uuid, text), private.answer_refund(uuid, boolean, text) to authenticated, service_role;
revoke execute on function private.refund_before(), private.stories_before(), private.story_views_after(), private.products_review() from public, anon, authenticated;

alter publication supabase_realtime add table public.stories, public.refund_requests;
