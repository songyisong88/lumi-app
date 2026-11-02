import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, SampleNote, Sheet, TopBar, blockTap } from '../../components/ui'
import { FEATURES } from '../../config'
import { ROOMS } from '../../data/appSeed'
import { ME, creatorById, imgUrl } from '../../data/sampleData'
import { CHALLENGE, LEADERBOARD, MY_RANK, challengeEnd } from '../../data/searchData'
import { community } from '../../services/api'
import { update, useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import { PostCard, sharePost } from './PostCard'
import s from './Community.module.css'

export const LEADERS = LEADERBOARD.map((l) => ({ id: l.creatorId, pts: l.pts }))

export function Countdown({ dark }: { dark?: boolean }) {
  const [n, setN] = useState(() => Date.now())
  useEffect(() => { const h = setInterval(() => setN(Date.now()), 30_000); return () => clearInterval(h) }, [])
  const d = Math.max(0, challengeEnd(n) - n)
  const parts: [number, string][] = [[Math.floor(d / 86400_000), 'วัน'], [Math.floor(d / 3600_000) % 24, 'ชม.'], [Math.floor(d / 60_000) % 60, 'นาที']]
  return <div className={`${s.cd} ${dark ? s.cdDark : ''}`}>{parts.map(([v, l]) => <span key={l}><b>{String(v).padStart(2, '0')}</b>{l}</span>)}</div>
}

export function PostDetail() {
  const { id = '' } = useParams()
  const db = useDb()
  const { hash } = useLocation()
  const p = db.posts.find((x) => x.id === id)
  const [text, setText] = useState('')
  const [reply, setReply] = useState<string>()
  const nav = useNavigate()
  const [own, setOwn] = useState<null | 'menu' | 'edit'>(null)
  const [draft, setDraft] = useState('')
  useEffect(() => { if (hash === '#c') setTimeout(() => document.getElementById('cmt-in')?.focus({ preventScroll: true }), 500) }, [hash])
  if (!p) return <><TopBar title="โพสต์" /><Empty icon="comment" title="ไม่พบโพสต์นี้" text="อาจถูกลบไปแล้ว" action={<Link to="/community" className="btn btn-o btn-sm">กลับไปที่ชุมชน</Link>} /></>
  const cs = db.comments.filter((c) => c.postId === id)
  const roots = cs.filter((c) => !c.replyTo)
  const send = (v = text) => { const x = v.trim(); if (!x) return; community.comment(id, x, reply); setText(''); setReply(undefined); toast('ส่งความคิดเห็นแล้ว') }
  return (
    <div className="has-bar">
      <TopBar title="โพสต์" right={<>{FEATURES.accounts && p.authorId === ME && <button className="tb-btn" onClick={() => setOwn('menu')} aria-label="จัดการโพสต์"><Icon name="dots" size={20} /></button>}<button className="tb-btn" onClick={() => sharePost(id)} aria-label="แชร์"><Icon name="share" size={20} /></button></>} />
      <div className="narrow">
        <PostCard p={p} full />
        <div className={s.cmH}>ความคิดเห็น {cs.length}<span>เกี่ยวข้องที่สุด</span></div>
        {cs.length === 0 && <p className="muted" style={{ padding: '0 16px' }}>ยังไม่มีความคิดเห็น เป็นคนแรกเลย</p>}
        {roots.map((c) => (
          <div key={c.id}>
            <Cmt c={c} onReply={() => { setReply(c.id); document.getElementById('cmt-in')?.focus() }} />
            {cs.filter((r) => r.replyTo === c.id).map((r) => <div key={r.id} className={s.rep}><Cmt c={r} onReply={() => { setReply(c.id); document.getElementById('cmt-in')?.focus() }} /></div>)}
          </div>
        ))}
      </div>
      <div className="bottom-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div className="chips hscroll">{['สวยมากครับ 😍', 'ขอพรอมต์หน่อย', 'มีแบบอื่นไหม', 'สนใจจ้างครับ'].map((q) => <button key={q} className="chip" style={{ height: 30, fontSize: 12.5, flex: 'none' }} onClick={() => send(q)}>{q}</button>)}</div>
        {reply && <div className={s.rto}>ตอบกลับ {creatorById(cs.find((c) => c.id === reply)!.authorId).name}<button onClick={() => setReply(undefined)} aria-label="ยกเลิก"><Icon name="x" size={14} /></button></div>}
        <div className={s.cin}>
          <Av src={creatorById(ME).avatar} size={32} />
          <input id="cmt-in" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }} placeholder="เขียนความคิดเห็น…" aria-label="เขียนความคิดเห็น" />
          <button className="btn btn-xs btn-p" {...blockTap(!text.trim(), 'พิมพ์คอมเมนต์ก่อนส่ง')} onClick={() => send()}>ส่ง</button>
        </div>
      </div>
      {FEATURES.accounts && p.authorId === ME && <>
        <Sheet open={own === 'menu'} onClose={() => setOwn(null)} title="โพสต์ของฉัน">
          <button className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }} onClick={() => { setDraft(p.text); setOwn('edit') }}><Icon name="edit" size={20} /><span className="grow">แก้ไขข้อความ<small>คนอ่านจะเห็นว่า “แก้ไขแล้ว”</small></span></button>
          <button className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)', color: '#DC2626' }} onClick={async () => { if (!confirm('ลบโพสต์นี้? ความคิดเห็นทั้งหมดจะหายไปด้วย')) return; try { await community.deletePost(id); setOwn(null); toast('ลบโพสต์แล้ว'); nav('/community', { replace: true }) } catch (e) { toast((e as Error).message) } }}><Icon name="trash" size={20} color="#DC2626" /><span className="grow">ลบโพสต์<small>ลบแล้วกู้คืนไม่ได้</small></span></button>
        </Sheet>
        <Sheet open={own === 'edit'} onClose={() => setOwn(null)} title="แก้ไขโพสต์" footer={<button className="btn btn-p btn-block" disabled={!draft.trim() || draft === p.text} onClick={async () => { try { await community.editPost(id, { text: draft.trim() }); setOwn(null); toast('บันทึกแล้ว') } catch (e) { toast((e as Error).message) } }}>บันทึก</button>}>
          <textarea className="ta" rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="ข้อความโพสต์" maxLength={2000} />
        </Sheet>
      </>}
    </div>
  )
}

function Cmt({ c, onReply }: { c: ReturnType<typeof useDb>['comments'][number]; onReply: () => void }) {
  const db = useDb()
  const a = creatorById(c.authorId)
  const liked = db.likedComments.includes(c.id)
  return (
    <div className={`${s.cm} rise`}>
      <Av src={a.avatar} size={34} />
      <div className={s.cmb}>
        <div className={s.cmBubble}><b>{a.name}{c.badge === 'author' && <span className="pill pill-p">ผู้เขียน</span>}{c.badge === 'buyer' && <span className="pill pill-g">ซื้อแล้ว</span>}</b><p>{c.text}</p></div>
        <div className={s.cmA}><span>{ago(c.at)}</span><button className={liked ? s.on : ''} onClick={() => community.likeComment(c.id)}><Icon name="heart" size={13} fill={liked ? '#F0508A' : 'none'} color={liked ? '#F0508A' : 'currentColor'} />{c.likes}</button><button onClick={onReply}>ตอบกลับ</button>{FEATURES.accounts && c.authorId === ME && <>
          <button onClick={async () => { const t = prompt('แก้ไขความคิดเห็น', c.text); if (t == null || !t.trim() || t === c.text) return; try { await community.editComment(c.id, t.trim()); toast('บันทึกแล้ว') } catch (e) { toast((e as Error).message) } }}>แก้ไข</button>
          <button onClick={async () => { if (!confirm('ลบความคิดเห็นนี้?')) return; try { await community.deleteComment(c.id); toast('ลบแล้ว') } catch (e) { toast((e as Error).message) } }}>ลบ</button>
        </>}</div>
      </div>
    </div>
  )
}

export function Room() {
  const { id = '' } = useParams()
  const db = useDb()
  const nav = useNavigate()
  const r = ROOMS.find((x) => x.id === id)
  if (!r) return <><TopBar title="ห้อง" /><Empty icon="users" title="ไม่พบห้องนี้" action={<Link to="/community" className="btn btn-o btn-sm">กลับไปที่ชุมชน</Link>} /></>
  const joined = db.joined.includes(id)
  const posts = db.posts.filter((p) => p.roomId === id)
  return (
    <div className="page">
      <TopBar title={r.name} sub={`${r.members.toLocaleString('th-TH')} สมาชิก`} />
      <div className={s.rcov} style={{ backgroundImage: `url(${imgUrl(r.cover, true)})` }}><span className={s.ric} style={{ background: r.bg }}><Icon name={r.icon} size={26} color={r.color} /></span></div>
      <div className="narrow">
        <div style={{ padding: '12px 16px 0' }}>
          <h1 style={{ fontSize: 20 }}>{r.name}</h1>
          <p className="muted">{r.desc}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className={`btn btn-sm ${joined ? 'btn-o' : 'btn-p'}`} style={{ flex: 1 }} onClick={() => community.join(id).then((v) => toast(v ? 'เข้าร่วมห้องแล้ว' : 'ออกจากห้องแล้ว'))}>{joined ? 'เข้าร่วมแล้ว ✓' : '+ เข้าร่วมห้อง'}</button>
            <button className="btn btn-sm btn-s" style={{ flex: 1 }} onClick={() => nav(`/community/new?room=${id}`)}><Icon name="edit" size={16} />โพสต์ในห้องนี้</button>
          </div>
          <div className={s.rules}><b>กติกาห้อง</b>{r.rules.map((x, i) => <span key={x}><i>{i + 1}</i>{x}</span>)}</div>
        </div>
        <div className="sec"><div className="sec-h">โพสต์ในห้อง ({posts.length})</div></div>
        {posts.length ? posts.map((p, i) => <PostCard key={p.id} p={p} i={i} />) : <Empty icon="comment" title="ยังไม่มีโพสต์ในห้องนี้" text="เริ่มโพสต์แรกได้เลย" action={<Link to="/community/new" className="btn btn-p btn-sm">เขียนโพสต์</Link>} />}
      </div>
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
  return (
    <div className="page">
      <TopBar title="กิจกรรม" sub="ชาเลนจ์ อันดับ และภารกิจ" />
      <div className="narrow">
        <div className={s.chal} style={{ margin: '12px 16px 0' }}>
          <small>ชาเลนจ์ประจำสัปดาห์</small>
          <b>ประกวดภาพ “{CHALLENGE.prompt}” 🚀</b>
          <span>{CHALLENGE.note}</span>
          <Countdown />
          <button className="btn btn-sm" style={{ background: '#fff', color: '#6C2BD9', marginTop: 10, alignSelf: 'flex-start' }} onClick={() => nav('/community/new?challenge=1')}>ร่วมส่งผลงาน</button>
        </div>
        <div className="sec"><div className="sec-h">ผลงานที่ส่งเข้าประกวด<span className="more">โหวตได้ไม่จำกัด</span></div>
          <div className={s.ent}>
            {ENTRIES.map((e, i) => {
              const v = db.votes.includes(e.id)
              return (
                <div key={e.id} className={`${s.en} rise`} style={{ '--i': i } as React.CSSProperties}>
                  <Img src={e.img} />
                  <div className={s.enF}><Av src={creatorById(e.by).avatar} size={22} /><span className="ell">{creatorById(e.by).name}</span>
                    <button className={v ? s.on : ''} onClick={() => community.vote(e.id)} aria-label="โหวต"><span className={v ? 'heart-pop' : ''}><Icon name="heart" size={15} fill={v ? '#F0508A' : 'none'} color={v ? '#F0508A' : 'currentColor'} /></span>{e.votes + (v ? 1 : 0)}</button>
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
              <div key={m.id} className={s.mis}>
                <span className={done ? 'ok-ic' : s.misI}>{done ? <Icon name="check" size={14} stroke={3} /> : <Icon name="target" size={16} color="var(--p)" />}</span>
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
