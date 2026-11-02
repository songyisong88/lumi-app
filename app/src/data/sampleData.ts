/**
 * SAMPLE DATA (ข้อมูลตัวอย่าง) — not real products, creators, or prices.
 * Replace with Supabase queries later; keep the shapes from ./types.ts.
 */
import type { ComingSoon, Creator, Product, Story, TypeKey } from './types'

export const TYPES: Record<TypeKey | 'soon', { name: string; color: string; bg: string }> = {
  img: { name: 'ภาพ', color: '#6C2BD9', bg: '#F3ECFF' },
  tpl: { name: 'เทมเพลต', color: '#2563EB', bg: '#EAF1FF' },
  tool: { name: 'เครื่องมือ', color: '#0E9384', bg: '#E3F7F4' },
  bot: { name: 'บอท', color: '#05A84B', bg: '#E5F8EC' },
  course: { name: 'คอร์ส', color: '#E0620B', bg: '#FFF0E3' },
  svc: { name: 'งานจ้าง', color: '#D6336C', bg: '#FDEBF2' },
  soon: { name: 'เร็ว ๆ นี้', color: '#6B6880', bg: '#F1F0F5' },
}

export const TYPE_ORDER: TypeKey[] = ['img', 'tpl', 'tool', 'bot', 'course', 'svc']

export const CREATORS: Creator[] = [
  { id: 'mint', name: 'มิ้นท์ สตูดิโอ', avatar: 'av_mint.jpg' },
  { id: 'nova', name: 'NOVA Lab', avatar: 'av_nova.jpg' },
  { id: 'fasai', name: 'ฟ้าใส ครีเอท', avatar: 'av_fasai.jpg' },
  { id: 'kenji', name: 'Kenji Web', avatar: 'av_kenji.jpg' },
  { id: 'pim', name: 'พิมพ์ดาว', avatar: 'av_pim.jpg' },
  { id: 'toy', name: 'Toy Mascot', avatar: 'av_toy.jpg' },
  { id: 'ton', name: 'Ton Data', avatar: 'av_ton.jpg' },
]

const img = (src: string, w: number, h: number) => ({ src, w, h })

export const PRODUCTS: Product[] = [
  { id: 'p01', kind: 'image', type: 'img', label: 'ภาพ + พรอมต์', title: 'ภาพบัวชมพูสีน้ำ โทนพาสเทล', use: 'ภาพแต่งผนัง ปกเพจ', creatorId: 'fasai', price: 390, image: img('g_lotus.jpg', 864, 1152), hasPrompt: true, instant: true },
  { id: 'p02', kind: 'image', type: 'img', label: 'สติกเกอร์ LINE', title: 'สติกเกอร์ชิบะทักทาย 24 ตัว', use: 'ส่งแชต LINE ใช้ได้ทันที', creatorId: 'pim', price: 59, image: img('shiba.jpg', 900, 900), instant: true },
  { id: 'p03', kind: 'tool', type: 'tool', label: 'ระบบอัตโนมัติ', title: 'ลงออเดอร์อัตโนมัติจาก LINE', use: 'ออเดอร์เข้า Sheets เอง ไม่ต้องพิมพ์', creatorId: 'ton', price: 590, ratio: '4/3', gradient: 'linear-gradient(160deg,#6366F1,#0EA5E9)', icon: 'flow', platforms: ['n8n', 'Sheets', 'LINE'], rating: 4.9, tryable: true },
  { id: 'p04', kind: 'image', type: 'img', title: 'วอลเปเปอร์ชาไทยสาดน้ำ', use: 'ตั้งพื้นหลังมือถือ', creatorId: 'nova', price: 0, image: img('splashbg.jpg', 506, 900), instant: true },
  { id: 'p05', kind: 'bot', type: 'bot', label: 'บอท LINE', title: 'บอทร้านอาหาร', use: 'ตอบเมนู รับออเดอร์ จองโต๊ะ', creatorId: 'kenji', price: 1500, ratio: '1/1', chat: { q: 'มีเมนูแนะนำไหมคะ', a: 'วันนี้แนะนำข้าวเหนียวมะม่วง สั่งเลยไหมคะ' }, tryable: true },
  { id: 'p06', kind: 'image', type: 'img', label: 'สติกเกอร์ LINE', title: 'สติกเกอร์กบน้อย 6 อารมณ์', use: 'ส่งแชต LINE ใช้ได้ทันที', creatorId: 'fasai', price: 0, image: img('g_frogs.jpg', 1024, 1024), instant: true },
  { id: 'p07', kind: 'template', type: 'tpl', title: 'เทมเพลตโพสต์ร้านกาแฟ 30 แบบ', use: 'โพสต์โปรโมชันรายวัน', creatorId: 'mint', price: 199, ratio: '4/5', image: img('cafe.jpg', 900, 675), files: ['CANVA', 'PSD'], tryable: true, instant: true },
  { id: 'p08', kind: 'course', type: 'course', title: 'สร้างภาพสินค้าด้วย AI ใน 1 วัน', use: 'ทำภาพขายของเองไม่ต้องจ้าง', creatorId: 'nova', price: 590, image: img('g_cyber.jpg', 1280, 720), video: true, meta: '12 ตอน · 3 ชม.', freeFirst: 'บทแรกฟรี', tryable: true },
  { id: 'p09', kind: 'image', type: 'img', title: 'ตุ๊กตุ๊กดินปั้น 3D ชุด 8 มุม', use: 'ภาพโฆษณา ของที่ระลึก', creatorId: 'toy', price: 290, image: img('g_tuktuk.jpg', 864, 1152), hasPrompt: true, instant: true },
  { id: 'p10', kind: 'tool', type: 'tool', label: 'เครื่องมือร้านค้า', title: 'เขียนคำบรรยายสินค้าด้วย AI', use: 'ใส่รูปสินค้า ได้แคปชันขาย 5 แบบ', creatorId: 'ton', price: 149, priceSuffix: '/เดือน', ratio: '1/1', gradient: 'linear-gradient(160deg,#14B8A6,#0E7490)', icon: 'pen', platforms: ['Shopee', 'Lazada', 'TikTok'], rating: 4.8, tryable: true, instant: true },
  { id: 'p11', kind: 'course', type: 'course', label: 'อีบุ๊ก', title: 'อีบุ๊กพรอมต์ขายของ 30 แบบ', use: 'ก๊อปไปใช้กับ ChatGPT ได้ทันที', creatorId: 'ton', price: 0, image: img('g_poster.jpg', 864, 1152), meta: '24 หน้า', hasPrompt: true, instant: true },
  { id: 'p12', kind: 'image', type: 'img', title: 'ภาพอนิเมะสาวชุดไทย', use: 'ปกนิยาย โปสเตอร์', creatorId: 'kenji', price: 159, image: img('g_anime.jpg', 864, 1152), hasPrompt: true, instant: true },
  { id: 'p13', kind: 'tool', type: 'tool', label: 'ผู้ช่วย AI', title: 'ผู้ช่วยแอดมินเพจ', use: 'ร่างคำตอบลูกค้า สรุปแชตรายวัน', creatorId: 'kenji', price: 390, ratio: '3/4', gradient: 'linear-gradient(160deg,#8B5CF6,#EC4899)', icon: 'robot', platforms: ['ChatGPT', 'Facebook'], rating: 4.7, tryable: true },
  { id: 'p14', kind: 'commission', type: 'svc', title: 'จ้างออกแบบมาสคอตร้าน 1 ตัว', use: 'ใช้บนป้าย แพ็กเกจ สติกเกอร์', creatorId: 'toy', price: 600, image: img('mascot.jpg', 900, 900), days: 5, revisions: 3 },
  { id: 'p15', kind: 'image', type: 'img', title: 'ภาพโปรโมตเซรั่ม โทนพาสเทล', use: 'โพสต์ขายของ แบนเนอร์ Shopee', creatorId: 'nova', price: 129, image: img('serum.jpg', 675, 900), instant: true },
  { id: 'p16', kind: 'image', type: 'img', title: 'ภาพเมนูผัดไทย', use: 'ทำเมนู โพสต์ร้านอาหาร', creatorId: 'mint', price: 99, image: img('padthai.jpg', 900, 675), instant: true },
  { id: 'p17', kind: 'image', type: 'img', title: 'ภาพชาไทยสาดน้ำ', use: 'โฆษณาเครื่องดื่ม', creatorId: 'pim', price: 0, image: img('thaitea.jpg', 675, 900), instant: true },
  { id: 'p18', kind: 'bot', type: 'bot', label: 'บอท LINE', title: 'บอทคลินิกความงาม', use: 'นัดคิว แจ้งโปรโมชัน', creatorId: 'kenji', price: 2900, ratio: '1/1', chat: { q: 'ว่างวันเสาร์ไหมคะ', a: 'เสาร์นี้ว่าง 13:00 และ 15:30 ค่ะ' }, tryable: true },
  { id: 'p19', kind: 'template', type: 'tpl', label: 'ไฟล์พิมพ์', title: 'สมุดระบายสีสัตว์ไทย 40 หน้า', use: 'พิมพ์ให้เด็กระบายสี', creatorId: 'pim', price: 89, ratio: '3/4', image: img('elephant.jpg', 900, 900), files: ['PDF', 'A4'], tryable: true, instant: true },
  { id: 'p20', kind: 'commission', type: 'svc', title: 'ทำภาพโปรโมต 5 ภาพ', use: 'ภาพโฆษณาเพจและแบนเนอร์', creatorId: 'nova', price: 450, image: img('g_product.jpg', 1152, 864), days: 3, revisions: 2 },
  { id: 'p21', kind: 'image', type: 'img', title: 'ภาพเทพธิดาชุดไทยแฟนตาซี', use: 'ปกนิยาย ปกเกม', creatorId: 'fasai', price: 190, image: img('fantasy.jpg', 675, 900), hasPrompt: true, instant: true },
  { id: 'p22', kind: 'template', type: 'tpl', label: 'เว็บไซต์', title: 'เว็บไซต์ร้านเบเกอรี่ 1 หน้า', use: 'เปิดหน้าร้านออนไลน์ใน 1 วัน', creatorId: 'kenji', price: 690, ratio: '4/5', image: img('bakery.jpg', 900, 675), files: ['HTML', 'FIGMA'], tryable: true },
  { id: 'p23', kind: 'image', type: 'img', label: 'สติกเกอร์ LINE', title: 'สติกเกอร์แมวส้ม 6 อารมณ์', use: 'ส่งแชต LINE ใช้ได้ทันที', creatorId: 'pim', price: 0, image: img('cats.jpg', 900, 900), instant: true },
  { id: 'p24', kind: 'image', type: 'img', title: 'ภาพกาแฟเย็นสาดน้ำ', use: 'ปกเพจ โฆษณาร้านกาแฟ', creatorId: 'mint', price: 79, image: img('coffee.jpg', 900, 506), instant: true },
]

export const COMING_SOON: ComingSoon[] = [
  { id: 's1', icon: 'game', title: 'เกม', use: 'เกมเล่นบนเว็บ ลองเล่นก่อนซื้อ', waiting: 128 },
  { id: 's2', icon: 'code', title: 'ซอฟต์แวร์และแอป', use: 'โปรแกรมพร้อมรหัสใช้งาน', waiting: 96 },
  { id: 's3', icon: 'ext', title: 'ส่วนเสริม Chrome', use: 'ติดตั้งในเบราว์เซอร์', waiting: 41 },
  { id: 's4', icon: 'puzzle', title: 'ปลั๊กอิน', use: 'WordPress และ Shopify', waiting: 57 },
]

export const STORIES: Story[] = [
  { creatorId: 'mint', slides: [{ productId: 'p07', postedAgo: '1 ชม.' }, { productId: 'p16', postedAgo: '3 ชม.' }] },
  { creatorId: 'nova', slides: [{ productId: 'p20', postedAgo: '2 ชม.' }, { productId: 'p15', postedAgo: '5 ชม.' }, { productId: 'p08', postedAgo: '8 ชม.' }] },
  { creatorId: 'fasai', slides: [{ productId: 'p01', postedAgo: '30 นาที' }, { productId: 'p06', postedAgo: '4 ชม.' }] },
  { creatorId: 'kenji', slides: [{ productId: 'p12', postedAgo: '6 ชม.' }, { productId: 'p05', postedAgo: '9 ชม.' }] },
  { creatorId: 'pim', slides: [{ productId: 'p02', postedAgo: '1 วัน' }] },
]

/** Quick filters (row 1). `match` decides which products pass. */
export const QUICK_FILTERS: { id: string; label: string; match: (p: Product) => boolean }[] = [
  { id: 'all', label: 'สำหรับคุณ', match: () => true },
  { id: 'free', label: 'ฟรี', match: (p) => p.price === 0 },
  { id: 'try', label: 'ลองก่อนซื้อได้', match: (p) => !!p.tryable },
  { id: 'instant', label: 'ใช้ได้ทันที', match: (p) => !!p.instant },
  { id: 'prompt', label: 'มีพรอมต์', match: (p) => !!p.hasPrompt },
  { id: 'u200', label: 'ต่ำกว่า ฿200', match: (p) => p.price < 200 },
  { id: 'hire', label: 'จ้างทำให้', match: (p) => p.kind === 'commission' },
]

export const creatorById = (id: string) => CREATORS.find((c) => c.id === id)!
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id)
export const imgUrl = (file: string) => `${import.meta.env.BASE_URL}img/${file}`
export const formatPrice = (p: Product) => (p.price === 0 ? 'ฟรี' : `฿${p.price.toLocaleString('th-TH')}${p.priceSuffix ?? ''}`)
