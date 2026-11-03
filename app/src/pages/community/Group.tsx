import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, Sheet, TopBar, copyText } from '../../components/ui'
import { REAL } from '../../config'
import { ROOMS } from '../../data/appSeed'
import { ME, baht, creatorById, productById } from '../../data/sampleData'
import { heroOf } from '../../data/productExtras'
import { community } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { Composer, fmtK, memberCount, visiblePosts } from './Community'
import { PostCard, isVideo } from './PostCard'
import s from '../../social/Social.module.css'

type GTab = 'feed' | 'about' | 'members' | 'photos' | 'works'
const GTABS: [GTab, string][] = [['feed', 'สำหรับคุณ'], ['about', 'เกี่ยวกับ'], ['members', 'สมาชิก'], ['photos', 'รูปภาพ'], ['works', 'ผลงาน']]
const ROLE: Record<string, string> = { admin: 'แอดมิน', mod: 'ผู้ดูแล', member: 'สมาชิก' }

/** One group (replaces the old “ห้อง” page). Facebook-group layout from the approved mockup. */
export function Group() {
  const { id = '' } = useParams()
  const db = useDb()
  const nav = useNavigate()
  const r = ROOMS.find((x) => x.id === id)
  const [tab, setTab] = useState<GTab>('feed')
  const [members, setMembers] = useState<{ id: string; role: string }[]>([])
  const [menu, setMenu] = useState(false)
  const [inv, setInv] = useState(false)
  const joined = db.joined.includes(id)
  const asked = (db.requested ?? []).includes(id)
  useEffect(() => { let on = true; void community.members(id).then((m) => { if (on) setMembers(m) }); return () => { on = false } }, [id, joined])
  if (!r) return <><TopBar title="กลุ่ม" /><Empty icon="users" title="ไม่พบกลุ่มนี้" action={<Link to="/community?tab=groups" className="btn btn-o btn-sm">ดูกลุ่มทั้งหมด</Link>} /></>
  const posts = visiblePosts(db).filter((p) => p.roomId === id)
  const today = REAL ? posts.filter((p) => Date.now() - p.at < 86_400_000).length : r.today ?? 0
  const people = [...(joined && !members.some((m) => m.id === ME) ? [{ id: ME, role: 'member' }] : []), ...members]
  const photos = posts.flatMap((p) => p.images.map((m) => ({ m, post: p.id }))).filter((x) => !isVideo(x.m))
  const works = [...new Set(posts.flatMap((p) => p.productIds))].map((x) => productById(x)).filter(Boolean)
  const join = () => community.join(id).then((v) => toast(v ? `เข้าร่วม ${r.name} แล้ว` : asked ? 'ยกเลิกคำขอแล้ว' : (db.requested ?? []).includes(id) ? 'ส่งคำขอเข้าร่วมแล้ว' : `ออกจาก ${r.name} แล้ว`), (e: Error) => toast(e.message))
  return (
    <div className={`page ${s.pg}`} style={{ background: '#F0EEF5' }}>
      <div className={s.gcov}>
        <Img src={r.cover} eager />
        <button type="button" aria-label="ย้อนกลับ" onClick={() => (history.length > 1 ? nav(-1) : nav('/community?tab=groups'))}><Icon name="back" size={20} color="#fff" /></button>
      </div>
      <div className={s.gbody}>
        <h1>{r.name}</h1>
        <small><Icon name={r.privacy === 'private' ? 'lock' : 'globe'} size={13} />{r.privacy === 'private' ? 'กลุ่มส่วนตัว' : 'กลุ่มสาธารณะ'} · {fmtK(memberCount(r, joined))} สมาชิก · {today} โพสต์วันนี้</small>
        {people.length > 0 && <button type="button" className={s.avs} aria-label="ดูสมาชิก" onClick={() => setTab('members')}>{people.slice(0, 6).map((m) => <Av key={m.id} src={creatorById(m.id).avatar} size={30} />)}</button>}
        <div className={s.gbtns}>
          {joined
            ? <button type="button" className="btn btn-sm" style={{ background: '#F3ECFF', color: 'var(--p)' }} onClick={() => setMenu(true)}>✓ เข้าร่วมแล้ว ▾</button>
            : <button type="button" className={`btn btn-sm ${asked ? 'btn-o' : 'btn-p'}`} onClick={join}>{asked ? 'ส่งคำขอแล้ว' : '+ เข้าร่วมกลุ่ม'}</button>}
          <button type="button" className={`btn btn-sm ${joined ? 'btn-p' : 'btn-o'}`} onClick={() => (joined ? setInv(true) : toast('เข้าร่วมกลุ่มก่อน แล้วค่อยเชิญเพื่อนนะ'))}>+ เชิญเพื่อน</button>
        </div>
      </div>
      <div className={s.gtabs} role="tablist">
        {GTABS.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? s.on : ''} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      <div className="narrow">
        {tab === 'feed' && <>
          <div style={{ marginTop: 8 }}>{joined ? <Composer room={id} /> : (
            <div className={s.card} style={{ marginTop: 0, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}><span className="grow muted" style={{ fontSize: 15 }}>เข้าร่วมกลุ่มเพื่อโพสต์และคอมเมนต์</span><button type="button" className="btn btn-sm btn-p" onClick={join}>+ เข้าร่วม</button></div>
          )}</div>
          {r.announcement && <div className={s.pin}><small>📌 ประกาศจากแอดมิน</small><p>{r.announcement}</p></div>}
          {posts.length ? posts.map((p, i) => <PostCard key={p.id} p={p} i={i} inGroup />) : <div className={s.card}><Empty icon="comment" title="ยังไม่มีโพสต์ในกลุ่มนี้" text="เริ่มโพสต์แรกได้เลย" /></div>}
        </>}
        {tab === 'about' && (
          <div className={s.gAbout}>
            <h3>เกี่ยวกับกลุ่มนี้</h3>
            <p>{r.desc}</p>
            <span><Icon name={r.privacy === 'private' ? 'lock' : 'globe'} size={15} /> {r.privacy === 'private' ? 'ส่วนตัว · เฉพาะสมาชิกที่เห็นโพสต์' : 'สาธารณะ · ทุกคนเห็นโพสต์ในกลุ่มนี้'}</span>
            <span><Icon name="users" size={15} /> {memberCount(r, joined).toLocaleString('th-TH')} สมาชิก</span>
            <h3>กติกากลุ่ม</h3>
            <ol>{r.rules.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
        )}
        {tab === 'members' && (
          <div className={s.card}>
            <div className={s.secH}>สมาชิก · {fmtK(memberCount(r, joined))}</div>
            {people.length ? people.map((m) => (
              <Link key={m.id} to={`/creator/${m.id}`} className="list-row"><Av src={creatorById(m.id).avatar} size={40} /><span className="grow">{m.id === ME ? 'คุณ' : creatorById(m.id).name}<small>{ROLE[m.role] ?? 'สมาชิก'}</small></span></Link>
            )) : <Empty icon="users" title="ยังไม่มีรายชื่อสมาชิก" />}
          </div>
        )}
        {tab === 'photos' && (photos.length
          ? <div className={s.pgrid}>{photos.map((x, i) => <Link key={x.m + i} to={`/community/post/${x.post}`}><Img src={x.m} /></Link>)}</div>
          : <div className={s.card}><Empty icon="image" title="ยังไม่มีรูปภาพในกลุ่มนี้" /></div>)}
        {tab === 'works' && (works.length
          ? <div className={s.card} style={{ paddingBottom: 10 }}><div className={s.secH}>ผลงานที่แท็กในกลุ่ม</div>{works.map((pr) => (
            <Link key={pr!.id} to={`/product/${pr!.id}`} className={`${s.prod} press`} style={{ marginBottom: 8 }}>
              <Img src={heroOf(pr!)} className={s.prodI} />
              <span className="grow" style={{ minWidth: 0 }}><b className="ell">{pr!.title}</b><small>{creatorById(pr!.creatorId).name} · {pr!.price === 0 ? 'ฟรี' : baht(pr!.price)}</small></span>
              <span className="btn btn-xs btn-p">ดูผลงาน</span>
            </Link>))}</div>
          : <div className={s.card}><Empty icon="tag" title="ยังไม่มีผลงานที่แท็กในกลุ่มนี้" /></div>)}
        <div style={{ height: 24 }} />
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={r.name}>
        <div style={{ margin: '0 -16px' }}>
          <button className="list-row" style={{ width: '100%' }} onClick={() => { copyText(`${location.origin}${location.pathname}#/community/group/${id}`); setMenu(false); toast('คัดลอกลิงก์กลุ่มแล้ว') }}><Icon name="link" size={20} /><span className="grow">คัดลอกลิงก์กลุ่ม</span></button>
          <button className="list-row" style={{ width: '100%', color: '#DC2626' }} onClick={() => { setMenu(false); void join() }}><Icon name="x" size={20} color="#DC2626" /><span className="grow">ออกจากกลุ่ม</span></button>
        </div>
      </Sheet>
      <InviteSheet open={inv} onClose={() => setInv(false)} roomId={id} name={r.name} memberIds={people.map((m) => m.id)} />
    </div>
  )
}

function InviteSheet({ open, onClose, roomId, name, memberIds }: { open: boolean; onClose: () => void; roomId: string; name: string; memberIds: string[] }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<{ id: string; reason: string }[]>([])
  const [sent, setSent] = useState<string[]>([])
  useEffect(() => {
    if (!open) return
    let on = true
    const h = setTimeout(() => { void community.mentionCandidates(q).then((r) => { if (on) setList(r.filter((x) => x.id !== ME)) }) }, 120)
    return () => { on = false; clearTimeout(h) }
  }, [q, open, roomId])
  return (
    <Sheet open={open} onClose={onClose} title="เชิญเพื่อนเข้ากลุ่ม" sub={name} tall>
      <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อเพื่อน" aria-label="ค้นหาชื่อเพื่อน" style={{ marginBottom: 6 }} />
      {list.length === 0 && <p className="muted">ไม่พบคน · ลองพิมพ์ชื่ออื่น</p>}
      {[...list].sort((a, b) => Number(memberIds.includes(a.id)) - Number(memberIds.includes(b.id))).map((x) => {
        const c = creatorById(x.id), inG = memberIds.includes(x.id), done = sent.includes(x.id)
        return (
          <div key={x.id} className={s.invRow}>
            <Av src={c.avatar} size={40} /><span className="grow"><b>{c.name}</b><small>{inG ? 'อยู่ในกลุ่มแล้ว' : x.reason || ' '}</small></span>
            <button type="button" className={`btn btn-xs ${done || inG ? 'btn-o' : 'btn-p'}`} disabled={done || inG} aria-label={`เชิญ ${c.name}`}
              onClick={() => community.invite(roomId, x.id).then(() => { setSent((v) => [...v, x.id]); toast(`ส่งคำเชิญถึง ${c.name} แล้ว`) }, (e: Error) => toast(e.message))}>{done ? 'เชิญแล้ว' : inG ? 'สมาชิก' : 'เชิญ'}</button>
          </div>
        )
      })}
    </Sheet>
  )
}
