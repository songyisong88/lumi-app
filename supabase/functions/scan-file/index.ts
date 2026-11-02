// LUMI scan-file: basic safety check for an uploaded deliverable, then move it from the private
// `quarantine` bucket to the private `deliverables` bucket. This is NOT a full antivirus yet:
// it checks size, the EICAR test signature, executable content hidden behind a non-program
// extension, and records a SHA-256. A real scanner (e.g. ClamAV) plugs in at `scan()` later.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
const PROGRAM_EXT = new Set(['exe', 'msi', 'dmg', 'pkg', 'apk', 'appimage', 'deb', 'rpm', 'zip', '7z', 'rar', 'jar', 'aab', 'ipa', 'xapk'])
const MAX = 50 * 1024 * 1024

function scan(name: string, bytes: Uint8Array): string | null {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)))
  if (head.includes(EICAR) || new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 1 << 20))).includes(EICAR)) return 'พบรูปแบบไวรัสทดสอบ (EICAR)'
  const isPE = bytes[0] === 0x4d && bytes[1] === 0x5a
  const isELF = bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46
  const isMachO = [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(new DataView(bytes.buffer, bytes.byteOffset, Math.min(4, bytes.length)).getUint32(0, false))
  if ((isPE || isELF || isMachO) && !PROGRAM_EXT.has(ext)) return 'ไฟล์เป็นโปรแกรมแต่ใช้นามสกุลอื่น'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const url = Deno.env.get('SUPABASE_URL')!
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await user.auth.getUser()
    if (!u?.user) return json({ error: 'sign in first' }, 401)
    const { file_id } = await req.json()
    // RLS: the caller can only see their own upload rows
    const { data: f } = await user.from('product_files').select('id, owner_id, bucket, path, name, size_bytes, scan').eq('id', file_id).maybeSingle()
    if (!f || f.owner_id !== u.user.id) return json({ error: 'file not found' }, 404)
    if (f.scan === 'ok') return json({ scan: 'ok' })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await admin.from('product_files').update({ scan: 'scanning' }).eq('id', f.id)
    const { data: blob, error: dErr } = await admin.storage.from('quarantine').download(f.path)
    if (dErr || !blob) { await admin.from('product_files').update({ scan: 'fail' }).eq('id', f.id); return json({ scan: 'fail', reason: 'อ่านไฟล์ไม่ได้' }) }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let reason = bytes.length === 0 ? 'ไฟล์ว่าง' : bytes.length > MAX ? 'ไฟล์ใหญ่เกิน 50 MB' : scan(f.name, bytes)
    if (reason) {
      await admin.storage.from('quarantine').remove([f.path])
      await admin.from('product_files').update({ scan: 'fail' }).eq('id', f.id)
      return json({ scan: 'fail', reason })
    }
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((b) => b.toString(16).padStart(2, '0')).join('')
    const dest = `files/${f.id}/${f.name.replace(/[^\w.\-ก-๙]+/g, '_').slice(-120)}`
    const { error: upErr } = await admin.storage.from('deliverables').upload(dest, bytes, { contentType: blob.type || 'application/octet-stream', upsert: true })
    if (upErr) { await admin.from('product_files').update({ scan: 'pending' }).eq('id', f.id); return json({ error: 'move failed' }, 500) }
    await admin.storage.from('quarantine').remove([f.path])
    await admin.from('product_files').update({ bucket: 'deliverables', path: dest, scan: 'ok', sha256: sha, size_bytes: bytes.length }).eq('id', f.id)
    return json({ scan: 'ok', sha256: sha })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
