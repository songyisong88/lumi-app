/** SKILL.md preview for Agent Skills listings: read it from an uploaded SKILL.md or from inside the skill ZIP. */
export const SKILL_MD_MAX = 4000

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds))
  return new Uint8Array(await out.arrayBuffer())
}
/** Text of the first SKILL.md in a ZIP (stored or deflated), or null. */
export async function skillMdFromZip(buf: ArrayBuffer): Promise<string | null> {
  const b = new Uint8Array(buf)
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) return null
  const n = u16(b, eocd + 10)
  let p = u32(b, eocd + 16)
  const hits: { name: string; method: number; size: number; local: number }[] = []
  for (let k = 0; k < n && u32(b, p) === 0x02014b50; k++) {
    const method = u16(b, p + 10), size = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), local = u32(b, p + 42)
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl))
    if (/(^|\/)skill\.md$/i.test(name) && !name.startsWith('__MACOSX')) hits.push({ name, method, size, local })
    p += 46 + nl + xl + cl
  }
  hits.sort((a, z) => a.name.split('/').length - z.name.split('/').length)
  const h = hits[0]
  if (!h || u32(b, h.local) !== 0x04034b50) return null
  const start = h.local + 30 + u16(b, h.local + 26) + u16(b, h.local + 28)
  const raw = b.subarray(start, start + h.size)
  const data = h.method === 0 ? raw : h.method === 8 ? await inflateRaw(raw) : null
  return data ? new TextDecoder().decode(data) : null
}
/** Public excerpt: the front matter and the first part of the instructions. */
export const skillExcerpt = (md: string) => {
  const t = md.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
  if (t.length <= SKILL_MD_MAX) return t
  const cut = t.slice(0, SKILL_MD_MAX)
  return cut.slice(0, Math.max(cut.lastIndexOf('\n'), SKILL_MD_MAX - 200)).trimEnd() + '\n…'
}
