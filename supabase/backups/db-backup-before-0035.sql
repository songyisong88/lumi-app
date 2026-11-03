-- backup 2026-11-03 16:16:37 UTC+7, project zjohosifusewcaqpmyra
-- private functions
CREATE OR REPLACE FUNCTION private.set_content_hidden(p_type text, p_id text, p_hidden boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.reports_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.active_sanction(p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.kind from private.user_sanctions s
  where s.user_id = p_user and s.lifted_at is null and (s.until is null or s.until > now())
  order by case s.kind when 'ban' then 0 else 1 end limit 1
$function$
;

CREATE OR REPLACE FUNCTION private.match_content_rule(p_kind text, p_text text)
 RETURNS private.content_rules
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.* from private.content_rules r
  where r.enabled and p_kind = any (r.applies_to) and coalesce(p_text, '') ~* r.pattern
  order by case r.action when 'block' then 0 else 1 end, r.id limit 1
$function$
;

CREATE OR REPLACE FUNCTION private.content_text(p_table text, r jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_table
    when 'posts' then concat_ws(' ', r ->> 'body', r ->> 'prompt')
    when 'comments' then r ->> 'body'
    when 'stories' then r ->> 'caption'
    when 'messages' then r ->> 'body'
    when 'profiles' then concat_ws(' ', r ->> 'display_name', r ->> 'bio')
    when 'products' then concat_ws(' ', r ->> 'title', r ->> 'use_text', r ->> 'description') end
$function$
;

CREATE OR REPLACE FUNCTION private.content_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.file_needs_deep(p_file uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(private.setting('scan') ->> 'enforce', 'true') = 'true' and exists (
    select 1 from public.product_files f
    left join public.products p on p.id = f.product_id
    left join public.listing_drafts d on d.id = f.draft_id
    where f.id = p_file and (
      coalesce(private.setting('scan') -> 'deep_required_types' ? coalesce(p.sell_type::text, d.type::text, ''), false)
      or coalesce(private.setting('scan') -> 'deep_required_exts' ? lower(coalesce(substring(f.name from '\.([A-Za-z0-9]+)$'), '')), false)))
$function$
;

CREATE OR REPLACE FUNCTION private.resolve_reports(p_type text, p_id text, p_action text, p_note text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.sanction_user(p_user uuid, p_kind text, p_hours integer, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.restore_deleted(p_trash bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.scan_claim(p_tier text, p_engine text, p_worker text)
 RETURNS TABLE(job_id uuid, file_id uuid, bucket text, path text, name text, size_bytes bigint, store text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_cfg()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(private.setting('ai_review'), '{"enabled": false}'::jsonb)
$function$
;

CREATE OR REPLACE FUNCTION private.ai_still_pending(p_type text, p_target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case p_type
    when 'product' then exists (select 1 from public.products p where p.id = p_target and p.review_status = 'pending_review' and p.status = 'published')
    else exists (select 1 from public.listing_revisions r where r.id = p_target and r.status = 'pending_review') end
$function$
;

CREATE OR REPLACE FUNCTION private.is_service()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(auth.role(), '') = 'service_role'
      or (auth.role() is null and session_user <> 'authenticator')
$function$
;

CREATE OR REPLACE FUNCTION private.hire_jobs_paused()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  if coalesce(private.rule('closed_types') ? 'hire', false) then
    raise exception 'HIRE_PAUSED' using errcode = 'P0001', hint = 'งานจ้างปิดชั่วคราว';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.has_entitlement(p_product uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.entitlements e where e.product_id = p_product and e.user_id = auth.uid() and e.revoked_at is null)
$function$
;

CREATE OR REPLACE FUNCTION private.chat_threads_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.chat_thread_state (thread_id, user_id) values (new.id, new.buyer_id), (new.id, new.seller_id) on conflict do nothing;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.is_thread_member(p_thread uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.chat_threads t where t.id = p_thread and auth.uid() in (t.buyer_id, t.seller_id))
$function$
;

CREATE OR REPLACE FUNCTION private.thread_role(p_thread uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when t.buyer_id = auth.uid() then 'buyer' when t.seller_id = auth.uid() then 'seller' end
  from public.chat_threads t where t.id = p_thread
$function$
;

CREATE OR REPLACE FUNCTION private.finalize_free_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if not found or o.buyer_id <> auth.uid() or o.status <> 'pending' or o.total <> 0
     or exists (select 1 from public.order_items i where i.order_id = p_order and i.unit_price > 0) then
    raise exception 'order is not a free order' using errcode = '42501';
  end if;
  perform private.mark_order_paid(p_order, 'free', 0);
end $function$
;

CREATE OR REPLACE FUNCTION private.product_children_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pid uuid;
begin
  pid := coalesce(case when tg_op = 'DELETE' then null else new.product_id end, old.product_id);
  if pid is null then return null; end if;
  if tg_table_name = 'product_options' then
    update public.products set updated_at = now() where id = pid;   -- re-derives price
  end if;
  perform private.assert_listing_ok(pid);
  if tg_op = 'UPDATE' and tg_table_name = 'product_files' and old.product_id is distinct from new.product_id and old.product_id is not null then
    perform private.assert_listing_ok(old.product_id);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.bypass()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(nullif(current_setting('lumi.bypass', true), '')::int, 0) > 0 or private.is_service()
$function$
;

CREATE OR REPLACE FUNCTION private.hire_jobs_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.products_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m text[]; tm record;
begin
  select v.kind, v.type_key, v.layout, v.label into tm from (values
    ('img','image','img','img','ภาพ + พรอมต์'), ('tpl','image','tpl','tpl','เทมเพลต'), ('sw','image','tool','sw','โปรแกรม'),
    ('game','image','tool','sw','เกม'), ('bot','image','bot','bot','บอท'), ('course','course','course','course','คอร์สออนไลน์'),
    ('font','image','tpl','font','ฟอนต์'), ('hire','commission','svc','hire','งานจ้าง'), ('media','image','media','media','วิดีโอ เสียง เพลง'),
    ('skill','image','skill','skill','Agent Skills'), ('data','image','data','data','ชุดข้อมูล')
  ) v(st, kind, type_key, layout, label) where v.st = new.sell_type::text;
  new.kind := tm.kind; new.type_key := tm.type_key; new.layout := tm.layout;
  new.label := coalesce(nullif(btrim(new.label), ''), tm.label);
  new.spec := coalesce(new.spec, '{}'::jsonb) - 'prompt' - 'canvaLink' - 'files';   -- secrets live in product_secrets, files in product_files
  new.has_prompt := coalesce(new.spec->'sellPrompt' = 'true'::jsonb, false);
  new.tryable := coalesce(new.spec->'trial' = 'true'::jsonb, false);
  new.days := nullif(substring(coalesce(new.spec->>'timeline', '') from '(\d+)\s*วัน'), '')::int;
  new.revisions := nullif(substring(coalesce(new.spec->>'revisions', '') from '(\d+)'), '')::int;
  new.price := case when new.is_free then 0 else coalesce((select min(o.price) from public.product_options o where o.product_id = new.id and o.enabled and o.price > 0), 0) end;
  new.updated_at := now();
  if exists (select 1 from unnest(new.covers) c where c not like new.creator_id::text || '/%') then
    raise exception 'covers must be files in your own previews folder' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    if not private.bypass() then
      new.status := 'draft'; new.published_at := null;
      new.favorite_count := 0; new.sales_count := 0; new.review_count := 0; new.rating := null;
    end if;
  else
    if new.status is distinct from old.status and (old.status = 'removed' or new.status = 'removed') and not private.bypass() then
      raise exception 'only moderators can change a removed listing' using errcode = '42501';
    end if;
    if new.sell_type is distinct from old.sell_type and old.status <> 'draft' then
      raise exception 'unpublish (draft) the listing before changing its type' using errcode = '22023';
    end if;
  end if;
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
    if tg_op = 'INSERT' or old.status <> 'published'
       or (new.spec, new.title, new.use_text, new.description, new.covers, new.is_free, new.sell_type)
          is distinct from (old.spec, old.title, old.use_text, old.description, old.covers, old.is_free, old.sell_type) then
      m := private.listing_missing(new.id, new.sell_type, new.spec, new.title, new.use_text, new.description, new.covers, new.is_free);
      if cardinality(m) > 0 then
        raise exception 'LISTING_INCOMPLETE' using errcode = 'P0001', detail = array_to_string(m, ' | '), hint = 'ยังขาด ' || cardinality(m) || ' อย่าง';
      end if;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin new.updated_at := now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION private.can_read_secrets(p_product uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.products p where p.id = p_product and p.creator_id = auth.uid())
      or exists (select 1 from public.entitlements e join public.products p on p.id = e.product_id
                 where e.product_id = p_product and e.user_id = auth.uid() and e.revoked_at is null
                   and (p.sell_type <> 'img' or coalesce(e.option_code, '') <> 'img'))
$function$
;

CREATE OR REPLACE FUNCTION private.order_items_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.order_items_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.set_bypass(true);
  perform private.recompute_order(coalesce(new.order_id, old.order_id));
  perform private.set_bypass(false);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.license_key()
 RETURNS text
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select 'LUMI-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4)) || '-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4)) || '-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4))
$function$
;

CREATE OR REPLACE FUNCTION private.reviews_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pid uuid := coalesce(new.product_id, old.product_id); cid uuid;
begin
  update public.products p set review_count = s.n, rating = s.r
    from (select count(*) n, round(avg(stars)::numeric, 2) r from public.reviews where product_id = pid) s where p.id = pid
    returning p.creator_id into cid;
  update public.profiles pr set rating = (select round(avg(r.stars)::numeric, 2) from public.reviews r join public.products p on p.id = r.product_id where p.creator_id = cid)
    where pr.id = cid;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.favorites_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then update public.products set favorite_count = favorite_count + 1 where id = new.product_id;
  else update public.products set favorite_count = greatest(favorite_count - 1, 0) where id = old.product_id; end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.job_step(s job_status)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case s when 'briefed' then 0 when 'quoted' then 1 when 'accepted' then 2 when 'paid' then 3 when 'in_progress' then 3
    when 'revision' then 3 when 'delivered' then 4 when 'completed' then 5 else null end
$function$
;

CREATE OR REPLACE FUNCTION private.notify_followers(p_product uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.assert_listing_ok(p_product uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.products; m text[];
begin
  select * into p from public.products where id = p_product;
  if not found or p.status <> 'published' then return; end if;
  m := private.listing_missing(p.id, p.sell_type, p.spec, p.title, p.use_text, p.description, p.covers, p.is_free);
  if cardinality(m) > 0 then
    raise exception 'LISTING_INCOMPLETE' using errcode = 'P0001', detail = array_to_string(m, ' | '), hint = 'ยังขาด ' || cardinality(m) || ' อย่าง';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION private.messages_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r text;
begin
  new.created_at := now();
  if private.bypass() then return new; end if;
  r := private.thread_role(new.thread_id);
  if r is null then raise exception 'not a member of this chat' using errcode = '42501'; end if;
  new.sender_id := auth.uid();
  if new.kind in ('system','key','tip','offer') then
    raise exception 'this message type is created by LUMI' using errcode = '42501';
  elsif new.kind in ('progress','delivery','coupon') and r <> 'seller' then
    raise exception 'only the creator can send this card' using errcode = '42501';
  elsif new.kind = 'brief' and r <> 'buyer' then
    raise exception 'only the buyer can send a brief' using errcode = '42501';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.product_files_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.bucket := 'quarantine';
    new.scan := 'pending';
    new.sha256 := null;
    if new.path not like auth.uid()::text || '/%' then
      raise exception 'upload path must start with your user id' using errcode = '22023';
    end if;
  else
    if (new.bucket, new.path, new.scan, new.owner_id, new.size_bytes, new.sha256) is distinct from (old.bucket, old.path, old.scan, old.owner_id, old.size_bytes, old.sha256) then
      raise exception 'file storage fields are managed by LUMI' using errcode = '42501';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.spec_cond(p_spec jsonb, p_op text, p_field text, p_value text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_op is null then true
    when p_op = 'on' then coalesce(p_spec->p_field = 'true'::jsonb, false)
    when p_op = 'includes' then coalesce(jsonb_typeof(p_spec->p_field) = 'array' and (p_spec->p_field) ? p_value, false)
    when p_op = 'some_not' then exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p_spec->p_field) = 'array' then p_spec->p_field else '[]'::jsonb end) e where e <> p_value)
    when p_op = 'eq' then coalesce(btrim(p_spec->>p_field), '') = p_value
    when p_op = 'neq' then coalesce(btrim(p_spec->>p_field), '') <> p_value
    else false end
$function$
;

CREATE OR REPLACE FUNCTION private.spec_filled(p_spec jsonb, p_kind text, p_field text, p_min integer, p_must_on boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_kind = 'toggle' then (not p_must_on) or coalesce(p_spec->p_field = 'true'::jsonb, false)
    when p_kind in ('multi','list') then (select count(*) from jsonb_array_elements_text(case when jsonb_typeof(p_spec->p_field) = 'array' then p_spec->p_field else '[]'::jsonb end) e where btrim(e) <> '') >= p_min
    else coalesce(btrim(case when jsonb_typeof(p_spec->p_field) = 'string' then p_spec->>p_field end), '') <> ''
  end
$function$
;

CREATE OR REPLACE FUNCTION private.messages_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.chat_threads set last_message_at = new.created_at,
    last_message_preview = left(coalesce(nullif(new.body, ''), case new.kind
      when 'offer' then 'ใบเสนอราคา' when 'delivery' then 'ส่งงานแล้ว' when 'file' then 'ไฟล์' when 'image' then 'รูปภาพ'
      when 'key' then 'คีย์ใช้งาน' when 'brief' then 'บรีฟงาน' when 'sticker' then 'สติกเกอร์' when 'tip' then 'ทิป'
      when 'product' then 'สินค้า' else '' end), 140)
  where id = new.thread_id;
  if new.sender_id is not null then
    update public.chat_thread_state set last_read_at = new.created_at where thread_id = new.thread_id and user_id = new.sender_id;
    update public.chat_thread_state set archived = false where thread_id = new.thread_id;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.hire_jobs_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare nm text;
begin
  nm := coalesce(
          nullif(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'display_name', ''), '[[:cntrl:]]', '', 'g')), ''),
          nullif(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', ''), '[[:cntrl:]]', '', 'g')), ''),
          nullif(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'name', ''), '[[:cntrl:]]', '', 'g')), ''),
          'ผู้ใช้ LUMI');
  insert into public.profiles (id, display_name, avatar_path)
  values (new.id, left(nm, 60), null)
  on conflict (id) do nothing;
  insert into public.profile_private (id) values (new.id) on conflict (id) do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.offers_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.orders_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.reviews_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  new.author_id := auth.uid(); new.created_at := now();
  if not (private.has_entitlement(new.product_id)
          or exists (select 1 from public.hire_jobs j where j.product_id = new.product_id and j.buyer_id = auth.uid() and j.status = 'completed'
                     and (new.job_id is null or j.id = new.job_id))) then
    raise exception 'รีวิวได้เฉพาะคนที่ซื้อหรือจ้างงานแล้ว' using errcode = '42501';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.recompute_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.ensure_thread(p_buyer uuid, p_seller uuid, p_product uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.follows_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.can_download(p_bucket text, p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.product_files f
    where f.bucket = p_bucket and f.path = p_name and f.scan = 'ok'
      and ( f.owner_id = auth.uid()
         or (f.product_id is not null and f.role = 'deliverable' and (private.owns_product(f.product_id) or private.has_entitlement(f.product_id)))
         or (f.thread_id is not null and private.is_thread_member(f.thread_id)
             and (f.role <> 'delivery' or f.job_id is null
                  or exists (select 1 from public.hire_jobs j where j.id = f.job_id and (j.creator_id = auth.uid() or j.status = 'completed')))) ))
$function$
;

CREATE OR REPLACE FUNCTION private.challenge_entries_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  new.user_id := auth.uid(); new.vote_count := 0;
  if not exists (select 1 from public.challenges c where c.id = new.challenge_id and now() between c.starts_at and c.ends_at) then
    raise exception 'ยังไม่เปิดรับผลงาน หรือหมดเวลาส่งแล้ว' using errcode = '22023';
  end if;
  if new.image not like auth.uid()::text || '/%' then raise exception 'image must be in your previews folder' using errcode = '22023'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.challenge_votes_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  if not exists (select 1 from public.challenge_entries e join public.challenges c on c.id = e.challenge_id
                 where e.id = new.entry_id and e.user_id <> auth.uid() and now() between c.starts_at and c.voting_ends_at) then
    raise exception 'โหวตผลงานนี้ไม่ได้' using errcode = '22023';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.owns_product(p_product uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.products p where p.id = p_product and p.creator_id = auth.uid())
$function$
;

CREATE OR REPLACE FUNCTION private.post_visible(p_post uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.posts p where p.id = p_post and (p.status = 'visible' or p.author_id = auth.uid()))
$function$
;

CREATE OR REPLACE FUNCTION private.product_visible(p_product uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.products p where p.id = p_product
    and ((p.status = 'published' and p.review_status = 'live') or p.creator_id = auth.uid()))
$function$
;

CREATE OR REPLACE FUNCTION private.listing_missing(p_product uuid, p_type sell_type, p_spec jsonb, p_title text, p_use text, p_desc text, p_covers text[], p_free boolean)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  missing text[] := '{}';
  full_spec jsonb := coalesce(p_spec, '{}'::jsonb) || coalesce((select s.data from public.product_secrets s where s.product_id = p_product), '{}'::jsonb);
  r record; n_ok int; n_bad int;
begin
  if coalesce(cardinality(p_covers), 0) < 1 then
    missing := array_append(missing, case when p_type = 'hire' then 'รูปผลงานตัวอย่าง (อย่างน้อย 1)' else 'รูปหน้าปก (อย่างน้อย 1)' end);
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 4 then missing := array_append(missing, 'ชื่อผลงาน (อย่างน้อย 4 ตัวอักษร)'); end if;
  if char_length(btrim(coalesce(p_use, ''))) < 4 then missing := array_append(missing, 'เหมาะกับใคร / ใช้ทำอะไร'); end if;
  if char_length(btrim(coalesce(p_desc, ''))) < 10 then missing := array_append(missing, 'รายละเอียด (อย่างน้อย 10 ตัวอักษร)'); end if;
  if not coalesce(p_free, false) and not exists (select 1 from public.product_options o where o.product_id = p_product and o.enabled and o.price > 0) then
    missing := array_append(missing, 'ราคา (เปิดขายอย่างน้อย 1 แบบ)');
  end if;
  for r in select * from private.listing_rules lr where lr.sell_type = p_type order by lr.sort loop
    continue when not private.spec_cond(full_spec, r.cond_op, r.cond_field, r.cond_value);
    if r.kind = 'files' then
      select count(*) filter (where f.scan = 'ok'), count(*) filter (where f.scan <> 'ok')
        into n_ok, n_bad from public.product_files f where f.product_id = p_product and f.role = 'deliverable';
      if n_ok < r.min_items then missing := array_append(missing, r.label);
      elsif n_bad > 0 then missing := array_append(missing, r.label || ' (มีไฟล์ที่ยังสแกนไวรัสไม่ผ่าน)');
      end if;
    elsif not private.spec_filled(full_spec, r.kind, r.field_id, r.min_items, r.must_be_on) then
      missing := array_append(missing, r.label);
    end if;
  end loop;
  return missing;
end $function$
;

CREATE OR REPLACE FUNCTION private.is_job_member(p_job uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.hire_jobs j where j.id = p_job and auth.uid() in (j.buyer_id, j.creator_id))
$function$
;

CREATE OR REPLACE FUNCTION private.file_visible(p_owner uuid, p_product uuid, p_thread uuid, p_job uuid, p_role file_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_owner = auth.uid()
      or (p_product is not null and p_role = 'deliverable' and (private.owns_product(p_product) or private.has_entitlement(p_product)))
      or (p_thread is not null and private.is_thread_member(p_thread))
$function$
;

CREATE OR REPLACE FUNCTION private.set_bypass(v boolean)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select set_config('lumi.bypass', greatest(coalesce(nullif(current_setting('lumi.bypass', true), '')::int, 0) + case when v then 1 else -1 end, 0)::text, true)
$function$
;

CREATE OR REPLACE FUNCTION private.notify(p_user uuid, p_kind notif_kind, p_text text, p_link text, p_actor uuid DEFAULT NULL::uuid, p_image text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_user is null or p_user = p_actor then return; end if;
  insert into public.notifications (user_id, kind, text, link, actor_id, image)
  values (p_user, p_kind, left(p_text, 300), left(p_link, 300), p_actor, left(p_image, 300));
end $function$
;

CREATE OR REPLACE FUNCTION private.offers_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.is_moderator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.is_staff('moderator') $function$
;

CREATE OR REPLACE FUNCTION private.reply_ok(p_reply uuid, p_post uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_reply is null or exists (select 1 from public.comments c where c.id = p_reply and c.post_id = p_post)
$function$
;

CREATE OR REPLACE FUNCTION private.mark_order_paid(p_order uuid, p_charge_ref text, p_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.setting(p_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select value from private.settings where key = p_key $function$
;

CREATE OR REPLACE FUNCTION private.stories_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  new.author_id := auth.uid(); new.view_count := 0; new.created_at := now(); new.expires_at := now() + interval '24 hours';
  if new.media_path not like auth.uid()::text || '/%' then raise exception 'media must be in your own folder' using errcode = '22023'; end if;
  if (select count(*) from public.stories s where s.author_id = auth.uid() and s.expires_at > now()) >= 20 then
    raise exception 'ลงสตอรี่ได้สูงสุด 20 อันใน 24 ชั่วโมง' using errcode = '22023';
  end if;
  if new.product_id is not null then
    if not exists (select 1 from public.products p where p.id = new.product_id and p.creator_id = auth.uid() and p.status = 'published') then
      raise exception 'ลิงก์ได้เฉพาะผลงานของคุณที่ขึ้นร้านแล้ว' using errcode = '22023';
    end if;
    new.link_label := coalesce(new.link_label, 'ดูสินค้า');
  else
    new.link_label := null;
  end if;
  if new.media_kind = 'video' and new.duration_ms is not null and new.duration_ms > 60000 then
    raise exception 'วิดีโอสตอรี่ยาวได้ไม่เกิน 60 วินาที' using errcode = '22023';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.download_check(p_file uuid)
 RETURNS TABLE(bucket text, path text, name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.story_views_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin update public.stories set view_count = view_count + 1 where id = new.story_id; return new; end $function$
;

CREATE OR REPLACE FUNCTION private.pay_order_test(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.orders;
begin
  if coalesce((private.setting('test_payments'))::text, 'false') <> 'true' then raise exception 'test payments are off' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order and buyer_id = auth.uid();
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  perform private.mark_order_paid(o.id, 'test_' || replace(gen_random_uuid()::text, '-', ''), o.total);
end $function$
;

CREATE OR REPLACE FUNCTION private.reply_review(p_review uuid, p_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.reviews r set reply = nullif(left(btrim(coalesce(p_text, '')), 500), ''), reply_at = now()
    where r.id = p_review and exists (select 1 from public.products p where p.id = r.product_id and p.creator_id = auth.uid());
  if not found then raise exception 'only the creator of this listing can reply' using errcode = '42501'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION private.answer_refund(p_id uuid, p_refund boolean, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.refund_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.submit_edit(p_draft uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.listing_drafts; rid uuid;
begin
  select * into d from public.listing_drafts where id = p_draft and owner_id = auth.uid() and published_product_id is not null for update;
  if not found then raise exception 'draft not found' using errcode = 'P0002'; end if;
  if not private.approved_listing(d.published_product_id) then
    raise exception 'listing is not approved yet · use publish_listing' using errcode = '22023';
  end if;
  update public.listing_revisions set status = 'withdrawn', decided_at = now()
    where product_id = d.published_product_id and status = 'pending_review';
  insert into public.listing_revisions (product_id, draft_id, author_id, payload, file_ids)
    values (d.published_product_id, d.id, d.owner_id,
            jsonb_build_object('type', d.type, 'title', d.title, 'use_text', d.use_text, 'description', d.description, 'tags', to_jsonb(d.tags),
                               'covers', to_jsonb(d.covers), 'spec', d.spec, 'is_free', d.is_free, 'tips', d.tips, 'options', d.options),
            coalesce((select array_agg(f.id) from public.product_files f where f.draft_id = d.id and f.role = 'deliverable'), '{}'))
    returning id into rid;
  update public.listing_drafts set submitted_at = now(), review_reason = null where id = d.id;
end $function$
;

CREATE OR REPLACE FUNCTION private.products_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  if tg_op = 'INSERT' then
    new.review_status := 'pending_review'; new.review_reason := null; new.submitted_at := now(); return new;
  end if;
  if (new.review_status, new.review_reason) is distinct from (old.review_status, old.review_reason) then
    raise exception 'only the LUMI team can change review status' using errcode = '42501';
  end if;
  if (new.spec, new.title, new.use_text, new.description, new.covers, new.is_free, new.sell_type)
       is distinct from (old.spec, old.title, old.use_text, old.description, old.covers, old.is_free, old.sell_type) then
    if old.review_status = 'live' then
      raise exception 'EDIT_NEEDS_REVIEW' using errcode = '42501', hint = 'แก้ผลงานที่ผ่านการตรวจแล้วต้องส่งตรวจ (submit_edit) · ฉบับเดิมยังขายต่อได้';
    end if;
    new.review_status := 'pending_review'; new.review_reason := null; new.submitted_at := now();
  elsif new.status = 'published' and old.status <> 'published' and old.review_status <> 'live' then
    new.review_status := 'pending_review'; new.review_reason := null; new.submitted_at := now();
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.my_sales()
 RETURNS TABLE(item_id uuid, order_no text, paid_at timestamp with time zone, buyer_id uuid, product_id uuid, offer_id uuid, job_id uuid, title text, option_label text, gross integer, fee integer, net integer, ledger_status text, release_after timestamp with time zone, refund_id uuid, refund_status text, refund_reason text, refund_note text, refund_at timestamp with time zone, thread_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select oi.id, o.order_no, o.paid_at, o.buyer_id, oi.product_id, oi.offer_id, oi.job_id,
         oi.title, oi.option_label, oi.unit_price - oi.discount,
         coalesce(l.fee, 0), coalesce(l.net, oi.unit_price - oi.discount), l.status::text, l.release_after,
         r.id, r.status, r.reason, r.note, r.created_at,
         coalesce(e.thread_id, j.thread_id)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id and o.status in ('paid','refunded')
  left join lateral (select * from public.ledger l where l.order_item_id = oi.id order by l.created_at desc limit 1) l on true
  left join lateral (select * from public.refund_requests r where r.order_item_id = oi.id order by r.created_at desc limit 1) r on true
  left join lateral (select e.thread_id from public.entitlements e where e.order_item_id = oi.id limit 1) e on true
  left join public.hire_jobs j on j.id = oi.job_id
  where oi.creator_id = auth.uid() and oi.tip_creator_id is null
  order by o.paid_at desc nulls last
  limit 500
$function$
;

CREATE OR REPLACE FUNCTION private.finish_review(p_product uuid, p_draft uuid, p_pass boolean, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.products; r public.listing_revisions; secs int := (private.setting('test_auto_review_seconds'))::text::int; moder boolean := private.is_staff('moderator');
begin
  if p_draft is not null then
    select * into r from public.listing_revisions where draft_id = p_draft and status = 'pending_review' order by submitted_at desc limit 1;
    if not found then return 'none'; end if;
    if moder then return private.decide_listing(r.id, case when p_pass then 'approve' else 'needs_changes' end, null, p_reason); end if;
    if r.author_id = auth.uid() and secs is not null and p_pass and r.submitted_at <= now() - make_interval(secs => secs) then
      return private.decide_internal(r.id, 'approve', null, null, true);
    end if;
    return 'wait';
  end if;
  select * into p from public.products where id = p_product and review_status = 'pending_review' and status = 'published';
  if not found then return 'none'; end if;
  if moder then return private.decide_listing(p.id, case when p_pass then 'approve' else 'needs_changes' end, null, p_reason); end if;
  if p.creator_id = auth.uid() and secs is not null and p_pass and p.submitted_at <= now() - make_interval(secs => secs) then
    return private.decide_internal(p.id, 'approve', null, null, true);
  end if;
  return 'wait';
end $function$
;

CREATE OR REPLACE FUNCTION private.staff_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select string_agg(role, ',' order by role) from public.admin_roles where user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION private.approved_listing(p_product uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_product is not null and exists (select 1 from public.products where id = p_product and review_status = 'live')
$function$
;

CREATE OR REPLACE FUNCTION private.decide_listing(p_target uuid, p_decision text, p_code text, p_note text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.decide_internal(p_target, p_decision, p_code, p_note, false) $function$
;

CREATE OR REPLACE FUNCTION private.mark_submitted(p_product uuid, p_draft uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  perform private.set_bypass(true);
  update public.products set review_status = 'pending_review', review_reason = null, submitted_at = now()
    where id = p_product and creator_id = auth.uid() and review_status <> 'live';
  get diagnostics n = row_count;
  perform private.set_bypass(false);
  if n > 0 then perform private.audit('listing.submitted', 'product', p_product::text, null, jsonb_build_object('draft', p_draft)); end if;
end $function$
;

CREATE OR REPLACE FUNCTION private.set_staff_role(p_user uuid, p_role text, p_on boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_staff('admin') and not private.is_service() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_on then
    insert into public.admin_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) on conflict do nothing;
  else
    delete from public.admin_roles where user_id = p_user and role = p_role;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION private.audit(p_action text, p_type text, p_id text, p_before jsonb DEFAULT NULL::jsonb, p_after jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.audit_log (actor_id, actor_role, action, target_type, target_id, before, after)
  values (auth.uid(),
          coalesce(nullif(current_setting('lumi.actor_role', true), ''), private.staff_role(),
                   case when private.is_service() then 'system' when auth.uid() is null then 'system' else 'user' end),
          p_action, p_type, p_id, p_before, p_after);
end $function$
;

CREATE OR REPLACE FUNCTION private.apply_revision(p_rev uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.listing_revisions; pl jsonb; pid uuid; o jsonb; i int := 0; codes text[] := '{}'; lbl text; rm uuid[];
begin
  select * into r from public.listing_revisions where id = p_rev and status = 'pending_review' for update;
  if not found then raise exception 'revision not found' using errcode = 'P0002'; end if;
  pl := r.payload; pid := r.product_id;
  lbl := case when pl->>'type' <> 'hire' and jsonb_typeof(pl->'spec'->'sub') = 'string' then pl->'spec'->>'sub' end;
  rm := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(case when jsonb_typeof(pl->'spec'->'removeFiles') = 'array' then pl->'spec'->'removeFiles' else '[]' end) x
                  where x ~ '^[0-9a-f-]{36}$'), '{}');
  perform private.set_bypass(true);
  update public.products set sell_type = (pl->>'type')::public.sell_type, label = lbl, title = pl->>'title', use_text = pl->>'use_text',
    description = pl->>'description', tags = array(select jsonb_array_elements_text(pl->'tags')),
    covers = array(select jsonb_array_elements_text(pl->'covers')), spec = (pl->'spec') - 'removeFiles',
    is_free = (pl->>'is_free')::boolean, tips_enabled = (pl->>'tips')::boolean,
    status = 'published', review_status = 'live', review_reason = null where id = pid;
  for o in select * from jsonb_array_elements(pl->'options') loop
    i := i + 1;
    codes := codes || coalesce(o->>'id', 'opt' || i);
    insert into public.product_options (product_id, code, label, sub, price, suffix, enabled, sort)
      values (pid, coalesce(o->>'id', 'opt' || i), coalesce(nullif(o->>'label', ''), 'แบบที่ ' || i), coalesce(o->>'sub', ''),
              greatest(coalesce((o->>'price')::numeric, 0), 0)::int, nullif(o->>'suffix', ''), coalesce((o->>'on')::boolean, false) and not (pl->>'is_free')::boolean, i)
      on conflict (product_id, code) do update set label = excluded.label, sub = excluded.sub, price = excluded.price, suffix = excluded.suffix,
        enabled = excluded.enabled, sort = excluded.sort;
  end loop;
  update public.product_options set enabled = false where product_id = pid and not (code = any(codes));
  insert into public.product_secrets (product_id, data)
    values (pid, jsonb_strip_nulls(jsonb_build_object('prompt', pl->'spec'->'prompt', 'canvaLink', pl->'spec'->'canvaLink')))
    on conflict (product_id) do update set data = excluded.data;
  update public.product_files set product_id = pid, draft_id = null where id = any(r.file_ids) and owner_id = r.author_id and role = 'deliverable';
  update public.product_files set product_id = null where product_id = pid and id = any(rm) and not (id = any(r.file_ids));
  update public.listing_revisions set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = r.id;
  if r.draft_id is not null then
    update public.product_files set draft_id = null where draft_id = r.draft_id;
    delete from public.listing_drafts where id = r.draft_id;
  end if;
  perform private.set_bypass(false);
end $function$
;

CREATE OR REPLACE FUNCTION private.is_staff(p_role text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.admin_roles r where r.user_id = auth.uid()
                 and (p_role is null or r.role = p_role or r.role = 'admin'))
$function$
;

CREATE OR REPLACE FUNCTION private.audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_table_name = 'products' then
    if (new.status, new.review_status) is distinct from (old.status, old.review_status) then
      perform private.audit('listing.state', 'product', new.id::text,
        jsonb_build_object('status', old.status, 'review_status', old.review_status), jsonb_build_object('status', new.status, 'review_status', new.review_status));
    end if;
  elsif tg_table_name = 'admin_roles' then
    perform private.audit(case when tg_op = 'INSERT' then 'role.granted' else 'role.revoked' end, 'user', coalesce(new.user_id, old.user_id)::text,
      case when tg_op = 'DELETE' then to_jsonb(old) end, case when tg_op = 'INSERT' then to_jsonb(new) end);
  elsif tg_table_name = 'entitlements' then
    if new.revoked_at is distinct from old.revoked_at then
      perform private.audit(case when new.revoked_at is null then 'entitlement.restored' else 'entitlement.revoked' end, 'entitlement', new.id::text,
        jsonb_build_object('revoked_at', old.revoked_at), jsonb_build_object('revoked_at', new.revoked_at, 'user', new.user_id, 'product', new.product_id));
    end if;
  elsif tg_table_name = 'refund_requests' then
    if tg_op = 'INSERT' then
      perform private.audit('refund.requested', 'refund_request', new.id::text, null, jsonb_build_object('amount', new.amount, 'reason', new.reason));
    elsif new.status is distinct from old.status then
      perform private.audit('refund.' || new.status, 'refund_request', new.id::text, jsonb_build_object('status', old.status), jsonb_build_object('status', new.status, 'amount', new.amount));
    end if;
  elsif tg_table_name = 'orders' then
    if new.status is distinct from old.status then
      perform private.audit('order.' || new.status, 'order', new.id::text, jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
    end if;
  elsif tg_table_name = 'account_requests' then
    perform private.audit('account.' || new.kind || '_requested', 'user', new.user_id::text, null, jsonb_build_object('request', new.id));
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION private.secrets_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return coalesce(new, old); end if;
  if private.approved_listing(coalesce(new.product_id, old.product_id))
     and (tg_op <> 'UPDATE' or new.data is distinct from old.data) then
    raise exception 'EDIT_NEEDS_REVIEW' using errcode = '42501', hint = 'พรอมต์/ลิงก์ของผลงานที่ขายอยู่ เปลี่ยนได้ผ่านการส่งตรวจเท่านั้น';
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION private.files_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and new.role = 'deliverable' and private.approved_listing(new.product_id)
     or tg_op = 'UPDATE' and new.product_id is distinct from old.product_id
        and ((old.role = 'deliverable' and private.approved_listing(old.product_id)) or (new.role = 'deliverable' and private.approved_listing(new.product_id)))
     or tg_op = 'DELETE' and old.role = 'deliverable' and private.approved_listing(old.product_id) then
    raise exception 'EDIT_NEEDS_REVIEW' using errcode = '42501', hint = 'ไฟล์ของผลงานที่ขายอยู่ เปลี่ยนได้ผ่านการส่งตรวจเท่านั้น';
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION private.audit_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin raise exception 'audit_log is append-only' using errcode = '42501'; end $function$
;

CREATE OR REPLACE FUNCTION private.rule(p_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.setting('launch_rules') -> p_key $function$
;

CREATE OR REPLACE FUNCTION private.test_payments()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select coalesce(private.setting('test_payments') = 'true'::jsonb, false) $function$
;

CREATE OR REPLACE FUNCTION private.refund_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.products_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.order_items_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.unit_price - new.discount <= 0 then return new; end if;
  if new.offer_id is not null and not coalesce((private.rule('hire_payments'))::text::boolean, true) then
    raise exception 'HIRE_PAYMENTS_LATER' using errcode = 'P0001', hint = 'งานจ้างตอนนี้คุยและตกลงในแชตก่อน · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  if not coalesce((private.rule('paid_sales'))::text::boolean, true) then
    raise exception 'PAID_SALES_LATER' using errcode = 'P0001', hint = 'ช่วงแรกเปิดเฉพาะผลงานฟรี · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.files_size_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.run_publish_followups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.jsonb_bump(j jsonb, k text, d integer)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when greatest(coalesce((j ->> k)::int, 0) + d, 0) = 0 then j - k
              else j || jsonb_build_object(k, greatest(coalesce((j ->> k)::int, 0) + d, 0)) end
$function$
;

CREATE OR REPLACE FUNCTION private.reaction_emoji(k text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case k when 'love' then '😍' when 'haha' then '😆' when 'wow' then '😮' when 'fire' then '🔥' when 'idea' then '💡' else '❤️' end
$function$
;

CREATE OR REPLACE FUNCTION private.queue_publish_followups(p_product uuid, p_share boolean, p_notify boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.products where id = p_product and creator_id = auth.uid()) then return; end if;
  insert into private.publish_followups (product_id, share, notify) values (p_product, coalesce(p_share, false), coalesce(p_notify, false))
    on conflict (product_id) do update set share = excluded.share or private.publish_followups.share,
                                           notify = excluded.notify or private.publish_followups.notify;
end $function$
;

CREATE OR REPLACE FUNCTION private.product_options_paid_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.sell_type;
begin
  if private.is_service() or not new.enabled or coalesce(new.price, 0) <= 0 then return new; end if;
  if coalesce((private.rule('paid_sales'))::text::boolean, true) then return new; end if;
  select p.sell_type into t from public.products p where p.id = new.product_id;
  if t is distinct from 'hire' then
    raise exception 'PAID_SALES_LATER' using errcode = 'P0001', hint = 'ช่วงแรกเปิดเฉพาะผลงานฟรี · ระบบชำระเงินจะเปิดภายหลัง';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.is_test_user(p uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select is_test from public.profiles where id = p), false)
$function$
;

CREATE OR REPLACE FUNCTION private.notifications_flag_test()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.from_test := not private.is_test_user(new.user_id)
    and (private.is_test_user(new.actor_id) or private.is_test_user(auth.uid()));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.community_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; r record; n text; au uuid; rd int; ra uuid;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  perform private.set_bypass(true);
  if tg_table_name = 'post_likes' then
    rd := case when private.is_test_user(r.user_id) then 0 else d end;
    update public.posts set like_count = greatest(like_count + d, 0), real_like_count = greatest(real_like_count + rd, 0) where id = r.post_id returning author_id into au;
    if tg_op = 'INSERT' then
      select display_name into n from public.profiles where id = r.user_id;
      perform private.notify2(au, 'like', coalesce(n, 'มีคน') || case when r.kind = 'like' then ' ถูกใจโพสต์ของคุณ' else ' แสดงความรู้สึก ' || private.reaction_emoji(r.kind) || ' ต่อโพสต์ของคุณ' end,
        '/community/post/' || r.post_id, r.user_id, 'reaction', private.reaction_emoji(r.kind));
    end if;
  elsif tg_table_name = 'comments' then
    rd := case when private.is_test_user(r.author_id) then 0 else d end;
    update public.posts set comment_count = greatest(comment_count + d, 0), real_comment_count = greatest(real_comment_count + rd, 0) where id = r.post_id returning author_id into au;
    if tg_op = 'INSERT' then
      select display_name into n from public.profiles where id = r.author_id;
      perform private.notify2(au, 'community', coalesce(n, 'มีคน') || ' แสดงความคิดเห็นในโพสต์ของคุณ: “' || left(r.body, 60) || '”', '/community/post/' || r.post_id, r.author_id, 'reply', '💬');
      if r.reply_to is not null then
        select c.author_id into ra from public.comments c where c.id = r.reply_to;
        if ra is distinct from au then
          perform private.notify2(ra, 'community', coalesce(n, 'มีคน') || ' ตอบกลับความคิดเห็นของคุณ: “' || left(r.body, 60) || '”', '/community/post/' || r.post_id, r.author_id, 'reply', '💬');
        end if;
      end if;
    end if;
  elsif tg_table_name = 'comment_likes' then
    update public.comments set like_count = greatest(like_count + d, 0) where id = r.comment_id returning author_id, post_id into au, ra;
    if tg_op = 'INSERT' then
      select display_name into n from public.profiles where id = r.user_id;
      perform private.notify2(au, 'like', coalesce(n, 'มีคน') || ' แสดงความรู้สึก ' || private.reaction_emoji(r.kind) || ' ต่อความคิดเห็นของคุณ', '/community/post/' || ra, r.user_id, 'reaction', private.reaction_emoji(r.kind));
    end if;
  elsif tg_table_name = 'challenge_votes' then
    update public.challenge_entries set vote_count = greatest(vote_count + d, 0) where id = r.entry_id;
  end if;
  perform private.set_bypass(false);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.notify2(p_user uuid, p_kind notif_kind, p_text text, p_link text, p_actor uuid, p_sub text, p_badge text, p_image text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_user is null or p_user = p_actor then return; end if;
  insert into public.notifications (user_id, kind, text, link, actor_id, image, sub, badge)
  values (p_user, p_kind, left(p_text, 300), left(p_link, 300), p_actor, left(p_image, 300), p_sub, left(p_badge, 8));
end $function$
;

CREATE OR REPLACE FUNCTION private.reaction_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t boolean;
begin
  perform private.set_bypass(true);
  if tg_table_name = 'post_likes' then
    if tg_op in ('DELETE', 'UPDATE') then
      t := private.is_test_user(old.user_id);
      update public.posts set reaction_counts = private.jsonb_bump(reaction_counts, old.kind, -1),
        real_reaction_counts = case when t then real_reaction_counts else private.jsonb_bump(real_reaction_counts, old.kind, -1) end
      where id = old.post_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      t := private.is_test_user(new.user_id);
      update public.posts set reaction_counts = private.jsonb_bump(reaction_counts, new.kind, 1),
        real_reaction_counts = case when t then real_reaction_counts else private.jsonb_bump(real_reaction_counts, new.kind, 1) end
      where id = new.post_id;
    end if;
  else
    if tg_op in ('DELETE', 'UPDATE') then
      t := private.is_test_user(old.user_id);
      update public.comments set reaction_counts = private.jsonb_bump(reaction_counts, old.kind, -1),
        real_reaction_counts = case when t then real_reaction_counts else private.jsonb_bump(real_reaction_counts, old.kind, -1) end
      where id = old.comment_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      t := private.is_test_user(new.user_id);
      update public.comments set reaction_counts = private.jsonb_bump(reaction_counts, new.kind, 1),
        real_reaction_counts = case when t then real_reaction_counts else private.jsonb_bump(real_reaction_counts, new.kind, 1) end
      where id = new.comment_id;
    end if;
  end if;
  perform private.set_bypass(false);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.room_members_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare priv text;
begin
  if private.bypass() then return new; end if;
  select privacy into priv from public.rooms where id = new.room_id;
  if tg_op = 'INSERT' then
    new.role := 'member'; new.joined_at := now();
    if new.user_id = auth.uid() then
      new.invited_by := null;
      new.status := case when priv = 'private' then 'requested' else 'joined' end;
    else
      -- inviting someone else: you must be a member, they must not be in the group yet, max 50 invites a day
      if new.status <> 'invited' or new.invited_by is distinct from auth.uid() then raise exception 'invite only' using errcode = '42501'; end if;
      if not exists (select 1 from public.room_members m where m.room_id = new.room_id and m.user_id = auth.uid() and m.status = 'joined') then
        raise exception 'เข้าร่วมกลุ่มก่อนจึงจะเชิญเพื่อนได้' using errcode = '42501';
      end if;
      if (select count(*) from public.room_members m where m.invited_by = auth.uid() and m.joined_at > now() - interval '1 day') >= 50 then
        raise exception 'เชิญได้สูงสุด 50 คนต่อวัน' using errcode = '22023';
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    -- only: accept an invite (invited -> joined)
    if new.role is distinct from old.role or new.room_id is distinct from old.room_id or new.user_id is distinct from old.user_id
       or not (old.status = 'invited' and new.status = 'joined') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    new.joined_at := now();
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.room_members_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rid text; n text; rn text;
begin
  rid := case when tg_op = 'DELETE' then old.room_id else new.room_id end;
  perform private.set_bypass(true);
  update public.rooms set member_count = (select count(*) from public.room_members m where m.room_id = rid and m.status = 'joined') where id = rid;
  if tg_op = 'INSERT' and new.status = 'invited' then
    select display_name into n from public.profiles where id = new.invited_by;
    select name into rn from public.rooms where id = new.room_id;
    perform private.notify2(new.user_id, 'community', coalesce(n, 'มีคน') || ' เชิญคุณเข้ากลุ่ม ' || coalesce(rn, ''), '/community/group/' || new.room_id, new.invited_by, 'group_invite', '👥');
  end if;
  perform private.set_bypass(false);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.posts_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.like_count := 0; new.comment_count := 0; new.share_count := 0; new.status := 'visible'; new.created_at := now();
  end if;
  if new.room_id is not null and (tg_op = 'INSERT' or new.room_id is distinct from old.room_id)
     and not exists (select 1 from public.room_members m where m.room_id = new.room_id and m.user_id = auth.uid() and m.status = 'joined') then
    raise exception 'เข้าร่วมกลุ่มก่อนจึงจะโพสต์ได้' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(new.images) i where i not like auth.uid()::text || '/%') then
    raise exception 'images must be files in your own previews folder' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(new.product_ids) x where not exists (select 1 from public.products p where p.id = x and p.status = 'published')) then
    raise exception 'linked products must be published' using errcode = '22023';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.mentions_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.bypass() then return new; end if;
  new.author_id := auth.uid(); new.created_at := now();
  if new.mentioned_id = auth.uid() then raise exception 'แท็กตัวเองไม่ได้' using errcode = '22023'; end if;
  if not (case new.source_kind
      when 'post' then exists (select 1 from public.posts p where p.id = new.source_id and p.author_id = auth.uid())
      when 'comment' then exists (select 1 from public.comments c where c.id = new.source_id and c.author_id = auth.uid())
      when 'story' then exists (select 1 from public.stories s where s.id = new.source_id and s.author_id = auth.uid() and s.expires_at > now())
      else false end) then
    raise exception 'แท็กได้เฉพาะในโพสต์ของคุณเอง' using errcode = '42501';
  end if;
  if (select count(*) from public.mentions m where m.source_kind = new.source_kind and m.source_id = new.source_id) >= 10 then
    raise exception 'แท็กได้สูงสุด 10 คนต่อโพสต์' using errcode = '22023';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.mentions_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n text; body text; link text; what text;
begin
  select display_name into n from public.profiles where id = new.author_id;
  if new.source_kind = 'post' then
    select p.body into body from public.posts p where p.id = new.source_id; link := '/community/post/' || new.source_id; what := 'โพสต์';
  elsif new.source_kind = 'comment' then
    select c.body, '/community/post/' || c.post_id into body, link from public.comments c where c.id = new.source_id; what := 'ความคิดเห็น';
  else
    select s.caption into body from public.stories s where s.id = new.source_id; link := '/story/' || new.author_id; what := 'สตอรี่';
  end if;
  perform private.notify2(new.mentioned_id, 'community', coalesce(n, 'มีคน') || ' กล่าวถึงคุณใน' || what || case when coalesce(body, '') <> '' then ': “' || left(body, 80) || '”' else '' end,
    link, new.author_id, 'mention', '@');
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.story_reactions_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare au uuid; n text;
begin
  select author_id into au from public.stories where id = new.story_id;
  select display_name into n from public.profiles where id = new.user_id;
  perform private.notify2(au, 'like', coalesce(n, 'มีคน') || ' แสดงความรู้สึก ' || new.emoji || ' ต่อสตอรี่ของคุณ', '/story/' || au, new.user_id, 'story_reaction', new.emoji);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.messages_story_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare au uuid;
begin
  if new.story_id is null or private.bypass() then return new; end if;
  select s.author_id into au from public.stories s where s.id = new.story_id and s.expires_at > now();
  if au is null or au = auth.uid()
     or not exists (select 1 from public.chat_threads t where t.id = new.thread_id and au in (t.buyer_id, t.seller_id) and auth.uid() in (t.buyer_id, t.seller_id)) then
    raise exception 'ตอบกลับสตอรี่นี้ไม่ได้' using errcode = '42501';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.hidden_author(p_author uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and p_author is not null and p_author <> auth.uid() and exists (
    select 1 from public.user_blocks x
    where (x.user_id = auth.uid() and x.target_id = p_author)
       or (x.user_id = p_author and x.target_id = auth.uid() and x.kind = 'block'))
$function$
;

CREATE OR REPLACE FUNCTION private.throttle_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform private.throttle(tg_argv[0]); return new; end $function$
;

CREATE OR REPLACE FUNCTION private.reports_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.file_deep_ok(p_file uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select not private.file_needs_deep(p_file)
      or exists (select 1 from public.scan_jobs j where j.file_id = p_file and j.tier = 'deep' and j.status = 'clean')
$function$
;

CREATE OR REPLACE FUNCTION private.throttle(p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.signup_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.user_blocks_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not private.bypass() then new.user_id := auth.uid(); new.created_at := now(); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.user_blocks_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.kind = 'block' then
    perform private.set_bypass(true);
    delete from public.follows where (follower_id = new.user_id and creator_id = new.target_id) or (follower_id = new.target_id and creator_id = new.user_id);
    perform private.set_bypass(false);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.blocked_between(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.user_blocks x where x.kind = 'block'
      and ((x.user_id = a and x.target_id = b) or (x.user_id = b and x.target_id = a)))
$function$
;

CREATE OR REPLACE FUNCTION private.block_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.report_target_owner(p_type text, p_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.scan_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.scan_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'published' and new.review_status = 'live'
     and (tg_op = 'INSERT' or old.review_status is distinct from 'live' or old.status is distinct from 'published')
     and exists (select 1 from public.product_files f where f.product_id = new.id and f.role = 'deliverable' and not private.file_deep_ok(f.id)) then
    raise exception 'SCAN_REQUIRED' using errcode = 'P0001',
      hint = 'ไฟล์ประเภทโปรแกรมหรือโค้ดต้องผ่านการสแกนไวรัสแบบเต็มก่อนขึ้นร้าน';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.revision_scan_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
     and exists (select 1 from public.product_files f where f.id = any (new.file_ids) and f.role = 'deliverable' and not private.file_deep_ok(f.id)) then
    raise exception 'SCAN_REQUIRED' using errcode = '55000',
      hint = 'ไฟล์ประเภทโปรแกรมหรือโค้ดต้องผ่านการสแกนไวรัสแบบเต็มก่อนขึ้นร้าน';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.to_trash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb := to_jsonb(old);
begin
  insert into private.trash (table_name, row_id, owner_id, data, deleted_by)
  values (tg_table_name, coalesce(d ->> 'id', d ->> 'post_id'),
          coalesce(d ->> 'author_id', d ->> 'creator_id', d ->> 'owner_id', d ->> 'user_id')::uuid, d, auth.uid());
  if random() < 0.01 then
    delete from private.trash where deleted_at < now() - make_interval(days => coalesce((private.setting('moderation') ->> 'trash_days')::int, 30));
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.scan_finish(p_job uuid, p_status text, p_signature text, p_detail jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.access_log_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' and current_setting('lumi.log_purge', true) = 'on' then return old; end if;
  raise exception 'access_log is append-only' using errcode = '42501';
end $function$
;

CREATE OR REPLACE FUNCTION private.req_header(p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select nullif(btrim((nullif(current_setting('request.headers', true), '')::jsonb) ->> lower(p_name)), '')
$function$
;

CREATE OR REPLACE FUNCTION private.safe_inet(p text)
 RETURNS inet
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin return nullif(btrim(p), '')::inet; exception when others then return null; end $function$
;

CREATE OR REPLACE FUNCTION private.client_ip()
 RETURNS inet
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(private.safe_inet(private.req_header('cf-connecting-ip')),
                  private.safe_inet(private.req_header('x-real-ip')),
                  private.safe_inet(split_part(private.req_header('x-forwarded-for'), ',', 1)))
$function$
;

CREATE OR REPLACE FUNCTION private.decide_internal(p_target uuid, p_decision text, p_code text, p_note text, p_test boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.products; r public.listing_revisions; t text; st text; why text := left(coalesce(nullif(btrim(p_note), ''), nullif(btrim(p_code), ''), 'ไม่ผ่านการตรวจ'), 300);
begin
  if p_decision not in ('approve','needs_changes','reject') then raise exception 'bad decision' using errcode = '22023'; end if;
  if not p_test and not private.is_staff('moderator') then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_test and coalesce(current_setting('lumi.actor_role', true), '') = '' then perform set_config('lumi.actor_role', 'test_auto_review', true); end if;
  select * into r from public.listing_revisions where id = p_target and status = 'pending_review';
  if found then
    select * into p from public.products where id = r.product_id;
    if p_decision = 'approve' then
      begin
        perform private.apply_revision(r.id);
      exception when sqlstate 'P0001' then
        perform private.set_bypass(false);
        update public.listing_revisions set status = 'needs_changes', decided_by = auth.uid(), decided_at = now(),
          reason_code = 'incomplete', reason_note = left(coalesce(sqlerrm, '') || ' ' || coalesce(nullif(pg_exception_context(), ''), ''), 300) where id = r.id;
        p_decision := 'needs_changes'; why := 'ข้อมูลยังไม่ครบ';
      end;
    else
      update public.listing_revisions set status = case when p_decision = 'reject' then 'rejected' else 'needs_changes' end,
        decided_by = auth.uid(), decided_at = now(), reason_code = left(p_code, 60), reason_note = why where id = r.id;
    end if;
    if p_decision <> 'approve' and r.draft_id is not null then
      update public.listing_drafts set submitted_at = null, review_reason = why where id = r.draft_id;
    end if;
    perform private.audit('revision.' || p_decision, 'listing_revision', r.id::text,
      jsonb_build_object('product', r.product_id), jsonb_build_object('code', p_code, 'note', why));
    t := case when p_decision = 'approve' then 'การแก้ไข “' || p.title || '” ผ่านการตรวจแล้ว · ผู้ซื้อเห็นฉบับใหม่แล้ว'
              else 'การแก้ไข “' || p.title || '” ยังไม่ผ่านการตรวจ: ' || why || ' · ฉบับเดิมยังขายอยู่' end;
    perform private.notify(r.author_id, 'moderation', t, '/product/' || r.product_id, null, p.covers[1]);
    return case when p_decision = 'approve' then 'live' else 'rejected' end;
  end if;
  select * into p from public.products where id = p_target and review_status = 'pending_review' and status = 'published' for update;
  if not found then return 'none'; end if;
  st := case p_decision when 'approve' then 'live' when 'reject' then 'rejected' else 'needs_changes' end;
  perform private.set_bypass(true);
  update public.products set review_status = st, review_reason = case when st = 'live' then null else why end where id = p.id;
  perform private.set_bypass(false);
  perform private.audit('listing.' || p_decision, 'product', p.id::text,
    jsonb_build_object('review_status', p.review_status), jsonb_build_object('review_status', st, 'code', p_code, 'note', why));
  t := case when st = 'live' then '“' || p.title || '” ผ่านการตรวจแล้ว · ขึ้นขายบนหน้าแรก หน้าค้นหา และหน้าร้านแล้ว'
            else '“' || p.title || '” ยังไม่ผ่านการตรวจ: ' || why || ' · แก้ไขแล้วส่งตรวจใหม่ได้' end;
  perform private.notify(p.creator_id, 'moderation', t, '/product/' || p.id, null, p.covers[1]);
  return case when st = 'live' then 'live' else 'rejected' end;
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_enqueue(p_type text, p_target uuid, p_product uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if coalesce((private.ai_cfg() ->> 'enabled')::boolean, false) is not true then return; end if;
  insert into public.ai_reviews (target_type, target_id, product_id, provider, model)
    values (p_type, p_target, p_product, private.ai_cfg() ->> 'provider', private.ai_cfg() ->> 'model')
    on conflict do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_enqueue_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.review_status = 'pending_review' and new.status = 'published'
     and (tg_op = 'INSERT' or old.review_status is distinct from 'pending_review' or old.status is distinct from 'published'
          or old.submitted_at is distinct from new.submitted_at) then
    perform private.ai_enqueue('product', new.id, new.id);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_enqueue_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'pending_review' and (tg_op = 'INSERT' or old.status is distinct from 'pending_review') then
    perform private.ai_enqueue('revision', new.id, new.product_id);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_target_files(p_type text, p_target uuid)
 RETURNS SETOF product_files
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.* from public.product_files f where f.role = 'deliverable' and (
    (p_type = 'product' and f.product_id = p_target)
    or (p_type = 'revision' and f.id = any ((select r.file_ids from public.listing_revisions r where r.id = p_target)::uuid[])))
$function$
;

CREATE OR REPLACE FUNCTION private.ai_scans_ready(p_type text, p_target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select not exists (select 1 from private.ai_target_files(p_type, p_target) f where f.scan <> 'ok' or not private.file_deep_ok(f.id))
$function$
;

CREATE OR REPLACE FUNCTION private.moderation_queue(p_limit integer, p_before timestamp with time zone)
 RETURNS TABLE(target_type text, target_id uuid, product_id uuid, title text, sell_type text, creator_id uuid, submitted_at timestamp with time zone, ai_verdict text, ai_reason text, ai_confidence numeric, open_reports bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_staff('moderator') then raise exception 'moderators only' using errcode = '42501'; end if;
  return query
  with q as (
    select 'product'::text tt, p.id tid, p.id pid, p.title, p.sell_type::text st, p.creator_id cid, p.submitted_at sat
      from public.products p where p.review_status = 'pending_review' and p.status = 'published'
    union all
    select 'revision', r.id, r.product_id, r.payload ->> 'title', r.payload ->> 'type', r.author_id, r.submitted_at
      from public.listing_revisions r where r.status = 'pending_review')
  select q.tt, q.tid, q.pid, q.title, q.st, q.cid, q.sat, a.verdict, a.reason, a.confidence,
         (select count(*) from public.reports x where x.status = 'open' and x.target_type = 'product' and x.target_id = q.pid::text)
  from q
  left join lateral (select * from public.ai_reviews a where a.target_type = q.tt and a.target_id = q.tid and a.status = 'done'
                     order by a.finished_at desc limit 1) a on true
  where p_before is null or q.sat < p_before
  order by q.sat asc nulls last
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_review_claim(p_worker text)
 RETURNS TABLE(job_id uuid, target_type text, target_id uuid, product_id uuid, listing jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.ai_reviews; cfg jsonb := private.ai_cfg(); p public.products; pl jsonb; n int := coalesce((cfg ->> 'max_images')::int, 3);
begin
  if not private.is_service() then raise exception 'service only' using errcode = '42501'; end if;
  if coalesce((cfg ->> 'enabled')::boolean, false) is not true then return; end if;
  -- drop jobs whose listing was already decided by a person
  update public.ai_reviews a set status = 'skipped', outcome = 'stale', finished_at = now()
    where a.status in ('queued','error') and not private.ai_still_pending(a.target_type, a.target_id);
  select * into j from public.ai_reviews a
    where (a.status = 'queued' or (a.status = 'running' and a.started_at < now() - interval '10 minutes')
           or (a.status = 'error' and a.attempts < 3 and a.finished_at < now() - interval '5 minutes'))
      and private.ai_scans_ready(a.target_type, a.target_id)
    order by a.created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.ai_reviews set status = 'running', attempts = attempts + 1, started_at = now(), worker = left(p_worker, 80) where id = j.id;
  select * into p from public.products where id = j.product_id;
  if j.target_type = 'revision' then select r.payload into pl from public.listing_revisions r where r.id = j.target_id;
  else pl := jsonb_build_object('type', p.sell_type, 'title', p.title, 'use_text', p.use_text, 'description', p.description,
                                'tags', to_jsonb(p.tags), 'covers', to_jsonb(p.covers), 'is_free', p.is_free, 'price', p.price);
  end if;
  return query select j.id, j.target_type, j.target_id, j.product_id, jsonb_build_object(
    'type', pl ->> 'type', 'title', pl ->> 'title', 'use_text', pl ->> 'use_text', 'description', pl ->> 'description',
    'tags', pl -> 'tags', 'is_free', pl -> 'is_free', 'price', coalesce(pl -> 'price', to_jsonb(p.price)),
    'images', (select coalesce(jsonb_agg(x), '[]') from (select x from jsonb_array_elements_text(coalesce(pl -> 'covers', '[]')) x limit n) s),
    'image_bucket', 'previews',
    'files', (select coalesce(jsonb_agg(jsonb_build_object('name', f.name, 'size', f.size_bytes, 'mime', f.mime)), '[]') from private.ai_target_files(j.target_type, j.target_id) f),
    'creator_listings_live', (select count(*) from public.products q where q.creator_id = p.creator_id and q.review_status = 'live'));
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_review_finish(p_job uuid, p_verdict text, p_reason_code text, p_reason text, p_confidence numeric, p_categories jsonb, p_provider text, p_model text, p_cost_usd numeric, p_error text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.ai_reviews; cfg jsonb := private.ai_cfg(); typ text; v_outcome text := 'needs_human'; res text; conf numeric := coalesce(p_confidence, 0);
begin
  if not private.is_service() then raise exception 'service only' using errcode = '42501'; end if;
  select * into j from public.ai_reviews where id = p_job for update;
  if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
  if p_error is not null then
    update public.ai_reviews set status = 'error', error = left(p_error, 300), finished_at = now() where id = j.id;
    return 'error';
  end if;
  if p_verdict not in ('approve','reject','needs_human') then raise exception 'bad verdict' using errcode = '22023'; end if;
  select coalesce(r.payload ->> 'type', p.sell_type::text) into typ from public.products p
    left join public.listing_revisions r on r.id = j.target_id and j.target_type = 'revision' where p.id = j.product_id;
  if not private.ai_still_pending(j.target_type, j.target_id) then
    v_outcome := 'stale';
  elsif not private.ai_scans_ready(j.target_type, j.target_id) then
    v_outcome := 'needs_human';
  elsif p_verdict = 'approve' and coalesce((cfg ->> 'auto_approve')::boolean, false)
        and conf >= coalesce((cfg ->> 'min_confidence_approve')::numeric, 0.9)
        and not coalesce(cfg -> 'human_only_types' ? typ, false) then
    perform set_config('lumi.actor_role', 'ai_review', true);
    res := private.decide_internal(j.target_id, 'approve', 'ai_ok', null, true);
    perform set_config('lumi.actor_role', '', true);
    v_outcome := case when res = 'live' then 'auto_approved' else 'needs_human' end;
  elsif p_verdict = 'reject' and coalesce((cfg ->> 'auto_reject')::boolean, false)
        and conf >= coalesce((cfg ->> 'min_confidence_reject')::numeric, 0.9) and nullif(btrim(p_reason), '') is not null then
    perform set_config('lumi.actor_role', 'ai_review', true);
    res := private.decide_internal(j.target_id, case when cfg ->> 'reject_as' = 'reject' then 'reject' else 'needs_changes' end,
                                   coalesce(left(p_reason_code, 60), 'ai_reject'), p_reason, true);
    perform set_config('lumi.actor_role', '', true);
    v_outcome := 'auto_rejected';
  end if;
  update public.ai_reviews set status = 'done', verdict = p_verdict, reason_code = left(p_reason_code, 60), reason = left(p_reason, 300),
    confidence = p_confidence, categories = coalesce(p_categories, '{}'::jsonb), provider = coalesce(left(p_provider, 40), provider),
    model = coalesce(left(p_model, 80), model), cost_usd = p_cost_usd, outcome = v_outcome, finished_at = now(), error = null
    where id = j.id;
  perform set_config('lumi.actor_role', 'ai_review', true);
  perform private.audit('ai_review.' || v_outcome, j.target_type, j.target_id::text, null,
    jsonb_build_object('verdict', p_verdict, 'reason', left(p_reason, 300), 'confidence', p_confidence, 'provider', p_provider, 'model', p_model));
  perform set_config('lumi.actor_role', '', true);
  return v_outcome;
end $function$
;

CREATE OR REPLACE FUNCTION private.ai_review_backfill()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  if not (private.is_service() or private.is_staff('admin')) then raise exception 'admins only' using errcode = '42501'; end if;
  if coalesce((private.ai_cfg() ->> 'enabled')::boolean, false) is not true then return 0; end if;
  insert into public.ai_reviews (target_type, target_id, product_id, provider, model)
  select 'product', p.id, p.id, private.ai_cfg() ->> 'provider', private.ai_cfg() ->> 'model' from public.products p
    where p.review_status = 'pending_review' and p.status = 'published'
  union all
  select 'revision', r.id, r.product_id, private.ai_cfg() ->> 'provider', private.ai_cfg() ->> 'model' from public.listing_revisions r where r.status = 'pending_review'
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION private.grant_owner_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg jsonb; em text := lower(trim(coalesce(new.email, '')));
begin
  if new.email_confirmed_at is null or em = '' then return null; end if;
  select value into cfg from private.settings where key = 'owner_admins' for update;
  if cfg is null or not coalesce(cfg -> 'pending' ? em, false) then return null; end if;
  begin
    insert into public.admin_roles (user_id, role, granted_by) values (new.id, 'admin', null) on conflict do nothing;
    update private.settings
       set value = jsonb_build_object(
             'pending', coalesce((select jsonb_agg(x) from jsonb_array_elements_text(cfg -> 'pending') x where x <> em), '[]'::jsonb),
             'granted', coalesce(cfg -> 'granted', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('email', em, 'user_id', new.id, 'at', now())))
     where key = 'owner_admins';
  exception when others then
    raise warning 'owner admin grant skipped: %', sqlerrm;
  end;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.log_access(p_event text, p_type text DEFAULT NULL::text, p_id text DEFAULT NULL::text, p_detail jsonb DEFAULT NULL::jsonb, p_source text DEFAULT 'db'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.access_log_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.purge_access_log()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

-- public policies
create policy "staff read ai reviews" on public.ai_reviews as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_staff('moderator'::text) AS is_staff));
create policy "change own reaction" on public.post_likes as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "like visible post" on public.post_likes as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.post_visible(post_likes.post_id) AS post_visible)));
create policy "own likes" on public.post_likes as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy unlike on public.post_likes as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own saves" on public.post_saves as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "save visible post" on public.post_saves as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.post_visible(post_saves.post_id) AS post_visible)));
create policy unsave on public.post_saves as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "rooms are public" on public.rooms as PERMISSIVE for SELECT to anon,authenticated using (true);
create policy "comment on visible post" on public.comments as PERMISSIVE for INSERT to authenticated with check (((author_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.post_visible(comments.post_id) AS post_visible) AND ( SELECT private.reply_ok(comments.reply_to, comments.post_id) AS reply_ok)));
create policy "comments on visible posts" on public.comments as PERMISSIVE for SELECT to anon,authenticated using ((( SELECT private.post_visible(comments.post_id) AS post_visible) AND ((hidden_at IS NULL) OR (author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('moderator'::text) AS is_staff)) AND (NOT private.hidden_author(author_id))));
create policy "delete own comment or on own post" on public.comments as PERMISSIVE for DELETE to authenticated using (((author_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM posts p
  WHERE ((p.id = comments.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid)))))));
create policy "edit own comment" on public.comments as PERMISSIVE for UPDATE to authenticated using ((author_id = ( SELECT auth.uid() AS uid))) with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy "challenges are public" on public.challenges as PERMISSIVE for SELECT to anon,authenticated using (true);
create policy "enter challenge" on public.challenge_entries as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "entries are public" on public.challenge_entries as PERMISSIVE for SELECT to anon,authenticated using (true);
create policy "withdraw own entry" on public.challenge_entries as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own votes" on public.challenge_votes as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy unvote on public.challenge_votes as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy vote on public.challenge_votes as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own roles, admins see all" on public.admin_roles as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('admin'::text) AS is_staff)));
create policy "change own comment reaction" on public.comment_likes as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "like comment" on public.comment_likes as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own comment likes" on public.comment_likes as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "unlike comment" on public.comment_likes as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "admins read the audit log" on public.audit_log as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_staff('admin'::text) AS is_staff));
create policy "edit own private profile" on public.profile_private as PERMISSIVE for UPDATE to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy "read own private profile" on public.profile_private as PERMISSIVE for SELECT to authenticated using ((id = ( SELECT auth.uid() AS uid)));
create policy "author or moderators read revisions" on public.listing_revisions as PERMISSIVE for SELECT to authenticated using (((author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('moderator'::text) AS is_staff)));
create policy "own downloads, support sees all" on public.download_events as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('support'::text) AS is_staff)));
create policy "edit own profile" on public.profiles as PERMISSIVE for UPDATE to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy "profiles are public" on public.profiles as PERMISSIVE for SELECT to anon,authenticated using (true);
create policy "creator deletes secrets" on public.product_secrets as PERMISSIVE for DELETE to authenticated using (( SELECT private.owns_product(product_secrets.product_id) AS owns_product));
create policy "creator edits secrets" on public.product_secrets as PERMISSIVE for UPDATE to authenticated using (( SELECT private.owns_product(product_secrets.product_id) AS owns_product)) with check (( SELECT private.owns_product(product_secrets.product_id) AS owns_product));
create policy "creator or buyer reads secrets" on public.product_secrets as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_read_secrets(product_secrets.product_id) AS can_read_secrets));
create policy "creator writes secrets" on public.product_secrets as PERMISSIVE for INSERT to authenticated with check (( SELECT private.owns_product(product_secrets.product_id) AS owns_product));
create policy "create own drafts" on public.listing_drafts as PERMISSIVE for INSERT to authenticated with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "delete own drafts" on public.listing_drafts as PERMISSIVE for DELETE to authenticated using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "edit own drafts" on public.listing_drafts as PERMISSIVE for UPDATE to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND ((published_product_id IS NULL) OR ( SELECT private.owns_product(listing_drafts.published_product_id) AS owns_product))));
create policy "own drafts" on public.listing_drafts as PERMISSIVE for SELECT to authenticated using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "create own products" on public.products as PERMISSIVE for INSERT to authenticated with check ((creator_id = ( SELECT auth.uid() AS uid)));
create policy "delete own unsold drafts" on public.products as PERMISSIVE for DELETE to authenticated using (((creator_id = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::product_status)));
create policy "edit own products" on public.products as PERMISSIVE for UPDATE to authenticated using ((creator_id = ( SELECT auth.uid() AS uid))) with check ((creator_id = ( SELECT auth.uid() AS uid)));
create policy "live, own or bought products" on public.products as PERMISSIVE for SELECT to anon,authenticated using ((((status = 'published'::product_status) AND (review_status = 'live'::text)) OR (creator_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_entitlement(products.id) AS has_entitlement)));
create policy "delete own upload" on public.product_files as PERMISSIVE for DELETE to authenticated using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "edit own upload" on public.product_files as PERMISSIVE for UPDATE to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND ((product_id IS NULL) OR ( SELECT private.owns_product(product_files.product_id) AS owns_product)) AND ((draft_id IS NULL) OR (EXISTS ( SELECT 1
   FROM listing_drafts d
  WHERE ((d.id = product_files.draft_id) AND (d.owner_id = ( SELECT auth.uid() AS uid))))))));
create policy "register own upload" on public.product_files as PERMISSIVE for INSERT to authenticated with check (((owner_id = ( SELECT auth.uid() AS uid)) AND ((product_id IS NULL) OR ( SELECT private.owns_product(product_files.product_id) AS owns_product)) AND ((draft_id IS NULL) OR (EXISTS ( SELECT 1
   FROM listing_drafts d
  WHERE ((d.id = product_files.draft_id) AND (d.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((thread_id IS NULL) OR ( SELECT private.is_thread_member(product_files.thread_id) AS is_thread_member)) AND ((job_id IS NULL) OR (EXISTS ( SELECT 1
   FROM hire_jobs j
  WHERE ((j.id = product_files.job_id) AND (j.creator_id = ( SELECT auth.uid() AS uid))))))));
create policy "see permitted files" on public.product_files as PERMISSIVE for SELECT to authenticated using (( SELECT private.file_visible(product_files.owner_id, product_files.product_id, product_files.thread_id, product_files.job_id, product_files.role) AS file_visible));
create policy "add options to own products" on public.product_options as PERMISSIVE for INSERT to authenticated with check (( SELECT private.owns_product(product_options.product_id) AS owns_product));
create policy "delete options of own products" on public.product_options as PERMISSIVE for DELETE to authenticated using (( SELECT private.owns_product(product_options.product_id) AS owns_product));
create policy "edit options of own products" on public.product_options as PERMISSIVE for UPDATE to authenticated using (( SELECT private.owns_product(product_options.product_id) AS owns_product)) with check (( SELECT private.owns_product(product_options.product_id) AS owns_product));
create policy "options of visible products" on public.product_options as PERMISSIVE for SELECT to anon,authenticated using (( SELECT private.product_visible(product_options.product_id) AS product_visible));
create policy "buyer opens thread" on public.chat_threads as PERMISSIVE for INSERT to authenticated with check (((buyer_id = ( SELECT auth.uid() AS uid)) AND (seller_id <> ( SELECT auth.uid() AS uid))));
create policy "members read thread" on public.chat_threads as PERMISSIVE for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = seller_id)));
create policy "edit own thread state" on public.chat_thread_state as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own thread state" on public.chat_thread_state as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "members read messages" on public.messages as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_thread_member(messages.thread_id) AS is_thread_member));
create policy "members send messages" on public.messages as PERMISSIVE for INSERT to authenticated with check (((sender_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.is_thread_member(messages.thread_id) AS is_thread_member)));
create policy "admins read the access log" on public.access_log as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_staff('admin'::text) AS is_staff));
create policy "service writes the access log" on public.access_log as PERMISSIVE for INSERT to service_role with check (true);
create policy "buyer asks refund" on public.refund_requests as PERMISSIVE for INSERT to authenticated with check ((buyer_id = ( SELECT auth.uid() AS uid)));
create policy "buyer or creator reads refund" on public.refund_requests as PERMISSIVE for SELECT to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR (creator_id = ( SELECT auth.uid() AS uid))));
create policy "mark own link click" on public.story_views as PERMISSIVE for UPDATE to authenticated using ((viewer_id = ( SELECT auth.uid() AS uid))) with check ((viewer_id = ( SELECT auth.uid() AS uid)));
create policy "own views or views of my stories" on public.story_views as PERMISSIVE for SELECT to authenticated using (((viewer_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM stories s
  WHERE ((s.id = story_views.story_id) AND (s.author_id = ( SELECT auth.uid() AS uid)) AND (s.created_at > (now() - '48:00:00'::interval)))))));
create policy "record own view" on public.story_views as PERMISSIVE for INSERT to authenticated with check (((viewer_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM stories s
  WHERE ((s.id = story_views.story_id) AND (s.expires_at > now()))))));
create policy "add favorite" on public.favorites as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.product_visible(favorites.product_id) AS product_visible)));
create policy "own favorites" on public.favorites as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "remove favorite" on public.favorites as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy follow on public.follows as PERMISSIVE for INSERT to authenticated with check ((follower_id = ( SELECT auth.uid() AS uid)));
create policy "own follow edges" on public.follows as PERMISSIVE for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = follower_id) OR (( SELECT auth.uid() AS uid) = creator_id)));
create policy unfollow on public.follows as PERMISSIVE for DELETE to authenticated using ((follower_id = ( SELECT auth.uid() AS uid)));
create policy "active coupons" on public.coupons as PERMISSIVE for SELECT to authenticated using ((active AND ((ends_at IS NULL) OR (ends_at > now()))));
create policy "delete own story" on public.stories as PERMISSIVE for DELETE to authenticated using ((author_id = ( SELECT auth.uid() AS uid)));
create policy "live stories are public" on public.stories as PERMISSIVE for SELECT to anon,authenticated using ((((expires_at > now()) AND (hidden_at IS NULL) AND (NOT private.hidden_author(author_id))) OR (author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('moderator'::text) AS is_staff)));
create policy "post own story" on public.stories as PERMISSIVE for INSERT to authenticated with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy "creator sends quote" on public.offers as PERMISSIVE for INSERT to authenticated with check (((creator_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.is_job_member(offers.job_id) AS is_job_member)));
create policy "parties answer quote" on public.offers as PERMISSIVE for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = creator_id))) with check (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = creator_id)));
create policy "quote parties read" on public.offers as PERMISSIVE for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = creator_id)));
create policy "add to own cart" on public.cart_items as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((product_id IS NULL) OR (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = cart_items.product_id) AND (p.status = 'published'::product_status) AND (p.creator_id <> ( SELECT auth.uid() AS uid)) AND ((p.sell_type <> 'hire'::sell_type) OR (cart_items.offer_id IS NOT NULL)))))) AND ((option_id IS NULL) OR (EXISTS ( SELECT 1
   FROM product_options o
  WHERE ((o.id = cart_items.option_id) AND (o.product_id = cart_items.product_id) AND o.enabled)))) AND ((offer_id IS NULL) OR (EXISTS ( SELECT 1
   FROM offers f
  WHERE ((f.id = cart_items.offer_id) AND (f.buyer_id = ( SELECT auth.uid() AS uid)) AND (f.status = 'accepted'::offer_status))))) AND ((tip_creator_id IS NULL) OR (tip_creator_id <> ( SELECT auth.uid() AS uid)))));
create policy "own cart" on public.cart_items as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "remove from own cart" on public.cart_items as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "add items to own open order" on public.order_items as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.buyer_id = ( SELECT auth.uid() AS uid)) AND (o.status = 'pending'::order_status) AND (o.charge_ref IS NULL)))));
create policy "buyer or seller reads items" on public.order_items as PERMISSIVE for SELECT to authenticated using (((creator_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.buyer_id = ( SELECT auth.uid() AS uid)))))));
create policy "own or sold entitlements" on public.entitlements as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.owns_product(entitlements.product_id) AS owns_product)));
create policy "creator reads own ledger" on public.ledger as PERMISSIVE for SELECT to authenticated using ((creator_id = ( SELECT auth.uid() AS uid)));
create policy "creator reads own payouts" on public.payouts as PERMISSIVE for SELECT to authenticated using ((creator_id = ( SELECT auth.uid() AS uid)));
create policy "buyers review" on public.reviews as PERMISSIVE for INSERT to authenticated with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy "delete own review" on public.reviews as PERMISSIVE for DELETE to authenticated using ((author_id = ( SELECT auth.uid() AS uid)));
create policy "edit own review" on public.reviews as PERMISSIVE for UPDATE to authenticated using ((author_id = ( SELECT auth.uid() AS uid))) with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy "reviews are public" on public.reviews as PERMISSIVE for SELECT to anon,authenticated using (true);
create policy "cancel own request" on public.account_requests as PERMISSIVE for DELETE to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'open'::text)));
create policy "file own request" on public.account_requests as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own requests" on public.account_requests as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "cancel own order" on public.orders as PERMISSIVE for UPDATE to authenticated using ((buyer_id = ( SELECT auth.uid() AS uid))) with check ((buyer_id = ( SELECT auth.uid() AS uid)));
create policy "own orders" on public.orders as PERMISSIVE for SELECT to authenticated using ((buyer_id = ( SELECT auth.uid() AS uid)));
create policy "place order" on public.orders as PERMISSIVE for INSERT to authenticated with check (((buyer_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::order_status)));
create policy "buyer opens job" on public.hire_jobs as PERMISSIVE for INSERT to authenticated with check (((buyer_id = ( SELECT auth.uid() AS uid)) AND (creator_id <> ( SELECT auth.uid() AS uid))));
create policy "job members move job" on public.hire_jobs as PERMISSIVE for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = creator_id))) with check (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = creator_id)));
create policy "job members read job" on public.hire_jobs as PERMISSIVE for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = creator_id)));
create policy "delete own notifications" on public.notifications as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "mark own notifications read" on public.notifications as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read own notifications" on public.notifications as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "accept own invite" on public.room_members as PERMISSIVE for UPDATE to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'invited'::text))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'joined'::text)));
create policy "invite a member" on public.room_members as PERMISSIVE for INSERT to authenticated with check (((user_id <> ( SELECT auth.uid() AS uid)) AND (status = 'invited'::text) AND (invited_by = ( SELECT auth.uid() AS uid))));
create policy "invites I sent" on public.room_members as PERMISSIVE for SELECT to authenticated using ((invited_by = ( SELECT auth.uid() AS uid)));
create policy "join room" on public.room_members as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "leave room" on public.room_members as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own memberships" on public.room_members as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "public group members" on public.room_members as PERMISSIVE for SELECT to anon,authenticated using (((status = 'joined'::text) AND (EXISTS ( SELECT 1
   FROM rooms r
  WHERE ((r.id = room_members.room_id) AND (r.privacy = 'public'::text))))));
create policy "delete own post" on public.posts as PERMISSIVE for DELETE to authenticated using ((author_id = ( SELECT auth.uid() AS uid)));
create policy "edit own post" on public.posts as PERMISSIVE for UPDATE to authenticated using ((author_id = ( SELECT auth.uid() AS uid))) with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy "visible or own posts" on public.posts as PERMISSIVE for SELECT to anon,authenticated using ((((status = 'visible'::text) AND (NOT private.hidden_author(author_id))) OR (author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('moderator'::text) AS is_staff)));
create policy "write own post" on public.posts as PERMISSIVE for INSERT to authenticated with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy "mention in own content" on public.mentions as PERMISSIVE for INSERT to authenticated with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy "mentions are public" on public.mentions as PERMISSIVE for SELECT to anon,authenticated using (((source_kind <> 'story'::text) OR (mentioned_id = ( SELECT auth.uid() AS uid)) OR (author_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM stories s
  WHERE ((s.id = mentions.source_id) AND (s.expires_at > now()))))));
create policy "remove own mention" on public.mentions as PERMISSIVE for DELETE to authenticated using ((author_id = ( SELECT auth.uid() AS uid)));
create policy "change own story reaction" on public.story_reactions as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own story reactions or on my stories" on public.story_reactions as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM stories s
  WHERE ((s.id = story_reactions.story_id) AND (s.author_id = ( SELECT auth.uid() AS uid)) AND (s.created_at > (now() - '48:00:00'::interval)))))));
create policy "react to a live story" on public.story_reactions as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM stories s
  WHERE ((s.id = story_reactions.story_id) AND (s.expires_at > now()) AND (s.author_id <> ( SELECT auth.uid() AS uid)))))));
create policy "remove own story reaction" on public.story_reactions as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "block someone" on public.user_blocks as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "change own block" on public.user_blocks as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "own blocks" on public.user_blocks as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy unblock on public.user_blocks as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "file a report" on public.reports as PERMISSIVE for INSERT to authenticated with check ((reporter_id = ( SELECT auth.uid() AS uid)));
create policy "own reports, moderators all" on public.reports as PERMISSIVE for SELECT to authenticated using (((reporter_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('moderator'::text) AS is_staff)));
create policy "own file scans, staff all" on public.scan_jobs as PERMISSIVE for SELECT to authenticated using (((EXISTS ( SELECT 1
   FROM product_files f
  WHERE ((f.id = scan_jobs.file_id) AND (f.owner_id = ( SELECT auth.uid() AS uid))))) OR ( SELECT private.is_staff('support'::text) AS is_staff)));
