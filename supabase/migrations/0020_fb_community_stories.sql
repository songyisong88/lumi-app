-- LUMI 0020: Facebook-style community (reactions, @mentions, groups) + Instagram-style stories
-- (link button, stickers/overlays, emoji reactions, replies, link clicks).
-- ADDITIVE ONLY: the live site (main) keeps working unchanged:
--  * reactions live in the existing post_likes / comment_likes rows (new `kind`, default 'like'),
--    so like_count / real_like_count and old "like" taps still work;
--  * new notice types use notif_kind 'community'/'like' + new `sub`/`badge` columns (old screens never see an unknown kind);
--  * mention text stays plain "@Name" in the body; ids are in public.mentions.
-- Test accounts (profiles.is_test): real_reaction_counts leaves them out; notices they cause are flagged from_test (0019).

-- ============ 0. notices: sub-type + badge (not user-writable: notifications has no INSERT/UPDATE grant on these)
alter table public.notifications add column if not exists sub text check (sub in ('reaction','reply','mention','group_invite','story_reaction','story_reply'));
alter table public.notifications add column if not exists badge text check (char_length(badge) <= 8);
create or replace function private.notify2(p_user uuid, p_kind notif_kind, p_text text, p_link text, p_actor uuid, p_sub text, p_badge text, p_image text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  insert into public.notifications (user_id, kind, text, link, actor_id, image, sub, badge)
  values (p_user, p_kind, left(p_text, 300), left(p_link, 300), p_actor, left(p_image, 300), p_sub, left(p_badge, 8));
end $$;
revoke all on function private.notify2(uuid, notif_kind, text, text, uuid, text, text, text) from public, anon, authenticated;

-- ============ 1. reactions: one per person per post/comment, 6 kinds
alter table public.post_likes add column if not exists kind text not null default 'like';
alter table public.comment_likes add column if not exists kind text not null default 'like';
alter table public.comment_likes add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table public.post_likes add constraint post_likes_kind_chk check (kind in ('like','love','haha','wow','fire','idea'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.comment_likes add constraint comment_likes_kind_chk check (kind in ('like','love','haha','wow','fire','idea'));
exception when duplicate_object then null; end $$;
alter table public.posts add column if not exists reaction_counts jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists real_reaction_counts jsonb not null default '{}'::jsonb;
alter table public.comments add column if not exists reaction_counts jsonb not null default '{}'::jsonb;
alter table public.comments add column if not exists real_reaction_counts jsonb not null default '{}'::jsonb;
comment on column public.posts.reaction_counts is 'count per reaction kind (like/love/haha/wow/fire/idea), server-maintained';
comment on column public.posts.real_reaction_counts is 'reaction_counts without test accounts; shown on the real site';
grant update (kind) on public.post_likes, public.comment_likes to authenticated;
drop policy if exists "change own reaction" on public.post_likes;
create policy "change own reaction" on public.post_likes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "change own comment reaction" on public.comment_likes;
create policy "change own comment reaction" on public.comment_likes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function private.jsonb_bump(j jsonb, k text, d int) returns jsonb language sql immutable set search_path = '' as $$
  select case when greatest(coalesce((j ->> k)::int, 0) + d, 0) = 0 then j - k
              else j || jsonb_build_object(k, greatest(coalesce((j ->> k)::int, 0) + d, 0)) end
$$;
create or replace function private.reaction_emoji(k text) returns text language sql immutable set search_path = '' as $$
  select case k when 'love' then '😍' when 'haha' then '😆' when 'wow' then '😮' when 'fire' then '🔥' when 'idea' then '💡' else '❤️' end
$$;
create or replace function private.reaction_counts() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function private.reaction_counts() from public, anon, authenticated;
drop trigger if exists post_likes_rx on public.post_likes;
create trigger post_likes_rx after insert or delete on public.post_likes for each row execute function private.reaction_counts();
drop trigger if exists post_likes_rx_upd on public.post_likes;
create trigger post_likes_rx_upd after update of kind on public.post_likes for each row when (old.kind is distinct from new.kind) execute function private.reaction_counts();
drop trigger if exists comment_likes_rx on public.comment_likes;
create trigger comment_likes_rx after insert or delete on public.comment_likes for each row execute function private.reaction_counts();
drop trigger if exists comment_likes_rx_upd on public.comment_likes;
create trigger comment_likes_rx_upd after update of kind on public.comment_likes for each row when (old.kind is distinct from new.kind) execute function private.reaction_counts();

-- backfill (all existing likes are 'like')
select private.set_bypass(true);
update public.posts p set
  reaction_counts = coalesce((select jsonb_object_agg(k, n) from (select l.kind k, count(*) n from public.post_likes l where l.post_id = p.id group by l.kind) x), '{}'::jsonb),
  real_reaction_counts = coalesce((select jsonb_object_agg(k, n) from (select l.kind k, count(*) n from public.post_likes l join public.profiles a on a.id = l.user_id where l.post_id = p.id and not a.is_test group by l.kind) x), '{}'::jsonb);
update public.comments c set
  reaction_counts = coalesce((select jsonb_object_agg(k, n) from (select l.kind k, count(*) n from public.comment_likes l where l.comment_id = c.id group by l.kind) x), '{}'::jsonb),
  real_reaction_counts = coalesce((select jsonb_object_agg(k, n) from (select l.kind k, count(*) n from public.comment_likes l join public.profiles a on a.id = l.user_id where l.comment_id = c.id and not a.is_test group by l.kind) x), '{}'::jsonb);
select private.set_bypass(false);

-- ============ 2. groups (rooms) — public/private, roles, invites, admin announcement
alter table public.rooms add column if not exists privacy text not null default 'public';
do $$ begin
  alter table public.rooms add constraint rooms_privacy_chk check (privacy in ('public','private'));
exception when duplicate_object then null; end $$;
alter table public.rooms add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.rooms add column if not exists pinned_post_id uuid references public.posts(id) on delete set null;
alter table public.rooms add column if not exists announcement text check (char_length(announcement) <= 500);
alter table public.room_members add column if not exists role text not null default 'member';
alter table public.room_members add column if not exists status text not null default 'joined';
alter table public.room_members add column if not exists invited_by uuid references public.profiles(id) on delete set null;
do $$ begin
  alter table public.room_members add constraint room_members_role_chk check (role in ('admin','mod','member'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.room_members add constraint room_members_status_chk check (status in ('joined','invited','requested'));
exception when duplicate_object then null; end $$;
create index if not exists room_members_room_idx on public.room_members (room_id, status);
grant insert (status, invited_by) on public.room_members to authenticated;
grant update (status) on public.room_members to authenticated;
grant select on public.room_members to anon;

-- who can see memberships: your own, invites you sent, and the joined members of public groups
drop policy if exists "public group members" on public.room_members;
create policy "public group members" on public.room_members for select to anon, authenticated
  using (status = 'joined' and exists (select 1 from public.rooms r where r.id = room_id and r.privacy = 'public'));
drop policy if exists "invites I sent" on public.room_members;
create policy "invites I sent" on public.room_members for select to authenticated using (invited_by = (select auth.uid()));
drop policy if exists "invite a member" on public.room_members;
create policy "invite a member" on public.room_members for insert to authenticated
  with check (user_id <> (select auth.uid()) and status = 'invited' and invited_by = (select auth.uid()));
drop policy if exists "accept own invite" on public.room_members;
create policy "accept own invite" on public.room_members for update to authenticated
  using (user_id = (select auth.uid()) and status = 'invited') with check (user_id = (select auth.uid()) and status = 'joined');

create or replace function private.room_members_before() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function private.room_members_before() from public, anon, authenticated;
drop trigger if exists room_members_before on public.room_members;
create trigger room_members_before before insert or update on public.room_members for each row execute function private.room_members_before();

-- member_count = joined members only; invite notices
create or replace function private.room_members_after() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function private.room_members_after() from public, anon, authenticated;
drop trigger if exists room_members_count on public.room_members;
drop trigger if exists room_members_after on public.room_members;
create trigger room_members_after after insert or update or delete on public.room_members for each row execute function private.room_members_after();

-- group admins/mods (set by the LUMI team) can hide a post in their group
create or replace function public.group_hide_post(p_post uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.posts p join public.room_members m on m.room_id = p.room_id
                 where p.id = p_post and m.user_id = auth.uid() and m.status = 'joined' and m.role in ('admin','mod')) then
    raise exception 'เฉพาะแอดมินกลุ่ม' using errcode = '42501';
  end if;
  perform private.set_bypass(true);
  update public.posts set status = 'hidden' where id = p_post;
  perform private.set_bypass(false);
end $$;
revoke all on function public.group_hide_post(uuid) from public, anon;
grant execute on function public.group_hide_post(uuid) to authenticated;

-- ============ 3. posts: feeling, group membership = joined
alter table public.posts add column if not exists feeling text check (char_length(feeling) <= 40);
grant insert (feeling) on public.posts to authenticated;
grant update (feeling) on public.posts to authenticated;
create or replace function private.posts_before() returns trigger
language plpgsql set search_path = '' as $$
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
end $$;

-- ============ 4. counters + notices (0019 + reaction wording; room_members moved to room_members_after)
create or replace function private.community_counts()
 returns trigger language plpgsql security definer set search_path to '' as $function$
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
end $function$;

-- ============ 5. @mentions (post / comment / story). Client sends the picked ids; the server checks them.
create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('post','comment','story')),
  source_id uuid not null,
  mentioned_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (source_kind, source_id, mentioned_id)
);
create index if not exists mentions_source_idx on public.mentions (source_kind, source_id);
create index if not exists mentions_mentioned_idx on public.mentions (mentioned_id, created_at desc);
create index if not exists mentions_author_idx on public.mentions (author_id);
alter table public.mentions enable row level security;
grant select on public.mentions to anon, authenticated;
grant insert (source_kind, source_id, mentioned_id, name) on public.mentions to authenticated;
grant delete on public.mentions to authenticated;
grant all on public.mentions to service_role;
drop policy if exists "mentions are public" on public.mentions;
create policy "mentions are public" on public.mentions for select to anon, authenticated
  using (source_kind <> 'story' or mentioned_id = (select auth.uid()) or author_id = (select auth.uid())
         or exists (select 1 from public.stories s where s.id = source_id and s.expires_at > now()));
drop policy if exists "mention in own content" on public.mentions;
create policy "mention in own content" on public.mentions for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "remove own mention" on public.mentions;
create policy "remove own mention" on public.mentions for delete to authenticated using (author_id = (select auth.uid()));

create or replace function private.mentions_before() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
create or replace function private.mentions_after() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function private.mentions_before(), private.mentions_after() from public, anon, authenticated;
drop trigger if exists mentions_before on public.mentions;
create trigger mentions_before before insert on public.mentions for each row execute function private.mentions_before();
drop trigger if exists mentions_after on public.mentions;
create trigger mentions_after after insert on public.mentions for each row execute function private.mentions_after();

-- people to suggest after "@": who you follow, people in this post, people who commented on your posts, members of this group
create or replace function public.search_mention_candidates(q text default '', p_post uuid default null, p_room text default null, p_real boolean default true)
returns table (id uuid, display_name text, avatar_path text, reason text)
language sql stable set search_path = '' as $$
  with me as (select auth.uid() as uid),
  qq as (select nullif(replace(replace(replace(trim(coalesce(q, '')), '%', ''), '_', ''), '\', ''), '') as v),
  cand as (
    select p.id, p.display_name, p.avatar_path,
      case
        when exists (select 1 from public.follows f where f.follower_id = (select uid from me) and f.creator_id = p.id) then 'คุณติดตาม'
        when p_post is not null and (exists (select 1 from public.posts x where x.id = p_post and x.author_id = p.id)
                                     or exists (select 1 from public.comments c where c.post_id = p_post and c.author_id = p.id)) then 'อยู่ในโพสต์นี้'
        when exists (select 1 from public.comments c join public.posts x on x.id = c.post_id where x.author_id = (select uid from me) and c.author_id = p.id) then 'เคยคอมเมนต์โพสต์ของคุณ'
        when p_room is not null and exists (select 1 from public.room_members m where m.room_id = p_room and m.user_id = p.id and m.status = 'joined')
          then 'อยู่ในกลุ่ม ' || coalesce((select r.name from public.rooms r where r.id = p_room), '')
        else '' end as reason
    from public.profiles p
    where (select uid from me) is not null and p.id <> (select uid from me)
      and (not coalesce(p_real, true) or not p.is_test)
      and ((select v from qq) is null or p.display_name ilike '%' || (select v from qq) || '%' or p.handle ilike '%' || (select v from qq) || '%')
  )
  select c.id, c.display_name, c.avatar_path, c.reason from cand c
  where c.reason <> '' or (select v from qq) is not null
  order by case c.reason when 'คุณติดตาม' then 0 when 'อยู่ในโพสต์นี้' then 1 when '' then 9 else 2 end, c.display_name
  limit 8
$$;
revoke all on function public.search_mention_candidates(text, uuid, text, boolean) from public, anon;
grant execute on function public.search_mention_candidates(text, uuid, text, boolean) to authenticated;

-- ============ 6. stories: optional link button, overlays (video), reactions, replies, link clicks
alter table public.stories add column if not exists link_label text;
do $$ begin
  alter table public.stories add constraint stories_link_label_chk check (link_label in ('ดูสินค้า','ดูผลงาน','รับฟรี','จ้างเลย'));
exception when duplicate_object then null; end $$;
alter table public.stories add column if not exists overlays jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.stories add constraint stories_overlays_chk check (jsonb_typeof(overlays) = 'array' and jsonb_array_length(overlays) <= 30 and pg_column_size(overlays) <= 16384);
exception when duplicate_object then null; end $$;
alter table public.stories add column if not exists duration_ms int check (duration_ms between 500 and 60000);
grant insert (link_label, overlays, duration_ms) on public.stories to authenticated;
create or replace function private.stories_before() returns trigger
language plpgsql set search_path = '' as $$
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
end $$;

-- link clicks + viewers list only for the author, only for 48 h
alter table public.story_views add column if not exists clicked_link boolean not null default false;
grant update (clicked_link) on public.story_views to authenticated;
drop policy if exists "mark own link click" on public.story_views;
create policy "mark own link click" on public.story_views for update to authenticated
  using (viewer_id = (select auth.uid())) with check (viewer_id = (select auth.uid()));
drop policy if exists "own views or views of my stories" on public.story_views;
create policy "own views or views of my stories" on public.story_views for select to authenticated
  using (viewer_id = (select auth.uid()) or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()) and s.created_at > now() - interval '48 hours'));

create table if not exists public.story_reactions (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','😍','😆','😮','🔥','👏','🙏')),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
create index if not exists story_reactions_user_idx on public.story_reactions (user_id);
alter table public.story_reactions enable row level security;
grant select, delete on public.story_reactions to authenticated;
grant insert (story_id, emoji) on public.story_reactions to authenticated;
grant update (emoji) on public.story_reactions to authenticated;
grant all on public.story_reactions to service_role;
drop policy if exists "own story reactions or on my stories" on public.story_reactions;
create policy "own story reactions or on my stories" on public.story_reactions for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()) and s.created_at > now() - interval '48 hours'));
drop policy if exists "react to a live story" on public.story_reactions;
create policy "react to a live story" on public.story_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id and s.expires_at > now() and s.author_id <> (select auth.uid())));
drop policy if exists "change own story reaction" on public.story_reactions;
create policy "change own story reaction" on public.story_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "remove own story reaction" on public.story_reactions;
create policy "remove own story reaction" on public.story_reactions for delete to authenticated using (user_id = (select auth.uid()));
create or replace function private.story_reactions_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare au uuid; n text;
begin
  select author_id into au from public.stories where id = new.story_id;
  select display_name into n from public.profiles where id = new.user_id;
  perform private.notify2(au, 'like', coalesce(n, 'มีคน') || ' แสดงความรู้สึก ' || new.emoji || ' ต่อสตอรี่ของคุณ', '/story/' || au, new.user_id, 'story_reaction', new.emoji);
  return null;
end $$;
revoke all on function private.story_reactions_after() from public, anon, authenticated;
drop trigger if exists story_reactions_after on public.story_reactions;
create trigger story_reactions_after after insert on public.story_reactions for each row execute function private.story_reactions_after();

-- replies to a story go to the author's chat (messages.story_id)
alter table public.messages add column if not exists story_id uuid references public.stories(id) on delete set null;
create index if not exists messages_story_idx on public.messages (story_id) where story_id is not null;
grant insert (story_id) on public.messages to authenticated;
create or replace function private.messages_story_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare au uuid;
begin
  if new.story_id is null or private.bypass() then return new; end if;
  select s.author_id into au from public.stories s where s.id = new.story_id and s.expires_at > now();
  if au is null or au = auth.uid()
     or not exists (select 1 from public.chat_threads t where t.id = new.thread_id and au in (t.buyer_id, t.seller_id) and auth.uid() in (t.buyer_id, t.seller_id)) then
    raise exception 'ตอบกลับสตอรี่นี้ไม่ได้' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.messages_story_check() from public, anon, authenticated;
drop trigger if exists messages_story_check on public.messages;
create trigger messages_story_check before insert on public.messages for each row execute function private.messages_story_check();

-- ============ 7. story videos (≤ 60 s): previews bucket takes phone video formats up to 50 MB
update storage.buckets set file_size_limit = 52428800,
  allowed_mime_types = (select array_agg(distinct t) from unnest(coalesce(allowed_mime_types, '{}') || array['video/quicktime','video/webm']) t)
where id = 'previews';
