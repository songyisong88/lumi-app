#!/usr/bin/env bash
# LUMI full database backup (schema + data) with pg_dump. Needs the database connection string:
#   export SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
# (Supabase dashboard -> Project Settings -> Database -> Connection string; keep it secret, never commit it.)
# Usage: scripts/ops/backup.sh [backup_dir]   — keeps 14 days of backups. Safe to run from cron / a routine.
set -euo pipefail
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL first}"
DIR="${1:-$HOME/lumi-backups}"; KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$DIR"; chmod 700 "$DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$DIR/lumi-$STAMP.sql.gz"
# public + private app schemas, auth users and storage metadata (the files themselves live in the buckets)
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --quote-all-identifiers \
  --schema=public --schema=private --schema=auth --schema=storage \
  --exclude-table-data='private.rate_events' | gzip -9 > "$OUT.part"
mv "$OUT.part" "$OUT"; chmod 600 "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
find "$DIR" -name 'lumi-*.sql.gz*' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
