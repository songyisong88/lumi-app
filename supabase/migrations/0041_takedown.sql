-- 0041 takedown notices + counter-notices
--  * Copyright Act s.43/6 (notice: (1) name/address/phone/email (2) the work (3) the infringing data + where it is
--    (4) statement that it is true (5) signature) -> remove / block "without delay" and tell the poster so they can object
--  * s.43/7 (counter-notice: (1) contact details (2) what was removed + where (3) why it was a mistake (4) signature)
--    -> send a copy to the owner quickly, say it comes back 30 days after the counter-notice, then restore within 15 days
--    unless the owner shows a lawsuit was filed
--  * Computer Crimes Act s.15 + MDES notice 2560 clause 5 (complaint form: complainant, content, harm, statement of truth;
--    act within 7 days s.14(1) / 24 h s.14(2)(3) / 3 days s.14(4); poster may object)
-- Hooked into the existing moderation: every notice also opens a 'system' report on the same target (shows in the reports
-- queue and in moderation_queue.open_reports); every step is in audit_log; submit IP goes to access_log.
-- No front-end change on the real site (UI is a DEMO draft only). ⚖️ deadlines / wording: lawyer to confirm.

create table if not exists public.takedown_notices (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  kind text not null check (kind in ('copyright','s14_1','s14_2_3','s14_4','other')),
  target_type text not null check (target_type in ('post','comment','story','product','review','profile','other')),
  target_id text check (char_length(target_id) <= 64),
  target_url text check (char_length(target_url) <= 500),
  target_owner uuid,                         -- no FK: keep the record if the account is deleted
  notifier_user uuid,                        -- set when the notifier was signed in
  notifier_name text not null check (char_length(notifier_name) between 2 and 200),
  notifier_org text check (char_length(notifier_org) <= 200),
  notifier_address text not null check (char_length(notifier_address) between 5 and 500),
  notifier_phone text not null check (char_length(notifier_phone) between 6 and 30),
  notifier_email text not null check (notifier_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(notifier_email) <= 200),
  on_behalf_of text check (char_length(on_behalf_of) <= 200),          -- agent filing for the owner
  work_desc text not null check (char_length(work_desc) between 5 and 2000),        -- the work / the right claimed
  work_url text check (char_length(work_url) <= 500),
  content_desc text not null check (char_length(content_desc) between 5 and 2000),  -- what is wrong + where
  harm_desc text check (char_length(harm_desc) <= 2000),
  truth_statement boolean not null check (truth_statement),
  signature text not null check (char_length(signature) between 2 and 200),         -- typed full name = e-signature
  submit_ip inet,
  status text not null default 'received' check (status in
    ('received','incomplete','content_hidden','counter_received','restored','removed','rejected','withdrawn')),
  respond_by timestamptz not null,
  hidden_at timestamptz,
  prev_state jsonb,                          -- what to put back on restore
  owner_notified_at timestamptz,
  counter_at timestamptz,
  counter_forwarded_at timestamptz,
  restore_after timestamptz,                 -- counter + 30 days
  restore_by timestamptz,                    -- restore_after + 15 days
  lawsuit_at timestamptz,
  lawsuit_note text check (char_length(lawsuit_note) <= 1000),
  report_id uuid,
  handled_by uuid,
  handled_at timestamptz,
  admin_note text check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists takedown_status on public.takedown_notices (status, respond_by);
create index if not exists takedown_target on public.takedown_notices (target_type, target_id);
create index if not exists takedown_owner on public.takedown_notices (target_owner);
create index if not exists takedown_ip on public.takedown_notices (submit_ip, created_at);

create table if not exists public.takedown_counters (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.takedown_notices(id) on delete cascade,
  user_id uuid not null,
  name text not null check (char_length(name) between 2 and 200),
  address text not null check (char_length(address) between 5 and 500),
  phone text not null check (char_length(phone) between 6 and 30),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  reason text not null check (char_length(reason) between 10 and 3000),   -- why the removal was a mistake
  signature text not null check (char_length(signature) between 2 and 200),
  submit_ip inet,
  created_at timestamptz not null default now(),
  unique (notice_id)
);

alter table public.takedown_notices enable row level security;
alter table public.takedown_counters enable row level security;
revoke all on public.takedown_notices, public.takedown_counters from public, anon, authenticated;
grant select on public.takedown_notices, public.takedown_counters to authenticated;
drop policy if exists "moderators read notices" on public.takedown_notices;
create policy "moderators read notices" on public.takedown_notices for select to authenticated using ((select private.is_staff('moderator')));
drop policy if exists "moderators read counters" on public.takedown_counters;
create policy "moderators read counters" on public.takedown_counters for select to authenticated using ((select private.is_staff('moderator')));

insert into private.settings (key, value) values ('takedown',
  '{"auto_hide_kinds": ["copyright"], "per_ip_hour": 5, "anon_hour": 30, "counter_wait_days": 30, "restore_within_days": 15}'::jsonb)
on conflict (key) do nothing;

-- hide / show the target; product: unpublish (remember the previous status)
create or replace function private.takedown_set_hidden(n public.takedown_notices, p_hidden boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i uuid; st text;
begin
  begin i := n.target_id::uuid; exception when others then return null; end;
  if n.target_type in ('post','comment','story') then
    if private.set_content_hidden(n.target_type, n.target_id, p_hidden) then return jsonb_build_object('hidden', p_hidden); end if;
    return null;
  elsif n.target_type = 'product' then
    perform private.set_bypass(true);
    if p_hidden then
      select status::text into st from public.products where id = i;
      update public.products set status = 'unpublished' where id = i and status = 'published';
      perform private.set_bypass(false);
      return case when st = 'published' then jsonb_build_object('product_status', st) end;
    else
      if coalesce(n.prev_state ->> 'product_status', '') = 'published' then
        update public.products set status = 'published' where id = i and status = 'unpublished';
      end if;
      perform private.set_bypass(false);
      return jsonb_build_object('product_status', 'published');
    end if;
  end if;
  return null;   -- review / profile / other: handled by hand
end $$;

create or replace function private.takedown_notify_staff(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  for u in select distinct user_id from public.admin_roles where role in ('admin','moderator') loop
    perform private.notify(u, 'moderation', p_text, '#/admin', null, null);
  end loop;
end $$;

-- public form (guests too). Returns the reference number. p_test = true checks everything, then rolls back.
create or replace function public.submit_takedown(p jsonb, p_test boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cfg jsonb := coalesce(private.setting('takedown'), '{}'::jsonb);
        ip inet := private.client_ip(); k text := coalesce(p ->> 'kind', 'copyright');
        tt text := coalesce(nullif(p ->> 'target_type', ''), 'other'); tid text := nullif(btrim(p ->> 'target_id'), '');
        url text := left(nullif(btrim(p ->> 'target_url'), ''), 500); owner uuid; n public.takedown_notices; r uuid; st jsonb; c int;
begin
  -- throttle: per IP and for all guests together
  select count(*) into c from public.takedown_notices where created_at > now() - interval '1 hour' and submit_ip is not distinct from ip;
  if c >= coalesce((cfg ->> 'per_ip_hour')::int, 5) then raise exception 'RATE_LIMITED' using errcode = 'P0001', hint = 'ส่งคำร้องถี่เกินไป กรุณารอสักครู่'; end if;
  if auth.uid() is null then
    select count(*) into c from public.takedown_notices where created_at > now() - interval '1 hour' and notifier_user is null;
    if c >= coalesce((cfg ->> 'anon_hour')::int, 30) then raise exception 'RATE_LIMITED' using errcode = 'P0001', hint = 'ระบบรับคำร้องเต็มชั่วคราว กรุณาลองใหม่ภายหลังหรือติดต่ออีเมล'; end if;
  end if;
  if tid is null and url is not null then   -- find the item from a pasted link (first uuid in it)
    tid := substring(url from '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');
    if tid is not null and tt = 'other' then
      select x.t into tt from (values ('product'),('post'),('story'),('comment'),('review'),('profile')) x(t)
       where private.report_target_owner(x.t, tid) is not null limit 1;
      tt := coalesce(tt, 'other');
    end if;
  end if;
  if tt <> 'other' then
    owner := private.report_target_owner(tt, tid);
    if owner is null then raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001', hint = 'ไม่พบเนื้อหาจากลิงก์นี้ กรุณาตรวจลิงก์อีกครั้ง'; end if;
  elsif url is null then
    raise exception 'TARGET_REQUIRED' using errcode = 'P0001', hint = 'กรุณาใส่ลิงก์ของเนื้อหาที่ต้องการแจ้งลบ';
  end if;
  insert into public.takedown_notices (ref, kind, target_type, target_id, target_url, target_owner, notifier_user,
      notifier_name, notifier_org, notifier_address, notifier_phone, notifier_email, on_behalf_of, work_desc, work_url,
      content_desc, harm_desc, truth_statement, signature, submit_ip, respond_by)
  values ('TD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), k, tt, tid, url, owner, auth.uid(),
      btrim(p ->> 'name'), nullif(btrim(p ->> 'org'), ''), btrim(p ->> 'address'), btrim(p ->> 'phone'), lower(btrim(p ->> 'email')),
      nullif(btrim(p ->> 'on_behalf_of'), ''), btrim(p ->> 'work'), left(nullif(btrim(p ->> 'work_url'), ''), 500),
      btrim(p ->> 'content'), nullif(btrim(p ->> 'harm'), ''), coalesce((p ->> 'truth')::boolean, false), btrim(p ->> 'signature'), ip,
      now() + case k when 's14_1' then interval '7 days' when 's14_4' then interval '3 days' when 'other' then interval '7 days' else interval '24 hours' end)
  returning * into n;
  -- open a 'system' report so it shows in the existing moderation queue
  if tt in ('post','comment','story','product','profile','review') then
    perform private.set_bypass(true);
    insert into public.reports (reporter_id, source, target_type, target_id, target_owner, reason, details)
    values (null, 'system', tt, tid, owner, left('แจ้งลบ ' || n.ref || ' (' || k || ')', 120), left(n.content_desc, 1000)) returning id into r;
    perform private.set_bypass(false);
    update public.takedown_notices set report_id = r where id = n.id;
  end if;
  -- copyright: block without delay, tell the poster they can object
  if k = any (array(select jsonb_array_elements_text(coalesce(cfg -> 'auto_hide_kinds', '["copyright"]'::jsonb)))) then
    st := private.takedown_set_hidden(n, true);
    if st is not null then
      update public.takedown_notices set status = 'content_hidden', hidden_at = now(), prev_state = st,
        owner_notified_at = case when owner is not null then now() end where id = n.id;
      perform private.notify(owner, 'moderation',
        'เนื้อหาของคุณถูกระงับชั่วคราว เพราะมีผู้แจ้งว่าละเมิดลิขสิทธิ์ (' || n.ref || ') ถ้าคุณเห็นว่าไม่ถูกต้อง ส่งคำโต้แย้งได้',
        '#/takedown/' || n.ref, null, null);
    end if;
  end if;
  perform private.audit('takedown.received', tt, coalesce(tid, n.ref), null,
    jsonb_build_object('ref', n.ref, 'kind', k, 'auto_hidden', st is not null));
  perform private.log_access('takedown.submit', 'takedown', n.ref, jsonb_build_object('kind', k), 'db');
  perform private.takedown_notify_staff('มีคำร้องแจ้งลบใหม่ ' || n.ref || ' ต้องตอบภายใน ' || to_char(n.respond_by at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'));
  if p_test then
    raise exception 'TEST_ONLY' using errcode = 'P0001', hint = 'ok; your ip seen by the server = ' || coalesce(host(ip), 'none') || '; nothing was saved';
  end if;
  return jsonb_build_object('ref', n.ref, 'respond_by', n.respond_by,
    'status', (select status from public.takedown_notices where id = n.id));
end $$;
revoke execute on function public.submit_takedown(jsonb, boolean) from public;
grant execute on function public.submit_takedown(jsonb, boolean) to anon, authenticated;

-- notifier checks progress with reference + email (no personal data returned)
create or replace function public.takedown_status(p_ref text, p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ref', ref, 'status', status, 'received_at', created_at, 'counter_at', counter_at, 'restore_after', restore_after)
  from public.takedown_notices where ref = upper(btrim(p_ref)) and notifier_email = lower(btrim(p_email))
$$;
revoke execute on function public.takedown_status(text, text) from public;
grant execute on function public.takedown_status(text, text) to anon, authenticated;

-- the poster: what was taken down (no notifier phone / address; name + work + reason are shown so they can answer)
create or replace function public.my_takedowns() returns table (ref text, kind text, target_type text, target_id text, status text,
  work_desc text, content_desc text, notifier text, created_at timestamptz, counter_at timestamptz, restore_after timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.ref, t.kind, t.target_type, t.target_id, t.status, t.work_desc, t.content_desc,
         coalesce(t.notifier_org, t.notifier_name), t.created_at, t.counter_at, t.restore_after
  from public.takedown_notices t where t.target_owner = auth.uid() and auth.uid() is not null
  order by t.created_at desc limit 50
$$;
revoke execute on function public.my_takedowns() from public, anon;
grant execute on function public.my_takedowns() to authenticated;

-- the poster objects (s.43/7)
create or replace function public.submit_counter_notice(p_ref text, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n public.takedown_notices; cfg jsonb := coalesce(private.setting('takedown'), '{}'::jsonb);
        wait int := coalesce((cfg ->> 'counter_wait_days')::int, 30); within int := coalesce((cfg ->> 'restore_within_days')::int, 15);
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform private.throttle('report');
  select * into n from public.takedown_notices where ref = upper(btrim(p_ref)) for update;
  if n.id is null or n.target_owner is distinct from auth.uid() then raise exception 'NOT_FOUND' using errcode = 'P0001', hint = 'ไม่พบคำร้องนี้'; end if;
  if n.status not in ('received','content_hidden','incomplete') then
    raise exception 'CLOSED' using errcode = 'P0001', hint = 'คำร้องนี้ปิดแล้วหรือส่งคำโต้แย้งไปแล้ว';
  end if;
  if not coalesce((p ->> 'truth')::boolean, false) then raise exception 'TRUTH_REQUIRED' using errcode = 'P0001', hint = 'กรุณายืนยันว่าข้อมูลเป็นความจริง'; end if;
  insert into public.takedown_counters (notice_id, user_id, name, address, phone, email, reason, signature, submit_ip)
  values (n.id, auth.uid(), btrim(p ->> 'name'), btrim(p ->> 'address'), btrim(p ->> 'phone'), lower(btrim(p ->> 'email')),
          btrim(p ->> 'reason'), btrim(p ->> 'signature'), private.client_ip());
  update public.takedown_notices set status = 'counter_received', counter_at = now(),
    restore_after = case when kind = 'copyright' then now() + make_interval(days => wait) end,
    restore_by = case when kind = 'copyright' then now() + make_interval(days => wait + within) end, updated_at = now()
  where id = n.id;
  perform private.audit('takedown.counter', n.target_type, coalesce(n.target_id, n.ref), null, jsonb_build_object('ref', n.ref));
  perform private.log_access('takedown.counter', 'takedown', n.ref, null, 'db');
  perform private.takedown_notify_staff('มีคำโต้แย้ง ' || n.ref || ' ส่งสำเนาให้ผู้แจ้งโดยเร็ว');
  return jsonb_build_object('ref', n.ref, 'status', 'counter_received',
    'restore_after', case when n.kind = 'copyright' then now() + make_interval(days => wait) end);
end $$;
revoke execute on function public.submit_counter_notice(text, jsonb) from public, anon;
grant execute on function public.submit_counter_notice(text, jsonb) to authenticated;

-- moderators: the takedown queue (oldest deadline first; flags what is due)
create or replace function public.takedown_queue(p_status text default null, p_limit int default 50)
returns table (id uuid, ref text, kind text, status text, target_type text, target_id text, target_url text, target_owner uuid,
  notifier_name text, notifier_org text, notifier_email text, notifier_phone text, work_desc text, content_desc text, harm_desc text,
  created_at timestamptz, respond_by timestamptz, hidden_at timestamptz, counter_at timestamptz, counter_forwarded_at timestamptz,
  restore_after timestamptz, restore_by timestamptz, lawsuit_at timestamptz, overdue boolean, next_step text,
  counter_name text, counter_email text, counter_reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff('moderator') then raise exception 'moderators only' using errcode = '42501'; end if;
  return query
  select t.id, t.ref, t.kind, t.status, t.target_type, t.target_id, t.target_url, t.target_owner, t.notifier_name, t.notifier_org,
         t.notifier_email, t.notifier_phone, t.work_desc, t.content_desc, t.harm_desc, t.created_at, t.respond_by, t.hidden_at,
         t.counter_at, t.counter_forwarded_at, t.restore_after, t.restore_by, t.lawsuit_at,
         (t.status in ('received','incomplete') and now() > t.respond_by) or (t.status = 'counter_received' and t.restore_by is not null and now() > t.restore_by),
         case
           when t.status in ('received','incomplete') then 'ตรวจคำร้องแล้วระงับ หรือปฏิเสธ'
           when t.status = 'content_hidden' then 'รอผู้โพสต์โต้แย้ง หรือยืนยันลบถาวร'
           when t.status = 'counter_received' and t.counter_forwarded_at is null then 'ส่งสำเนาคำโต้แย้งให้ผู้แจ้ง'
           when t.status = 'counter_received' and t.lawsuit_at is null and now() >= t.restore_after then 'คืนเนื้อหา (ไม่มีหลักฐานฟ้องคดี)'
           when t.status = 'counter_received' then 'รอครบ 30 วันหรือหลักฐานการฟ้องคดี'
           else 'ปิดแล้ว' end,
         c.name, c.email, c.reason
  from public.takedown_notices t left join public.takedown_counters c on c.notice_id = t.id
  where (p_status is null and t.status not in ('restored','removed','rejected','withdrawn')) or t.status = p_status
  order by coalesce(t.restore_after, t.respond_by) asc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;
revoke execute on function public.takedown_queue(text, int) from public, anon;
grant execute on function public.takedown_queue(text, int) to authenticated;

-- moderators: one decision. hide | reject | incomplete | forwarded | lawsuit | restore | remove | withdrawn
create or replace function public.takedown_decide(p_id uuid, p_action text, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare n public.takedown_notices; st jsonb; ns text; i uuid;
begin
  if not private.is_staff('moderator') then raise exception 'moderators only' using errcode = '42501'; end if;
  select * into n from public.takedown_notices where id = p_id for update;
  if n.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform set_config('lumi.actor_role', coalesce(private.staff_role(), 'moderator'), true);
  case p_action
    when 'hide' then
      st := private.takedown_set_hidden(n, true);
      update public.takedown_notices set status = 'content_hidden', hidden_at = coalesce(hidden_at, now()),
        prev_state = coalesce(prev_state, st), owner_notified_at = now() where id = n.id;
      perform private.notify(n.target_owner, 'moderation', 'เนื้อหาของคุณถูกระงับตามคำร้อง ' || n.ref || ' ส่งคำโต้แย้งได้ถ้าเห็นว่าไม่ถูกต้อง', '#/takedown/' || n.ref, null, null);
      ns := 'content_hidden';
    when 'reject', 'restore', 'withdrawn' then
      if p_action = 'restore' and n.status = 'counter_received' and n.lawsuit_at is null and n.restore_after is not null and now() < n.restore_after then
        raise exception 'WAIT' using errcode = 'P0001', hint = 'ยังไม่ครบ 30 วันนับจากคำโต้แย้ง';
      end if;
      if n.hidden_at is not null then perform private.takedown_set_hidden(n, false); end if;
      ns := case p_action when 'reject' then 'rejected' when 'restore' then 'restored' else 'withdrawn' end;
      update public.takedown_notices set status = ns where id = n.id;
      if n.hidden_at is not null then
        perform private.notify(n.target_owner, 'moderation', 'เนื้อหาของคุณกลับมาแสดงแล้ว (' || n.ref || ')', '#/takedown/' || n.ref, null, null);
      end if;
    when 'incomplete' then ns := 'incomplete'; update public.takedown_notices set status = ns where id = n.id;
    when 'forwarded' then
      if n.counter_at is null then raise exception 'no counter-notice yet' using errcode = '22023'; end if;
      ns := n.status; update public.takedown_notices set counter_forwarded_at = now() where id = n.id;
    when 'lawsuit' then
      ns := 'removed'; update public.takedown_notices set status = ns, lawsuit_at = now(), lawsuit_note = left(p_note, 1000) where id = n.id;
      perform private.notify(n.target_owner, 'moderation', 'เนื้อหายังถูกระงับต่อ เพราะเจ้าของสิทธิ์แจ้งว่าได้ฟ้องคดีแล้ว (' || n.ref || ')', '#/takedown/' || n.ref, null, null);
    when 'remove' then
      begin i := n.target_id::uuid; exception when others then i := null; end;
      perform private.set_bypass(true);
      if n.target_type = 'post' then update public.posts set status = 'removed' where id = i;
      elsif n.target_type = 'product' then update public.products set status = 'removed' where id = i;
      elsif n.target_type in ('comment','story') then perform private.set_content_hidden(n.target_type, n.target_id, true);
      end if;
      perform private.set_bypass(false);
      ns := 'removed'; update public.takedown_notices set status = ns where id = n.id;
      perform private.notify(n.target_owner, 'moderation', 'เนื้อหาถูกนำออกตามคำร้อง ' || n.ref, '#/takedown/' || n.ref, null, null);
    else raise exception 'bad action' using errcode = '22023';
  end case;
  update public.takedown_notices set handled_by = auth.uid(), handled_at = now(), updated_at = now(),
    admin_note = coalesce(left(p_note, 1000), admin_note) where id = n.id;
  -- close the linked report in the normal queue
  if ns in ('rejected','restored','withdrawn','removed') and n.report_id is not null then
    update public.reports set status = case when ns = 'removed' then 'actioned' else 'dismissed' end, handled_by = auth.uid(), handled_at = now()
    where id = n.report_id and status = 'open';
  end if;
  perform private.audit('takedown.' || p_action, n.target_type, coalesce(n.target_id, n.ref),
    jsonb_build_object('status', n.status), jsonb_build_object('ref', n.ref, 'status', ns, 'note', left(p_note, 300)));
  perform set_config('lumi.actor_role', '', true);
  return ns;
end $$;
revoke execute on function public.takedown_decide(uuid, text, text) from public, anon;
grant execute on function public.takedown_decide(uuid, text, text) to authenticated;

-- daily: remind staff of overdue notices; restore copyright items on the last allowed day if nobody acted
create or replace function private.takedown_daily() returns int
language plpgsql security definer set search_path = '' as $$
declare n public.takedown_notices; k int := 0;
begin
  if not private.is_service() then raise exception 'service only' using errcode = '42501'; end if;
  perform set_config('lumi.actor_role', 'system', true);
  for n in select * from public.takedown_notices where status = 'counter_received' and kind = 'copyright' and lawsuit_at is null
           and restore_by is not null and now() >= restore_by - interval '1 day' loop
    perform private.takedown_set_hidden(n, false);
    update public.takedown_notices set status = 'restored', handled_at = now(), updated_at = now() where id = n.id;
    update public.reports set status = 'dismissed', handled_at = now() where id = n.report_id and status = 'open';
    perform private.audit('takedown.auto_restore', n.target_type, coalesce(n.target_id, n.ref), null, jsonb_build_object('ref', n.ref));
    perform private.notify(n.target_owner, 'moderation', 'เนื้อหาของคุณกลับมาแสดงแล้ว (' || n.ref || ')', '#/takedown/' || n.ref, null, null);
    k := k + 1;
  end loop;
  if exists (select 1 from public.takedown_notices where (status in ('received','incomplete') and now() > respond_by)
             or (status = 'counter_received' and counter_forwarded_at is null and counter_at < now() - interval '2 days')
             or (status = 'counter_received' and lawsuit_at is null and now() >= restore_after)) then
    perform private.takedown_notify_staff('มีคำร้องแจ้งลบที่เลยกำหนดหรือถึงเวลาดำเนินการ เปิดคิวแจ้งลบ');
  end if;
  perform set_config('lumi.actor_role', '', true);
  return k;
end $$;
revoke execute on function private.takedown_daily() from public, anon, authenticated;
select cron.schedule('pixeeno-takedown-daily', '0 2 * * *', $$select private.takedown_daily()$$);   -- 02:00 UTC = 09:00 Asia/Bangkok
