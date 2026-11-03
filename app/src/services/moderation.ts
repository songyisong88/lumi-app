import { useSyncExternalStore } from 'react'
import { ALL_PRODUCTS, creatorById, setHidden } from '../data/sampleData'
import { heroOf } from '../data/productExtras'

/** Demo moderation desk (UI v2). SAMPLE queue + this device's own reports (components/Report.tsx → lumi_reports).
 *  Decisions and the log stay on this device. The log is append-only: a changed decision is a new entry. */
export type Tab = 'ai' | 'reported'
export type Act = 'approve' | 'reject' | 'auto_approve' | 'auto_hide'
export interface QItem { id: string; productId: string; tab: Tab; aiReason?: string; aiConf?: number; reports: { reason: string; n: number }[]; at: number }
export interface LogEntry { id: string; at: number; act: Act; productId: string; by: 'you' | 'ai' | 'system'; reason?: string; note?: string; changes?: string }
interface State { decided: Record<string, Act>; log: LogEntry[] }

export const AUTO_HIDE_AT = 3
export const REJECT_REASONS = [
  'ภาพตัวอย่างไม่ตรงกับไฟล์ที่ผู้ซื้อจะได้รับ',
  'มีโลโก้หรือตัวละครของแบรนด์อื่น อาจละเมิดลิขสิทธิ์',
  'ข้อมูลสิทธิ์ใช้งานหรือวิธีใช้ยังไม่ชัด',
  'ไฟล์ไม่ผ่านการสแกนความปลอดภัย',
]
const H = 3600_000
const day0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
const SAMPLE: QItem[] = [
  { id: 'q1', productId: 'p12', tab: 'ai', aiReason: 'ภาพตัวอย่างอาจไม่ตรงกับไฟล์ที่ผู้ซื้อจะได้รับ (สีและสัดส่วนต่างกัน)', aiConf: 0.62, reports: [], at: Date.now() - 0.4 * H },
  { id: 'q2', productId: 'n04', tab: 'ai', aiReason: 'อาจมีตัวละครที่คล้ายของแบรนด์อื่น', aiConf: 0.55, reports: [], at: Date.now() - 1.2 * H },
  { id: 'q3', productId: 'p22', tab: 'ai', aiReason: 'ยังไม่บอกสิทธิ์ใช้งานเชิงพาณิชย์ให้ชัด', aiConf: 0.58, reports: [], at: Date.now() - 2.5 * H },
  { id: 'r1', productId: 'p09', tab: 'reported', reports: [{ reason: 'คล้ายผลงานของคนอื่น', n: 2 }, { reason: 'ภาพตัวอย่างไม่ตรงกับไฟล์', n: 1 }], at: Date.now() - 3 * H },
  { id: 'r2', productId: 'p24', tab: 'reported', reports: [{ reason: 'ราคาหรือรายละเอียดไม่ตรง', n: 1 }], at: Date.now() - 5 * H },
]
const SAMPLE_LOG: LogEntry[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, at: day0() + (8 + i) * H / 2, act: 'auto_approve' as Act, productId: ['p01', 'p02', 'p15', 'p16', 'p17', 'p19'][i], by: 'ai' as const })),
  { id: 's9', at: day0() - 20 * H, act: 'reject', productId: 'p10', by: 'you', reason: REJECT_REASONS[2] },
  { id: 's8', at: day0() - 21 * H, act: 'approve', productId: 'p07', by: 'you' },
]
const KEY = 'lumi_mod_v1'
const load = (): State => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.log) return s } catch { /* */ } return { decided: {}, log: [] } }
let state = load()
const subs = new Set<() => void>()
function commit(s: State) {
  state = s
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage full: still works this session */ }
  syncHidden()
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f) }

/** Reports made on this device (product target), merged into the queue. */
function localReports(): Record<string, { reason: string; n: number }[]> {
  const out: Record<string, { reason: string; n: number }[]> = {}
  try {
    for (const r of JSON.parse(localStorage.getItem('lumi_reports') || '[]') as { target: string; id: string; reason: string }[]) {
      if (r.target !== 'product') continue
      const l = (out[r.id] ??= []); const x = l.find((y) => y.reason === r.reason)
      if (x) x.n++; else l.push({ reason: r.reason, n: 1 })
    }
  } catch { /* */ }
  return out
}
export function queue(): QItem[] {
  const local = localReports()
  const items = SAMPLE.map((q) => ({ ...q, reports: [...q.reports] }))
  for (const [pid, reps] of Object.entries(local)) {
    if (!ALL_PRODUCTS.some((p) => p.id === pid)) continue
    const q = items.find((x) => x.productId === pid)
    if (q) { for (const r of reps) { const y = q.reports.find((z) => z.reason === r.reason); if (y) y.n += r.n; else q.reports.push(r) } if (q.tab === 'ai') q.tab = 'reported' }
    else items.push({ id: `L${pid}`, productId: pid, tab: 'reported', reports: reps, at: Date.now() })
  }
  return items
}
export const reportCount = (q: QItem) => q.reports.reduce((a, r) => a + r.n, 0)
export const autoHidden = (q: QItem) => q.tab === 'reported' && reportCount(q) >= AUTO_HIDE_AT
export const pending = () => queue().filter((q) => !state.decided[q.productId])

/** Auto-hide: a listing with 3+ reports leaves the shop until an admin decides (logged once, by the system). */
function syncHidden() {
  const hide = Object.keys(state.decided).filter((pid) => state.decided[pid] === 'reject')
  for (const q of queue()) if (!state.decided[q.productId] && autoHidden(q)) hide.push(q.productId)
  setHidden(hide)
}
function ensureAutoLog() {
  const add: LogEntry[] = []
  for (const q of queue()) if (autoHidden(q) && !state.log.some((l) => l.act === 'auto_hide' && l.productId === q.productId)) {
    add.push({ id: `h${q.productId}${Date.now()}`, at: q.at, act: 'auto_hide', productId: q.productId, by: 'system', reason: `ถูกรายงาน ${reportCount(q)} ครั้ง` })
  }
  if (add.length) commit({ ...state, log: [...add, ...state.log] })
}
export function initModeration() { ensureAutoLog(); syncHidden() }

export function decide(productId: string, act: 'approve' | 'reject', reason?: string, note?: string, changes?: string) {
  const e: LogEntry = { id: `d${Date.now()}`, at: Date.now(), act, productId, by: 'you', reason, note, changes }
  commit({ decided: { ...state.decided, [productId]: act }, log: [e, ...state.log] })
}
export const decisionOf = (pid: string) => state.decided[pid]
export const fullLog = (): LogEntry[] => [...state.log, ...SAMPLE_LOG].sort((a, b) => b.at - a.at)
export function todayCounts() {
  const t = day0(); const l = fullLog().filter((x) => x.at >= t)
  return { ai: l.filter((x) => x.act === 'auto_approve').length, you: l.filter((x) => x.by === 'you').length }
}
export function useModeration() { useSyncExternalStore(subscribe, () => state); return state }
export const itemInfo = (pid: string) => {
  const p = ALL_PRODUCTS.find((x) => x.id === pid)
  return { title: p?.title ?? pid, creator: p ? creatorById(p.creatorId) : undefined, image: p ? heroOf(p) : '', price: p?.price ?? 0, label: p?.label ?? '' }
}
