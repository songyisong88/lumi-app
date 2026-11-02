-- LUMI 0011: buyer notice wording depends on what was bought
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
