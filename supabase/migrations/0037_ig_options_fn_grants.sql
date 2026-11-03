-- 0037 policy helper functions must be executable by the API roles (like the existing private.* helpers)
grant execute on function private.follows(uuid, uuid), private.is_private(uuid), private.is_close_friend(uuid, uuid), private.pset(uuid),
  private.audience_ok(text, uuid), private.can_see_post(uuid, text, text, timestamptz), private.can_comment(uuid),
  private.can_see_story(uuid, text, timestamptz, timestamptz), private.story_ok(uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.post_likers(uuid, int), public.presence(uuid[]), public.touch_presence(), public.accept_follow_request(uuid) to service_role;
