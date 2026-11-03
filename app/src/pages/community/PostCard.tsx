import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ReportSheet } from '../../components/Report'
import { Av, Img, copyText } from '../../components/ui'
import { ROOMS } from '../../data/appSeed'
import type { Post } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { ME, baht, creatorById, productById } from '../../data/sampleData'
import { community, follows, myReaction } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import { ReactButton, coachSeen } from '../../social/ReactButton'
import { MentionText } from '../../social/Mention'
import { PostMedia } from '../../social/PostMedia'
import { EditPostSheet, LikersSheet, PostMenu } from '../../social/PostOptions'
import { AUDIENCE, useOnline } from '../../services/social'
import { REACTIONS, fmtN, topRx } from '../../social/reactions'
import c from './Community.module.css'
import s from '../../social/Social.module.css'

export const TAG_COLOR: Record<string, [string, string]> = {
  'โชว์ผลงาน': ['#6C2BD9', '#F3ECFF'], 'ความรู้': ['#0B7A6E', '#E2F6F2'], 'เบื้องหลัง': ['#2563EB', '#EAF1FF'], 'ถาม-ตอบ': ['#B45309', '#FFF4DB'], 'แจกฟรี': ['#15803D', '#E5F8EC'],
}
export const isVideo = (u: string) => /^data:video|\.(mp4|webm|mov)(\?|#|$)/i.test(u)
const shortAgo = (t: number) => ago(t).replace('ที่แล้ว', '').trim()

export function sharePost(id: string) {
  copyText(`${location.origin}${location.pathname}#/community/post/${id}`)
  community.share(id)
  toast('คัดลอกลิงก์โพสต์แล้ว')
}
/** Focus the comment box on the post page (or open the post at the box). */
export function focusComment(id: string, full: boolean | undefined, nav: (to: string) => void) {
  if (!full) return nav(`/community/post/${id}#c`)
  const el = document.querySelector<HTMLElement>('.layer[data-active="1"] #cmt-in') ?? document.getElementById('cmt-in')
  el?.focus({ preventScroll: true })
}

export function PostCard({ p, full, i = 0, inGroup }: { p: Post; full?: boolean; i?: number; inGroup?: boolean }) {
  const db = useDb()
  const nav = useNavigate()
  const a = creatorById(p.authorId)
  const mine = myReaction(db, p.id)
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState(false)
  const [who, setWho] = useState(false)
  const [own, setOwn] = useState<null | 'edit'>(null)
  const [coach, setCoach] = useState(false)
  const [tc, tb] = TAG_COLOR[p.tag] ?? ['#6C2BD9', '#F3ECFF']
  const g = p.roomId && !inGroup ? ROOMS.find((r) => r.id === p.roomId) : undefined
  const open = () => !full && nav(`/community/post/${p.id}`)
  const cs = db.comments.filter((x) => x.postId === p.id)
  const nComments = cs.length
  const top = cs.filter((x) => !x.replyTo).sort((x, y) => y.likes - x.likes || x.at - y.at)[0]
  const best = !full && p.tag === 'ถาม-ตอบ' ? top : undefined
  const follow = p.authorId !== ME && !p.mine && !db.follows.includes(p.authorId)
  const rx = topRx(p.rx, mine)
  const isMine = p.authorId === ME || !!p.mine
  const imgs = p.images
  const online = useOnline(isMine ? undefined : p.authorId)
  const likesHidden = !!p.hideLikes && !isMine
  const doFollow = () => follows.toggle(p.authorId).then((v) => toast(v ? `ติดตาม ${a.name} แล้ว` : `เลิกติดตาม ${a.name} แล้ว`))
  return (
    <article className={`${s.card} rise`} style={{ '--i': Math.min(i, 6), marginTop: full ? 0 : undefined } as React.CSSProperties}>
      <div className={s.ph}>
        {g ? (
          <Link to={`/community/group/${g.id}`} className={s.gav} aria-label={g.name}><span style={{ background: g.bg }}><Icon name={g.icon} size={22} color={g.color} /></span><Av src={a.avatar} size={22} /></Link>
        ) : <Link to={`/creator/${a.id}`} aria-label={a.name}><Av src={a.avatar} size={42} online={online} /></Link>}
        <div className={s.pm}>
          <b>
            {g ? <Link to={`/community/group/${g.id}`}>{g.name}</Link> : <Link to={`/creator/${a.id}`} style={{ color: 'inherit', fontWeight: 700 }}>{a.name}</Link>}
            {!g && p.feeling && <span className={s.feel}>— {p.feeling}</span>}
            {!g && follow && <> · <button type="button" style={{ color: 'var(--p)', fontWeight: 700 }} onClick={doFollow}>ติดตาม</button></>}
          </b>
          <small>{g && <><Link to={`/creator/${a.id}`} style={{ color: 'inherit' }}>{a.name}</Link> · </>}{p.pinnedAt && <span className={s.badge} data-pinned><Icon name="pin" size={11} />ปักหมุด · </span>}{shortAgo(p.at)} · <span title={AUDIENCE[p.audience ?? 'public'].l} aria-label={`ผู้ชม: ${AUDIENCE[p.audience ?? 'public'].l}`} data-audience={p.audience ?? 'public'}><Icon name={AUDIENCE[p.audience ?? 'public'].icon} size={12} /></span>{p.archivedAt && <> · <span className={s.badge}>เก็บถาวร</span></>} · <span className={s.tag} style={{ color: tc, background: tb }}>{p.tag}</span>{p.location && <span className={s.loc} data-location>{p.location}</span>}</small>
        </div>
        <button type="button" className={s.ib} aria-label="ตัวเลือกโพสต์" onClick={() => setMenu(true)}><Icon name="dots" size={20} /></button>
        {!full && <button type="button" className={s.ib} aria-label="ซ่อนโพสต์นี้" onClick={() => { void community.hide(p.id); toast('ซ่อนโพสต์แล้ว · จะเห็นโพสต์แบบนี้น้อยลง') }}><Icon name="x" size={20} /></button>}
      </div>
      <div className={s.tx} onClick={open}>
        <MentionText text={p.text} mentions={p.mentions} max={full ? 0 : 140} />
      </div>
      {imgs.length > 0 && <PostMedia srcs={imgs} alts={p.alt} onDoubleLike={() => { if (!mine) void community.react(p.id, 'like') }} />}
      {p.tagged && p.tagged.length > 0 && <div className={s.tagged} data-tagged><Icon name="user" size={14} />{p.tagged.map((m) => <Link key={m.id} to={`/creator/${m.id}`}>{m.name}</Link>)}</div>}
      {p.code && (
        <div className={c.code} style={{ margin: '8px 14px 0' }}>{p.code.map((x, k) => <div key={x}><i>{k + 1}</i><code>{x}</code><button onClick={() => { copyText(x); toast('คัดลอกสูตรแล้ว') }} aria-label="คัดลอก"><Icon name="copy" size={14} /></button></div>)}</div>
      )}
      {full && p.prompt && (
        <div className={c.prompt} style={{ margin: '8px 14px 0' }}>
          <div className={c.prh}><Icon name="sparkle" size={15} color="#C084FC" />พรอมต์ที่ใช้ · แชร์โดยผู้โพสต์</div>
          <p>{p.prompt}</p>
          <button className="btn btn-xs" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }} onClick={() => { copyText(p.prompt!); toast('คัดลอกพรอมต์แล้ว') }}><Icon name="copy" size={14} color="#fff" />คัดลอกพรอมต์</button>
        </div>
      )}
      {!full && p.prompt && <button className={c.hasPrompt} style={{ margin: '8px 14px 0' }} onClick={open}><Icon name="sparkle" size={14} color="var(--p)" />มีพรอมต์ให้คัดลอก · เปิดโพสต์</button>}
      {p.productIds.map((id) => {
        const pr = productById(id)
        if (!pr) return null
        const myWork = pr.creatorId === ME
        return (
          <Link key={id} to={`/product/${id}`} className={`${s.prod} press`} style={{ marginTop: 10 }}>
            <Img src={heroOf(pr)} className={s.prodI} />
            <span className="grow" style={{ minWidth: 0 }}><b className="ell">{pr.title}</b><small>ผลงานในโพสต์ · {pr.price === 0 ? 'ฟรี' : pr.type === 'svc' ? `เริ่ม ${baht(pr.price)}` : baht(pr.price)}</small></span>
            <span className={`btn btn-xs ${myWork ? 'btn-o' : 'btn-p'}`}>{myWork ? 'ของฉัน' : pr.price === 0 ? 'รับฟรี' : pr.type === 'svc' ? 'จ้างเลย' : 'ดูผลงาน'}</span>
          </Link>
        )
      })}
      {best && (
        <div className={c.best} style={{ margin: '8px 14px 0' }}><Av src={creatorById(best.authorId).avatar} size={26} /><div><b>{creatorById(best.authorId).name} <span className="pill pill-g">คำตอบที่ดีที่สุด</span></b><p>{best.text}</p></div></div>
      )}
      <div className={s.cnt}>
        {likesHidden ? (
          <button type="button" className={s.rx} onClick={() => setWho(true)} data-likes-hidden aria-label="ดูคนที่ถูกใจ">
            {mine ? <><i>{REACTIONS.find((r) => r.k === mine)?.e ?? '❤️'}</i><span>คุณและคนอื่น ๆ</span></> : <span>ถูกใจโดยคนอื่น ๆ</span>}
          </button>
        ) : p.likes > 0 ? (
          <button type="button" className={s.rx} onClick={() => setWho(true)} aria-label={`ความรู้สึกทั้งหมด ${p.likes}`}>
            {(rx.length ? rx : [REACTIONS[0]]).map((r) => <i key={r.k}>{r.e}</i>)}
            <span>{mine ? (p.likes > 1 ? `คุณและคนอื่นอีก ${fmtN(p.likes - 1)} คน` : 'คุณ') : fmtN(p.likes)}</span>
          </button>
        ) : <span />}
        <button type="button" onClick={() => focusComment(p.id, full, nav)}>{p.commentsOff ? 'ปิดความคิดเห็น' : `${nComments} ความคิดเห็น`} · {p.shares} แชร์</button>
      </div>
      <div className={s.acts} style={{ position: 'relative' }}>
        <ReactButton mine={mine} onDock={(o) => { if (o && !coachSeen()) setCoach(true); if (!o) setCoach(false) }} onPick={(k) => { void community.react(p.id, k) }} />
        {!p.commentsOff && <button type="button" onClick={() => focusComment(p.id, full, nav)}><Icon name="comment" size={20} />แสดงความคิดเห็น</button>}
        <button type="button" onClick={() => sharePost(p.id)}><Icon name="share" size={20} />แชร์</button>
      </div>
      {coach && <div className={s.coach}><span className={s.emo}>👆</span>กดค้างที่ “ถูกใจ” เพื่อเลือกอีโมจิ · แตะครั้งเดียว = ❤️ ถูกใจ</div>}
      {!full && (
        <div className={s.cprev}>
          {nComments > 0 && <button type="button" style={{ textAlign: 'left' }} onClick={open}><small style={{ color: 'var(--mut)', fontWeight: 600, fontSize: 13 }}>ดูความคิดเห็นทั้ง {nComments} รายการ</small></button>}
          {top && !best && (
            <div className={s.cm} style={{ padding: 0 }} onClick={open}>
              <Av src={creatorById(top.authorId).avatar} size={28} />
              <div className={s.cmb}><span className={s.bub}><b>{creatorById(top.authorId).name}</b><MentionText text={top.text} mentions={top.mentions} max={90} /></span></div>
            </div>
          )}
          {!p.commentsOff && <div className={s.cinMini}><Av src={creatorById(ME).avatar} size={28} /><button type="button" onClick={() => nav(`/community/post/${p.id}#c`)}>เขียนความคิดเห็น… พิมพ์ @ เพื่อแท็กเพื่อน</button></div>}
        </div>
      )}
      {full && <div style={{ height: 4 }} />}

      <PostMenu p={p} open={menu} onClose={() => setMenu(false)} full={full} onEdit={() => setOwn('edit')} onReport={() => setReport(true)} onShare={() => sharePost(p.id)} />
      <ReportSheet open={report} onClose={() => setReport(false)} target="post" id={p.id} />
      <LikersSheet p={p} open={who} onClose={() => setWho(false)} mine={mine} />
      {isMine && <EditPostSheet p={p} open={own === 'edit'} onClose={() => setOwn(null)} />}
    </article>
  )
}
