-- LUMI 0015: moderation hardening from the reviewer plan (backend-plan.md §1, §4, §5, §8)
--  * listing review states: pending_review / needs_changes / rejected / live (products.review_status)
--  * creators can never self-publish or skip re-review: guards on products, product_secrets, product_files
--  * live-listing edits become listing_revisions; the old version keeps selling until a moderator approves
--  * admin_roles (server table; roles are never read from user-editable metadata) + private.is_staff()
--  * append-only audit_log
--  * downloads only through the get-download edge function: 10-minute signed URLs + download_events
--  * a refund revokes the entitlement at once (answer_refund) and the next download is refused
-- Not decided here (backend-plan §10, waiting for the owner): money structure, file caps, course/subscription/hire/data scope.

-- ---------- review states
alter table public.products drop constraint if exists products_review_status_check;
update public.products set review_status = 'pending_review' where review_status = 'pending';
alter table public.products alter column review_status set default 'pending_review';
alter table public.products add constraint products_review_status_check
  check (review_status in ('pending_review','needs_changes','rejected','live'));
alter type public.notif_kind add value if not exists 'moderation';
alter type public.notif_kind add value if not exists 'payout';
alter type public.notif_kind add value if not exists 'refund';

-- ---------- staff roles
create table if not exists public.admin_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('moderator','support','finance','admin')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.admin_roles enable row level security;
revoke all on public.admin_roles from public, anon, authenticated;
grant select on public.admin_roles to authenticated;
grant all on public.admin_roles to service_role;
insert into public.admin_roles (user_id, role) select user_id, 'moderator' from private.moderators on conflict do nothing;

create or replace function private.is_staff(p_role text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_roles r where r.user_id = auth.uid()
                 and (p_role is null or r.role = p_role or r.role = 'admin'))
$$;
create or replace function private.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$ select private.is_staff('moderator') $$;
create or replace function private.staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(role, ',' order by role) from public.admin_roles where user_id = auth.uid()
$$;
create policy "own roles, admins see all" on public.admin_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff('admin')));

-- ---------- append-only audit log
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  target_type text not null,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_target on public.audit_log (target_type, target_id, created_at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated, service_role;
grant select on public.audit_log to authenticated, service_role;
create policy "admins read the audit log" on public.audit_log for select to authenticated using ((select private.is_staff('admin')));

create or replace function private.audit_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'audit_log is append-only' using errcode = '42501'; end $$;
drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update before update or delete on public.audit_log for each row execute function private.audit_immutable();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function private.audit_immutable();

create or replace function private.audit(p_action text, p_type text, p_id text, p_before jsonb default null, p_after jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, target_type, target_id, before, after)
  values (auth.uid(),
          coalesce(nullif(current_setting('lumi.actor_role', true), ''), private.staff_role(),
                   case when private.is_service() then 'system' when auth.uid() is null then 'system' else 'user' end),
          p_action, p_type, p_id, p_before, p_after);
end $$;

-- ---------- listing revisions (edits of an approved listing)
create table if not exists public.listing_revisions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  draft_id uuid references public.listing_drafts(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  file_ids uuid[] not null default '{}',
  status text not null default 'pending_review' check (status in ('pending_review','approved','needs_changes','rejected','withdrawn')),
  submitted_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  reason_code text check (char_length(reason_code) <= 60),
  reason_note text check (char_length(reason_note) <= 300)
);
create index if not exists listing_revisions_product on public.listing_revisions (product_id, submitted_at desc);
create index if not exists listing_revisions_pending on public.listing_revisions (submitted_at) where status = 'pending_review';
create index if not exists listing_revisions_draft on public.listing_revisions (draft_id);
create index if not exists listing_revisions_author on public.listing_revisions (author_id);
alter table public.listing_revisions enable row level security;
revoke all on public.listing_revisions from public, anon, authenticated;
grant select on public.listing_revisions to authenticated;
grant all on public.listing_revisions to service_role;
create policy "author or moderators read revisions" on public.listing_revisions for select to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff('moderator')));

-- ---------- guards: an approved listing's content, secrets and files change only through an approved revision
create or replace function private.products_review() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;

create or replace function private.approved_listing(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_product is not null and exists (select 1 from public.products where id = p_product and review_status = 'live')
$$;

create or replace function private.secrets_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.bypass() then return coalesce(new, old); end if;
  if private.approved_listing(coalesce(new.product_id, old.product_id))
     and (tg_op <> 'UPDATE' or new.data is distinct from old.data) then
    raise exception 'EDIT_NEEDS_REVIEW' using errcode = '42501', hint = 'พรอมต์/ลิงก์ของผลงานที่ขายอยู่ เปลี่ยนได้ผ่านการส่งตรวจเท่านั้น';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists product_secrets_guard on public.product_secrets;
create trigger product_secrets_guard before insert or update or delete on public.product_secrets for each row execute function private.secrets_guard();

create or replace function private.files_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.bypass() then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and new.role = 'deliverable' and private.approved_listing(new.product_id)
     or tg_op = 'UPDATE' and new.product_id is distinct from old.product_id
        and ((old.role = 'deliverable' and private.approved_listing(old.product_id)) or (new.role = 'deliverable' and private.approved_listing(new.product_id)))
     or tg_op = 'DELETE' and old.role = 'deliverable' and private.approved_listing(old.product_id) then
    raise exception 'EDIT_NEEDS_REVIEW' using errcode = '42501', hint = 'ไฟล์ของผลงานที่ขายอยู่ เปลี่ยนได้ผ่านการส่งตรวจเท่านั้น';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists product_files_guard on public.product_files;
create trigger product_files_guard before insert or update or delete on public.product_files for each row execute function private.files_guard();

-- a creator submission always waits for review (only for the caller's own, not-yet-approved listing)
create or replace function private.mark_submitted(p_product uuid, p_draft uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.set_bypass(true);
  update public.products set review_status = 'pending_review', review_reason = null, submitted_at = now()
    where id = p_product and creator_id = auth.uid() and review_status <> 'live';
  get diagnostics n = row_count;
  perform private.set_bypass(false);
  if n > 0 then perform private.audit('listing.submitted', 'product', p_product::text, null, jsonb_build_object('draft', p_draft)); end if;
end $$;

-- publish_listing: first publish / re-submit of a listing that is not approved yet. Approved listings go through submit_edit.
create or replace function public.publish_listing(p_draft uuid, p_share boolean default false, p_notify boolean default false) returns uuid
language plpgsql set search_path = '' as $$
declare d public.listing_drafts; pid uuid; o jsonb; i int := 0; me uuid := auth.uid(); lbl text; codes text[] := '{}'; reached int := 0; tname text;
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
  update public.products set status = 'published' where id = pid;     -- server-side auto-check runs here (LISTING_INCOMPLETE)
  if not private.bypass() then perform private.mark_submitted(pid, d.id); end if;   -- every creator submission waits for review
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

-- submit_edit: snapshot the draft as a revision. Later draft changes do not leak into the approved version.
create or replace function private.submit_edit(p_draft uuid) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- apply an approved revision to the live product (trusted code only)
create or replace function private.apply_revision(p_rev uuid) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- decide one review item. p_target = product id (first review) or revision id (edit). p_decision: approve | needs_changes | reject
create or replace function private.decide_internal(p_target uuid, p_decision text, p_code text, p_note text, p_test boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.products; r public.listing_revisions; t text; st text; why text := left(coalesce(nullif(btrim(p_note), ''), nullif(btrim(p_code), ''), 'ไม่ผ่านการตรวจ'), 300);
begin
  if p_decision not in ('approve','needs_changes','reject') then raise exception 'bad decision' using errcode = '22023'; end if;
  if not p_test and not private.is_staff('moderator') then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_test then perform set_config('lumi.actor_role', 'test_auto_review', true); end if;
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
end $$;

create or replace function private.decide_listing(p_target uuid, p_decision text, p_code text, p_note text) returns text
language sql security definer set search_path = '' as $$ select private.decide_internal(p_target, p_decision, p_code, p_note, false) $$;

-- finish_review: kept for the app. Moderators decide; in TEST MODE ONLY (setting test_auto_review_seconds) the
-- server itself passes a submission after N seconds, logged in audit_log as actor_role = test_auto_review.
create or replace function private.finish_review(p_product uuid, p_draft uuid, p_pass boolean, p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- staff RPCs
create or replace function public.approve_listing(p_target uuid) returns text
language sql set search_path = '' as $$ select private.decide_listing(p_target, 'approve', null, null) $$;
create or replace function public.request_changes(p_target uuid, p_reason_code text, p_note text default null) returns text
language sql set search_path = '' as $$ select private.decide_listing(p_target, 'needs_changes', p_reason_code, p_note) $$;
create or replace function public.reject_listing(p_target uuid, p_reason_code text, p_note text default null) returns text
language sql set search_path = '' as $$ select private.decide_listing(p_target, 'reject', p_reason_code, p_note) $$;

create or replace function private.set_staff_role(p_user uuid, p_role text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff('admin') and not private.is_service() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_on then
    insert into public.admin_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) on conflict do nothing;
  else
    delete from public.admin_roles where user_id = p_user and role = p_role;
  end if;
end $$;
create or replace function public.set_staff_role(p_user uuid, p_role text, p_on boolean) returns void
language sql set search_path = '' as $$ select private.set_staff_role(p_user, p_role, p_on) $$;

-- ---------- audit triggers
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
drop trigger if exists audit_products on public.products;
create trigger audit_products after update on public.products for each row execute function private.audit_row();
drop trigger if exists audit_admin_roles on public.admin_roles;
create trigger audit_admin_roles after insert or delete on public.admin_roles for each row execute function private.audit_row();
drop trigger if exists audit_entitlements on public.entitlements;
create trigger audit_entitlements after update on public.entitlements for each row execute function private.audit_row();
drop trigger if exists audit_refunds on public.refund_requests;
create trigger audit_refunds after insert or update on public.refund_requests for each row execute function private.audit_row();
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after update on public.orders for each row execute function private.audit_row();
drop trigger if exists audit_account_requests on public.account_requests;
create trigger audit_account_requests after insert on public.account_requests for each row execute function private.audit_row();

-- ---------- downloads: only via the get-download edge function (10-minute signed URL, logged)
create table if not exists public.download_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  file_id uuid not null,
  product_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists download_events_user on public.download_events (user_id, created_at desc);
alter table public.download_events enable row level security;
revoke all on public.download_events from public, anon, authenticated;
grant select on public.download_events to authenticated;
grant all on public.download_events to service_role;
create policy "own downloads, support sees all" on public.download_events for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff('support')));

-- checks the caller's right to a file right now (entitlement not revoked, scan ok) and logs the download
create or replace function private.download_check(p_file uuid) returns table (bucket text, path text, name text)
language plpgsql security definer set search_path = '' as $$
declare f public.product_files;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into f from public.product_files where id = p_file;
  if not found or f.bucket <> 'deliverables' or not private.can_download(f.bucket, f.path) then
    raise exception 'no access to this file' using errcode = '42501';
  end if;
  insert into public.download_events (user_id, file_id, product_id) values (auth.uid(), f.id, f.product_id);
  return query select f.bucket, f.path, f.name;
end $$;
create or replace function public.download_check(p_file uuid) returns table (bucket text, path text, name text)
language sql set search_path = '' as $$ select * from private.download_check(p_file) $$;

drop policy if exists "deliverables: entitled download" on storage.objects;   -- no client-made signed URLs; the edge function signs for 10 minutes

-- ---------- permissions
revoke execute on function private.is_staff(text), private.staff_role(), private.audit(text, text, text, jsonb, jsonb), private.audit_immutable(),
  private.approved_listing(uuid), private.secrets_guard(), private.files_guard(), private.apply_revision(uuid),
  private.decide_internal(uuid, text, text, text, boolean), private.decide_listing(uuid, text, text, text), private.mark_submitted(uuid, uuid),
  private.set_staff_role(uuid, text, boolean), private.audit_row(), private.download_check(uuid) from public, anon;
grant execute on function private.is_staff(text), private.staff_role(), private.approved_listing(uuid),
  private.decide_listing(uuid, text, text, text), private.mark_submitted(uuid, uuid), private.set_staff_role(uuid, text, boolean), private.download_check(uuid) to authenticated;
revoke execute on function private.audit(text, text, text, jsonb, jsonb), private.apply_revision(uuid), private.audit_row(), private.decide_internal(uuid, text, text, text, boolean),
  private.secrets_guard(), private.files_guard(), private.audit_immutable() from authenticated;
revoke execute on function public.approve_listing(uuid), public.request_changes(uuid, text, text), public.reject_listing(uuid, text, text),
  public.set_staff_role(uuid, text, boolean), public.download_check(uuid) from public, anon;
grant execute on function public.approve_listing(uuid), public.request_changes(uuid, text, text), public.reject_listing(uuid, text, text),
  public.set_staff_role(uuid, text, boolean), public.download_check(uuid) to authenticated, service_role;
