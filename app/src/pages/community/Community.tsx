import { canSee, refreshPresence } from '../../services/social'
import { rememberOrigin } from '../../services/motion'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HeaderActions } from '../../components/Header'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, SampleNote, TopBar } from '../../components/ui'
import { ROOMS } from '../../data/appSeed'
import type { DB, Room } from '../../data/appTypes'
import { ME, creatorById, imgUrl, productById } from '../../data/sampleData'
import { heroOf } from '../../data/productExtras'
import { CHALLENGE, MY_RANK } from '../../data/searchData'
import { community } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { ringOrder, storyGroups } from '../../services/storyGroups'
import { REAL, BRAND } from '../../config'
import { PostCard, isVideo } from './PostCard'
import { Countdown, LEADERS } from './More'
import c from './Community.module.css'
import s from '../../social/Social.module.css'

type Tab = 'foryou' | 'following' | 'groups' | 'learn'
const TABS: [Tab, string][] = [['foryou', 'สำหรับคุณ'], ['following', 'ติดตาม'], ['groups', 'กลุ่ม'], ['learn', 'ความรู้']]
export const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n))
export const memberCount = (r: Room, joined: boolean) => (REAL ? Math.max(r.members, joined ? 1 : 0) : r.members + (joined ? 1 : 0))
export const visiblePosts = (db: DB) => db.posts.filter((p) => !(db.hidden ?? []).includes(p.id) && !p.archivedAt && canSee(p))

/** “คุณกำลังคิดอะไรอยู่?” card (feed and group page). */
export function Composer({ room }: { room?: string }) {
  const nav = useNavigate()
  const go = (add?: string) => nav(`/community/new${room || add ? '?' : ''}${[room && `room=${room}`, add && `add=${add}`].filter(Boolean).join('&')}`)
  return (
    <div className={s.card} style={{ marginTop: 0 }}>
      <div className={s.cmp}>
        <Link to="/account" aria-label="โปรไฟล์ของฉัน"><Av src={creatorById(ME).avatar} size={40} /></Link>
        <button type="button" className={s.cmpPill} onClick={() => go()}>{room ? 'เขียนอะไรสักหน่อยในกลุ่มนี้…' : 'คุณกำลังคิดอะไรอยู่?'}</button>
        <button type="button" aria-label="เพิ่มรูปภาพ/วิดีโอ" onClick={() => go('media')}><Icon name="image" size={24} color="#16A34A" /></button>
      </div>
      <div className={s.cmpRow}>
        <button type="button" onClick={() => go('media')}><span className={s.emo}>🖼️</span>รูป/วิดีโอ</button>
        <button type="button" onClick={() => go('product')}><span className={s.emo}>🏷️</span>แท็กผลงาน</button>
        <button type="button" onClick={() => go('prompt')}><span className={s.emo}>✨</span>พรอมต์</button>
      </div>
    </div>
  )
}

/** Facebook-style story cards under the composer: “สร้างสตอรี่” then the people with live stories. */
function StoryCards() {
  const db = useDb()
  const list = ringOrder(db).filter((g) => g.creatorId !== ME)
  const bgOf = (g: ReturnType<typeof storyGroups>[number]) => {
    const sl = g.slides[0]
    if (sl?.media && !isVideo(sl.media)) return sl.media.startsWith('data:') || sl.media.startsWith('blob:') || sl.media.startsWith('http') ? sl.media : imgUrl(sl.media)
    const pr = sl?.productId ? productById(sl.productId) : undefined
    return imgUrl(pr ? heroOf(pr) : creatorById(g.creatorId).avatar)
  }
  return (
    <div className={s.stc} role="list" aria-label="สตอรี่">
      <Link to="/story/new" className={`${s.sc} ${s.scMe}`} role="listitem"><div className={s.scMeTop} style={{ backgroundImage: `url(${imgUrl(creatorById(ME).avatar)})` }} /><span className={s.plus}><Icon name="plus" size={18} color="#fff" stroke={2.6} /></span><b>สร้างสตอรี่</b></Link>
      {list.map((g) => (
        <Link key={g.creatorId} to={`/story/${g.creatorId}`} className={s.sc} role="listitem" data-zoom={`s:${g.creatorId}`} onClick={(e) => rememberOrigin(`s:${g.creatorId}`, e.currentTarget)} style={{ backgroundImage: `url(${bgOf(g)})` }}>
          <span className={s.scAv}><span style={{ backgroundImage: `url(${imgUrl(creatorById(g.creatorId).avatar)})` }} /></span><b>{creatorById(g.creatorId).name}</b>
        </Link>
      ))}
    </div>
  )
}

export function Community() {
  const db = useDb()
  const [remind, setRemind] = useState(() => !!localStorage.getItem('lumi_remind_live'))
  const [sp, setSp] = useSearchParams()
  const raw = sp.get('tab')
  const tab: Tab = raw === 'rooms' ? 'groups' : (raw as Tab) || 'foryou'
  const setTab = (t: Tab) => setSp(t === 'foryou' ? {} : { tab: t }, { replace: true })
  const posts = visiblePosts(db)
  const authors = [...new Set(posts.slice(0, 60).map((p) => p.authorId))].join(',')
  useEffect(() => { if (!authors) return; const go = () => void refreshPresence(authors.split(',')); go(); const t = setInterval(go, 60_000); return () => clearInterval(t) }, [authors])
  const learn = posts.filter((p) => p.tag === 'ความรู้' || p.tag === 'เบื้องหลัง' || p.tag === 'ถาม-ตอบ')
  return (
    <div className={`page ${s.pg}`}>
      <TopBar back={false} title="ชุมชน" sub={REAL ? undefined : 'ข้อมูลตัวอย่าง'} right={<HeaderActions search />} />
      <div className={s.tabs} role="tablist">
        {TABS.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? s.on : ''} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      <div key={tab} className="narrow tab-fade">
        {tab === 'foryou' && <>
          <Composer />
          <StoryCards />
          {posts.length === 0 && <div className={s.card}><Empty icon="comment" title="ยังไม่มีโพสต์" text="เริ่มโพสต์แรกของชุมชนได้เลย" action={<Link to="/community/new" className="btn btn-p btn-sm">เขียนโพสต์</Link>} /></div>}
          {posts.map((p, i) => (
            <div key={p.id}>
              <PostCard p={p} i={i} />
              {/* sample challenge and leaderboard: demo site only (no real challenge or points yet) */}
              {!REAL && i === 0 && <div className={s.card} style={{ padding: '4px 0' }}><ChallengeCard /></div>}
              {!REAL && i === 2 && <div className={s.card} style={{ padding: '4px 0' }}><LeaderCard /></div>}
              {i === 3 && <GroupSuggest onAll={() => { setTab('groups') }} />}
            </div>
          ))}
        </>}
        {tab === 'following' && <>
          {db.follows.length > 0 && <div className={s.card} style={{ marginTop: 0 }}><div className={`hscroll ${c.fw}`}>{db.follows.map((id) => <Link key={id} to={`/creator/${id}`}><Av src={creatorById(id).avatar} size={54} ring /><span className="ell">{creatorById(id).name}</span></Link>)}</div></div>}
          {(() => {
            const list = posts.filter((p) => db.follows.includes(p.authorId) || p.authorId === ME)
            return list.length ? list.map((p, i) => <PostCard key={p.id} p={p} i={i} />) : <div className={s.card}><Empty icon="users" title="ยังไม่ได้ติดตามใคร" text="กด “+ ติดตาม” ครีเอเตอร์ที่ชอบ โพสต์ของเขาจะขึ้นที่นี่" action={<button className="btn btn-o btn-sm" onClick={() => setTab('foryou')}>ดูโพสต์สำหรับคุณ</button>} /></div>
          })()}
        </>}
        {tab === 'groups' && <Groups />}
        {tab === 'learn' && <>
          {!REAL && <div className={c.live} style={{ margin: '0 0 8px', borderRadius: 0 }}>
            <span className={c.liveTag}><i />สอนฟรีวันนี้ · 20:00 น.</span>
            <b>เริ่มขายผลงานบน {BRAND} ใน 30 นาที</b>
            <small>โดย มิ้นท์ สตูดิโอ · ลงทะเบียนแล้ว {312 + (remind ? 1 : 0)} คน</small>
            <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--p)', alignSelf: 'flex-start', marginTop: 8 }} onClick={() => { const v = !remind; setRemind(v); localStorage.setItem('lumi_remind_live', v ? '1' : ''); toast(v ? 'ตั้งเตือนแล้ว จะแจ้งก่อนเริ่ม 15 นาที' : 'ยกเลิกการเตือนแล้ว') }}>{remind ? 'ตั้งเตือนแล้ว ✓' : 'เตือนฉัน'}</button>
          </div>}
          <Composer />
          {learn.map((p, i) => <PostCard key={p.id} p={p} i={i} />)}
          {!learn.length && <div className={s.card}><Empty icon="comment" title="ยังไม่มีโพสต์ความรู้" text="แชร์เทคนิค เบื้องหลัง หรือคำถามเป็นคนแรกได้เลย" action={<Link to="/community/new" className="btn btn-p btn-sm">เขียนโพสต์</Link>} /></div>}
        </>}
        {!REAL && <div style={{ padding: '16px' }}><SampleNote>โพสต์และตัวเลขเป็นข้อมูลตัวอย่าง</SampleNote></div>}
      </div>
    </div>
  )
}

export function JoinButton({ r, block, className }: { r: Room; block?: boolean; className?: string }) {
  const db = useDb()
  const joined = db.joined.includes(r.id)
  const asked = (db.requested ?? []).includes(r.id)
  return (
    <button type="button" className={className ?? `btn btn-sm ${joined || asked ? 'btn-o' : 'btn-p'} ${block ? 'btn-block' : ''}`} aria-pressed={joined}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        community.join(r.id).then((v) => {
          toast(v ? `เข้าร่วม ${r.name} แล้ว` : asked ? `ยกเลิกคำขอเข้าร่วม ${r.name} แล้ว` : `ออกจาก ${r.name} แล้ว`)
        }, (err: Error) => toast(err.message))
      }}>
      {joined ? 'เข้าร่วมแล้ว' : asked ? 'ส่งคำขอแล้ว' : '+ เข้าร่วม'}
    </button>
  )
}

function InviteBanner() {
  const db = useDb()
  const inv = (db.invites ?? []).filter((x) => !db.joined.includes(x.roomId))
  if (!inv.length) return null
  return <>{inv.map((x) => { const r = ROOMS.find((g) => g.id === x.roomId); if (!r) return null; return (
    <div key={x.roomId} className={s.gInvite}>
      <Av src={creatorById(x.by).avatar} size={40} />
      <span className="grow"><b>{creatorById(x.by).name}</b> เชิญคุณเข้ากลุ่ม <b>{r.name}</b></span>
      <button type="button" className="btn btn-xs btn-p" onClick={() => community.join(r.id).then(() => toast(`เข้าร่วม ${r.name} แล้ว`), (e: Error) => toast(e.message))}>ตอบรับ</button>
    </div>) })}</>
}

function Groups() {
  const db = useDb()
  const nav = useNavigate()
  const [sub, setSub] = useState<'mine' | 'find'>('mine')
  const mine = ROOMS.filter((r) => db.joined.includes(r.id))
  const others = ROOMS.filter((r) => !db.joined.includes(r.id))
  const feed = visiblePosts(db).filter((p) => p.roomId && db.joined.includes(p.roomId))
  return <>
    <div className={s.gpills}>
      <button type="button" className={sub === 'mine' ? s.on : ''} onClick={() => setSub('mine')}>กลุ่มของคุณ</button>
      <button type="button" className={sub === 'find' ? s.on : ''} onClick={() => setSub('find')}>ค้นพบ</button>
      <button type="button" onClick={() => toast('การสร้างกลุ่มใหม่ยังไม่เปิดให้ใช้ · ตอนนี้เข้าร่วมกลุ่มที่มีอยู่ได้เลย')}><Icon name="plus" size={14} />สร้างกลุ่ม</button>
    </div>
    <InviteBanner />
    {sub === 'mine' ? <>
      {mine.length > 0
        ? <div className={s.gmine}>{mine.map((r) => <Link key={r.id} to={`/community/group/${r.id}`}><span className={s.gico} style={{ background: r.bg }}><Icon name={r.icon} size={26} color={r.color} />{!REAL && (r.today ?? 0) > 20 && <i />}</span>{r.name}</Link>)}</div>
        : <p className="muted" style={{ padding: '4px 16px 12px', margin: 0, background: '#fff' }}>ยังไม่ได้เข้าร่วมกลุ่มไหน · เลือกจากกลุ่มแนะนำด้านล่างได้เลย</p>}
      {others.length > 0 && <div className={s.card}><div className={s.secH}>กลุ่มแนะนำสำหรับคุณ<button type="button" onClick={() => setSub('find')}>ดูทั้งหมด</button></div>
        <div className={s.sugg}>{others.slice(0, 4).map((r) => (
          <div key={r.id} className={s.gcard} onClick={() => nav(`/community/group/${r.id}`)}>
            <Img src={r.cover} />
            <div><b className="ell">{r.name}</b><small>{r.privacy === 'private' ? 'กลุ่มส่วนตัว' : 'กลุ่มสาธารณะ'} · {fmtK(memberCount(r, false))} สมาชิก</small><JoinButton r={r} block /></div>
          </div>))}</div></div>}
      <div className={s.secH} style={{ marginTop: 8, paddingBottom: 0 }}>โพสต์ล่าสุดจากกลุ่มของคุณ</div>
      {feed.length ? feed.map((p, i) => <PostCard key={p.id} p={p} i={i} />) : <div className={s.card}><Empty icon="users" title="ยังไม่มีโพสต์จากกลุ่มของคุณ" text="เข้าร่วมกลุ่ม แล้วโพสต์จากกลุ่มจะขึ้นที่นี่" /></div>}
    </> : (
      <div className={s.card} style={{ marginTop: 0 }}>
        <div className={s.secH}>ค้นพบกลุ่ม</div>
        <div className={s.gList}>
          {ROOMS.map((r) => (
            <Link key={r.id} to={`/community/group/${r.id}`} className={s.gRow}>
              <span className={s.gico} style={{ background: r.bg }}><Icon name={r.icon} size={24} color={r.color} /></span>
              <span className="grow" style={{ minWidth: 0 }}><b>{r.name}</b><small className="ell">{fmtK(memberCount(r, db.joined.includes(r.id)))} สมาชิก · {r.desc}</small></span>
              <JoinButton r={r} className={`btn-follow ${db.joined.includes(r.id) ? 'on' : ''}`} />
            </Link>
          ))}
        </div>
      </div>
    )}
  </>
}

function ChallengeCard() {
  return (
    <Link to="/community/activities" className={`${c.chal} press`}>
      <small>ชาเลนจ์ประจำสัปดาห์</small>
      <b>ประกวดภาพ “{CHALLENGE.prompt}” 🚀</b>
      <span>{CHALLENGE.note}</span>
      <Countdown />
      <div className={c.chalF}><span className={c.avs}>{CHALLENGE.avatars.map((a) => <Av key={a} src={creatorById(a).avatar} size={24} />)}</span>ส่งแล้ว {CHALLENGE.joined} ผลงาน<span className="btn btn-xs" style={{ marginLeft: 'auto', background: '#fff', color: '#6C2BD9' }}>ร่วมส่งผลงาน</span></div>
    </Link>
  )
}

function LeaderCard() {
  return (
    <Link to="/community/activities#rank" className={`${c.lead} press`}>
      <div className={c.leadH}><b>ดาวเด่นชุมชนสัปดาห์นี้</b><span>ดูอันดับ ›</span></div>
      <small className="muted">ได้แต้มจากการโพสต์ ช่วยตอบ และแชร์ความรู้</small>
      <div className={c.pod}>{[1, 0, 2].map((k) => { const l = LEADERS[k]; return <div key={l.id} className={k === 0 ? c.p1 : ''}><span>{['🥇', '🥈', '🥉'][k]}</span><Av src={creatorById(l.id).avatar} size={k === 0 ? 52 : 42} /><b className="ell">{creatorById(l.id).name}</b><small>{l.pts.toLocaleString('th-TH')} แต้ม</small></div> })}</div>
      <div className={c.myRank}>คุณอันดับ {MY_RANK.rank} · อีก {MY_RANK.toTop10} แต้ม ติดท็อป 10</div>
    </Link>
  )
}

function GroupSuggest({ onAll }: { onAll: () => void }) {
  const db = useDb()
  const nav = useNavigate()
  const list = ROOMS.filter((r) => !db.joined.includes(r.id)).slice(0, 4)
  if (!list.length) return null
  return (
    <div className={s.card}><div className={s.secH}>กลุ่มแนะนำสำหรับคุณ<button type="button" onClick={onAll}>ดูทั้งหมด</button></div>
      <div className={s.sugg}>{list.map((r) => (
        <div key={r.id} className={s.gcard} onClick={() => nav(`/community/group/${r.id}`)}>
          <Img src={r.cover} />
          <div><b className="ell">{r.name}</b><small>{r.privacy === 'private' ? 'กลุ่มส่วนตัว' : 'กลุ่มสาธารณะ'} · {fmtK(memberCount(r, false))} สมาชิก</small><JoinButton r={r} block /></div>
        </div>))}</div>
    </div>
  )
}
