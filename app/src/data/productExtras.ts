/** Presentation helpers for the product page: options, hero image, highlights, reviews. */
import { layoutOf, pageContent, sellTypeOf, specOf, str, arr, on, promptOnly, PROMPT_ONLY } from './listingSpec'
import { ALL_PRODUCTS, creatorById, isLive } from './sampleData'
import type { Product, ProductOption } from './types'
import { REAL, BRAND } from '../config'

const FALLBACK: Record<string, string> = { p03: 'c_auto.jpg', p05: 'c_bot.jpg', p10: 'c_software.jpg', p13: 'robot.jpg', p18: 'c_bot.jpg' }
export const heroOf = (p: Product): string =>
  p.covers?.[0] ?? p.image?.src ?? FALLBACK[p.id] ?? ({ tool: 'c_software.jpg', bot: 'c_bot.jpg', course: 'c_course.jpg', commission: 'mascot.jpg' } as Record<string, string>)[p.kind] ?? 'g_lotus.jpg'
export const galleryOf = (p: Product): string[] => {
  if (p.covers?.length) return p.covers
  const h = heroOf(p)
  const more = ALL_PRODUCTS.filter((x) => x.id !== p.id && x.creatorId === p.creatorId && x.image).map((x) => x.image!.src)
  return [h, ...more.filter((m) => m !== h).slice(0, 2)]
}

/** The update promise exactly as the creator wrote it (first part of the support field), or nothing. */
const supportShort = (p: Product) => { const x = str(specOf(p).support).split('·')[0].trim(); return x ? ` · ${x}` : '' }
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
    case 'tpl': return [{ id: 'full', label: 'ชุดเต็ม', sub: /พิมพ์/.test(p.label ?? '') ? 'ไฟล์ PDF พร้อมพิมพ์ · พิมพ์ใช้เองได้ไม่จำกัดจำนวน · ดูตารางสิทธิ์สำหรับงานขาย' : /เว็บ/.test(p.label ?? '') ? 'ไฟล์เว็บ (HTML) + ไฟล์ Figma' : 'ลิงก์ Canva + ไฟล์ทุกแบบ', price: x }]
    case 'sw':
      if (/เกม/.test(p.label ?? '')) return [
        { id: 'per', label: 'เล่น / ใช้ส่วนตัว', sub: `ดาวน์โหลด + อัปเดตฟรี${supportShort(p)}`, price: x },
        { id: 'src', label: 'พร้อมซอร์สโค้ด', sub: 'ไฟล์โปรเจกต์ แก้ต่อเองได้ ห้ามขายซ้ำ', price: r10(x * 2.5), best: 'คุ้มสุด' },
        { id: 'com', label: 'เชิงพาณิชย์ / ทีม', sub: 'ใช้ในงานลูกค้า หรือทีมสูงสุด 5 คน', price: r10(x * 5) }]
      if (/ปลั๊กอิน|ส่วนขยาย/.test(p.label ?? '')) return [
        { id: 'one', label: '1 ร้าน / 1 บัญชี', sub: `ซื้อขาด${supportShort(p)}`, price: x },
        { id: 'three', label: '3 ร้าน / 3 บัญชี', sub: 'สำหรับหลายร้าน หลายแบรนด์', price: r10(x * 2.3), best: 'คุ้มสุด' },
        { id: 'agency', label: 'เอเจนซี · ไม่จำกัด', sub: 'ติดตั้งให้ลูกค้าได้ไม่จำกัดร้าน', price: r10(x * 5) }]
      return [
      { id: 'one', label: p.label === 'เกม' ? 'ซอร์สโค้ด 1 โปรเจกต์' : '1 เครื่อง', sub: `ซื้อขาด${supportShort(p)}`, price: x },
      { id: 'three', label: p.label === 'เกม' ? 'สิทธิ์ทีม (3 คน)' : '3 เครื่อง', sub: 'สำหรับหลายสาขา / หลายคน', price: r10(x * 2.3), best: 'คุ้มสุด' }]
    case 'bot': return [{ id: 'setup', label: 'ติดตั้งให้ + ใช้ได้ไม่จำกัด', sub: 'ซื้อครั้งเดียว ไม่มีค่ารายเดือน', price: x, best: 'คุ้มสุด' }, { id: 'diy', label: 'ติดตั้งเอง (ไฟล์ + คู่มือ)', sub: 'ทำตามคลิปทีละขั้น', price: r10(x * 0.6) }]
    case 'media': return [{ id: 'social', label: 'ใช้โซเชียล / ส่วนตัว', sub: 'Reels TikTok YouTube ของคุณ', price: x }, { id: 'ads', label: 'โฆษณา + ลูกค้า', sub: 'ยิงแอด ทำงานให้ลูกค้าได้', price: r10(x * 2.5), best: 'คุ้มสุด' }]
    case 'skill': return [{ id: 'one', label: 'ใช้คนเดียว', sub: `1 ผู้ใช้${supportShort(p)}`, price: x }, { id: 'team', label: 'ทีม (สูงสุด 5 คน)', sub: 'ติดตั้งให้ทั้งทีมได้', price: r10(x * 3), best: 'คุ้มสุด' }]
    case 'data': return [{ id: 'std', label: 'ใช้ภายในองค์กร', sub: 'วิเคราะห์ ทำแอปของตัวเอง', price: x }, { id: 'ext', label: 'ใช้ในผลิตภัณฑ์/เทรนโมเดล', sub: 'นำไปใส่สินค้าที่ขายได้', price: r10(x * 3), best: 'คุ้มสุด' }]
    case 'course': return /อีบุ๊ก/.test(p.label ?? '') ? [{ id: 'life', label: 'อีบุ๊กฉบับเต็ม', sub: 'ไฟล์ PDF + EPUB ดาวน์โหลดเก็บไว้ได้', price: x }] : [{ id: 'life', label: 'คอร์สเต็ม · ทุกตอน', sub: `ดูได้ไม่จำกัดเวลา ตราบที่คอร์สยังเปิดบน ${BRAND} · ถ้าจะปิด จะแจ้งล่วงหน้า`, price: x }]
    case 'font': return [{ id: 'personal', label: 'สิทธิ์ส่วนตัว', sub: 'งานส่วนตัว การบ้าน', price: x }, { id: 'commercial', label: 'เชิงพาณิชย์', sub: 'โฆษณา สินค้า งานธุรกิจ ตามตารางสิทธิ์', price: r10(x * 2.5), best: 'คุ้มสุด' }]
    case 'hire': return x === 0 ? [{ id: 'free', label: 'งานฟรี', sub: `${p.days ?? 5} วัน · แก้ ${p.revisions ?? 2} ครั้ง · ไม่มีค่าใช้จ่าย`, price: 0 }] : [
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
  const lic = arr(s.licAllowed).length > 1 ? 'เชิงพาณิชย์' : 'ใช้ส่วนตัว'
  // Free works use their own type's highlights (owner 2026-11-03: each type keeps its showcase when free).
  switch (t) {
    case 'img': if (promptOnly(s)) return [['sparkle', 'ขาย', PROMPT_ONLY], ['sparkle', 'โมเดล', str(s.model) || '-'], ['shield', 'สิทธิ์', lic]]
      return [['image', 'ไฟล์', `${str(s.resolution).split(' ')[0]} ${arr(s.formats)[0] ?? ''}`], ['sparkle', 'โมเดล', on(s.sellPrompt) ? str(s.model) : 'ภาพสำเร็จ'], ['shield', 'สิทธิ์', lic]]
    case 'tpl': return [['grid', 'จำนวน', str(s.count).split(' ').slice(0, 2).join(' ')], ['pen', 'แก้ใน', arr(s.apps)[0] ?? '-'], ['file', 'ไฟล์', arr(s.formats).slice(0, 2).join(' · ')]]
    case 'sw': case 'game': return [['monitor', 'รองรับ', arr(s.platforms).slice(0, 2).join(' · ')], ['rocket', 'เวอร์ชัน', str(s.version)], ['shield', 'ไฟล์', 'สแกนเบื้องต้น']]
    case 'bot': return [['robot', 'แพลตฟอร์ม', arr(s.platform)[0] ?? '-'], ['cal', 'ติดตั้ง', str(s.setupMode).split(' ')[0]], ['qr', 'ทดลอง', on(s.trial) ? str(s.trialDays) : 'ไม่มี']]
    case 'course': return [['play', /อีบุ๊ก/.test(p.label ?? '') ? 'เนื้อหา' : 'บทเรียน', /อีบุ๊ก/.test(p.label ?? '') ? `${arr(s.lessons).length} บท · ${str(s.duration)}` : `${arr(s.lessons).length} ตอน`], ['clock', 'ดูได้', str(s.access)], ['cap', 'ใบรับรอง', on(s.certificate) ? 'มีให้' : 'ไม่มี']]
    case 'font': return [['font', 'ชุด', str(s.count).split(' ').slice(0, 2).join(' ')], ['file', 'ไฟล์', arr(s.formats).slice(0, 2).join(' · ')], ['globe', 'รองรับ', arr(s.languages).slice(0, 2).join(' + ') || '-']]
    case 'hire': return [['clock', 'ส่งงาน', str(s.timeline)], ['redo', 'แก้ไข', str(s.revisions)], ['users', 'คิวว่าง', 'อีก 3 งาน']]
    case 'media': return [['play', 'ความยาว', str(s.duration).split('(')[0].trim()], ['file', 'คุณภาพ', str(s.quality)], ['sparkle', 'สร้างด้วย', str(s.aiTool)]]
    case 'skill': return [['bulb', 'ใช้กับ', (arr(s.platforms)[0] ?? '-').split(' (')[0]], ['rocket', 'เวอร์ชัน', str(s.version)], ['file', 'ในชุด', `${arr(s.contents).length} ไฟล์`]]
    case 'data': return [['grid', 'ขนาด', str(s.size).split(' · ')[0]], ['file', 'รูปแบบ', arr(s.formats).slice(0, 2).join(' · ')], ['shield', 'ข้อมูลส่วนตัว', on(s.noPII) ? 'ไม่มี' : '-']]
  }
}

export function statsOf(p: Product) {
  if (p.real) {
    const L0 = layoutOf(p), r = p.real
    const soldLabel = p.mod?.status === 'pending' ? 'รอตรวจ' : p.mod?.status === 'rejected' ? 'ยังไม่ขึ้นขาย' : r.sales === 0 ? 'เพิ่งลงขาย' : L0 === 'free' ? `โหลดแล้ว ${k(r.sales)}` : L0 === 'hire' ? `จ้างแล้ว ${r.sales} งาน` : `ขายแล้ว ${k(r.sales)}`
    return { rating: Math.round(r.rating * 10) / 10, reviews: r.reviews, soldLabel, likes: r.likes }
  }
  const n = parseInt(p.id.replace(/\D/g, '') || '7') + (p.id.startsWith('n') ? 24 : 0) // n01 must not mirror p01
  const rating = p.rating ?? Math.min(5, 4.6 + (n % 4) / 10)
  const reviews = 20 + ((n * 37) % 280)
  const sold = p.mine ? 0 : 60 + ((n * 131) % 2400)
  const L = layoutOf(p)
  const soldLabel = p.mod?.status === 'pending' ? 'รอตรวจ' : p.mod?.status === 'rejected' ? 'ยังไม่ขึ้นขาย' : p.mine ? 'เพิ่งลงขาย' : L === 'free' ? `โหลดแล้ว ${k(sold)}` : L === 'hire' ? `จ้างแล้ว ${sold % 300} งาน` : L === 'course' ? `ผู้เรียน ${k(sold)}` : L === 'sw' ? `ติดตั้งแล้ว ${k(sold)}` : `ขายแล้ว ${k(sold)}`
  return { rating: Math.round(rating * 10) / 10, reviews: p.mine ? 0 : reviews, soldLabel, likes: p.mine ? 0 : 40 + ((n * 53) % 900) }
}

const FOLLOWERS: Record<string, number> = { mint: 3400, nova: 5200, fasai: 1200, kenji: 2800, pim: 4100, toy: 1900, ton: 2300 }
/** One set of creator numbers for every screen (product page, creator page, profile). */
export function creatorStats(id: string, followedByMe = false) {
  const works = ALL_PRODUCTS.filter((p) => p.creatorId === id && isLive(p))
  const rated = works.filter((p) => !p.mine)
  const rating = rated.length ? Math.round((rated.reduce((a, p) => a + statsOf(p).rating, 0) / rated.length) * 10) / 10 : 0
  const remote = creatorById(id).followers
  const followers = remote ?? (FOLLOWERS[id] ?? 0) + (followedByMe ? 1 : 0)
  return { works: works.length, rating, followers, followersLabel: k(followers) }
}
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

export const REVIEWS = REAL ? [] : [
  { who: 'shop', stars: 5, when: '2 วันที่แล้ว', text: 'ใช้งานง่ายมาก ตรงตามที่บอกไว้ ลูกค้าทักชมเยอะเลยค่ะ', pic: true },
  { who: 'somjai', stars: 4, when: '1 สัปดาห์ที่แล้ว', text: 'คุ้มราคา ครีเอเตอร์ตอบแชตไว ช่วยแนะนำดีค่ะ', pic: false },
  { who: 'kenji', stars: 5, when: '2 สัปดาห์ที่แล้ว', text: 'ไฟล์ครบตามรายการ มีคู่มือละเอียด ทำตามได้เลยครับ', pic: false },
]
export const reviewer = (id: string) => creatorById(id)

export const similarOf = (p: Product) => {
  const pool = ALL_PRODUCTS.filter((x) => x.id !== p.id && isLive(x))
  const t = sellTypeOf(p)
  const same = pool.filter((x) => sellTypeOf(x) === t)
  const rest = pool.filter((x) => sellTypeOf(x) !== t)
  return [...same, ...rest].slice(0, 6)
}

export { pageContent }

/** SAMPLE DATA: past sales shown in creator mode on the demo site (the real site shows only real sales). */
export const SHOP_SALES = REAL ? [] : [
  { no: 'LM-20476', pid: 'p01', who: 'ลูกค้าร้านกาแฟ', amt: 390, st: 'ส่งไฟล์แล้ว · รอพ้น 7 วัน', tone: 'info' },
  { no: 'LM-20451', pid: 'p01', who: 'ร้านดอกไม้ป้าแดง', amt: 159, st: 'เข้ายอดรอโอนแล้ว', tone: 'done' },
]
