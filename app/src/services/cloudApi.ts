/**
 * Supabase versions of the api.ts services. api.ts routes a call here only when a real account is
 * signed in (FEATURES.accounts on + session mode 'cloud') AND the target is a server row (uuid).
 * Sample data (non-uuid ids) keeps the local demo behaviour, so the approved demo never changes.
 */
import type { CartItem, Message, Post, PostTag } from '../data/appTypes'
import { ME, isRemoteId } from '../data/sampleData'
import { getDb, update } from './db'
import { client as S, must, hydrate, refreshChats, refreshSales, toast, uploadPreview, toPaths, toStory, signedFileUrl, checkoutCloud, thaiError } from './cloud'
import { setProfile, type Profile } from './session'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const R = isRemoteId
const soft = (p: PromiseLike<{ error: { message: string } | null }>) => Promise.resolve(p).then((r) => { if (r.error) console.warn('[lumi cloud]', r.error.message) })

// ---------- follows / community
export async function toggleFollow(id: string) {
  const on = !getDb().follows.includes(id)
  update((d) => { d.follows = on ? [id, ...d.follows] : d.follows.filter((x) => x !== id) })
  if (on) must(await S().from('follows').insert({ creator_id: id }), 'follow')
  else must(await S().from('follows').delete().eq('follower_id', ME).eq('creator_id', id), 'unfollow')
  return on
}
async function toggleRow(table: string, col: string, id: string, list: 'liked' | 'saved' | 'likedComments') {
  const was = getDb()[list].includes(id)
  update((d) => {
    d[list] = was ? d[list].filter((x) => x !== id) : [...d[list], id]
    if (list === 'liked') { const p = d.posts.find((x) => x.id === id); if (p) p.likes += was ? -1 : 1 }
    if (list === 'likedComments') { const c = d.comments.find((x) => x.id === id); if (c) c.likes += was ? -1 : 1 }
  })
  if (was) must(await S().from(table).delete().eq('user_id', ME).eq(col, id), table)
  else must(await S().from(table).insert({ [col]: id } as Row), table)
}
export const likePost = (id: string) => toggleRow('post_likes', 'post_id', id, 'liked')
export const savePost = (id: string) => toggleRow('post_saves', 'post_id', id, 'saved')
export const likeComment = (id: string) => toggleRow('comment_likes', 'comment_id', id, 'likedComments')
export async function addComment(postId: string, text: string, replyTo?: string) {
  must(await S().from('comments').insert({ post_id: postId, body: text, reply_to: replyTo && R(replyTo) ? replyTo : null }), 'comment')
  await hydrate()
}
export async function createPost(p: Omit<Post, 'id' | 'at' | 'likes' | 'comments' | 'shares' | 'authorId' | 'mine'>) {
  const images = await toPaths(p.images ?? [], 'posts')
  const row = must(await S().from('posts').insert({
    tag: p.tag, body: p.text, images, product_ids: (p.productIds ?? []).filter(R), prompt: p.prompt ?? null, code: p.code ?? null,
    room_id: p.roomId ?? null, hire_button: !!p.hireButton,
  }).select('id').single(), 'post') as Row
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
  const joined = !getDb().joined.includes(roomId)
  update((d) => { d.joined = joined ? [...d.joined, roomId] : d.joined.filter((x) => x !== roomId) })
  await soft(joined ? S().from('room_members').insert({ room_id: roomId }) : S().from('room_members').delete().eq('user_id', ME).eq('room_id', roomId))
  return joined
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
export async function postStory(file: Blob, kind: 'image' | 'video', caption: string, productId?: string) {
  const path = await uploadPreview(file, 'stories', kind === 'video' ? 'story.mp4' : 'story.jpg')
  const row = must(await S().from('stories').insert({ media_path: path, media_kind: kind, caption: caption.slice(0, 200), product_id: productId && R(productId) ? productId : null }).select('*').single(), 'story') as Row
  update((d) => { d.stories = [toStory(row), ...(d.stories ?? [])] })
}
export async function deleteStory(id: string) {
  must(await S().from('stories').delete().eq('id', id).eq('author_id', ME), 'delete story')
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
  toast('ส่งคำขอลบบัญชีแล้ว · ทีม LUMI จะดำเนินการภายใน 30 วัน')
}
export async function cancelAccountDeletion() { must(await S().from('account_requests').delete().eq('user_id', ME).eq('status', 'open'), 'cancel request') }
export async function myAccountRequests() { return (must(await S().from('account_requests').select('*').order('created_at', { ascending: false }), 'requests') as Row[]) }
