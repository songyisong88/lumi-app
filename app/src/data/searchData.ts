/**
 * SAMPLE DATA for the search page (ข้อมูลตัวอย่าง): category counts, trends,
 * leaderboard and challenge are placeholders until the backend exists.
 */
import { ALL_PRODUCTS, PRODUCTS, SEARCH_EXTRA, TYPES, creatorById } from './sampleData'
import type { Product } from './types'

export type CatKey =
  | 'img' | 'sticker' | 'tpl' | 'creator'
  | 'sw' | 'app' | 'game' | 'plugin' | 'ext'
  | 'bot' | 'ai' | 'auto' | 'sme'
  | 'course' | 'svc' | 'free'
  | 'media' | 'skill' | 'data'

export interface Category {
  key: CatKey
  name: string
  sub: string
  image: string
  count: string
  accent: string
  /** Tile size inside its group grid (3 columns on mobile). */
  span?: 2 | 3
  flip?: boolean
  /** One-line description for the popular-category chips and the ทุกหมวด sheet (variant B). */
  desc: string
  /** Category added in the 19-category update; shown with a ใหม่ badge. */
  isNew?: boolean
  match: (p: Product) => boolean
}

const has = (p: Product, ...words: string[]) => words.some((w) => (p.label ?? '').includes(w))

export const CATEGORIES: Record<CatKey, Category> = {
  img: { key: 'img', name: 'ภาพและกราฟิก', desc: 'ภาพ AI พร้อมพรอมต์', sub: 'ภาพ AI · พรอมต์ · 3D', image: 'g_lotus.jpg', count: '12,400', accent: '#7C3AED', span: 3, match: (p) => p.type === 'img' && !has(p, 'สติกเกอร์') },
  sticker: { key: 'sticker', name: 'สติกเกอร์ LINE', desc: 'ส่งแชต LINE ได้ทันที', sub: 'ส่งแชตได้ทันที', image: 'shiba.jpg', count: '3,180', accent: '#F59E0B', match: (p) => has(p, 'สติกเกอร์') },
  tpl: { key: 'tpl', name: 'เทมเพลต', desc: 'แก้ข้อความแล้วใช้ได้เลย', sub: 'Canva · Sheets · เว็บ', image: 'c_template.jpg', count: '5,240', accent: '#2563EB', match: (p) => p.type === 'tpl' && p.st !== 'font' && !has(p, 'ฟอนต์', 'สติกเกอร์', 'ไอคอน', 'พรีเซ็ต', 'แปรง') },
  creator: { key: 'creator', name: 'ฟอนต์ พรีเซ็ต ไอคอน', desc: 'ฟอนต์ไทย พรีเซ็ตแต่งภาพ', sub: 'เครื่องมือครีเอเตอร์', image: 'c_creator.jpg', count: '2,060', accent: '#DB2777', match: (p) => has(p, 'ฟอนต์', 'พรีเซ็ต', 'ไอคอน', 'แปรง') },
  sw: { key: 'sw', name: 'ซอฟต์แวร์และโปรแกรม', desc: 'โปรแกรมบนคอมและเว็บ', sub: 'Windows · Mac · เว็บแอป', image: 'c_software.jpg', count: '1,320', accent: '#6D28D9', span: 2, match: (p) => has(p, 'โปรแกรม', 'เว็บแอป') },
  app: { key: 'app', name: 'แอปมือถือ', desc: 'แอปมือถือและซอร์สโค้ด', sub: 'iOS · Android', image: 'c_app.jpg', count: '740', accent: '#C026D3', match: (p) => has(p, 'แอป') && !has(p, 'เว็บแอป') },
  game: { key: 'game', name: 'เกม', desc: 'เกมพร้อมเล่น ซอร์สเกม', sub: 'เกมมือถือ · PC · ซอร์สเกม', image: 'c_game.jpg', count: '520', accent: '#4F46E5', match: (p) => has(p, 'เกม', 'ม็อด') },
  plugin: { key: 'plugin', name: 'ปลั๊กอิน', desc: 'เพิ่มฟีเจอร์ให้เว็บและร้านออนไลน์', sub: 'WordPress · Shopify', image: 'c_plugin.jpg', count: '690', accent: '#0891B2', match: (p) => has(p, 'ปลั๊กอิน') },
  ext: { key: 'ext', name: 'ส่วนขยาย Chrome', desc: 'ตัวช่วยที่ติดตั้งในเบราว์เซอร์', sub: 'ติดตั้งในเบราว์เซอร์', image: 'c_plugin.jpg', count: '380', accent: '#0D9488', flip: true, match: (p) => has(p, 'ส่วนขยาย') },
  bot: { key: 'bot', name: 'บอท LINE OA', desc: 'ตอบแชตลูกค้าให้อัตโนมัติ', sub: 'สแกนลองคุยได้', image: 'c_bot.jpg', count: '310', accent: '#16A34A', match: (p) => p.type === 'bot' },
  ai: { key: 'ai', name: 'ผู้ช่วย AI', desc: 'ช่วยแอดมิน เขียนแคปชัน', sub: 'แอดมิน · เขียนแคปชัน', image: 'robot.jpg', count: '860', accent: '#0E9384', match: (p) => has(p, 'ผู้ช่วย AI') || /AI/.test(p.title) && p.type === 'tool' },
  auto: { key: 'auto', name: 'ระบบอัตโนมัติ', desc: 'งานซ้ำ ๆ ให้ทำเองอัตโนมัติ', sub: 'n8n · Make · Zapier', image: 'c_auto.jpg', count: '450', accent: '#7C3AED', match: (p) => has(p, 'อัตโนมัติ') },
  sme: { key: 'sme', name: 'เครื่องมือ SME', desc: 'POS สต็อก บัญชีร้านค้า', sub: 'POS · สต็อก · บัญชี', image: 'c_sme.jpg', count: '610', accent: '#EA580C', span: 3, match: (p) => p.type === 'tool' && /POS|สต็อก|ออเดอร์|ร้าน/.test(p.title + p.use + (p.label ?? '')) },
  course: { key: 'course', name: 'คอร์สและอีบุ๊ก', desc: 'เรียนจากครีเอเตอร์ตัวจริง', sub: 'เรียนจากครีเอเตอร์', image: 'c_course.jpg', count: '410', accent: '#E0620B', match: (p) => p.type === 'course' },
  svc: { key: 'svc', name: 'จ้างครีเอเตอร์', desc: 'จ้างทำโลโก้ มาสคอต เว็บ', sub: 'มาสคอต โลโก้ เว็บ', image: 'mascot.jpg', count: '640', accent: '#DB2777', match: (p) => p.type === 'svc' },
  media: { key: 'media', name: 'วิดีโอ เสียง เพลง', desc: 'คลิป เสียง เพลง พร้อมสิทธิ์ใช้', isNew: true, sub: 'วิดีโอ AI · เสียงพากย์ · เพลง · เทมเพลตตัดต่อ', image: 'c_media.jpg', count: '1,140', accent: '#9333EA', span: 3, match: (p) => p.type === 'media' },
  skill: { key: 'skill', name: 'Agent Skills', desc: 'ชุดทักษะเสริมให้ผู้ช่วย AI', isNew: true, sub: 'สกิลและชุดความรู้ให้ AI agent', image: 'c_skill.jpg', count: '260', accent: '#0F766E', match: (p) => p.type === 'skill' },
  data: { key: 'data', name: 'ชุดข้อมูล', desc: 'ข้อมูลพร้อมใช้ ได้รับอนุญาตถูกต้อง', isNew: true, sub: 'CSV · JSON · พร้อมใช้งาน', image: 'c_data.jpg', count: '330', accent: '#1D4ED8', span: 2, match: (p) => p.type === 'data' },
  free: { key: 'free', name: 'ของฟรี', desc: 'ของฟรีทุกประเภท โหลดได้เลย', sub: 'ทุกประเภท โหลดได้เลย', image: 'g_frogs.jpg', count: '1,920', accent: '#16A34A', match: (p) => p.price === 0 },
}

export const GROUPS: { name: string; color: string; keys: CatKey[] }[] = [
  { name: 'ภาพ ดีไซน์ และสื่อ', color: '#7C3AED', keys: ['img', 'sticker', 'tpl', 'creator', 'media'] },
  { name: 'ซอฟต์แวร์ แอป และเกม', color: '#4F46E5', keys: ['sw', 'app', 'game', 'plugin', 'ext'] },
  { name: 'ธุรกิจและ AI', color: '#0E9384', keys: ['bot', 'ai', 'auto', 'sme', 'skill', 'data'] },
  { name: 'เรียนรู้ บริการ และของฟรี', color: '#E0620B', keys: ['course', 'svc', 'free'] },
]

/** Popular categories shown as the chip row on the search page (approved variant B). */
export const POPULAR: CatKey[] = ['img', 'tpl', 'sticker', 'creator', 'sw', 'app', 'game', 'course']
/** Short chip labels where the full name is too long. */
export const SHORT: Partial<Record<CatKey, string>> = { sw: 'ซอฟต์แวร์', creator: 'ฟอนต์ & พรีเซ็ต' }
export const CAT_TOTAL = Object.keys(CATEGORIES).length

export const isCatKey = (k: string | null): k is CatKey => !!k && k in CATEGORIES

/** Hidden search tags so trends and keywords find sample works. */
const TAGS: Record<string, string[]> = {
  p12: ['ลอยกระทง', 'อนิเมะ', 'ไทย'], p21: ['ลอยกระทง', 'ไทย', 'แฟนตาซี'], p01: ['ลอยกระทง', 'ดอกบัว'], p09: ['ไทย'],
  p02: ['คริสต์มาส', 'ปีใหม่', 'การ์ด'], p23: ['คริสต์มาส', 'ปีใหม่', 'แมว'], p06: ['ปีใหม่'], p07: ['ปีใหม่', 'กาแฟ'],
  p04: ['y2k', 'โฮโลแกรม'], p17: ['y2k'], p24: ['y2k', 'กาแฟ'],
  p15: ['พีชมอคค่า', 'โทนสี'], p22: ['พีชมอคค่า', 'โทนสี'], n03: ['พีชมอคค่า'],
  n12: ['นีออน', 'ไซเบอร์', 'เกม'], n07: ['นีออน', 'ผลไม้'],
  n05: ['ร้านค้า', 'sme'], n13: ['วิดีโอ', 'คลิป', 'กาแฟ'], n14: ['เพลง', 'เสียง', 'ดนตรี'], n15: ['capcut', 'คลิป', 'ตัดต่อ'], n16: ['agent', 'skill', 'ai', 'claude'], n17: ['agent', 'skill', 'ภาษี'], n18: ['dataset', 'csv', 'อาหาร'], n19: ['dataset', 'รีวิว', 'json'], p05: ['ออเดอร์', 'ร้านอาหาร'], p18: ['ออเดอร์'],
}

/** Lower-cased text a work can be found by: title, use, label, type, creator, categories, tags. */
const haystack = (p: Product) =>
  [
    p.title, p.use, p.label ?? '', TYPES[p.type].name, creatorById(p.creatorId).name,
    ...(p.platforms ?? []), ...(TAGS[p.id] ?? []), ...(p.tags ?? []), p.desc ?? '',
    ...Object.values(CATEGORIES).filter((c) => c.match(p)).map((c) => c.name),
    p.price === 0 ? 'ฟรี' : '',
  ].join(' ').toLowerCase()

const INDEX = new Map<string, string>()
const hay = (p: Product) => { let h = INDEX.get(p.id); if (h === undefined) { h = haystack(p); INDEX.set(p.id, h) } return h }

/** Client-side search over sample works. Every word typed must appear somewhere. */
export function searchWorks(q: string, cat: CatKey | 'new' | null): Product[] {
  const mine = ALL_PRODUCTS.filter((p) => p.mine).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  let list = cat === 'new' ? [...mine, ...NEW_TODAY.map((n) => n.p)] : [...mine, ...ALL_PRODUCTS.filter((p) => !p.mine)]
  if (cat && cat !== 'new') list = list.filter(CATEGORIES[cat].match)
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (words.length) list = list.filter((p) => { const h = hay(p); return words.every((w) => h.includes(w)) })
  return list
}

export const TRENDS = [
  { image: 'g_anime.jpg', title: 'ลอยกระทง 2569', sub: 'ภาพ โพสต์ สติกเกอร์ริมกระทง', count: '1,240', rise: '+182%', q: 'ลอยกระทง', dots: ['#7C3AED', '#F59E0B', '#2563EB'] },
  { image: 't_xmas.jpg', title: 'คริสต์มาส & ปีใหม่', sub: 'การ์ด ปกเพจ แพ็กสติกเกอร์', count: '860', rise: '+96%', q: 'ปีใหม่', dots: ['#7C3AED', '#F59E0B', '#DB2777'] },
  { image: 't_y2k.jpg', title: 'สไตล์ Y2K', sub: 'โครเมียม ผีเสื้อ ฟองโฮโลแกรม', count: '540', rise: '+71%', q: 'y2k', dots: ['#7C3AED', '#DB2777'] },
  { image: 't_color.jpg', title: 'โทนสีแห่งปี พีชมอคค่า', sub: 'ภาพสินค้า เทมเพลต ฟอนต์', count: '420', rise: '+58%', q: 'พีชมอคค่า', dots: ['#7C3AED', '#2563EB', '#DB2777'] },
  { image: 'g_cyber.jpg', title: 'ไซเบอร์ไทยนีออน', sub: 'วอลเปเปอร์ ปกเกม เว็บ', count: '380', rise: '+44%', q: 'นีออน', dots: ['#7C3AED', '#4F46E5'] },
]

export const HOT_KEYWORDS = ['ลอยกระทง', 'โปรแกรม POS', 'บอท', 'สติกเกอร์แมว', 'ปลั๊กอิน', 'ฟอนต์', 'เกม', 'กาแฟ', 'ปีใหม่', 'มาสคอต']

const byId = (id: string) => SEARCH_EXTRA.find((p) => p.id === id) ?? PRODUCTS.find((p) => p.id === id)!
export const NEW_TODAY = [
  { p: byId('n01'), ago: 'เมื่อสักครู่' },
  { p: byId('n02'), ago: '2 นาทีที่แล้ว' },
  { p: byId('n03'), ago: '5 นาทีที่แล้ว' },
  { p: byId('n04'), ago: '8 นาทีที่แล้ว' },
  { p: byId('n10'), ago: '12 นาทีที่แล้ว' },
  { p: byId('n11'), ago: '20 นาทีที่แล้ว' },
]
export const NEW_TODAY_COUNT = 128

/** One weekly ranking used everywhere (ค้นหา + ชุมชน › กิจกรรม). The signed-in user (ME) is #14. */
export const LEADERBOARD = [
  { creatorId: 'nova', what: 'ภาพสินค้า', pts: 2460 },
  { creatorId: 'ton', what: 'ข้อมูล · ระบบอัตโนมัติ', pts: 1820 },
  { creatorId: 'mint', what: 'เทมเพลต', pts: 1505 },
  { creatorId: 'pim', what: 'สติกเกอร์', pts: 1310 },
  { creatorId: 'kenji', what: 'เว็บ · บอท', pts: 1190 },
  { creatorId: 'toy', what: 'มาสคอต 3D', pts: 980 },
]
export const MY_RANK = { rank: 14, toTop10: 120 }

/** The weekly challenge ends Monday 00:00 Bangkok time (UTC+7). */
export function challengeEnd(now = Date.now()) {
  const bkk = now + 7 * 3600_000
  const day = new Date(bkk).getUTCDay() // 0 = Sunday
  const startOfDay = bkk - (bkk % 86_400_000)
  const daysLeft = ((8 - day) % 7) || 7
  return startOfDay + daysLeft * 86_400_000 - 7 * 3600_000
}

export const CHALLENGE = {
  prompt: 'แมวไทยในชุดนักบินอวกาศ',
  note: 'ส่งภาพหรือสติกเกอร์ตามโจทย์ ผลงานที่ได้ใจมากสุดขึ้นหน้าแรก',
  joined: 214,
  avatars: ['fasai', 'pim', 'toy', 'kenji'],
}
