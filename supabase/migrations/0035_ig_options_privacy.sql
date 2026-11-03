-- 0035 Instagram/Facebook-style post & story options + privacy settings (DEMO feature; additive, defaults keep old behaviour).
-- Backup of every private function + public policy taken before applying: lumi-qa/fb-build/v3/db-backup-before-0035.sql

-- ── columns ─────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists audience text not null default 'public' check (audience in ('public','followers','close_friends','only_me')),
  add column if not exists comments_off boolean not null default false,
  add column if not exists hide_likes boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists alt_texts text[] not null default '{}' check (cardinality(alt_texts) <= 10),
  add column if not exists location text check (char_length(location) <= 80);
alter table public.stories
  add column if not exists audience text not null default 'public' check (audience in ('public','close_friends')),
  add column if not exists allow_replies text not null default 'everyone' check (allow_replies in ('everyone','following','off'));
alter table public.comments add column if not exists filtered boolean not null default false;
alter table public.profiles add column if not exists is_private boolean not null default false;

alter table public.user_blocks drop constraint if exists user_blocks_kind_check;
alter table public.user_blocks add constraint user_blocks_kind_check check (kind in ('block','mute','restrict'));
alter table public.mentions drop constraint if exists mentions_source_kind_check;
alter table public.mentions add constraint mentions_source_kind_check check (source_kind in ('post','comment','story','post_tag'));

-- ── new tables ──────────────────────────────────────────────────────────
create table if not exists public.privacy_settings (
  id uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  allow_comments text not null default 'everyone' check (allow_comments in ('everyone','followers','following','off')),
  allow_tags     text not null default 'everyone' check (allow_tags in ('everyone','following','off')),
  allow_mentions text not null default 'everyone' check (allow_mentions in ('everyone','following','off')),
  hidden_words   text[] not null default '{}' check (cardinality(hidden_words) <= 200),
  activity_status boolean not null default true,
  last_active_at timestamptz,
  updated_at timestamptz not null default now());
alter table public.privacy_settings enable row level security;
create policy "own privacy settings" on public.privacy_settings for select using (id = (select auth.uid()));
create policy "create own privacy settings" on public.privacy_settings for insert with check (id = (select auth.uid()));
create policy "edit own privacy settings" on public.privacy_settings for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

create table if not exists public.close_friends (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id), check (user_id <> friend_id));
alter table public.close_friends enable row level security;
create policy "own close friends" on public.close_friends for select using (user_id = (select auth.uid()));
create policy "add close friend" on public.close_friends for insert with check (user_id = (select auth.uid()));
create policy "remove close friend" on public.close_friends for delete using (user_id = (select auth.uid()));

create table if not exists public.story_hide (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id), check (user_id <> target_id));
alter table public.story_hide enable row level security;
create policy "own story hide list" on public.story_hide for select using (user_id = (select auth.uid()));
create policy "hide story from" on public.story_hide for insert with check (user_id = (select auth.uid()));
create policy "unhide story" on public.story_hide for delete using (user_id = (select auth.uid()));

create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id), check (requester_id <> target_id));
alter table public.follow_requests enable row level security;

create table if not exists public.story_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 30),
  created_at timestamptz not null default now());
create table if not exists public.story_highlight_items (
  highlight_id uuid not null references public.story_highlights(id) on delete cascade,
  story_id uuid not null,
  media_path text, media_kind text, overlays jsonb not null default '[]', duration_ms int, caption text,
  added_at timestamptz not null default now(),
  primary key (highlight_id, story_id));
alter table public.story_highlights enable row level security;
alter table public.story_highlight_items enable row level security;

-- ── helpers ─────────────────────────────────────────────────────────────
create or replace function private.follows(a uuid, b uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select a is not null and b is not null and exists (select 1 from public.follows f where f.follower_id = a and f.creator_id = b) $$;
create or replace function private.is_private(p uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce((select is_private from public.profiles where id = p), false) $$;
create or replace function private.is_close_friend(owner uuid, viewer uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select viewer is not null and exists (select 1 from public.close_friends c where c.user_id = owner and c.friend_id = viewer) $$;
create or replace function private.pset(p uuid) returns public.privacy_settings language sql stable security definer set search_path to '' as $$
  select coalesce((select s from public.privacy_settings s where s.id = p), row(p,'everyone','everyone','everyone','{}'::text[],true,null::timestamptz,now())::public.privacy_settings) $$;
create or replace function private.audience_ok(p_rule text, owner uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select case p_rule when 'everyone' then true
    when 'followers' then private.follows(auth.uid(), owner)
    when 'following' then private.follows(owner, auth.uid())
    else false end $$;

-- mute hides, restrict does not (restricted people's comments are filtered instead)
create or replace function private.hidden_author(p_author uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select auth.uid() is not null and p_author is not null and p_author <> auth.uid() and exists (
    select 1 from public.user_blocks x
    where (x.user_id = auth.uid() and x.target_id = p_author and x.kind in ('block','mute'))
       or (x.user_id = p_author and x.target_id = auth.uid() and x.kind = 'block')) $$;

create or replace function private.can_see_post(p_author uuid, p_status text, p_audience text, p_archived timestamptz) returns boolean
language sql stable security definer set search_path to '' as $$
  select p_author = auth.uid() or private.is_staff('moderator') or (
    p_status = 'visible' and p_archived is null and not private.hidden_author(p_author)
    and (case p_audience when 'public' then true
           when 'followers' then private.follows(auth.uid(), p_author)
           when 'close_friends' then private.is_close_friend(p_author, auth.uid())
           else false end)
    and (not private.is_private(p_author) or private.follows(auth.uid(), p_author))) $$;

create or replace function private.post_visible(p_post uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.posts p where p.id = p_post and private.can_see_post(p.author_id, p.status, p.audience, p.archived_at)) $$;

create or replace function private.can_comment(p_post uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.posts p where p.id = p_post and (p.author_id = auth.uid() or
    (not p.comments_off and private.audience_ok((private.pset(p.author_id)).allow_comments, p.author_id)))) $$;

create or replace function private.can_see_story(p_author uuid, p_audience text, p_expires timestamptz, p_hidden timestamptz) returns boolean
language sql stable security definer set search_path to '' as $$
  select p_author = auth.uid() or private.is_staff('moderator') or (
    p_expires > now() and p_hidden is null and not private.hidden_author(p_author)
    and (p_audience = 'public' or private.is_close_friend(p_author, auth.uid()))
    and not exists (select 1 from public.story_hide h where h.user_id = p_author and h.target_id = auth.uid())
    and (not private.is_private(p_author) or private.follows(auth.uid(), p_author))) $$;

create or replace function private.story_ok(p_story uuid, p_reply boolean) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.stories s where s.id = p_story and s.author_id <> auth.uid()
    and private.can_see_story(s.author_id, s.audience, s.expires_at, s.hidden_at)
    and (not p_reply or private.audience_ok(s.allow_replies, s.author_id))) $$;

-- ── policies ────────────────────────────────────────────────────────────
drop policy if exists "visible or own posts" on public.posts;
create policy "visible or own posts" on public.posts for select using (private.can_see_post(author_id, status, audience, archived_at));

drop policy if exists "comment on visible post" on public.comments;
create policy "comment on visible post" on public.comments for insert with check (
  author_id = (select auth.uid()) and (select private.post_visible(comments.post_id)) and (select private.can_comment(comments.post_id))
  and (select private.reply_ok(comments.reply_to, comments.post_id)));
drop policy if exists "comments on visible posts" on public.comments;
create policy "comments on visible posts" on public.comments for select using (
  (select private.post_visible(comments.post_id))
  and (hidden_at is null or author_id = (select auth.uid()) or (select private.is_staff('moderator')))
  and not private.hidden_author(author_id)
  and (not filtered or author_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = comments.post_id and p.author_id = (select auth.uid()))));

drop policy if exists "live stories are public" on public.stories;
create policy "live stories are public" on public.stories for select using (private.can_see_story(author_id, audience, expires_at, hidden_at));

drop policy if exists "record own view" on public.story_views;
create policy "record own view" on public.story_views for insert with check (viewer_id = (select auth.uid()) and private.story_ok(story_id, false));
drop policy if exists "react to a live story" on public.story_reactions;
create policy "react to a live story" on public.story_reactions for insert with check (user_id = (select auth.uid()) and private.story_ok(story_id, true));

drop policy if exists "mentions are public" on public.mentions;
create policy "mentions are public" on public.mentions for select using (
  mentioned_id = (select auth.uid()) or author_id = (select auth.uid()) or (case source_kind
    when 'story' then exists (select 1 from public.stories s where s.id = mentions.source_id and private.can_see_story(s.author_id, s.audience, s.expires_at, s.hidden_at))
    when 'comment' then exists (select 1 from public.comments c where c.id = mentions.source_id and private.post_visible(c.post_id))
    else private.post_visible(source_id) end));

drop policy if exists "follow" on public.follows;
create policy "follow" on public.follows for insert with check (follower_id = (select auth.uid()) and not private.is_private(creator_id));
create policy "remove a follower" on public.follows for delete using (creator_id = (select auth.uid()));

create policy "see own requests" on public.follow_requests for select using ((select auth.uid()) in (requester_id, target_id));
create policy "request to follow private account" on public.follow_requests for insert with check (
  requester_id = (select auth.uid()) and private.is_private(target_id) and not private.blocked_between(requester_id, target_id));
create policy "cancel or decline request" on public.follow_requests for delete using ((select auth.uid()) in (requester_id, target_id));

create policy "see highlights" on public.story_highlights for select using (
  user_id = (select auth.uid()) or (not private.hidden_author(user_id) and (not private.is_private(user_id) or private.follows((select auth.uid()), user_id))));
create policy "own highlights insert" on public.story_highlights for insert with check (user_id = (select auth.uid()));
create policy "own highlights update" on public.story_highlights for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own highlights delete" on public.story_highlights for delete using (user_id = (select auth.uid()));
create policy "see highlight items" on public.story_highlight_items for select using (exists (select 1 from public.story_highlights h where h.id = highlight_id));
create policy "add own story to own highlight" on public.story_highlight_items for insert with check (
  exists (select 1 from public.story_highlights h where h.id = highlight_id and h.user_id = (select auth.uid()))
  and exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid())));
create policy "remove from own highlight" on public.story_highlight_items for delete using (
  exists (select 1 from public.story_highlights h where h.id = highlight_id and h.user_id = (select auth.uid())));

-- ── triggers ────────────────────────────────────────────────────────────
create or replace function private.highlight_item_fill() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  select s.media_path, s.media_kind, s.overlays, s.duration_ms, s.caption into new.media_path, new.media_kind, new.overlays, new.duration_ms, new.caption
    from public.stories s where s.id = new.story_id;
  new.added_at := now(); return new;
end $$;
drop trigger if exists a_fill on public.story_highlight_items;
create trigger a_fill before insert on public.story_highlight_items for each row execute function private.highlight_item_fill();

-- restricted commenters + hidden words: comment is kept but only the writer (and post owner) sees it
create or replace function private.comments_privacy() returns trigger language plpgsql security definer set search_path to '' as $$
declare au uuid; w text;
begin
  select author_id into au from public.posts where id = new.post_id;
  new.filtered := false;
  if au is null or au = new.author_id then return new; end if;
  if exists (select 1 from public.user_blocks x where x.user_id = au and x.target_id = new.author_id and x.kind = 'restrict') then new.filtered := true; return new; end if;
  foreach w in array (private.pset(au)).hidden_words loop
    if char_length(trim(w)) > 0 and position(lower(trim(w)) in lower(new.body)) > 0 then new.filtered := true; exit; end if;
  end loop;
  return new;
end $$;
drop trigger if exists d_privacy on public.comments;
create trigger d_privacy before insert or update of body on public.comments for each row execute function private.comments_privacy();

-- at most 3 pinned posts, like Instagram
create or replace function private.posts_options() returns trigger language plpgsql set search_path to '' as $$
begin
  if new.pinned_at is not null and (tg_op = 'INSERT' or old.pinned_at is null)
     and (select count(*) from public.posts p where p.author_id = new.author_id and p.pinned_at is not null and p.id <> new.id) >= 3 then
    raise exception 'ปักหมุดได้สูงสุด 3 โพสต์' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists d_options on public.posts;
create trigger d_options before insert or update of pinned_at on public.posts for each row execute function private.posts_options();

-- who can tag / mention
create or replace function private.mentions_privacy() returns trigger language plpgsql security definer set search_path to '' as $$
declare ps public.privacy_settings;
begin
  if private.bypass() then return new; end if;
  if new.source_kind = 'post_tag' and not exists (select 1 from public.posts p where p.id = new.source_id and p.author_id = auth.uid()) then
    raise exception 'แท็กได้เฉพาะในโพสต์ของคุณเอง' using errcode = '42501';
  end if;
  ps := private.pset(new.mentioned_id);
  if not (case when new.source_kind = 'post_tag' then
        case ps.allow_tags when 'everyone' then true when 'following' then private.follows(new.mentioned_id, auth.uid()) else false end
      else
        case ps.allow_mentions when 'everyone' then true when 'following' then private.follows(new.mentioned_id, auth.uid()) else false end end) then
    raise exception 'คนนี้ไม่อนุญาตให้คุณแท็กหรือกล่าวถึง' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists c_privacy on public.mentions;
create trigger c_privacy before insert on public.mentions for each row execute function private.mentions_privacy();

-- mentions_before: accept post_tag (ownership checked in mentions_privacy)
create or replace function private.mentions_before() returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if private.bypass() then return new; end if;
  new.author_id := auth.uid(); new.created_at := now();
  if new.mentioned_id = auth.uid() then raise exception 'แท็กตัวเองไม่ได้' using errcode = '22023'; end if;
  if not (case new.source_kind
      when 'post' then exists (select 1 from public.posts p where p.id = new.source_id and p.author_id = auth.uid())
      when 'post_tag' then exists (select 1 from public.posts p where p.id = new.source_id and p.author_id = auth.uid())
      when 'comment' then exists (select 1 from public.comments c where c.id = new.source_id and c.author_id = auth.uid())
      when 'story' then exists (select 1 from public.stories s where s.id = new.source_id and s.author_id = auth.uid() and s.expires_at > now())
      else false end) then
    raise exception 'แท็กได้เฉพาะในโพสต์ของคุณเอง' using errcode = '42501';
  end if;
  if (select count(*) from public.mentions m where m.source_kind = new.source_kind and m.source_id = new.source_id) >= 10 then
    raise exception 'แท็กได้สูงสุด 10 คนต่อโพสต์' using errcode = '22023';
  end if;
  return new;
end $function$;

create or replace function private.mentions_after() returns trigger language plpgsql security definer set search_path to '' as $function$
declare n text; body text; link text; what text;
begin
  select display_name into n from public.profiles where id = new.author_id;
  if new.source_kind in ('post','post_tag') then
    select p.body into body from public.posts p where p.id = new.source_id; link := '/community/post/' || new.source_id; what := 'โพสต์';
  elsif new.source_kind = 'comment' then
    select c.body, '/community/post/' || c.post_id into body, link from public.comments c where c.id = new.source_id; what := 'ความคิดเห็น';
  else
    select s.caption into body from public.stories s where s.id = new.source_id; link := '/story/' || new.author_id; what := 'สตอรี่';
  end if;
  perform private.notify2(new.mentioned_id, 'community', coalesce(n, 'มีคน') || case when new.source_kind = 'post_tag' then ' แท็กคุณในโพสต์' else ' กล่าวถึงคุณใน' || what end
    || case when coalesce(body, '') <> '' then ': “' || left(body, 80) || '”' else '' end,
    link, new.author_id, 'mention', '@');
  return null;
end $function$;

-- story replies obey allow_replies + audience
create or replace function private.messages_story_check() returns trigger language plpgsql security definer set search_path to '' as $function$
declare au uuid;
begin
  if new.story_id is null or private.bypass() then return new; end if;
  select s.author_id into au from public.stories s where s.id = new.story_id and s.expires_at > now();
  if au is null or au = auth.uid() or not private.story_ok(new.story_id, true)
     or not exists (select 1 from public.chat_threads t where t.id = new.thread_id and au in (t.buyer_id, t.seller_id) and auth.uid() in (t.buyer_id, t.seller_id)) then
    raise exception 'ตอบกลับสตอรี่นี้ไม่ได้' using errcode = '42501';
  end if;
  return new;
end $function$;

-- ── RPCs ────────────────────────────────────────────────────────────────
-- who liked: real people only, respects visibility, blocks and "hide like count"
create or replace function public.post_likers(p_post uuid, p_limit int default 100)
returns table (id uuid, handle text, display_name text, avatar_path text, kind text, liked_at timestamptz, is_test boolean)
language sql stable security definer set search_path to '' as $$
  select pr.id, pr.handle, pr.display_name, pr.avatar_path, l.kind, l.created_at, pr.is_test
  from public.posts p join public.post_likes l on l.post_id = p.id join public.profiles pr on pr.id = l.user_id
  where p.id = p_post and private.can_see_post(p.author_id, p.status, p.audience, p.archived_at)
    and (not p.hide_likes or p.author_id = auth.uid())
    and not private.hidden_author(l.user_id)
  order by l.created_at desc limit least(greatest(p_limit, 1), 500) $$;
grant execute on function public.post_likers(uuid, int) to anon, authenticated;

-- posts with like counts masked when the owner hid them (what the app reads)
create or replace view public.posts_v with (security_invoker = true) as
  select p.*, (p.hide_likes and p.author_id is distinct from auth.uid()) as likes_hidden,
    case when p.hide_likes and p.author_id is distinct from auth.uid() then null else p.like_count end as like_count_v,
    case when p.hide_likes and p.author_id is distinct from auth.uid() then null else p.real_like_count end as real_like_count_v,
    case when p.hide_likes and p.author_id is distinct from auth.uid() then null else p.reaction_counts end as reaction_counts_v
  from public.posts p;
grant select on public.posts_v to anon, authenticated;

create or replace function public.accept_follow_request(p_requester uuid) returns void language plpgsql security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.follow_requests r where r.requester_id = p_requester and r.target_id = auth.uid()) then
    raise exception 'ไม่มีคำขอนี้' using errcode = '42501'; end if;
  perform private.set_bypass(true);
  insert into public.follows (follower_id, creator_id) values (p_requester, auth.uid()) on conflict do nothing;
  delete from public.follow_requests where requester_id = p_requester and target_id = auth.uid();
  perform private.set_bypass(false);
end $$;
grant execute on function public.accept_follow_request(uuid) to authenticated;

-- activity status ("active now"), Instagram rules: hidden if either side turned it off; only between people who follow each other one way or the other
create or replace function public.touch_presence() returns void language sql security definer set search_path to '' as $$
  insert into public.privacy_settings (id, last_active_at) values (auth.uid(), now())
  on conflict (id) do update set last_active_at = case when public.privacy_settings.activity_status then now() else null end $$;
grant execute on function public.touch_presence() to authenticated;

create or replace function public.presence(p_ids uuid[]) returns table (id uuid, online boolean, last_active_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select u.id, (s.last_active_at > now() - interval '3 minutes'), s.last_active_at
  from unnest(p_ids[1:200]) u(id) join public.privacy_settings s on s.id = u.id
  where auth.uid() is not null and (private.pset(auth.uid())).activity_status and s.activity_status and s.last_active_at is not null
    and not private.blocked_between(auth.uid(), u.id)
    and (private.follows(auth.uid(), u.id) or private.follows(u.id, auth.uid())) $$;
grant execute on function public.presence(uuid[]) to authenticated;
revoke execute on function public.touch_presence() from anon;
revoke execute on function public.presence(uuid[]) from anon;
