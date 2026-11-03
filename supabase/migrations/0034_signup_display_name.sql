-- 0034 sign-up display name (backend only, no front-end change)
-- Bug: the sign-up form sends the entered name as user metadata 'display_name'
--   (sb.auth.signUp({ options: { data: { display_name } } })), but the profile trigger only read
--   'full_name' / 'name', so every email sign-up got the default 'ผู้ใช้ LUMI'.
-- Fix: read 'display_name' first, then 'full_name' / 'name' (OAuth), then the default.
--   Name is trimmed, control characters removed, cut to 60 chars (profiles check is 1..60).
-- Backfill: only the owner account songyisong88@gmail.com, whose sign-up metadata is 'ซ้งอี้' and whose
--   profile still holds the untouched default. No other profile is changed (LUMI OFFICIAL untouched).
-- Backup of the old function + old row: /workspace/lumi-backups/2026-11-03_before_0034_signup_display_name.md

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  nm := coalesce(
          nullif(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'display_name', ''), '[[:cntrl:]]', '', 'g')), ''),
          nullif(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', ''), '[[:cntrl:]]', '', 'g')), ''),
          nullif(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'name', ''), '[[:cntrl:]]', '', 'g')), ''),
          'ผู้ใช้ LUMI');
  insert into public.profiles (id, display_name, avatar_path)
  values (new.id, left(nm, 60), null)
  on conflict (id) do nothing;
  insert into public.profile_private (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

update public.profiles p
   set display_name = left(trim(u.raw_user_meta_data->>'display_name'), 60)
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'songyisong88@gmail.com'
   and p.display_name = 'ผู้ใช้ LUMI'
   and nullif(trim(u.raw_user_meta_data->>'display_name'), '') is not null;
