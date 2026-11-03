-- 0036 grants for 0035 (this project uses column-level grants; new columns/tables start with none)
grant insert (audience, comments_off, hide_likes, pinned_at, alt_texts, location) on public.posts to authenticated;
grant update (audience, comments_off, hide_likes, pinned_at, archived_at, alt_texts, location) on public.posts to authenticated;
grant insert (audience, allow_replies) on public.stories to authenticated;
grant update (audience, allow_replies) on public.stories to authenticated;
drop policy if exists "edit own story settings" on public.stories;
create policy "edit own story settings" on public.stories for update using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
grant update (is_private) on public.profiles to authenticated;
grant select, insert (id, allow_comments, allow_tags, allow_mentions, hidden_words, activity_status),
  update (allow_comments, allow_tags, allow_mentions, hidden_words, activity_status) on public.privacy_settings to authenticated;
grant select, insert (friend_id), delete on public.close_friends to authenticated;
grant select, insert (target_id), delete on public.story_hide to authenticated;
grant select, insert (target_id), delete on public.follow_requests to authenticated;
grant select, insert (title), update (title), delete on public.story_highlights to authenticated;
grant select on public.story_highlights to anon;
grant select, insert (highlight_id, story_id), delete on public.story_highlight_items to authenticated;
grant select on public.story_highlight_items to anon;
