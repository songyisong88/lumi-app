-- 0033 owner admin grant (backend only, no front-end change)
-- The owner (songyisong88@gmail.com) gets the top staff role ('admin' = every staff power) the moment an
-- auth account with that email exists AND its email is confirmed. Today no such account exists, so this
-- installs a one-shot grant on auth.users. Safeguards:
--   * only a CONFIRMED email counts (an unconfirmed sign-up with the owner's address gets nothing)
--   * one-shot: after the first grant the address is moved from 'pending' to 'granted', so a later/different
--     account with the same address (e.g. after deletion) never gets admin automatically
--   * never blocks a sign-up: any error inside the grant is turned into a warning
--   * the grant goes through admin_roles, so the existing audit trigger logs 'role.granted'
-- Changing the list later: update private.settings key 'owner_admins' (service role / SQL editor only).

insert into private.settings (key, value)
values ('owner_admins', '{"pending": ["songyisong88@gmail.com"], "granted": []}'::jsonb)
on conflict (key) do nothing;

create or replace function private.grant_owner_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cfg jsonb; em text := lower(trim(coalesce(new.email, '')));
begin
  if new.email_confirmed_at is null or em = '' then return null; end if;
  select value into cfg from private.settings where key = 'owner_admins' for update;
  if cfg is null or not coalesce(cfg -> 'pending' ? em, false) then return null; end if;
  begin
    insert into public.admin_roles (user_id, role, granted_by) values (new.id, 'admin', null) on conflict do nothing;
    update private.settings
       set value = jsonb_build_object(
             'pending', coalesce((select jsonb_agg(x) from jsonb_array_elements_text(cfg -> 'pending') x where x <> em), '[]'::jsonb),
             'granted', coalesce(cfg -> 'granted', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('email', em, 'user_id', new.id, 'at', now())))
     where key = 'owner_admins';
  exception when others then
    raise warning 'owner admin grant skipped: %', sqlerrm;
  end;
  return null;
end $$;
revoke all on function private.grant_owner_admin() from public, anon, authenticated;

drop trigger if exists lumi_owner_admin on auth.users;
create trigger lumi_owner_admin after insert or update of email, email_confirmed_at on auth.users
  for each row execute function private.grant_owner_admin();

-- if the owner account already exists and is confirmed, grant now (no-op today)
do $$
declare u record;
begin
  for u in select id, email, email_confirmed_at from auth.users
           where lower(email) = 'songyisong88@gmail.com' and email_confirmed_at is not null loop
    update auth.users set email_confirmed_at = email_confirmed_at where id = u.id;  -- fires the trigger once
  end loop;
end $$;
