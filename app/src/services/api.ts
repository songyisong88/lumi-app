/**
 * LUMI data services. Screens call ONLY these interfaces.
 * Today: LocalApi writes the localStorage DB (services/db.ts) and simulates the other side
 * of a chat. Later: implement the same interfaces with Supabase (auth + Postgres + Storage
 * + Realtime) and a payment gateway; no screen code has to change.
 */
import type { CartItem, Comment, DB, Message, Order, Post, Purchase, Thread } from '../data/appTypes'
import { HIRE_STEPS } from '../data/appTypes'
import type { ListingDraft } from '../data/listingSpec'
import { SPECS, checkListing, on, sellTypeOf, specOf } from '../data/listingSpec'
import { ME, creatorById, productById, unregisterProduct } from '../data/sampleData'
import { creatorStats } from '../data/productExtras'
import type { Product } from '../data/types'
import { getDb, resetDb, uid, update } from './db'

export interface FollowService { toggle(creatorId: string): Promise<boolean> }
export interface CartService { add(item: Omit<CartItem, 'key'>): Promise<string>; remove(key: string): Promise<void> }
export interface CheckoutService { place(keys: string[], method: string, coupon?: string): Promise<Order> }
export interface ChatService {
  openWith(partnerId: string, productId?: string): Promise<string>
  send(threadId: string, text: string): Promise<void>
  sendCard(threadId: string, msg: Omit<Message, 'id' | 'at' | 'from'>, from?: Message['from']): Promise<void>
  sendBrief(creatorId: string, productId: string, brief: string[], pkg: string): Promise<string>
  acceptOffer(threadId: string, msgId: string): Promise<void>
  payOffer(threadId: string, msgId: string): Promise<string>
  acceptDelivery(threadId: string, msgId: string, stars: number, review: string): Promise<void>
  requestRevision(threadId: string, msgId: string, note: string): Promise<void>
  deliverToCustomer(threadId: string): Promise<void>
  markRead(threadId: string): Promise<void>
  setFlag(threadId: string, flag: 'pinned' | 'muted'): Promise<void>
}
export interface CommunityService {
  like(postId: string): Promise<void>
  save(postId: string): Promise<void>
  share(postId: string): Promise<void>
  comment(postId: string, text: string, replyTo?: string): Promise<void>
  likeComment(id: string): Promise<void>
  create(p: Omit<Post, 'id' | 'at' | 'likes' | 'comments' | 'shares' | 'authorId' | 'mine'>): Promise<string>
  join(roomId: string): Promise<boolean>
  vote(entryId: string): Promise<void>
}
export interface NotificationService { read(id: string): Promise<void>; readAll(): Promise<void> }
export interface SellService {
  saveDraft(d: ListingDraft): Promise<void>
  deleteDraft(id: string): Promise<void>
  publish(d: ListingDraft, share: boolean, notify: boolean): Promise<string>
  unpublish(productId: string): Promise<void>
}

const now = () => Date.now()
const orderNo = () => `LM-${String(20520 + Math.floor(Math.random() * 9000)).padStart(5, '0')}`
const lady = (id: string) => ['shop', 'somjai', 'pim', 'mint', 'fasai'].includes(id)
const thr = (d: DB, id: string) => d.threads.find((t) => t.id === id)!
function push(d: DB, threadId: string, m: Omit<Message, 'id' | 'at'>, at = now()) {
  ;(d.messages[threadId] ??= []).push({ ...m, id: uid('m'), at })
  const t = thr(d, threadId)
  t.updatedAt = at
  if (m.from === 'them') t.unread += 1
}
function notify(d: DB, n: Omit<DB['notifs'][number], 'id' | 'at' | 'read'>) {
  d.notifs.unshift({ ...n, id: uid('n'), at: now(), read: false })
}
function ensureThread(d: DB, partnerId: string, productId?: string): Thread {
  const found = d.threads.find((t) => t.partnerId === partnerId && (!productId || t.productId === productId))
    ?? d.threads.find((t) => t.partnerId === partnerId && !t.hire && !productId)
  if (found) return found
  const p = productId ? productById(productId) : undefined
  const t: Thread = {
    id: uid('t'), partnerId, role: 'creator', title: p?.title ?? 'แชตกับครีเอเตอร์', image: p?.image?.src ?? p?.covers?.[0], productId,
    status: 'ถามเรื่องสินค้า', tone: 'info', unread: 0, online: Math.random() > 0.4,
    quick: ['สินค้ายังมีอยู่ไหมครับ', 'ใช้กับมือถือได้ไหม', 'ลดราคาได้ไหมครับ'], updatedAt: now(),
  }
  d.threads.unshift(t)
  d.messages[t.id] = []
  if (p) push(d, t.id, { from: 'me', kind: 'product', productId: p.id })
  return t
}

// ---- simulated other side (sample only: no message leaves the device)
const REPLIES = {
  m: ['ได้เลยครับ 🙏', 'รับทราบครับ เดี๋ยวจัดให้ครับ', 'ขอบคุณครับ มีอะไรถามได้ตลอดนะครับ', 'ได้ครับ ขอเวลาสักครู่นะครับ'],
  f: ['ได้เลยค่ะ 🙏', 'รับทราบค่ะ เดี๋ยวจัดให้นะคะ', 'ขอบคุณมากค่ะ 💜', 'โอเคค่ะ ขอเวลาสักครู่นะคะ'],
}
const timers = new Set<number>()
function later(ms: number, fn: () => void) {
  const h = window.setTimeout(() => { timers.delete(h); fn() }, ms)
  timers.add(h)
}
function simulateReply(threadId: string, text?: string, then?: (d: DB) => void) {
  const t = getDb().threads.find((x) => x.id === threadId)
  if (!t) return
  const typingId = uid('typing')
  later(500, () => update((d) => { (d.messages[threadId] ??= []).push({ id: typingId, from: 'them', kind: 'typing', at: now() }) }))
  later(1700, () => update((d) => {
    d.messages[threadId] = (d.messages[threadId] ?? []).filter((m) => m.id !== typingId)
    const bank = lady(t.partnerId) ? REPLIES.f : REPLIES.m
    push(d, threadId, { from: 'them', kind: 'text', text: text ?? bank[(d.messages[threadId]?.length ?? 0) % bank.length] })
    then?.(d)
  }))
}

class LocalFollows implements FollowService {
  async toggle(id: string) {
    let onNow = false
    update((d) => {
      onNow = !d.follows.includes(id)
      d.follows = onNow ? [id, ...d.follows] : d.follows.filter((x) => x !== id)
    })
    return onNow
  }
}

class LocalCart implements CartService {
  async add(item: Omit<CartItem, 'key'>) {
    const key = uid('ci')
    update((d) => {
      // same product + same option replaces (digital goods: qty is always 1)
      // a new direct checkout replaces any abandoned one
      if (item.direct) d.cart = d.cart.filter((c) => !c.direct)
      else d.cart = d.cart.filter((c) => c.direct || !(c.productId === item.productId && c.optionId === item.optionId))
      d.cart.push({ ...item, key })
    })
    return key
  }
  async remove(key: string) { update((d) => { d.cart = d.cart.filter((c) => c.key !== key) }) }
}

export const COUPONS: Record<string, { label: string; pct: number; creator?: string }> = {
  PIM15: { label: 'ลด 15% สินค้าร้านพิมพ์ดาว', pct: 15, creator: 'pim' },
  LUMI10: { label: 'ลด 10% ทุกชิ้น (ทดลอง)', pct: 10 },
}
export function discountOf(items: CartItem[], code?: string) {
  const c = code ? COUPONS[code.toUpperCase()] : undefined
  if (!c) return 0
  return Math.round(items.filter((i) => !c.creator || (i.creatorId ?? productById(i.productId)?.creatorId) === c.creator).reduce((a, i) => a + i.price, 0) * c.pct / 100)
}

class LocalCheckout implements CheckoutService {
  async place(keys: string[], method: string, coupon?: string) {
    await new Promise((r) => setTimeout(r, 1100)) // feels like a gateway round-trip (DEMO, nothing is charged)
    let order!: Order
    const sims: string[] = []
    update((d) => {
      const items = d.cart.filter((c) => keys.includes(c.key))
      const discount = discountOf(items, coupon)
      order = { id: uid('o'), no: orderNo(), items, total: items.reduce((a, i) => a + i.price, 0) - discount, discount, at: now(), method }
      d.orders.unshift(order)
      d.cart = d.cart.filter((c) => !keys.includes(c.key))
      for (const it of items) {
        if (it.offerThreadId) {
          const t = thr(d, it.offerThreadId)
          t.step = 3; t.status = 'กำลังทำงาน'; t.tone = 'info'; t.orderNo ??= order.no
          push(d, t.id, { from: 'system', kind: 'system', text: `ชำระเงิน ฿${it.price.toLocaleString('th-TH')} แล้ว (ทดลอง) · LUMI พักเงินไว้จนกว่าคุณจะกดรับงาน` })
          sims.push(t.id)
          continue
        }
        if (it.productId === 'tip') {
          const t = ensureThread(d, it.creatorId!)
          push(d, t.id, { from: 'me', kind: 'tip', amount: it.price, text: 'ให้ทิปขอบคุณ' })
          simulateReply(t.id, lady(t.partnerId) ? 'ขอบคุณสำหรับทิปมาก ๆ เลยค่ะ 💜' : 'ขอบคุณสำหรับทิปมากครับ 🙏')
          continue
        }
        const p = productById(it.productId)
        if (!p) continue
        const t = ensureThread(d, p.creatorId, p.id)
        const st = SPECS[sellTypeOfSafe(p)]
        const sp = specOf(p)
        const key = ['sw', 'game'].includes(st.key) && sp.keyType !== 'ไม่ต้องใช้คีย์' ? `LUMI-${rnd()}-${rnd()}-${rnd()}` : undefined
        t.orderNo = order.no; t.amount = it.price; t.status = 'ซื้อแล้ว · ดาวน์โหลดได้'; t.tone = 'ok'
        push(d, t.id, { from: 'system', kind: 'system', text: `ชำระเงิน ฿${it.price.toLocaleString('th-TH')} แล้ว (ทดลอง) · ออเดอร์ #${order.no}` })
        if (key) push(d, t.id, { from: 'them', kind: 'key', title: `คีย์ใช้งาน · ${it.optionLabel ?? '1 เครื่อง'}`, code: key })
        const files = (Array.isArray(sp.files) ? sp.files : []).map((x) => { try { return JSON.parse(String(x)) } catch { return { name: String(x), size: '' } } })
        for (const f of files) push(d, t.id, { from: 'them', kind: 'file', fileName: f.name, size: f.size })
        if (on(sp.sellPrompt) && it.optionId !== 'img') push(d, t.id, { from: 'them', kind: 'key', title: 'พรอมต์ฉบับเต็ม', code: String(sp.prompt ?? '') })
        if (typeof sp.canvaLink === 'string') push(d, t.id, { from: 'them', kind: 'file', fileName: sp.canvaLink, size: 'ลิงก์ Canva' })
        d.purchases.unshift({ id: uid('b'), productId: p.id, orderNo: order.no, optionLabel: it.optionLabel, at: now(), title: p.title, image: p.image?.src ?? p.covers?.[0], creatorId: p.creatorId, price: it.price, key, threadId: t.id } satisfies Purchase)
      }
      notify(d, { kind: 'order', text: `ชำระเงินสำเร็จ (ทดลอง) ออเดอร์ #${order.no} · ไฟล์และคีย์อยู่ในแชตแล้ว`, link: '/profile?tab=bought', image: undefined })
    })
    for (const id of sims) simulateHireProgress(id)
    return order
  }
}
const rnd = () => Math.random().toString(36).slice(2, 6).toUpperCase()
const sellTypeOfSafe = (p: Product) => sellTypeOf(p)

function simulateHireProgress(threadId: string) {
  simulateReply(threadId, 'ได้รับเงินผ่าน LUMI แล้วครับ เริ่มงานเลยนะครับ 💪', () => {})
  later(6000, () => update((d) => {
    push(d, threadId, { from: 'them', kind: 'progress', title: 'อัปเดตความคืบหน้า', text: 'ร่างลายเส้นเสร็จแล้ว กำลังลงสีครับ', pct: 45, image: 'mascot.jpg' })
  }))
  later(12000, () => update((d) => {
    const t = thr(d, threadId)
    t.step = 4; t.status = 'ส่งงานแล้ว รอคุณตรวจ'; t.tone = 'warn'
    t.quick = ['สวยมากครับ ขอตรวจแป๊บนึง', 'ขอไฟล์ต้นฉบับด้วยนะครับ']
    push(d, threadId, { from: 'them', kind: 'delivery', title: 'ส่งงานแล้ว · รอบที่ 1', image: t.image ?? 'mascot.jpg', round: 1, left: 3, status: 'pending', text: 'ลงสีเสร็จแล้วครับ ลองดูได้เลยครับ 🙏 (ภาพมีลายน้ำจนกว่าจะกดรับงาน)' })
    notify(d, { kind: 'order', text: `${creatorById(t.partnerId).name} ส่งงานแล้ว · ตรวจและกดรับงาน`, link: `/chat/${threadId}`, avatar: creatorById(t.partnerId).avatar })
  }))
}

class LocalChat implements ChatService {
  async openWith(partnerId: string, productId?: string) {
    let id = ''
    update((d) => { id = ensureThread(d, partnerId, productId).id })
    return id
  }
  async send(threadId: string, text: string) {
    update((d) => push(d, threadId, { from: 'me', kind: 'text', text }))
    simulateReply(threadId)
  }
  async sendCard(threadId: string, msg: Omit<Message, 'id' | 'at' | 'from'>, from: Message['from'] = 'me') {
    update((d) => push(d, threadId, { ...msg, from }))
    if (from === 'me' && msg.kind === 'offer') {
      // customer side (sample): accepts after a moment
      later(2600, () => update((d) => {
        const m = d.messages[threadId]?.find((x) => x.kind === 'offer' && x.status === 'pending' && x.from === 'me')
        if (m) m.status = 'accepted'
        const t = thr(d, threadId)
        t.status = 'ลูกค้ารับข้อเสนอแล้ว · รอชำระ'; t.tone = 'info'
        push(d, threadId, { from: 'them', kind: 'text', text: 'รับข้อเสนอแล้วค่ะ เดี๋ยวชำระเงินนะคะ 🙏' })
      }))
    } else if (from === 'me' && msg.kind !== 'product') simulateReply(threadId)
  }
  async sendBrief(creatorId: string, productId: string, brief: string[], pkg: string) {
    let id = ''
    update((d) => {
      const p = productById(productId)
      const t: Thread = {
        id: uid('t'), partnerId: creatorId, role: 'creator', title: p?.title ?? 'งานจ้าง', image: p?.image?.src ?? p?.covers?.[0], productId, hire: true, step: 0,
        status: 'ส่งบรีฟแล้ว รอใบเสนอราคา', tone: 'info', unread: 0, online: true, quick: ['ส่งรูปอ้างอิงเพิ่มได้ไหม', 'ส่งงานได้ภายในกี่วัน'], updatedAt: now(),
      }
      d.threads.unshift(t)
      d.messages[t.id] = []
      push(d, t.id, { from: 'me', kind: 'brief', title: `คำขอจ้างงาน (บรีฟ) · ${pkg}`, items: brief, image: p?.image?.src })
      id = t.id
    })
    const p = productById(productId)
    const price = p?.price ?? 600
    const amount = pkg.includes('พรีเมียม') ? price * 4 : pkg.includes('มาตรฐาน') ? price * 2 : price
    simulateReply(id, 'ได้รับบรีฟแล้ว ขอทำใบเสนอราคาให้นะครับ', (d) => {
      push(d, id, { from: 'them', kind: 'offer', title: `ใบเสนอราคา · ${pkg}`, amount, items: (() => { const v = p ? specOf(p).deliverables : undefined; return Array.isArray(v) ? v : ['งานตามบรีฟ', 'ไฟล์ความละเอียดสูง'] })(), status: 'pending' })
      const t = thr(d, id); t.step = 1; t.status = 'รอคุณตอบรับข้อเสนอ'; t.tone = 'warn'; t.amount = amount
      t.quick = ['รับข้อเสนอเลยครับ', 'ขอลดราคาได้ไหม', 'ส่งงานได้วันไหนครับ']
    })
    return id
  }
  async acceptOffer(threadId: string, msgId: string) {
    update((d) => {
      const m = d.messages[threadId].find((x) => x.id === msgId)!
      m.status = 'accepted'
      const t = thr(d, threadId)
      t.step = 2; t.status = 'รับข้อเสนอแล้ว · รอชำระเงิน'; t.tone = 'info'; t.amount = m.amount
      t.orderNo ??= orderNo()
      t.quick = ['ส่งงานได้วันไหนครับ', 'ขอดูภาพร่างก่อนได้ไหมครับ']
      push(d, threadId, { from: 'system', kind: 'system', text: `คุณรับข้อเสนอ ฿${m.amount?.toLocaleString('th-TH')} แล้ว · ชำระเงินเพื่อเริ่มงาน` })
    })
  }
  async payOffer(threadId: string, msgId: string) {
    const d = getDb()
    const t = d.threads.find((x) => x.id === threadId)!
    const m = d.messages[threadId].find((x) => x.id === msgId)!
    const ex = d.cart.find((c) => c.offerMsgId === msgId)
    if (ex) return ex.key
    return cart.add({ productId: t.productId ?? 'offer', price: m.amount ?? 0, title: `${t.title} (งานจ้าง)`, optionLabel: m.title, image: t.image, creatorId: t.partnerId, offerThreadId: threadId, offerMsgId: msgId, direct: true })
  }
  async acceptDelivery(threadId: string, msgId: string, stars: number, review: string) {
    update((d) => {
      const m = d.messages[threadId].find((x) => x.id === msgId)!
      m.status = 'accepted'
      const t = thr(d, threadId)
      t.step = 5; t.status = 'เสร็จสมบูรณ์'; t.tone = 'done'
      t.quick = ['ขอบคุณมากครับ', 'ไว้มีงานใหม่จะจ้างอีกนะครับ']
      push(d, threadId, { from: 'system', kind: 'system', text: `คุณรับงานแล้ว · รีวิว ${'★'.repeat(stars)}${review ? ` “${review}”` : ''} · LUMI โอนเงินให้ครีเอเตอร์ (ทดลอง)` })
      push(d, threadId, { from: 'them', kind: 'file', fileName: `${t.title.slice(0, 18)}-final.zip`, size: '24 MB' })
      d.purchases.unshift({ id: uid('b'), productId: t.productId ?? 'offer', orderNo: t.orderNo ?? '-', optionLabel: 'งานจ้าง', at: now(), title: t.title, image: t.image, creatorId: t.partnerId, price: t.amount ?? 0, threadId })
    })
    simulateReply(threadId, 'ขอบคุณสำหรับรีวิวมากครับ ไว้มีงานใหม่ทักมาได้เลยนะครับ 🙏')
  }
  async requestRevision(threadId: string, msgId: string, note: string) {
    update((d) => {
      const m = d.messages[threadId].find((x) => x.id === msgId)!
      m.status = 'revise'
      const t = thr(d, threadId); t.step = 3; t.status = 'ขอแก้ไขแล้ว · กำลังแก้'; t.tone = 'info'
      t.quick = ['ส่งรอบใหม่ได้วันไหนครับ', 'ขอบคุณครับ']
      push(d, threadId, { from: 'me', kind: 'text', text: `ขอแก้ไข: ${note}` })
    })
    simulateReply(threadId, 'รับทราบครับ กำลังแก้ให้เลยครับ')
    // sample: the creator sends the revised round a little later
    later(9000, () => update((d) => {
      const prev = d.messages[threadId]?.find((x) => x.id === msgId)
      const t = thr(d, threadId)
      if (!prev || (t.step ?? 0) >= 5) return
      const round = (prev.round ?? 1) + 1
      const left = Math.max(0, (prev.left ?? 1) - 1)
      t.step = 4; t.status = `ส่งงานแล้ว (รอบที่ ${round}) รอคุณตรวจ`; t.tone = 'warn'
      t.quick = ['สวยมากครับ ขอตรวจแป๊บนึง', 'ขอไฟล์ต้นฉบับด้วยนะครับ']
      push(d, threadId, { from: 'them', kind: 'delivery', title: `ส่งงานแล้ว · รอบที่ ${round}`, image: prev.image ?? t.image ?? 'mascot.jpg', round, left, status: 'pending', text: `แก้ตามที่ขอแล้วครับ (${note.slice(0, 40)}) ลองดูอีกครั้งนะครับ 🙏` })
      notify(d, { kind: 'order', text: `${creatorById(t.partnerId).name} ส่งงานรอบที่ ${round} แล้ว · ตรวจและกดรับงาน`, link: `/chat/${threadId}`, avatar: creatorById(t.partnerId).avatar })
    }))
  }
  async deliverToCustomer(threadId: string) {
    update((d) => {
      const t = thr(d, threadId)
      const p = t.productId ? productById(t.productId) : undefined
      push(d, threadId, { from: 'me', kind: 'file', fileName: `${p?.id ?? 'work'}-4k.png`, size: '8.4 MB' })
      t.status = 'ส่งไฟล์แล้ว'; t.tone = 'done'
    })
    simulateReply(threadId, 'ได้รับไฟล์แล้วค่ะ สวยมากเลย ขอบคุณค่ะ 💜')
  }
  async markRead(threadId: string) {
    if (!getDb().threads.find((t) => t.id === threadId)?.unread) return
    update((d) => { thr(d, threadId).unread = 0 })
  }
  async setFlag(threadId: string, flag: 'pinned' | 'muted') { update((d) => { const t = thr(d, threadId); t[flag] = !t[flag] }) }
}

class LocalCommunity implements CommunityService {
  async like(id: string) {
    update((d) => {
      const p = d.posts.find((x) => x.id === id)!
      const was = d.liked.includes(id)
      d.liked = was ? d.liked.filter((x) => x !== id) : [...d.liked, id]
      p.likes += was ? -1 : 1
    })
  }
  async share(id: string) { update((d) => { const x = d.posts.find((y) => y.id === id); if (x) x.shares += 1 }) }
  async save(id: string) { update((d) => { d.saved = d.saved.includes(id) ? d.saved.filter((x) => x !== id) : [id, ...d.saved] }) }
  async comment(postId: string, text: string, replyTo?: string) {
    update((d) => {
      const c: Comment = { id: uid('k'), postId, authorId: ME, text, at: now(), likes: 0, replyTo }
      d.comments.push(c)
      d.posts.find((x) => x.id === postId)!.comments += 1
    })
  }
  async likeComment(id: string) {
    update((d) => {
      const c = d.comments.find((x) => x.id === id)!
      const was = d.likedComments.includes(id)
      d.likedComments = was ? d.likedComments.filter((x) => x !== id) : [...d.likedComments, id]
      c.likes += was ? -1 : 1
    })
  }
  async create(p: Omit<Post, 'id' | 'at' | 'likes' | 'comments' | 'shares' | 'authorId' | 'mine'>) {
    const id = uid('u')
    update((d) => { d.posts.unshift({ ...p, id, at: now(), likes: 0, comments: 0, shares: 0, authorId: ME, mine: true }) })
    later(5000, () => update((d) => {
      const post = d.posts.find((x) => x.id === id)
      if (!post) return
      post.likes += 3
      notify(d, { kind: 'like', text: 'NOVA Lab และอีก 2 คน ถูกใจโพสต์ใหม่ของคุณ', link: `/community/post/${id}`, avatar: 'av_nova.jpg' })
    }))
    return id
  }
  async join(roomId: string) {
    let joined = false
    update((d) => {
      joined = !d.joined.includes(roomId)
      d.joined = joined ? [...d.joined, roomId] : d.joined.filter((x) => x !== roomId)
    })
    return joined
  }
  async vote(id: string) { update((d) => { d.votes = d.votes.includes(id) ? d.votes.filter((x) => x !== id) : [...d.votes, id] }) }
}

class LocalNotifs implements NotificationService {
  async read(id: string) { update((d) => { const n = d.notifs.find((x) => x.id === id); if (n) n.read = true }) }
  async readAll() { update((d) => { d.notifs.forEach((n) => { n.read = true }) }) }
}

const TYPE_MAP: Record<string, Pick<Product, 'kind' | 'type'> & { label: string }> = {
  img: { kind: 'image', type: 'img', label: 'ภาพ + พรอมต์' },
  tpl: { kind: 'image', type: 'tpl', label: 'เทมเพลต' },
  sw: { kind: 'image', type: 'tool', label: 'โปรแกรม' },
  game: { kind: 'image', type: 'tool', label: 'เกม' },
  bot: { kind: 'image', type: 'bot', label: 'บอท' },
  course: { kind: 'course', type: 'course', label: 'คอร์สออนไลน์' },
  font: { kind: 'image', type: 'tpl', label: 'ฟอนต์' },
  hire: { kind: 'commission', type: 'svc', label: 'งานจ้าง' },
  media: { kind: 'image', type: 'media', label: 'วิดีโอ เสียง เพลง' },
  skill: { kind: 'image', type: 'skill', label: 'Agent Skills' },
  data: { kind: 'image', type: 'data', label: 'ชุดข้อมูล' },
}

/** Turn a wizard draft into a Product (also used for the live preview). */
export function draftToProduct(dr: ListingDraft, id = dr.publishedId ?? `u-${dr.id}`): Product {
  const t = dr.type ?? 'img'
  const m = TYPE_MAP[t]
  const opts = dr.options.filter((o) => o.on && o.price > 0)
  const price = dr.free ? 0 : opts.length ? Math.min(...opts.map((o) => o.price)) : 0
  const sub = typeof dr.spec.sub === 'string' ? dr.spec.sub : undefined
  const cover = dr.covers[0] ?? 'g_lotus.jpg'
  const days = typeof dr.spec.timeline === 'string' ? parseInt(dr.spec.timeline.split('–')[1] ?? '7') : undefined
  return {
    id, kind: m.kind, type: m.type, label: sub && t !== 'hire' ? sub : m.label, st: t,
    title: dr.title || 'ผลงานใหม่ (ยังไม่ตั้งชื่อ)', use: dr.use || '—', desc: dr.desc, tags: dr.tags,
    creatorId: ME, price, image: { src: cover, w: 900, h: 1100 }, covers: dr.covers, spec: dr.spec,
    options: dr.free ? undefined : opts.map(({ id, label, sub, price, suffix }) => ({ id, label, sub, price, suffix })),
    hasPrompt: on(dr.spec.sellPrompt), tryable: on(dr.spec.trial), instant: t !== 'hire',
    days, revisions: typeof dr.spec.revisions === 'string' ? parseInt(dr.spec.revisions) : undefined,
    mine: true, createdAt: now(),
  }
}

class LocalSell implements SellService {
  async saveDraft(dr: ListingDraft) {
    update((d) => {
      const i = d.drafts.findIndex((x) => x.id === dr.id)
      const v = { ...dr, updatedAt: now() }
      if (i >= 0) d.drafts[i] = v
      else d.drafts.unshift(v)
    })
  }
  async deleteDraft(id: string) { update((d) => { d.drafts = d.drafts.filter((x) => x.id !== id) }) }
  async publish(dr: ListingDraft, share: boolean, notifyFollowers: boolean) {
    if (checkListing(dr).some((c) => !c.ok)) throw new Error('listing incomplete')
    const p = draftToProduct(dr)
    update((d) => {
      d.published = [p, ...d.published.filter((x) => x.id !== p.id)]
      d.drafts = d.drafts.filter((x) => x.id !== dr.id)
      if (share) d.posts.unshift({ id: uid('u'), authorId: ME, at: now(), tag: p.price === 0 ? 'แจกฟรี' : 'โชว์ผลงาน', text: `ลงผลงานใหม่ “${p.title}” 🎉 ${p.use}`, images: dr.covers.slice(0, 3), productIds: [p.id], likes: 0, comments: 0, shares: 0, mine: true })
      notify(d, { kind: 'system', text: `ลงขาย “${p.title}” แล้ว${notifyFollowers ? ` · แจ้งผู้ติดตาม ${creatorStats(ME).followersLabel} คน (ทดลอง)` : ''}`, link: `/product/${p.id}`, image: dr.covers[0] })
    })
    return p.id
  }
  async unpublish(productId: string) {
    unregisterProduct(productId)
    update((d) => { d.published = d.published.filter((x) => x.id !== productId) })
  }
}

export const follows: FollowService = new LocalFollows()
export const cart: CartService = new LocalCart()
export const checkout: CheckoutService = new LocalCheckout()
export const chat: ChatService = new LocalChat()
export const community: CommunityService = new LocalCommunity()
export const notifications: NotificationService = new LocalNotifs()
export const sell: SellService = new LocalSell()
export function resetAll() {
  timers.forEach((h) => clearTimeout(h))
  timers.clear()
  resetDb()
}
export { HIRE_STEPS }
