import { REAL } from '../config'
import type { DB, UserStory } from '../data/appTypes'
import { ME, STORIES, productById } from '../data/sampleData'
import type { Story } from '../data/types'
import { ago } from '../utils/time'

const slideOf = (st: UserStory) => ({
  productId: st.productId && productById(st.productId) ? st.productId : undefined, postedAgo: ago(st.at), media: st.media, kind: st.kind, caption: st.caption,
  storyId: st.id, linkLabel: st.linkLabel, overlays: st.overlays, durationMs: st.durationMs, at: st.at, expires: st.expires,
})

/** Stories on the home row and in the viewer, one group per author, oldest slide first.
 *  Real site: the unexpired stories people posted (server). Demo site: the sample stories plus the ones
 *  the demo persona posted in this browser (24 h). */
export function storyGroups(db: DB): Story[] {
  const now = Date.now()
  const live = [...(db.stories ?? [])].filter((x) => x.expires > now).sort((a, b) => a.at - b.at)
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
  return [...mine, ...STORIES.filter((g) => !mine.length || g.creatorId !== ME)]
}
/** My own live stories (newest last). */
export const myStories = (db: DB) => storyGroups(db).find((g) => g.creatorId === ME)
