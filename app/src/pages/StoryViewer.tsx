import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { HeartButton } from '../components/HeartButton'
import { Icon } from '../components/Icon'
import { STORIES, TYPES, creatorById, formatPrice, imgUrl, productById } from '../data/sampleData'
import { markStorySeen } from '../services/seenStories'
import s from './StoryViewer.module.css'

const DURATION = 5000

export function StoryViewer() {
  const { creatorId = '' } = useParams()
  const nav = useNavigate()
  const idx = STORIES.findIndex((x) => x.creatorId === creatorId)
  const story = STORIES[idx]
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => { setSlide(0) }, [creatorId])
  useEffect(() => { if (story) markStorySeen(story.creatorId) }, [story])

  const next = () => {
    if (!story) return
    if (slide < story.slides.length - 1) setSlide(slide + 1)
    else if (idx < STORIES.length - 1) nav(`/story/${STORIES[idx + 1].creatorId}`, { replace: true })
    else nav('/')
  }
  const prev = () => {
    if (slide > 0) setSlide(slide - 1)
    else if (idx > 0) nav(`/story/${STORIES[idx - 1].creatorId}`, { replace: true })
  }

  useEffect(() => {
    if (paused || !story) return
    const t = setTimeout(next, DURATION)
    return () => clearTimeout(t)
  })

  if (!story) return <Navigate to="/" replace />
  const c = creatorById(story.creatorId)
  const sl = story.slides[slide]
  const p = productById(sl.productId)!
  const bg = p.image ? imgUrl(p.image.src) : undefined

  return (
    <div className={s.scrim}>
      <div className={s.svw} style={{ background: bg ? `#16132B url(${bg}) center/cover` : p.gradient ?? '#16132B' }}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        <div className={s.shade} />
        <div className={s.bars}>
          {story.slides.map((_, i) => (
            <i key={i}><b className={i < slide ? s.full : i === slide ? s.run : ''} style={i === slide ? { animationDuration: `${DURATION}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined} key={`${creatorId}-${slide}`} /></i>
          ))}
        </div>
        <div className={s.head}>
          <span className="av" style={{ width: 36, height: 36, border: '2px solid #fff', backgroundImage: `url(${imgUrl(c.avatar)})` }} />
          <div><div className={s.name}>{c.name}</div><div className={s.ago}>ผลงานใหม่ · {sl.postedAgo}</div></div>
          <button className={s.follow}>ติดตาม</button>
          <Link to="/" className={s.x} aria-label="ปิด"><Icon name="x" size={22} color="#fff" stroke={2.2} /></Link>
        </div>
        <button className={`${s.tap} ${s.left}`} onClick={prev} aria-label="ก่อนหน้า" />
        <button className={`${s.tap} ${s.right}`} onClick={next} aria-label="ถัดไป" />
        <div className={s.pc}>
          <span className={s.th} style={{ background: bg ? `url(${bg}) center/cover` : p.gradient }} />
          <div className={s.pi}>
            <div className={s.pt}>{p.title}</div>
            <div className={s.pu}>{p.use}</div>
            <div className={s.pp}>{p.kind === 'commission' && 'เริ่มต้น '}{formatPrice(p)}</div>
          </div>
          <span className={s.tb} style={{ background: TYPES[p.type].color }}>{TYPES[p.type].name}</span>
        </div>
        <div className={s.cta}>
          <HeartButton productId={p.id} variant="glass" />
          <Link className={s.go} to={`/product/${p.id}`}>ดูสินค้า <Icon name="arrow" size={18} color="#fff" stroke={2.2} /></Link>
          <button className={s.rb} aria-label="แชร์"><Icon name="send" size={20} color="#fff" /></button>
        </div>
      </div>
    </div>
  )
}
