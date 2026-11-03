#!/usr/bin/env bash
# Proves a backup is usable: restores it into a throwaway local Postgres (docker) and counts rows. Never touches production.
set -euo pipefail
F="${1:?usage: restore-check.sh lumi-YYYY-MM-DD_HHMM.sql.gz}"
sha256sum -c "$F.sha256"
docker run -d --rm --name lumi-restore-check -e POSTGRES_PASSWORD=check -p 55432:5432 postgres:17 >/dev/null
trap 'docker stop lumi-restore-check >/dev/null' EXIT
sleep 6
export PGPASSWORD=check
psql -h localhost -p 55432 -U postgres -qc 'create role anon; create role authenticated; create role service_role;' || true
gunzip -c "$F" | psql -h localhost -p 55432 -U postgres -q -v ON_ERROR_STOP=0 >/dev/null 2>restore-errors.log || true
psql -h localhost -p 55432 -U postgres -c "select 'products' t, count(*) from public.products union all select 'profiles', count(*) from public.profiles union all select 'orders', count(*) from public.orders"
echo "restore errors (expected: a few Supabase-only extensions/roles): $(wc -l < restore-errors.log) lines in restore-errors.log"
