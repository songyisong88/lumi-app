#!/usr/bin/env python3
"""Save the JSON returned by backup-data.sql / backup-schema.sql (MCP execute_sql result file) as a dated, private backup.
usage: save-backup.py <mcp-result-file> <data|schema> [backup_dir]"""
import json, os, re, sys, gzip, hashlib, datetime, pathlib
src, kind = sys.argv[1], sys.argv[2]
out_dir = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else os.path.expanduser('~/lumi-backups')); out_dir.mkdir(parents=True, exist_ok=True); os.chmod(out_dir, 0o700)
raw = open(src, encoding='utf-8').read()
try:
    raw = json.loads(raw).get('result', raw)                 # MCP wrapper {"result": "...<untrusted-data-..>[rows]</untrusted-data-..>..."}
except (ValueError, AttributeError):
    pass
m = re.search(r'<untrusted-data-[^>]*>\s*(\[.*\])\s*</untrusted-data', raw, re.S) or re.search(r'(\[.*\])', raw, re.S)
rows = json.loads(m.group(1))
payload = rows[0].get('backup') or rows[0].get('schema') or rows[0]
stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M')
f = out_dir / f'lumi-{kind}-{stamp}.json.gz'
with gzip.open(f, 'wt', encoding='utf-8') as g: json.dump(payload, g, ensure_ascii=False)
os.chmod(f, 0o600)
(out_dir / (f.name + '.sha256')).write_text(hashlib.sha256(f.read_bytes()).hexdigest() + '  ' + f.name + '\n')
n = sum(len(v) for v in payload.values() if isinstance(v, list)) if isinstance(payload, dict) else 0
cutoff = datetime.datetime.now() - datetime.timedelta(days=int(os.environ.get('KEEP_DAYS', '14')))
for old in out_dir.glob(f'lumi-{kind}-*.json.gz*'):
    if datetime.datetime.fromtimestamp(old.stat().st_mtime) < cutoff: old.unlink()
print(f'saved {f} ({n} items)')
