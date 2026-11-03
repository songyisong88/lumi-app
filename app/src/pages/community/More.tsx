import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ReportSheet } from '../../components/Report'
import { Av, Empty, Img, SampleNote, Sheet, TopBar, blockTap, copyText } from '../../components/ui'
import { FEATURES, REAL, BRAND } from '../../config'
import type { Comment, Mention } from '../../data/appTypes'
import { ME, creatorById } from '../../data/sampleData'
import { CHALLENGE, LEADERBOARD, MY_RANK, challengeEnd } from '../../data/searchData'
import { community, myCommentReaction } from '../../services/api'
import { update, useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import { PostCard } from './PostCard'
import { ReactButton } from '../../social/ReactButton'
import { MentionInput, MentionText, liveMentions, type MentionApi } from '../../social/Mention'
import { REACTIONS, topRx } from '../../social/reactions'
import c0 from './Community.module.css'
import s from '../../social/Social.module.css'

export const LEADERS = LEADERBOARD.map((l) => ({ id: l.creatorId, pts: l.pts }))

export function Countdown({ dark }: { dark?: boolean }) {
  const [n, setN] = useState(() => Date.now())
  useEffect(() => { const h = setInterval(() => setN(Date.now()), 30_000); return () => clearInterval(h) }, [])
  const d = Math.max(0, challengeEnd(n) - n)
  const parts: [number, string][] = [[Math.floor(d / 86400_000), 'วัน'], [Math.floor(d / 3600_000) % 24, 'ชม.'], [Math.floor(d / 60_000) % 60, 'นาที']]
  return <div className={`${c0.cd} ${dark ? c0.cdDark : ''}`}>{parts.map(([v, l]) => <span key={l}><b>{String(v).padStart(2, '0')}</b>{l}</span>)}</div>
}

export function PostDetail() {
  const { id = '' } = useParams()
  const db = useDb()
  const { hash } = useLocation()
  const p = db.posts.find((x) => x.id === id)
  const [text, setText] = useState('')
  const [ments, setMents] = useState<Mention[]>([])
  const [reply, setReply] = useState<{ root: string; to: string }>()
  const [sort, setSort] = useState<'top' | 'new'>('top')
  const [open, setOpen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const api = useRef<MentionApi | null>(null)
  useEffect(() => { if (hash === '#c') setTimeout(() => document.getElementById('cmt-in')?.focus({ preventScroll: true }), 500) }, [hash])
  if (!p) return <><TopBar title="โพสต์" /><Empty icon="comment" title="ไม่พบโพสต์นี้" text="อาจถูกลบไปแล้ว" action={<Link to="/community" className="btn btn-o btn-sm">กลับไปที่ชุมชน</Link>} /></>
  const a = creatorById(p.authorId)
  const cs = db.comments.filter((c) => c.postId === id)
  const roots = cs.filter((c) => !c.replyTo).sort(sort === 'top' ? (x, y) => y.likes - x.likes || x.at - y.at : (x, y) => y.at - x.at)
  const repliesOf = (rid: string) => cs.filter((r) => r.replyTo === rid).sort((x, y) => x.at - y.at)
  const send = async () => {
    const x = text.trim(); if (!x || busy) return
    setBusy(true)
    try { await community.comment(id, x, reply?.root, liveMentions(x, ments)); setText(''); setMents([]); if (reply) setOpen((o) => [...o, reply.root]); setReply(undefined); toast('ส่งความคิดเห็นแล้ว') } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }
  const startReply = (c: Comment) => {
    const root = c.replyTo ?? c.id
    setReply({ root, to: c.authorId })
    if (c.authorId !== ME) {
      const n = creatorById(c.authorId).name
      if (!text.includes('@' + n)) { setText(`@${n} ${text}`); setMents((m) => m.some((x) => x.id === c.authorId) ? m : [...m, { id: c.authorId, name: n }]) }
    }
    setTimeout(() => api.current?.focus(), 50)
  }
  return (
    <div className={`has-bar ${s.cmPage}`}>
      <TopBar title={`โพสต์ของ ${a.name}`} />
      <div className="narrow">
        <PostCard p={p} full />
        <button type="button" className={s.csort} onClick={() => setSort(sort === 'top' ? 'new' : 'top')} aria-label="เปลี่ยนการเรียงความคิดเห็น">{sort === 'top' ? 'ความคิดเห็นที่เกี่ยวข้องที่สุด' : 'ความคิดเห็นล่าสุด'} <Icon name="down" size={14} /></button>
        {cs.length === 0 && <p className="muted" style={{ padding: '6px 16px' }}>ยังไม่มีความคิดเห็น เป็นคนแรกเลย</p>}
        {roots.map((c) => {
          const reps = repliesOf(c.id)
          const shown = open.includes(c.id) ? reps : reps.slice(0, 1)
          return (
            <div key={c.id}>
              <Cmt c={c} postAuthor={p.authorId} onReply={() => startReply(c)} />
              {shown.map((r) => <Cmt key={r.id} c={r} rep postAuthor={p.authorId} onReply={() => startReply(r)} />)}
              {reps.length > shown.length && <button type="button" className={s.more} onClick={() => setOpen((o) => [...o, c.id])}>↳ ดูการตอบกลับอีก {reps.length - shown.length} รายการ</button>}
            </div>
          )
        })}
      </div>
      <div className="bottom-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, paddingTop: 8 }}>
        {reply && <small className={s.rbar}><span>กำลังตอบกลับ <b>{creatorById(reply.to).name}</b></span><button type="button" onClick={() => setReply(undefined)}>ยกเลิก</button></small>}
        <div className={s.cin}>
          <Av src={creatorById(ME).avatar} size={32} />
          <MentionInput variant="line" up value={text} onChange={setText} mentions={ments} onMentions={setMents} apiRef={api} id="cmt-in" postId={id} roomId={p.roomId}
            placeholder="เขียนความคิดเห็น… พิมพ์ @ เพื่อแท็ก" ariaLabel="เขียนความคิดเห็น" onEnter={() => void send()} maxLength={1000} />
          <button type="button" className={s.sendB} aria-label="ส่ง" {...blockTap(!text.trim(), 'พิมพ์คอมเมนต์ก่อนส่ง')} onClick={() => void send()}><Icon name="send" size={22} color="var(--p)" /></button>
        </div>
      </div>
    </div>
  )
}

/** After a long-press opens a menu, the finger lift still fires a click (on the new sheet's backdrop),
 *  which would close the menu at once. Swallow that one click. */
function swallowNextClick() {
  const eat = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); done() }
  const done = () => { window.removeEventListener('click', eat, true); clearTimeout(tm) }
  window.addEventListener('click', eat, true)
  const tm = window.setTimeout(done, 1200)
  window.addEventListener('pointerup', () => window.setTimeout(done, 350), { once: true, capture: true })
}

function Cmt({ c, onReply, rep, postAuthor }: { c: Comment; onReply: () => void; rep?: boolean; postAuthor: string }) {
  const db = useDb()
  const a = creatorById(c.authorId)
  const mine = myCommentReaction(db, c.id)
  const [menu, setMenu] = useState(false)
  const [edit, setEdit] = useState<string | null>(null)
  const [report, setReport] = useState(false)
  const t = useRef(0)
  const rx = topRx(c.rx, mine, 2)
  const own = c.authorId === ME
  const press = { onPointerDown: () => { clearTimeout(t.current); t.current = window.setTimeout(() => { swallowNextClick(); setMenu(true); navigator.vibrate?.(10) }, 500) }, onPointerUp: () => clearTimeout(t.current), onPointerLeave: () => clearTimeout(t.current), onPointerCancel: () => clearTimeout(t.current), onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setMenu(true) } }
  return (
    <div className={`${s.cm} ${rep ? s.rep : ''} rise`} data-comment={c.id}>
      <Link to={`/creator/${a.id}`} aria-label={a.name}><Av src={a.avatar} size={rep ? 28 : 36} /></Link>
      <div className={s.cmb}>
        <span className={`${s.bub} ${menu ? s.hiBub : ''}`} {...press}>
          <b>{a.name}{c.authorId === postAuthor && <span className="pill" style={{ fontSize: 12 }}>ผู้โพสต์</span>}{c.badge === 'buyer' && <span className="pill pill-g" style={{ fontSize: 12 }}>ซื้อแล้ว</span>}</b>
          <MentionText text={c.text} mentions={c.mentions} />
          {c.likes > 0 && <span className={s.brx}>{(rx.length ? rx : [REACTIONS[0]]).map((r) => r.e).join('')} {c.likes}</span>}
        </span>
        <div className={s.cma} style={{ position: 'relative' }}>
          <span>{ago(c.at).replace('ที่แล้ว', '').trim()}</span>
          <ReactButton small mine={mine} onPick={(k) => { void community.reactComment(c.id, k) }} />
          <button type="button" onClick={onReply}>ตอบกลับ</button>
          <button type="button" aria-label="ตัวเลือกความคิดเห็น" onClick={() => setMenu(true)} style={{ marginLeft: 'auto' }}>•••</button>
        </div>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title="ความคิดเห็น">
        <div style={{ margin: '0 -16px' }}>
          <button className="list-row" style={{ width: '100%' }} onClick={() => { setMenu(false); onReply() }}><Icon name="comment" size={20} /><span className="grow">ตอบกลับ</span></button>
          <button className="list-row" style={{ width: '100%' }} onClick={() => { copyText(c.text); setMenu(false); toast('คัดลอกข้อความแล้ว') }}><Icon name="copy" size={20} /><span className="grow">คัดลอกข้อความ</span></button>
          {own && FEATURES.accounts && <>
            <button className="list-row" style={{ width: '100%' }} onClick={() => { setMenu(false); setTimeout(() => setEdit(c.text), 200) }}><Icon name="edit" size={20} /><span className="grow">แก้ไข</span></button>
            <button className="list-row" style={{ width: '100%', color: '#DC2626' }} onClick={async () => { if (!confirm('ลบความคิดเห็นนี้?')) return; try { await community.deleteComment(c.id); setMenu(false); toast('ลบแล้ว') } catch (e) { toast((e as Error).message) } }}><Icon name="trash" size={20} color="#DC2626" /><span className="grow">ลบ</span></button>
          </>}
          {!own && <button className="list-row" style={{ width: '100%' }} onClick={() => { setMenu(false); setTimeout(() => setReport(true), 200) }}><Icon name="flag" size={20} /><span className="grow">รายงานความคิดเห็น</span></button>}
        </div>
      </Sheet>
      <ReportSheet open={report} onClose={() => setReport(false)} target="post" id={c.id} />
      {own && FEATURES.accounts && (
        <Sheet open={edit != null} onClose={() => setEdit(null)} title="แก้ไขความคิดเห็น" footer={<button className="btn btn-p btn-block" disabled={!edit?.trim() || edit === c.text} onClick={async () => { try { await community.editComment(c.id, edit!.trim()); setEdit(null); toast('บันทึกแล้ว') } catch (e) { toast((e as Error).message) } }}>บันทึก</button>}>
          <textarea className="ta" rows={4} value={edit ?? ''} onChange={(e) => setEdit(e.target.value)} aria-label="ข้อความความคิดเห็น" maxLength={1000} />
        </Sheet>
      )}
    </div>
  )
}

const ENTRIES = [
  { id: 'e1', by: 'fasai', img: 'g_lotus.jpg', votes: 412 }, { id: 'e2', by: 'pim', img: 'shiba.jpg', votes: 388 }, { id: 'e3', by: 'toy', img: 'toys.jpg', votes: 301 },
  { id: 'e4', by: 'nova', img: 'g_tuktuk.jpg', votes: 276 }, { id: 'e5', by: 'kenji', img: 'g_poster.jpg', votes: 190 }, { id: 'e6', by: 'mint', img: 'g_frogs.jpg', votes: 145 },
]
const MISSIONS = [
  { id: 'm1', t: 'โพสต์ผลงานแรกของสัปดาห์', pts: 50, to: '/community/new' },
  { id: 'm2', t: 'ตอบคำถามในห้องมือใหม่ 3 ครั้ง', pts: 30, to: '/community/room/newbie' },
  { id: 'm3', t: 'ลงขายผลงานใหม่ 1 ชิ้น', pts: 80, to: '/sell' },
]

export function Activities() {
  const db = useDb()
  const nav = useNavigate()
  useEffect(() => { if (location.hash.endsWith('#rank')) setTimeout(() => document.getElementById('rank')?.scrollIntoView({ behavior: 'smooth' }), 450) }, [])
  // the challenge, entries, ranking and missions above are sample content: demo site only
  if (REAL) return <div className="page"><TopBar title="กิจกรรม" sub="ชาเลนจ์ อันดับ และภารกิจ" /><Empty icon="sparkle" title="ยังไม่มีกิจกรรมตอนนี้" text={`ชาเลนจ์และกิจกรรมจะประกาศที่นี่ ติดตามข่าวจาก ${BRAND} OFFICIAL ได้เลย`} action={<Link to="/community" className="btn btn-o btn-sm">กลับไปที่ชุมชน</Link>} /></div>
  return (
    <div className="page">
      <TopBar title="กิจกรรม" sub="ชาเลนจ์ อันดับ และภารกิจ" />
      <div className="narrow">
        <div className={c0.chal} style={{ margin: '12px 16px 0' }}>
          <small>ชาเลนจ์ประจำสัปดาห์</small>
          <b>ประกวดภาพ “{CHALLENGE.prompt}” 🚀</b>
          <span>{CHALLENGE.note}</span>
          <Countdown />
          <button className="btn btn-sm" style={{ background: '#fff', color: '#6C2BD9', marginTop: 10, alignSelf: 'flex-start' }} onClick={() => nav('/community/new?challenge=1')}>ร่วมส่งผลงาน</button>
        </div>
        <div className="sec"><div className="sec-h">ผลงานที่ส่งเข้าประกวด<span className="more">โหวตได้ไม่จำกัด</span></div>
          <div className={c0.ent}>
            {ENTRIES.map((e, i) => {
              const v = db.votes.includes(e.id)
              return (
                <div key={e.id} className={`${c0.en} rise`} style={{ '--i': i } as React.CSSProperties}>
                  <Img src={e.img} />
                  <div className={c0.enF}><Av src={creatorById(e.by).avatar} size={22} /><span className="ell">{creatorById(e.by).name}</span>
                    <button className={v ? c0.on : ''} onClick={() => community.vote(e.id)} aria-label="โหวต"><span className={v ? 'heart-pop' : ''}><Icon name="heart" size={15} fill={v ? '#F0508A' : 'none'} color={v ? '#F0508A' : 'currentColor'} /></span>{e.votes + (v ? 1 : 0)}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="sec" id="rank" style={{ scrollMarginTop: 60 }}><div className="sec-h">อันดับดาวเด่นสัปดาห์นี้</div>
          <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
            {LEADERS.map((l, i) => (
              <Link key={l.id} to={`/creator/${l.id}`} className="list-row"><b style={{ width: 22, textAlign: 'center' }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</b><Av src={creatorById(l.id).avatar} size={36} /><span className="grow">{creatorById(l.id).name}</span><b>{l.pts.toLocaleString('th-TH')}</b><small style={{ marginLeft: 4 }}>แต้ม</small></Link>
            ))}
            <div className="list-row" style={{ background: '#FBF8FF' }}><b style={{ width: 22, textAlign: 'center' }}>{MY_RANK.rank}</b><Av src={creatorById(ME).avatar} size={36} /><span className="grow">คุณ<small>อีก {MY_RANK.toTop10} แต้ม ติดท็อป 10</small></span><b>{(640 + db.missions.length * 50).toLocaleString('th-TH')}</b></div>
          </div>
        </div>
        <div className="sec"><div className="sec-h">ภารกิจรับแต้ม</div>
          {MISSIONS.map((m) => {
            const done = db.missions.includes(m.id)
            return (
              <div key={m.id} className={c0.mis}>
                <span className={done ? 'ok-ic' : c0.misI}>{done ? <Icon name="check" size={14} stroke={3} /> : <Icon name="target" size={16} color="var(--p)" />}</span>
                <span className="grow">{m.t}<small>+{m.pts} แต้ม</small></span>
                {done ? <span className="pill pill-g">สำเร็จ</span> : <button className="btn btn-xs btn-s" onClick={() => { update((d) => { d.missions.push(m.id) }); nav(m.to) }}>ไปทำ</button>}
              </div>
            )
          })}
        </div>
        <div style={{ padding: 16 }}><SampleNote>กิจกรรมตัวอย่าง · ยังไม่มีรางวัลจริง</SampleNote></div>
      </div>
    </div>
  )
}
