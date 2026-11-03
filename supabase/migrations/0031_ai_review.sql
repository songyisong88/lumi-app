-- LUMI 0031: AI pre-moderation scaffolding for listing review (owner approved). DISABLED until the owner picks a provider.
-- Flow:  creator submits -> files pass virus scan (basic, + deep for programs) -> ai_review job -> verdict
--        approve      -> goes live automatically   (only when settings.ai_review.auto_approve = true)
--        reject       -> sent back with the reason  (only when settings.ai_review.auto_reject = true)
--        needs_human  -> stays in the LUMI team queue (moderation_queue())
-- With enabled=false (default) nothing is queued and every listing waits for a person, exactly as before.
-- Provider-agnostic: an outside worker (edge function / server) claims jobs with ai_review_claim() and reports with
-- ai_review_finish() using the service key. No API key lives in the database.

insert into private.settings (key, value) values
('ai_review', '{
  "enabled": false,
  "provider": null,
  "model": null,
  "auto_approve": false,
  "auto_reject": false,
  "min_confidence_approve": 0.9,
  "min_confidence_reject": 0.9,
  "reject_as": "needs_changes",
  "human_only_types": ["sw", "game", "bot", "hire"],
  "max_images": 3
}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.ai_reviews (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('product','revision')),
  target_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','done','error','skipped')),
  provider text check (char_length(provider) <= 40),
  model text check (char_length(model) <= 80),
  verdict text check (verdict in ('approve','reject','needs_human')),
  reason_code text check (char_length(reason_code) <= 60),
  reason text check (char_length(reason) <= 300),
  confidence numeric check (confidence between 0 and 1),
  categories jsonb not null default '{}' check (octet_length(categories::text) <= 8000),
  outcome text check (outcome in ('auto_approved','auto_rejected','needs_human','stale')),
  cost_usd numeric(10,6) check (cost_usd >= 0),
  attempts int not null default 0,
  worker text check (char_length(worker) <= 80),
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create unique index if not exists ai_reviews_one_open on public.ai_reviews (target_type, target_id) where status in ('queued','running');
create index if not exists ai_reviews_queue on public.ai_reviews (status, created_at) where status in ('queued','running','error');
create index if not exists ai_reviews_product on public.ai_reviews (product_id, created_at desc);
alter table public.ai_reviews enable row level security;
revoke all on public.ai_reviews from public, anon, authenticated;
grant select on public.ai_reviews to authenticated;
grant all on public.ai_reviews to service_role;
drop policy if exists "staff read ai reviews" on public.ai_reviews;
create policy "staff read ai reviews" on public.ai_reviews for select to authenticated using ((select private.is_staff('moderator')));

create or replace function private.ai_cfg() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(private.setting('ai_review'), '{"enabled": false}'::jsonb)
$$;

-- queue a review when something enters pending_review (only while enabled)
create or replace function private.ai_enqueue(p_type text, p_target uuid, p_product uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((private.ai_cfg() ->> 'enabled')::boolean, false) is not true then return; end if;
  insert into public.ai_reviews (target_type, target_id, product_id, provider, model)
    values (p_type, p_target, p_product, private.ai_cfg() ->> 'provider', private.ai_cfg() ->> 'model')
    on conflict do nothing;
end $$;
create or replace function private.ai_enqueue_product() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.review_status = 'pending_review' and new.status = 'published'
     and (tg_op = 'INSERT' or old.review_status is distinct from 'pending_review' or old.status is distinct from 'published'
          or old.submitted_at is distinct from new.submitted_at) then
    perform private.ai_enqueue('product', new.id, new.id);
  end if;
  return null;
end $$;
drop trigger if exists ai_enqueue on public.products;
create trigger ai_enqueue after insert or update on public.products for each row execute function private.ai_enqueue_product();
create or replace function private.ai_enqueue_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending_review' and (tg_op = 'INSERT' or old.status is distinct from 'pending_review') then
    perform private.ai_enqueue('revision', new.id, new.product_id);
  end if;
  return null;
end $$;
drop trigger if exists ai_enqueue on public.listing_revisions;
create trigger ai_enqueue after insert or update of status on public.listing_revisions for each row execute function private.ai_enqueue_revision();

-- files of the thing under review
create or replace function private.ai_target_files(p_type text, p_target uuid) returns setof public.product_files
language sql stable security definer set search_path = '' as $$
  select f.* from public.product_files f where f.role = 'deliverable' and (
    (p_type = 'product' and f.product_id = p_target)
    or (p_type = 'revision' and f.id = any ((select r.file_ids from public.listing_revisions r where r.id = p_target)::uuid[])))
$$;
-- AI runs only after every file passed the virus scan (basic ok + deep where required)
create or replace function private.ai_scans_ready(p_type text, p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from private.ai_target_files(p_type, p_target) f where f.scan <> 'ok' or not private.file_deep_ok(f.id))
$$;
-- still waiting for a decision?
create or replace function private.ai_still_pending(p_type text, p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'product' then exists (select 1 from public.products p where p.id = p_target and p.review_status = 'pending_review' and p.status = 'published')
    else exists (select 1 from public.listing_revisions r where r.id = p_target and r.status = 'pending_review') end
$$;

-- worker: claim the next job whose files are scanned; returns what a model needs (text + public cover image paths)
create or replace function private.ai_review_claim(p_worker text)
returns table (job_id uuid, target_type text, target_id uuid, product_id uuid, listing jsonb)
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- worker: report a verdict; LUMI decides what to do with it from settings.ai_review
create or replace function private.ai_review_finish(p_job uuid, p_verdict text, p_reason_code text, p_reason text, p_confidence numeric,
  p_categories jsonb, p_provider text, p_model text, p_cost_usd numeric, p_error text) returns text
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- staff: what still needs a person, with the AI's opinion next to it (auto-decided items are no longer pending)
create or replace function private.moderation_queue(p_limit int, p_before timestamptz)
returns table (target_type text, target_id uuid, product_id uuid, title text, sell_type text, creator_id uuid, submitted_at timestamptz,
               ai_verdict text, ai_reason text, ai_confidence numeric, open_reports bigint)
language plpgsql stable security definer set search_path = '' as $$
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
end $$;

-- service: when the owner turns AI on, queue everything already waiting
create or replace function private.ai_review_backfill() returns int
language plpgsql security definer set search_path = '' as $$
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
end $$;

create or replace function public.ai_review_claim(p_worker text default null)
returns table (job_id uuid, target_type text, target_id uuid, product_id uuid, listing jsonb)
language sql set search_path = '' as $$ select * from private.ai_review_claim(p_worker) $$;
create or replace function public.ai_review_finish(p_job uuid, p_verdict text default null, p_reason_code text default null, p_reason text default null,
  p_confidence numeric default null, p_categories jsonb default null, p_provider text default null, p_model text default null,
  p_cost_usd numeric default null, p_error text default null) returns text
language sql set search_path = '' as $$ select private.ai_review_finish(p_job, p_verdict, p_reason_code, p_reason, p_confidence, p_categories, p_provider, p_model, p_cost_usd, p_error) $$;
create or replace function public.moderation_queue(p_limit int default 50, p_before timestamptz default null)
returns table (target_type text, target_id uuid, product_id uuid, title text, sell_type text, creator_id uuid, submitted_at timestamptz,
               ai_verdict text, ai_reason text, ai_confidence numeric, open_reports bigint)
language sql stable set search_path = '' as $$ select * from private.moderation_queue(p_limit, p_before) $$;
create or replace function public.ai_review_backfill() returns int
language sql set search_path = '' as $$ select private.ai_review_backfill() $$;

-- decide_internal: identical to 0015/0017 except an actor role set by the caller (e.g. 'ai_review') is kept in the audit log
create or replace function private.decide_internal(p_target uuid, p_decision text, p_code text, p_note text, p_test boolean)
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
end $function$;

revoke execute on function private.ai_cfg(), private.ai_enqueue(text, uuid, uuid), private.ai_enqueue_product(), private.ai_enqueue_revision(),
  private.ai_target_files(text, uuid), private.ai_scans_ready(text, uuid), private.ai_still_pending(text, uuid),
  private.ai_review_claim(text), private.ai_review_finish(uuid, text, text, text, numeric, jsonb, text, text, numeric, text),
  private.moderation_queue(int, timestamptz), private.ai_review_backfill() from public, anon, authenticated;
grant execute on function private.moderation_queue(int, timestamptz), private.ai_review_backfill() to authenticated;
grant execute on function private.ai_review_claim(text), private.ai_review_finish(uuid, text, text, text, numeric, jsonb, text, text, numeric, text),
  private.ai_review_backfill() to service_role;
revoke execute on function public.ai_review_claim(text), public.ai_review_finish(uuid, text, text, text, numeric, jsonb, text, text, numeric, text),
  public.moderation_queue(int, timestamptz), public.ai_review_backfill() from public, anon, authenticated;
grant execute on function public.ai_review_claim(text), public.ai_review_finish(uuid, text, text, text, numeric, jsonb, text, text, numeric, text),
  public.ai_review_backfill() to service_role;
grant execute on function public.moderation_queue(int, timestamptz), public.ai_review_backfill() to authenticated;
