import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TYPES, creatorById, imgUrl } from '../data/sampleData'
import type { Product } from '../data/types'
import { HeartButton } from './HeartButton'
import { Icon } from './Icon'
import s from './ProductCard.module.css'

const ratioOf = (p: Product) => p.ratio ?? (p.image ? `${p.image.w}/${p.image.h}` : '1/1')

function TypeTag({ p }: { p: Product }) {
  return (
    <span className={s.tag}><i style={{ background: TYPES[p.type].color }} />{p.label ?? TYPES[p.type].name}</span>
  )
}

function Creator({ id, free }: { id: string; free?: boolean }) {
  const c = creatorById(id)
  return (
    <div className={s.cf}>
      <span className="av" style={{ width: 18, height: 18, backgroundImage: `url(${imgUrl(c.avatar)})` }} />
      <span className={s.who}>{c.name}</span>
      {free && <span className={s.free}>ฟรี</span>}
    </div>
  )
}

/** The visual area. Each kind shows the product its own way, at its real aspect ratio. */
function Media({ p }: { p: Product }) {
  const style = { aspectRatio: ratioOf(p) }
  switch (p.kind) {
    case 'tool':
      return (
        <div className={s.pm} style={{ ...style, background: p.gradient }}>
          <div className={s.center}><span className={s.appi}><Icon name={p.icon ?? 'bolt'} size={26} color="#fff" /></span></div>
        </div>
      )
    case 'bot':
      return (
        <div className={s.pm} style={style}>
          <div className={s.bot}><div className={s.q}>{p.chat?.q}</div><div className={s.a}>{p.chat?.a}</div></div>
        </div>
      )
    case 'template':
      return (
        <div className={s.pm} style={{ ...style, background: '#EAF1FF' }}>
          <div className={s.paper} style={{ backgroundImage: `url(${imgUrl(p.image!.src)})` }} />
          <div className={s.files}>{p.files?.map((f) => <span key={f}>{f}</span>)}</div>
          <span className={s.preview}><Icon name="eye" size={13} color="#2563EB" stroke={2.2} />ดูตัวอย่าง</span>
        </div>
      )
    default:
      return (
        <div className={s.pm} style={style}>
          <img src={imgUrl(p.image!.src)} alt="" loading="lazy" width={p.image!.w} height={p.image!.h} />
          {p.video && <span className={s.play}><Icon name="play" size={16} color="#E0620B" fill="#E0620B" /></span>}
          {p.meta && <span className={s.dur}>{p.meta}</span>}
          {p.freeFirst && <span className={s.first}>{p.freeFirst}</span>}
        </div>
      )
  }
}

function Footer({ p }: { p: Product }) {
  if (p.kind === 'tool')
    return (
      <>
        <div className={s.plats}>{p.platforms?.map((x) => <span key={x}>{x}</span>)}</div>
        <div className={s.tfoot}>
          <span className={s.rt}><Icon name="star" size={11} color="#F5A524" fill="#F5A524" />{p.rating} รีวิว</span>
          <span className={s.try}><Icon name="play" size={11} color="#0E9384" fill="#0E9384" stroke={2.4} />ลองใช้</span>
        </div>
      </>
    )
  if (p.kind === 'bot') {
    const c = creatorById(p.creatorId)
    // Fix: the "สแกนลองคุย" button used to overflow narrow cards. The row now wraps,
    // the creator name shrinks/ellipsizes, and the button may take a full line.
    return (
      <div className={`${s.tfoot} ${s.wrapRow}`}>
        <span className={s.cfi}><span className="av" style={{ width: 18, height: 18, backgroundImage: `url(${imgUrl(c.avatar)})` }} /><span className={s.who}>{c.name}</span></span>
        <span className={`${s.try} ${s.g}`}><Icon name="qr" size={12} color="#05A84B" stroke={2.2} />สแกนลองคุย</span>
      </div>
    )
  }
  if (p.kind === 'commission')
    return (
      <>
        <div className={s.svm}><span><Icon name="clock" size={12} color="#D6336C" stroke={2.2} />{p.days} วัน</span><span><Icon name="redo" size={12} color="#D6336C" stroke={2.2} />แก้ {p.revisions} ครั้ง</span></div>
        <Creator id={p.creatorId} />
      </>
    )
  return <Creator id={p.creatorId} free={p.price === 0} />
}

/** Feed card. NO price by design: price shows on the product/story view. Free items get a green "ฟรี" pill. */
export function ProductCard({ p, badge }: { p: Product; badge?: ReactNode }) {
  return (
    <article className={s.card} data-kind={p.kind}>
      <Link to={`/product/${p.id}`} className={s.link} aria-label={p.title} />
      <div className={s.mw}>
        <Media p={p} />
        <TypeTag p={p} />
        <HeartButton productId={p.id} className={s.heart} />
        {badge}
      </div>
      <div className={s.bd}>
        <h3 className={s.tt}>{p.title}</h3>
        <div className={s.use}><Icon name="target" size={13} color="#8A86A0" stroke={2.2} /><span>{p.use}</span></div>
        <Footer p={p} />
      </div>
    </article>
  )
}
