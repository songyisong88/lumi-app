import { Link } from 'react-router-dom'
import { ME, creatorById, imgUrl } from '../data/sampleData'
import { useDb } from '../services/db'
import { ringOrder } from '../services/storyGroups'
import { getSeenStories } from '../services/seenStories'
import { Icon } from './Icon'
import { rememberOrigin } from '../services/motion'
import s from '../social/Social.module.css'

/** Instagram-style story rings. “สตอรี่ของคุณ” first: ring → my story, + → make one. Unseen first. */
export function StoriesRow() {
  const db = useDb()
  const seen = getSeenStories()
  const all = ringOrder(db, seen)
  const mine = all.find((g) => g.creatorId === ME)
  const list = all.filter((g) => g.creatorId !== ME)
  const me = creatorById(ME)
  return (
    <div className={`hscroll ${s.ringRow}`} role="list" aria-label="สตอรี่">
      <span className={`${s.rg} ${mine ? '' : s.me}`} role="listitem">
        <Link to={mine ? `/story/${ME}` : '/story/new'} aria-label={mine ? 'ดูสตอรี่ของคุณ' : 'สร้างสตอรี่'} style={{ display: 'block' }} onClick={(e) => mine && rememberOrigin(`s:${ME}`, e.currentTarget.querySelector('[data-zoom]'))}>
          <span><span className={s.pic} data-zoom={`s:${ME}`} style={{ backgroundImage: `url(${imgUrl(me.avatar)})` }} /></span>
        </Link>
        <Link to="/story/new" className={s.add} aria-label="เพิ่มสตอรี่" style={{ position: 'absolute', right: 0, top: 46 }}><Icon name="plus" size={13} color="#fff" stroke={3} /></Link>
        <b>สตอรี่ของคุณ</b>
      </span>
      {list.map((g) => {
        const c = creatorById(g.creatorId)
        return (
          <Link key={g.creatorId} to={`/story/${g.creatorId}`} className={`${s.rg} ${seen.includes(g.creatorId) ? s.seen : ''}`} role="listitem" onClick={(e) => rememberOrigin(`s:${g.creatorId}`, e.currentTarget.querySelector('[data-zoom]'))}>
            <span><span className={s.pic} data-zoom={`s:${g.creatorId}`} style={{ backgroundImage: `url(${imgUrl(c.avatar)})` }} /></span><b>{c.name}</b>
          </Link>
        )
      })}
    </div>
  )
}
