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
  match: (p: Product) => boolean
}

const has = (p: Product, ...words: string[]) => words.some((w) => (p.label ?? '').includes(w))

export const CATEGORIES: Record<CatKey, Category> = {
  img: { key: 'img', name: 'ภาพและกราฟิก', sub: 'ภาพ AI · พรอมต์ · 3D', image: 'g_lotus.jpg', count: '12,400', accent: '#7C3AED', span: 3, match: (p) => p.type === 'img' && !has(p, 'สติกเกอร์') },
  sticker: { key: 'sticker', name: 'สติกเกอร์ LINE', sub: 'ส่งแชตได้ทันที', image: 'shiba.jpg', count: '3,180', accent: '#F59E0B', match: (p) => has(p, 'สติกเกอร์') },
  tpl: { key: 'tpl', name: 'เทมเพลต', sub: 'Canva · Sheets · เว็บ', image: 'c_template.jpg', count: '5,240', accent: '#2563EB', match: (p) => p.type === 'tpl' && !has(p, 'ฟอนต์') },
  creator: { key: 'creator', name: 'ฟอนต์ พรีเซ็ต ไอคอน', sub: 'เครื่องมือครีเอเตอร์', image: 'c_creator.jpg', count: '2,060', accent: '#DB2777', match: (p) => has(p, 'ฟอนต์', 'พรีเซ็ต', 'ไอคอน') },
  sw: { key: 'sw', name: 'ซอฟต์แวร์และโปรแกรม', sub: 'Windows · Mac · เว็บแอป', image: 'c_software.jpg', count: '1,320', accent: '#6D28D9', span: 2, match: (p) => has(p, 'โปรแกรม') },
  app: { key: 'app', name: 'แอปมือถือ', sub: 'iOS · Android', image: 'c_app.jpg', count: '740', accent: '#C026D3', match: (p) => has(p, 'แอป') },
  game: { key: 'game', name: 'เกม', sub: 'เกมมือถือ · PC · ซอร์สเกม', image: 'c_game.jpg', count: '520', accent: '#4F46E5', match: (p) => has(p, 'เกม') },
  plugin: { key: 'plugin', name: 'ปลั๊กอิน', sub: 'WordPress · Shopify', image: 'c_plugin.jpg', count: '690', accent: '#0891B2', match: (p) => has(p, 'ปลั๊กอิน') },
  ext: { key: 'ext', name: 'ส่วนขยาย Chrome', sub: 'ติดตั้งในเบราว์เซอร์', image: 'c_plugin.jpg', count: '380', accent: '#0D9488', flip: true, match: (p) => has(p, 'ส่วนขยาย') },
  bot: { key: 'bot', name: 'บอท LINE OA', sub: 'สแกนลองคุยได้', image: 'c_bot.jpg', count: '310', accent: '#16A34A', match: (p) => p.type === 'bot' },
  ai: { key: 'ai', name: 'ผู้ช่วย AI', sub: 'แอดมิน · เขียนแคปชัน', image: 'robot.jpg', count: '860', accent: '#0E9384', match: (p) => has(p, 'ผู้ช่วย AI') || /AI/.test(p.title) && p.type === 'tool' },
  auto: { key: 'auto', name: 'ระบบอัตโนมัติ', sub: 'n8n · Make · Zapier', image: 'c_auto.jpg', count: '450', accent: '#7C3AED', match: (p) => has(p, 'อัตโนมัติ') },
  sme: { key: 'sme', name: 'เครื่องมือ SME', sub: 'POS · สต็อก · บัญชี', image: 'c_sme.jpg', count: '610', accent: '#EA580C', span: 3, match: (p) => p.type === 'tool' && /POS|สต็อก|ออเดอร์|ร้าน/.test(p.title + p.use + (p.label ?? '')) },
  course: { key: 'course', name: 'คอร์สและอีบุ๊ก', sub: 'เรียนจากครีเอเตอร์', image: 'c_course.jpg', count: '410', accent: '#E0620B', match: (p) => p.type === 'course' },
  svc: { key: 'svc', name: 'จ้างครีเอเตอร์', sub: 'มาสคอต โลโก้ เว็บ', image: 'mascot.jpg', count: '640', accent: '#DB2777', match: (p) => p.type === 'svc' },
  free: { key: 'free', name: 'ของฟรี', sub: 'ทุกประเภท โหลดได้เลย', image: 'g_frogs.jpg', count: '1,920', accent: '#16A34A', match: (p) => p.price === 0 },
}

export const GROUPS: { name: string; color: string; keys: CatKey[] }[] = [
  { name: 'ภาพและดีไซน์', color: '#7C3AED', keys: ['img', 'sticker', 'tpl', 'creator'] },
  { name: 'ซอฟต์แวร์ แอป และเกม', color: '#4F46E5', keys: ['sw', 'app', 'game', 'plugin', 'ext'] },
  { name: 'ธุรกิจและ AI', color: '#0E9384', keys: ['bot', 'ai', 'auto', 'sme'] },
  { name: 'เรียนรู้ บริการ และของฟรี', color: '#E0620B', keys: ['course', 'svc', 'free'] },
]

export const isCatKey = (k: string | null): k is CatKey => !!k && k in CATEGORIES

/** Hidden search tags so trends and keywords find sample works. */
const TAGS: Record<string, string[]> = {
  p12: ['ลอยกระทง', 'อนิเมะ', 'ไทย'], p21: ['ลอยกระทง', 'ไทย', 'แฟนตาซี'], p01: ['ลอยกระทง', 'ดอกบัว'], p09: ['ไทย'],
  p02: ['คริสต์มาส', 'ปีใหม่', 'การ์ด'], p23: ['คริสต์มาส', 'ปีใหม่', 'แมว'], p06: ['ปีใหม่'], p07: ['ปีใหม่', 'กาแฟ'],
  p04: ['y2k', 'โฮโลแกรม'], p17: ['y2k'], p24: ['y2k', 'กาแฟ'],
  p15: ['พีชมอคค่า', 'โทนสี'], p22: ['พีชมอคค่า', 'โทนสี'], n03: ['พีชมอคค่า'],
  n12: ['นีออน', 'ไซเบอร์', 'เกม'], n07: ['นีออน', 'ผลไม้'],
  n05: ['ร้านค้า', 'sme'], p05: ['ออเดอร์', 'ร้านอาหาร'], p18: ['ออเดอร์'],
}

/** Lower-cased text a work can be found by: title, use, label, type, creator, categories, tags. */
const haystack = (p: Product) =>
  [
    p.title, p.use, p.label ?? '', TYPES[p.type].name, creatorById(p.creatorId).name,
    ...(p.platforms ?? []), ...(TAGS[p.id] ?? []),
    ...Object.values(CATEGORIES).filter((c) => c.match(p)).map((c) => c.name),
    p.price === 0 ? 'ฟรี' : '',
  ].join(' ').toLowerCase()

const INDEX = new Map(ALL_PRODUCTS.map((p) => [p.id, haystack(p)]))

/** Client-side search over sample works. Every word typed must appear somewhere. */
export function searchWorks(q: string, cat: CatKey | 'new' | null): Product[] {
  let list = cat === 'new' ? NEW_TODAY.map((n) => n.p) : ALL_PRODUCTS
  if (cat && cat !== 'new') list = list.filter(CATEGORIES[cat].match)
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (words.length) list = list.filter((p) => { const h = INDEX.get(p.id)!; return words.every((w) => h.includes(w)) })
  return list
}

export const TRENDS = [
  { image: 'g_anime.jpg', title: 'ลอยกระทง 2026', sub: 'ภาพ โพสต์ สติกเกอร์ริมกระทง', count: '1,240', rise: '+182%', q: 'ลอยกระทง', dots: ['#7C3AED', '#F59E0B', '#2563EB'] },
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

export const LEADERBOARD = [
  { creatorId: 'fasai', what: 'สีน้ำ · ภาพ', hearts: '12.4k' },
  { creatorId: 'pim', what: 'สติกเกอร์', hearts: '10.9k' },
  { creatorId: 'nova', what: 'ภาพสินค้า', hearts: '9.2k' },
  { creatorId: 'kenji', what: 'เว็บ · บอท', hearts: '7.8k' },
  { creatorId: 'toy', what: 'มาสคอต 3D', hearts: '6.5k' },
]

export const CHALLENGE = {
  prompt: 'แมวไทยในชุดนักบินอวกาศ',
  note: 'ส่งภาพหรือสติกเกอร์ตามโจทย์ ผลงานที่ได้ใจมากสุดขึ้นหน้าแรก',
  joined: 214,
  avatars: ['fasai', 'pim', 'toy', 'kenji'],
}
