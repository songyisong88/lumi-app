import type { Post, ReactKind } from '../data/appTypes'

/** The 6 reactions (long-press “ถูกใจ”). Same set and order as the approved mockup. */
export const REACTIONS: { k: ReactKind; e: string; l: string; c: string }[] = [
  { k: 'like', e: '❤️', l: 'ถูกใจ', c: '#E8457E' }, { k: 'love', e: '😍', l: 'ชอบมาก', c: '#E8457E' },
  { k: 'haha', e: '😆', l: 'ฮา', c: '#D97706' }, { k: 'wow', e: '😮', l: 'ว้าว', c: '#D97706' },
  { k: 'fire', e: '🔥', l: 'ปังมาก', c: '#EA580C' }, { k: 'idea', e: '💡', l: 'มีประโยชน์', c: '#B45309' },
]
export const rxOf = (k?: ReactKind) => REACTIONS.find((r) => r.k === k)
/** Top emojis by count (at most n), my own reaction first. */
export function topRx(rx: Post['rx'], mine?: ReactKind, n = 3) {
  const list = REACTIONS.filter((r) => (rx?.[r.k] ?? 0) > 0).sort((a, b) => (rx![b.k] ?? 0) - (rx![a.k] ?? 0))
  if (mine) { const m = rxOf(mine)!; return [m, ...list.filter((r) => r.k !== mine)].slice(0, n) }
  return list.slice(0, n)
}
export const fmtN = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n))
/** Story quick reactions (server story_reactions allows these). */
export const STORY_EMOJI = ['😍', '😆', '😮', '🔥', '👏', '🙏']
