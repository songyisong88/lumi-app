-- LUMI 0016: launch decisions approved by the owner (backend-plan §10), enforced on the server and
-- kept in one setting so they can be opened later without a code change.
--  1 free items first; paid sales (Opn/Omise marketplace) later  -> paid_sales=false
--  2 file cap 1.9 GB                                             -> max_file_bytes (needs Supabase Pro + resumable upload; free tier stays 50 MB)
--  3 courses: e-book only at first                               -> course_formats=['อีบุ๊ก']
--  4 no subscriptions at first                                   -> subscriptions=false
--  5 hire: post + chat first, payment later                      -> hire_payments=false
--  6 data type closed                                            -> closed_types=['data']
--  7 no refund after download unless broken / not as described   -> refund_after_download
-- While test_payments=true (QA) paid test orders still work; nothing real is charged either way.
insert into private.settings (key, value) values ('launch_rules', jsonb_build_object(
  'paid_sales', false,
  'hire_payments', false,
  'subscriptions', false,
  'closed_types', jsonb_build_array('data'),
  'course_formats', jsonb_build_array('อีบุ๊ก'),
  'max_file_bytes', 2040109465,
  'refund_after_download', jsonb_build_array('ไฟล์เปิดไม่ได้ หรือเสีย', 'ไม่ตรงกับคำอธิบายหรือภาพตัวอย่าง')
)) on conflict (key) do update set value = excluded.value;

create or replace function private.rule(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.setting('launch_rules') -> p_key $$;
create or replace function private.test_payments() returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(private.setting('test_payments') = 'true'::jsonb, false) $$;

-- the app may read the rules (no secrets in them)
create or replace function public.launch_rules() returns jsonb
language sql stable security definer set search_path = '' as $$ select coalesce(private.setting('launch_rules'), '{}'::jsonb) $$;
grant execute on function public.launch_rules() to anon, authenticated;

-- listings: closed types, e-book-only courses, no subscriptions
create or replace function private.products_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.bypass() or new.status <> 'published' then return new; end if;
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
  return new;
end $$;
drop trigger if exists products_rules on public.products;
drop trigger if exists products_0_rules on public.products;   -- "0" sorts first: rules are reported before the completeness check
create trigger products_0_rules before insert or update on public.products for each row execute function private.products_rules();

-- checkout: paid items / hire payments wait for the payment provider (test mode keeps QA working)
create or replace function private.order_items_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.test_payments() or new.unit_price - new.discount <= 0 then return new; end if;
  if new.offer_id is not null and not coalesce((private.rule('hire_payments'))::text::boolean, true) then
    raise exception 'HIRE_PAYMENTS_LATER' using errcode = 'P0001', hint = 'งานจ้างตอนนี้คุยและตกลงในแชตก่อน · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  if not coalesce((private.rule('paid_sales'))::text::boolean, true) then
    raise exception 'PAID_SALES_LATER' using errcode = 'P0001', hint = 'ช่วงแรกเปิดเฉพาะผลงานฟรี · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  return new;
end $$;
drop trigger if exists order_items_rules on public.order_items;
create trigger order_items_rules before insert on public.order_items for each row execute function private.order_items_rules();

-- refunds: after the buyer has downloaded, only "broken" or "not as described"
create or replace function private.refund_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid; allowed jsonb := private.rule('refund_after_download');
begin
  if private.bypass() or new.order_item_id is null or jsonb_typeof(allowed) <> 'array' then return new; end if;
  select product_id into pid from public.order_items where id = new.order_item_id;
  if pid is not null and not (allowed ? new.reason)
     and exists (select 1 from public.download_events e where e.user_id = new.buyer_id and e.product_id = pid) then
    raise exception 'REFUND_AFTER_DOWNLOAD' using errcode = 'P0001',
      hint = 'ดาวน์โหลดแล้วขอคืนเงินได้เฉพาะกรณีไฟล์เสีย หรือไม่ตรงกับคำอธิบาย';
  end if;
  return new;
end $$;
drop trigger if exists refund_rules on public.refund_requests;
create trigger refund_rules before insert on public.refund_requests for each row execute function private.refund_rules();

-- uploads: the cap is checked when the file row is registered (bucket limits stay at the plan maximum)
create or replace function private.files_size_rule() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.size_bytes is not null and new.size_bytes > coalesce((private.rule('max_file_bytes'))::text::bigint, 2040109465) then
    raise exception 'FILE_TOO_LARGE' using errcode = 'P0001', hint = 'ไฟล์ใหญ่ได้ไม่เกิน 1.9 GB';
  end if;
  return new;
end $$;
drop trigger if exists product_files_size on public.product_files;
create trigger product_files_size before insert or update of size_bytes on public.product_files for each row execute function private.files_size_rule();

revoke execute on function private.rule(text), private.test_payments(), private.products_rules(), private.order_items_rules(),
  private.refund_rules(), private.files_size_rule() from public, anon, authenticated;
