// LUMI deep-scan worker (ClamAV). NOT deployed. Runs on a small always-on server (e.g. Hetzner CX22 + clamd).
// Loop: claim a deep scan job -> download the file with the service key -> clamdscan -> report clean / infected / error.
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server only, never in the app), optional R2_* when files live on R2,
//      CLAMD_HOST (default 127.0.0.1), CLAMD_PORT (3310), WORKER_ID, POLL_MS (15000), MAX_BYTES (524288000)
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const WORKER = process.env.WORKER_ID || `clamav-${process.pid}`;
const POLL = +(process.env.POLL_MS || 15000), MAX = +(process.env.MAX_BYTES || 524288000);
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rpc(fn, body) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn} ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

async function download(job) {
  if (job.store === 'r2') throw new Error('R2 download: add an S3 GetObject here (aws4fetch) when files move to R2');
  const r = await fetch(`${URL_}/storage/v1/object/${job.bucket}/${job.path.split('/').map(encodeURIComponent).join('/')}`, { headers: H });
  if (!r.ok) throw new Error(`download ${r.status}`);
  return r.body; // stream, never fully in memory
}

// clamd INSTREAM protocol: zINSTREAM\0 then <uint32 length><chunk>... then <0>; reply "stream: OK" or "stream: <sig> FOUND"
function clamScan(stream) {
  return new Promise(async (resolve, reject) => {
    const s = net.connect(+(process.env.CLAMD_PORT || 3310), process.env.CLAMD_HOST || '127.0.0.1');
    let reply = '', sent = 0;
    s.on('data', d => reply += d); s.on('error', reject);
    s.on('end', () => {
      const m = reply.replace(/\0/g, '').trim();
      if (/: OK$/.test(m)) resolve({ status: 'clean' });
      else if (/FOUND$/.test(m)) resolve({ status: 'infected', signature: m.replace(/^stream: /, '').replace(/ FOUND$/, '') });
      else reject(new Error(`clamd: ${m}`));
    });
    s.write('zINSTREAM\0');
    try {
      for await (const chunk of stream) {
        sent += chunk.length; if (sent > MAX) { s.destroy(); return reject(new Error('file too large for scanner')); }
        const len = Buffer.alloc(4); len.writeUInt32BE(chunk.length); s.write(len); s.write(chunk);
      }
      s.end(Buffer.alloc(4));
    } catch (e) { s.destroy(); reject(e); }
  });
}

async function once() {
  const jobs = await rpc('scan_claim', { p_tier: 'deep', p_engine: 'clamav', p_worker: WORKER });
  if (!jobs?.length) return false;
  const job = jobs[0], t0 = Date.now();
  try {
    const res = await clamScan(await download(job));
    await rpc('scan_finish', { p_job: job.job_id, p_status: res.status, p_signature: res.signature ?? null, p_detail: { ms: Date.now() - t0, worker: WORKER } });
    console.log(new Date().toISOString(), job.name, res.status, res.signature || '');
  } catch (e) {
    await rpc('scan_finish', { p_job: job.job_id, p_status: 'error', p_signature: null, p_detail: { error: String(e.message || e).slice(0, 300) } });
    console.error(new Date().toISOString(), job.name, 'error', e.message);
  }
  return true;
}

for (;;) {
  try { if (!(await once())) await sleep(POLL); } catch (e) { console.error('loop', e.message); await sleep(POLL); }
}
