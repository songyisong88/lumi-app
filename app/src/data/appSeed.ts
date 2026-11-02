/** SAMPLE DATA (ข้อมูลตัวอย่าง) for chat, orders, community and notifications. */
import type { ListingDraft } from './listingSpec'
import { SPECS } from './listingSpec'
import type { DB, Message, Post, Room, Thread } from './appTypes'

const M = 60_000, H = 60 * M, D = 24 * H

export const ROOMS: Room[] = [
  { id: 'ai', name: 'ห้องภาพ AI', icon: 'image', color: '#6C2BD9', bg: '#F3ECFF', members: 12400, desc: 'แชร์ภาพ พรอมต์ และเทคนิคสร้างภาพด้วย AI', cover: 'g_anime.jpg', rules: ['แชร์พรอมต์ได้ แต่ห้ามขายของคนอื่น', 'ติดแท็กโมเดลที่ใช้ทุกครั้ง', 'คอมเมนต์อย่างสร้างสรรค์'] },
  { id: 'newbie', name: 'มือใหม่หัดขาย', icon: 'sparkle', color: '#DB2777', bg: '#FDEBF2', members: 15200, desc: 'ถามได้ทุกเรื่อง ตั้งราคา ถ่ายรูป ลงขายครั้งแรก', cover: 'g_lotus.jpg', rules: ['ไม่มีคำถามโง่', 'ห้ามสแปมลิงก์', 'ช่วยกันตอบ ได้แต้มชุมชน'] },
  { id: 'tpl', name: 'คนทำเทมเพลต', icon: 'megaphone', color: '#2563EB', bg: '#EAF1FF', members: 5100, desc: 'Canva Figma สไลด์ และไฟล์พิมพ์', cover: 'cafe.jpg', rules: ['บอกแอปและฟอนต์ที่ใช้', 'ห้ามแจกไฟล์ที่ซื้อมา'] },
  { id: 'code', name: 'โค้ดและเกม', icon: 'code', color: '#4F46E5', bg: '#EEF2FF', members: 3200, desc: 'โปรแกรม แอป เกมอินดี้ ปลั๊กอิน', cover: 'c_game.jpg', rules: ['แชร์โค้ดใส่บล็อกโค้ด', 'ห้ามแจกไฟล์แคร็ก'] },
  { id: 'bot', name: 'บอทและระบบอัตโนมัติ', icon: 'robot', color: '#15803D', bg: '#E5F8EC', members: 2800, desc: 'LINE OA n8n Make และ Sheets', cover: 'c_bot.jpg', rules: ['ห้ามโพสต์ API key จริง', 'แชร์ฟลว์เป็นรูปหรือไฟล์'] },
  { id: 'sticker', name: 'คนขายสติกเกอร์ LINE', icon: 'heart', color: '#F59E0B', bg: '#FFF4DB', members: 8900, desc: 'ออกแบบ ส่งตรวจ และโปรโมตสติกเกอร์', cover: 'shiba.jpg', rules: ['โชว์งานได้วันละ 1 โพสต์'] },
]

export function seed(): DB {
  const now = Date.now()
  const t = (ago: number) => now - ago
  let n = 0
  const id = () => `s${++n}`
  const threads: Thread[] = [
    { id: 't-toy', partnerId: 'toy', role: 'creator', title: 'ออกแบบมาสคอตร้าน 1 ตัว', image: 'mascot.jpg', productId: 'p14', orderNo: 'LM-20517', amount: 1200, hire: true, step: 1, status: 'รอคุณตอบรับข้อเสนอ', tone: 'warn', unread: 1, online: true, quick: ['รับข้อเสนอเลยครับ', 'ขอลดเหลือ ฿1,000 ได้ไหม', 'ส่งงานได้วันไหนครับ'], updatedAt: t(4 * M) },
    { id: 't-shop', partnerId: 'shop', role: 'customer', title: 'ภาพบัวชมพูสีน้ำ โทนพาสเทล', image: 'g_lotus.jpg', productId: 'p01', status: 'ถามเรื่องผลงาน', tone: 'info', unread: 1, online: true, quick: ['มีค่ะ เดี๋ยวส่งตัวอย่างให้ดูนะคะ', 'รับทำโทนเขียวให้ ฿150 ค่ะ', 'ขอบคุณที่สนใจค่ะ'], updatedAt: t(18 * M) },
    { id: 't-kenji', partnerId: 'kenji', role: 'creator', title: 'ปรับเว็บไซต์ร้านเบเกอรี่เป็นของร้าน', image: 'bakery.jpg', productId: 'p22', orderNo: 'LM-20488', amount: 1900, hire: true, step: 4, status: 'ส่งงานแล้ว รอคุณตรวจ', tone: 'warn', unread: 2, online: false, quick: ['ขอไฟล์ต้นฉบับด้วยนะครับ', 'ขอแก้สีปุ่มเป็นสีชมพูครับ', 'ขอบคุณมากครับ'], updatedAt: t(2 * H) },
    { id: 't-somjai', partnerId: 'somjai', role: 'customer', title: 'ภาพเทพธิดาชุดไทยแฟนตาซี', image: 'fantasy.jpg', productId: 'p21', orderNo: 'LM-20502', amount: 190, status: 'ชำระแล้ว · ไฟล์ส่งอัตโนมัติแล้ว', tone: 'ok', unread: 1, online: false, quick: ['ขอบคุณที่ซื้อนะคะ 🙏', 'พิมพ์ขนาด A3 ได้ค่ะ ไฟล์ 4K'], updatedAt: t(5 * H) },
    { id: 't-nova', partnerId: 'nova', role: 'creator', title: 'โปรแกรม POS ร้านค้าเล็ก', image: 'c_sme.jpg', productId: 'n05', orderNo: 'LM-20391', amount: 990, status: 'ซื้อแล้ว · ดาวน์โหลดได้', tone: 'ok', unread: 0, online: true, quick: ['ติดตั้งแล้วใช้ได้ครับ ขอบคุณครับ', 'ย้ายคีย์ไปเครื่องใหม่ยังไงครับ'], updatedAt: t(1 * D) },
    { id: 't-pim', partnerId: 'pim', role: 'creator', title: 'สติกเกอร์ชิบะทักทาย 24 ตัว', image: 'shiba.jpg', productId: 'p02', orderNo: 'LM-20366', amount: 59, status: 'เสร็จสมบูรณ์', tone: 'done', unread: 0, online: false, quick: ['น่ารักมากค่ะ', 'มีชุดแมวไหมคะ'], updatedAt: t(3 * D) },
  ]
  const messages: Record<string, Message[]> = {
    't-toy': [
      { id: id(), from: 'me', kind: 'brief', at: t(26 * H), title: 'บรีฟงานจ้าง', items: ['มาสคอตแมวส้มใส่ผ้ากันเปื้อน ถือแก้วกาแฟ', 'ใช้กับป้ายร้าน แก้วกาแฟ และสติกเกอร์', 'โทนสีครีม ส้ม น้ำตาล', 'งบประมาณ ~฿1,200 · อยากได้ภายใน 7 วัน'], image: 'mascot.jpg' },
      { id: id(), from: 'them', kind: 'text', at: t(25 * H), text: 'สวัสดีครับ ได้รับบรีฟแล้ว น่ารักมากเลยครับ 😊 ขอทำใบเสนอราคาให้นะครับ' },
      { id: id(), from: 'them', kind: 'offer', at: t(5 * M), title: 'ใบเสนอราคา · แพ็กเกจมาตรฐาน', amount: 1200, items: ['มาสคอต 1 ตัว + 3 ท่าทาง', 'ไฟล์ PNG พื้นใส + AI', 'แก้ไขได้ 3 ครั้ง', 'ส่งงานภายใน 5 วัน'], status: 'pending' },
      { id: id(), from: 'them', kind: 'text', at: t(4 * M), text: 'ส่งข้อเสนอราคา ฿1,200 มาแล้วครับ ถ้าโอเคกดรับได้เลยครับ' },
    ],
    't-shop': [
      { id: id(), from: 'them', kind: 'product', at: t(20 * M), productId: 'p01' },
      { id: id(), from: 'them', kind: 'text', at: t(18 * M), text: 'สวัสดีค่ะ ภาพบัวชมพูนี้มีโทนสีเขียวไหมคะ อยากใช้ทำปกเมนูร้าน 🌿' },
    ],
    't-kenji': [
      { id: id(), from: 'system', kind: 'system', at: t(4 * D), text: 'ชำระเงิน ฿1,900 แล้ว · เงินโอนให้ครีเอเตอร์เมื่อคุณกดรับงาน หรือครบ 3 วันหลังส่งงาน' },
      { id: id(), from: 'them', kind: 'progress', at: t(2 * D), title: 'อัปเดตความคืบหน้า', text: 'ใส่เมนู รูปร้าน และปุ่มสั่งผ่าน LINE แล้วครับ', pct: 70 },
      { id: id(), from: 'them', kind: 'delivery', at: t(2 * H + 5 * M), title: 'ส่งงานแล้ว · รอบที่ 2', image: 'bakery.jpg', round: 2, left: 1, status: 'pending', text: 'แก้ตามที่ขอ เปลี่ยนสีหัวเว็บและเพิ่มแผนที่ร้านแล้วครับ' },
      { id: id(), from: 'them', kind: 'file', at: t(2 * H + 4 * M), fileName: 'bakery-site-v2.zip', size: '6.1 MB' },
      { id: id(), from: 'them', kind: 'text', at: t(2 * H), text: 'ส่งเว็บเวอร์ชันแก้ไขให้แล้วครับ ลองเปิดดูได้เลยครับ 🙏' },
    ],
    't-somjai': [
      { id: id(), from: 'system', kind: 'system', at: t(5 * H + M), text: 'คุณสมใจ ชำระเงิน ฿190 แล้ว · ออเดอร์ #LM-20502 · LUMI ส่งไฟล์ให้ลูกค้าอัตโนมัติแล้ว' },
      { id: id(), from: 'them', kind: 'text', at: t(5 * H), text: 'ได้รับไฟล์แล้วค่ะ สวยมาก 😍 ขอถามว่าพิมพ์ขนาด A3 ได้ไหมคะ' },
    ],
    't-nova': [
      { id: id(), from: 'system', kind: 'system', at: t(1 * D + 20 * M), text: 'ชำระเงิน ฿990 แล้ว · ออเดอร์ #LM-20391' },
      { id: id(), from: 'them', kind: 'key', at: t(1 * D + 19 * M), title: 'คีย์ใช้งาน · 1 เครื่อง', code: 'LUMI-7KQ2-9XWD-4MPA' },
      { id: id(), from: 'them', kind: 'file', at: t(1 * D + 19 * M), fileName: 'POS-ShopLite-Setup-v1.3.exe', size: '48 MB' },
      { id: id(), from: 'them', kind: 'text', at: t(1 * D), text: 'ขอบคุณที่ซื้อครับ ติดตั้งไม่ได้ทักมาได้เลยนะครับ' },
    ],
    't-pim': [
      { id: id(), from: 'system', kind: 'system', at: t(3 * D + 10 * M), text: 'ชำระเงิน ฿59 แล้ว · ออเดอร์ #LM-20366' },
      { id: id(), from: 'them', kind: 'file', at: t(3 * D + 9 * M), fileName: 'shiba-24-stickers.zip', size: '3.2 MB' },
      { id: id(), from: 'them', kind: 'text', at: t(3 * D + 5 * M), text: 'ขอบคุณที่อุดหนุนนะคะ 🐶 แจกคูปองลด 15% ครั้งหน้าค่ะ' },
      { id: id(), from: 'them', kind: 'coupon', at: t(3 * D), title: 'คูปองลด 15% ร้านพิมพ์ดาว', code: 'PIM15' },
    ],
  }
  const posts: Post[] = [
    { id: 'c1', authorId: 'nova', at: t(40 * M), tag: 'โชว์ผลงาน', text: 'ลองทำชุดภาพโปรโมตตุ๊กตุ๊กดินปั้น 3 ภาพ ใช้เวลาแค่ 20 นาที 🛺✨ ใครอยากได้สูตร แชร์พรอมต์ไว้ในโพสต์แล้วนะครับ #ภาพAI #ตุ๊กตุ๊ก #ดินปั้น', images: ['g_tuktuk.jpg', 'g_poster.jpg', 'thaitea.jpg'], productIds: ['p09'], prompt: '/imagine prompt: a cute clay tuk-tuk on a pastel Bangkok street, soft studio light, tiny details, isometric, 3D render --ar 3:4 --stylize 500', roomId: 'ai', likes: 248, comments: 3, shares: 12 },
    { id: 'c2', authorId: 'ton', at: t(2 * H), tag: 'ความรู้', text: '3 สูตร Google Sheets ที่ร้านเล็กต้องมี ตัดสต็อกเองไม่ต้องนั่งนับ 📊 เซฟเก็บไว้ได้เลย #Sheets #ร้านค้าออนไลน์', images: [], code: ['=SUMIF(ยอดขาย!B:B, A2, ยอดขาย!C:C)', '=IF(D2<5, "ใกล้หมด", "พอ")', '=QUERY(A:D, "select A, sum(C) group by A")'], productIds: ['p03'], roomId: 'bot', likes: 512, comments: 1, shares: 88 },
    { id: 'c3', authorId: 'kenji', at: t(5 * H), tag: 'เบื้องหลัง', text: 'เบื้องหลังแอปจองคิวร้านเสริมสวย ทำ 2 สัปดาห์ ส่วนที่ยากสุดคือปฏิทินวันหยุดร้าน 😅 ใครทำแอปอยู่มาแลกเปลี่ยนกันครับ #แอปมือถือ #เบื้องหลัง', images: ['c_app.jpg', 'c_software.jpg'], productIds: ['n06'], roomId: 'code', likes: 136, comments: 0, shares: 5 },
    { id: 'c4', authorId: 'mint', at: t(9 * H), tag: 'ถาม-ตอบ', text: 'ถามหน่อยค่ะ เทมเพลตโพสต์ร้านกาแฟ ควรทำ 4:5 หรือ 1:1 ดีคะ ลูกค้าส่วนใหญ่ลง IG กับ Facebook 🙏 #ถามตอบ #เทมเพลต', images: [], productIds: [], roomId: 'tpl', likes: 42, comments: 1, shares: 0 },
    { id: 'c5', authorId: 'pim', at: t(1 * D), tag: 'แจกฟรี', text: 'แจกฟรี! ฟอนต์ลายมือ “ใบเตย” ใช้ได้ทั้งไทยและอังกฤษ 🌿 โหลดไปใช้ส่วนตัวได้เลยค่ะ #แจกฟรี #ฟอนต์ไทย', images: ['c_creator.jpg'], productIds: ['n10'], roomId: 'newbie', likes: 890, comments: 0, shares: 120 },
    { id: 'c6', authorId: 'toy', at: t(1 * D + 3 * H), tag: 'โชว์ผลงาน', text: 'มาสคอตร้านขนมที่เพิ่งส่งงาน ลูกค้าเอาไปทำสติกเกอร์แจกด้วย 🧁 รับคิวเดือนนี้อีก 3 งานครับ #มาสคอต #3D', images: ['mascot.jpg', 'toys.jpg'], productIds: ['p14'], hireButton: true, roomId: 'ai', likes: 301, comments: 0, shares: 9 },
    { id: 'c7', authorId: 'fasai', at: t(2 * D), tag: 'โชว์ผลงาน', text: 'ภาพบัวสีน้ำชุดใหม่ โทนพาสเทลอ่อน ๆ เหมาะทำปกเพจสปาและร้านชา 🪷 #สีน้ำ #ภาพAI', images: ['g_lotus.jpg'], productIds: ['p01'], roomId: 'ai', likes: 77, comments: 0, shares: 2, mine: true },
  ]
  const comments = [
    { id: 'k1', postId: 'c1', authorId: 'ton', text: 'สวยมากครับ ขอถามว่าแสงนุ่ม ๆ แบบนี้ใส่คำว่าอะไรครับ', at: t(30 * M), likes: 12 },
    { id: 'k2', postId: 'c1', authorId: 'nova', text: 'ใส่ “soft studio light” กับ “isometric” ครับ ลองดูได้เลย', at: t(25 * M), likes: 20, replyTo: 'k1', badge: 'author' as const },
    { id: 'k3', postId: 'c1', authorId: 'somjai', text: 'ซื้อชุดนี้ไปทำป้ายร้านแล้วค่ะ ลูกค้าชมเยอะมาก', at: t(15 * M), likes: 8, badge: 'buyer' as const },
    { id: 'k4', postId: 'c2', authorId: 'mint', text: 'สูตร QUERY ช่วยชีวิตมากค่ะ ขอบคุณค่ะ', at: t(H), likes: 5 },
    { id: 'k5', postId: 'c4', authorId: 'nova', text: '4:5 ครับ กินพื้นที่ฟีดมากกว่า แล้วค่อยครอปเป็น 1:1 ทีหลังได้', at: t(8 * H), likes: 9 },
  ]
  const draft = (x: Partial<ListingDraft> & { id: string }): ListingDraft => ({ type: null, step: 0, title: '', use: '', desc: '', tags: [], covers: [], spec: {}, free: false, tips: false, options: [], updatedAt: now, ...x })
  return {
    v: 3,
    follows: ['nova', 'pim', 'toy'],
    cart: [
      { key: 'ci1', productId: 'p07', optionId: 'full', price: 199, optionLabel: 'ชุดเต็ม' },
      { key: 'ci2', productId: 'p12', optionId: 'both', optionLabel: 'ภาพ + พรอมต์', price: 159 },
    ],
    orders: [
      { id: 'o1', no: 'LM-20391', items: [{ key: 'x1', productId: 'n05', price: 990, optionLabel: '1 เครื่อง' }], total: 990, discount: 0, at: t(1 * D + 20 * M), method: 'พร้อมเพย์ (ทดลอง)' },
      { id: 'o2', no: 'LM-20366', items: [{ key: 'x2', productId: 'p02', price: 59 }], total: 59, discount: 0, at: t(3 * D + 10 * M), method: 'บัตร (ทดลอง)' },
    ],
    purchases: [
      { id: 'b1', productId: 'n05', orderNo: 'LM-20391', optionLabel: '1 เครื่อง', at: t(1 * D + 20 * M), title: 'โปรแกรม POS ร้านค้าเล็ก', image: 'c_sme.jpg', creatorId: 'nova', price: 990, key: 'LUMI-7KQ2-9XWD-4MPA', threadId: 't-nova' },
      { id: 'b2', productId: 'p02', orderNo: 'LM-20366', at: t(3 * D + 10 * M), title: 'สติกเกอร์ชิบะทักทาย 24 ตัว', image: 'shiba.jpg', creatorId: 'pim', price: 59, threadId: 't-pim' },
      { id: 'b3', productId: 'p04', orderNo: 'LM-20334', at: t(6 * D), title: 'วอลเปเปอร์คริสตัลบัวม่วง', image: 'splashbg.jpg', creatorId: 'nova', price: 0 },
    ],
    threads, messages, posts,
    liked: ['c5'], saved: ['c2'], comments, likedComments: [],
    joined: ['ai', 'newbie'], votes: [],
    notifs: [
      { id: 'n1', kind: 'order', text: 'Toy Mascot ส่งใบเสนอราคา ฿1,200 · กดรับเพื่อเริ่มงาน', at: t(5 * M), link: '/chat/t-toy', read: false, avatar: 'av_toy.jpg' },
      { id: 'n2', kind: 'chat', text: 'ร้านกาแฟบ้านสวน ถามเรื่อง “ภาพบัวชมพูสีน้ำ”', at: t(18 * M), link: '/chat/t-shop', read: false, avatar: 'av_shop.jpg' },
      { id: 'n3', kind: 'order', text: 'Kenji Web ส่งงานรอบที่ 2 แล้ว · ตรวจงานภายใน 3 วัน', at: t(2 * H), link: '/chat/t-kenji', read: false, avatar: 'av_kenji.jpg' },
      { id: 'n4', kind: 'sale', text: 'ขายได้! คุณสมใจ ซื้อ “ภาพเทพธิดาชุดไทยแฟนตาซี” ฿190 · ไฟล์ส่งให้อัตโนมัติแล้ว', at: t(5 * H), link: '/chat/t-somjai', read: false, image: 'fantasy.jpg' },
      { id: 'n5', kind: 'like', text: 'Ton Data และอีก 24 คน ถูกใจโพสต์ของคุณ', at: t(8 * H), link: '/community/post/c7', read: true, avatar: 'av_ton.jpg' },
      { id: 'n6', kind: 'system', text: 'NOVA Lab ออกเวอร์ชัน v1.3 · ดูรายละเอียดการอัปเดต', at: t(1 * D), link: '/chat/t-nova', read: true, avatar: 'av_nova.jpg' },
      { id: 'n7', kind: 'community', text: 'ประกวดภาพ “ลอยกระทงแห่งแสง” เปิดรับผลงานแล้ว', at: t(2 * D), link: '/community/activities', read: true, image: 'g_anime.jpg' },
    ],
    drafts: [
      draft({ id: 'd-lotus', type: 'img', step: 3, title: 'ภาพบัวชมพูสีน้ำ ชุดที่ 2', use: 'ปกเพจสปา ร้านชา', desc: 'ภาพบัวสีน้ำโทนพาสเทล 4 ภาพ ใช้ทำปกเพจ', covers: ['g_lotus.jpg'], spec: { ...SPECS.img.defaults, files: [JSON.stringify({ name: 'lotus-set2.zip', size: '32 MB', scan: 'ok' })], count: '4 ภาพ', sellPrompt: false, model: 'Midjourney v7' }, options: [{ id: 'img', label: 'ภาพอย่างเดียว', sub: 'ไฟล์ 4K', price: 290, on: true }, { id: 'both', label: 'ภาพ + พรอมต์', sub: 'ไฟล์และสูตรครบ', price: 0, on: false }], updatedAt: t(1 * D) }),
      draft({ id: 'd-course', type: 'course', step: 1, title: 'คอร์สแต่งภาพสินค้าด้วยมือถือ', covers: ['c_course.jpg'], spec: { ...SPECS.course.defaults, lessons: ['ตอนที่ 1 · เตรียมแสง · 08:00'] }, updatedAt: t(3 * D) }),
    ],
    published: [],
    missions: [],
  }
}
