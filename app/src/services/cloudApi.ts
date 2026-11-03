/**
 * Supabase versions of the api.ts services. api.ts routes a call here only when a real account is
 * signed in (FEATURES.accounts on + session mode 'cloud') AND the target is a server row (uuid).
 * Sample data (non-uuid ids) keeps the local demo behaviour, so the approved demo never changes.
 */
import type { CartItem, Mention, Message, Post, PostTag, ReactKind, StoryActivity, StoryLinkLabel, StoryOverlay } from '../data/appTypes'
import { ME, isRemoteId } from '../data/sampleData'
import { REAL, BRAND } from '../config'
import { getDb, update } from './db'
import { client as S, must, hydrate, refreshChats, refreshSales, toast, uploadPreview, toPaths, toStory, signedFileUrl, checkoutCloud, thaiError, loadProfiles } from './cloud'
import { setProfile, type Profile } from './session'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const R = isRemoteId
const soft = (p: PromiseLike<{ error: { message: string } | null }>) => Promise.resolve(p).then((r) => { if (r.error) console.warn('[lumi cloud]', r.error.message) })

// ---------- follows / community
const followBusy = new Set<string>()
/** Follow / unfollow. A second tap while the first is still on its way is ignored (no crossed insert/delete). */
export async function toggleFollow(id: string) {
  if (followBusy.has(id)) return getDb().follows.includes(id)
  followBusy.add(id)
  const was = getDb().follows.includes(id)
  try { return await followOnce(id) } catch (e) {
    update((d) => { d.follows = was ? [id, ...d.follows.filter((x) => x !== id)] : d.follows.filter((x) => x !== id) }) // screen back to the server's state
    throw e
  } finally { followBusy.delete(id) }
}
async function followOnce(id: string) {
  const on = !getDb().follows.includes(id)
  update((d) => { d.follows = on ? [id, ...d.follows] : d.follows.filter((x) => x !== id) })
  if (on) {
    const r = await S().from('follows').insert({ creator_id: id })
    if (r.error) {
      // Private account: the server refuses a direct follow; send a request instead (like Instagram).
      const p = await S().from('profiles').select('is_private').eq('id', id).maybeSingle()
      update((d) => { d.follows = d.follows.filter((x) => x !== id) })
      if ((p.data as Row | null)?.is_private) {
        const q = await S().from('follow_requests').insert({ target_id: id })
        if (q.error && q.error.code !== '23505') must(q, 'follow request')
        toast('ส่งคำขอติดตามแล้ว · รอเขาอนุมัติ')
        return false
      }
      must(r, 'follow')
    }
  } else must(await S().from('follows').delete().eq('follower_id', ME).eq('creator_id', id), 'unfollow')
  return on
}
/** One server write at a time per item, always toward the latest tap. Rapid like/unlike/save taps used to fire
 *  overlapping insert/delete requests that could land out of order (server ≠ screen, or a duplicate-key error).
 *  Now the screen updates at once, the server catches up with the last state, and a failure puts the screen back. */
type Sync<T> = { want: T; has: T; busy: boolean }
const syncs = new Map<string, Sync<unknown>>()
async function syncTo<T>(key: string, has: T, want: T, write: (from: T, to: T) => Promise<void>, undo: (to: T) => void) {
  let st = syncs.get(key) as Sync<T> | undefined
  if (st) { st.want = want; if (st.busy) return } else { st = { want, has, busy: false }; syncs.set(key, st as Sync<unknown>) }
  st.busy = true
  try {
    while (st.has !== st.want) { const to = st.want; await write(st.has, to); st.has = to }
  } catch (e) {
    undo(st.has)
    throw e
  } finally { syncs.delete(key) }
}
const dup = (r: { error: { code?: string } | null }) => r.error?.code === '23505'
async function toggleRow(table: string, col: string, id: string, list: 'liked' | 'saved' | 'likedComments') {
  const was = getDb()[list].includes(id)
  const set = (on: boolean) => update((d) => {
    const has = d[list].includes(id); if (has === on) return
    d[list] = on ? [...d[list], id] : d[list].filter((x) => x !== id)
    if (list === 'liked') { const p = d.posts.find((x) => x.id === id); if (p) p.likes += on ? 1 : -1 }
    if (list === 'likedComments') { const c = d.comments.find((x) => x.id === id); if (c) c.likes += on ? 1 : -1 }
  })
  set(!was)
  await syncTo(`${table}:${id}`, was, !was, async (_f, on) => {
    if (!on) must(await S().from(table).delete().eq('user_id', ME).eq(col, id), table)
    else { const r = await S().from(table).insert({ [col]: id } as Row); if (!dup(r)) must(r, table) }
  }, set)
}
/** Set my reaction on a post/comment (null = remove). Optimistic, then insert / update kind / delete. */
async function setReaction(isPost: boolean, id: string, kind: ReactKind | null) {
  const map = isPost ? 'reactions' : 'commentReactions'
  const cur = () => (getDb()[map] ?? {})[id] ?? ((isPost ? getDb().liked : getDb().likedComments).includes(id) ? 'like' : undefined)
  const prev = cur()
  if ((prev ?? null) === kind) return
  update((d) => applyReaction(d, isPost, id, prev, kind))
  const table = isPost ? 'post_likes' : 'comment_likes', col = isPost ? 'post_id' : 'comment_id'
  await syncTo<ReactKind | null>(`${table}:${id}`, prev ?? null, kind, async (from, to) => {
    if (!to) { must(await S().from(table).delete().eq('user_id', ME).eq(col, id), table); return }
    if (!from) {
      const r = await S().from(table).insert({ [col]: id, kind: to } as Row)
      if (!dup(r)) { must(r, table); return }
    }
    must(await S().from(table).update({ kind: to }).eq('user_id', ME).eq(col, id), table)
  }, (to) => { const now = cur() ?? null; if (now !== to) update((d) => applyReaction(d, isPost, id, now ?? undefined, to)) })
}
/** Shared by the local demo and the cloud cache: move one reaction from `prev` to `kind`. */
export function applyReaction(d: ReturnType<typeof getDb>, isPost: boolean, id: string, prev: ReactKind | undefined, kind: ReactKind | null) {
  const item = isPost ? d.posts.find((x) => x.id === id) : d.comments.find((x) => x.id === id)
  const map = (isPost ? (d.reactions ??= {}) : (d.commentReactions ??= {}))
  const list = isPost ? 'liked' : 'likedComments'
  if (kind) map[id] = kind; else delete map[id]
  d[list] = kind ? (d[list].includes(id) ? d[list] : [...d[list], id]) : d[list].filter((x) => x !== id)
  if (!item) return
  const rx = { ...(item.rx ?? {}) }
  if (prev) { rx[prev] = Math.max(0, (rx[prev] ?? 0) - 1); if (!rx[prev]) delete rx[prev] }
  if (kind) rx[kind] = (rx[kind] ?? 0) + 1
  item.rx = rx
  item.likes = Math.max(0, item.likes + (kind ? 1 : 0) - (prev ? 1 : 0))
}
export const reactPost = (id: string, kind: ReactKind | null) => setReaction(true, id, kind)
export const reactComment = (id: string, kind: ReactKind | null) => setReaction(false, id, kind)
export const likePost = (id: string) => setReaction(true, id, (getDb().reactions?.[id] || getDb().liked.includes(id)) ? null : 'like')
export const savePost = (id: string) => toggleRow('post_saves', 'post_id', id, 'saved')
export const likeComment = (id: string) => setReaction(false, id, (getDb().commentReactions?.[id] || getDb().likedComments.includes(id)) ? null : 'like')
void toggleRow
/** Tag rows for the @names still in the text (the server sends the notices). */
async function saveMentions(kind: 'post' | 'comment' | 'story', sourceId: string, text: string, list?: Mention[]) {
  const seen = new Set<string>()
  const rows = (list ?? []).filter((m) => R(m.id) && m.id !== ME && text.includes('@' + m.name) && !seen.has(m.id) && seen.add(m.id))
    .slice(0, 10).map((m) => ({ source_kind: kind, source_id: sourceId, mentioned_id: m.id, name: m.name.slice(0, 60) }))
  if (rows.length) await soft(S().from('mentions').insert(rows))
}
export async function addComment(postId: string, text: string, replyTo?: string, mentions?: Mention[]) {
  const row = must(await S().from('comments').insert({ post_id: postId, body: text, reply_to: replyTo && R(replyTo) ? replyTo : null }).select('id').single(), 'comment') as Row
  await saveMentions('comment', row.id, text, mentions)
  await hydrate()
}
/** People to suggest after “@”: followed, in this post, commented on my posts, in this group (server ranks them). */
export async function mentionCandidates(q: string, postId?: string, roomId?: string) {
  const rows = (must(await S().rpc('search_mention_candidates', { q, p_post: postId && R(postId) ? postId : null, p_room: roomId ?? null, p_real: REAL }), 'mention search') as Row[]) ?? []
  const ids = rows.map((r) => r.id as string)
  if (ids.length) await loadProfiles(ids)
  return rows.map((r) => ({ id: r.id as string, reason: (r.reason as string) ?? '' }))
}
export async function inviteToRoom(roomId: string, userId: string) {
  must(await S().from('room_members').insert({ room_id: roomId, user_id: userId, status: 'invited', invited_by: ME } as Row), 'invite')
}
export async function acceptInvite(roomId: string) {
  update((d) => { d.invites = (d.invites ?? []).filter((x) => x.roomId !== roomId); if (!d.joined.includes(roomId)) d.joined = [...d.joined, roomId] })
  must(await S().from('room_members').update({ status: 'joined' }).eq('user_id', ME).eq('room_id', roomId).eq('status', 'invited'), 'accept invite')
}
export async function groupMembers(roomId: string) {
  const rows = (must(await S().from('room_members').select('user_id, role').eq('room_id', roomId).eq('status', 'joined').limit(60), 'members') as Row[]) ?? []
  const ids = rows.map((r) => r.user_id as string)
  if (ids.length) await loadProfiles(ids)
  return rows.map((r) => ({ id: r.user_id as string, role: (r.role as string) ?? 'member' }))
}
export async function createPost(p: Omit<Post, 'id' | 'at' | 'likes' | 'comments' | 'shares' | 'authorId' | 'mine'>) {
  const images = await toPaths(p.images ?? [], 'posts')
  const row = must(await S().from('posts').insert({
    tag: p.tag, body: p.text, images, product_ids: (p.productIds ?? []).filter(R), prompt: p.prompt ?? null, code: p.code ?? null,
    room_id: p.roomId ?? null, hire_button: !!p.hireButton, feeling: p.feeling ?? null,
    ...(p.audience && p.audience !== 'public' ? { audience: p.audience } : {}),
    ...(p.location ? { location: p.location.slice(0, 80) } : {}),
    ...(p.alt?.some(Boolean) ? { alt_texts: p.alt.map((a) => (a ?? '').slice(0, 300)) } : {}),
    ...(p.commentsOff ? { comments_off: true } : {}), ...(p.hideLikes ? { hide_likes: true } : {}),
  }).select('id').single(), 'post') as Row
  await saveMentions('post', row.id, p.text, p.mentions)
  const tags = (p.tagged ?? []).filter((m) => R(m.id) && m.id !== ME).slice(0, 20)
  // Photo tags: the server checks the tagged person's “who can tag me” setting and blocks (mentions_privacy trigger).
  for (const m of tags) {
    const r = await S().from('mentions').insert({ source_kind: 'post_tag', source_id: row.id, mentioned_id: m.id, name: m.name.slice(0, 60) })
    if (r.error) toast(`แท็ก ${m.name} ไม่ได้ (เขาตั้งค่าไม่ให้แท็ก)`)
  }
  await hydrate()
  return row.id as string
}
export async function editPost(id: string, patch: { text?: string; tag?: PostTag }) {
  must(await S().from('posts').update({ ...(patch.text != null ? { body: patch.text } : {}), ...(patch.tag ? { tag: patch.tag } : {}) }).eq('id', id).eq('author_id', ME), 'edit post')
  update((d) => { const p = d.posts.find((x) => x.id === id); if (p) { if (patch.text != null) p.text = patch.text; if (patch.tag) p.tag = patch.tag } })
}
export async function deletePost(id: string) {
  must(await S().from('posts').delete().eq('id', id).eq('author_id', ME), 'delete post')
  update((d) => { d.posts = d.posts.filter((x) => x.id !== id); d.comments = d.comments.filter((c) => c.postId !== id) })
}
export async function editComment(id: string, text: string) {
  must(await S().from('comments').update({ body: text }).eq('id', id).eq('author_id', ME), 'edit comment')
  update((d) => { const c = d.comments.find((x) => x.id === id); if (c) c.text = text })
}
export async function deleteComment(id: string) {
  must(await S().from('comments').delete().eq('id', id).eq('author_id', ME), 'delete comment')
  update((d) => {
    const c = d.comments.find((x) => x.id === id)
    d.comments = d.comments.filter((x) => x.id !== id)
    const p = c && d.posts.find((x) => x.id === c.postId); if (p) p.comments = Math.max(0, p.comments - 1)
  })
}
export async function joinRoom(roomId: string) {
  const db = getDb()
  if ((db.invites ?? []).some((x) => x.roomId === roomId)) { await acceptInvite(roomId); return true }
  const leaving = db.joined.includes(roomId) || (db.requested ?? []).includes(roomId)
  update((d) => {
    d.joined = d.joined.filter((x) => x !== roomId); d.requested = (d.requested ?? []).filter((x) => x !== roomId)
    if (!leaving) d.joined = [...d.joined, roomId]
  })
  if (leaving) { await soft(S().from('room_members').delete().eq('user_id', ME).eq('room_id', roomId)); return false }
  // the server decides: public group → joined, private → requested
  const r = await S().from('room_members').insert({ room_id: roomId }).select('status').single()
  if (r.error) { console.warn('[lumi cloud]', r.error.message); return true }
  if ((r.data as Row)?.status === 'requested') update((d) => { d.joined = d.joined.filter((x) => x !== roomId); d.requested = [...(d.requested ?? []), roomId] })
  return (r.data as Row)?.status !== 'requested'
}

// ---------- notifications
export async function readNotif(id: string) {
  update((d) => { const n = d.notifs.find((x) => x.id === id); if (n) n.read = true })
  await soft(S().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id))
}
export async function readAllNotifs() {
  update((d) => { d.notifs.forEach((n) => { n.read = true }) })
  await soft(S().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', ME).is('read_at', null))
}

// ---------- chat
export async function openChat(partnerId: string, productId?: string) {
  const id = must(await S().rpc('open_chat', { p_partner: partnerId, p_product: productId && R(productId) ? productId : null }), 'open chat') as string
  await refreshChats()
  return id
}
export async function sendText(threadId: string, text: string) {
  must(await S().from('messages').insert({ thread_id: threadId, kind: 'text', body: text }), 'send')
  await refreshChats()
}
export async function sendCard(threadId: string, msg: Omit<Message, 'id' | 'at' | 'from'>) {
  const c = S()
  const jobId = getDb().threads.find((t) => t.id === threadId)?.jobId
  if (msg.kind === 'offer') {
    if (!jobId) throw new Error('ส่งใบเสนอราคาได้ในแชตงานจ้างเท่านั้น')
    must(await c.from('offers').insert({ job_id: jobId, title: msg.title ?? 'ใบเสนอราคา', amount: msg.amount ?? 0, items: msg.items ?? [] }), 'offer')
  } else if (msg.kind === 'product') {
    must(await c.from('messages').insert({ thread_id: threadId, kind: 'product', payload: { product_id: msg.productId } }), 'product card')
  } else if (msg.kind === 'sticker') {
    must(await c.from('messages').insert({ thread_id: threadId, kind: 'sticker', body: msg.text ?? null, payload: { sticker: msg.image ?? null } }), 'sticker')
  } else if (msg.kind === 'progress' || msg.kind === 'delivery') {
    const image = msg.image ? await uploadPreview(msg.image, 'chat') : null
    must(await c.from('messages').insert({ thread_id: threadId, kind: msg.kind, body: msg.text ?? null, payload: { title: msg.title, image, pct: msg.pct, round: msg.round } }), msg.kind)
    if (msg.kind === 'delivery' && jobId) await soft(c.from('hire_jobs').update({ status: 'delivered' }).eq('id', jobId))
  } else {
    // file cards: the bytes go through private storage (product_files); this posts the visible card
    must(await c.from('messages').insert({ thread_id: threadId, kind: msg.kind === 'file' ? 'file' : 'text', body: msg.text ?? msg.fileName ?? null, payload: { name: msg.fileName, size: msg.size } }), 'card')
  }
  await refreshChats()
}
export async function sendBrief(creatorId: string, productId: string, brief: string[], pkg: string) {
  const id = must(await S().rpc('start_hire', { p_creator: creatorId, p_product: productId, p_brief: brief, p_package: pkg }), 'brief') as string
  await refreshChats()
  return id
}
const offerOf = (threadId: string, msgId: string) => getDb().messages[threadId]?.find((m) => m.id === msgId)?.offerId
export async function acceptOffer(threadId: string, msgId: string) {
  const id = offerOf(threadId, msgId)
  if (!id) throw new Error('ไม่พบใบเสนอราคา')
  must(await S().from('offers').update({ status: 'accepted' }).eq('id', id), 'accept offer')
  await refreshChats()
}
async function jobTo(threadId: string, status: string, what: string) {
  const jobId = getDb().threads.find((t) => t.id === threadId)?.jobId
  if (!jobId) throw new Error('ไม่พบงานจ้างนี้')
  must(await S().from('hire_jobs').update({ status }).eq('id', jobId), what)
}
export async function acceptDelivery(threadId: string, stars: number, text: string) {
  await jobTo(threadId, 'completed', 'accept delivery')
  const jobId = getDb().threads.find((t) => t.id === threadId)?.jobId
  if (stars) await soft(S().from('reviews').insert({ job_id: jobId, stars, body: text || null }))
  await hydrate()
}
export async function requestRevision(threadId: string, note: string) {
  must(await S().from('messages').insert({ thread_id: threadId, kind: 'text', body: `ขอแก้ไข: ${note}` }), 'note')
  await jobTo(threadId, 'revision', 'revision')
  await refreshChats()
}
export async function markRead(threadId: string) {
  update((d) => { const t = d.threads.find((x) => x.id === threadId); if (t) t.unread = 0 })
  await soft(S().from('chat_thread_state').update({ last_read_at: new Date().toISOString() }).eq('thread_id', threadId).eq('user_id', ME))
}
export async function setFlag(threadId: string, flag: 'pinned' | 'muted') {
  const t = getDb().threads.find((x) => x.id === threadId)
  const v = !t?.[flag]
  update((d) => { const x = d.threads.find((y) => y.id === threadId); if (x) x[flag] = v })
  await soft(S().from('chat_thread_state').update({ [flag]: v }).eq('thread_id', threadId).eq('user_id', ME))
}

// ---------- orders, refunds, reviews
export const checkout = (items: CartItem[], method: string, coupon?: string) => checkoutCloud(items, method, coupon)
export async function reportIssue(purchaseId: string | undefined, threadId: string | undefined, reason: string, note: string) {
  const b = purchaseId ? getDb().purchases.find((x) => x.id === purchaseId) : undefined
  if (b?.orderItemId) must(await S().from('refund_requests').insert({ order_item_id: b.orderItemId, reason: reason.slice(0, 120), note: note.slice(0, 1000) }), 'refund request')
  else if (threadId && R(threadId)) must(await S().from('refund_requests').insert({ thread_id: threadId, reason: reason.slice(0, 120), note: note.slice(0, 1000) }), 'hire issue')
  else throw new Error('ไม่พบรายการนี้')
  await hydrate()
}
export async function writeReview(purchaseId: string, stars: number, text: string) {
  const b = getDb().purchases.find((x) => x.id === purchaseId)
  if (!b) return
  if (b.reviewId) must(await S().from('reviews').update({ stars, body: text || null }).eq('id', b.reviewId), 'edit review')
  else must(await S().from('reviews').insert({ product_id: b.productId, stars, body: text || null }), 'review')
  await hydrate()
}
/** Creator answers a refund request on one of their sales. refund=true refunds (test) and closes download access at once. */
export async function answerRefund(refundId: string, refund: boolean, note?: string) {
  must(await S().rpc('answer_refund', { p_id: refundId, p_refund: refund, p_note: note ?? null }), 'answer refund')
  await refreshSales()
}
export async function replyReview(reviewId: string, text: string) {
  must(await S().rpc('reply_review', { p_review: reviewId, p_text: text }), 'reply')
  update((d) => {
    for (const list of Object.values(d.cloudReviews ?? {})) { const r = list.find((x) => x.id === reviewId); if (r) r.reply = text.trim() || undefined }
  })
}
export const downloadUrl = (assetValue: string) => signedFileUrl(assetValue.replace(/^cloud:/, ''))

// ---------- stories (24 h)
export interface StoryInput { file: Blob; kind: 'image' | 'video'; caption: string; productId?: string; linkLabel?: StoryLinkLabel; overlays?: StoryOverlay[]; durationMs?: number; mentions?: Mention[]; audience?: 'public' | 'close_friends'; allowReplies?: 'everyone' | 'following' | 'off' }
export async function postStory(x: StoryInput) {
  const path = await uploadPreview(x.file, 'stories', x.kind === 'video' ? (x.file.type.includes('webm') ? 'story.webm' : x.file.type.includes('quicktime') ? 'story.mov' : 'story.mp4') : 'story.jpg')
  const product = x.productId && R(x.productId) ? x.productId : null
  const row = must(await S().from('stories').insert({
    media_path: path, media_kind: x.kind, caption: x.caption.slice(0, 200), product_id: product,
    link_label: product ? (x.linkLabel ?? 'ดูสินค้า') : null, overlays: (x.overlays ?? []).slice(0, 30), duration_ms: x.durationMs ? Math.min(60000, Math.max(500, Math.round(x.durationMs))) : null,
    ...(x.audience === 'close_friends' ? { audience: 'close_friends' } : {}), ...(x.allowReplies && x.allowReplies !== 'everyone' ? { allow_replies: x.allowReplies } : {}),
  }).select('*').single(), 'story') as Row
  const names = (x.mentions ?? []).map((m) => '@' + m.name).join(' ')
  await saveMentions('story', row.id, names, x.mentions)
  update((d) => { d.stories = [toStory(row), ...(d.stories ?? [])] })
}
/** My emoji on someone's story (one per person; null removes). */
export async function reactStory(id: string, emoji: string | null) {
  update((d) => { d.storyReactions = { ...(d.storyReactions ?? {}) }; if (emoji) d.storyReactions[id] = emoji; else delete d.storyReactions[id] })
  if (!emoji) return soft(S().from('story_reactions').delete().eq('story_id', id).eq('user_id', ME))
  await soft(S().from('story_reactions').upsert({ story_id: id, emoji } as Row, { onConflict: 'story_id,user_id' }))
}
/** Reply to a story: a chat message that points at the story. */
export async function replyStory(id: string, authorId: string, text: string) {
  const thread = await openChat(authorId)
  must(await S().from('messages').insert({ thread_id: thread, kind: 'text', body: text, story_id: id } as Row), 'story reply')
  await refreshChats()
  return thread
}
export async function storyLinkClicked(id: string) {
  await soft(S().from('story_views').update({ clicked_link: true }).eq('story_id', id).eq('viewer_id', ME))
}
/** Viewers, emoji and replies on my own stories (the server shows them only to the author, 48 h). */
export async function storyActivity(ids: string[]): Promise<Record<string, StoryActivity[]>> {
  const out: Record<string, StoryActivity[]> = {}
  const live = ids.filter(R); if (!live.length) return out
  const [v, rx, rp] = await Promise.all([
    S().from('story_views').select('story_id, viewer_id, created_at, clicked_link').in('story_id', live).limit(500),
    S().from('story_reactions').select('story_id, user_id, emoji, created_at').in('story_id', live).limit(500),
    S().from('messages').select('story_id, sender_id').in('story_id', live).limit(500),
  ])
  const add = (sid: string, uid: string) => { const l = (out[sid] ??= []); let a = l.find((x) => x.userId === uid); if (!a) { a = { userId: uid, at: 0 }; l.push(a) } return a }
  for (const r of (v.data ?? []) as Row[]) { if (r.viewer_id === ME) continue; const a = add(r.story_id, r.viewer_id); a.at = Math.max(a.at, Date.parse(r.created_at)); a.clicked = a.clicked || !!r.clicked_link }
  for (const r of (rx.data ?? []) as Row[]) { const a = add(r.story_id, r.user_id); a.emoji = r.emoji; a.at = Math.max(a.at, Date.parse(r.created_at)) }
  for (const r of (rp.data ?? []) as Row[]) { if (r.sender_id === ME) continue; add(r.story_id, r.sender_id).replied = true }
  const people = [...new Set(Object.values(out).flat().map((a) => a.userId))]
  if (people.length) await loadProfiles(people)
  return out
}
export async function deleteStory(id: string) {
  const gone = must(await S().from('stories').delete().eq('id', id).eq('author_id', ME).select('media_path'), 'delete story') as Row[]
  // the picture/video lives in the public previews bucket — remove it too so a deleted story is really gone
  const paths = gone.map((r) => r.media_path as string).filter((x) => typeof x === 'string' && x.startsWith(ME + '/'))
  if (paths.length) await S().storage.from('previews').remove(paths).catch(() => {})
  update((d) => { d.stories = (d.stories ?? []).filter((x) => x.id !== id) })
}
export async function viewStory(id: string) { await soft(S().from('story_views').insert({ story_id: id })) }

// ---------- account
export async function saveProfile(patch: Partial<Pick<Profile, 'display_name' | 'handle' | 'bio'>> & { avatar?: Blob | string }) {
  const { avatar, ...rest } = patch
  const row: Row = { ...rest }
  if (avatar) row.avatar_path = await uploadPreview(avatar, 'avatar', 'avatar.jpg')
  const p = must(await S().from('profiles').update(row).eq('id', ME).select('*').single(), 'profile') as Profile
  setProfile(p)
  await hydrate()
  return p
}
export async function becomeCreator(name?: string, handle?: string, bio?: string) {
  must(await S().from('profiles').update({ is_creator: true, mode: 'creator', ...(name ? { display_name: name } : {}), ...(handle ? { handle } : {}), ...(bio != null ? { bio } : {}) }).eq('id', ME), 'creator')
  await hydrate()
}
export async function changeEmail(email: string) { const r = await S().auth.updateUser({ email }); if (r.error) throw new Error(thaiError(r.error.message)) }
export async function changePassword(password: string) { const r = await S().auth.updateUser({ password }); if (r.error) throw new Error(thaiError(r.error.message)) }
export async function requestAccountDeletion(reason: string) {
  must(await S().from('account_requests').insert({ kind: 'delete', reason: reason.slice(0, 500) }), 'delete request')
  toast(`ส่งคำขอลบบัญชีแล้ว · ทีม ${BRAND} จะดำเนินการภายใน 30 วัน`)
}
export async function cancelAccountDeletion() { must(await S().from('account_requests').delete().eq('user_id', ME).eq('status', 'open'), 'cancel request') }
export async function myAccountRequests() { return (must(await S().from('account_requests').select('*').order('created_at', { ascending: false }), 'requests') as Row[]) }
