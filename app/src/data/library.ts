import type { Asset, Purchase } from './appTypes'
import type { Product } from './types'
import { filesOf, on, sellTypeOf, specOf } from './listingSpec'
import { isRemoteId, productById } from './sampleData'
import { BRAND } from '../config'

/** Everything a buyer receives for one product/option (used at checkout and as a fallback for seed purchases). */
export function assetsFor(p: Product, opt: { optionId?: string; optionLabel?: string } = {}, key?: string): Asset[] {
  const sp = specOf(p)
  const t = sellTypeOf(p)
  const out: Asset[] = []
  if (key) out.push({ kind: 'key', title: `คีย์ใช้งาน · ${opt.optionLabel ?? '1 เครื่อง'}`, value: key })
  for (const f of filesOf(sp.files)) out.push({ kind: 'file', title: f.name, value: f.name, size: f.size })
  if (on(sp.sellPrompt) && opt.optionId !== 'img' && sp.prompt) out.push({ kind: 'prompt', title: 'พรอมต์ฉบับเต็ม', value: String(sp.prompt) })
  if (typeof sp.canvaLink === 'string' && sp.canvaLink) out.push({ kind: 'link', title: 'ลิงก์ Canva (ใช้เป็นเทมเพลต)', value: sp.canvaLink })
  if (typeof sp.webLink === 'string' && sp.webLink) out.push({ kind: 'link', title: 'ลิงก์เข้าใช้งานเว็บแอป', value: sp.webLink })
  if (typeof sp.storeLink === 'string' && sp.storeLink) out.push({ kind: 'link', title: 'ลิงก์ร้านค้าแอป', value: sp.storeLink })
  if (t === 'course') out.push({ kind: 'link', title: 'ห้องเรียนคอร์สนี้ (ตัวอย่าง)', value: `#/product/${p.id}` })
  if (!out.length) out.push({ kind: 'file', title: `${p.title.slice(0, 24)}.zip`, value: `${p.title.slice(0, 24)}.zip`, size: '' })
  return out
}

/** Assets of a purchase: stored at checkout, derived for older/seed purchases. */
export function assetsOf(b: Purchase): Asset[] {
  if (b.assets?.length) return b.assets
  // real purchases list exactly what the server granted (nothing after a refund), never sample files
  if (isRemoteId(b.id)) return b.assets ?? []
  const p = productById(b.productId)
  if (b.optionLabel === 'งานจ้าง' || !p) return [{ kind: 'file', title: `${b.title.slice(0, 18)}-final.zip`, value: `${b.title.slice(0, 18)}-final.zip`, size: '24 MB' }]
  return assetsFor(p, { optionLabel: b.optionLabel }, b.key)
}

export type LibTab = 'all' | 'file' | 'key' | 'hire'
export const LIB_TABS: { v: LibTab; label: string }[] = [{ v: 'all', label: 'ทั้งหมด' }, { v: 'file', label: 'ไฟล์' }, { v: 'key', label: 'คีย์และลิงก์' }, { v: 'hire', label: 'งานจ้าง' }]
export const inTab = (b: Purchase, tab: LibTab) => {
  if (tab === 'all') return true
  if (tab === 'hire') return b.optionLabel === 'งานจ้าง'
  const a = assetsOf(b)
  return b.optionLabel !== 'งานจ้าง' && a.some((x) => (tab === 'file' ? x.kind === 'file' : x.kind !== 'file'))
}

/** Placeholder download: a small text file standing in for the real file (no storage backend yet). */
export function downloadSample(a: Asset, b: Purchase) {
  const body = `ไฟล์ตัวอย่างจาก ${BRAND}\n\nผลงาน: ${b.title}\nไฟล์: ${a.title}\nออเดอร์: #${b.orderNo}\n\nนี่คือไฟล์ทดลอง ระบบเก็บไฟล์จริงจะเปิดพร้อมการซื้อขายจริง`
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
  const el = document.createElement('a')
  el.href = url; el.download = `${a.title.replace(/\.[a-z0-9]+$/i, '')}-ตัวอย่าง.txt`
  document.body.appendChild(el); el.click(); el.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
