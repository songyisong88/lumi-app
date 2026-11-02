-- LUMI 0004: favorites, follows, coupons, hire jobs + offers (escrow status), cart, orders, entitlements, reviews, ledger, payouts
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index favorites_product_idx on public.favorites (product_id);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);
create index follows_creator_idx on public.follows (creator_id);

create table public.coupons (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  label text not null check (char_length(label) <= 80),
  pct int not null check (pct between 1 and 90),
  creator_id uuid references public.profiles(id) on delete cascade,   -- null = LUMI-wide coupon (LUMI absorbs the discount)
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int check (max_uses > 0),
  used_count int not null default 0,
  created_at timestamptz not null default now()
);
create index coupons_creator_idx on public.coupons (creator_id);

-- ---------- hire jobs (งานจ้าง) and quotes
create table public.hire_jobs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  package text not null default '' check (char_length(package) <= 60),
  brief jsonb not null default '[]' check (jsonb_typeof(brief) = 'array' and octet_length(brief::text) <= 20000),
  amount int check (amount > 0),
  offer_id uuid,
  order_id uuid,
  step int not null default 0 check (step between 0 and 5),
  status public.job_status not null default 'briefed',
  escrow public.escrow_status not null default 'none',
  revisions_left int not null default 2 check (revisions_left >= 0),
  delivered_at timestamptz,
  auto_release_at timestamptz,         -- buyer silent 3 days after delivery => released
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> creator_id)
);
create index hire_jobs_thread_idx on public.hire_jobs (thread_id);
create index hire_jobs_buyer_idx on public.hire_jobs (buyer_id);
create index hire_jobs_creator_idx on public.hire_jobs (creator_id);
create index hire_jobs_product_idx on public.hire_jobs (product_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.hire_jobs(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  amount int not null check (amount between 1 and 1000000),
  items text[] not null default '{}' check (cardinality(items) <= 20),
  status public.offer_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index offers_job_idx on public.offers (job_id);
create index offers_thread_idx on public.offers (thread_id);
create index offers_creator_idx on public.offers (creator_id);
create index offers_buyer_idx on public.offers (buyer_id);
alter table public.hire_jobs add constraint hire_jobs_offer_fk foreign key (offer_id) references public.offers(id) on delete set null;
create index hire_jobs_offer_idx on public.hire_jobs (offer_id);
alter table public.product_files add constraint product_files_job_fk foreign key (job_id) references public.hire_jobs(id) on delete cascade;

-- ---------- cart / orders
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  option_id uuid references public.product_options(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete cascade,
  tip_creator_id uuid references public.profiles(id) on delete cascade,
  tip_amount int check (tip_amount between 10 and 10000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(product_id, offer_id, tip_creator_id) = 1),
  check ((tip_creator_id is null) = (tip_amount is null))
);
create unique index cart_items_product_uidx on public.cart_items (user_id, product_id, option_id) nulls not distinct where product_id is not null;
create unique index cart_items_offer_uidx on public.cart_items (user_id, offer_id) where offer_id is not null;
create index cart_items_product_idx on public.cart_items (product_id);
create index cart_items_option_idx on public.cart_items (option_id);
create index cart_items_offer_idx on public.cart_items (offer_id);
create index cart_items_tip_idx on public.cart_items (tip_creator_id);

create sequence private.order_no_seq start 20520;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  order_no text not null unique,
  status public.order_status not null default 'pending',
  method text not null check (method in ('promptpay','card','free')),
  coupon_code text references public.coupons(code) on delete set null,
  subtotal int not null default 0 check (subtotal >= 0),
  discount int not null default 0 check (discount >= 0),
  total int not null default 0 check (total >= 0),
  charge_ref text,                 -- payment provider charge id, set by server (locks the order)
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_coupon_idx on public.orders (coupon_code);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  option_id uuid references public.product_options(id) on delete set null,
  offer_id uuid references public.offers(id) on delete restrict,
  job_id uuid references public.hire_jobs(id) on delete restrict,
  tip_creator_id uuid references public.profiles(id) on delete restrict,
  tip_amount int check (tip_amount between 10 and 10000),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  title text not null default '',
  option_code text,
  option_label text,
  unit_price int not null default 0 check (unit_price >= 0),
  discount int not null default 0 check (discount >= 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(product_id, offer_id, tip_creator_id) = 1)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_option_idx on public.order_items (option_id);
create index order_items_offer_idx on public.order_items (offer_id);
create index order_items_job_idx on public.order_items (job_id);
create index order_items_tip_idx on public.order_items (tip_creator_id);
create index order_items_creator_idx on public.order_items (creator_id);
alter table public.hire_jobs add constraint hire_jobs_order_fk foreign key (order_id) references public.orders(id) on delete set null;
create index hire_jobs_order_idx on public.hire_jobs (order_id);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  option_id uuid references public.product_options(id) on delete set null,
  option_code text,
  order_item_id uuid references public.order_items(id) on delete set null,
  thread_id uuid references public.chat_threads(id) on delete set null,
  license_key text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index entitlements_user_idx on public.entitlements (user_id, granted_at desc);
create index entitlements_product_idx on public.entitlements (product_id);
create index entitlements_option_idx on public.entitlements (option_id);
create index entitlements_item_idx on public.entitlements (order_item_id);
create index entitlements_thread_idx on public.entitlements (thread_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  job_id uuid references public.hire_jobs(id) on delete set null,
  stars int not null check (stars between 1 and 5),
  body text check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  unique (product_id, author_id)
);
create index reviews_author_idx on public.reviews (author_id);
create index reviews_job_idx on public.reviews (job_id);

create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  job_id uuid references public.hire_jobs(id) on delete restrict,
  gross int not null check (gross >= 0),
  fee int not null check (fee >= 0),
  net int not null check (net >= 0),
  status public.ledger_status not null default 'held',
  release_after timestamptz,
  payout_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ledger_creator_idx on public.ledger (creator_id, status);
create index ledger_order_idx on public.ledger (order_id);
create index ledger_item_idx on public.ledger (order_item_id);
create index ledger_job_idx on public.ledger (job_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  amount int not null check (amount > 0),
  transfer_fee int not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed')),
  provider_ref text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payouts_creator_idx on public.payouts (creator_id, created_at desc);
alter table public.ledger add constraint ledger_payout_fk foreign key (payout_id) references public.payouts(id) on delete set null;
create index ledger_payout_idx on public.ledger (payout_id);

-- ---------- access helpers
create or replace function private.has_entitlement(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.entitlements e where e.product_id = p_product and e.user_id = auth.uid() and e.revoked_at is null)
$$;
create or replace function private.can_read_secrets(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p where p.id = p_product and p.creator_id = auth.uid())
      or exists (select 1 from public.entitlements e join public.products p on p.id = e.product_id
                 where e.product_id = p_product and e.user_id = auth.uid() and e.revoked_at is null
                   and (p.sell_type <> 'img' or coalesce(e.option_code, '') <> 'img'))
$$;
create or replace function private.is_job_member(p_job uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.hire_jobs j where j.id = p_job and auth.uid() in (j.buyer_id, j.creator_id))
$$;
-- metadata visibility of an uploaded file row
create or replace function private.file_visible(p_owner uuid, p_product uuid, p_thread uuid, p_job uuid, p_role public.file_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_owner = auth.uid()
      or (p_product is not null and p_role = 'deliverable' and (private.owns_product(p_product) or private.has_entitlement(p_product)))
      or (p_thread is not null and private.is_thread_member(p_thread))
$$;
-- may the signed-in user download (signed URL) this object in the private deliverables bucket?
create or replace function private.can_download(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.product_files f
    where f.bucket = p_bucket and f.path = p_name and f.scan = 'ok'
      and ( f.owner_id = auth.uid()
         or (f.product_id is not null and f.role = 'deliverable' and (private.owns_product(f.product_id) or private.has_entitlement(f.product_id)))
         or (f.thread_id is not null and private.is_thread_member(f.thread_id)
             and (f.role <> 'delivery' or f.job_id is null
                  or exists (select 1 from public.hire_jobs j where j.id = f.job_id and (j.creator_id = auth.uid() or j.status = 'completed')))) ))
$$;
grant execute on function private.has_entitlement(uuid), private.can_read_secrets(uuid), private.is_job_member(uuid),
  private.file_visible(uuid, uuid, uuid, uuid, public.file_role), private.can_download(text, text) to authenticated, service_role;

-- ---------- hire job state machine
create or replace function private.job_step(s public.job_status) returns int language sql immutable set search_path = '' as $$
  select case s when 'briefed' then 0 when 'quoted' then 1 when 'accepted' then 2 when 'paid' then 3 when 'in_progress' then 3
    when 'revision' then 3 when 'delivered' then 4 when 'completed' then 5 else null end
$$;

create or replace function private.hire_jobs_before() returns trigger
language plpgsql set search_path = '' as $$
declare me uuid := auth.uid(); t public.chat_threads; ok boolean := false; revs int;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if private.bypass() then new.step := coalesce(private.job_step(new.status), new.step); return new; end if;
    select * into t from public.chat_threads where id = new.thread_id;
    if not found or t.buyer_id <> me or t.seller_id <> new.creator_id or not t.is_hire then
      raise exception 'hire job must belong to your hire chat with this creator' using errcode = '42501';
    end if;
    if new.product_id is not null and not exists (select 1 from public.products p where p.id = new.product_id and p.creator_id = new.creator_id and p.sell_type = 'hire' and p.status = 'published') then
      raise exception 'product is not an open hire listing of this creator' using errcode = '22023';
    end if;
    select p.revisions into revs from public.products p where p.id = new.product_id;
    new.buyer_id := me; new.status := 'briefed'; new.escrow := 'none'; new.amount := null; new.offer_id := null; new.order_id := null;
    new.revisions_left := coalesce(revs, 2); new.step := 0; new.delivered_at := null; new.completed_at := null; new.auto_release_at := null;
    return new;
  end if;
  -- UPDATE
  if not private.bypass() then
    if (new.buyer_id, new.creator_id, new.thread_id, new.amount, new.offer_id, new.order_id, new.escrow, new.revisions_left)
       is distinct from (old.buyer_id, old.creator_id, old.thread_id, old.amount, old.offer_id, old.order_id, old.escrow, old.revisions_left) then
      raise exception 'job money fields are managed by LUMI' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      ok := case
        when me = old.creator_id then
             (old.status = 'paid' and new.status = 'in_progress')
          or (old.status in ('paid','in_progress','revision') and new.status = 'delivered')
          or (old.status in ('briefed','quoted','accepted') and new.status = 'cancelled')
          or (old.status in ('paid','in_progress','delivered','revision') and new.status = 'disputed')
        when me = old.buyer_id then
             (old.status = 'delivered' and new.status = 'revision' and old.revisions_left > 0)
          or (old.status = 'delivered' and new.status = 'completed')
          or (old.status in ('briefed','quoted','accepted') and new.status = 'cancelled')
          or (old.status in ('paid','in_progress','delivered','revision') and new.status = 'disputed')
        else false end;
      if not ok then raise exception 'job cannot move from % to %', old.status, new.status using errcode = '42501'; end if;
    end if;
  end if;
  if new.status is distinct from old.status then
    new.step := coalesce(private.job_step(new.status), old.step);
    if new.status = 'revision' then new.revisions_left := greatest(old.revisions_left - 1, 0); end if;
    if new.status = 'delivered' then new.delivered_at := now(); new.auto_release_at := now() + interval '3 days'; end if;
    if new.status = 'completed' then new.completed_at := now(); new.auto_release_at := null; if old.escrow = 'held' then new.escrow := 'released'; end if; end if;
    if new.status = 'disputed' and old.escrow = 'held' then new.escrow := 'disputed'; new.auto_release_at := null; end if;
    if new.status = 'revision' then new.auto_release_at := null; end if;
  end if;
  return new;
end $$;
create trigger hire_jobs_before before insert or update on public.hire_jobs for each row execute function private.hire_jobs_before();

create or replace function private.hire_jobs_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare who text; amt text := coalesce(to_char(new.amount, 'FM999,999,999'), '0');
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
  perform private.set_bypass(true);
  if tg_op = 'UPDATE' then
    if new.status = 'in_progress' then
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'ครีเอเตอร์เริ่มทำงานแล้ว');
    elsif new.status = 'delivered' then
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'ส่งงานแล้ว · ตรวจงานแล้วกด "รับงาน" หรือ "ขอแก้ไข" ภายใน 3 วัน');
      perform private.notify(new.buyer_id, 'order', 'ครีเอเตอร์ส่งงานแล้ว · ตรวจและกดรับงาน', '/chat/' || new.thread_id, new.creator_id);
    elsif new.status = 'revision' then
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'ผู้ซื้อขอแก้ไขงาน · เหลือแก้ได้อีก ' || new.revisions_left || ' ครั้ง');
      perform private.notify(new.creator_id, 'order', 'ลูกค้าขอแก้ไขงาน', '/chat/' || new.thread_id, new.buyer_id);
    elsif new.status = 'completed' then
      update public.ledger set status = 'released', updated_at = now() where job_id = new.id and status = 'held';
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'ผู้ซื้อรับงานแล้ว · LUMI ปล่อยเงิน ฿' || amt || ' ให้ครีเอเตอร์ในรอบโอนถัดไป');
      perform private.notify(new.creator_id, 'sale', 'ลูกค้ารับงานแล้ว · เงิน ฿' || amt || ' เข้ารอบโอนถัดไป', '/chat/' || new.thread_id, new.buyer_id);
    elsif new.status = 'disputed' then
      update public.ledger set status = 'disputed', updated_at = now() where job_id = new.id and status = 'held';
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'มีการแจ้งปัญหา · LUMI ระงับเงินไว้จนกว่าทีมงานจะตรวจสอบ');
      perform private.notify(case when auth.uid() = new.buyer_id then new.creator_id else new.buyer_id end, 'order', 'มีการแจ้งปัญหางานจ้าง · ทีมงานจะติดต่อกลับ', '/chat/' || new.thread_id, auth.uid());
    elsif new.status = 'cancelled' then
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'งานจ้างนี้ถูกยกเลิก');
      update public.offers set status = 'withdrawn' where job_id = new.id and status = 'pending';
    end if;
  end if;
  perform private.set_bypass(false);
  return null;
end $$;
create trigger hire_jobs_after after update on public.hire_jobs for each row execute function private.hire_jobs_after();

create or replace function private.offers_before() returns trigger
language plpgsql set search_path = '' as $$
declare j public.hire_jobs; me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    select * into j from public.hire_jobs where id = new.job_id;
    if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
    if not private.bypass() and (j.creator_id <> me or j.status not in ('briefed','quoted')) then
      raise exception 'only the creator can quote before the job is accepted' using errcode = '42501';
    end if;
    new.creator_id := j.creator_id; new.buyer_id := j.buyer_id; new.thread_id := j.thread_id;
    new.status := 'pending'; new.responded_at := null;
    return new;
  end if;
  if not private.bypass() then
    if (new.job_id, new.thread_id, new.creator_id, new.buyer_id, new.title, new.amount, new.items) is distinct from
       (old.job_id, old.thread_id, old.creator_id, old.buyer_id, old.title, old.amount, old.items) then
      raise exception 'a sent quote cannot be edited; send a new one' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (
         old.status = 'pending' and ((me = old.buyer_id and new.status in ('accepted','declined')) or (me = old.creator_id and new.status = 'withdrawn'))) then
      raise exception 'quote cannot move from % to %', old.status, new.status using errcode = '42501';
    end if;
    if new.status = 'accepted' and not exists (select 1 from public.hire_jobs hj where hj.id = old.job_id and hj.status = 'quoted') then
      raise exception 'job is not waiting for a quote answer' using errcode = '22023';
    end if;
  end if;
  if new.status is distinct from old.status then new.responded_at := now(); end if;
  return new;
end $$;
create trigger offers_before before insert or update on public.offers for each row execute function private.offers_before();

create or replace function private.offers_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare amt text := to_char(new.amount, 'FM999,999,999');
begin
  perform private.set_bypass(true);
  if tg_op = 'INSERT' then
    update public.offers set status = 'withdrawn', responded_at = now() where job_id = new.job_id and id <> new.id and status = 'pending';
    update public.hire_jobs set status = 'quoted' where id = new.job_id and status in ('briefed','quoted');
    insert into public.messages (thread_id, sender_id, kind, body, payload)
      values (new.thread_id, new.creator_id, 'offer', new.title, jsonb_build_object('offer_id', new.id, 'amount', new.amount, 'items', to_jsonb(new.items)));
    perform private.notify(new.buyer_id, 'chat', 'ได้รับใบเสนอราคา ฿' || amt, '/chat/' || new.thread_id, new.creator_id);
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      update public.hire_jobs set status = 'accepted', amount = new.amount, offer_id = new.id where id = new.job_id;
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'รับข้อเสนอ ฿' || amt || ' แล้ว · ชำระเงินเพื่อเริ่มงาน');
      perform private.notify(new.creator_id, 'order', 'ลูกค้ารับใบเสนอราคา ฿' || amt || ' แล้ว · รอชำระเงิน', '/chat/' || new.thread_id, new.buyer_id);
    elsif new.status = 'declined' then
      insert into public.messages (thread_id, kind, body) values (new.thread_id, 'system', 'ผู้ซื้อปฏิเสธใบเสนอราคานี้');
    end if;
  end if;
  perform private.set_bypass(false);
  return null;
end $$;
create trigger offers_after after insert or update on public.offers for each row execute function private.offers_after();

-- ---------- order pricing (prices always come from the database, never from the client)
create or replace function private.orders_before() returns trigger
language plpgsql set search_path = '' as $$
declare c public.coupons;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if not private.bypass() then
      new.buyer_id := auth.uid(); new.status := 'pending'; new.subtotal := 0; new.discount := 0; new.total := 0;
      new.charge_ref := null; new.paid_at := null; new.cancelled_at := null;
    end if;
    new.order_no := 'LM-' || nextval('private.order_no_seq');
    if new.coupon_code is not null then
      new.coupon_code := upper(btrim(new.coupon_code));
      select * into c from public.coupons where code = new.coupon_code;
      if not found or not c.active or (c.starts_at is not null and c.starts_at > now()) or (c.ends_at is not null and c.ends_at < now())
         or (c.max_uses is not null and c.used_count >= c.max_uses) then
        raise exception 'คูปองนี้ใช้ไม่ได้' using errcode = '22023';
      end if;
    end if;
    return new;
  end if;
  if not private.bypass() then
    if (new.buyer_id, new.order_no, new.method, new.coupon_code, new.subtotal, new.discount, new.total, new.charge_ref, new.paid_at)
       is distinct from (old.buyer_id, old.order_no, old.method, old.coupon_code, old.subtotal, old.discount, old.total, old.charge_ref, old.paid_at) then
      raise exception 'order totals are managed by LUMI' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (old.status = 'pending' and new.status = 'cancelled' and old.charge_ref is null) then
      raise exception 'you can only cancel an unpaid order' using errcode = '42501';
    end if;
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then new.cancelled_at := now(); end if;
  return new;
end $$;
create trigger orders_before before insert or update on public.orders for each row execute function private.orders_before();
-- coupon_code / method are client-supplied: exposed via column grant on insert only

create or replace function private.order_items_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.orders; p public.products; op public.product_options; f public.offers; j public.hire_jobs;
begin
  if tg_op = 'UPDATE' then
    if not private.bypass() then raise exception 'order items cannot be changed' using errcode = '42501'; end if;
    return new;
  end if;
  select * into o from public.orders where id = new.order_id;
  if not found or o.status <> 'pending' or o.charge_ref is not null then raise exception 'order is not open' using errcode = '22023'; end if;
  new.discount := 0;
  if new.product_id is not null then
    select * into p from public.products where id = new.product_id;
    if not found or p.status <> 'published' then raise exception 'สินค้านี้ไม่เปิดขายแล้ว' using errcode = '22023'; end if;
    if p.creator_id = o.buyer_id then raise exception 'ซื้อสินค้าของตัวเองไม่ได้' using errcode = '22023'; end if;
    if p.sell_type = 'hire' then raise exception 'งานจ้างต้องชำระผ่านใบเสนอราคาในแชต' using errcode = '22023'; end if;
    new.creator_id := p.creator_id; new.title := p.title; new.offer_id := null; new.job_id := null; new.tip_creator_id := null; new.tip_amount := null;
    if p.is_free then
      new.option_id := null; new.option_code := null; new.option_label := 'แจกฟรี'; new.unit_price := 0;
    else
      select * into op from public.product_options where id = new.option_id and product_id = p.id and enabled and price > 0;
      if not found then raise exception 'เลือกแบบที่จะซื้อก่อน' using errcode = '22023'; end if;
      new.option_code := op.code; new.option_label := op.label; new.unit_price := op.price;
    end if;
    if exists (select 1 from public.entitlements e where e.user_id = o.buyer_id and e.product_id = p.id and e.revoked_at is null
               and e.option_id is not distinct from new.option_id) then
      raise exception 'คุณมีสินค้านี้แล้ว' using errcode = '23505';
    end if;
  elsif new.offer_id is not null then
    select * into f from public.offers where id = new.offer_id;
    select * into j from public.hire_jobs where id = f.job_id;
    if f.id is null or f.buyer_id <> o.buyer_id or f.status <> 'accepted' or j.status <> 'accepted' then
      raise exception 'ใบเสนอราคานี้ยังชำระไม่ได้' using errcode = '22023';
    end if;
    new.creator_id := f.creator_id; new.job_id := j.id; new.title := f.title; new.option_label := 'งานจ้าง'; new.unit_price := f.amount;
    new.product_id := null; new.option_id := null; new.tip_creator_id := null; new.tip_amount := null;
  else
    if new.tip_creator_id = o.buyer_id then raise exception 'ให้ทิปตัวเองไม่ได้' using errcode = '22023'; end if;
    new.creator_id := new.tip_creator_id; new.title := 'ทิปขอบคุณ'; new.option_label := 'ทิป'; new.unit_price := new.tip_amount;
  end if;
  return new;
end $$;
create trigger order_items_before before insert or update on public.order_items for each row execute function private.order_items_before();

create or replace function private.recompute_order(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; c public.coupons; elig int := 0; disc int := 0;
begin
  select * into o from public.orders where id = p_order;
  perform private.set_bypass(true);
  if o.coupon_code is not null then select * into c from public.coupons where code = o.coupon_code; end if;
  if c.code is not null then
    select coalesce(sum(i.unit_price), 0) into elig from public.order_items i where i.order_id = p_order and i.tip_creator_id is null
      and (c.creator_id is null or i.creator_id = c.creator_id);
    disc := round(elig * c.pct / 100.0);
    -- spread the discount over eligible lines (largest remainder on the first line)
    update public.order_items i set discount = case when elig = 0 then 0 else floor(i.unit_price::numeric * disc / elig) end
      where i.order_id = p_order and i.tip_creator_id is null and (c.creator_id is null or i.creator_id = c.creator_id);
    update public.order_items i set discount = i.discount + (disc - (select coalesce(sum(x.discount), 0) from public.order_items x where x.order_id = p_order))
      where i.id = (select x.id from public.order_items x where x.order_id = p_order and x.tip_creator_id is null and (c.creator_id is null or x.creator_id = c.creator_id) order by x.unit_price desc, x.id limit 1);
  end if;
  update public.orders set subtotal = (select coalesce(sum(unit_price), 0) from public.order_items where order_id = p_order),
    discount = disc,
    total = (select coalesce(sum(unit_price), 0) from public.order_items where order_id = p_order) - disc
  where id = p_order;
  perform private.set_bypass(false);
end $$;

create or replace function private.order_items_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.set_bypass(true);
  perform private.recompute_order(coalesce(new.order_id, old.order_id));
  perform private.set_bypass(false);
  return null;
end $$;
create trigger order_items_after after insert or delete on public.order_items for each row execute function private.order_items_after();

-- ---------- payment confirmation: called ONLY by the server (payment webhook Edge Function with the service role)
create or replace function private.ensure_thread(p_buyer uuid, p_seller uuid, p_product uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tid uuid; p public.products;
begin
  select id into tid from public.chat_threads where buyer_id = p_buyer and seller_id = p_seller and product_id is not distinct from p_product and not is_hire;
  if tid is null then
    select * into p from public.products where id = p_product;
    insert into public.chat_threads (buyer_id, seller_id, product_id, title, image)
      values (p_buyer, p_seller, p_product, coalesce(p.title, 'แชตกับครีเอเตอร์'), p.covers[1])
      on conflict do nothing returning id into tid;
    if tid is null then
      select id into tid from public.chat_threads where buyer_id = p_buyer and seller_id = p_seller and product_id is not distinct from p_product and not is_hire;
    end if;
  end if;
  return tid;
end $$;

create or replace function private.license_key() returns text language sql volatile set search_path = '' as $$
  select 'LUMI-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4)) || '-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4)) || '-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4))
$$;

create or replace function private.mark_order_paid(p_order uuid, p_charge_ref text, p_amount int) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; i public.order_items; p public.products; tid uuid; k text; gross int; fee int; c public.coupons; amt text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order not found'; end if;
  if o.status = 'paid' then return; end if;                 -- idempotent webhook
  if o.status <> 'pending' then raise exception 'order % is %', o.order_no, o.status; end if;
  if p_amount is distinct from o.total then raise exception 'amount mismatch for order %', o.order_no; end if;
  if o.coupon_code is not null then select * into c from public.coupons where code = o.coupon_code; end if;
  perform private.set_bypass(true);
  update public.orders set status = 'paid', paid_at = now(), charge_ref = coalesce(p_charge_ref, charge_ref) where id = o.id;
  if c.code is not null then update public.coupons set used_count = used_count + 1 where code = c.code; end if;
  for i in select * from public.order_items where order_id = o.id loop
    amt := to_char(i.unit_price - i.discount, 'FM999,999,999');
    gross := i.unit_price - case when c.creator_id is not null then i.discount else 0 end;   -- LUMI-wide coupons are absorbed by LUMI
    fee := round(gross * 0.10);
    if gross > 0 then
      insert into public.ledger (creator_id, order_id, order_item_id, job_id, gross, fee, net, status, release_after)
        values (i.creator_id, o.id, i.id, i.job_id, gross, fee, gross - fee, 'held', case when i.job_id is null then now() + interval '7 days' end);
    end if;
    if i.job_id is not null then
      update public.hire_jobs set status = 'paid', escrow = 'held', order_id = o.id where id = i.job_id;
      select thread_id into tid from public.hire_jobs where id = i.job_id;
      insert into public.messages (thread_id, kind, body) values (tid, 'system', 'ชำระเงิน ฿' || amt || ' แล้ว · LUMI พักเงินไว้จนกว่าคุณจะกดรับงาน');
      perform private.notify(i.creator_id, 'sale', 'ลูกค้าชำระเงินงานจ้างแล้ว · เริ่มงานได้เลย', '/chat/' || tid, o.buyer_id);
    elsif i.tip_creator_id is not null then
      tid := private.ensure_thread(o.buyer_id, i.tip_creator_id, null);
      insert into public.messages (thread_id, sender_id, kind, body, payload) values (tid, o.buyer_id, 'tip', 'ให้ทิปขอบคุณ', jsonb_build_object('amount', i.unit_price));
      perform private.notify(i.creator_id, 'sale', 'ได้รับทิป ฿' || amt, '/chat/' || tid, o.buyer_id);
    else
      select * into p from public.products where id = i.product_id;
      tid := private.ensure_thread(o.buyer_id, p.creator_id, p.id);
      k := case when p.sell_type in ('sw','game') and coalesce(p.spec->>'keyType', '') <> 'ไม่ต้องใช้คีย์' then private.license_key() end;
      insert into public.entitlements (user_id, product_id, option_id, option_code, order_item_id, thread_id, license_key)
        values (o.buyer_id, p.id, i.option_id, i.option_code, i.id, tid, k);
      update public.products set sales_count = sales_count + 1 where id = p.id;
      update public.profiles set sales_count = sales_count + 1 where id = p.creator_id;
      insert into public.messages (thread_id, kind, body, payload) values (tid, 'system',
        case when i.unit_price = 0 then 'รับของฟรีแล้ว · ออเดอร์ #' || o.order_no else 'ชำระเงิน ฿' || amt || ' แล้ว · ออเดอร์ #' || o.order_no end,
        jsonb_build_object('order_id', o.id, 'product_id', p.id));
      if k is not null then
        insert into public.messages (thread_id, kind, body, payload) values (tid, 'key', 'คีย์ใช้งาน · ' || coalesce(i.option_label, ''), jsonb_build_object('product_id', p.id, 'entitlement', true));
      end if;
      perform private.notify(p.creator_id, 'sale', case when i.unit_price = 0 then 'มีคนรับ “' || p.title || '” ฟรี' else 'ขาย “' || p.title || '” ได้ ฿' || amt end, '/chat/' || tid, o.buyer_id, p.covers[1]);
    end if;
    delete from public.cart_items ci where ci.user_id = o.buyer_id
      and ((i.product_id is not null and ci.product_id = i.product_id and ci.option_id is not distinct from i.option_id) or (i.offer_id is not null and ci.offer_id = i.offer_id));
  end loop;
  perform private.notify(o.buyer_id, 'order', case when o.total = 0 then 'รับของฟรีสำเร็จ ออเดอร์ #' || o.order_no else 'ชำระเงินสำเร็จ ออเดอร์ #' || o.order_no end || case when exists (select 1 from public.order_items x where x.order_id = o.id and x.job_id is null and x.tip_creator_id is null)
    then ' · ไฟล์และคีย์อยู่ในแชตแล้ว' else ' · ดูความคืบหน้าในแชต' end, '/profile');
  perform private.set_bypass(false);
end $$;
revoke execute on function private.mark_order_paid(uuid, text, int) from public, anon, authenticated;
grant execute on function private.mark_order_paid(uuid, text, int) to service_role;

-- free orders (total 0) complete without a payment provider
create or replace function private.finalize_free_order(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if not found or o.buyer_id <> auth.uid() or o.status <> 'pending' or o.total <> 0
     or exists (select 1 from public.order_items i where i.order_id = p_order and i.unit_price > 0) then
    raise exception 'order is not a free order' using errcode = '42501';
  end if;
  perform private.mark_order_paid(p_order, 'free', 0);
end $$;
revoke execute on function private.finalize_free_order(uuid) from public, anon;
grant execute on function private.finalize_free_order(uuid) to authenticated, service_role;

-- ---------- reviews / ratings
create or replace function private.reviews_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  new.author_id := auth.uid(); new.created_at := now();
  if not (private.has_entitlement(new.product_id)
          or exists (select 1 from public.hire_jobs j where j.product_id = new.product_id and j.buyer_id = auth.uid() and j.status = 'completed'
                     and (new.job_id is null or j.id = new.job_id))) then
    raise exception 'รีวิวได้เฉพาะคนที่ซื้อหรือจ้างงานแล้ว' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger reviews_before before insert on public.reviews for each row execute function private.reviews_before();

create or replace function private.reviews_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.product_id, old.product_id); cid uuid;
begin
  update public.products p set review_count = s.n, rating = s.r
    from (select count(*) n, round(avg(stars)::numeric, 2) r from public.reviews where product_id = pid) s where p.id = pid
    returning p.creator_id into cid;
  update public.profiles pr set rating = (select round(avg(r.stars)::numeric, 2) from public.reviews r join public.products p on p.id = r.product_id where p.creator_id = cid)
    where pr.id = cid;
  return null;
end $$;
create trigger reviews_after after insert or update or delete on public.reviews for each row execute function private.reviews_after();

-- ---------- counters + follow notifications
create or replace function private.favorites_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then update public.products set favorite_count = favorite_count + 1 where id = new.product_id;
  else update public.products set favorite_count = greatest(favorite_count - 1, 0) where id = old.product_id; end if;
  return null;
end $$;
create trigger favorites_count after insert or delete on public.favorites for each row execute function private.favorites_count();

create or replace function private.follows_count() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.creator_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    select display_name into n from public.profiles where id = new.follower_id;
    perform private.notify(new.creator_id, 'follow', coalesce(n, 'มีคน') || ' เริ่มติดตามคุณ', '/creator/' || new.follower_id, new.follower_id);
  else
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.creator_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end $$;
create trigger follows_count after insert or delete on public.follows for each row execute function private.follows_count();

-- ---------- RLS + grants
alter table public.favorites enable row level security;
alter table public.follows enable row level security;
alter table public.coupons enable row level security;
alter table public.hire_jobs enable row level security;
alter table public.offers enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.entitlements enable row level security;
alter table public.reviews enable row level security;
alter table public.ledger enable row level security;
alter table public.payouts enable row level security;

grant select, insert, delete on public.favorites, public.follows to authenticated;
grant select on public.coupons to authenticated;
grant select on public.hire_jobs to authenticated;
grant insert (thread_id, creator_id, product_id, package, brief) on public.hire_jobs to authenticated;
grant update (status) on public.hire_jobs to authenticated;
grant select on public.offers to authenticated;
grant insert (job_id, title, amount, items) on public.offers to authenticated;
grant update (status) on public.offers to authenticated;
grant select, delete on public.cart_items to authenticated;
grant insert (product_id, option_id, offer_id, tip_creator_id, tip_amount) on public.cart_items to authenticated;
grant select on public.orders to authenticated;
grant insert (method, coupon_code) on public.orders to authenticated;
grant update (status) on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant insert (order_id, product_id, option_id, offer_id, tip_creator_id, tip_amount) on public.order_items to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (product_id, job_id, stars, body) on public.reviews to authenticated;
grant update (stars, body) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant select on public.ledger, public.payouts to authenticated;
grant all on public.favorites, public.follows, public.coupons, public.hire_jobs, public.offers, public.cart_items, public.orders,
  public.order_items, public.entitlements, public.reviews, public.ledger, public.payouts to service_role;
grant usage on sequence private.order_no_seq to authenticated, service_role;

create policy "own favorites" on public.favorites for select to authenticated using (user_id = (select auth.uid()));
create policy "add favorite" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.product_visible(product_id)));
create policy "remove favorite" on public.favorites for delete to authenticated using (user_id = (select auth.uid()));

create policy "own follow edges" on public.follows for select to authenticated
  using ((select auth.uid()) in (follower_id, creator_id));
create policy "follow" on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "unfollow" on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy "active coupons" on public.coupons for select to authenticated
  using (active and (ends_at is null or ends_at > now()));

create policy "job members read job" on public.hire_jobs for select to authenticated
  using ((select auth.uid()) in (buyer_id, creator_id));
create policy "buyer opens job" on public.hire_jobs for insert to authenticated
  with check (buyer_id = (select auth.uid()) and creator_id <> (select auth.uid()));
create policy "job members move job" on public.hire_jobs for update to authenticated
  using ((select auth.uid()) in (buyer_id, creator_id)) with check ((select auth.uid()) in (buyer_id, creator_id));

create policy "quote parties read" on public.offers for select to authenticated
  using ((select auth.uid()) in (buyer_id, creator_id));
create policy "creator sends quote" on public.offers for insert to authenticated
  with check (creator_id = (select auth.uid()) and (select private.is_job_member(job_id)));
create policy "parties answer quote" on public.offers for update to authenticated
  using ((select auth.uid()) in (buyer_id, creator_id)) with check ((select auth.uid()) in (buyer_id, creator_id));

create policy "own cart" on public.cart_items for select to authenticated using (user_id = (select auth.uid()));
create policy "add to own cart" on public.cart_items for insert to authenticated
  with check (user_id = (select auth.uid())
    and (product_id is null or exists (select 1 from public.products p where p.id = product_id and p.status = 'published' and p.creator_id <> (select auth.uid()) and (p.sell_type <> 'hire' or offer_id is not null)))
    and (option_id is null or exists (select 1 from public.product_options o where o.id = option_id and o.product_id = cart_items.product_id and o.enabled))
    and (offer_id is null or exists (select 1 from public.offers f where f.id = offer_id and f.buyer_id = (select auth.uid()) and f.status = 'accepted'))
    and (tip_creator_id is null or tip_creator_id <> (select auth.uid())));
create policy "remove from own cart" on public.cart_items for delete to authenticated using (user_id = (select auth.uid()));

create policy "own orders" on public.orders for select to authenticated using (buyer_id = (select auth.uid()));
create policy "place order" on public.orders for insert to authenticated with check (buyer_id = (select auth.uid()) and status = 'pending');
create policy "cancel own order" on public.orders for update to authenticated
  using (buyer_id = (select auth.uid())) with check (buyer_id = (select auth.uid()));

create policy "buyer or seller reads items" on public.order_items for select to authenticated
  using (creator_id = (select auth.uid()) or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())));
create policy "add items to own open order" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid()) and o.status = 'pending' and o.charge_ref is null));

create policy "own or sold entitlements" on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()) or (select private.owns_product(product_id)));

create policy "reviews are public" on public.reviews for select to anon, authenticated using (true);
create policy "buyers review" on public.reviews for insert to authenticated with check (author_id = (select auth.uid()));
create policy "edit own review" on public.reviews for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "delete own review" on public.reviews for delete to authenticated using (author_id = (select auth.uid()));

create policy "creator reads own ledger" on public.ledger for select to authenticated using (creator_id = (select auth.uid()));
create policy "creator reads own payouts" on public.payouts for select to authenticated using (creator_id = (select auth.uid()));

-- secrets: creator + paying buyers (img: not for the "image only" option)
create policy "creator or buyer reads secrets" on public.product_secrets for select to authenticated
  using ((select private.can_read_secrets(product_id)));

-- uploaded files
create policy "see permitted files" on public.product_files for select to authenticated
  using ((select private.file_visible(owner_id, product_id, thread_id, job_id, role)));
create policy "register own upload" on public.product_files for insert to authenticated
  with check (owner_id = (select auth.uid())
    and (product_id is null or (select private.owns_product(product_id)))
    and (draft_id is null or exists (select 1 from public.listing_drafts d where d.id = draft_id and d.owner_id = (select auth.uid())))
    and (thread_id is null or (select private.is_thread_member(thread_id)))
    and (job_id is null or exists (select 1 from public.hire_jobs j where j.id = job_id and j.creator_id = (select auth.uid()))));
create policy "edit own upload" on public.product_files for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
    and (product_id is null or (select private.owns_product(product_id)))
    and (draft_id is null or exists (select 1 from public.listing_drafts d where d.id = draft_id and d.owner_id = (select auth.uid()))));
create policy "delete own upload" on public.product_files for delete to authenticated using (owner_id = (select auth.uid()));
