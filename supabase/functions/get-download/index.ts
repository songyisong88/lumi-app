// LUMI get-download: the only way to download a private deliverable.
// 1) as the caller: public.download_check(file) re-checks the right *now* (not refunded/revoked, scan ok) and logs it
// 2) as the server: signs a URL that expires in 10 minutes
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const TTL = 600

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
    if (error || !f) return json({ error: 'no access to this file' }, 403)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: s, error: se } = await admin.storage.from(f.bucket).createSignedUrl(f.path, TTL, { download: f.name })
    if (se || !s) return json({ error: 'could not sign' }, 500)
    return json({ url: s.signedUrl, expires_in: TTL })
  } catch (_e) {
    return json({ error: 'bad request' }, 400)
  }
})
