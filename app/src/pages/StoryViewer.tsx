import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FollowButton } from '../components/FollowButton'
import { HeartButton } from '../components/HeartButton'
import { copyText } from '../components/ui'
import { toast } from '../services/toast'
import { Icon } from '../components/Icon'
import { creatorById, formatPrice, imgUrl, productById } from '../data/sampleData'
import { useDb } from '../services/db'
import { storyGroups } from '../services/storyGroups'
import { markStorySeen } from '../services/seenStories'
import { typeOf } from '../data/listingSpec'
import s from './StoryViewer.module.css'

const DURATION = 5000

export function StoryViewer() {
  const { creatorId = '' } = useParams()
  const nav = useNavigate()
  const STORIES = storyGroups(useDb())
  const idx = STORIES.findIndex((x) => x.creatorId === creatorId)
  const story = STORIES[idx]
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => { setSlide(0) }, [creatorId])
  useEffect(() => { if (story) markStorySeen(story.creatorId) }, [story])

  const next = () => {
    if (!story) return
    if (slide < story.slides.length - 1) setSlide(slide + 1)
    else if (idx < STORIES.length - 1) nav(`/story/${STORIES[idx + 1].creatorId}`, { replace: true })
    else close()
  }
  const close = () => { if (window.history.state?.idx > 0) nav(-1); else nav('/', { replace: true }) }
  const prev = () => {
    if (slide > 0) setSlide(slide - 1)
    else if (idx > 0) nav(`/story/${STORIES[idx - 1].creatorId}`, { replace: true })
    else setRound((r) => r + 1) // first slide of the first story: replay it from the start
  }

  useEffect(() => {
    if (paused || !story) return
    const t = setTimeout(next, DURATION)
    return () => clearTimeout(t)
  })

  if (!story) return <Navigate to="/" replace />
  const c = creatorById(story.creatorId)
  const sl = story.slides[slide]
  const p = sl.productId ? productById(sl.productId) : undefined
  // a real story shows its own picture; a sample story shows the work's picture
  const bg = sl.media && sl.kind !== 'video' ? imgUrl(sl.media) : p?.image ? imgUrl(p.image.src) : undefined

  return (
    <div className={s.scrim}>
      <div className={s.svw} style={{ background: bg ? `#16132B url(${bg}) center/cover` : p?.gradient ?? '#16132B' }}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        {sl.media && sl.kind === 'video' && <video src={sl.media} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div className={s.shade} />
        <div className={s.bars}>
          {story.slides.map((_, i) => (
            <i key={i}><b className={i < slide ? s.full : i === slide ? s.run : ''} style={i === slide ? { animationDuration: `${DURATION}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined} key={`${creatorId}-${slide}-${round}`} /></i>
          ))}
        </div>
        <div className={s.head}>
          <span className="av" style={{ width: 36, height: 36, border: '2px solid #fff', backgroundImage: `url(${imgUrl(c.avatar)})` }} />
          <div><div className={s.name}>{c.name}</div><div className={s.ago}>{p ? 'ผลงานใหม่ · ' : ''}{sl.postedAgo}</div></div>
          <FollowButton id={c.id} className={s.follow} onClass={s.followOn} />
          <button className={s.x} aria-label="ปิด" onClick={close}><Icon name="x" size={22} color="#fff" stroke={2.2} /></button>
        </div>
        <button className={`${s.tap} ${s.left}`} onClick={prev} aria-label="ก่อนหน้า" />
        <button className={`${s.tap} ${s.right}`} onClick={next} aria-label="ถัดไป" />
        {p ? <><div className={s.pc}>
          <span className={s.th} style={{ background: bg ? `url(${bg}) center/cover` : p.gradient }} />
          <div className={s.pi}>
            <div className={s.pt}>{p.title}</div>
            <div className={s.pu}>{p.use}</div>
            <div className={s.pp}>{p.kind === 'commission' && 'เริ่มต้น '}{formatPrice(p)}</div>
          </div>
          <span className={s.tb} style={{ background: typeOf(p).color }}>{typeOf(p).name}</span>
        </div>
        <div className={s.cta}>
          <HeartButton productId={p.id} variant="glass" />
          <Link className={s.go} to={`/product/${p.id}`}>ดูผลงาน <Icon name="arrow" size={18} color="#fff" stroke={2.2} /></Link>
          <button className={s.rb} aria-label="แชร์" onClick={() => { copyText(`${location.origin}${location.pathname}#/product/${p.id}`); toast('คัดลอกลิงก์ผลงานแล้ว') }}><Icon name="send" size={20} color="#fff" /></button>
        </div></>
        : sl.caption ? <div className={s.pc}><div className={s.pi}><div className={s.pt}>{sl.caption}</div></div></div> : null}
      </div>
    </div>
  )
}
