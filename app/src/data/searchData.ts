/**
 * SAMPLE DATA for the search page (ข้อมูลตัวอย่าง): category counts, trends,
 * leaderboard and challenge are placeholders until the backend exists.
 */
import { ALL_PRODUCTS, PRODUCTS, SEARCH_EXTRA, TYPES, creatorById, isLive } from './sampleData'
import type { Product } from './types'
import { SELL_TYPE_ORDER, SPECS, sellTypeOf, specOf, type SellType } from './listingSpec'

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
  /** Wider image for a full-width search tile (avoids cropping a square image). */
  tileImage?: string
  /** One-line description for the popular-category chips and the ทุกหมวด sheet (variant B). */
  desc: string
  /** Category added in the 19-category update; shown with a ใหม่ badge. */
  isNew?: boolean
  /** Parent sell type (one taxonomy: 11 sell types → 19 sub-categories). null = cuts across all types (ของฟรี). */
  parent: SellType | null
  /** Rule inside the parent type. The full match is parent type + this rule. */
  rule: (p: Product) => boolean
  match: (p: Product) => boolean
}

const has = (p: Product, ...words: string[]) => words.some((w) => (p.label ?? '').includes(w))
const sub = (p: Product) => { const v = specOf(p).sub; return typeof v === 'string' ? v : '' }
const isApp = (p: Product) => sub(p) === 'แอปมือถือ'
const isPlugin = (p: Product) => sub(p) === 'ปลั๊กอิน' || has(p, 'ปลั๊กอิน')
const isExt = (p: Product) => sub(p) === 'ส่วนขยาย Chrome' || has(p, 'ส่วนขยาย')
function inCat(k: CatKey, p: Product) {
  const c = CATEGORIES[k]
  return (c.parent === null || sellTypeOf(p) === c.parent) && c.rule(p)
}

export const CATEGORIES: Record<CatKey, Category> = {
  img: { key: 'img', name: 'ภาพและกราฟิก', desc: 'ภาพ AI พร้อมพรอมต์', sub: 'ภาพ AI · พรอมต์ · 3D', image: 'g_lotus.jpg', count: '12,400', accent: '#7C3AED', span: 3, parent: 'img', rule: () => true, match: (p) => inCat('img', p) },
  sticker: { key: 'sticker', name: 'สติกเกอร์', desc: 'ไฟล์สติกเกอร์ PNG (ไม่ใช่สติกเกอร์ในแอป LINE)', sub: 'ไฟล์ PNG พื้นใส', image: 'shiba.jpg', count: '3,180', accent: '#F59E0B', parent: 'font', rule: (p) => sub(p) === 'สติกเกอร์ PNG' || has(p, 'สติกเกอร์'), match: (p) => inCat('sticker', p) },
  tpl: { key: 'tpl', name: 'เทมเพลต', desc: 'แก้ข้อความแล้วใช้ได้เลย', sub: 'Canva · Sheets · เว็บ', image: 'c_template.jpg', count: '5,240', accent: '#2563EB', parent: 'tpl', rule: () => true, match: (p) => inCat('tpl', p) },
  creator: { key: 'creator', name: 'ฟอนต์ พรีเซ็ต ไอคอน', desc: 'ฟอนต์ไทย พรีเซ็ตแต่งภาพ', sub: 'เครื่องมือครีเอเตอร์', image: 'c_creator.jpg', count: '2,060', accent: '#DB2777', parent: 'font', rule: (p) => !(sub(p) === 'สติกเกอร์ PNG' || has(p, 'สติกเกอร์')), match: (p) => inCat('creator', p) },
  sw: { key: 'sw', name: 'ซอฟต์แวร์และโปรแกรม', desc: 'โปรแกรมบนคอมและเว็บ', sub: 'Windows · Mac · เว็บแอป', image: 'c_software.jpg', count: '1,320', accent: '#6D28D9', span: 2, parent: 'sw', rule: (p) => !isApp(p), match: (p) => inCat('sw', p) },
  app: { key: 'app', name: 'แอปมือถือ', desc: 'แอปมือถือและซอร์สโค้ด', sub: 'iOS · Android', image: 'c_app.jpg', count: '740', accent: '#C026D3', parent: 'sw', rule: isApp, match: (p) => inCat('app', p) },
  game: { key: 'game', name: 'เกม', desc: 'เกมพร้อมเล่น ซอร์สเกม', sub: 'เกมมือถือ · PC · ซอร์สเกม', image: 'c_game.jpg', count: '520', accent: '#4F46E5', parent: 'game', rule: (p) => !isPlugin(p) && !isExt(p), match: (p) => inCat('game', p) },
  plugin: { key: 'plugin', name: 'ปลั๊กอิน', desc: 'เพิ่มฟีเจอร์ให้เว็บและร้านออนไลน์', sub: 'WordPress · Shopify', image: 'c_plugin.jpg', count: '690', accent: '#0891B2', parent: 'game', rule: isPlugin, match: (p) => inCat('plugin', p) },
  ext: { key: 'ext', name: 'ส่วนขยาย Chrome', desc: 'ตัวช่วยที่ติดตั้งในเบราว์เซอร์', sub: 'ติดตั้งในเบราว์เซอร์', image: 'c_plugin.jpg', count: '380', accent: '#0D9488', flip: true, parent: 'game', rule: isExt, match: (p) => inCat('ext', p) },
  bot: { key: 'bot', name: 'บอทแชต', desc: 'ตอบแชตลูกค้าให้อัตโนมัติ', sub: 'สแกน QR ลองคุยได้', image: 'c_bot.jpg', count: '310', accent: '#16A34A', parent: 'bot', rule: (p) => !['ผู้ช่วย AI', 'ระบบอัตโนมัติ'].includes(sub(p)), match: (p) => inCat('bot', p) },
  ai: { key: 'ai', name: 'ผู้ช่วย AI', desc: 'ช่วยแอดมิน เขียนแคปชัน', sub: 'แอดมิน · เขียนแคปชัน', image: 'robot.jpg', count: '860', accent: '#0E9384', parent: 'bot', rule: (p) => sub(p) === 'ผู้ช่วย AI', match: (p) => inCat('ai', p) },
  auto: { key: 'auto', name: 'ระบบอัตโนมัติ', desc: 'งานซ้ำ ๆ ให้ทำเองอัตโนมัติ', sub: 'n8n · Make · Zapier', image: 'c_auto.jpg', count: '450', accent: '#7C3AED', parent: 'bot', rule: (p) => sub(p) === 'ระบบอัตโนมัติ', match: (p) => inCat('auto', p) },
  sme: { key: 'sme', name: 'เครื่องมือ SME', desc: 'POS สต็อก บัญชีร้านค้า', sub: 'POS · สต็อก · บัญชี', image: 'c_sme.jpg', count: '610', accent: '#EA580C', span: 2, parent: 'sw', rule: (p) => sub(p) === 'เครื่องมือร้านค้า' || has(p, 'เครื่องมือร้านค้า') || /POS|สต็อก|ออเดอร์|ร้านค้า/.test(p.title + p.use), match: (p) => inCat('sme', p) },
  course: { key: 'course', name: 'คอร์สและอีบุ๊ก', desc: 'เรียนจากครีเอเตอร์ตัวจริง', sub: 'เรียนจากครีเอเตอร์', image: 'c_course.jpg', count: '410', accent: '#E0620B', parent: 'course', rule: () => true, match: (p) => inCat('course', p) },
  svc: { key: 'svc', name: 'งานจ้าง', desc: 'จ้างทำโลโก้ มาสคอต เว็บ', sub: 'มาสคอต โลโก้ เว็บ', image: 'mascot.jpg', count: '640', accent: '#DB2777', parent: 'hire', rule: () => true, match: (p) => inCat('svc', p) },
  media: { key: 'media', name: 'วิดีโอ เสียง เพลง', desc: 'คลิป เสียง เพลง พร้อมสิทธิ์ใช้', isNew: true, sub: 'วิดีโอ AI · เสียงพากย์ · เพลง · เทมเพลตตัดต่อ', image: 'c_media.jpg', tileImage: 'c_media_wide.jpg', count: '1,140', accent: '#9333EA', span: 3, parent: 'media', rule: () => true, match: (p) => inCat('media', p) },
  skill: { key: 'skill', name: 'Agent Skills', desc: 'ชุดทักษะเสริมให้ผู้ช่วย AI', isNew: true, sub: 'สกิลและชุดความรู้ให้ AI agent', image: 'c_skill.jpg', count: '260', accent: '#0F766E', parent: 'skill', rule: () => true, match: (p) => inCat('skill', p) },
  data: { key: 'data', name: 'ชุดข้อมูล', desc: 'ข้อมูลพร้อมใช้ ได้รับอนุญาตถูกต้อง', isNew: true, sub: 'CSV · JSON · พร้อมใช้งาน', image: 'c_data.jpg', count: '330', accent: '#1D4ED8', span: 2, parent: 'data', rule: () => true, match: (p) => inCat('data', p) },
  free: { key: 'free', name: 'ของฟรี', desc: 'ของฟรีทุกประเภท โหลดได้เลย', sub: 'ทุกประเภท โหลดได้เลย', image: 'g_frogs.jpg', count: '1,920', accent: '#16A34A', parent: null, rule: (p) => p.price === 0, match: (p) => inCat('free', p) },
}

/** The ทุกหมวด sheet groups: one per sell type (same names and order as the sell wizard), then ของฟรี. */
export const GROUPS: { name: string; color: string; type: SellType | null; keys: CatKey[] }[] = [
  ...SELL_TYPE_ORDER.map((k) => SPECS[k]).map((t) => ({ name: t.name, color: t.color, type: t.key, keys: (Object.keys(CATEGORIES) as CatKey[]).filter((k) => CATEGORIES[k].parent === t.key) })),
  { name: 'ทุกประเภท', color: '#16A34A', type: null, keys: ['free'] },
]
/** Search-page category groups of the approved v5-a layout (same 4 groups, tiles and order). */
export const SEARCH_GROUPS: { name: string; color: string; keys: CatKey[] }[] = [
  { name: 'ภาพและดีไซน์', color: '#7C3AED', keys: ['img', 'sticker', 'tpl', 'creator', 'media'] },
  { name: 'ซอฟต์แวร์ แอป และเกม', color: '#4F46E5', keys: ['sw', 'app', 'game', 'plugin', 'ext'] },
  { name: 'ธุรกิจและ AI', color: '#0E9384', keys: ['bot', 'ai', 'auto', 'skill', 'sme'] },
  { name: 'เรียนรู้ บริการ และของฟรี', color: '#E0620B', keys: ['course', 'svc', 'free'] },
]
/** Sub-categories of a sell type (shown on the sell wizard's type step). */
export const childrenOf = (t: SellType) => (Object.keys(CATEGORIES) as CatKey[]).filter((k) => CATEGORIES[k].parent === t)

/** Popular categories shown as the chip row on the search page (approved variant B). */
export const POPULAR: CatKey[] = ['img', 'tpl', 'sticker', 'creator', 'sw', 'app', 'game', 'course']
/** Short chip labels where the full name is too long. */
export const SHORT: Partial<Record<CatKey, string>> = {}
export const CAT_TOTAL = Object.keys(CATEGORIES).length

/** The one category name a work shows on its card (same 18 names as search), e.g. “บอทแชต · LINE”. */
export function catLabel(p: Product): string {
  const keys = (Object.keys(CATEGORIES) as CatKey[]).filter((k) => k !== 'free' && CATEGORIES[k].match(p))
  const k = keys[keys.length - 1]
  if (!k) return SPECS[sellTypeOf(p)].name
  const plat = k === 'bot' ? String((specOf(p).platform as string[] | undefined)?.[0] ?? '').replace(/ OA$/, '') : ''
  return plat ? `${CATEGORIES[k].name} · ${plat}` : CATEGORIES[k].name
}
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
    p.title, p.use, p.label ?? '', TYPES[p.type].name, SPECS[sellTypeOf(p)].name, creatorById(p.creatorId).name,
    ...(p.platforms ?? []), ...(TAGS[p.id] ?? []), ...(p.tags ?? []), p.desc ?? '',
    ...Object.values(CATEGORIES).filter((c) => c.match(p)).map((c) => c.name),
    p.price === 0 ? 'ฟรี' : '',
  ].join(' ').toLowerCase()

const INDEX = new Map<string, string>()
const hay = (p: Product) => { let h = INDEX.get(p.id); if (h === undefined) { h = haystack(p); INDEX.set(p.id, h) } return h }

/** Client-side search over sample works. Every word typed must appear somewhere. */
export function searchWorks(q: string, cat: CatKey | 'new' | null): Product[] {
  const mine = ALL_PRODUCTS.filter((p) => p.mine && isLive(p)).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
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
export const NEW_TODAY_COUNT = NEW_TODAY.length

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
