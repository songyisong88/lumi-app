-- 0039 (APPLIED 2026-11-03, additive): the public `previews` bucket also accepts font files,
-- so a font listing's “ลองพิมพ์” tester can load the creator's own sample font.
-- Backup of the previous list: private.buckets_backup_20261103.
-- Revert: update storage.buckets b set allowed_mime_types = k.allowed_mime_types
--         from private.buckets_backup_20261103 k where b.id = k.id;
create table if not exists private.buckets_backup_20261103 as
  select id, allowed_mime_types, file_size_limit, now() as saved_at from storage.buckets where id = 'previews';
update storage.buckets
   set allowed_mime_types = (select array_agg(distinct m order by m) from unnest(allowed_mime_types || array['font/otf','font/ttf','font/woff','font/woff2']) m)
 where id = 'previews';
