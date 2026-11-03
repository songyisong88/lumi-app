-- LUMI 0032: follow-ups from the Supabase performance advisor after 0030/0031
create index if not exists user_sanctions_created_by_idx on private.user_sanctions (created_by);
alter table private.rate_events add column if not exists id bigint generated always as identity;
do $$ begin
  alter table private.rate_events add constraint rate_events_pkey primary key (id);
exception when invalid_table_definition then null; end $$;
