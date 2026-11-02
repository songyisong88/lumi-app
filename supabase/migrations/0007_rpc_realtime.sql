-- LUMI 0007: RPCs used by the app (security invoker: they run with the caller's RLS) + realtime

-- notify followers about a new listing (trusted; checks the caller owns the product)
create or replace function private.notify_followers(p_product uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare p public.products; n int; who text;
begin
  select * into p from public.products where id = p_product and creator_id = auth.uid() and status = 'published';
  if not found then return 0; end if;
  select display_name into who from public.profiles where id = p.creator_id;
  insert into public.notifications (user_id, kind, text, link, actor_id, image)
    select f.follower_id, 'community', left(coalesce(who, 'ครีเอเตอร์') || ' ลงผลงานใหม่ “' || p.title || '”', 300), '/product/' || p.id, p.creator_id, p.covers[1]
    from public.follows f where f.creator_id = p.creator_id limit 5000;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function private.notify_followers(uuid) from public, anon;
grant execute on function private.notify_followers(uuid) to authenticated, service_role;

create or replace function public.publish_listing(p_draft uuid, p_share boolean default false, p_notify boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare d public.listing_drafts; pid uuid; o jsonb; i int := 0; me uuid := auth.uid(); lbl text; codes text[] := '{}'; reached int := 0; tname text;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into d from public.listing_drafts where id = p_draft and owner_id = me for update;
  if not found then raise exception 'draft not found' using errcode = 'P0002'; end if;
  if d.type is null then raise exception 'LISTING_INCOMPLETE' using errcode = 'P0001', detail = 'เลือกประเภทผลงาน', hint = 'ยังขาด 1 อย่าง'; end if;
  lbl := case when d.type <> 'hire' and jsonb_typeof(d.spec->'sub') = 'string' then d.spec->>'sub' end;
  if d.published_product_id is not null then
    pid := d.published_product_id;
    update public.products set status = 'draft' where id = pid and creator_id = me and status in ('published','unpublished','draft');
    if not found then raise exception 'listing cannot be edited' using errcode = '42501'; end if;
    update public.products set sell_type = d.type, label = lbl, title = d.title, use_text = d.use_text, description = d.description,
      tags = d.tags, covers = d.covers, spec = d.spec, is_free = d.is_free, tips_enabled = d.tips where id = pid;
  else
    insert into public.products (creator_id, sell_type, label, title, use_text, description, tags, covers, spec, is_free, tips_enabled)
      values (me, d.type, lbl, d.title, d.use_text, d.description, d.tags, d.covers, d.spec, d.is_free, d.tips) returning id into pid;
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
  update public.products set status = 'published' where id = pid;     -- server-side auto-check runs here (LISTING_INCOMPLETE)
  update public.profiles set is_creator = true, mode = 'creator' where id = me and not is_creator;
  select title into tname from public.products where id = pid;
  if p_share then
    insert into public.posts (tag, body, images, product_ids)
      values (case when d.is_free then 'แจกฟรี' else 'โชว์ผลงาน' end, left('ลงผลงานใหม่ “' || tname || '” 🎉 ' || d.use_text, 5000), d.covers[1:3], array[pid]);
  end if;
  if p_notify then reached := private.notify_followers(pid); end if;
  update public.product_files set draft_id = null where draft_id = d.id;
  delete from public.listing_drafts where id = d.id;
  return pid;
end $$;

create or replace function public.place_order(p_cart_ids uuid[], p_method text, p_coupon text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare oid uuid; tot int; n int;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  insert into public.orders (method, coupon_code) values (p_method, nullif(upper(btrim(coalesce(p_coupon, ''))), '')) returning id into oid;
  insert into public.order_items (order_id, product_id, option_id, offer_id, tip_creator_id, tip_amount)
    select oid, c.product_id, c.option_id, c.offer_id, c.tip_creator_id, c.tip_amount
    from public.cart_items c where c.id = any(p_cart_ids) and c.user_id = auth.uid() order by c.created_at;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'ตะกร้าว่าง' using errcode = '22023'; end if;
  select total into tot from public.orders where id = oid;
  if tot = 0 then
    perform private.finalize_free_order(oid);
  elsif p_method = 'free' then
    raise exception 'order is not free' using errcode = '22023';
  end if;
  return oid;   -- non-free: the app now calls the create-charge Edge Function with this order id
end $$;

create or replace function public.start_hire(p_creator uuid, p_product uuid, p_brief text[], p_package text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare tid uuid; p record;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select title, covers[1] as cover into p from public.products where id = p_product and creator_id = p_creator and sell_type = 'hire' and status = 'published';
  if not found then raise exception 'ไม่พบแพ็กเกจงานจ้างนี้' using errcode = 'P0002'; end if;
  insert into public.chat_threads (buyer_id, seller_id, product_id, is_hire, title, image)
    values (auth.uid(), p_creator, p_product, true, left(p.title, 120), p.cover) returning id into tid;
  insert into public.hire_jobs (thread_id, creator_id, product_id, package, brief)
    values (tid, p_creator, p_product, left(coalesce(p_package, ''), 60), to_jsonb(coalesce(p_brief, '{}')));
  insert into public.messages (thread_id, kind, body, payload)
    values (tid, 'brief', left('คำขอจ้างงาน (บรีฟ) · ' || coalesce(p_package, ''), 4000), jsonb_build_object('items', to_jsonb(coalesce(p_brief, '{}')), 'image', p.cover));
  return tid;
end $$;

create or replace function public.open_chat(p_partner uuid, p_product uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare tid uuid; p record;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select id into tid from public.chat_threads
    where not is_hire and product_id is not distinct from p_product
      and ((buyer_id = auth.uid() and seller_id = p_partner) or (seller_id = auth.uid() and buyer_id = p_partner))
    order by last_message_at desc limit 1;
  if tid is not null then return tid; end if;
  select title, covers[1] as cover into p from public.products where id = p_product;
  insert into public.chat_threads (buyer_id, seller_id, product_id, title, image)
    values (auth.uid(), p_partner, p_product, coalesce(left(p.title, 120), 'แชตกับครีเอเตอร์'), p.cover) returning id into tid;
  if p_product is not null then
    insert into public.messages (thread_id, kind, payload) values (tid, 'product', jsonb_build_object('product_id', p_product));
  end if;
  return tid;
end $$;

revoke execute on function public.publish_listing(uuid, boolean, boolean), public.place_order(uuid[], text, text),
  public.start_hire(uuid, uuid, text[], text), public.open_chat(uuid, uuid) from public, anon;
grant execute on function public.publish_listing(uuid, boolean, boolean), public.place_order(uuid[], text, text),
  public.start_hire(uuid, uuid, text[], text), public.open_chat(uuid, uuid) to authenticated, service_role;

-- realtime (postgres_changes honours RLS)
alter publication supabase_realtime add table public.messages, public.chat_threads, public.chat_thread_state, public.notifications,
  public.hire_jobs, public.offers, public.product_files, public.orders;
