import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HeaderActions } from '../../components/Header'
import { Icon } from '../../components/Icon'
import { Av, Empty, SampleNote, Tabs, TopBar } from '../../components/ui'
import { ROOMS } from '../../data/appSeed'
import type { PostTag } from '../../data/appTypes'
import { ME, creatorById } from '../../data/sampleData'
import { CHALLENGE } from '../../data/searchData'
import { community } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { PostCard } from './PostCard'
import { Countdown, LEADERS } from './More'
import s from './Community.module.css'

type Tab = 'foryou' | 'following' | 'learn' | 'rooms'
const TAGS: (PostTag | 'all')[] = ['all', 'โชว์ผลงาน', 'ความรู้', 'เบื้องหลัง', 'ถาม-ตอบ', 'แจกฟรี']
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

export function Community() {
  const db = useDb()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'foryou'
  const setTab = (t: Tab) => setSp(t === 'foryou' ? {} : { tab: t }, { replace: true })
  const [tag, setTag] = useState<PostTag | 'all'>('all')
  const me = creatorById(ME)
  const posts = db.posts.filter((p) => tag === 'all' || p.tag === tag)

  const composer = (
    <button className={`${s.cmp} press`} onClick={() => nav('/community/new')}>
      <Av src={me.avatar} size={36} /><span className={s.cmpT}>แชร์ผลงาน เทคนิค หรือเบื้องหลัง…</span><Icon name="image" size={20} color="var(--p)" />
    </button>
  )

  return (
    <div className="page">
      <TopBar back={false} title="ชุมชน" sub="ข้อมูลตัวอย่าง" right={<HeaderActions search={false} />} />
      <Tabs sticky value={tab} onChange={setTab} options={[{ v: 'foryou', label: 'สำหรับคุณ' }, { v: 'following', label: 'ติดตาม' }, { v: 'learn', label: 'ความรู้' }, { v: 'rooms', label: 'ห้อง' }]} />
      <div key={tab} className="narrow tab-fade">
        {tab === 'foryou' && <>
          <div className="chips hscroll" style={{ padding: '12px 16px 2px' }}>{TAGS.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(t)}>{t === 'all' ? 'ทั้งหมด' : t}</button>)}</div>
          {composer}
          {posts.length === 0 && <Empty icon="comment" title="ยังไม่มีโพสต์ในหมวดนี้" />}
          {posts.map((p, i) => (
            <div key={p.id}>
              <PostCard p={p} i={i} />
              {i === 0 && tag === 'all' && <ChallengeCard />}
              {i === 2 && tag === 'all' && <LeaderCard />}
              {i === 3 && tag === 'all' && <RoomsSuggest />}
            </div>
          ))}
        </>}
        {tab === 'following' && <>
          <div className={`hscroll ${s.fw}`}>{db.follows.map((id) => <Link key={id} to={`/creator/${id}`}><Av src={creatorById(id).avatar} size={54} ring /><span className="ell">{creatorById(id).name}</span></Link>)}</div>
          {(() => {
            const list = db.posts.filter((p) => db.follows.includes(p.authorId) || p.authorId === ME)
            return list.length ? list.map((p, i) => <PostCard key={p.id} p={p} i={i} />) : <Empty icon="users" title="ยังไม่ได้ติดตามใคร" text="กดติดตามครีเอเตอร์ที่ชอบ โพสต์ของเขาจะขึ้นที่นี่" />
          })()}
        </>}
        {tab === 'learn' && <>
          <div className={s.live}>
            <span className={s.liveTag}><i />สอนฟรีวันนี้ · 20:00 น.</span>
            <b>เริ่มขายผลงานบน LUMI ใน 30 นาที</b>
            <small>โดย มิ้นท์ สตูดิโอ · ลงทะเบียนแล้ว 312 คน</small>
            <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--p)', alignSelf: 'flex-start', marginTop: 8 }} onClick={() => toast('บันทึกเตือนความจำในเครื่องแล้ว (ตัวอย่าง)')}>เตือนฉัน</button>
          </div>
          {composer}
          {db.posts.filter((p) => p.tag === 'ความรู้' || p.tag === 'เบื้องหลัง' || p.tag === 'ถาม-ตอบ').map((p, i) => <PostCard key={p.id} p={p} i={i} />)}
        </>}
        {tab === 'rooms' && <>
          <div className="sec"><div className="sec-h">ห้องของฉัน<span className="more">{db.joined.length} ห้อง</span></div></div>
          {ROOMS.filter((r) => db.joined.includes(r.id)).map((r, i) => <RoomRow key={r.id} id={r.id} i={i} />)}
          <div className="sec"><div className="sec-h">ห้องแนะนำ</div></div>
          {ROOMS.filter((r) => !db.joined.includes(r.id)).map((r, i) => <RoomRow key={r.id} id={r.id} i={i} />)}
        </>}
        <div style={{ padding: '16px' }}><SampleNote>โพสต์และตัวเลขเป็นข้อมูลตัวอย่าง</SampleNote></div>
      </div>
    </div>
  )
}

export function RoomRow({ id, i = 0 }: { id: string; i?: number }) {
  const db = useDb()
  const r = ROOMS.find((x) => x.id === id)!
  const joined = db.joined.includes(id)
  return (
    <div className={`${s.room} rise`} style={{ '--i': i } as React.CSSProperties}>
      <Link to={`/community/room/${id}`} className={s.roomL}>
        <span className={s.ric} style={{ background: r.bg }}><Icon name={r.icon} size={22} color={r.color} /></span>
        <span className="grow"><b>{r.name}</b><small>{fmtK(r.members + (joined ? 1 : 0))} สมาชิก · {r.desc}</small></span>
      </Link>
      <button className={`btn-follow ${joined ? 'on' : ''}`} onClick={() => community.join(id).then((v) => toast(v ? `เข้าร่วม ${r.name} แล้ว` : `ออกจาก ${r.name} แล้ว`))}>{joined ? 'เข้าร่วมแล้ว' : '+ เข้าร่วม'}</button>
    </div>
  )
}

function ChallengeCard() {
  return (
    <Link to="/community/activities" className={`${s.chal} press`}>
      <small>ชาเลนจ์ประจำสัปดาห์</small>
      <b>ประกวดภาพ “{CHALLENGE.prompt}” 🚀</b>
      <span>{CHALLENGE.note}</span>
      <Countdown />
      <div className={s.chalF}><span className={s.avs}>{CHALLENGE.avatars.map((a) => <Av key={a} src={creatorById(a).avatar} size={24} />)}</span>ส่งแล้ว {CHALLENGE.joined} ผลงาน<span className="btn btn-xs" style={{ marginLeft: 'auto', background: '#fff', color: '#6C2BD9' }}>ร่วมส่งผลงาน</span></div>
    </Link>
  )
}

function LeaderCard() {
  return (
    <Link to="/community/activities#rank" className={`${s.lead} press`}>
      <div className={s.leadH}><b>ดาวเด่นชุมชนสัปดาห์นี้</b><span>ดูอันดับ ›</span></div>
      <small className="muted">ได้แต้มจากการโพสต์ ช่วยตอบ และแชร์ความรู้</small>
      <div className={s.pod}>{[1, 0, 2].map((k) => { const l = LEADERS[k]; return <div key={l.id} className={k === 0 ? s.p1 : ''}><span>{['🥇', '🥈', '🥉'][k]}</span><Av src={creatorById(l.id).avatar} size={k === 0 ? 52 : 42} /><b className="ell">{creatorById(l.id).name}</b><small>{l.pts.toLocaleString('th-TH')} แต้ม</small></div> })}</div>
      <div className={s.myRank}>คุณอันดับ 14 · อีก 120 แต้ม ติดท็อป 10</div>
    </Link>
  )
}

function RoomsSuggest() {
  const db = useDb()
  const list = ROOMS.filter((r) => !db.joined.includes(r.id)).slice(0, 3)
  if (!list.length) return null
  return (
    <div className={s.sug}>
      <div className={s.leadH} style={{ padding: '0 16px' }}><b>ห้องที่น่าเข้าร่วม</b><Link to="/community?tab=rooms">ดูทั้งหมด</Link></div>
      {list.map((r) => <RoomRow key={r.id} id={r.id} />)}
    </div>
  )
}
