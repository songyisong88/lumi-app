-- LUMI schema snapshot (functions, policies, triggers, grants, columns) — the "how it works" half of a backup.
select jsonb_build_object(
  'taken_at', now(),
  'migrations', (select jsonb_agg(version || ' ' || name order by version) from supabase_migrations.schema_migrations),
  'functions', (select jsonb_agg(jsonb_build_object('n', p.oid::regprocedure::text, 'def', pg_get_functiondef(p.oid), 'acl', p.proacl::text))
                from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prokind = 'f'),
  'policies', (select jsonb_agg(to_jsonb(x)) from pg_policies x where schemaname in ('public', 'storage')),
  'triggers', (select jsonb_agg(jsonb_build_object('t', tgrelid::regclass::text, 'def', pg_get_triggerdef(oid))) from pg_trigger where not tgisinternal
               and tgrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace, 'private'::regnamespace, 'auth'::regnamespace))),
  'columns', (select jsonb_agg(jsonb_build_object('t', table_schema || '.' || table_name, 'c', column_name, 'type', data_type, 'udt', udt_name, 'null', is_nullable, 'def', column_default))
              from information_schema.columns where table_schema in ('public', 'private')),
  'constraints', (select jsonb_agg(jsonb_build_object('t', conrelid::regclass::text, 'n', conname, 'def', pg_get_constraintdef(oid)))
                  from pg_constraint where connamespace in ('public'::regnamespace, 'private'::regnamespace)),
  'grants', (select jsonb_agg(to_jsonb(g)) from information_schema.role_table_grants g where table_schema in ('public', 'private') and grantee in ('anon', 'authenticated', 'service_role')),
  'buckets', (select jsonb_agg(to_jsonb(b)) from storage.buckets b)
) as schema;
