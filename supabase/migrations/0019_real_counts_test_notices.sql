-- REAL site (/lumi-app/app/) must not count or show activity by test accounts (profiles.is_test, lumi-qa-*).
-- The demo site keeps using the full numbers. Server-side, so nothing depends on client filtering.
--  * posts.real_comment_count / real_like_count: same as comment_count / like_count but without test accounts.
--  * notifications.from_test: true when a test account caused a notice to a non-test account
--    (actor, or the signed-in user whose action fired the trigger, is a test account). The real site filters these out.
-- Neither column is user-writable (posts/notifications use column-level INSERT/UPDATE grants; these are not granted).

alter table public.posts add column if not exists real_comment_count integer not null default 0;
alter table public.posts add column if not exists real_like_count integer not null default 0;
alter table public.notifications add column if not exists from_test boolean not null default false;
comment on column public.posts.real_comment_count is 'comment_count without comments by test accounts (profiles.is_test); shown on the real site';
comment on column public.posts.real_like_count is 'like_count without likes by test accounts (profiles.is_test); shown on the real site';
comment on column public.notifications.from_test is 'A test account (profiles.is_test) caused this notice to a non-test account; hidden on the real site';

create or replace function private.is_test_user(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_test from public.profiles where id = p), false)
$$;
revoke all on function private.is_test_user(uuid) from public, anon, authenticated;

-- flag notices caused by test accounts
create or replace function private.notifications_flag_test() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.from_test := not private.is_test_user(new.user_id)
    and (private.is_test_user(new.actor_id) or private.is_test_user(auth.uid()));
  return new;
end $$;
revoke all on function private.notifications_flag_test() from public, anon, authenticated;
drop trigger if exists notifications_flag_test on public.notifications;
create trigger notifications_flag_test before insert on public.notifications for each row execute function private.notifications_flag_test();

-- counts: same function as before, plus the real_* columns
create or replace function private.community_counts()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; r record; n text; au uuid; rd int;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  perform private.set_bypass(true);
  if tg_table_name = 'post_likes' then
    rd := case when private.is_test_user(r.user_id) then 0 else d end;
    update public.posts set like_count = greatest(like_count + d, 0), real_like_count = greatest(real_like_count + rd, 0) where id = r.post_id returning author_id into au;
    if tg_op = 'INSERT' then
      select display_name into n from public.profiles where id = r.user_id;
      perform private.notify(au, 'like', coalesce(n, 'มีคน') || ' ถูกใจโพสต์ของคุณ', '/community/post/' || r.post_id, r.user_id);
    end if;
  elsif tg_table_name = 'comments' then
    rd := case when private.is_test_user(r.author_id) then 0 else d end;
    update public.posts set comment_count = greatest(comment_count + d, 0), real_comment_count = greatest(real_comment_count + rd, 0) where id = r.post_id returning author_id into au;
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
end $function$;

-- backfill
select private.set_bypass(true);
update public.posts p set
  real_comment_count = (select count(*) from public.comments c join public.profiles a on a.id = c.author_id where c.post_id = p.id and not a.is_test),
  real_like_count = (select count(*) from public.post_likes l join public.profiles a on a.id = l.user_id where l.post_id = p.id and not a.is_test);
select private.set_bypass(false);
update public.notifications n set from_test = true
  where not private.is_test_user(n.user_id) and private.is_test_user(n.actor_id);
