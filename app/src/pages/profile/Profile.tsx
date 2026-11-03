import { openFromCard } from '../../components/ProductCard'
import { useEffect, useRef, useState } from 'react'
import { FollowButton } from '../../components/FollowButton'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { HeaderActions } from '../../components/Header'
import { Icon } from '../../components/Icon'
import { isCloud } from '../../services/session'
import { FEATURES, REAL, BRAND } from '../../config'
import { loadProfiles } from '../../services/cloud'
import { MasonryFeed } from '../../components/MasonryFeed'
import { ReportButton } from '../../components/Report'
import { ISSUE_DAYS, IssueSheet, WriteReviewSheet, issueOpen } from '../../components/OrderHelp'
import { Av, Empty, Img, SampleNote, Seg, Sheet, Stars, TopBar } from '../../components/ui'
import { completion, SPECS } from '../../data/listingSpec'
import { creatorStats, heroOf, statsOf } from '../../data/productExtras'
import { ALL_PRODUCTS, CREATORS, ME, baht, creatorById, imgUrl, isLive, isRemoteId, remoteCreator } from '../../data/sampleData'
import { chat, resetAll } from '../../services/api'
import { useDb } from '../../services/db'
import { useFavorites } from '../../services/FavoritesContext'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import s from './Profile.module.css'

type Mode = 'buyer' | 'creator'
const productImg = (id: string) => { const p = ALL_PRODUCTS.find((x) => x.id === id); return p ? heroOf(p) : undefined }
/** SAMPLE DATA: past sales shown in creator mode on the demo site (the real site shows only real sales). */
const SHOP_SALES = REAL ? [] : [
  { no: 'LM-20476', pid: 'p01', who: 'ลูกค้าร้านกาแฟ', amt: 390, st: 'ส่งไฟล์แล้ว · รอพ้น 7 วัน', tone: 'info' },
  { no: 'LM-20451', pid: 'p01', who: 'ร้านดอกไม้ป้าแดง', amt: 159, st: 'เข้ายอดรอโอนแล้ว', tone: 'done' },
]
const HANDLE: Record<string, string> = { fasai: 'fasai.create', mint: 'mint.studio', nova: 'novalab', kenji: 'kenjiweb', pim: 'pimdao', toy: 'toymascot', ton: 'tondata' }
const BIO: Record<string, string> = {
  fasai: 'วาดภาพสีน้ำด้วย AI · ภาพดอกไม้ ลายไทย โทนพาสเทล 🌸', mint: 'เทมเพลต Canva สำหรับร้านเล็ก แก้ง่ายในมือถือ', nova: 'ทีมทำโปรแกรมและภาพ 3D สำหรับ SME ไทย',
  kenji: 'รับทำเว็บร้านค้า แอปจองคิว ส่งงานไว', pim: 'ครีเอเตอร์สติกเกอร์ LINE ชิบะและแมวเหมียว', toy: 'ออกแบบมาสคอตร้านค้า น่ารักจำง่าย', ton: 'เครื่องมือ Google Sheets และชุดข้อมูลสำหรับธุรกิจ',
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
  const [act, setAct] = useState<{ id: string; sheet: 'menu' | 'issue' | 'review' } | null>(null)
  const actB = act ? db.purchases.find((x) => x.id === act.id) : undefined
  useEffect(() => setAct(null), [mode])
  const bought = useRef<HTMLDivElement>(null)
  useEffect(() => { if (sp.get('tab') === 'bought') setTimeout(() => bought.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350) }, [sp])
  const me = creatorById(ME)
  const mine = ALL_PRODUCTS.filter((p) => p.creatorId === ME)
  const todo = db.threads.filter((t) => t.role === 'customer' && t.tone === 'warn' || (t.role === 'customer' && t.status.includes('รอคุณ')))
  const sales = db.orders.length
  // real site: this month's income, sold count and pending payout come from the server sales (db.sales)
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const real = db.sales ?? []
  const monthSales = real.filter((x) => x.at >= monthStart && x.payout !== 'refunded')
  const inc = { label: now.toLocaleDateString('th-TH', { month: 'short' }), total: monthSales.reduce((a, x) => a + x.net, 0), count: monthSales.length, pending: real.filter((x) => x.payout === 'held' || x.payout === 'released').reduce((a, x) => a + x.net, 0) }
  const PAYOUT: Record<string, [string, string]> = { held: ['ส่งไฟล์แล้ว · รอพ้น 7 วัน', 'info'], released: ['เข้ายอดรอโอนแล้ว', 'done'], paid_out: ['โอนเข้าบัญชีแล้ว', 'done'], refunded: ['คืนเงินแล้ว', 'warn'], disputed: ['ผู้ซื้อแจ้งปัญหา', 'warn'] }
  return (
    <div className="page">
      <TopBar back={false} title="โปรไฟล์" right={<><HeaderActions search={false} /><button className="tb-btn" onClick={() => setSettings(true)} aria-label="ตั้งค่า"><Icon name="gear" size={21} /></button></>} />
      <div className="narrow">
        <div className={s.me}>
          <Av src={me.avatar} size={68} ring />
          <div className={s.mm}>
            <b>{me.name}</b>
            <small>{(HANDLE[ME] ?? me.handle) && <><span className="nw">@{HANDLE[ME] ?? me.handle}</span> · </>}<span className="nw">ติดตาม {db.follows.length}</span> · <span className="nw">ผู้ติดตาม {creatorStats(ME).followersLabel}</span></small>
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
                <div className="sec-h">ซื้อแล้ว<Link to="/library" className="more" data-open-library>คลังของที่ซื้อ ›</Link></div>
                {db.purchases.length === 0 ? <Empty icon="receipt" title="ยังไม่มีรายการที่ซื้อ" text="ของที่ซื้อและของฟรีที่กดรับจะอยู่ที่นี่" action={<Link to="/" className="btn btn-p btn-sm">เลือกดูผลงาน</Link>} /> : (
                  <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
                    {db.purchases.map((b, i) => (
                      <div key={b.id} className={`list-row rise`} style={{ '--i': Math.min(i, 6) } as React.CSSProperties}>
                        <Img src={b.image} className={s.th} />
                        <Link to={b.productId.startsWith('offer') ? `/chat/${b.threadId}` : `/product/${b.productId}`} className="grow"><b className="ell" style={{ display: 'block' }}>{b.title}</b><small className="ell">{creatorById(b.creatorId).name} · {b.optionLabel && b.optionLabel !== 'ของฟรี' ? `${b.optionLabel} · ` : ''}{b.price ? baht(b.price) : 'ฟรี'} · {ago(b.at)}</small>{(b.issue || b.review) && <small className="ell" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>{b.issue && <span className="pill pill-r">แจ้งปัญหาแล้ว</span>}{b.review && <Stars v={b.review.stars} size={11} />}</small>}</Link>
                        <Link to={`/library/${b.id}`} className="btn btn-xs btn-s"><Icon name="download" size={14} />ไฟล์</Link>
                        <button className="tb-btn" style={{ width: 34, height: 34 }} aria-label={`จัดการรายการ ${b.title}`} data-order-menu={b.id} onClick={() => setAct({ id: b.id, sheet: 'menu' })}><Icon name="dots" size={19} /></button>
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
                {savedPosts.length === 0 ? <div className={s.emp}><p className="muted">ยังไม่มีโพสต์ที่บันทึก กด ⋯ บนโพสต์ในชุมชน แล้วเลือก “บันทึกโพสต์”</p><Link to="/community" className="btn btn-o btn-xs">ไปที่ชุมชน</Link></div> : (
                  <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>{savedPosts.map((p) => (
                    <Link key={p.id} to={`/community/post/${p.id}`} className="list-row"><Av src={creatorById(p.authorId).avatar} size={36} /><span className="grow"><b className="ell" style={{ display: 'block' }}>{p.text}</b><small className="ell">{creatorById(p.authorId).name} · {ago(p.at)}</small></span><Icon name="chev" size={16} color="var(--mut)" /></Link>
                  ))}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={s.inc}>
                <small>{REAL ? `รายได้เดือนนี้ (${inc.label})` : 'รายได้เดือนนี้ (พ.ย.) · ตัวอย่าง'}</small>
                <b>{baht(REAL ? inc.total : 12480)}</b>
                <span>{REAL ? `ขายได้ ${inc.count} ชิ้น` : `↑ 18% · ขายได้ ${41 + sales} ชิ้น`}</span>
                <div className={s.wd}><span>ยอดรอโอน <b>{REAL ? baht(inc.pending) : '฿8,200'}</b></span><button className="btn btn-xs" style={{ background: '#fff', color: 'var(--p)' }} onClick={() => toast('การโอนเงินเข้าบัญชีจะเปิดใช้เร็ว ๆ นี้ หลังเชื่อมบัญชีรับเงิน')}>โอนเข้าบัญชี · เร็ว ๆ นี้</button></div>
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
              <div className="sec" data-shop-orders>
                <div className="sec-h">ออเดอร์ของร้าน{!REAL && <span className="more">ตัวอย่าง</span>}</div>
                <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
                  {[...db.threads.filter((t) => t.role === 'customer' && t.orderNo).map((t) => ({ k: t.id, to: `/chat/${t.id}`, img: t.image, title: t.title, sub: `${creatorById(t.partnerId).name} · #${t.orderNo} · ${t.amount ? baht(t.amount) : 'ฟรี'}`, st: t.status, tone: t.tone })),
                    ...(REAL ? real.filter((x) => !db.threads.some((t) => t.orderNo === x.orderNo)).map((x) => ({ k: x.id, to: x.productId ? `/product/${x.productId}` : '/profile?mode=creator', img: (x.productId && productImg(x.productId)) || 'g_lotus.jpg', title: x.title, sub: `${creatorById(x.buyerId).name} · #${x.orderNo} · ${x.gross ? baht(x.gross) : 'ฟรี'}`, st: PAYOUT[x.payout]?.[0] ?? '', tone: PAYOUT[x.payout]?.[1] ?? 'info' })) : []),
                    ...SHOP_SALES.map((x) => ({ k: x.no, to: `/product/${x.pid}`, img: heroOf(ALL_PRODUCTS.find((p) => p.id === x.pid)!), title: ALL_PRODUCTS.find((p) => p.id === x.pid)!.title, sub: `${x.who} · #${x.no} · ${baht(x.amt)}`, st: x.st, tone: x.tone }))].map((o) => (
                    <Link key={o.k} to={o.to} className="list-row">
                      <Img src={o.img} className={s.th} />
                      <span className="grow"><b className="ell" style={{ display: 'block' }}>{o.title}</b><small className="ell" style={{ display: 'block' }}>{o.sub}</small><small className="ell" style={{ display: 'block', fontWeight: 600, color: o.tone === 'warn' ? '#B45309' : o.tone === 'done' || o.tone === 'ok' ? '#15803D' : 'var(--p)' }}>{o.st}</small></span>
                      <Icon name="chev" size={16} color="var(--mut)" />
                    </Link>
                  ))}
                </div>
                <p className="hint" style={{ marginTop: 8 }}>ไฟล์ส่งให้ผู้ซื้ออัตโนมัติ · เงินเข้ายอดรอโอนเมื่อพ้นระยะแจ้งปัญหา 7 วัน (งานจ้าง: เมื่อลูกค้ากดรับงาน)</p>
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
                    <Link key={p.id} to={`/product/${p.id}`} className={`${s.gi} press`} data-zoom={`p:${p.id}`} onClick={(e) => openFromCard(e.currentTarget, p.id)}>
                      <Img src={heroOf(p)} />
                      <span className={s.gl}>{p.price === 0 ? 'ฟรี' : `♥ ${statsOf(p).likes}`}</span>
                      {p.rev ? <span className={s.gn} data-mod={`rev-${p.rev.status}`} style={{ background: p.rev.status === 'pending' ? '#B45309' : '#DC2626' }}>{p.rev.status === 'pending' ? 'แก้ไขรอตรวจ' : 'แก้ไขไม่ผ่าน'}</span> : p.mod?.status === 'pending' ? <span className={s.gn} data-mod="pending" style={{ background: '#B45309' }}>รอตรวจ</span> : p.mod?.status === 'rejected' ? <span className={s.gn} data-mod="rejected" style={{ background: '#DC2626' }}>ไม่ผ่าน</span> : p.mine && <span className={s.gn}>ใหม่</span>}
                    </Link>
                  ))}
                  <Link to="/sell" className={`${s.gi} ${s.add} press`}><Icon name="plus" size={26} color="var(--p)" /><span>ลงขายผลงาน</span></Link>
                </div>
              </div>
            </>
          )}
          <div className="sec">
            <div className="sec-h">บัญชี</div>
            <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
              {[['user', 'ตั้งค่าบัญชี', 'ชื่อ อีเมล รหัสผ่าน'], ['wallet', 'บัญชีรับเงินและการชำระเงิน', 'ยังไม่ได้เชื่อม'], ['bell', 'การแจ้งเตือน', ''], ['lock', 'ความเป็นส่วนตัวและความปลอดภัย', ''], ['chat', `ช่วยเหลือและติดต่อ ${BRAND}`, '']].map(([ic, t, sub]) => (
                <button key={t} className="list-row" onClick={() => (ic === 'bell' ? nav('/notifications') : FEATURES.accounts && ic === 'user' ? nav(isCloud() ? '/account' : '/account/login') : toast(`${t} จะเปิดใช้เร็ว ๆ นี้`))}>
                  <Icon name={ic} size={20} color="var(--ink2)" /><span className="grow">{t}{sub && <small>{sub}</small>}</span>{ic !== 'bell' && !(FEATURES.accounts && ic === 'user') && <span className="pill">เร็ว ๆ นี้</span>}<Icon name="chev" size={16} color="var(--mut)" />
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 16px 0' }}><SampleNote>บัญชีตัวอย่าง · ข้อมูลเก็บในเครื่องนี้เท่านั้น</SampleNote></div>
        </div>
      </div>
      <Sheet open={act?.sheet === 'menu' && !!actB} onClose={() => setAct(null)} title={actB?.title} sub={actB ? `ออเดอร์ #${actB.orderNo} · ${actB.price ? baht(actB.price) : 'ฟรี'} · ${ago(actB.at)}` : ''}>
        {actB && <div>
          {actB.issue && <div className="hint" style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}><b>แจ้งปัญหาแล้ว: {actB.issue.reason}</b><br />{actB.issue.status}</div>}
          <button className="list-row" style={{ width: '100%' }} onClick={() => { setAct(null); nav(`/library/${actB.id}`) }}><Icon name="download" size={20} color="var(--p)" /><span className="grow">เปิดไฟล์และคีย์<small>ในคลังของที่ซื้อ · พร้อมใบเสร็จ</small></span></button>
          <button className="list-row" style={{ width: '100%' }} onClick={async () => { const id = actB.threadId ?? await chat.openWith(actB.creatorId, actB.productId); setAct(null); nav(`/chat/${id}`) }}><Icon name="chat" size={20} /><span className="grow">ทักครีเอเตอร์<small>{creatorById(actB.creatorId).name}</small></span></button>
          {!actB.productId.startsWith('offer') && <button className="list-row" style={{ width: '100%' }} onClick={() => { setAct(null); nav(`/product/${actB.productId}`) }}><Icon name="store" size={20} />ดูหน้าผลงาน</button>}
          <button className="list-row" style={{ width: '100%' }} onClick={() => setAct({ id: actB.id, sheet: 'review' })}><Icon name="star" size={20} color="#F5A524" /><span className="grow">{actB.review ? 'แก้ไขรีวิว' : 'เขียนรีวิว'}{actB.review && <small><Stars v={actB.review.stars} size={11} /> {actB.review.text || 'ไม่มีข้อความ'}</small>}</span></button>
          {actB.optionLabel === 'งานจ้าง'
            ? actB.threadId && <button className="list-row" style={{ width: '100%' }} onClick={() => { setAct(null); nav(`/chat/${actB.threadId}`) }}><Icon name="flag" size={20} color="#DC2626" /><span className="grow">แจ้งปัญหางานจ้าง<small>แจ้งในแชตงานจ้าง เมนู ⋯</small></span></button>
            : !actB.issue && <button className="list-row" style={{ width: '100%', color: issueOpen(actB.at) ? '#DC2626' : undefined }} disabled={!issueOpen(actB.at)} onClick={() => setAct({ id: actB.id, sheet: 'issue' })}><Icon name="flag" size={20} color={issueOpen(actB.at) ? '#DC2626' : 'var(--mut)'} /><span className="grow">{actB.price ? 'แจ้งปัญหา / ขอคืนเงิน' : 'แจ้งปัญหา'}<small>{issueOpen(actB.at) ? `แจ้งได้ภายใน ${ISSUE_DAYS} วันหลังซื้อ` : `เกิน ${ISSUE_DAYS} วันแล้ว · ทักครีเอเตอร์ในแชตได้`}</small></span></button>}
        </div>}
      </Sheet>
      <IssueSheet open={act?.sheet === 'issue'} onClose={() => setAct(null)} purchaseId={act?.id} />
      {actB && <WriteReviewSheet open={act?.sheet === 'review'} onClose={() => setAct(null)} purchaseId={actB.id} initial={actB.review} />}
      <Sheet open={settings} onClose={() => setSettings(false)} title="ตั้งค่า">
        {FEATURES.accounts
          ? <button className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }} onClick={() => { setSettings(false); nav(isCloud() ? '/account' : '/account/login') }}><Icon name="user" size={20} /><span className="grow">บัญชีและการเข้าสู่ระบบ<small>{isCloud() ? 'โปรไฟล์ อีเมล รหัสผ่าน และขอลบบัญชี' : 'สมัคร หรือเข้าสู่ระบบด้วยอีเมล'}</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>
          : <div className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }}><Icon name="user" size={20} /><span className="grow">บัญชีและการเข้าสู่ระบบ<small>สมัคร เข้าสู่ระบบ ใบเสร็จทางอีเมล และขอลบบัญชี จะเปิดพร้อมระบบบัญชีจริง</small></span><span className="pill">เร็ว ๆ นี้</span></div>}
        {!REAL && <><button className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }} onClick={() => { resetAll(); setSettings(false); toast('รีเซ็ตข้อมูลตัวอย่างแล้ว') }}><Icon name="refresh" size={20} />รีเซ็ตข้อมูลตัวอย่างทั้งหมด<small style={{ marginLeft: 'auto' }}>ตะกร้า แชต ร่าง</small></button>
        <p className="hint">ใช้ตอนอยากเริ่มทดลองใหม่ ข้อมูลทั้งหมดอยู่ในเครื่องนี้ ไม่ได้ส่งไปที่ไหน</p></>}
      </Sheet>
    </div>
  )
}

/** Public creator page (also “ดูหน้าร้าน” of the signed-in user). */
export function CreatorPage() {
  const { id = '' } = useParams()
  const db = useDb()
  const nav = useNavigate()
  const c = CREATORS.find((x) => x.id === id) ?? remoteCreator(id)
  // real accounts (e.g. LUMI OFFICIAL): load the profile when the page is opened directly
  const [, bump] = useState(0)
  useEffect(() => { if (!c && isRemoteId(id)) void loadProfiles([id]).then(() => bump((n) => n + 1), () => {}) }, [c, id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <><TopBar title="ครีเอเตอร์" /><Empty icon="user" title="ไม่พบครีเอเตอร์" action={<Link to="/search" className="btn btn-o btn-sm">ค้นหาครีเอเตอร์</Link>} /></>
  const works = ALL_PRODUCTS.filter((p) => p.creatorId === id && isLive(p))
  const posts = db.posts.filter((p) => p.authorId === id)
  const isMe = id === ME
  const st = creatorStats(id, db.follows.includes(id))
  return (
    <div className="page">
      <TopBar title={c.name} sub={`${works.length} ผลงาน`} />
      <div className={s.cover} style={{ backgroundImage: works[0] ? `url(${imgUrl(heroOf(works[0]))})` : undefined }} />
      <div className="narrow">
        <div className={s.ch}>
          <Av src={c.avatar} size={84} ring />
          <div className={s.cb}>
            {isMe ? <button className="btn btn-sm btn-o" onClick={() => nav('/profile?mode=creator')}>จัดการร้าน</button> : <>
              <button className="btn btn-sm btn-o" onClick={async () => nav(`/chat/${await chat.openWith(id)}`)}><Icon name="chat" size={16} />แชต</button>
              <FollowButton id={id} style={{ height: 36 }} />
              <ReportButton target="creator" id={id} className="tb-btn" label="" />
            </>}
          </div>
        </div>
        <div style={{ padding: '0 16px' }}>
          <h1 className={s.cn}>{c.name}{(!isRemoteId(id) || c.verified) && <span className={s.vb}><Icon name="check" size={10} color="#fff" stroke={3.4} /></span>}</h1>
          {(HANDLE[id] ?? c.handle ?? (isRemoteId(id) ? '' : id)) && <p className="muted">@{HANDLE[id] ?? c.handle ?? id}</p>}
          <p className={s.bio}>{BIO[id] ?? c.bio ?? `ลูกค้า ${BRAND}`}</p>
          <div className={s.stats}><span><b>{works.length}</b>ผลงาน</span><span><b>{st.followersLabel}</b>ผู้ติดตาม</span><span><b>{st.rating ? st.rating.toFixed(1) : '–'}</b>คะแนน</span><span><b>{posts.length}</b>โพสต์</span></div>
        </div>
        <div className="sec"><div className="sec-h">ผลงาน</div>{works.length ? <MasonryFeed items={works} /> : <Empty icon="store" title="ยังไม่มีผลงานขาย" action={isMe ? <Link to="/sell" className="btn btn-p btn-sm">ลงขายผลงานแรก</Link> : undefined} />}</div>
      </div>
    </div>
  )
}
