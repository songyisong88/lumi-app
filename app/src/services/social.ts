// IG/FB-style options: post menu, story settings, privacy, blocks, close friends, likers, activity status.
// Real accounts: Supabase (migration 0035; RLS + triggers enforce every rule server-side). Demo persona: local store.
import { useEffect, useState } from 'react'
import type { Audience, BlockKind, Post, PrivacySettings, Who } from '../data/appTypes'
import { ME, isRemoteId } from '../data/sampleData'
import { client as S, cloudOn, loadProfiles, must } from './cloud'
import { getDb, update, useDb } from './db'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const live = (...ids: (string | undefined)[]) => cloudOn() && ids.every((id) => !id || isRemoteId(id))
export const DEFAULT_PRIVACY: PrivacySettings = { isPrivate: false, activity: true, comments: 'everyone', tags: 'everyone', mentions: 'everyone', storyReplies: 'everyone', hiddenWords: [] }

export interface PostOptions { audience?: Audience; commentsOff?: boolean; hideLikes?: boolean; pinned?: boolean; archived?: boolean; alt?: string[]; location?: string; text?: string }
const COL: Record<string, string> = { audience: 'audience', commentsOff: 'comments_off', hideLikes: 'hide_likes', alt: 'alt_texts', location: 'location', text: 'body' }

export async function setPostOptions(id: string, o: PostOptions) {
  const now = Date.now()
  if (live(id)) {
    const row: Row = {}
    for (const [k, v] of Object.entries(o)) if (COL[k]) row[COL[k]] = k === 'location' ? (v || null) : v
    if (o.pinned != null) row.pinned_at = o.pinned ? new Date().toISOString() : null
    if (o.archived != null) row.archived_at = o.archived ? new Date().toISOString() : null
    must(await S().from('posts').update(row).eq('id', id).eq('author_id', ME), 'post options')
  } else if (o.pinned && getDb().posts.filter((p) => (p.authorId === ME || p.mine) && p.pinnedAt && p.id !== id).length >= 3) {
    throw new Error('ปักหมุดได้สูงสุด 3 โพสต์')
  }
  update((d) => {
    const p = d.posts.find((x) => x.id === id && (x.authorId === ME || x.mine)); if (!p) return
    if (o.audience) p.audience = o.audience
    if (o.commentsOff != null) p.commentsOff = o.commentsOff
    if (o.hideLikes != null) p.hideLikes = o.hideLikes
    if (o.alt) p.alt = o.alt
    if (o.location != null) p.location = o.location || undefined
    if (o.text != null) p.text = o.text
    if (o.pinned != null) p.pinnedAt = o.pinned ? now : undefined
    if (o.archived != null) p.archivedAt = o.archived ? now : undefined
  })
}
/** Columns from 0035 → Post fields (used by cloud.toPost). */
export function postOptsFrom(r: Row): Partial<Post> {
  return {
    audience: r.audience ?? 'public', commentsOff: !!r.comments_off, hideLikes: !!r.hide_likes,
    pinnedAt: r.pinned_at ? Date.parse(r.pinned_at) : undefined, archivedAt: r.archived_at ? Date.parse(r.archived_at) : undefined,
    alt: r.alt_texts ?? undefined, location: r.location ?? undefined,
  }
}
/** What the viewer may see of a post (mirrors the RLS rule, for the demo persona's local data). */
export function canSee(p: Post, viewer = ME) {
  const own = p.authorId === viewer || !!p.mine
  if (own) return true
  const d = getDb()
  if (p.archivedAt) return false
  if ((d.blocks ?? []).some((b) => b.id === p.authorId && b.kind !== 'restrict')) return false
  if (p.audience === 'only_me') return false
  if (p.audience === 'followers' && !d.follows.includes(p.authorId)) return false
  return true
}

// ---------- blocks / mutes / restricts
export async function setBlock(userId: string, kind: BlockKind | null) {
  if (live(userId)) {
    if (!kind) must(await S().from('user_blocks').delete().eq('user_id', ME).eq('target_id', userId), 'unblock')
    else {
      const u = must(await S().from('user_blocks').update({ kind }).eq('user_id', ME).eq('target_id', userId).select('kind'), 'block') as Row[]
      if (!u?.length) must(await S().from('user_blocks').insert({ target_id: userId, kind }), 'block')
    }
  }
  update((d) => {
    d.blocks = (d.blocks ?? []).filter((b) => b.id !== userId)
    if (kind) d.blocks.push({ id: userId, kind })
    if (kind === 'block') d.follows = d.follows.filter((x) => x !== userId)
  })
}
export async function loadBlocks() {
  if (!cloudOn()) return
  const rows = must(await S().from('user_blocks').select('target_id, kind').eq('user_id', ME), 'blocks') as Row[]
  await loadProfiles(rows.map((r) => r.target_id))
  update((d) => { d.blocks = rows.map((r) => ({ id: r.target_id, kind: r.kind })) })
}
export const blockOf = (id: string) => (getDb().blocks ?? []).find((b) => b.id === id)?.kind

// ---------- privacy settings
export async function loadPrivacy(): Promise<PrivacySettings> {
  if (!cloudOn()) return getDb().privacy ?? DEFAULT_PRIVACY
  const [ps, pr] = await Promise.all([
    S().from('privacy_settings').select('*').eq('id', ME).maybeSingle(),
    S().from('profiles').select('is_private').eq('id', ME).maybeSingle(),
  ])
  const r = (ps.data ?? {}) as Row
  const out: PrivacySettings = {
    isPrivate: !!(pr.data as Row | null)?.is_private, activity: r.activity_status ?? true,
    comments: r.allow_comments ?? 'everyone', tags: r.allow_tags ?? 'everyone', mentions: r.allow_mentions ?? 'everyone',
    storyReplies: getDb().privacy?.storyReplies ?? 'everyone', hiddenWords: r.hidden_words ?? [],
  }
  update((d) => { d.privacy = out })
  return out
}
export async function savePrivacy(p: PrivacySettings) {
  if (cloudOn()) {
    const row = { allow_comments: p.comments, allow_tags: p.tags, allow_mentions: p.mentions, hidden_words: p.hiddenWords.map((w) => w.trim()).filter(Boolean).slice(0, 200), activity_status: p.activity }
    const u = must(await S().from('privacy_settings').update(row).eq('id', ME).select('id'), 'privacy') as Row[]
    if (!u?.length) must(await S().from('privacy_settings').insert({ id: ME, ...row }), 'privacy')
    must(await S().from('profiles').update({ is_private: p.isPrivate }).eq('id', ME), 'private account')
  }
  update((d) => { d.privacy = p })
}

// ---------- close friends / hide story from
type ListName = 'closeFriends' | 'storyHide'
const TBL: Record<ListName, [string, string]> = { closeFriends: ['close_friends', 'friend_id'], storyHide: ['story_hide', 'target_id'] }
export async function loadList(l: ListName) {
  if (!cloudOn()) return getDb()[l] ?? []
  const [t, col] = TBL[l]
  const ids = ((must(await S().from(t).select(col).eq('user_id', ME), t) as Row[]) ?? []).map((r) => r[col] as string)
  await loadProfiles(ids)
  update((d) => { d[l] = ids })
  return ids
}
export async function toggleList(l: ListName, id: string, on: boolean) {
  if (live(id)) {
    const [t, col] = TBL[l]
    if (on) must(await S().from(t).insert({ [col]: id } as Row), t)
    else must(await S().from(t).delete().eq('user_id', ME).eq(col, id), t)
  }
  update((d) => { const s = new Set(d[l] ?? []); if (on) s.add(id); else s.delete(id); d[l] = [...s] })
}

// ---------- who liked (real people only; empty when the owner hid likes)
export interface Liker { id: string; kind: string; at: number }
export async function likers(postId: string): Promise<Liker[] | null> {
  if (!live(postId)) return null
  const rows = (must(await S().rpc('post_likers', { p_post: postId, p_limit: 200 }), 'likers') as Row[]) ?? []
  await loadProfiles(rows.map((r) => r.id))
  return rows.map((r) => ({ id: r.id, kind: r.kind, at: Date.parse(r.liked_at) }))
}

// ---------- story options
export async function setStoryOptions(id: string, o: { audience?: 'public' | 'close_friends'; allowReplies?: 'everyone' | 'following' | 'off' }) {
  if (live(id)) must(await S().from('stories').update({ ...(o.audience ? { audience: o.audience } : {}), ...(o.allowReplies ? { allow_replies: o.allowReplies } : {}) }).eq('id', id).eq('author_id', ME), 'story options')
  update((d) => { const s = d.stories?.find((x) => x.id === id); if (s) Object.assign(s, o) })
}
export async function addToHighlight(storyId: string, title: string, media: string, kind: 'image' | 'video') {
  if (live(storyId)) {
    let h = (must(await S().from('story_highlights').select('id').eq('user_id', ME).eq('title', title).limit(1), 'highlights') as Row[])[0]
    if (!h) h = must(await S().from('story_highlights').insert({ title }).select('id').single(), 'highlight') as Row
    const r = await S().from('story_highlight_items').insert({ highlight_id: h.id, story_id: storyId })
    if (r.error && r.error.code !== '23505') must(r, 'highlight item')
  }
  update((d) => {
    d.highlights = d.highlights ?? []
    let h = d.highlights.find((x) => x.title === title)
    if (!h) { h = { id: `h${Date.now()}`, title, items: [] }; d.highlights.push(h) }
    if (!h.items.some((i) => i.storyId === storyId)) h.items.push({ storyId, media, kind })
  })
}

// ---------- follow requests (private accounts)
export async function requestFollow(id: string) {
  if (live(id)) must(await S().from('follow_requests').insert({ target_id: id }), 'follow request')
}
export async function followRequests(): Promise<string[]> {
  if (!cloudOn()) return []
  const rows = (must(await S().from('follow_requests').select('requester_id').eq('target_id', ME), 'requests') as Row[]) ?? []
  await loadProfiles(rows.map((r) => r.requester_id))
  return rows.map((r) => r.requester_id)
}
export async function answerRequest(id: string, accept: boolean) {
  if (accept) must(await S().rpc('accept_follow_request', { p_requester: id }), 'accept')
  else must(await S().from('follow_requests').delete().eq('requester_id', id).eq('target_id', ME), 'decline')
}

// ---------- activity status ("ใช้งานอยู่")
let presence: Record<string, number> = {}
const subs = new Set<() => void>()
export async function refreshPresence(ids: string[]) {
  if (!cloudOn()) return
  const list = [...new Set(ids.filter(isRemoteId))].slice(0, 200)
  if (!list.length) return
  const r = await S().rpc('presence', { p_ids: list })
  const next: Record<string, number> = {}
  for (const x of ((r.data ?? []) as Row[])) if (x.online) next[x.id] = Date.parse(x.last_active_at)
  presence = next; subs.forEach((f) => f())
}
export function startPresence() {
  if (!cloudOn()) return () => {}
  const tick = () => { if (document.visibilityState === 'visible' && getDb().privacy?.activity !== false) void S().rpc('touch_presence') }
  tick()
  const t = setInterval(tick, 60_000)
  return () => clearInterval(t)
}
/** True when this person is active now (only real accounts, only when both sides share activity status). */
export function useOnline(id: string | undefined) {
  const [, f] = useState(0)
  useEffect(() => { const g = () => f((x) => x + 1); subs.add(g); return () => { subs.delete(g) } }, [])
  return !!id && !!presence[id]
}
export const who = (w: Who) => ({ everyone: 'ทุกคน', followers: 'คนที่ติดตามคุณ', following: 'คนที่คุณติดตาม', off: 'ปิด' }[w])
export const AUDIENCE: Record<Audience, { l: string; sub: string; icon: string }> = {
  public: { l: 'สาธารณะ', sub: 'ทุกคนเห็นได้', icon: 'globe' },
  followers: { l: 'ผู้ติดตาม', sub: 'เฉพาะคนที่ติดตามคุณ', icon: 'users' },
  close_friends: { l: 'เพื่อนสนิท', sub: 'เฉพาะรายชื่อเพื่อนสนิท', icon: 'star' },
  only_me: { l: 'เฉพาะฉัน', sub: 'คนอื่นไม่เห็น', icon: 'lock' },
}
export { useDb }
