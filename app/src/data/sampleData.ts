/**
 * SAMPLE DATA (ข้อมูลตัวอย่าง) — not real products, creators, or prices.
 * Replace with Supabase queries later; keep the shapes from ./types.ts.
 */
import type { Creator, Product, Story, TypeKey } from './types'

export const TYPES: Record<TypeKey, { name: string; color: string; bg: string }> = {
  img: { name: 'ภาพ', color: '#6C2BD9', bg: '#F3ECFF' },
  tpl: { name: 'เทมเพลต', color: '#2563EB', bg: '#EAF1FF' },
  tool: { name: 'เครื่องมือ', color: '#0E9384', bg: '#E3F7F4' },
  bot: { name: 'บอท', color: '#05A84B', bg: '#E5F8EC' },
  course: { name: 'คอร์ส', color: '#E0620B', bg: '#FFF0E3' },
  svc: { name: 'งานจ้าง', color: '#D6336C', bg: '#FDEBF2' },
  media: { name: 'วิดีโอ เสียง เพลง', color: '#9333EA', bg: '#F5EBFF' },
  skill: { name: 'Agent Skills', color: '#0F766E', bg: '#E2F6F2' },
  data: { name: 'ชุดข้อมูล', color: '#1D4ED8', bg: '#E8EFFF' },
}

export const TYPE_ORDER: TypeKey[] = ['img', 'tpl', 'tool', 'bot', 'course', 'svc', 'media', 'skill', 'data']

export const CREATORS: Creator[] = [
  { id: 'mint', name: 'มิ้นท์ สตูดิโอ', avatar: 'av_mint.jpg' },
  { id: 'nova', name: 'NOVA Lab', avatar: 'av_nova.jpg' },
  { id: 'fasai', name: 'ฟ้าใส ครีเอท', avatar: 'av_fasai.jpg' },
  { id: 'kenji', name: 'Kenji Web', avatar: 'av_kenji.jpg' },
  { id: 'pim', name: 'พิมพ์ดาว', avatar: 'av_pim.jpg' },
  { id: 'toy', name: 'Toy Mascot', avatar: 'av_toy.jpg' },
  { id: 'ton', name: 'Ton Data', avatar: 'av_ton.jpg' },
  // customers (chat sample data)
  { id: 'shop', name: 'ร้านกาแฟบ้านสวน', avatar: 'av_shop.jpg' },
  { id: 'somjai', name: 'คุณสมใจ', avatar: 'av_somjai.jpg' },
]

/** The signed-in user: the sample creator 'fasai' in demo mode, the account id (uuid) when signed in.
 *  `let` + ES live bindings: every import sees the new value after setMe(). */
export let ME = 'fasai'
export function setMe(id: string) { ME = id }

/** Real accounts (Supabase profiles) seen this session, so creatorById works for them too. */
const REMOTE_CREATORS = new Map<string, Creator>()
export function registerCreators(list: Creator[]) { for (const c of list) REMOTE_CREATORS.set(c.id, c) }
export const isRemoteId = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

const img = (src: string, w: number, h: number) => ({ src, w, h })

export const PRODUCTS: Product[] = [
  { id: 'p01', kind: 'image', type: 'img', label: 'ภาพ + พรอมต์', title: 'ภาพบัวชมพูสีน้ำ โทนพาสเทล', use: 'ภาพแต่งผนัง ปกเพจ', creatorId: 'fasai', price: 390, image: img('g_lotus.jpg', 864, 1152), hasPrompt: true, instant: true },
  { id: 'p02', kind: 'image', type: 'img', label: 'สติกเกอร์ PNG', title: 'สติกเกอร์ชิบะทักทาย 24 ตัว', use: 'ไฟล์ PNG พื้นใส ใช้โพสต์และทำสื่อได้', creatorId: 'pim', price: 59, image: img('shiba.jpg', 900, 900), instant: true },
  { id: 'p03', kind: 'tool', type: 'tool', label: 'ระบบอัตโนมัติ', title: 'ลงออเดอร์อัตโนมัติจาก LINE', use: 'ออเดอร์เข้า Sheets เอง ไม่ต้องพิมพ์', creatorId: 'ton', price: 590, ratio: '4/3', gradient: 'linear-gradient(160deg,#6366F1,#0EA5E9)', icon: 'flow', platforms: ['n8n', 'Sheets', 'LINE'], rating: 4.9, tryable: true },
  { id: 'p04', kind: 'image', type: 'img', title: 'วอลเปเปอร์คริสตัลบัวม่วง', use: 'ตั้งพื้นหลังมือถือ', creatorId: 'nova', price: 0, image: img('splashbg.jpg', 506, 900), instant: true },
  { id: 'p05', kind: 'bot', type: 'bot', label: 'บอทแชต', title: 'บอทร้านอาหาร', use: 'ตอบเมนู รับออเดอร์ จองโต๊ะ', creatorId: 'kenji', price: 1500, ratio: '1/1', chat: { q: 'มีเมนูแนะนำไหมคะ', a: 'วันนี้แนะนำข้าวเหนียวมะม่วง สั่งเลยไหมคะ' }, tryable: true },
  { id: 'p06', kind: 'image', type: 'img', label: 'สติกเกอร์ PNG', title: 'สติกเกอร์กบน้อย 6 อารมณ์', use: 'ไฟล์ PNG พื้นใส ใช้โพสต์และทำสื่อได้', creatorId: 'fasai', price: 0, image: img('g_frogs.jpg', 1024, 1024), instant: true },
  { id: 'p07', kind: 'template', type: 'tpl', title: 'เทมเพลตโพสต์ร้านกาแฟ 30 แบบ', use: 'โพสต์โปรโมชันรายวัน', creatorId: 'mint', price: 199, ratio: '4/5', image: img('cafe.jpg', 900, 675), files: ['CANVA', 'PSD'], tryable: true, instant: true },
  { id: 'p08', kind: 'course', type: 'course', title: 'สร้างภาพสินค้าด้วย AI ใน 1 วัน', use: 'ทำภาพขายของเองไม่ต้องจ้าง', creatorId: 'nova', price: 590, image: img('g_cyber.jpg', 1280, 720), video: true, meta: '6 ตอน · 1.5 ชม.', freeFirst: 'บทแรกฟรี', tryable: true },
  { id: 'p09', kind: 'image', type: 'img', title: 'ตุ๊กตุ๊กดินปั้น 3D ชุด 8 มุม', use: 'ภาพโฆษณา ของที่ระลึก', creatorId: 'toy', price: 290, image: img('g_tuktuk.jpg', 864, 1152), hasPrompt: true, instant: true },
  { id: 'p10', kind: 'tool', type: 'tool', label: 'เครื่องมือร้านค้า', title: 'เขียนคำบรรยายสินค้าด้วย AI', use: 'ใส่รูปสินค้า ได้แคปชันขาย 5 แบบ', creatorId: 'ton', price: 149, priceSuffix: '/เดือน', ratio: '1/1', gradient: 'linear-gradient(160deg,#14B8A6,#0E7490)', icon: 'pen', platforms: ['Shopee', 'Lazada', 'TikTok'], rating: 4.8, tryable: true, instant: true },
  { id: 'p11', kind: 'course', type: 'course', label: 'อีบุ๊ก', title: 'อีบุ๊กพรอมต์ขายของ 30 แบบ', use: 'ก๊อปไปใช้กับ ChatGPT ได้ทันที', creatorId: 'ton', price: 0, image: img('g_poster.jpg', 864, 1152), meta: '24 หน้า', hasPrompt: true, instant: true },
  { id: 'p12', kind: 'image', type: 'img', title: 'ภาพอนิเมะสาวชุดไทย', use: 'ปกนิยาย โปสเตอร์', creatorId: 'kenji', price: 159, image: img('g_anime.jpg', 864, 1152), hasPrompt: true, instant: true },
  { id: 'p13', kind: 'tool', type: 'tool', label: 'ผู้ช่วย AI', title: 'ผู้ช่วยแอดมินเพจ', use: 'ร่างคำตอบลูกค้า สรุปแชตรายวัน', creatorId: 'kenji', price: 390, ratio: '3/4', gradient: 'linear-gradient(160deg,#8B5CF6,#EC4899)', icon: 'robot', platforms: ['ChatGPT', 'Facebook'], rating: 4.7, tryable: true },
  { id: 'p14', kind: 'commission', type: 'svc', title: 'จ้างออกแบบมาสคอตร้าน 1 ตัว', use: 'ใช้บนป้าย แพ็กเกจ สติกเกอร์', creatorId: 'toy', price: 600, image: img('mascot.jpg', 900, 900), days: 5, revisions: 3 },
  { id: 'p15', kind: 'image', type: 'img', title: 'ภาพโปรโมตเซรั่ม โทนพาสเทล', use: 'โพสต์ขายของ แบนเนอร์ Shopee', creatorId: 'nova', price: 129, image: img('serum.jpg', 675, 900), instant: true },
  { id: 'p16', kind: 'image', type: 'img', title: 'ภาพเมนูผัดไทย', use: 'ทำเมนู โพสต์ร้านอาหาร', creatorId: 'mint', price: 99, image: img('padthai.jpg', 900, 675), instant: true },
  { id: 'p17', kind: 'image', type: 'img', title: 'ภาพชาไทยสาดน้ำ', use: 'โฆษณาเครื่องดื่ม', creatorId: 'pim', price: 0, image: img('thaitea.jpg', 675, 900), instant: true },
  { id: 'p18', kind: 'bot', type: 'bot', label: 'บอทแชต', title: 'บอทคลินิกความงาม', use: 'นัดคิว แจ้งโปรโมชัน', creatorId: 'kenji', price: 2900, ratio: '1/1', chat: { q: 'ว่างวันเสาร์ไหมคะ', a: 'เสาร์นี้ว่าง 13:00 และ 15:30 ค่ะ' }, tryable: true },
  { id: 'p19', kind: 'template', type: 'tpl', label: 'ไฟล์พิมพ์', title: 'สมุดระบายสีสัตว์ไทย 40 หน้า', use: 'พิมพ์ให้เด็กระบายสี', creatorId: 'pim', price: 89, ratio: '3/4', image: img('elephant.jpg', 900, 900), files: ['PDF', 'A4'], tryable: true, instant: true },
  { id: 'p20', kind: 'commission', type: 'svc', title: 'ทำภาพโปรโมต 5 ภาพ', use: 'ภาพโฆษณาเพจและแบนเนอร์', creatorId: 'nova', price: 450, image: img('g_product.jpg', 1152, 864), days: 3, revisions: 2 },
  { id: 'p21', kind: 'image', type: 'img', title: 'ภาพเทพธิดาชุดไทยแฟนตาซี', use: 'ปกนิยาย ปกเกม', creatorId: 'fasai', price: 190, image: img('fantasy.jpg', 675, 900), hasPrompt: true, instant: true },
  { id: 'p22', kind: 'template', type: 'tpl', label: 'เว็บไซต์', title: 'เว็บไซต์ร้านเบเกอรี่ 1 หน้า', use: 'เปิดหน้าร้านออนไลน์ใน 1 วัน', creatorId: 'kenji', price: 690, ratio: '4/5', image: img('bakery.jpg', 900, 675), files: ['HTML', 'FIGMA'], tryable: true },
  { id: 'p23', kind: 'image', type: 'img', label: 'สติกเกอร์ PNG', title: 'สติกเกอร์แมวส้ม 6 อารมณ์', use: 'ไฟล์ PNG พื้นใส ใช้โพสต์และทำสื่อได้', creatorId: 'pim', price: 0, image: img('cats.jpg', 900, 900), instant: true },
  { id: 'p24', kind: 'image', type: 'img', title: 'ภาพกาแฟเย็นสาดน้ำ', use: 'ปกเพจ โฆษณาร้านกาแฟ', creatorId: 'mint', price: 79, image: img('coffee.jpg', 900, 506), instant: true },
]

/**
 * Extra SAMPLE works used by the search page (ใหม่วันนี้ shelf + software/app/game/plugin
 * categories). Kept separate so the approved home feed stays unchanged.
 */
export const SEARCH_EXTRA: Product[] = [
  { id: 'n01', kind: 'image', type: 'img', title: 'ภาพข้าวเหนียวมะม่วงสีน้ำ', use: 'เมนู ปกเพจ', creatorId: 'fasai', price: 49, image: img('stickyrice.jpg', 900, 900), instant: true },
  { id: 'n02', kind: 'image', type: 'tool', label: 'อัตโนมัติ', title: 'ระบบแจ้งเตือนสต็อกใน LINE', use: 'ของใกล้หมดเตือนเอง', creatorId: 'kenji', price: 0, image: img('c_auto.jpg', 720, 720), tryable: true },
  { id: 'n03', kind: 'image', type: 'img', title: 'ภาพน้ำหอมบนผ้าไหม', use: 'โฆษณาแบรนด์', creatorId: 'nova', price: 129, image: img('perfume.jpg', 900, 900), instant: true },
  { id: 'n04', kind: 'image', type: 'img', title: 'ตุ๊กตาขนมหวาน 3D', use: 'ปกเพจ ร้านขนม', creatorId: 'toy', price: 99, image: img('toys.jpg', 900, 506), instant: true },
  { id: 'n05', kind: 'image', type: 'tool', label: 'โปรแกรม', title: 'โปรแกรม POS ร้านค้าเล็ก', use: 'ขายหน้าร้าน ตัดสต็อกให้เอง', creatorId: 'nova', price: 990, image: img('c_sme.jpg', 720, 720), platforms: ['Windows', 'Mac'], tryable: true },
  { id: 'n06', kind: 'image', type: 'tool', label: 'แอปมือถือ', title: 'แอปจองคิวร้านเสริมสวย', use: 'ลูกค้าจองเองผ่านมือถือ', creatorId: 'kenji', price: 1490, image: img('c_app.jpg', 720, 720), platforms: ['iOS', 'Android'] },
  { id: 'n07', kind: 'image', type: 'tool', label: 'เกม', title: 'เกมจับคู่ผลไม้ไทย', use: 'ซอร์สโค้ด ปรับแต่งได้', creatorId: 'toy', price: 0, image: img('c_game.jpg', 720, 720), tryable: true },
  { id: 'n08', kind: 'image', type: 'tool', label: 'ปลั๊กอิน', title: 'ปลั๊กอินรีวิวสินค้า Shopify', use: 'ติดดาว รีวิวมีรูป', creatorId: 'kenji', price: 390, image: img('c_plugin.jpg', 720, 720), platforms: ['Shopify'] },
  { id: 'n09', kind: 'image', type: 'tool', label: 'ส่วนขยาย Chrome', title: 'ส่วนขยายจดออเดอร์จากแชต', use: 'กดเดียวเก็บออเดอร์ลงตาราง', creatorId: 'ton', price: 190, image: img('c_plugin.jpg', 720, 720), platforms: ['Chrome'] },
  { id: 'n10', kind: 'image', type: 'tpl', label: 'ฟอนต์', title: 'ฟอนต์ไทยลายมือ “ใบเตย”', use: 'ปก โพสต์ เมนู', creatorId: 'pim', price: 0, image: img('c_creator.jpg', 720, 720), instant: true },
  { id: 'n11', kind: 'image', type: 'tool', label: 'โปรแกรม', title: 'โปรแกรมตัดพื้นหลังภาพสินค้า', use: 'ตัดทีละร้อยภาพในคลิกเดียว', creatorId: 'nova', price: 590, image: img('c_software.jpg', 720, 720), platforms: ['Windows', 'Mac'] },
  { id: 'n12', kind: 'image', type: 'img', label: 'ภาพ 3D', title: 'เกาะลอยฟ้าวัดไทย 3D', use: 'ปกเกม พื้นหลัง', creatorId: 'toy', price: 159, image: img('g_island.jpg', 900, 900) },
  // วิดีโอ เสียง และเพลง · Agent Skills · ชุดข้อมูล (added 2 Nov)
  { id: 'n13', kind: 'image', type: 'media', label: 'วิดีโอ AI', title: 'วิดีโอ AI โปรโมตร้านกาแฟ 15 วินาที', use: 'รีลส์ ติ๊กต็อก โฆษณาร้าน', creatorId: 'nova', price: 290, image: img('coffee.jpg', 900, 506), video: true, instant: true },
  { id: 'n14', kind: 'image', type: 'media', label: 'เพลงต้นฉบับ', title: 'เพลงประกอบคลิป ลูกทุ่งชิล 10 เพลง', use: 'ใส่คลิปรีวิว ไลฟ์ขายของ', creatorId: 'ton', price: 390, image: img('c_media.jpg', 720, 720), instant: true },
  { id: 'n15', kind: 'image', type: 'media', label: 'เทมเพลตตัดต่อวิดีโอ', title: 'เทมเพลต CapCut รีวิวสกินแคร์ 5 แบบ', use: 'ใส่คลิปสินค้าแล้วโพสต์ได้เลย', creatorId: 'mint', price: 0, image: img('serum.jpg', 900, 900), video: true, instant: true },
  { id: 'n16', kind: 'image', type: 'skill', label: 'Agent Skills', title: 'Agent Skill ตอบแชตร้านค้าภาษาไทย', use: 'ให้ AI agent ตอบลูกค้าแบบร้านคุณ', creatorId: 'kenji', price: 490, image: img('c_skill.jpg', 720, 720), platforms: ['Claude', 'Cursor'], instant: true },
  { id: 'n17', kind: 'image', type: 'skill', label: 'Agent Skills', title: 'ชุดความรู้ภาษีร้านค้าออนไลน์ สำหรับ AI agent', use: 'ถามเรื่องภาษี VAT ใบกำกับ', creatorId: 'ton', price: 250, image: img('robot.jpg', 720, 720), platforms: ['ChatGPT', 'Claude'], instant: true },
  { id: 'n18', kind: 'image', type: 'data', label: 'ชุดข้อมูล', title: 'ชุดข้อมูลเมนูอาหารไทย 5,000 รายการ', use: 'ทำแอปร้านอาหาร เทรนโมเดล', creatorId: 'ton', price: 690, image: img('c_data.jpg', 720, 720), instant: true },
  { id: 'n19', kind: 'image', type: 'data', label: 'ชุดข้อมูล', title: 'ชุดข้อมูลรีวิวสินค้าภาษาไทย (ไม่มีข้อมูลส่วนตัว)', use: 'วิเคราะห์ความรู้สึก ทดสอบบอท', creatorId: 'nova', price: 0, image: img('padthai.jpg', 900, 900), instant: true },
]
/** The 3 newer categories also show at the end of the home feed so their filter chips aren't empty. */
export const NEW_CATEGORY_WORKS = SEARCH_EXTRA.filter((p) => ['media', 'skill', 'data'].includes(p.type))

/** Every sample work (home feed + search extras). Use this for lookups by id. */
export const ALL_PRODUCTS: Product[] = [...PRODUCTS, ...SEARCH_EXTRA]

export const STORIES: Story[] = [
  { creatorId: 'mint', slides: [{ productId: 'p07', postedAgo: '1 ชม.ที่แล้ว' }, { productId: 'p16', postedAgo: '3 ชม.ที่แล้ว' }] },
  { creatorId: 'nova', slides: [{ productId: 'p20', postedAgo: '2 ชม.ที่แล้ว' }, { productId: 'p15', postedAgo: '5 ชม.ที่แล้ว' }, { productId: 'p08', postedAgo: '8 ชม.ที่แล้ว' }] },
  { creatorId: 'fasai', slides: [{ productId: 'p01', postedAgo: '30 นาทีที่แล้ว' }, { productId: 'p06', postedAgo: '4 ชม.ที่แล้ว' }] },
  { creatorId: 'kenji', slides: [{ productId: 'p12', postedAgo: '6 ชม.ที่แล้ว' }, { productId: 'p05', postedAgo: '9 ชม.ที่แล้ว' }] },
  { creatorId: 'pim', slides: [{ productId: 'p02', postedAgo: 'เมื่อวาน' }] },
]

/** Quick filters (row 1). `match` decides which products pass. */
export const QUICK_FILTERS: { id: string; label: string; match: (p: Product) => boolean }[] = [
  { id: 'all', label: 'สำหรับคุณ', match: () => true },
  { id: 'free', label: 'ฟรี', match: (p) => p.price === 0 },
  { id: 'try', label: 'ลองก่อนซื้อได้', match: (p) => !!p.tryable },
  { id: 'instant', label: 'ใช้ได้ทันที', match: (p) => !!p.instant },
  { id: 'prompt', label: 'มีพรอมต์', match: (p) => !!p.hasPrompt },
  { id: 'u200', label: 'ต่ำกว่า ฿200', match: (p) => p.price < 200 },
]

/** Only reviewed (or sample) works show in the home feed, search and similar lists. */
export const isLive = (p: Product) => !p.mod || p.mod.status === 'live'

const UNKNOWN = (id: string): Creator => ({ id, name: 'ผู้ใช้ LUMI', avatar: 'av_somjai.jpg' })
export const creatorById = (id: string): Creator => CREATORS.find((c) => c.id === id) ?? REMOTE_CREATORS.get(id) ?? UNKNOWN(id)
export const remoteCreator = (id: string) => REMOTE_CREATORS.get(id)
export const productById = (id: string) => ALL_PRODUCTS.find((p) => p.id === id)
/** Add works published locally (sell wizard) to the catalog used by lookups and search. */
export function registerProducts(list: Product[]) {
  for (const p of list) {
    const i = ALL_PRODUCTS.findIndex((x) => x.id === p.id)
    if (i >= 0) ALL_PRODUCTS[i] = p
    else ALL_PRODUCTS.push(p)
  }
}
export function unregisterProduct(id: string) {
  const i = ALL_PRODUCTS.findIndex((x) => x.id === id)
  if (i >= 0) ALL_PRODUCTS.splice(i, 1)
}
/** File names resolve to public/img; data/blob URLs (local uploads) pass through. */
const EXT = /^(data:|blob:|https?:)/
/** Bundled sample images ship as WebP: <name>.webp (≤800 px wide) and <name>-400.webp; avatars only at 160 px.
 *  Data keeps the original .jpg names, so stored drafts/DB stay valid. `small` picks the 400 px file. */
export const imgUrl = (file: string, small = false) => {
  if (EXT.test(file)) return file
  const n = file.replace(/\.(jpe?g|png|webp)$/i, '')
  return `${import.meta.env.BASE_URL}img/${n}${small && !n.startsWith('av_') ? '-400' : ''}.webp`
}
/** srcset for <img>: 400w + 800w (none for avatars and uploaded data/blob images). */
export const imgSrcSet = (file: string) => (EXT.test(file) || file.startsWith('av_') ? undefined : `${imgUrl(file, true)} 400w, ${imgUrl(file)} 800w`)
export const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`
export const formatPrice = (p: Product) => (p.price === 0 ? 'ฟรี' : `฿${p.price.toLocaleString('th-TH')}${p.priceSuffix ?? ''}`)
