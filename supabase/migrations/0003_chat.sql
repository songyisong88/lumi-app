-- LUMI 0003: chat threads, per-user thread state, messages
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  is_hire boolean not null default false,
  title text not null default 'แชตกับครีเอเตอร์' check (char_length(title) <= 120),
  image text check (char_length(image) <= 300),
  last_message_at timestamptz not null default now(),
  last_message_preview text check (char_length(last_message_preview) <= 140),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create unique index chat_threads_pair_uidx on public.chat_threads (buyer_id, seller_id, product_id) nulls not distinct where not is_hire;
create index chat_threads_buyer_idx on public.chat_threads (buyer_id, last_message_at desc);
create index chat_threads_seller_idx on public.chat_threads (seller_id, last_message_at desc);
create index chat_threads_product_idx on public.chat_threads (product_id);

create table public.chat_thread_state (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pinned boolean not null default false,
  muted boolean not null default false,
  archived boolean not null default false,
  last_read_at timestamptz not null default '-infinity',
  primary key (thread_id, user_id)
);
create index chat_thread_state_user_idx on public.chat_thread_state (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,   -- null = system
  kind public.msg_kind not null default 'text',
  body text check (char_length(body) <= 4000),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 20000),
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);
create index messages_sender_idx on public.messages (sender_id);

alter table public.product_files add constraint product_files_thread_fk foreign key (thread_id) references public.chat_threads(id) on delete cascade;

create or replace function private.is_thread_member(p_thread uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_threads t where t.id = p_thread and auth.uid() in (t.buyer_id, t.seller_id))
$$;
create or replace function private.thread_role(p_thread uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when t.buyer_id = auth.uid() then 'buyer' when t.seller_id = auth.uid() then 'seller' end
  from public.chat_threads t where t.id = p_thread
$$;
grant execute on function private.is_thread_member(uuid), private.thread_role(uuid) to authenticated, service_role;

create or replace function private.chat_threads_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_thread_state (thread_id, user_id) values (new.id, new.buyer_id), (new.id, new.seller_id) on conflict do nothing;
  return null;
end $$;
create trigger chat_threads_after_insert after insert on public.chat_threads for each row execute function private.chat_threads_after_insert();

create or replace function private.messages_before_insert() returns trigger
language plpgsql set search_path = '' as $$
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
end $$;
create trigger messages_before_insert before insert on public.messages for each row execute function private.messages_before_insert();

create or replace function private.messages_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function private.messages_after_insert();

alter table public.chat_threads enable row level security;
alter table public.chat_thread_state enable row level security;
alter table public.messages enable row level security;

grant select on public.chat_threads, public.chat_thread_state, public.messages to authenticated;
grant insert (buyer_id, seller_id, product_id, is_hire, title, image) on public.chat_threads to authenticated;
grant update (pinned, muted, archived, last_read_at) on public.chat_thread_state to authenticated;
grant insert (thread_id, kind, body, payload) on public.messages to authenticated;
grant all on public.chat_threads, public.chat_thread_state, public.messages to service_role;

create policy "members read thread" on public.chat_threads for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
create policy "buyer opens thread" on public.chat_threads for insert to authenticated
  with check (buyer_id = (select auth.uid()) and seller_id <> (select auth.uid()));
create policy "own thread state" on public.chat_thread_state for select to authenticated using (user_id = (select auth.uid()));
create policy "edit own thread state" on public.chat_thread_state for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "members read messages" on public.messages for select to authenticated
  using ((select private.is_thread_member(thread_id)));
create policy "members send messages" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select private.is_thread_member(thread_id)));

-- unread badge per thread for the signed-in user
create or replace function public.chat_unread() returns table (thread_id uuid, unread bigint)
language sql stable security invoker set search_path = '' as $$
  select s.thread_id, count(m.id)
  from public.chat_thread_state s
  join public.messages m on m.thread_id = s.thread_id and m.created_at > s.last_read_at and m.sender_id is distinct from s.user_id
  where s.user_id = (select auth.uid())
  group by s.thread_id
$$;
revoke execute on function public.chat_unread() from public, anon;
grant execute on function public.chat_unread() to authenticated;
