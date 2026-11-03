/**
 * LUMI data services. Screens call ONLY these interfaces.
 * Today: LocalApi writes the localStorage DB (services/db.ts) and simulates the other side
 * of a chat. Later: implement the same interfaces with Supabase (auth + Postgres + Storage
 * + Realtime) and a payment gateway; no screen code has to change.
 */
import type { CartItem, Comment, DB, Mention, Message, Order, Post, Purchase, ReactKind, StoryActivity, StoryLinkLabel, StoryOverlay, Thread, UserStory } from '../data/appTypes'
import { HIRE_STEPS } from '../data/appTypes'
import type { ListingDraft } from '../data/listingSpec'
import { SPECS, checkListing, on, sellTypeOf, specOf } from '../data/listingSpec'
import { CREATORS, ME, creatorById, isRemoteId, productById, unregisterProduct } from '../data/sampleData'
import { ROOMS } from '../data/appSeed'
import { creatorStats } from '../data/productExtras'
import type { Product } from '../data/types'
import { getDb, resetDb, uid, update } from './db'
import { FEATURES, BRAND } from '../config'
import { assetsFor } from '../data/library'
import * as K from './cloudApi'
import { CloudError, cleanupPreviews, cloudOn, deleteServerDraft, previewPathsOf, publishListing, unpublishListing } from './cloud'
import { getSession } from './session'

export interface FollowService { toggle(creatorId: string): Promise<boolean> }
export interface CartService { add(item: Omit<CartItem, 'key'>): Promise<string>; remove(key: string): Promise<void> }
export interface CheckoutService { place(keys: string[], method: string, coupon?: string): Promise<Order> }
export interface ChatService {
  openWith(partnerId: string, productId?: string): Promise<string>
  send(threadId: string, text: string): Promise<void>
  sendCard(threadId: string, msg: Omit<Message, 'id' | 'at' | 'from'>, from?: Message['from']): Promise<void>
  sendBrief(creatorId: string, productId: string, brief: string[], pkg: string, amount?: number): Promise<string>
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
  comment(postId: string, text: string, replyTo?: string, mentions?: Mention[]): Promise<void>
  likeComment(id: string): Promise<void>
  /** Set / change / remove (null) my reaction. */
  react(postId: string, kind: ReactKind | null): Promise<void>
  reactComment(id: string, kind: ReactKind | null): Promise<void>
  create(p: Omit<Post, 'id' | 'at' | 'likes' | 'comments' | 'shares' | 'authorId' | 'mine'>): Promise<string>
  join(roomId: string): Promise<boolean>
  vote(entryId: string): Promise<void>
}
export interface OrderService {
  /** Report a problem / ask for a refund on a purchase or a hire thread. */
  reportIssue(target: { purchaseId?: string; threadId?: string }, reason: string, note: string): Promise<void>
  /** Write or edit the buyer's review of a purchase. */
  review(purchaseId: string, stars: number, text: string): Promise<void>
  /** Hire delivery: buyer asks for 3 more days to check the work (once per round). */
  extendReview(threadId: string, msgId: string): Promise<void>
}
export interface NotificationService { read(id: string): Promise<void>; readAll(): Promise<void> }
export interface SellService {
  saveDraft(d: ListingDraft): Promise<void>
  deleteDraft(id: string): Promise<void>
  publish(d: ListingDraft, share: boolean, notify: boolean): Promise<string>
  unpublish(productId: string): Promise<void>
  /** DEMO: stands in for the LUMI review team. pass=false needs a reason. */
  review(productId: string, pass: boolean, reason?: string): Promise<void>
}

/** Listing review (A2): new listings wait for the LUMI team. In this demo they pass by themselves after REVIEW_MS. */
export const REVIEW_MS = 20000
export const REVIEW_REASONS = [
  'ภาพตัวอย่างไม่ตรงกับไฟล์ที่ผู้ซื้อจะได้รับ',
  'มีโลโก้หรือตัวละครของแบรนด์อื่น อาจละเมิดลิขสิทธิ์',
  'ข้อมูลสิทธิ์ใช้งานหรือวิธีใช้ยังไม่ชัด',
  'ไฟล์ไม่ผ่านการสแกนความปลอดภัย',
]

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
    status: 'ถามเรื่องผลงาน', tone: 'info', unread: 0, online: Math.random() > 0.4,
    quick: ['ผลงานนี้ยังขายอยู่ไหมครับ', 'ใช้กับมือถือได้ไหม', 'ลดราคาได้ไหมครับ'], updatedAt: now(),
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
  PIM15: { label: 'ลด 15% ผลงานร้านพิมพ์ดาว', pct: 15, creator: 'pim' },
  ...(FEATURES.platformCoupons ? { LUMI10: { label: 'ลด 10% ทุกชิ้น (ทดลอง)', pct: 10 } } : {}),
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
    const bought: string[] = []
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
          push(d, t.id, { from: 'system', kind: 'system', text: `ชำระเงิน ฿${it.price.toLocaleString('th-TH')} แล้ว (ทดลอง) · เงินโอนให้ครีเอเตอร์เมื่อคุณกดรับงาน หรือครบ 3 วันหลังส่งงาน` })
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
        t.orderNo = order.no; t.amount = it.price; t.status = 'ซื้อแล้ว · อยู่ในคลังของที่ซื้อ'; t.tone = 'ok'
        const bid = uid('b')
        const assets = assetsFor(p, it, key)
        push(d, t.id, { from: 'system', kind: 'system', text: `${it.price ? `ชำระเงิน ฿${it.price.toLocaleString('th-TH')} แล้ว (ทดลอง)` : 'รับของฟรีแล้ว'} · ออเดอร์ #${order.no} · ${assetSummary(assets)} อยู่ในคลังของที่ซื้อ`, link: `/library/${bid}`, linkLabel: 'เปิดคลังของที่ซื้อ' })
        d.purchases.unshift({ id: bid, productId: p.id, orderNo: order.no, optionLabel: it.optionLabel, at: now(), title: p.title, image: p.image?.src ?? p.covers?.[0], creatorId: p.creatorId, price: it.price, key, threadId: t.id, assets } satisfies Purchase)
        bought.push(bid)
      }
      notify(d, { kind: 'order', text: order.total > 0 ? `ชำระเงินสำเร็จ (ทดลอง) ออเดอร์ #${order.no} · ไฟล์และคีย์อยู่ในคลังของที่ซื้อ` : `รับของฟรีแล้ว ออเดอร์ #${order.no} · ไฟล์อยู่ในคลังของที่ซื้อ`, link: bought.length === 1 ? `/library/${bought[0]}` : '/library', image: undefined })
    })
    for (const id of sims) simulateHireProgress(id)
    return order
  }
}
const assetSummary = (a: { kind: string }[]) => {
  const f = a.filter((x) => x.kind === 'file').length, k = a.filter((x) => x.kind === 'key').length, o = a.length - f - k
  return [f && `ไฟล์ ${f} รายการ`, k && 'คีย์', o && 'ลิงก์/พรอมต์'].filter(Boolean).join(' ')
}
const rnd = () => Math.random().toString(36).slice(2, 6).toUpperCase()
const sellTypeOfSafe = (p: Product) => sellTypeOf(p)

function simulateHireProgress(threadId: string, free = false) {
  simulateReply(threadId, free ? 'ขอบคุณที่ไว้ใจครับ เริ่มงานเลยนะครับ 💪' : 'ได้รับแจ้งการชำระเงินแล้วครับ เริ่มงานเลยนะครับ 💪', () => {})
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
  async sendBrief(creatorId: string, productId: string, brief: string[], pkg: string, pkgPrice?: number) {
    let id = ''
    update((d) => {
      const p = productById(productId)
      const t: Thread = {
        id: uid('t'), partnerId: creatorId, role: 'creator', title: p?.title ?? 'งานจ้าง', image: p?.image?.src ?? p?.covers?.[0], productId, hire: true, step: 0,
        status: 'ส่งบรีฟแล้ว รอใบเสนอราคา', tone: 'info', unread: 0, online: true, quick: ['ส่งรูปอ้างอิงเพิ่มได้ไหม', 'ส่งงานได้ภายในกี่วัน'], updatedAt: now(),
      }
      d.threads.unshift(t)
      d.messages[t.id] = []
      push(d, t.id, { from: 'me', kind: 'brief', title: `บรีฟงานจ้าง · ${pkg}`, items: brief, image: p?.image?.src })
      id = t.id
    })
    const p = productById(productId)
    const price = p?.price ?? 600
    // the quote starts at the package price the buyer picked on the product page
    const amount = pkgPrice ?? (pkg.includes('พรีเมียม') ? price * 4 : pkg.includes('มาตรฐาน') ? price * 2 : price)
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
      t.amount = m.amount
      t.orderNo ??= orderNo()
      t.quick = ['ส่งงานได้วันไหนครับ', 'ขอดูภาพร่างก่อนได้ไหมครับ']
      if (!m.amount) {
        t.step = 3; t.status = 'กำลังทำงาน (งานฟรี)'; t.tone = 'info'
        push(d, threadId, { from: 'system', kind: 'system', text: 'คุณรับข้อเสนอแล้ว · งานนี้ฟรี ไม่ต้องชำระเงิน ครีเอเตอร์เริ่มงานได้เลย' })
      } else {
        t.step = 2; t.status = 'รับข้อเสนอแล้ว · รอชำระเงิน'; t.tone = 'info'
        push(d, threadId, { from: 'system', kind: 'system', text: `คุณรับข้อเสนอ ฿${m.amount.toLocaleString('th-TH')} แล้ว · ชำระเงินเพื่อเริ่มงาน` })
      }
    })
    if (!getDb().messages[threadId].find((x) => x.id === msgId)?.amount) simulateHireProgress(threadId, true)
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
      push(d, threadId, { from: 'system', kind: 'system', text: `คุณรับงานแล้ว · รีวิว ${'★'.repeat(stars)}${review ? ` “${review}”` : ''} · ${t.amount ? 'เงินโอนให้ครีเอเตอร์ (ทดลอง)' : 'งานฟรี · ให้ทิปขอบคุณครีเอเตอร์ได้'}` })
      const bid = uid('b'), zip = `${t.title.slice(0, 18)}-final.zip`
      push(d, threadId, { from: 'system', kind: 'system', text: `ไฟล์งานฉบับสมบูรณ์ (${zip}) อยู่ในคลังของที่ซื้อ`, link: `/library/${bid}`, linkLabel: 'เปิดคลังของที่ซื้อ' })
      d.purchases.unshift({ id: bid, productId: t.productId ?? 'offer', orderNo: t.orderNo ?? '-', optionLabel: 'งานจ้าง', at: now(), title: t.title, image: t.image, creatorId: t.partnerId, price: t.amount ?? 0, threadId, review: { stars, text: review, at: now() }, assets: [{ kind: 'file', title: zip, value: zip, size: '24 MB' }] })
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
  async like(id: string) { await this.react(id, myReaction(getDb(), id) ? null : 'like') }
  async react(id: string, kind: ReactKind | null) {
    const prev = myReaction(getDb(), id)
    if ((prev ?? null) === kind) return
    update((d) => K.applyReaction(d, true, id, prev, kind))
  }
  async reactComment(id: string, kind: ReactKind | null) {
    const prev = myCommentReaction(getDb(), id)
    if ((prev ?? null) === kind) return
    update((d) => K.applyReaction(d, false, id, prev, kind))
  }
  async share(id: string) { update((d) => { const x = d.posts.find((y) => y.id === id); if (x) x.shares += 1 }) }
  async save(id: string) { update((d) => { d.saved = d.saved.includes(id) ? d.saved.filter((x) => x !== id) : [id, ...d.saved] }) }
  async comment(postId: string, text: string, replyTo?: string, mentions?: Mention[]) {
    update((d) => {
      const tags = (mentions ?? []).filter((m) => m.id !== ME && text.includes('@' + m.name))
      const c: Comment = { id: uid('k'), postId, authorId: ME, text, at: now(), likes: 0, replyTo, mentions: tags.length ? tags : undefined }
      d.comments.push(c)
      d.posts.find((x) => x.id === postId)!.comments += 1
    })
  }
  async likeComment(id: string) { await this.reactComment(id, myCommentReaction(getDb(), id) ? null : 'like') }
  async create(p: Omit<Post, 'id' | 'at' | 'likes' | 'comments' | 'shares' | 'authorId' | 'mine'>) {
    const id = uid('u')
    const mentions = (p.mentions ?? []).filter((m) => m.id !== ME && p.text.includes('@' + m.name))
    update((d) => { d.posts.unshift({ ...p, mentions: mentions.length ? mentions : undefined, id, at: now(), likes: 0, comments: 0, shares: 0, authorId: ME, mine: true }) })
    later(5000, () => update((d) => {
      const post = d.posts.find((x) => x.id === id)
      if (!post) return
      post.likes += 3; post.rx = { ...(post.rx ?? {}), like: (post.rx?.like ?? 0) + 2, love: (post.rx?.love ?? 0) + 1 }
      notify(d, { kind: 'like', sub: 'reaction', badge: '❤️', actor: 'NOVA Lab', text: 'NOVA Lab และอีก 2 คน แสดงความรู้สึกต่อโพสต์ใหม่ของคุณ', link: `/community/post/${id}`, avatar: 'av_nova.jpg' })
    }))
    return id
  }
  async join(roomId: string) {
    let joined = false
    update((d) => {
      const invited = (d.invites ?? []).some((x) => x.roomId === roomId)
      d.invites = (d.invites ?? []).filter((x) => x.roomId !== roomId)
      joined = invited || !d.joined.includes(roomId)
      d.joined = joined ? [...new Set([...d.joined, roomId])] : d.joined.filter((x) => x !== roomId)
    })
    return joined
  }
  async vote(id: string) { update((d) => { d.votes = d.votes.includes(id) ? d.votes.filter((x) => x !== id) : [...d.votes, id] }) }
}

export const myReaction = (d: DB, id: string): ReactKind | undefined => d.reactions?.[id] ?? (d.liked.includes(id) ? 'like' : undefined)
export const myCommentReaction = (d: DB, id: string): ReactKind | undefined => d.commentReactions?.[id] ?? (d.likedComments.includes(id) ? 'like' : undefined)

function localCandidates(q: string, postId?: string, roomId?: string) {
  const d = getDb(), query = q.trim().toLowerCase()
  const post = postId ? d.posts.find((p) => p.id === postId) : undefined
  const inPost = new Set(post ? [post.authorId, ...d.comments.filter((c) => c.postId === postId).map((c) => c.authorId)] : [])
  const onMine = new Set(d.comments.filter((c) => d.posts.some((p) => p.id === c.postId && p.authorId === ME)).map((c) => c.authorId))
  const room = roomId ? ROOMS.find((r) => r.id === roomId) : undefined
  const inRoom = new Set(roomId ? d.posts.filter((p) => p.roomId === roomId).map((p) => p.authorId) : [])
  const people = CREATORS.filter((c) => c.id !== ME)
  return people.map((c) => {
    const reason = d.follows.includes(c.id) ? 'คุณติดตาม' : inPost.has(c.id) ? 'อยู่ในโพสต์นี้' : onMine.has(c.id) ? 'เคยคอมเมนต์โพสต์ของคุณ' : room && inRoom.has(c.id) ? `อยู่ในกลุ่ม ${room.name}` : ''
    const rank = reason === 'คุณติดตาม' ? 0 : reason === 'อยู่ในโพสต์นี้' ? 1 : reason ? 2 : 3
    return { id: c.id, reason, rank, name: c.name.toLowerCase() }
  }).filter((x) => (query ? x.name.includes(query) || x.id.includes(query) : x.rank < 3))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).slice(0, 8).map(({ id, reason }) => ({ id, reason }))
}

export const ISSUE_STATUS = `รอครีเอเตอร์ตอบภายใน 3 วัน · ถ้าไม่ตอบหรือตกลงกันไม่ได้ ทีม ${BRAND} จะตัดสิน`
class LocalOrders implements OrderService {
  async reportIssue(target: { purchaseId?: string; threadId?: string }, reason: string, note: string) {
    update((d) => {
      const issue = { reason, note, at: now(), status: ISSUE_STATUS }
      const b = target.purchaseId ? d.purchases.find((x) => x.id === target.purchaseId) : undefined
      if (b) b.issue = issue
      const tid = target.threadId ?? b?.threadId
      const t = tid ? d.threads.find((x) => x.id === tid) : undefined
      if (t) {
        t.issue = issue
        t.status = 'แจ้งปัญหาแล้ว รอครีเอเตอร์ตอบ'; t.tone = 'warn'; t.updatedAt = now()
        push(d, t.id, { from: 'system', kind: 'system', text: `คุณแจ้งปัญหา: ${reason}${note ? ` “${note}”` : ''} · ${ISSUE_STATUS} (ตัวอย่าง)` })
      }
      notify(d, { kind: 'system', text: `ส่งเรื่อง “${reason}” แล้ว · ${ISSUE_STATUS}`, link: t ? `/chat/${t.id}` : b ? `/library/${b.id}` : '/library' })
    })
  }
  async review(purchaseId: string, stars: number, text: string) {
    update((d) => {
      const b = d.purchases.find((x) => x.id === purchaseId)
      if (b) b.review = { stars, text, at: now() }
    })
  }
  async extendReview(threadId: string, msgId: string) {
    update((d) => {
      const m = d.messages[threadId]?.find((x) => x.id === msgId)
      if (!m || m.extended) return
      m.extended = true
      push(d, threadId, { from: 'system', kind: 'system', text: 'คุณขอเวลาตรวจงานเพิ่ม 3 วัน · ยังไม่โอนเงินให้ครีเอเตอร์จนกว่าคุณจะกดรับงาน (ตัวอย่าง)' })
    })
  }
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

/** What buyers judge a listing by. Changing any of it on a live listing sends the edit to review;
 *  price, options, free ⇄ paid, tags, delivery time and revisions apply at once. */
const TERMS_ONLY = new Set(['timeline', 'revisions'])
export function contentSig(dr: ListingDraft) {
  const spec = Object.fromEntries(Object.entries(dr.spec).filter(([k]) => !TERMS_ONLY.has(k)).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify([dr.type, dr.title.trim(), dr.use.trim(), (dr.desc ?? '').trim(), dr.covers, spec])
}

/** Turn a wizard draft into a Product (also used for the live preview). */
export function draftToProduct(dr: ListingDraft, id = dr.publishedId ?? `u-${dr.id}`): Product {
  const t = dr.type ?? 'img'
  const m = TYPE_MAP[t]
  const opts = dr.options.filter((o) => o.on && o.price > 0)
  const free = dr.free && dr.type !== 'hire'
  const price = free ? 0 : opts.length ? Math.min(...opts.map((o) => o.price)) : 0
  const sub = typeof dr.spec.sub === 'string' ? dr.spec.sub : undefined
  const cover = dr.covers[0] ?? 'g_lotus.jpg'
  // a prompt is only sold when the “ภาพ + พรอมต์” option is on (or the work is free)
  const promptOn = on(dr.spec.sellPrompt) && (t !== 'img' || free || opts.some((o) => o.id === 'both' || /พรอมต์/.test(o.label)))
  const spec = t === 'img' ? { ...dr.spec, sellPrompt: promptOn } : dr.spec
  const days = typeof dr.spec.timeline === 'string' ? parseInt(dr.spec.timeline.split('–')[1] ?? '7') : undefined
  return {
    id, kind: m.kind, type: m.type, label: sub && t !== 'hire' ? sub : m.label, st: t,
    title: dr.title || 'ผลงานใหม่ (ยังไม่ตั้งชื่อ)', use: dr.use || '—', desc: dr.desc, tags: dr.tags,
    creatorId: ME, price, image: { src: cover, w: 900, h: 1100 }, covers: dr.covers, spec,
    options: free ? undefined : opts.map(({ id, label, sub, price, suffix }) => ({ id, label, sub, price, suffix })),
    hasPrompt: promptOn, tryable: on(dr.spec.trial), instant: t !== 'hire',
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
    const { covers: _c, ...listing } = dr; void _c
    const was = productById(dr.publishedId ?? '')
    // new listings and fixes of rejected ones go to review
    const review = !was || was.mod?.status === 'rejected' || was.mod?.status === 'pending'
    // a live listing whose content changed: the edit is reviewed, buyers keep the old version meanwhile
    const editReview = !review && (!dr.origSig || contentSig(dr) !== dr.origSig)
    const mod: Product['mod'] = review ? { status: 'pending', at: now(), share } : was?.mod
    const base = draftToProduct(dr)
    const p: Product = { ...(was ?? {}), ...base, mine: was ? was.mine : true, rating: was?.rating, listing: { ...listing, origSig: undefined, step: 1 }, createdAt: was?.createdAt ?? now(), mod, rev: undefined }
    if (review || editReview) share = false // the post goes out when the listing passes review
    update((d) => {
      if (editReview && was) {
        const live = { ...(d.published.find((x) => x.id === was.id) ?? was), rev: { status: 'pending' as const, at: now(), next: { ...p, mod: { status: 'live' as const, at: now() } } } }
        d.published = [live, ...d.published.filter((x) => x.id !== was.id)]
      } else d.published = [p, ...d.published.filter((x) => x.id !== p.id)]
      d.drafts = d.drafts.filter((x) => x.id !== dr.id)
      if (share) d.posts.unshift({ id: uid('u'), authorId: ME, at: now(), tag: p.price === 0 ? 'แจกฟรี' : 'โชว์ผลงาน', text: was ? `อัปเดตผลงาน “${p.title}” ${p.price === 0 ? '· ตอนนี้แจกฟรีแล้ว 🎁' : '✨'} ${p.use}` : `ลงผลงานใหม่ “${p.title}” 🎉 ${p.use}`, images: dr.covers.slice(0, 3), productIds: [p.id], likes: 0, comments: 0, shares: 0, mine: true })
      notify(d, { kind: 'system', text: review ? `ส่ง “${p.title}” ให้ทีม ${BRAND} ตรวจแล้ว · ผลตรวจจะแจ้งที่นี่` : editReview ? `ส่งการแก้ไข “${p.title}” ให้ทีม ${BRAND} ตรวจแล้ว · ระหว่างรอ ผู้ซื้อยังเห็นฉบับเดิม` : `อัปเดต “${p.title}” แล้ว${notifyFollowers ? ` · แจ้งผู้ติดตาม ${creatorStats(ME).followersLabel} คน (ทดลอง)` : ''}`, link: `/product/${p.id}`, image: dr.covers[0] })
    })
    if (review || editReview) autoReview(p.id, REVIEW_MS)
    return p.id
  }
  async review(productId: string, pass: boolean, reason?: string) {
    update((d) => {
      const p = d.published.find((x) => x.id === productId)
      if (p?.rev?.status === 'pending') {
        const next = p.rev.next
        if (pass) d.published = d.published.map((x) => (x.id === productId ? { ...next, mod: { status: 'live', at: now() } } : x))
        else p.rev = { ...p.rev, status: 'rejected', reason: reason ?? REVIEW_REASONS[0], at: now() }
        notify(d, { kind: 'system', text: pass ? `การแก้ไข “${next.title}” ผ่านการตรวจแล้ว · ผู้ซื้อเห็นฉบับใหม่แล้ว` : `การแก้ไข “${next.title}” ยังไม่ผ่านการตรวจ: ${reason ?? REVIEW_REASONS[0]} · ผู้ซื้อยังเห็นฉบับเดิม`, link: `/product/${productId}`, image: next.covers?.[0] })
        return
      }
      if (!p || p.mod?.status !== 'pending') return
      const share = p.mod.share
      p.mod = pass ? { status: 'live', at: now() } : { status: 'rejected', reason: reason ?? REVIEW_REASONS[0], at: now() }
      if (pass && share) d.posts.unshift({ id: uid('u'), authorId: ME, at: now(), tag: p.price === 0 ? 'แจกฟรี' : 'โชว์ผลงาน', text: `ลงผลงานใหม่ “${p.title}” 🎉 ${p.use}`, images: (p.covers ?? []).slice(0, 3), productIds: [p.id], likes: 0, comments: 0, shares: 0, mine: true })
      notify(d, { kind: 'system', text: pass ? `“${p.title}” ผ่านการตรวจแล้ว · ขึ้นขายบนหน้าแรก หน้าค้นหา และหน้าร้านแล้ว` : `“${p.title}” ยังไม่ผ่านการตรวจ: ${p.mod.reason} · แก้ไขแล้วส่งตรวจใหม่ได้`, link: `/product/${p.id}`, image: p.covers?.[0] })
    })
  }
  async unpublish(productId: string) {
    unregisterProduct(productId)
    update((d) => { d.published = d.published.filter((x) => x.id !== productId) })
  }
}

function autoReview(id: string, ms: number) {
  later(Math.max(500, ms), () => { void sell.review(id, true) })
}
// pending listings from an earlier visit finish their (demo) review after a reload
for (const p of getDb().published) {
  if (isRemoteId(p.id)) continue // real listings are reviewed on the server
  if (p.mod?.status === 'pending') autoReview(p.id, p.mod.at + REVIEW_MS - Date.now())
  else if (p.rev?.status === 'pending') autoReview(p.id, p.rev.at + REVIEW_MS - Date.now())
}

// ---------- routing: demo/sample → Local*, signed-in real account + server rows → cloudApi
/** true when a real account is signed in and every given id is a server row */
const live = (...ids: (string | undefined)[]) => cloudOn() && ids.every((id) => !id || isRemoteId(id))
/** guests (accounts flag on, not signed in) must sign in before writing */
function gate() {
  if (FEATURES.accounts && getSession().mode === 'guest') {
    window.location.hash = '#/account/login'
    throw new CloudError('เข้าสู่ระบบก่อนนะ')
  }
}
const L = { follows: new LocalFollows(), checkout: new LocalCheckout(), chat: new LocalChat(), community: new LocalCommunity(), notifs: new LocalNotifs(), orders: new LocalOrders(), sell: new LocalSell() }

export const follows: FollowService = { toggle: (id) => { gate(); return live(id) ? K.toggleFollow(id) : L.follows.toggle(id) } }
export const cart: CartService = new LocalCart()
export const checkout: CheckoutService = {
  async place(keys, method, coupon) {
    gate()
    const items = getDb().cart.filter((c) => keys.includes(c.key))
    if (!live(...items.map((i) => (i.offerThreadId ? i.offerThreadId : i.productId === 'tip' ? i.creatorId : i.productId)))) return L.checkout.place(keys, method, coupon)
    const o = await K.checkout(items, method, coupon)
    update((d) => { d.cart = d.cart.filter((c) => !keys.includes(c.key)); d.orders.unshift(o) })
    return o
  },
}
export const chat: ChatService = {
  openWith: (p, prod) => { gate(); return live(p, prod) ? K.openChat(p, prod) : L.chat.openWith(p, prod) },
  send: (t, text) => (live(t) ? K.sendText(t, text) : L.chat.send(t, text)),
  sendCard: (t, msg, from) => (live(t) && from !== 'them' ? K.sendCard(t, msg) : L.chat.sendCard(t, msg, from)),
  sendBrief: (c, p, brief, pkg, amount) => { gate(); return live(c, p) ? K.sendBrief(c, p, brief, pkg) : L.chat.sendBrief(c, p, brief, pkg, amount) },
  acceptOffer: (t, m) => (live(t) ? K.acceptOffer(t, m) : L.chat.acceptOffer(t, m)),
  payOffer: (t, m) => L.chat.payOffer(t, m),
  acceptDelivery: (t, m, stars, review) => (live(t) ? K.acceptDelivery(t, stars, review) : L.chat.acceptDelivery(t, m, stars, review)),
  requestRevision: (t, m, note) => (live(t) ? K.requestRevision(t, note) : L.chat.requestRevision(t, m, note)),
  deliverToCustomer: (t) => (live(t) ? K.sendCard(t, { kind: 'file', fileName: 'ไฟล์งาน', text: 'ส่งไฟล์งานแล้ว' }) : L.chat.deliverToCustomer(t)),
  markRead: (t) => (live(t) ? K.markRead(t) : L.chat.markRead(t)),
  setFlag: (t, f) => (live(t) ? K.setFlag(t, f) : L.chat.setFlag(t, f)),
}
export interface CommunityEdits {
  editPost(id: string, patch: { text?: string; tag?: Post['tag'] }): Promise<void>
  deletePost(id: string): Promise<void>
  editComment(id: string, text: string): Promise<void>
  deleteComment(id: string): Promise<void>
  hide(id: string, on?: boolean): Promise<void>
  invite(roomId: string, userId: string): Promise<void>
  mentionCandidates(q: string, postId?: string, roomId?: string): Promise<{ id: string; reason: string }[]>
  members(roomId: string): Promise<{ id: string; role: string }[]>
}
export const community: CommunityService & CommunityEdits = {
  like: (id) => { gate(); return live(id) ? K.likePost(id) : L.community.like(id) },
  save: (id) => { gate(); return live(id) ? K.savePost(id) : L.community.save(id) },
  share: (id) => L.community.share(id),
  comment: (id, text, replyTo, m) => { gate(); return live(id) ? K.addComment(id, text, replyTo, m) : L.community.comment(id, text, replyTo, m) },
  likeComment: (id) => { gate(); return live(id) ? K.likeComment(id) : L.community.likeComment(id) },
  react: (id, k) => { gate(); return live(id) ? K.reactPost(id, k) : L.community.react(id, k) },
  reactComment: (id, k) => { gate(); return live(id) ? K.reactComment(id, k) : L.community.reactComment(id, k) },
  create: (p) => { gate(); return cloudOn() ? K.createPost(p) : L.community.create(p) },
  join: (id) => { gate(); return cloudOn() ? K.joinRoom(id) : L.community.join(id) },
  vote: (id) => L.community.vote(id),
  /** Hide a post from my feed (× on the card). */
  hide: async (id: string, on = true) => update((d) => { d.hidden = on ? [...new Set([...(d.hidden ?? []), id])] : (d.hidden ?? []).filter((x) => x !== id) }),
  invite: async (roomId: string, userId: string) => {
    gate()
    if (cloudOn() && isRemoteId(userId)) return K.inviteToRoom(roomId, userId)
    // demo: the sample person "gets" it; nothing is sent anywhere
  },
  /** People to suggest after “@” (with why), best first, at most 8. */
  mentionCandidates: async (q: string, postId?: string, roomId?: string): Promise<{ id: string; reason: string }[]> => {
    if (cloudOn()) { try { return await K.mentionCandidates(q, postId, roomId) } catch { return [] } }
    return localCandidates(q, postId, roomId)
  },
  members: async (roomId: string): Promise<{ id: string; role: string }[]> => {
    if (cloudOn()) { try { return await K.groupMembers(roomId) } catch { return [] } }
    const ids = [...new Set(getDb().posts.filter((p) => p.roomId === roomId).map((p) => p.authorId))]
    for (const c of CREATORS) if (ids.length < 6 && !ids.includes(c.id) && !['shop', 'somjai'].includes(c.id)) ids.push(c.id)
    return ids.map((id, i) => ({ id, role: i === 0 ? 'admin' : 'member' }))
  },
  // own posts/comments (screens for these are behind FEATURES.accounts until approved)
  editPost: async (id, patch) => {
    if (live(id)) return K.editPost(id, patch)
    update((d) => { const p = d.posts.find((x) => x.id === id && x.authorId === ME); if (p) { if (patch.text != null) p.text = patch.text; if (patch.tag) p.tag = patch.tag } })
  },
  deletePost: async (id) => {
    if (live(id)) return K.deletePost(id)
    update((d) => { if (!d.posts.some((x) => x.id === id && x.authorId === ME)) return; d.posts = d.posts.filter((x) => x.id !== id); d.comments = d.comments.filter((c) => c.postId !== id) })
  },
  editComment: async (id, text) => {
    if (live(id)) return K.editComment(id, text)
    update((d) => { const c = d.comments.find((x) => x.id === id && x.authorId === ME); if (c) c.text = text })
  },
  deleteComment: async (id) => {
    if (live(id)) return K.deleteComment(id)
    update((d) => {
      const c = d.comments.find((x) => x.id === id && x.authorId === ME); if (!c) return
      d.comments = d.comments.filter((x) => x.id !== id)
      const p = d.posts.find((x) => x.id === c.postId); if (p) p.comments = Math.max(0, p.comments - 1)
    })
  },
}
export const notifications: NotificationService = {
  read: (id) => (live(id) ? K.readNotif(id) : L.notifs.read(id)),
  readAll: async () => { await L.notifs.readAll(); if (cloudOn()) await K.readAllNotifs() },
}
export const orders: OrderService & { answerRefund(refundId: string, refund: boolean, note?: string): Promise<void> } = {
  reportIssue: (t, reason, note) => (live(t.purchaseId ?? t.threadId) ? K.reportIssue(t.purchaseId, t.threadId, reason, note) : L.orders.reportIssue(t, reason, note)),
  review: (id, stars, text) => (live(id) ? K.writeReview(id, stars, text) : L.orders.review(id, stars, text)),
  extendReview: (t, m) => L.orders.extendReview(t, m),
  answerRefund: async (id, refund, note) => {
    if (live(id)) return K.answerRefund(id, refund, note)
    update((d) => { const s = d.sales?.find((x) => x.refund?.id === id); if (s?.refund) { s.refund.status = refund ? 'refunded' : 'escalated'; s.refund.note = note ?? s.refund.note; if (refund) s.payout = 'refunded' } })
  },
}
export const sell: SellService = {
  saveDraft: (d) => L.sell.saveDraft(d),
  deleteDraft: async (id) => {
    const spec = getDb().drafts.find((x) => x.id === id)?.spec
    await L.sell.deleteDraft(id)
    if (!cloudOn()) return
    await deleteServerDraft(id)
    // previews only this draft used are deleted now; anything older and unused goes in the daily sweep
    void cleanupPreviews({ removed: previewPathsOf(spec), draftLocalId: id, sweep: true }).catch((e) => console.warn('[lumi] preview cleanup', e))
  },
  publish: async (dr, share, notify) => {
    if (!cloudOn()) return L.sell.publish(dr, share, notify)
    if (checkListing(dr).some((c) => !c.ok)) throw new Error('listing incomplete')
    const pid = await publishListing(dr, share, notify, false)
    update((d) => { d.drafts = d.drafts.filter((x) => x.id !== dr.id) })
    void cleanupPreviews({ sweep: true }).catch((e) => console.warn('[lumi] preview cleanup', e))
    return pid
  },
  unpublish: (id) => (live(id) ? unpublishListing(id) : L.sell.unpublish(id)),
  review: (id, pass, reason) => (live(id) ? Promise.resolve() : L.sell.review(id, pass, reason)),
}
/** Stories (24 h). Posting screens are behind FEATURES.accounts until approved. */
export interface StoryInput { file: Blob; kind: 'image' | 'video'; caption: string; productId?: string; linkLabel?: StoryLinkLabel; overlays?: StoryOverlay[]; durationMs?: number; mentions?: Mention[]; audience?: 'public' | 'close_friends'; allowReplies?: 'everyone' | 'following' | 'off' }
const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b) })
export const stories = {
  post: async (x: StoryInput) => {
    gate()
    if (cloudOn()) return K.postStory(x)
    // demo persona: kept in this browser only (24 h), nothing is uploaded
    const media = x.kind === 'image' || x.file.size <= 4 * 1024 * 1024 ? await blobToDataUrl(x.file) : URL.createObjectURL(x.file)
    const s: UserStory = { id: uid('st'), authorId: ME, media, kind: x.kind, caption: x.caption, at: now(), expires: now() + 24 * 3600e3, views: 0, productId: x.productId, linkLabel: x.productId ? (x.linkLabel ?? 'ดูสินค้า') : undefined, overlays: x.overlays, durationMs: x.durationMs, audience: x.audience ?? 'public', allowReplies: x.allowReplies ?? 'everyone' }
    update((d) => { d.stories = [s, ...(d.stories ?? [])] })
  },
  react: (id: string, emoji: string | null) => { gate(); return live(id) ? K.reactStory(id, emoji) : Promise.resolve(update((d) => { d.storyReactions = { ...(d.storyReactions ?? {}) }; if (emoji) d.storyReactions[id] = emoji; else delete d.storyReactions[id] })) },
  /** Reply in chat. Returns the thread id. */
  reply: async (id: string | undefined, authorId: string, text: string) => {
    gate()
    if (id && live(id, authorId)) return K.replyStory(id, authorId, text)
    const t = await chat.openWith(authorId)
    await chat.send(t, `ตอบกลับสตอรี่: ${text}`)
    return t
  },
  clicked: (id: string) => (live(id) ? K.storyLinkClicked(id) : Promise.resolve()),
  /** Who saw / reacted on my stories. Demo: sample viewers (nothing real). */
  activity: async (ids: string[]): Promise<Record<string, StoryActivity[]>> => {
    if (cloudOn()) { try { return await K.storyActivity(ids) } catch { return {} } }
    const out: Record<string, StoryActivity[]> = {}
    const sample: [string, number, string?, boolean?, boolean?][] = [['mint', 2, '😍', true], ['nova', 6, '🔥', false, true], ['somjai', 11, undefined, true], ['ton', 25], ['pim', 40, '❤️'], ['kenji', 55]]
    for (const id of ids) {
      const st = (getDb().stories ?? []).find((x) => x.id === id)
      out[id] = sample.filter(() => !!st).map(([u, m, e, c, r]) => ({ userId: u, at: Math.max(st!.at, now() - m * 60e3), emoji: e, clicked: !!c && !!st!.productId, replied: r }))
    }
    return out
  },
  remove: (id: string) => (live(id) ? K.deleteStory(id) : Promise.resolve(update((d) => { d.stories = (d.stories ?? []).filter((x) => x.id !== id) }))),
  view: (id: string) => (live(id) ? K.viewStory(id) : Promise.resolve()),
}
/** Account settings (real accounts only). */
export const account = {
  saveProfile: K.saveProfile, becomeCreator: K.becomeCreator, changeEmail: K.changeEmail, changePassword: K.changePassword,
  requestDeletion: K.requestAccountDeletion, cancelDeletion: K.cancelAccountDeletion, requests: K.myAccountRequests,
}
/** Library: a purchased file. Real files get a 10-minute link from get-download; sample files stay simulated. */
export async function fileLink(assetValue: string) { return assetValue.startsWith('cloud:') ? K.downloadUrl(assetValue) : null }
/** Creator's public reply under a buyer review (demo: stored locally; real reviews: key `review:<id>`). Empty text removes it. */
export async function replyToReview(key: string, text: string) {
  if (key.startsWith('review:') && cloudOn()) return K.replyReview(key.slice(7), text)
  update((d) => {
    const r = { ...(d.replies ?? {}) }
    if (text.trim()) r[key] = text.trim().slice(0, 500)
    else delete r[key]
    d.replies = r
  })
}
export function resetAll() {
  timers.forEach((h) => clearTimeout(h))
  timers.clear()
  resetDb()
  for (const k of ['lumi_reports', 'lumi_payout_ack']) localStorage.removeItem(k)
}
export { HIRE_STEPS }
