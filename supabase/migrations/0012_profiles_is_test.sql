-- Test accounts (lumi-qa-*) are flagged so the REAL site (/lumi-app/app/) hides their listings, posts,
-- comments, stories and reviews. The DEMO site (/lumi-app/demo/) is the testing ground and shows them.
-- Users cannot change the flag (profiles has column-level UPDATE grants; is_test is not granted).
alter table public.profiles add column if not exists is_test boolean not null default false;
comment on column public.profiles.is_test is 'QA/test account (lumi-qa-*). The real site hides content by these accounts; the demo site shows it. Not user-editable (no column UPDATE grant).';
update public.profiles p set is_test = true from auth.users u where u.id = p.id and u.email ilike 'lumi-qa-%@%';
create or replace function public.profiles_flag_test() returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  new.is_test := coalesce(new.is_test, false) or exists (select 1 from auth.users u where u.id = new.id and u.email ilike 'lumi-qa-%@%');
  return new;
end $$;
revoke all on function public.profiles_flag_test() from public, anon, authenticated;
drop trigger if exists profiles_flag_test on public.profiles;
create trigger profiles_flag_test before insert on public.profiles for each row execute function public.profiles_flag_test();
