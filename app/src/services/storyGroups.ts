import { REAL } from '../config'
import type { DB, UserStory } from '../data/appTypes'
import { ME, STORIES, productById } from '../data/sampleData'
import type { Story } from '../data/types'
import { ago } from '../utils/time'
import { getSeenStories } from './seenStories'

const slideOf = (st: UserStory) => ({
  productId: st.productId && productById(st.productId) ? st.productId : undefined, postedAgo: ago(st.at), media: st.media, kind: st.kind, caption: st.caption,
  storyId: st.id, linkLabel: st.linkLabel, overlays: st.overlays, durationMs: st.durationMs, at: st.at, expires: st.expires, audience: st.audience, allowReplies: st.allowReplies,
})

/** Stories on the home row and in the viewer, one group per author, oldest slide first.
 *  Real site: the unexpired stories people posted (server). Demo site: the sample stories plus the ones
 *  the demo persona posted in this browser (24 h). */
export function storyGroups(db: DB): Story[] {
  const now = Date.now()
  const off = new Set((db.blocks ?? []).filter((b) => b.kind !== 'restrict').map((b) => b.id))
  const live = [...(db.stories ?? [])].filter((x) => x.expires > now && !off.has(x.authorId)).sort((a, b) => a.at - b.at)
  const map = new Map<string, Story>()
  for (const st of live) {
    let g = map.get(st.authorId)
    if (!g) { g = { creatorId: st.authorId, slides: [] }; map.set(st.authorId, g) }
    g.slides.push(slideOf(st))
  }
  const real = [...map.values()].reverse()
  if (REAL) return real
  const mine = real.filter((g) => g.creatorId === ME)
  // the sample persona's sample story is replaced by what it really posted here
  return [...mine, ...STORIES.filter((g) => (!mine.length || g.creatorId !== ME) && !off.has(g.creatorId))]
}
/** My own live stories (newest last). */
export const myStories = (db: DB) => storyGroups(db).find((g) => g.creatorId === ME)
/** The order of the home story row — yours first, then people with something new, then the ones already watched.
 *  The viewer moves to the next person in this same order (like Instagram), so it never jumps around the row. */
export function ringOrder(db: DB, seen: string[] = getSeenStories()): Story[] {
  const all = storyGroups(db)
  const mine = all.filter((g) => g.creatorId === ME)
  const rest = all.filter((g) => g.creatorId !== ME).sort((a, b) => Number(seen.includes(a.creatorId)) - Number(seen.includes(b.creatorId)))
  return [...mine, ...rest]
}
