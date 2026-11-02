-- LUMI 0005: community (rooms, posts, comments, likes, saves, challenges, entries, votes)
create table public.rooms (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name text not null check (char_length(name) <= 60),
  icon text not null default 'sparkle',
  color text not null default '#6C2BD9',
  bg text not null default '#F3ECFF',
  description text not null default '' check (char_length(description) <= 300),
  cover text check (char_length(cover) <= 300),
  rules text[] not null default '{}',
  member_count int not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table public.room_members (
  room_id text not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  room_id text references public.rooms(id) on delete set null,
  tag text not null default 'โชว์ผลงาน' check (tag in ('โชว์ผลงาน','ความรู้','เบื้องหลัง','ถาม-ตอบ','แจกฟรี')),
  body text not null check (char_length(body) between 1 and 5000),
  images text[] not null default '{}' check (cardinality(images) <= 10),
  product_ids uuid[] not null default '{}' check (cardinality(product_ids) <= 6),
  prompt text check (char_length(prompt) <= 4000),
  code text[] check (cardinality(code) <= 20),
  hire_button boolean not null default false,
  like_count int not null default 0,
  comment_count int not null default 0,
  share_count int not null default 0,
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_feed_idx on public.posts (status, created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_room_idx on public.posts (room_id, created_at desc);
create trigger posts_touch before update on public.posts for each row execute function private.touch_updated_at();

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id);
create table public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_saves_user_idx on public.post_saves (user_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reply_to uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  like_count int not null default 0,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_author_idx on public.comments (author_id);
create index comments_reply_idx on public.comments (reply_to);
create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);
create index comment_likes_user_idx on public.comment_likes (user_id);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  title text not null check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 2000),
  room_id text references public.rooms(id) on delete set null,
  cover text,
  prize text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  voting_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at and ends_at <= voting_ends_at)
);
create index challenges_room_idx on public.challenges (room_id);
create table public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  image text not null check (char_length(image) <= 300),
  caption text check (char_length(caption) <= 300),
  vote_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index challenge_entries_user_idx on public.challenge_entries (user_id);
create index challenge_entries_post_idx on public.challenge_entries (post_id);
create index challenge_entries_rank_idx on public.challenge_entries (challenge_id, vote_count desc);
create table public.challenge_votes (
  entry_id uuid not null references public.challenge_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index challenge_votes_user_idx on public.challenge_votes (user_id);

-- ---------- guards
create or replace function private.posts_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.like_count := 0; new.comment_count := 0; new.share_count := 0; new.status := 'visible'; new.created_at := now();
  end if;
  if new.room_id is not null and (tg_op = 'INSERT' or new.room_id is distinct from old.room_id)
     and not exists (select 1 from public.room_members m where m.room_id = new.room_id and m.user_id = auth.uid()) then
    raise exception 'เข้าร่วมห้องก่อนจึงจะโพสต์ได้' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(new.images) i where i not like auth.uid()::text || '/%') then
    raise exception 'images must be files in your own previews folder' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(new.product_ids) x where not exists (select 1 from public.products p where p.id = x and p.status = 'published')) then
    raise exception 'linked products must be published' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger posts_before before insert or update on public.posts for each row execute function private.posts_before();

create or replace function private.challenge_entries_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  new.user_id := auth.uid(); new.vote_count := 0;
  if not exists (select 1 from public.challenges c where c.id = new.challenge_id and now() between c.starts_at and c.ends_at) then
    raise exception 'ยังไม่เปิดรับผลงาน หรือหมดเวลาส่งแล้ว' using errcode = '22023';
  end if;
  if new.image not like auth.uid()::text || '/%' then raise exception 'image must be in your previews folder' using errcode = '22023'; end if;
  return new;
end $$;
create trigger challenge_entries_before before insert on public.challenge_entries for each row execute function private.challenge_entries_before();

create or replace function private.challenge_votes_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  if not exists (select 1 from public.challenge_entries e join public.challenges c on c.id = e.challenge_id
                 where e.id = new.entry_id and e.user_id <> auth.uid() and now() between c.starts_at and c.voting_ends_at) then
    raise exception 'โหวตผลงานนี้ไม่ได้' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger challenge_votes_before before insert on public.challenge_votes for each row execute function private.challenge_votes_before();

-- ---------- counters + notifications
create or replace function private.community_counts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; r record; n text; au uuid;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  perform private.set_bypass(true);
  if tg_table_name = 'post_likes' then
    update public.posts set like_count = greatest(like_count + d, 0) where id = r.post_id returning author_id into au;
    if tg_op = 'INSERT' then
      select display_name into n from public.profiles where id = r.user_id;
      perform private.notify(au, 'like', coalesce(n, 'มีคน') || ' ถูกใจโพสต์ของคุณ', '/community/post/' || r.post_id, r.user_id);
    end if;
  elsif tg_table_name = 'comments' then
    update public.posts set comment_count = greatest(comment_count + d, 0) where id = r.post_id returning author_id into au;
    if tg_op = 'INSERT' then
      select display_name into n from public.profiles where id = r.author_id;
      perform private.notify(au, 'community', coalesce(n, 'มีคน') || ' แสดงความคิดเห็นในโพสต์ของคุณ', '/community/post/' || r.post_id, r.author_id);
      if r.reply_to is not null then
        perform private.notify((select c.author_id from public.comments c where c.id = r.reply_to), 'community', coalesce(n, 'มีคน') || ' ตอบกลับความคิดเห็นของคุณ', '/community/post/' || r.post_id, r.author_id);
      end if;
    end if;
  elsif tg_table_name = 'comment_likes' then
    update public.comments set like_count = greatest(like_count + d, 0) where id = r.comment_id;
  elsif tg_table_name = 'room_members' then
    update public.rooms set member_count = greatest(member_count + d, 0) where id = r.room_id;
  elsif tg_table_name = 'challenge_votes' then
    update public.challenge_entries set vote_count = greatest(vote_count + d, 0) where id = r.entry_id;
  end if;
  perform private.set_bypass(false);
  return null;
end $$;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function private.community_counts();
create trigger comments_count after insert or delete on public.comments for each row execute function private.community_counts();
create trigger comment_likes_count after insert or delete on public.comment_likes for each row execute function private.community_counts();
create trigger room_members_count after insert or delete on public.room_members for each row execute function private.community_counts();
create trigger challenge_votes_count after insert or delete on public.challenge_votes for each row execute function private.community_counts();

create or replace function private.post_visible(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts p where p.id = p_post and (p.status = 'visible' or p.author_id = auth.uid()))
$$;
grant execute on function private.post_visible(uuid) to anon, authenticated, service_role;

-- ---------- RLS + grants
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.challenge_votes enable row level security;

grant select on public.rooms, public.posts, public.comments, public.challenges, public.challenge_entries to anon, authenticated;
grant select, insert, delete on public.room_members, public.post_likes, public.post_saves, public.comment_likes, public.challenge_votes to authenticated;
grant insert (room_id, tag, body, images, product_ids, prompt, code, hire_button) on public.posts to authenticated;
grant update (room_id, tag, body, images, product_ids, prompt, code, hire_button) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant insert (post_id, reply_to, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant insert (challenge_id, post_id, image, caption) on public.challenge_entries to authenticated;
grant delete on public.challenge_entries to authenticated;
grant all on public.rooms, public.room_members, public.posts, public.post_likes, public.post_saves, public.comments, public.comment_likes,
  public.challenges, public.challenge_entries, public.challenge_votes to service_role;

create policy "rooms are public" on public.rooms for select to anon, authenticated using (true);
create policy "own memberships" on public.room_members for select to authenticated using (user_id = (select auth.uid()));
create policy "join room" on public.room_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy "leave room" on public.room_members for delete to authenticated using (user_id = (select auth.uid()));

create policy "visible or own posts" on public.posts for select to anon, authenticated
  using (status = 'visible' or author_id = (select auth.uid()));
create policy "write own post" on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy "edit own post" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "delete own post" on public.posts for delete to authenticated using (author_id = (select auth.uid()));

create policy "own likes" on public.post_likes for select to authenticated using (user_id = (select auth.uid()));
create policy "like visible post" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.post_visible(post_id)));
create policy "unlike" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));
create policy "own saves" on public.post_saves for select to authenticated using (user_id = (select auth.uid()));
create policy "save visible post" on public.post_saves for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.post_visible(post_id)));
create policy "unsave" on public.post_saves for delete to authenticated using (user_id = (select auth.uid()));

create policy "comments on visible posts" on public.comments for select to anon, authenticated
  using ((select private.post_visible(post_id)));
create policy "comment on visible post" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.post_visible(post_id))
    and (reply_to is null or exists (select 1 from public.comments c where c.id = reply_to and c.post_id = comments.post_id)));
create policy "edit own comment" on public.comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "delete own comment or on own post" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create policy "own comment likes" on public.comment_likes for select to authenticated using (user_id = (select auth.uid()));
create policy "like comment" on public.comment_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "unlike comment" on public.comment_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "challenges are public" on public.challenges for select to anon, authenticated using (true);
create policy "entries are public" on public.challenge_entries for select to anon, authenticated using (true);
create policy "enter challenge" on public.challenge_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy "withdraw own entry" on public.challenge_entries for delete to authenticated using (user_id = (select auth.uid()));
create policy "own votes" on public.challenge_votes for select to authenticated using (user_id = (select auth.uid()));
create policy "vote" on public.challenge_votes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "unvote" on public.challenge_votes for delete to authenticated using (user_id = (select auth.uid()));

-- rooms are app structure (from app/src/data/appSeed.ts); member counts start at 0 (real)
insert into public.rooms (id, name, icon, color, bg, description, cover, rules, sort) values
('ai','ห้องภาพ AI','image','#6C2BD9','#F3ECFF','แชร์ภาพ พรอมต์ และเทคนิคสร้างภาพด้วย AI','g_anime.jpg',array['แชร์พรอมต์ได้ แต่ห้ามขายของคนอื่น','ติดแท็กโมเดลที่ใช้ทุกครั้ง','คอมเมนต์อย่างสร้างสรรค์']::text[],1),
('newbie','มือใหม่หัดขาย','sparkle','#DB2777','#FDEBF2','ถามได้ทุกเรื่อง ตั้งราคา ถ่ายรูป ลงขายครั้งแรก','g_lotus.jpg',array['ไม่มีคำถามโง่','ห้ามสแปมลิงก์','ช่วยกันตอบ ได้แต้มชุมชน']::text[],2),
('tpl','คนทำเทมเพลต','megaphone','#2563EB','#EAF1FF','Canva Figma สไลด์ และไฟล์พิมพ์','cafe.jpg',array['บอกแอปและฟอนต์ที่ใช้','ห้ามแจกไฟล์ที่ซื้อมา']::text[],3),
('code','โค้ดและเกม','code','#4F46E5','#EEF2FF','โปรแกรม แอป เกมอินดี้ ปลั๊กอิน','c_game.jpg',array['แชร์โค้ดใส่บล็อกโค้ด','ห้ามแจกไฟล์แคร็ก']::text[],4),
('bot','บอทและระบบอัตโนมัติ','robot','#15803D','#E5F8EC','LINE OA n8n Make และ Sheets','c_bot.jpg',array['ห้ามโพสต์ API key จริง','แชร์ฟลว์เป็นรูปหรือไฟล์']::text[],5),
('sticker','คนขายสติกเกอร์ LINE','heart','#F59E0B','#FFF4DB','ออกแบบ ส่งตรวจ และโปรโมตสติกเกอร์','shiba.jpg',array['โชว์งานได้วันละ 1 โพสต์']::text[],6);
