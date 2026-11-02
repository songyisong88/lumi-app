import { useEffect, useRef, useState } from 'react'
import { FollowButton } from '../../components/FollowButton'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { HeaderActions } from '../../components/Header'
import { Icon } from '../../components/Icon'
import { MasonryFeed } from '../../components/MasonryFeed'
import { Av, Empty, Img, SampleNote, Seg, Sheet, TopBar } from '../../components/ui'
import { completion, SPECS } from '../../data/listingSpec'
import { creatorStats, heroOf, statsOf } from '../../data/productExtras'
import { ALL_PRODUCTS, CREATORS, ME, baht, creatorById } from '../../data/sampleData'
import { chat, resetAll } from '../../services/api'
import { useDb } from '../../services/db'
import { useFavorites } from '../../services/FavoritesContext'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import s from './Profile.module.css'

type Mode = 'buyer' | 'creator'
const HANDLE: Record<string, string> = { fasai: 'fasai.create', mint: 'mint.studio', nova: 'novalab', kenji: 'kenjiweb', pim: 'pimdao', toy: 'toymascot', ton: 'tondata' }
const BIO: Record<string, string> = {
  fasai: 'วาดภาพสีน้ำด้วย AI · ภาพดอกไม้ ลายไทย โทนพาสเทล 🌸', mint: 'เทมเพลต Canva สำหรับร้านเล็ก แก้ง่ายในมือถือ', nova: 'ทีมทำโปรแกรมและภาพ 3D สำหรับ SME ไทย',
  kenji: 'รับทำเว็บร้านค้า แอปจองคิว ส่งงานไว', pim: 'นักวาดสติกเกอร์ LINE ชิบะและแมวเหมียว', toy: 'ออกแบบมาสคอตร้านค้า น่ารักจำง่าย', ton: 'เครื่องมือ Google Sheets และชุดข้อมูลสำหรับธุรกิจ',
}

export function Profile() {
  const db = useDb()
  const savedPosts = db.posts.filter((x) => db.saved.includes(x.id))
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const mode: Mode = sp.get('mode') === 'creator' ? 'creator' : 'buyer'
  const setMode = (m: Mode) => { const n = new URLSearchParams(sp); n.set('mode', m); n.delete('tab'); setSp(n, { replace: true }) }
  const { ids } = useFavorites()
  const [settings, setSettings] = useState(false)
  const bought = useRef<HTMLDivElement>(null)
  useEffect(() => { if (sp.get('tab') === 'bought') setTimeout(() => bought.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350) }, [sp])
  const me = creatorById(ME)
  const mine = ALL_PRODUCTS.filter((p) => p.creatorId === ME)
  const todo = db.threads.filter((t) => t.role === 'customer' && t.tone === 'warn' || (t.role === 'customer' && t.status.includes('รอคุณ')))
  const sales = db.orders.length
  return (
    <div className="page">
      <TopBar back={false} title="โปรไฟล์" right={<><HeaderActions search={false} /><button className="tb-btn" onClick={() => setSettings(true)} aria-label="ตั้งค่า"><Icon name="gear" size={21} /></button></>} />
      <div className="narrow">
        <div className={s.me}>
          <Av src={me.avatar} size={68} ring />
          <div className={s.mm}>
            <b>{me.name}</b>
            <small>@{HANDLE[ME]} · ติดตาม {db.follows.length} · ผู้ติดตาม {creatorStats(ME).followersLabel}</small>
          </div>
          <Link to={`/creator/${ME}`} className="btn btn-o btn-xs">ดูหน้าร้าน</Link>
        </div>
        <div style={{ padding: '0 16px' }}><Seg value={mode} onChange={setMode} options={[{ v: 'buyer', label: 'โหมดผู้ซื้อ' }, { v: 'creator', label: 'โหมดครีเอเตอร์' }]} /></div>

        <div key={mode} className="tab-fade">
          {mode === 'buyer' ? (
            <>
              <Link to="/favorites" className={`${s.fav} press`}>
                <span className={s.favIc}><Icon name="heart" size={22} color="#fff" fill="#fff" /></span>
                <span className="grow"><b>ที่ชอบ</b>{' '}<small>{ids.length} ชิ้น · แตะเพื่อเปิดดูทั้งหมด</small></span>
                <Icon name="chev" size={18} color="var(--mut)" />
              </Link>
              <div ref={bought} className="sec" style={{ scrollMarginTop: 60 }}>
                <div className="sec-h">ซื้อแล้ว และดาวน์โหลด<span className="more">ทั้งหมด {db.purchases.length}</span></div>
                {db.purchases.length === 0 ? <Empty icon="receipt" title="ยังไม่มีรายการที่ซื้อ" text="ของที่ซื้อและของฟรีที่กดรับจะอยู่ที่นี่" action={<Link to="/" className="btn btn-p btn-sm">เลือกดูผลงาน</Link>} /> : (
                  <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
                    {db.purchases.map((b, i) => (
                      <div key={b.id} className={`list-row rise`} style={{ '--i': Math.min(i, 6) } as React.CSSProperties}>
                        <Img src={b.image} className={s.th} />
                        <Link to={b.productId.startsWith('offer') ? `/chat/${b.threadId}` : `/product/${b.productId}`} className="grow"><b className="ell" style={{ display: 'block' }}>{b.title}</b><small className="ell">{creatorById(b.creatorId).name} · {b.optionLabel ?? (b.price ? baht(b.price) : 'ฟรี')} · {ago(b.at)}</small></Link>
                        <button className="btn btn-xs btn-s" onClick={async () => nav(`/chat/${b.threadId ?? await chat.openWith(b.creatorId, b.productId)}`)}><Icon name="download" size={14} />เปิด</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="sec">
                <div className="sec-h">ครีเอเตอร์ที่ติดตาม<span className="more">{db.follows.length} คน</span></div>
                {db.follows.length === 0 ? <div className={s.emp}><p className="muted">ยังไม่ได้ติดตามใคร กด “+ ติดตาม” ที่หน้าผลงานหรือชุมชน</p><Link to="/search" className="btn btn-o btn-xs">ค้นหาครีเอเตอร์</Link></div> : (
                  <div className={`hscroll ${s.fl}`}>{db.follows.map((id) => { const c = creatorById(id); return c && <Link key={id} to={`/creator/${id}`} className="press"><Av src={c.avatar} size={58} /><span className="ell">{c.name}</span></Link> })}</div>
                )}
              </div>
              <div className="sec">
                <div className="sec-h">โพสต์ที่บันทึก<span className="more">{savedPosts.length} โพสต์</span></div>
                {savedPosts.length === 0 ? <div className={s.emp}><p className="muted">ยังไม่มีโพสต์ที่บันทึก กด “บันทึก” ใต้โพสต์ในชุมชน</p><Link to="/community" className="btn btn-o btn-xs">ไปที่ชุมชน</Link></div> : (
                  <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>{savedPosts.map((p) => (
                    <Link key={p.id} to={`/community/post/${p.id}`} className="list-row"><Av src={creatorById(p.authorId).avatar} size={36} /><span className="grow"><b className="ell" style={{ display: 'block' }}>{p.text}</b><small className="ell">{creatorById(p.authorId).name} · {ago(p.at)}</small></span><Icon name="chev" size={16} color="var(--mut)" /></Link>
                  ))}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={s.inc}>
                <small>รายได้เดือนนี้ (พ.ย.) · ตัวอย่าง</small>
                <b>{baht(12480)}</b>
                <span>↑ 18% · ขายได้ {41 + sales} ชิ้น</span>
                <div className={s.wd}><span>ถอนได้ <b>฿8,200</b></span><button className="btn btn-xs" style={{ background: '#fff', color: 'var(--p)' }} onClick={() => toast('ถอนเงินจะเปิดใช้เร็ว ๆ นี้ หลังเชื่อมบัญชีรับเงิน')}>ถอนเงิน · เร็ว ๆ นี้</button></div>
              </div>
              <div className="sec">
                <div className="sec-h">ต้องทำวันนี้<span className="pill pill-r">{todo.length} งาน</span></div>
                {todo.length === 0 ? <p className="muted">ไม่มีงานค้าง เยี่ยมมาก 🎉</p> : todo.map((t) => (
                  <Link key={t.id} to={`/chat/${t.id}`} className={`${s.todo} press`}>
                    <Av src={creatorById(t.partnerId).avatar} size={40} />
                    <span className="grow"><b className="ell">{t.title}</b><small>{creatorById(t.partnerId).name} · {t.status}</small></span>
                    <span className="btn btn-xs btn-p">เปิด</span>
                  </Link>
                ))}
              </div>
              {db.drafts.length > 0 && (
                <div className="sec">
                  <div className="sec-h">ร่างที่ยังไม่ลงขาย<Link to="/sell/drafts" className="more">ทั้งหมด</Link></div>
                  {db.drafts.slice(0, 3).map((d) => {
                    const pct = completion(d)
                    return (
                      <Link key={d.id} to={`/sell?draft=${d.id}`} className={`${s.todo} press`}>
                        <Img src={d.covers[0]} className={s.th} />
                        <span className="grow"><b className="ell">{d.title || 'ยังไม่ตั้งชื่อ'}</b><small>{d.type ? SPECS[d.type].name : 'ยังไม่เลือกประเภท'} · ครบ {pct}%</small><span className={s.pb}><i style={{ transform: `scaleX(${pct / 100})` }} /></span></span>
                        <span className="btn btn-xs btn-s">ทำต่อ</span>
                      </Link>
                    )
                  })}
                </div>
              )}
              <div className="sec">
                <div className="sec-h">ผลงานของฉัน ({mine.length})</div>
                <div className={s.grid}>
                  {mine.map((p) => (
                    <Link key={p.id} to={`/product/${p.id}`} className={`${s.gi} press`}>
                      <Img src={heroOf(p)} />
                      <span className={s.gl}>{p.price === 0 ? 'ฟรี' : `♥ ${statsOf(p).likes}`}</span>
                      {p.mine && <span className={s.gn}>ใหม่</span>}
                    </Link>
                  ))}
                  <Link to="/sell" className={`${s.gi} ${s.add} press`}><Icon name="plus" size={26} color="var(--p)" /><span>ลงผลงานใหม่</span></Link>
                </div>
              </div>
            </>
          )}
          <div className="sec">
            <div className="sec-h">บัญชี</div>
            <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
              {[['user', 'ตั้งค่าบัญชี', 'ชื่อ อีเมล รหัสผ่าน'], ['wallet', 'บัญชีรับเงินและการชำระเงิน', 'ยังไม่ได้เชื่อม'], ['bell', 'การแจ้งเตือน', ''], ['lock', 'ความเป็นส่วนตัวและความปลอดภัย', ''], ['chat', 'ช่วยเหลือและติดต่อ LUMI', '']].map(([ic, t, sub]) => (
                <button key={t} className="list-row" onClick={() => (ic === 'bell' ? nav('/notifications') : toast(`${t} จะเปิดใช้เร็ว ๆ นี้`))}>
                  <Icon name={ic} size={20} color="var(--ink2)" /><span className="grow">{t}{sub && <small>{sub}</small>}</span>{ic !== 'bell' && <span className="pill">เร็ว ๆ นี้</span>}<Icon name="chev" size={16} color="var(--mut)" />
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 16px 0' }}><SampleNote>บัญชีตัวอย่าง · ข้อมูลเก็บในเครื่องนี้เท่านั้น</SampleNote></div>
        </div>
      </div>
      <Sheet open={settings} onClose={() => setSettings(false)} title="ตั้งค่า">
        <button className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }} onClick={() => { resetAll(); setSettings(false); toast('รีเซ็ตข้อมูลตัวอย่างแล้ว') }}><Icon name="refresh" size={20} />รีเซ็ตข้อมูลตัวอย่างทั้งหมด<small style={{ marginLeft: 'auto' }}>ตะกร้า แชต ร่าง</small></button>
        <p className="hint">ใช้ตอนอยากเริ่มทดลองใหม่ ข้อมูลทั้งหมดอยู่ในเครื่องนี้ ไม่ได้ส่งไปที่ไหน</p>
      </Sheet>
    </div>
  )
}

/** Public creator page (also “ดูหน้าร้าน” of the signed-in user). */
export function CreatorPage() {
  const { id = '' } = useParams()
  const db = useDb()
  const nav = useNavigate()
  const c = CREATORS.find((x) => x.id === id)
  if (!c) return <><TopBar title="ครีเอเตอร์" /><Empty icon="user" title="ไม่พบครีเอเตอร์" action={<Link to="/search" className="btn btn-o btn-sm">ค้นหาครีเอเตอร์</Link>} /></>
  const works = ALL_PRODUCTS.filter((p) => p.creatorId === id)
  const posts = db.posts.filter((p) => p.authorId === id)
  const isMe = id === ME
  const st = creatorStats(id, db.follows.includes(id))
  return (
    <div className="page">
      <TopBar title={c.name} sub={`${works.length} ผลงาน`} />
      <div className={s.cover} style={{ backgroundImage: works[0] ? `url(${import.meta.env.BASE_URL}img/${heroOf(works[0])})` : undefined }} />
      <div className="narrow">
        <div className={s.ch}>
          <Av src={c.avatar} size={84} ring />
          <div className={s.cb}>
            {isMe ? <button className="btn btn-sm btn-o" onClick={() => nav('/profile?mode=creator')}>จัดการร้าน</button> : <>
              <button className="btn btn-sm btn-o" onClick={async () => nav(`/chat/${await chat.openWith(id)}`)}><Icon name="chat" size={16} />แชต</button>
              <FollowButton id={id} style={{ height: 36 }} />
            </>}
          </div>
        </div>
        <div style={{ padding: '0 16px' }}>
          <h1 className={s.cn}>{c.name}<span className={s.vb}><Icon name="check" size={10} color="#fff" stroke={3.4} /></span></h1>
          <p className="muted">@{HANDLE[id] ?? id}</p>
          <p className={s.bio}>{BIO[id] ?? 'ลูกค้า LUMI'}</p>
          <div className={s.stats}><span><b>{works.length}</b>ผลงาน</span><span><b>{st.followersLabel}</b>ผู้ติดตาม</span><span><b>{st.rating ? st.rating.toFixed(1) : '–'}</b>คะแนน</span><span><b>{posts.length}</b>โพสต์</span></div>
        </div>
        <div className="sec"><div className="sec-h">ผลงาน</div>{works.length ? <MasonryFeed items={works} /> : <Empty icon="store" title="ยังไม่มีผลงานขาย" action={isMe ? <Link to="/sell" className="btn btn-p btn-sm">ลงผลงานแรก</Link> : undefined} />}</div>
      </div>
    </div>
  )
}
