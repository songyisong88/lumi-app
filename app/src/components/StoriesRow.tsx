import { Link } from 'react-router-dom'
import { creatorById, imgUrl } from '../data/sampleData'
import { useDb } from '../services/db'
import { storyGroups } from '../services/storyGroups'
import { getSeenStories } from '../services/seenStories'
import { Icon } from './Icon'
import s from './StoriesRow.module.css'

/** Creator stories. No section title by design (approved home page). */
export function StoriesRow() {
  const seen = getSeenStories()
  const STORIES = storyGroups(useDb())
  // unseen first, like Instagram
  const list = [...STORIES].sort((a, b) => Number(seen.includes(a.creatorId)) - Number(seen.includes(b.creatorId)))
  return (
    <div className={`hscroll ${s.row}`}>
      <Link to="/sell" className={s.st}>
        <span className={`${s.ring} ${s.seen}`}><span className={s.add}><Icon name="plus" size={24} color="#6C2BD9" stroke={2.4} /></span></span>
        <span className={s.name}>ลงขาย</span>
      </Link>
      {list.map((st) => {
        const c = creatorById(st.creatorId)
        const isSeen = seen.includes(st.creatorId)
        return (
          <Link key={st.creatorId} to={`/story/${st.creatorId}`} className={s.st}>
            <span className={`${s.ring} ${isSeen ? s.seen : ''}`}><span className={s.pic} style={{ backgroundImage: `url(${imgUrl(c.avatar)})` }} /></span>
            <span className={s.name}>{c.name}</span>
          </Link>
        )
      })}
    </div>
  )
}
