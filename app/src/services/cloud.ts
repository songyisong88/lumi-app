/**
 * Real accounts: reads and writes Supabase, and keeps the per-account local cache (db.ts) in sync
 * so every screen keeps reading the same DB shape. Only used when session mode is 'cloud'.
 * Sample creators/products (ids that are not uuids) stay simulated locally, as in the demo.
 */
import type { CartItem, CloudReview, Message, Notif, Order, Post, Purchase, Sale, Thread, UserStory, Asset } from '../data/appTypes'
import { LAUNCH_MAX_MB, type ListingDraft } from '../data/listingSpec'
import type { Creator, Product } from '../data/types'
import { ME, NO_AVATAR, isRemoteId, productById, registerCreators, remoteCreator } from '../data/sampleData'
import { setRoomCounts } from '../data/appSeed'
import { REAL } from '../config'
import { getDb, update } from './db'
import { publicUrl, sb } from './supabase'
import { getSession, registerSessionHooks, setProfile, type Profile } from './session'

// ---------- helpers
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const ms = (t?: string | null) => (t ? Date.parse(t) : Date.now())
const uids = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => isRemoteId(x ?? undefined)))]
const PREVIEW_PREFIX = () => publicUrl('x')!.slice(0, -1)
/** Store paths, show URLs: turn a previews public URL back into its storage path. */
export const toPath = (u: string) => (u.startsWith(PREVIEW_PREFIX()) ? u.slice(PREVIEW_PREFIX().length) : u)
export class CloudError extends Error {}
function must<T>(r: { data: T; error: { message: string; code?: string; hint?: string } | null }, what: string): T {
  if (r.error) { console.warn('[lumi cloud]', what, r.error); throw new CloudError(thaiError(r.error.message, r.error.code, r.error.hint)) }
  return r.data
}
export function thaiError(msg: string, code?: string, hint?: string) {
  if (hint && /^[A-Z_]+$/.test(msg) && /[\u0E00-\u0E7F]/.test(hint)) return hint
  if (code === '23505') return 'มีรายการนี้อยู่แล้ว'
  if (/EDIT_NEEDS_REVIEW/.test(msg)) return 'ผลงานที่ขายอยู่ต้องส่งตรวจก่อนเปลี่ยน · ฉบับเดิมยังขายต่อได้'
  if (code === '42501' || /permission|row-level/i.test(msg)) return 'ไม่มีสิทธิ์ทำรายการนี้'
  // Supabase Auth messages (sign-in, sign-up, password)
  if (/should be different from the old/i.test(msg)) return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม'
  if (/invalid login credentials/i.test(msg)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  if (/email not confirmed/i.test(msg)) return 'ยังไม่ได้ยืนยันอีเมล · เปิดลิงก์ในอีเมลก่อน หรือเข้าด้วยรหัสทางอีเมล'
  if (/token has expired|otp.*(expired|invalid)|invalid.*otp/i.test(msg)) return 'รหัสไม่ถูกต้องหรือหมดอายุ · ขอรหัสใหม่'
  if (/rate limit|too many|for security purposes/i.test(msg)) return 'ขอบ่อยเกินไป · รอสักครู่แล้วลองใหม่'
  if (/signups? not allowed|user not found/i.test(msg)) return 'ยังไม่มีบัญชีนี้ · สมัครใหม่ก่อน'
  if (/already registered/i.test(msg)) return 'อีเมลนี้มีบัญชีแล้ว · เข้าสู่ระบบแทน'
  if (/password should be at least|weak/i.test(msg)) return 'รหัสผ่านสั้นหรือง่ายเกินไป · อย่างน้อย 8 ตัว'
  if (/fetch|network/i.test(msg)) return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง'
  return /[\u0E00-\u0E7F]/.test(msg) ? msg : 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง'
}
const S = () => { if (!sb) throw new CloudError('ยังไม่ได้เชื่อมต่อระบบ'); return sb }

// ---------- profiles → creators
export function toCreator(p: Row): Creator {
  return { id: p.id, name: p.display_name || 'ผู้ใช้ LUMI', avatar: publicUrl(p.avatar_path) ?? NO_AVATAR, followers: p.follower_count ?? 0, bio: p.bio ?? undefined, handle: p.handle ?? undefined, verified: !!p.verified }
}
export async function loadProfiles(ids: string[]) {
  const need = uids(ids).filter((id) => !remoteCreator(id))
  if (!need.length) return
  const rows = must(await S().from('profiles').select('id, handle, display_name, avatar_path, bio, follower_count, is_creator, verified').in('id', need), 'profiles')
  registerCreators((rows ?? []).map(toCreator))
}

// ---------- products
const TYPE_KIND: Record<string, [Product['kind'], Product['type'], string]> = {
  img: ['image', 'img', 'ภาพ + พรอมต์'], tpl: ['image', 'tpl', 'เทมเพลต'], sw: ['image', 'tool', 'โปรแกรม'], game: ['image', 'tool', 'เกม'],
  bot: ['image', 'bot', 'บอท'], course: ['course', 'course', 'คอร์สออนไลน์'], font: ['image', 'tpl', 'ฟอนต์'], hire: ['commission', 'svc', 'งานจ้าง'],
  media: ['image', 'media', 'วิดีโอ เสียง เพลง'], skill: ['image', 'skill', 'Agent Skills'], data: ['image', 'data', 'ชุดข้อมูล'],
}
export function rowToDraft(r: Row, id = r.id): ListingDraft {
  const opts = ((r.product_options ?? r.options ?? []) as Row[]).slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  return {
    id, type: r.sell_type ?? r.type, step: 1, title: r.title ?? '', use: r.use_text ?? '', desc: r.description ?? '', tags: r.tags ?? [],
    covers: (r.covers ?? []).map((c: string) => publicUrl(c)!), spec: r.spec ?? {}, free: !!r.is_free, tips: !!(r.tips_enabled ?? r.tips),
    options: opts.map((o) => ({ id: o.code ?? o.id, label: o.label, sub: o.sub ?? '', price: o.price, on: o.enabled ?? o.on ?? true, suffix: o.suffix ?? undefined })),
    updatedAt: ms(r.updated_at), publishedId: r.sell_type ? r.id : r.published_product_id ?? undefined,
  }
}
export function toProduct(r: Row): Product {
  const dr = rowToDraft(r)
  const t = TYPE_KIND[r.sell_type] ?? TYPE_KIND.img
  const opts = dr.options.filter((o) => o.on && o.price > 0)
  const free = dr.free && r.sell_type !== 'hire'
  const sub = typeof dr.spec.sub === 'string' ? dr.spec.sub : undefined
  const mine = r.creator_id === ME
  const rs = r.review_status as string
  const status: 'pending' | 'live' | 'rejected' = rs === 'live' ? 'live' : rs === 'pending_review' || rs === 'pending' ? 'pending' : 'rejected'
  const { covers: _c, ...listing } = dr; void _c
  return {
    id: r.id, kind: t[0], type: t[1], label: r.label || (sub && r.sell_type !== 'hire' ? sub : t[2]), st: r.sell_type,
    title: r.title || 'ผลงานใหม่', use: r.use_text || '—', desc: r.description, tags: r.tags ?? [], creatorId: r.creator_id,
    price: free ? 0 : r.price ?? (opts.length ? Math.min(...opts.map((o) => o.price)) : 0),
    image: { src: dr.covers[0] ?? 'g_lotus.jpg', w: 900, h: 1100 }, covers: dr.covers, spec: dr.spec,
    options: free ? undefined : opts.map(({ id, label, sub, price, suffix }) => ({ id, label, sub, price, suffix })),
    hasPrompt: !!r.has_prompt, tryable: !!r.tryable, instant: r.sell_type !== 'hire', days: r.days ?? undefined, revisions: r.revisions ?? undefined,
    mine, createdAt: ms(r.published_at ?? r.created_at), rating: r.rating != null ? Number(r.rating) : undefined,
    listing: mine ? { ...listing, step: 1, publishedId: r.id } : undefined,
    mod: status === 'live' ? (mine ? { status: 'live', at: ms(r.updated_at) } : undefined) : { status, reason: r.review_reason ?? undefined, at: ms(r.submitted_at ?? r.updated_at) },
    real: { reviews: r.review_count ?? 0, rating: r.rating != null ? Number(r.rating) : 0, sales: r.sales_count ?? 0, likes: r.favorite_count ?? 0 },
  }
}
const PRODUCT_COLS = '*, product_options(*)'

// ---------- community
export function toPost(r: Row): Post {
  return {
    id: r.id, authorId: r.author_id, at: ms(r.created_at), tag: r.tag, text: r.body, images: (r.images ?? []).map((i: string) => publicUrl(i)!),
    productIds: r.product_ids ?? [], prompt: r.prompt ?? undefined, code: r.code ?? undefined, roomId: r.room_id ?? undefined,
    likes: (REAL ? r.real_like_count : r.like_count) ?? 0, comments: (REAL ? r.real_comment_count : r.comment_count) ?? 0, shares: r.share_count ?? 0, hireButton: !!r.hire_button, mine: r.author_id === ME,
  }
}
const toComment = (r: Row) => ({ id: r.id, postId: r.post_id, authorId: r.author_id, text: r.body, at: ms(r.created_at), likes: r.like_count ?? 0, replyTo: r.reply_to ?? undefined })

// ---------- chat
const JOB_TEXT: Record<string, [string, string, Thread['tone']]> = {
  // [buyer sees, creator sees, tone]
  briefed: ['ส่งบรีฟแล้ว รอใบเสนอราคา', 'ลูกค้าส่งบรีฟ · ส่งใบเสนอราคา', 'warn'],
  quoted: ['รอคุณตอบรับข้อเสนอ', 'ส่งใบเสนอราคาแล้ว รอลูกค้าตอบ', 'warn'],
  accepted: ['รับข้อเสนอแล้ว · รอชำระเงิน', 'ลูกค้ารับข้อเสนอแล้ว · รอชำระ', 'info'],
  paid: ['ชำระแล้ว · รอครีเอเตอร์เริ่มงาน', 'ลูกค้าชำระแล้ว · เริ่มงานได้เลย', 'warn'],
  in_progress: ['กำลังทำงาน', 'กำลังทำงาน', 'info'],
  delivered: ['ส่งงานแล้ว รอคุณตรวจ', 'ส่งงานแล้ว รอลูกค้าตรวจ', 'warn'],
  revision: ['ขอแก้ไขแล้ว · กำลังแก้', 'ลูกค้าขอแก้ไข', 'warn'],
  completed: ['เสร็จสมบูรณ์', 'เสร็จสมบูรณ์', 'done'],
  cancelled: ['ยกเลิกแล้ว', 'ยกเลิกแล้ว', 'done'],
  disputed: ['แจ้งปัญหาแล้ว · ทีม LUMI กำลังตรวจสอบ', 'มีการแจ้งปัญหา · ทีม LUMI กำลังตรวจสอบ', 'warn'],
}
function toThread(t: Row, st: Row | undefined, job: Row | undefined, unread: number): Thread {
  const buyer = t.buyer_id === ME
  const j = job ? JOB_TEXT[job.status] : undefined
  return {
    id: t.id, partnerId: buyer ? t.seller_id : t.buyer_id, role: buyer ? 'creator' : 'customer', title: t.title, image: publicUrl(t.image),
    productId: t.product_id ?? undefined, hire: !!t.is_hire, step: job?.step, amount: job?.amount ?? undefined, jobId: job?.id,
    status: j ? j[buyer ? 0 : 1] : t.last_message_preview || (buyer ? 'ถามเรื่องผลงาน' : 'ลูกค้าทักมา'), tone: j?.[2] ?? 'info',
    unread, online: false, updatedAt: ms(t.last_message_at), pinned: !!st?.pinned, muted: !!st?.muted,
    quick: buyer ? ['ผลงานนี้ยังขายอยู่ไหมครับ', 'ใช้กับมือถือได้ไหม'] : ['ขอบคุณที่สนใจครับ', 'ได้เลยครับ'],
  }
}
function toMsg(m: Row, offers: Map<string, Row>, job?: Row, latestDelivery?: string): Message {
  const from: Message['from'] = !m.sender_id ? 'system' : m.sender_id === ME ? 'me' : 'them'
  const p = m.payload ?? {}
  const base: Message = { id: m.id, from, kind: m.kind === 'image' ? 'file' : m.kind, text: m.body ?? undefined, at: ms(m.created_at) }
  switch (m.kind) {
    case 'offer': {
      const o = offers.get(p.offer_id)
      const s = o?.status === 'withdrawn' ? 'declined' : (o?.status ?? 'pending')
      return { ...base, text: undefined, title: m.body, amount: p.amount, items: p.items ?? [], offerId: p.offer_id, status: s }
    }
    case 'brief': return { ...base, text: undefined, title: m.body ?? 'บรีฟงานจ้าง', items: p.items ?? [], image: publicUrl(p.image) }
    case 'product': return { ...base, productId: p.product_id }
    case 'progress': return { ...base, title: p.title ?? 'อัปเดตความคืบหน้า', pct: p.pct, image: publicUrl(p.image) }
    case 'delivery': {
      const status = m.id !== latestDelivery ? 'revise' : job?.status === 'completed' ? 'accepted' : job?.status === 'revision' ? 'revise' : 'pending'
      return { ...base, title: p.title ?? `ส่งงานแล้ว · รอบที่ ${p.round ?? 1}`, image: publicUrl(p.image), round: p.round ?? 1, left: job?.revisions_left ?? p.left, status }
    }
    case 'file': case 'image': return { ...base, kind: 'file', fileName: p.name ?? m.body, size: p.size }
    case 'key': return { ...base, code: p.key }
    case 'tip': return { ...base, amount: p.amount }
    case 'coupon': return { ...base, code: p.code }
    case 'system': return { ...base, link: p.link, linkLabel: p.link_label }
    default: return base
  }
}

// ---------- notifications
/** Latest notices. The real site leaves out notices a test account caused (notifications.from_test, set server-side). */
const notifQuery = () => { const q = S().from('notifications').select('*'); return (REAL ? q.eq('from_test', false) : q).order('created_at', { ascending: false }).limit(100) }
const NOTIF_KIND: Record<string, Notif['kind']> = { moderation: 'system', payout: 'sale', refund: 'order' }
const toNotif = (n: Row): Notif => ({ id: n.id, kind: NOTIF_KIND[n.kind] ?? n.kind, text: n.text, at: ms(n.created_at), link: n.link ?? '/', read: !!n.read_at, avatar: remoteCreator(n.actor_id)?.avatar, image: publicUrl(n.image) })

// ---------- real site vs demo site
/** Test accounts (profiles.is_test, the lumi-qa-* QA accounts). The real site hides their listings, posts, comments,
 *  stories and reviews from everyone else; the demo site (the testing ground) shows everything. */
let TEST = new Set<string>()
async function loadTestIds() {
  if (!REAL) return
  const r = await S().from('profiles').select('id').eq('is_test', true)
  if (!r.error) TEST = new Set(((r.data ?? []) as Row[]).map((x) => x.id as string))
}
/** Show this author's content? Always for your own; on the real site never for test accounts. */
const shown = (id?: string | null) => !REAL || !id || id === ME || !TEST.has(id)
/** Real member counts of the community rooms (the demo site keeps its sample numbers). */
async function loadRoomCounts() {
  if (!REAL) return
  const r = await S().from('rooms').select('id, member_count')
  if (!r.error && r.data) setRoomCounts(r.data as { id: string; member_count: number | null }[])
}

// ---------- hydrate (sign-in, reload, realtime refresh)
const keepLocal = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !isRemoteId(x.id))
let hydrating: Promise<void> | null = null
export function hydrate() { return (hydrating ??= doHydrate().finally(() => { hydrating = null })) }
async function doHydrate() {
  const c = S(), me = ME
  if (!isRemoteId(me)) return
  const prof = must(await c.from('profiles').select('*').eq('id', me).maybeSingle(), 'my profile') as Profile | null
  if (prof) { setProfile(prof); registerCreators([toCreator(prof)]) }
  await Promise.all([loadTestIds(), loadRoomCounts()])
  const [mine, live, posts, likes, saves, clikes, follows, members, ents, notifs, stories] = await Promise.all([
    c.from('products').select(PRODUCT_COLS).eq('creator_id', me).eq('status', 'published').order('updated_at', { ascending: false }),
    c.from('products').select(PRODUCT_COLS).eq('status', 'published').eq('review_status', 'live').neq('creator_id', me).order('published_at', { ascending: false }).limit(200),
    c.from('posts').select('*').eq('status', 'visible').order('created_at', { ascending: false }).limit(100),
    c.from('post_likes').select('post_id').eq('user_id', me),
    c.from('post_saves').select('post_id').eq('user_id', me),
    c.from('comment_likes').select('comment_id').eq('user_id', me),
    c.from('follows').select('creator_id').eq('follower_id', me),
    c.from('room_members').select('room_id').eq('user_id', me),
    c.from('entitlements').select('*, products(id, title, covers, creator_id, sell_type)').eq('user_id', me).order('granted_at', { ascending: false }),
    notifQuery(),
    c.from('stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(200),
  ])
  const myProducts = (must(mine, 'my products') as Row[]).map(toProduct)
  const otherProducts = (must(live, 'products') as Row[]).filter((r) => shown(r.creator_id)).map(toProduct)
  const postRows = (must(posts, 'posts') as Row[]).filter((r) => shown(r.author_id))
  const postIds = postRows.map((p) => p.id)
  const comments = postIds.length ? (must(await c.from('comments').select('*').in('post_id', postIds).order('created_at'), 'comments') as Row[]).filter((r) => shown(r.author_id)) : []
  const entRows = must(ents, 'entitlements') as Row[]
  const storyRows = (must(stories, 'stories') as Row[]).filter((r) => shown(r.author_id))
  const notifRows = must(notifs, 'notifications') as Row[]
  await loadProfiles([...otherProducts.map((p) => p.creatorId), ...postRows.map((p) => p.author_id), ...comments.map((x) => x.author_id),
    ...entRows.map((e) => e.products?.creator_id), ...storyRows.map((s) => s.author_id), ...notifRows.map((n) => n.actor_id)])
  // edits of live listings waiting for review
  const pend = must(await c.from('listing_drafts').select('*').eq('owner_id', me).not('published_product_id', 'is', null), 'pending edits') as Row[]
  for (const dr of pend) {
    const p = myProducts.find((x) => x.id === dr.published_product_id)
    if (!p || (!dr.submitted_at && !dr.review_reason)) continue
    const next = toProduct({ ...dr, id: p.id, sell_type: dr.type, creator_id: me, review_status: 'live', product_options: (dr.options ?? []).map((o: Row, i: number) => ({ ...o, code: o.id, enabled: o.on, sort: i })) })
    p.rev = { status: dr.submitted_at ? 'pending' : 'rejected', reason: dr.review_reason ?? undefined, at: ms(dr.submitted_at ?? dr.updated_at), next }
  }
  const purchases = await purchasesFrom(entRows)
  const remotePosts = postRows.map(toPost)
  update((d) => {
    d.published = [...myProducts, ...otherProducts]
    d.posts = [...remotePosts, ...keepLocal(d.posts)].sort((a, b) => b.at - a.at)
    d.comments = [...comments.map(toComment), ...keepLocal(d.comments)]
    const L = (xs: Row[] | null, k: string) => (xs ?? []).map((x) => x[k] as string)
    d.liked = [...L(likes.data, 'post_id'), ...d.liked.filter((x) => !isRemoteId(x))]
    d.saved = [...L(saves.data, 'post_id'), ...d.saved.filter((x) => !isRemoteId(x))]
    d.likedComments = [...L(clikes.data, 'comment_id'), ...d.likedComments.filter((x) => !isRemoteId(x))]
    d.follows = [...L(follows.data, 'creator_id'), ...d.follows.filter((x) => !isRemoteId(x))]
    d.joined = [...new Set([...L(members.data, 'room_id'), ...d.joined])]
    d.purchases = [...purchases, ...d.purchases.filter((x) => !isRemoteId(x.id))]
    d.notifs = [...notifRows.map(toNotif), ...keepLocal(d.notifs)].sort((a, b) => b.at - a.at)
    d.stories = storyRows.map(toStory)
  })
  await Promise.all([refreshChats(), refreshSales()])
}

async function purchasesFrom(ents: Row[]): Promise<Purchase[]> {
  if (!ents.length) return []
  const c = S()
  const itemIds = uids(ents.map((e) => e.order_item_id))
  const pids = uids(ents.map((e) => e.product_id))
  const [items, files, secrets, reviews, refunds] = await Promise.all([
    itemIds.length ? c.from('order_items').select('id, unit_price, discount, option_label, title, order_id, orders(order_no, paid_at)').in('id', itemIds) : { data: [], error: null },
    c.from('product_files').select('id, product_id, name, size_bytes, sort').in('product_id', pids).eq('role', 'deliverable').eq('scan', 'ok').order('sort'),
    c.from('product_secrets').select('product_id, data').in('product_id', pids),
    c.from('reviews').select('*').eq('author_id', ME).in('product_id', pids),
    itemIds.length ? c.from('refund_requests').select('*').in('order_item_id', itemIds).order('created_at', { ascending: false }) : { data: [], error: null },
  ])
  const it = new Map((items.data ?? []).map((x: Row) => [x.id, x]))
  return ents.map((e): Purchase => {
    const p = e.products ?? {}, i = it.get(e.order_item_id) ?? {}
    const assets: Asset[] = ((files.data ?? []) as Row[]).filter((f) => f.product_id === e.product_id).map((f) => ({ kind: 'file', title: f.name, value: `cloud:${f.id}`, size: mb(f.size_bytes) }))
    if (e.license_key) assets.push({ kind: 'key', title: 'คีย์ใช้งาน', value: e.license_key })
    const sec = ((secrets.data ?? []) as Row[]).find((s) => s.product_id === e.product_id)?.data ?? {}
    if (sec.prompt) assets.push({ kind: 'prompt', title: 'พรอมต์', value: sec.prompt })
    if (sec.canvaLink) assets.push({ kind: 'link', title: 'ลิงก์เทมเพลต', value: sec.canvaLink })
    const rv = ((reviews.data ?? []) as Row[]).find((r) => r.product_id === e.product_id)
    const rf = ((refunds.data ?? []) as Row[]).find((r) => r.order_item_id === e.order_item_id)
    if (e.revoked_at) assets.length = 0 // refunded: access closed (the server refuses download links too)
    return {
      id: e.id, productId: e.product_id, orderNo: i.orders?.order_no ?? '-', optionLabel: i.option_label ?? undefined, at: ms(e.granted_at),
      title: p.title ?? i.title ?? 'ผลงาน', image: publicUrl(p.covers?.[0]), creatorId: p.creator_id, price: (i.unit_price ?? 0) - (i.discount ?? 0),
      key: e.revoked_at ? undefined : e.license_key ?? undefined, threadId: e.thread_id ?? undefined, assets, orderItemId: e.order_item_id ?? undefined,
      review: rv ? { stars: rv.stars, text: rv.body ?? '', at: ms(rv.created_at) } : undefined, reviewId: rv?.id,
      issue: rf ? { reason: rf.reason, note: rf.note, at: ms(rf.created_at), status: REFUND_TEXT[rf.status] ?? rf.status } : e.revoked_at ? { reason: 'คืนเงินแล้ว', note: '', at: ms(e.revoked_at), status: REFUND_TEXT.refunded } : undefined,
    }
  })
}
const mb = (b?: number) => (b == null ? undefined : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
export const REFUND_TEXT: Record<string, string> = {
  open: 'รอครีเอเตอร์ตอบภายใน 3 วัน · ถ้าไม่ตอบหรือตกลงกันไม่ได้ ทีม LUMI จะตัดสิน',
  refunded: 'ครีเอเตอร์คืนเงินแล้ว (ทดลอง ยังไม่มีการโอนเงินจริง) · ปิดสิทธิ์ดาวน์โหลดแล้ว',
  escalated: 'ครีเอเตอร์ไม่ยอมรับ · ทีม LUMI กำลังตรวจสอบและตัดสิน',
  declined: 'ทีม LUMI ตรวจแล้ว ไม่คืนเงิน',
}

export async function refreshChats() {
  const c = S()
  const threads = must(await c.from('chat_threads').select('*').order('last_message_at', { ascending: false }).limit(100), 'threads') as Row[]
  const ids = threads.map((t) => t.id)
  if (!ids.length) { update((d) => { d.threads = keepLocal(d.threads) }); return }
  const [states, jobs, unread, msgs, offers] = await Promise.all([
    c.from('chat_thread_state').select('*').eq('user_id', ME).in('thread_id', ids),
    c.from('hire_jobs').select('*').in('thread_id', ids),
    c.rpc('chat_unread'),
    c.from('messages').select('*').in('thread_id', ids).order('created_at', { ascending: false }).limit(1000),
    c.from('offers').select('id, status').in('thread_id', ids),
  ])
  await loadProfiles(threads.flatMap((t) => [t.buyer_id, t.seller_id]))
  const st = new Map(((states.data ?? []) as Row[]).map((s) => [s.thread_id, s]))
  const jb = new Map(((jobs.data ?? []) as Row[]).map((j) => [j.thread_id, j]))
  const un = new Map(((unread.data ?? []) as Row[]).map((u) => [u.thread_id, Number(u.unread)]))
  const of = new Map(((offers.data ?? []) as Row[]).map((o) => [o.id, o]))
  const byThread = new Map<string, Row[]>()
  for (const m of ((msgs.data ?? []) as Row[]).reverse()) (byThread.get(m.thread_id) ?? byThread.set(m.thread_id, []).get(m.thread_id)!).push(m)
  update((d) => {
    const visible = threads.filter((t) => !st.get(t.id)?.archived)
    d.threads = [...visible.map((t) => toThread(t, st.get(t.id), jb.get(t.id), un.get(t.id) ?? 0)), ...keepLocal(d.threads)]
    for (const t of threads) {
      const rows = byThread.get(t.id) ?? []
      const latest = [...rows].reverse().find((m) => m.kind === 'delivery')?.id
      d.messages[t.id] = rows.map((m) => toMsg(m, of, jb.get(t.id), latest))
    }
  })
}

export async function refreshSales() {
  const rows = must(await S().rpc('my_sales'), 'sales') as Row[]
  await loadProfiles(rows.map((r) => r.buyer_id))
  const sales: Sale[] = rows.map((r) => ({
    id: r.item_id, orderNo: r.order_no, at: ms(r.paid_at), buyerId: r.buyer_id, productId: r.product_id ?? undefined, title: r.title, optionLabel: r.option_label ?? undefined,
    gross: r.gross, fee: r.fee, net: r.net, payout: (r.ledger_status ?? 'held') as Sale['payout'], releaseAt: r.release_after ? ms(r.release_after) : undefined,
    threadId: r.thread_id ?? undefined, hire: !!r.job_id,
    refund: r.refund_id ? { id: r.refund_id, status: r.refund_status, reason: r.refund_reason, note: r.refund_note ?? '', at: ms(r.refund_at) } : undefined,
  }))
  update((d) => { d.sales = sales })
}
async function refreshNotifs() {
  const rows = must(await notifQuery(), 'notifications') as Row[]
  await loadProfiles(rows.map((n) => n.actor_id))
  update((d) => { d.notifs = [...rows.map(toNotif), ...keepLocal(d.notifs)].sort((a, b) => b.at - a.at) })
}

// ---------- realtime
let channel: ReturnType<NonNullable<typeof sb>['channel']> | null = null
const debounce = (fn: () => unknown, wait = 400) => { let h = 0; return () => { clearTimeout(h); h = window.setTimeout(() => void Promise.resolve(fn()).catch(() => {}), wait) } }
const chatsLater = debounce(refreshChats), salesLater = debounce(refreshSales, 800), notifsLater = debounce(refreshNotifs)
function subscribe(uid: string) {
  unsubscribe()
  channel = S().channel(`lumi:${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, chatsLater)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hire_jobs' }, chatsLater)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, chatsLater)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => { notifsLater(); salesLater() })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'refund_requests' }, salesLater)
    .subscribe()
}
function unsubscribe() { if (channel) void sb?.removeChannel(channel); channel = null }

registerSessionHooks({
  onCloud: (uid) => { void hydrate().catch((e) => toast(e.message)); subscribe(uid) },
  onLeave: () => unsubscribe(),
  // visitors who are not signed in still see real live listings, posts and stories (sample posts stay)
  onGuest: () => { void loadPublic().catch(() => {}) },
})
export const toast = (m: string) => window.dispatchEvent(new CustomEvent('lumi-toast', { detail: m }))
export const cloudOn = () => getSession().mode === 'cloud' && isRemoteId(ME)

// ---------- stories
export function toStory(s: Row): UserStory {
  return { id: s.id, authorId: s.author_id, media: publicUrl(s.media_path)!, kind: s.media_kind, caption: s.caption ?? '', at: ms(s.created_at), expires: ms(s.expires_at), views: s.view_count ?? 0, productId: s.product_id ?? undefined }
}

// ---------- uploads
const ext = (name: string) => (name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
const safe = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(-80)
/** data: URL or File → previews/<me>/<folder>/… ; returns the storage path. */
export async function uploadPreview(src: string | Blob, folder: string, name = 'img.jpg') {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src
  if (blob.size > 10 * 1024 * 1024) throw new CloudError('ไฟล์ภาพ/วิดีโอใหญ่เกิน 10 MB')
  const type = blob.type || 'image/jpeg'
  const path = `${ME}/${folder}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${type.split('/')[1]?.replace('jpeg', 'jpg') ?? ext(name)}`
  must(await S().storage.from('previews').upload(path, blob, { contentType: type, upsert: false }), 'upload')
  return path
}
/** Covers/images of a listing or post: upload data URLs, keep public URLs as paths, leave sample file names. */
export async function toPaths(xs: string[], folder: string) {
  const out: string[] = []
  for (const x of xs) out.push(x.startsWith('data:') || x.startsWith('blob:') ? await uploadPreview(x, folder) : toPath(x))
  return out
}

// listing drafts on the server (files need a server draft id before publish)
const MAP_KEY = 'lumi_cloud_draft_map'
const draftMap = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}') } catch { return {} } }
async function serverDraft(localId: string) {
  const m = draftMap()
  if (m[localId]) return m[localId]
  const r = must(await S().from('listing_drafts').insert({}).select('id').single(), 'draft') as Row
  localStorage.setItem(MAP_KEY, JSON.stringify({ ...draftMap(), [localId]: r.id }))
  return r.id as string
}
/** Seller deliverable: private quarantine bucket → scan-file edge function → deliverables. */
export async function uploadDeliverable(localDraftId: string, file: File, onPct?: (n: number) => void) {
  if (file.size > LAUNCH_MAX_MB * 1024 * 1024) return { scan: 'fail' as const, reason: 'ไฟล์ใหญ่เกิน 50 MB (ระบบทดลอง)' }
  const c = S(), draft = await serverDraft(localDraftId)
  const path = `${ME}/${draft}/${Date.now().toString(36)}-${safe(file.name)}`
  onPct?.(10)
  must(await c.storage.from('quarantine').upload(path, file, { contentType: file.type || 'application/octet-stream' }), 'upload file')
  onPct?.(70)
  const row = must(await c.from('product_files').insert({ draft_id: draft, path, name: file.name.slice(0, 200), size_bytes: file.size, mime: file.type || null }).select('id').single(), 'file row') as Row
  const { data, error } = await c.functions.invoke('scan-file', { body: { file_id: row.id } })
  onPct?.(100)
  if (error) return { fileId: row.id, scan: 'fail' as const, reason: 'สแกนไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง' }
  return { fileId: row.id as string, scan: (data?.scan === 'ok' ? 'ok' : 'fail') as 'ok' | 'fail', reason: data?.reason as string | undefined }
}
export async function removeDeliverable(fileId: string) { await S().from('product_files').delete().eq('id', fileId) }
/** 10-minute download link, signed by the get-download edge function after it re-checks the right to the file
 *  (a refund revokes it at once) and logs the download. Clients cannot sign deliverables themselves. */
export async function signedFileUrl(fileId: string) {
  const { data, error } = await S().functions.invoke('get-download', { body: { file_id: fileId } })
  if (error || !data?.url) throw new CloudError('ไฟล์นี้ดาวน์โหลดไม่ได้แล้ว (หมดสิทธิ์หรือคืนเงินแล้ว)')
  return data.url as string
}

// ---------- listings (publish / review)
async function draftRow(dr: ListingDraft) {
  const covers = await toPaths(dr.covers, 'covers')
  return { type: dr.type, step: Math.min(6, dr.step), title: dr.title.slice(0, 70), use_text: dr.use.slice(0, 200), description: (dr.desc ?? '').slice(0, 5000), tags: dr.tags.slice(0, 8), covers, spec: dr.spec, is_free: dr.free && dr.type !== 'hire', tips: dr.tips, options: dr.options, published_product_id: isRemoteId(dr.publishedId) ? dr.publishedId : null }
}
const sleep = (n: number) => new Promise((r) => setTimeout(r, n))
/** Polls finish_review for a result. Approval is done by a LUMI moderator (approve_listing); the server no longer
 *  auto-approves, so this usually just ends with 'wait' and the next hydrate picks up the decision. */
async function waitReview(productId: string, draftId: string | null) {
  for (let i = 0; i < 40; i++) {
    await sleep(i === 0 ? 21000 : 4000)
    const { data, error } = await S().rpc('finish_review', { p_product: productId, p_draft: draftId })
    if (error) return
    if (data === 'live') break
    if (data === 'rejected' || data === 'none') break
  }
  await hydrate().catch(() => {})
}
export async function publishListing(dr: ListingDraft, share: boolean, notify: boolean, liveEdit: boolean): Promise<string> {
  const c = S()
  const id = await serverDraft(dr.id)
  must(await c.from('listing_drafts').update(await draftRow(dr)).eq('id', id), 'save listing')
  let pid: string
  // an approved listing (even unpublished) can only change through a reviewed revision; the old version keeps selling
  const approved = isRemoteId(dr.publishedId) && (liveEdit || (must(await c.from('products').select('review_status').eq('id', dr.publishedId!).maybeSingle(), 'listing') as Row | null)?.review_status === 'live')
  if (approved) {
    must(await c.rpc('submit_edit', { p_draft: id }), 'submit edit')
    pid = dr.publishedId!
    void waitReview(pid, id)
  } else {
    // share post + follower notice are queued on the server and sent when a moderator approves (even if the app is closed)
    const fresh = !isRemoteId(dr.publishedId)
    pid = must(await c.rpc('publish_listing', { p_draft: id, p_share: share && fresh, p_notify: notify }), 'publish') as string
    void waitReview(pid, null)
  }
  const m = draftMap(); delete m[dr.id]; localStorage.setItem(MAP_KEY, JSON.stringify(m))
  await hydrate()
  return pid
}
export async function unpublishListing(pid: string) { must(await S().from('products').update({ status: 'unpublished' }).eq('id', pid), 'unpublish'); await hydrate() }
export async function deleteServerDraft(localId: string) {
  const id = draftMap()[localId]
  if (!id) return
  await S().from('listing_drafts').delete().eq('id', id)
  const m = draftMap(); delete m[localId]; localStorage.setItem(MAP_KEY, JSON.stringify(m))
}

// ---------- commerce
export async function checkoutCloud(items: CartItem[], method: string, coupon?: string): Promise<Order> {
  const c = S()
  // server cart mirrors the chosen lines, then place_order + test payment
  must(await c.from('cart_items').delete().eq('user_id', ME), 'clear cart')
  const ids: string[] = []
  for (const it of items) {
    let row: Row = {}
    if (it.offerMsgId && it.offerThreadId) {
      const offerId = getDb().messages[it.offerThreadId]?.find((m) => m.id === it.offerMsgId)?.offerId
      row = { offer_id: offerId }
    } else if (it.productId === 'tip') row = { tip_creator_id: it.creatorId, tip_amount: it.price }
    else {
      let option_id: string | null = null
      if (it.optionId && it.price > 0) {
        const o = must(await c.from('product_options').select('id').eq('product_id', it.productId).eq('code', it.optionId).maybeSingle(), 'option') as Row | null
        option_id = o?.id ?? null
      }
      row = { product_id: it.productId, option_id }
    }
    ids.push((must(await c.from('cart_items').insert(row).select('id').single(), 'cart') as Row).id)
  }
  const orderId = must(await c.rpc('place_order', { p_cart_ids: ids, p_method: method === 'free' ? 'free' : method === 'card' ? 'card' : 'promptpay', p_coupon: coupon || null }), 'order') as string
  const o = must(await c.from('orders').select('*').eq('id', orderId).single(), 'order') as Row
  if (o.status !== 'paid') must(await c.rpc('pay_order_test', { p_order: orderId }), 'test payment')
  await hydrate()
  return { id: orderId, no: o.order_no, items, total: o.total, discount: o.discount, at: Date.now(), method }
}

export async function loadReviews(productId: string) {
  if (!isRemoteId(productId)) return
  await loadTestIds()
  const rows = (must(await S().from('reviews').select('*').eq('product_id', productId).order('created_at', { ascending: false }).limit(50), 'reviews') as Row[]).filter((r) => shown(r.author_id))
  await loadProfiles(rows.map((r) => r.author_id))
  const list: CloudReview[] = rows.map((r) => ({ id: r.id, authorId: r.author_id, stars: r.stars, text: r.body ?? '', at: ms(r.created_at), reply: r.reply ?? undefined }))
  update((d) => { d.cloudReviews = { ...(d.cloudReviews ?? {}), [productId]: list } })
}
export async function loadProduct(id: string) {
  if (!isRemoteId(id) || productById(id)) return
  const r = must(await S().from('products').select(PRODUCT_COLS).eq('id', id).maybeSingle(), 'product') as Row | null
  if (!r) return
  await loadTestIds()
  if (!shown(r.creator_id)) return
  await loadProfiles([r.creator_id])
  const p = toProduct(r)
  update((d) => { d.published = [...d.published.filter((x) => x.id !== p.id), p] })
}
/** Public data for visitors who are not signed in (live listings, posts, stories). */
export async function loadPublic() {
  const c = S()
  await Promise.all([loadTestIds(), loadRoomCounts()])
  const [live, posts, stories] = await Promise.all([
    c.from('products').select(PRODUCT_COLS).eq('status', 'published').eq('review_status', 'live').order('published_at', { ascending: false }).limit(200),
    c.from('posts').select('*').eq('status', 'visible').order('created_at', { ascending: false }).limit(60),
    c.from('stories').select('*').gt('expires_at', new Date().toISOString()).limit(100),
  ])
  const ok = (r: Row) => shown(r.creator_id ?? r.author_id)
  const prods = ((live.data ?? []) as Row[]).filter(ok).map(toProduct), ps = ((posts.data ?? []) as Row[]).filter(ok).map(toPost), ss = ((stories.data ?? []) as Row[]).filter(ok).map(toStory)
  await loadProfiles([...prods.map((p) => p.creatorId), ...ps.map((p) => p.authorId), ...ss.map((s) => s.authorId)])
  update((d) => { d.published = prods; d.posts = [...ps, ...keepLocal(d.posts)].sort((a, b) => b.at - a.at); d.stories = ss })
}
export { S as client, must }
