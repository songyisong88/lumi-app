# LUMI deep-scan worker (ClamAV) — scaffold, not deployed

Program-type listings (sw / game / bot) and program files (.exe, .apk, .zip with programs, …) wait at
`scan_jobs.tier = 'deep'` until this worker reports `clean`. Until it runs, such listings **cannot be approved and
their files cannot be downloaded** (SCAN_REQUIRED / SCAN_PENDING). To pause the gate instead, set
`settings.scan.enforce = false` (SQL: `update public.settings set value = jsonb_set(value,'{enforce}','false') where key='scan'`).

## Run (≈ €4–5/month Hetzner CX22, Ubuntu 24.04)
```bash
apt install -y clamav-daemon nodejs && systemctl enable --now clamav-freshclam clamav-daemon
export SUPABASE_URL=https://zjohosifusewcaqpmyra.supabase.co SUPABASE_SERVICE_ROLE_KEY=...   # server only
node scripts/scan-worker/worker.mjs        # or a systemd unit with Restart=always
```
Test: upload the EICAR test string as a `.exe` deliverable → job becomes `infected`, file `scan = fail`, owner notified.
The service key bypasses RLS: keep it only on this server (env file chmod 600), never in the app.
