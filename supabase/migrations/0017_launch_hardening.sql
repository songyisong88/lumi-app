-- LUMI 0017: launch hardening (review round 4: H1, H2, M2, M4, M6)
--  H1  test payments OFF on the real backend; paid listings are refused while launch is free-only
--      (price is checked on the server, so it cannot be faked through the API)
--  H2  no automatic approval: a submission stays "pending_review" until a moderator decides
--  M2  one real file cap = the storage bucket limit (50 MB on the current plan)
--  M4  "share to community" / "tell my followers" happen on the server when the listing really goes live
--  M6  courses: e-book files only (pdf / epub / zip) while launch is e-book only

-- ---------- settings (QA switches off; cap = bucket limit)
insert into private.settings (key, value) values ('test_payments', 'false'::jsonb)
  on conflict (key) do update set value = excluded.value;
delete from private.settings where key = 'test_auto_review_seconds';
update private.settings set value = jsonb_set(value, '{max_file_bytes}', to_jsonb(52428800)) where key = 'launch_rules';

-- ---------- H1 checkout: no test-mode bypass any more (pay_order_test also refuses while test_payments=false)
create or replace function private.order_items_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.unit_price - new.discount <= 0 then return new; end if;
  if new.offer_id is not null and not coalesce((private.rule('hire_payments'))::text::boolean, true) then
    raise exception 'HIRE_PAYMENTS_LATER' using errcode = 'P0001', hint = 'งานจ้างตอนนี้คุยและตกลงในแชตก่อน · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  if not coalesce((private.rule('paid_sales'))::text::boolean, true) then
    raise exception 'PAID_SALES_LATER' using errcode = 'P0001', hint = 'ช่วงแรกเปิดเฉพาะผลงานฟรี · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  return new;
end $$;

-- ---------- H1 + M6 listings
-- The launch checks that existed (closed types, e-book only, no subscriptions) keep running for creators.
-- New: while paid_sales=false a published non-hire listing must be free (is_free and no enabled paid option), and a
-- course may only carry e-book files. These two also run inside moderator approval (bypass); only the service role skips.
create or replace function private.products_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare relevant boolean;
begin
  if new.status <> 'published' then return new; end if;
  if not private.bypass() then
    if coalesce(private.rule('closed_types') ? new.sell_type::text, false) then
      raise exception 'TYPE_CLOSED' using errcode = 'P0001', hint = 'ประเภทนี้ยังไม่เปิดขาย';
    end if;
    if new.sell_type = 'course' and jsonb_typeof(private.rule('course_formats')) = 'array'
       and not coalesce(private.rule('course_formats') ? coalesce(new.spec->>'sub', ''), false) then
      raise exception 'COURSE_EBOOK_ONLY' using errcode = 'P0001', hint = 'ช่วงแรกเปิดขายเฉพาะอีบุ๊ก';
    end if;
    if not coalesce((private.rule('subscriptions'))::text::boolean, true) and (
         coalesce(new.spec->>'keyType', '') = 'สมาชิกรายเดือน'
         or exists (select 1 from public.product_options o where o.product_id = new.id and o.enabled
                    and (o.code = 'month' or coalesce(o.suffix, '') ~ '(เดือน|ปี|month|year)' or o.label ~ '^รายเดือน|^รายปี'))) then
      raise exception 'NO_SUBSCRIPTIONS' using errcode = 'P0001', hint = 'ช่วงแรกยังไม่เปิดแบบรายเดือน/สมาชิก';
    end if;
  end if;
  if private.is_service() then return new; end if;
  -- only when the listing is published, re-published, edited, or its options changed (counters such as sales_count skip this)
  if tg_op = 'UPDATE' then
    relevant := old.status is distinct from new.status
      or (new.is_free, new.sell_type, new.spec, new.title, new.covers) is distinct from (old.is_free, old.sell_type, old.spec, old.title, old.covers)
      or new.updated_at is distinct from old.updated_at;
    if not relevant then return new; end if;
  end if;
  if new.sell_type <> 'hire' and not coalesce((private.rule('paid_sales'))::text::boolean, true)
     and (not new.is_free or exists (select 1 from public.product_options o where o.product_id = new.id and o.enabled and o.price > 0)) then
    raise exception 'PAID_SALES_LATER' using errcode = 'P0001', hint = 'ช่วงแรกเปิดเฉพาะผลงานฟรี · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  if new.sell_type = 'course' and jsonb_typeof(private.rule('course_formats')) = 'array'
     and not (private.rule('course_formats') ? 'คอร์สวิดีโอ')
     and exists (select 1 from public.product_files f where f.product_id = new.id and f.role = 'deliverable'
                 and coalesce(lower(substring(f.name from '\.([A-Za-z0-9]+)$')), '') <> all (array['pdf', 'epub', 'zip'])) then
    raise exception 'COURSE_EBOOK_ONLY' using errcode = 'P0001', hint = 'ช่วงแรกเปิดขายเฉพาะอีบุ๊ก';
  end if;
  return new;
end $$;

-- M6 also at upload time: a file for a course draft/listing must be an e-book file (the draft type is known once saved)
create or replace function private.files_size_rule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap bigint := coalesce((private.rule('max_file_bytes'))::text::bigint, 52428800); t text;
begin
  if new.size_bytes is not null and new.size_bytes > cap then
    raise exception 'FILE_TOO_LARGE' using errcode = 'P0001',
      hint = 'ไฟล์ใหญ่ได้ไม่เกิน ' || case when cap >= 1073741824 then trim(to_char(cap / 1073741824.0, 'FM990.0')) || ' GB' else (cap / 1048576)::text || ' MB' end;
  end if;
  if new.role = 'deliverable' and not private.is_service() and jsonb_typeof(private.rule('course_formats')) = 'array'
     and not (private.rule('course_formats') ? 'คอร์สวิดีโอ') then
    select coalesce((select d.type::text from public.listing_drafts d where d.id = new.draft_id),
                    (select p.sell_type::text from public.products p where p.id = new.product_id)) into t;
    if t = 'course' and coalesce(lower(substring(new.name from '\.([A-Za-z0-9]+)$')), '') <> all (array['pdf', 'epub', 'zip']) then
      raise exception 'COURSE_EBOOK_ONLY' using errcode = 'P0001', hint = 'ช่วงแรกเปิดขายเฉพาะอีบุ๊ก';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists product_files_size on public.product_files;
create trigger product_files_size before insert or update of size_bytes, name, draft_id, product_id on public.product_files
  for each row execute function private.files_size_rule();

-- ---------- M4 follow-ups that wait for approval
create table if not exists private.publish_followups (
  product_id uuid primary key references public.products(id) on delete cascade,
  share boolean not null default false,
  notify boolean not null default false,
  created_at timestamptz not null default now()
);
revoke all on private.publish_followups from public, anon, authenticated;

create or replace function private.run_publish_followups() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f private.publish_followups; who text;
begin
  if new.review_status <> 'live' or old.review_status is not distinct from 'live' or new.status <> 'published' then return null; end if;
  delete from private.publish_followups where product_id = new.id returning * into f;
  if f.product_id is null then return null; end if;
  perform private.set_bypass(true);
  if f.share then
    insert into public.posts (author_id, tag, body, images, product_ids, status)
      values (new.creator_id, case when new.is_free then 'แจกฟรี' else 'โชว์ผลงาน' end,
              left('ลงผลงานใหม่ “' || new.title || '” 🎉 ' || coalesce(new.use_text, ''), 5000), new.covers[1:3], array[new.id], 'visible');
  end if;
  if f.notify then
    select display_name into who from public.profiles where id = new.creator_id;
    insert into public.notifications (user_id, kind, text, link, actor_id, image)
      select fl.follower_id, 'community', left(coalesce(who, 'ครีเอเตอร์') || ' ลงผลงานใหม่ “' || new.title || '”', 300), '/product/' || new.id, new.creator_id, new.covers[1]
      from public.follows fl where fl.creator_id = new.creator_id limit 5000;
  end if;
  perform private.set_bypass(false);
  return null;
end $$;
drop trigger if exists products_followups on public.products;
create trigger products_followups after update of review_status on public.products
  for each row execute function private.run_publish_followups();

-- publish_listing: same as 0015, but share / notify are queued until the listing passes review
create or replace function public.publish_listing(p_draft uuid, p_share boolean default false, p_notify boolean default false) returns uuid
language plpgsql set search_path = '' as $$
declare d public.listing_drafts; pid uuid; o jsonb; i int := 0; me uuid := auth.uid(); lbl text; codes text[] := '{}';
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into d from public.listing_drafts where id = p_draft and owner_id = me for update;
  if not found then raise exception 'draft not found' using errcode = 'P0002'; end if;
  if d.type is null then raise exception 'LISTING_INCOMPLETE' using errcode = 'P0001', detail = 'เลือกประเภทผลงาน', hint = 'ยังขาด 1 อย่าง'; end if;
  lbl := case when d.type <> 'hire' and jsonb_typeof(d.spec->'sub') = 'string' then d.spec->>'sub' end;
  if d.published_product_id is not null then
    pid := d.published_product_id;
    if private.approved_listing(pid) and not private.bypass() then
      raise exception 'EDIT_NEEDS_REVIEW' using errcode = '42501', hint = 'ผลงานนี้ผ่านการตรวจแล้ว · ส่งการแก้ไขด้วย submit_edit';
    end if;
    update public.products set status = 'draft' where id = pid and creator_id = me and status in ('published','unpublished','draft');
    if not found then raise exception 'listing cannot be edited' using errcode = '42501'; end if;
    update public.products set sell_type = d.type, label = lbl, title = d.title, use_text = d.use_text, description = d.description,
      tags = d.tags, covers = d.covers, spec = d.spec - 'removeFiles', is_free = d.is_free, tips_enabled = d.tips where id = pid;
  else
    insert into public.products (creator_id, sell_type, label, title, use_text, description, tags, covers, spec, is_free, tips_enabled)
      values (me, d.type, lbl, d.title, d.use_text, d.description, d.tags, d.covers, d.spec - 'removeFiles', d.is_free, d.tips) returning id into pid;
  end if;
  for o in select * from jsonb_array_elements(d.options) loop
    i := i + 1;
    codes := codes || coalesce(o->>'id', 'opt' || i);
    insert into public.product_options as po (product_id, code, label, sub, price, suffix, enabled, sort)
      values (pid, coalesce(o->>'id', 'opt' || i), coalesce(nullif(o->>'label', ''), 'แบบที่ ' || i), coalesce(o->>'sub', ''),
              greatest(coalesce((o->>'price')::numeric, 0), 0)::int, nullif(o->>'suffix', ''), coalesce((o->>'on')::boolean, false) and not d.is_free, i)
      on conflict (product_id, code) do update set label = excluded.label, sub = excluded.sub, price = excluded.price, suffix = excluded.suffix,
        enabled = excluded.enabled, sort = excluded.sort;
  end loop;
  update public.product_options set enabled = false where product_id = pid and not (code = any(codes));
  insert into public.product_secrets (product_id, data)
    values (pid, jsonb_strip_nulls(jsonb_build_object('prompt', d.spec->'prompt', 'canvaLink', d.spec->'canvaLink')))
    on conflict (product_id) do update set data = excluded.data;
  update public.product_files set product_id = pid where draft_id = d.id and owner_id = me and role = 'deliverable';
  update public.products set status = 'published' where id = pid;     -- server-side auto-check runs here (LISTING_INCOMPLETE, launch rules)
  if not private.bypass() then perform private.mark_submitted(pid, d.id); end if;   -- every creator submission waits for review
  update public.profiles set is_creator = true, mode = 'creator' where id = me and not is_creator;
  if p_share or p_notify then
    perform private.queue_publish_followups(pid, p_share, p_notify);
  end if;
  update public.product_files set draft_id = null where draft_id = d.id;
  delete from public.listing_drafts where id = d.id;
  return pid;
end $$;

create or replace function private.queue_publish_followups(p_product uuid, p_share boolean, p_notify boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.products where id = p_product and creator_id = auth.uid()) then return; end if;
  insert into private.publish_followups (product_id, share, notify) values (p_product, coalesce(p_share, false), coalesce(p_notify, false))
    on conflict (product_id) do update set share = excluded.share or private.publish_followups.share,
                                           notify = excluded.notify or private.publish_followups.notify;
end $$;

revoke execute on function private.order_items_rules(), private.products_rules(), private.files_size_rule(),
  private.run_publish_followups(), private.queue_publish_followups(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function private.queue_publish_followups(uuid, boolean, boolean) to authenticated;
