// LUMI get-download: the only way to download a private deliverable.
// 1) as the caller: public.download_check(file) re-checks the right *now* (not refunded/revoked, scan ok) and logs it
// 2) as the server: signs a URL that expires in 10 minutes
import { createClient } from 'npm:@supabase/supabase-js@2'
import { storeFor } from '../_shared/storage.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const TTL = 600
// access log (Computer Crimes Act s.26): the database only sees this function's IP, so the real client IP is logged here
const clientIp = (req: Request) => {
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0]
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip.trim()) ? ip.trim() : null
}
async function logAccess(req: Request, userId: string, event: string, fileId: string) {
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await admin.from('access_log').insert({
      user_id: userId, actor_role: 'user', event, target_type: 'file', target_id: fileId.slice(0, 64), source: 'edge',
      ip: clientIp(req), ip_chain: (req.headers.get('x-forwarded-for') ?? '').slice(0, 300) || null,
      country: (req.headers.get('cf-ipcountry') ?? '').slice(0, 4) || null, user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300) || null,
    })
  } catch (_e) { /* logging must never block the download */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const url = Deno.env.get('SUPABASE_URL')!
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await user.auth.getUser()
    if (!u?.user) return json({ error: 'sign in first' }, 401)
    const { file_id } = await req.json().catch(() => ({}))
    if (typeof file_id !== 'string') return json({ error: 'file_id required' }, 400)
    const { data, error } = await user.rpc('download_check', { p_file: file_id })
    const f = Array.isArray(data) ? data[0] : data
    if (error?.message === 'SCAN_PENDING') return json({ error: 'SCAN_PENDING', hint: error.hint }, 409)
    if (error || !f) { await logAccess(req, u.user.id, 'file.download_denied', file_id); return json({ error: 'no access to this file' }, 403) }
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: row } = await admin.from('product_files').select('store').eq('id', file_id).maybeSingle()
    const signed = await storeFor(row?.store, admin).signedUrl(f.bucket, f.path, TTL, f.name)
    if (!signed) return json({ error: 'could not sign' }, 500)
    await logAccess(req, u.user.id, 'file.download', file_id)
    return json({ url: signed, expires_in: TTL })
  } catch (_e) {
    return json({ error: 'bad request' }, 400)
  }
})
