# LUMI ops: backups

| What | How | Needs |
|---|---|---|
| Full backup (schema + data + auth users) | `scripts/ops/backup.sh ~/lumi-backups` (pg_dump, gzip, sha256, keeps 14 days) | `SUPABASE_DB_URL` (database password) + `pg_dump` 17 |
| Prove a backup restores | `scripts/ops/restore-check.sh ~/lumi-backups/lumi-….sql.gz` (throwaway docker Postgres) | docker |
| Snapshot without the DB password | run `backup-data.sql` and `backup-schema.sql` via Supabase MCP `execute_sql` (or SQL editor), then `save-backup.py <result-file> data|schema` | Supabase MCP access |

Notes
- Supabase Free has **no automatic backups**; Pro ($25/mo) adds daily backups (7 days), PITR is an add-on.
- Files in Storage buckets are not inside a database dump. Copy them with `supabase storage cp -r ss:///deliverables ./deliverables --experimental`
  or (after the R2 move) `rclone sync`. The data snapshot lists every object (bucket, name, size) so you can check nothing is missing.
- Backups contain personal data (PDPA): keep them `chmod 600`, encrypted disk, never in git.
- `backup-data.sql` skips `private.rate_events` (short-lived counters) and does not include `auth.users`; use `backup.sh` for a complete restore.
- Soft-deleted rows stay restorable for 30 days in `private.trash` (`select public.restore_deleted('<trash id>')`, admin only).
