-- LUMI 0010: owner columns default to the caller; comment reply check without self-referencing RLS recursion
alter table public.favorites alter column user_id set default auth.uid();
alter table public.follows alter column follower_id set default auth.uid();
alter table public.room_members alter column user_id set default auth.uid();
alter table public.post_likes alter column user_id set default auth.uid();
alter table public.post_saves alter column user_id set default auth.uid();
alter table public.comment_likes alter column user_id set default auth.uid();
alter table public.challenge_votes alter column user_id set default auth.uid();

create or replace function private.reply_ok(p_reply uuid, p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_reply is null or exists (select 1 from public.comments c where c.id = p_reply and c.post_id = p_post)
$$;
revoke execute on function private.reply_ok(uuid, uuid) from public, anon;
grant execute on function private.reply_ok(uuid, uuid) to authenticated, service_role;

drop policy "comment on visible post" on public.comments;
create policy "comment on visible post" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.post_visible(post_id)) and (select private.reply_ok(reply_to, post_id)));
