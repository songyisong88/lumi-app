-- LUMI data snapshot that works today WITHOUT the database password (run through the Supabase MCP execute_sql
-- or the SQL editor). Returns one JSON object: every row of every public/private table + storage object list.
-- Save the result with scripts/ops/save-backup.py. rate_events is skipped (short-lived counters).
select jsonb_object_agg(t.schema || '.' || t.name, t.rows) as backup
from (
  select n.nspname as schema, c.relname as name,
         (xpath('/row/j/text()', query_to_xml(format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'')::text as j from %I.%I x', n.nspname, c.relname), false, true, '')))[1]::text::jsonb as rows
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p') and c.relname not in ('rate_events')
  union all
  select 'storage', 'objects', (select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', name, 'size', metadata ->> 'size', 'mime', metadata ->> 'mimetype', 'created_at', created_at)), '[]') from storage.objects)
) t;
