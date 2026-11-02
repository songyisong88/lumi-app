import { useState } from 'react'
import { FollowButton } from '../../components/FollowButton'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Img, copyText } from '../../components/ui'
import type { Post } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { ME, baht, creatorById, productById } from '../../data/sampleData'
import { community } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import s from './Community.module.css'

export const TAG_COLOR: Record<string, [string, string]> = {
  'โชว์ผลงาน': ['#6C2BD9', '#F3ECFF'], 'ความรู้': ['#0E9384', '#E2F6F2'], 'เบื้องหลัง': ['#2563EB', '#EAF1FF'], 'ถาม-ตอบ': ['#B45309', '#FFF4DB'], 'แจกฟรี': ['#15803D', '#E5F8EC'],
}
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}K` : String(n))

export function sharePost(id: string) {
  copyText(`${location.origin}${location.pathname}#/community/post/${id}`)
  community.share(id)
  toast('คัดลอกลิงก์โพสต์แล้ว')
}

export function PostCard({ p, full, i = 0 }: { p: Post; full?: boolean; i?: number }) {
  const db = useDb()
  const nav = useNavigate()
  const a = creatorById(p.authorId)
  const liked = db.liked.includes(p.id)
  const saved = db.saved.includes(p.id)
  const [pop, setPop] = useState(0)
  const [more, setMore] = useState(full || p.text.length < 140)
  const [tc, tb] = TAG_COLOR[p.tag] ?? ['#6C2BD9', '#F3ECFF']
  const open = () => !full && nav(`/community/post/${p.id}`)
  const best = !full && p.tag === 'ถาม-ตอบ' ? db.comments.filter((c) => c.postId === p.id).sort((x, y) => y.likes - x.likes)[0] : undefined
  return (
    <article className={`${s.post} ${full ? s.full : ''} rise`} style={{ '--i': Math.min(i, 6) } as React.CSSProperties}>
      <div className={s.ph}>
        <Link to={`/creator/${a.id}`}><Av src={a.avatar} size={42} /></Link>
        <div className={s.pm}>
          <Link to={`/creator/${a.id}`}><b>{a.name}</b></Link>
          <small>{ago(p.at)} · <span className={s.tag} style={{ color: tc, background: tb }}>{p.tag}</span></small>
        </div>
        {p.authorId !== ME && <FollowButton id={p.authorId} />}
      </div>
      <div className={s.tx} onClick={open}>
        {more ? p.text : <>{p.text.slice(0, 130)}… <button className={s.more} onClick={(e) => { e.stopPropagation(); setMore(true) }}>ดูเพิ่มเติม</button></>}
      </div>
      {p.images.length > 0 && (
        <div className={`${s.imgs} ${s['n' + Math.min(p.images.length, 3)]}`} onClick={open}>
          {p.images.slice(0, 3).map((x) => <Img key={x} src={x} />)}
        </div>
      )}
      {p.code && (
        <div className={s.code}>{p.code.map((c, k) => <div key={c}><i>{k + 1}</i><code>{c}</code><button onClick={() => { copyText(c); toast('คัดลอกสูตรแล้ว') }} aria-label="คัดลอก"><Icon name="copy" size={14} /></button></div>)}</div>
      )}
      {full && p.prompt && (
        <div className={s.prompt}>
          <div className={s.prh}><Icon name="sparkle" size={15} color="#C084FC" />พรอมต์ที่ใช้ · แชร์โดยผู้โพสต์</div>
          <p>{p.prompt}</p>
          <button className="btn btn-xs" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }} onClick={() => { copyText(p.prompt!); toast('คัดลอกพรอมต์แล้ว') }}><Icon name="copy" size={14} color="#fff" />คัดลอกพรอมต์</button>
        </div>
      )}
      {!full && p.prompt && <button className={s.hasPrompt} onClick={open}><Icon name="sparkle" size={14} color="var(--p)" />มีพรอมต์ให้คัดลอก · เปิดโพสต์</button>}
      {p.productIds.map((id) => {
        const pr = productById(id)
        if (!pr) return null
        return (
          <Link key={id} to={`/product/${id}`} className={`${s.prod} press`}>
            <Img src={heroOf(pr)} className={s.prodI} />
            <span className="grow"><b className="ell">{pr.title}</b><small>{pr.label ?? 'ผลงาน'} · {pr.price === 0 ? 'ฟรี' : pr.type === 'svc' ? `เริ่ม ${baht(pr.price)}` : baht(pr.price)}</small></span>
            <span className="btn btn-xs btn-p">{pr.price === 0 ? 'รับฟรี' : pr.type === 'svc' ? 'จ้างเลย' : 'ซื้อ'}</span>
          </Link>
        )
      })}
      {best && (
        <div className={s.best}><Av src={creatorById(best.authorId).avatar} size={26} /><div><b>{creatorById(best.authorId).name} <span className="pill pill-g">คำตอบที่ดีที่สุด</span></b><p>{best.text}</p></div></div>
      )}
      <div className={s.cnt}><span><Icon name="heart" size={13} color="#F0508A" fill="#F0508A" stroke={0} />{fmt(p.likes)}</span><span>{db.comments.filter((x) => x.postId === p.id).length} ความคิดเห็น · {p.shares} แชร์</span></div>
      <div className={s.acts}>
        <button className={liked ? s.on : ''} onClick={() => { community.like(p.id); if (!liked) setPop((x) => x + 1) }}><span key={pop} className={pop && liked ? 'heart-pop' : ''}><Icon name="heart" size={19} color={liked ? '#F0508A' : 'currentColor'} fill={liked ? '#F0508A' : 'none'} /></span>ถูกใจ</button>
        <button onClick={() => { if (full) { const el = document.querySelector<HTMLElement>('.layer[data-active="1"] #cmt-in'); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.focus({ preventScroll: true }) } else nav(`/community/post/${p.id}#c`) }}><Icon name="comment" size={19} />คอมเมนต์</button>
        <button onClick={() => sharePost(p.id)}><Icon name="share" size={19} />แชร์</button>
        <button className={saved ? s.on : ''} onClick={() => { community.save(p.id); toast(saved ? 'เอาออกจากที่บันทึกแล้ว' : 'บันทึกโพสต์แล้ว') }}><Icon name="bookmark" size={19} fill={saved ? 'currentColor' : 'none'} />บันทึก</button>
      </div>
    </article>
  )
}
