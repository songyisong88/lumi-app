/** Free sample of a data listing: the creator's own file (CSV / TSV / JSON / JSONL), kept small enough to live in the listing spec.
 *  Pure functions (no browser or app imports) so they can be unit-tested with plain Node. */
export interface SampleTable { cols: string[]; rows: string[][] }
export interface SampleData { name: string; text: string; rows: number; total: number }
export const SAMPLE_MAX_ROWS = 100
/** Bytes of sample text stored in the spec (products.spec is capped at 60 KB on the server). */
export const SAMPLE_MAX_BYTES = 12000
export const SAMPLE_TEXT_EXTS = ['csv', 'tsv', 'txt', 'json', 'jsonl']

const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase()
const bytes = (t: string) => new TextEncoder().encode(t).length
const cell = (v: unknown) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** RFC 4180 CSV (quotes, doubled quotes, newlines inside quotes). */
export function parseDelimited(text: string, sep = ','): string[][] {
  const out: string[][] = []
  let row: string[] = [], f = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c
    } else if (c === '"' && f === '') q = true
    else if (c === sep) { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = '' }
    else f += c
  }
  if (f !== '' || row.length) { row.push(f); out.push(row) }
  return out.filter((r) => r.some((x) => x.trim() !== ''))
}
const sepOf = (name: string, text: string) => {
  if (extOf(name) === 'tsv') return '\t'
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  return (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? '\t' : ','
}
function objectsToTable(xs: unknown[]): SampleTable {
  const objs = xs.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
  const cols: string[] = []
  for (const o of objs) for (const k of Object.keys(o)) if (!cols.includes(k)) cols.push(k)
  return { cols, rows: objs.map((o) => cols.map((k) => cell(o[k]))) }
}
function jsonItems(text: string): unknown[] {
  const v: unknown = JSON.parse(text)
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') { const a = Object.values(v as Record<string, unknown>).find(Array.isArray); if (a) return a as unknown[] }
  return [v]
}
const jsonlItems = (text: string) => text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as unknown)

/** Table of a sample file. Throws on malformed JSON; returns null for formats it cannot read (e.g. xlsx). */
export function parseSample(name: string, raw: string): SampleTable | null {
  const text = raw.replace(/^\uFEFF/, '')
  const e = extOf(name)
  if (e === 'json') return objectsToTable(jsonItems(text))
  if (e === 'jsonl') return objectsToTable(jsonlItems(text))
  if (e === 'csv' || e === 'tsv' || e === 'txt') {
    const [cols = [], ...rows] = parseDelimited(text, sepOf(name, text))
    return { cols: cols.map((c) => c.trim()), rows }
  }
  return null
}

const csvCell = (v: string, sep: string) => (/["\n\r]/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v)
/** First rows of the creator's file, re-written in the same format only when it had to be cut. */
function firstRows(name: string, text: string, n: number): string {
  const e = extOf(name)
  if (e === 'json') return JSON.stringify(jsonItems(text).slice(0, n), null, 1)
  if (e === 'jsonl') return text.split(/\r?\n/).filter((l) => l.trim()).slice(0, n).join('\n') + '\n'
  const sep = sepOf(name, text)
  return parseDelimited(text, sep).slice(0, n + 1).map((r) => r.map((c) => csvCell(c, sep)).join(sep)).join('\n') + '\n'
}
/** What the listing keeps: the file as uploaded when it is small, otherwise its first rows (≤ 100 rows, ≤ 12 KB). */
export function makeSample(name: string, raw: string): SampleData {
  const text = raw.replace(/^\uFEFF/, '')
  let t: SampleTable | null
  try { t = parseSample(name, text) } catch { throw new Error('ไฟล์ JSON นี้อ่านไม่ได้ (รูปแบบไม่ถูกต้อง) · ตรวจไฟล์แล้วอัปใหม่') }
  if (!t) throw new Error('อ่านไฟล์นี้เป็นตารางไม่ได้ · ใช้ CSV หรือ JSON')
  if (!t.cols.length) throw new Error('ไม่พบหัวคอลัมน์ในไฟล์ตัวอย่าง')
  const total = t.rows.length
  if (total <= SAMPLE_MAX_ROWS && bytes(text) <= SAMPLE_MAX_BYTES) return { name, text, rows: total, total }
  let n = Math.min(total, SAMPLE_MAX_ROWS), out = firstRows(name, text, n)
  while (n > 1 && bytes(out) > SAMPLE_MAX_BYTES) { n = Math.max(1, Math.floor(n * 0.8)); out = firstRows(name, text, n) }
  if (bytes(out) > SAMPLE_MAX_BYTES) throw new Error('แถวในไฟล์ตัวอย่างยาวเกินไป · ตัดให้สั้นลงแล้วอัปใหม่')
  return { name, text: out, rows: n, total }
}
/** Reads the stored sample back (spec.sampleData). */
export function sampleOf(v: unknown): SampleData | null {
  if (typeof v !== 'string' || !v) return null
  try {
    const x = JSON.parse(v) as SampleData
    return typeof x?.name === 'string' && typeof x?.text === 'string' ? x : null
  } catch { return null }
}
export const sampleMime = (name: string) => ({ csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', jsonl: 'application/jsonl' } as Record<string, string>)[extOf(name)] ?? 'text/plain'
