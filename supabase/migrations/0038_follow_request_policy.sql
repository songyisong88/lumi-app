-- 0038 follow-request policy: blocked_between is not executable by API roles, wrap it
create or replace function private.can_request_follow(p_target uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select private.is_private(p_target) and not private.blocked_between(auth.uid(), p_target) $$;
grant execute on function private.can_request_follow(uuid) to anon, authenticated, service_role;
drop policy if exists "request to follow private account" on public.follow_requests;
create policy "request to follow private account" on public.follow_requests for insert with check (
  requester_id = (select auth.uid()) and private.can_request_follow(target_id));
-- self-contained (no nested call to the locked-down blocked_between)
create or replace function private.can_request_follow(p_target uuid) returns boolean language plpgsql stable security definer set search_path to '' as $$
begin
  return coalesce((select pr.is_private from public.profiles pr where pr.id = p_target), false)
    and not exists (select 1 from public.user_blocks x where x.kind = 'block'
      and ((x.user_id = auth.uid() and x.target_id = p_target) or (x.user_id = p_target and x.target_id = auth.uid())));
end $$;
