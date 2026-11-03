/** Which public preview files (previews bucket, <me>/samples/) are no longer used by any of my listings.
 *  Pure functions (no app imports) so the decision can be unit-tested with plain Node. */
export interface StoredObject { name: string; created_at?: string | null }
/** File names under `<me>/samples/` mentioned anywhere in the given JSON text. */
export function sampleRefs(texts: string[], me: string): Set<string> {
  const out = new Set<string>()
  const re = new RegExp(`${me.replace(/[^\w-]/g, '')}/samples/([\\w.-]+)`, 'g')
  for (const t of texts) for (const m of t.matchAll(re)) out.add(m[1])
  return out
}
/** Storage path → file name, only for my own samples folder. */
export function ownSampleName(urlOrPath: string, me: string): string | null {
  const m = new RegExp(`(?:^|/)${me.replace(/[^\w-]/g, '')}/samples/([\\w.-]+)$`).exec(urlOrPath.split('?')[0])
  return m ? m[1] : null
}
/** Removed files are deleted at once when nothing references them; other unreferenced files only when older than minAgeMs
 *  (a draft on another device may still hold a fresh upload). */
export function orphanPreviews(objects: StoredObject[], refs: Set<string>, now: number, opts: { removed?: string[]; minAgeMs: number }): string[] {
  const removed = new Set(opts.removed ?? [])
  return objects.filter((o) => {
    if (!o.name || o.name.startsWith('.') || refs.has(o.name)) return false
    if (removed.has(o.name)) return true
    const t = o.created_at ? Date.parse(o.created_at) : NaN
    return Number.isFinite(t) && now - t > opts.minAgeMs
  }).map((o) => o.name)
}
