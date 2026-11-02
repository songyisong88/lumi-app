import { REAL } from '../config'
import type { DB } from '../data/appTypes'
import { STORIES, productById } from '../data/sampleData'
import type { Story } from '../data/types'
import { ago } from '../utils/time'

/** Stories on the home row and in the viewer: the sample stories on the demo site; on the real site the
 *  unexpired stories people posted (server), one group per author, oldest slide first. */
export function storyGroups(db: DB): Story[] {
  if (!REAL) return STORIES
  const now = Date.now()
  const map = new Map<string, Story>()
  for (const st of [...(db.stories ?? [])].filter((x) => x.expires > now).sort((a, b) => a.at - b.at)) {
    let g = map.get(st.authorId)
    if (!g) { g = { creatorId: st.authorId, slides: [] }; map.set(st.authorId, g) }
    g.slides.push({ productId: st.productId && productById(st.productId) ? st.productId : undefined, postedAgo: ago(st.at), media: st.media, kind: st.kind, caption: st.caption })
  }
  return [...map.values()].reverse()
}
