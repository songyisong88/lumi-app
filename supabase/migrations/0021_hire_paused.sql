-- LUMI 0021: hire jobs (งานจ้าง) paused (owner 2026-11-03). Reversible: remove 'hire' from launch_rules.closed_types.
--  * products: 'hire' joins closed_types, so products_rules() refuses to publish a hire listing (TYPE_CLOSED)
--  * hire_jobs: no new hire job (start_hire / brief) while 'hire' is closed (HIRE_PAUSED)
-- Re-open: update private.settings set value = jsonb_set(value, '{closed_types}', (value->'closed_types') - 'hire') where key = 'launch_rules';
update private.settings
   set value = jsonb_set(value, '{closed_types}',
     (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(coalesce(value->'closed_types', '[]'::jsonb) || '["hire"]'::jsonb) x))
 where key = 'launch_rules';

create or replace function private.hire_jobs_paused() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.bypass() then return new; end if;
  if coalesce(private.rule('closed_types') ? 'hire', false) then
    raise exception 'HIRE_PAUSED' using errcode = 'P0001', hint = 'งานจ้างปิดชั่วคราว';
  end if;
  return new;
end $$;
drop trigger if exists hire_jobs_0_paused on public.hire_jobs;
create trigger hire_jobs_0_paused before insert on public.hire_jobs for each row execute function private.hire_jobs_paused();
