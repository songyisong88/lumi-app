/** Presentation helpers for the product page: options, hero image, highlights, reviews. */
import { layoutOf, pageContent, sellTypeOf, specOf, str, arr, on } from './listingSpec'
import { ALL_PRODUCTS, creatorById } from './sampleData'
import type { Product, ProductOption } from './types'

const FALLBACK: Record<string, string> = { p03: 'c_auto.jpg', p05: 'c_bot.jpg', p10: 'c_software.jpg', p13: 'robot.jpg', p18: 'c_bot.jpg' }
export const heroOf = (p: Product): string =>
  p.covers?.[0] ?? p.image?.src ?? FALLBACK[p.id] ?? ({ tool: 'c_software.jpg', bot: 'c_bot.jpg', course: 'c_course.jpg', commission: 'mascot.jpg' } as Record<string, string>)[p.kind] ?? 'g_lotus.jpg'
export const galleryOf = (p: Product): string[] => {
  if (p.covers?.length) return p.covers
  const h = heroOf(p)
  const more = ALL_PRODUCTS.filter((x) => x.id !== p.id && x.creatorId === p.creatorId && x.image).map((x) => x.image!.src)
  return [h, ...more.filter((m) => m !== h).slice(0, 2)]
}

const r10 = (n: number) => Math.max(9, Math.round(n / 10) * 10 - 1)
export function optionsOf(p: Product): ProductOption[] {
  if (p.options?.length) return p.options
  const L = layoutOf(p)
  const x = p.price
  switch (L) {
    case 'img':
      return p.hasPrompt
        ? [{ id: 'both', label: 'ภาพ + พรอมต์', sub: 'ไฟล์ความละเอียดสูง และสูตรครบ', price: x, best: 'คุ้มสุด' }, { id: 'prompt', label: 'พรอมต์อย่างเดียว', sub: 'สูตรภาพ ไม่รวมไฟล์', price: r10(x * 0.4) }]
        : [{ id: 'personal', label: 'ใช้ส่วนตัว', sub: 'ไฟล์เต็ม ไม่มีลายน้ำ', price: x }, { id: 'commercial', label: 'เชิงพาณิชย์', sub: 'ใช้ขายของ โฆษณาได้', price: r10(x * 2.2), best: 'คุ้มสุด' }]
    case 'tpl': return [{ id: 'full', label: 'ชุดเต็ม', sub: 'ลิงก์ Canva + ไฟล์ทุกแบบ', price: x }]
    case 'sw': return [
      { id: 'one', label: p.label === 'เกม' ? 'ซอร์สโค้ด 1 โปรเจกต์' : '1 เครื่อง', sub: 'ซื้อขาด · อัปเดตฟรี 1 ปี', price: x },
      { id: 'three', label: p.label === 'เกม' ? 'สิทธิ์ทีม (3 คน)' : '3 เครื่อง', sub: 'สำหรับหลายสาขา / หลายคน', price: r10(x * 2.3), best: 'คุ้มสุด' },
      { id: 'month', label: 'รายเดือน', sub: 'ยกเลิกได้ทุกเมื่อ', price: r10(x / 8), suffix: '/ด.' }]
    case 'bot': return [{ id: 'setup', label: 'ติดตั้งให้ + ใช้ 1 เดือน', sub: `ต่อเดือน ฿${r10(x / 6)}`, price: x, best: 'คุ้มสุด' }, { id: 'diy', label: 'ติดตั้งเอง (ไฟล์ + คู่มือ)', sub: 'ทำตามคลิปทีละขั้น', price: r10(x * 0.6) }]
    case 'media': return [{ id: 'social', label: 'ใช้โซเชียล / ส่วนตัว', sub: 'Reels TikTok YouTube ของคุณ', price: x }, { id: 'ads', label: 'โฆษณา + ลูกค้า', sub: 'ยิงแอด ทำงานให้ลูกค้าได้', price: r10(x * 2.5), best: 'คุ้มสุด' }]
    case 'skill': return [{ id: 'one', label: 'ใช้คนเดียว', sub: 'อัปเดตฟรีตามรอบซัพพอร์ต', price: x }, { id: 'team', label: 'ทีม (สูงสุด 5 คน)', sub: 'ติดตั้งให้ทั้งทีมได้', price: r10(x * 3), best: 'คุ้มสุด' }]
    case 'data': return [{ id: 'std', label: 'ใช้ภายในองค์กร', sub: 'วิเคราะห์ ทำแอปของตัวเอง', price: x }, { id: 'ext', label: 'ใช้ในผลิตภัณฑ์/เทรนโมเดล', sub: 'นำไปใส่สินค้าที่ขายได้', price: r10(x * 3), best: 'คุ้มสุด' }]
    case 'course': return [{ id: 'life', label: 'เรียนได้ตลอดชีพ', sub: 'ทุกตอน + ไฟล์ประกอบ + ใบรับรอง', price: x }]
    case 'font': return [{ id: 'personal', label: 'สิทธิ์ส่วนตัว', sub: 'งานส่วนตัว การบ้าน', price: x }, { id: 'commercial', label: 'เชิงพาณิชย์', sub: 'โลโก้ ป้ายร้าน สินค้า', price: r10(x * 2.5), best: 'คุ้มสุด' }]
    case 'hire': return [
      { id: 'basic', label: 'เริ่มต้น', sub: `${p.days ? Math.max(2, p.days - 2) : 3} วัน · แก้ 1 ครั้ง`, price: x },
      { id: 'std', label: 'มาตรฐาน', sub: `${p.days ?? 5} วัน · แก้ 3 ครั้ง`, price: x * 2, best: 'คุ้มสุด' },
      { id: 'pro', label: 'พรีเมียม', sub: `${(p.days ?? 5) + 2} วัน · แก้ ${p.revisions ?? 5} ครั้ง`, price: x * 4 }]
    default: return []
  }
}

/** The 3 highlight chips under the title (approved product-b “hl” row). */
export function highlightsOf(p: Product): [string, string, string][] {
  const s = specOf(p)
  const t = sellTypeOf(p)
  const L = layoutOf(p)
  const lic = arr(s.licAllowed).length > 1 ? 'เชิงพาณิชย์' : 'ใช้ส่วนตัว'
  if (L === 'free') return [['gift', 'ราคา', 'ฟรี'], ['file', 'ไฟล์', arr(s.formats).slice(0, 2).join(' · ') || 'พร้อมโหลด'], ['shield', 'สิทธิ์', lic]]
  switch (t) {
    case 'img': return [['image', 'ไฟล์', `${str(s.resolution).split(' ')[0]} ${arr(s.formats)[0] ?? ''}`], ['sparkle', 'โมเดล', on(s.sellPrompt) ? str(s.model) : 'ภาพสำเร็จ'], ['shield', 'สิทธิ์', lic]]
    case 'tpl': return [['grid', 'จำนวน', str(s.count).split(' ').slice(0, 2).join(' ')], ['pen', 'แก้ใน', arr(s.apps)[0] ?? '-'], ['file', 'ไฟล์', arr(s.formats).slice(0, 2).join(' · ')]]
    case 'sw': case 'game': return [['monitor', 'รองรับ', arr(s.platforms).slice(0, 2).join(' · ')], ['rocket', 'เวอร์ชัน', str(s.version)], ['shield', 'ไวรัส', 'สแกนแล้ว']]
    case 'bot': return [['robot', 'แพลตฟอร์ม', arr(s.platform)[0] ?? '-'], ['cal', 'ติดตั้ง', str(s.setupMode).split(' ')[0]], ['qr', 'ทดลอง', on(s.trial) ? str(s.trialDays) : 'ไม่มี']]
    case 'course': return [['play', 'บทเรียน', `${arr(s.lessons).length} ตอน · ${str(s.duration)}`], ['clock', 'ดูได้', str(s.access)], ['cap', 'ใบรับรอง', on(s.certificate) ? 'มีให้' : 'ไม่มี']]
    case 'font': return [['font', 'ชุด', str(s.count).split(' ').slice(0, 2).join(' ')], ['file', 'ไฟล์', arr(s.formats).slice(0, 2).join(' · ')], ['globe', 'รองรับ', arr(s.languages).slice(0, 2).join(' + ') || '-']]
    case 'hire': return [['clock', 'ส่งงาน', str(s.timeline)], ['redo', 'แก้ไข', str(s.revisions)], ['users', 'คิวว่าง', 'อีก 3 งาน']]
    case 'media': return [['play', 'ความยาว', str(s.duration).split('(')[0].trim()], ['file', 'คุณภาพ', str(s.quality)], ['sparkle', 'สร้างด้วย', str(s.aiTool)]]
    case 'skill': return [['bulb', 'ใช้กับ', (arr(s.platforms)[0] ?? '-').split(' (')[0]], ['rocket', 'เวอร์ชัน', str(s.version)], ['file', 'ในชุด', `${arr(s.contents).length} ไฟล์`]]
    case 'data': return [['grid', 'ขนาด', str(s.size).split(' · ')[0]], ['file', 'รูปแบบ', arr(s.formats).slice(0, 2).join(' · ')], ['shield', 'ข้อมูลส่วนตัว', on(s.noPII) ? 'ไม่มี' : '-']]
  }
}

export function statsOf(p: Product) {
  const n = parseInt(p.id.replace(/\D/g, '') || '7')
  const rating = p.rating ?? Math.min(5, 4.6 + (n % 4) / 10)
  const reviews = 20 + ((n * 37) % 280)
  const sold = p.mine ? 0 : 60 + ((n * 131) % 2400)
  const L = layoutOf(p)
  const soldLabel = p.mine ? 'เพิ่งลงขาย' : L === 'free' ? `โหลดแล้ว ${k(sold)}` : L === 'hire' ? `จ้างแล้ว ${sold % 300} งาน` : L === 'course' ? `ผู้เรียน ${k(sold)}` : L === 'sw' ? `ติดตั้งแล้ว ${k(sold)}` : `ขายแล้ว ${k(sold)}`
  return { rating: Math.round(rating * 10) / 10, reviews: p.mine ? 0 : reviews, soldLabel, followers: `${(1 + (n % 9) / 2).toFixed(1)}K` }
}
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

export const REVIEWS = [
  { who: 'shop', stars: 5, when: '2 วันก่อน', text: 'ใช้งานง่ายมาก ตรงตามที่บอกไว้ ลูกค้าทักชมเยอะเลยค่ะ', pic: true },
  { who: 'somjai', stars: 4, when: '1 สัปดาห์ก่อน', text: 'คุ้มราคา ครีเอเตอร์ตอบแชตไว ช่วยแนะนำดีค่ะ', pic: false },
  { who: 'kenji', stars: 5, when: '2 สัปดาห์ก่อน', text: 'ไฟล์ครบตามรายการ มีคู่มือละเอียด ทำตามได้เลยครับ', pic: false },
]
export const reviewer = (id: string) => creatorById(id)

export const similarOf = (p: Product) => {
  const same = ALL_PRODUCTS.filter((x) => x.id !== p.id && x.type === p.type)
  const rest = ALL_PRODUCTS.filter((x) => x.id !== p.id && x.type !== p.type)
  return [...same, ...rest].slice(0, 6)
}

export { pageContent }
