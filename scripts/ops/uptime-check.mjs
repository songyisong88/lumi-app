// LUMI / Pixeeno uptime check (read-only). Run by .github/workflows/uptime.yml every ~10 minutes.
// Each target gets up to 3 tries (20 s apart) so one slow blip does not raise an alarm.
// Exit code 1 = something is down -> the workflow run fails -> GitHub emails the repo owner.
// Needs repo secret SUPABASE_ANON_KEY (the public anon key the website already ships; never print it).
const SB = process.env.SUPABASE_URL || 'https://zjohosifusewcaqpmyra.supabase.co'
const KEY = process.env.SUPABASE_ANON_KEY || ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function site(base) {
  const r = await fetch(base + '/', { cache: 'no-store' })
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
  const html = await r.text()
  if (!html.includes('id="root"')) throw new Error('page has no app root')
  const js = html.match(/\/assets\/index-[\w-]+\.js/)
  if (!js) throw new Error('main script not referenced')
  const a = await fetch(new URL(js[0], base + '/'))
  if (a.status !== 200) throw new Error(`main script HTTP ${a.status}`)
  await a.arrayBuffer()
}
async function get(url, headers = {}) {
  const r = await fetch(url, { headers })
  await r.arrayBuffer()
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const checks = [
  ['เว็บจริง (real)', () => site('https://lumi-app-11m.pages.dev')],
  ['เว็บเดโม (demo)', () => site('https://lumi-demo-50k.pages.dev')],
  ['Supabase Auth', () => get(`${SB}/auth/v1/health`, { apikey: KEY })],
  ['Supabase Database', () => get(`${SB}/rest/v1/products?select=id&limit=1`, H)],
]

if (!KEY) { console.error('SUPABASE_ANON_KEY secret is missing'); process.exit(1) }
const rows = []; let down = 0
for (const [name, fn] of checks) {
  let err = null, ms = 0
  for (let i = 1; i <= 3; i++) {
    const t = Date.now()
    try { await Promise.race([fn(), sleep(15000).then(() => { throw new Error('timeout 15s') })]); err = null; ms = Date.now() - t; break }
    catch (e) { err = String(e?.message ?? e); ms = Date.now() - t; if (i < 3) await sleep(20000) }
  }
  if (err) down++
  rows.push(`| ${name} | ${err ? '❌ ล่ม: ' + err : '✅ ปกติ'} | ${ms} ms |`)
  console.log(`${err ? 'DOWN' : 'OK  '} ${name} ${err ?? ''} (${ms} ms)`)
}
const summary = ['### LUMI uptime', '', '| ระบบ | สถานะ | เวลาตอบ |', '|---|---|---|', ...rows].join('\n')
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
process.exit(down ? 1 : 0)
