import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { MenuIcon } from '../../components/v2/CreateSheetV2'
import { Av, Img, SampleNote, Seg, Sheet } from '../../components/ui'
import { HIRE_ON, brandName } from '../../config'
import { creatorStats, heroOf } from '../../data/productExtras'
import { ALL_PRODUCTS, ME, STORIES, baht, creatorById } from '../../data/sampleData'
import type { Product } from '../../data/types'
import { useDb } from '../../services/db'
import { isCloud, startDemo, useSession } from '../../services/session'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'

type Side = 'buyer' | 'seller'
const HANDLE: Record<string, string> = { fasai: 'fasai.create' }

function Tile({ to, icon, label, n, onClick }: { to?: string; icon: string; label: string; n?: number; onClick?: () => void }) {
  const inner = <><i><Icon name={icon} size={24} color="var(--p)" /></i>{label}{!!n && <em>{n > 99 ? '99+' : n}</em>}</>
  return to ? <Link to={to} className="v2-tile press" data-tile={label}>{inner}</Link> : <button className="v2-tile press" onClick={onClick} data-tile={label}>{inner}</button>
}
function Card({ title, more, children, flush }: { title?: string; more?: ReactNode; children: ReactNode; flush?: boolean }) {
  return <section className={`v2-card ${flush ? 'flush' : ''}`}>{title && <div className="v2-h" style={flush ? { padding: '12px 16px 0' } : undefined}><b>{title}</b>{more}</div>}{children}</section>
}
export function statusChip(p: Product): [string, string] {
  if (p.rev?.status === 'pending' || p.mod?.status === 'pending') return ['รอตรวจ', 'c-a']
  if (p.rev?.status === 'rejected' || p.mod?.status === 'rejected') return ['ไม่ผ่าน', 'c-r']
  return ['ขายอยู่', 'c-g']
}

/** UI v2 (demo site): one account, switch between ฝั่งผู้ซื้อ and ร้านของฉัน (mockups 01, 02). */
export function ProfileV2() {
  const db = useDb()
  const ses = useSession()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const side: Side = sp.get('mode') === 'creator' || sp.get('mode') === 'seller' ? 'seller' : 'buyer'
  const setSide = (m: Side) => { const n = new URLSearchParams(sp); n.set('mode', m === 'seller' ? 'creator' : 'buyer'); setSp(n, { replace: true }) }
  const [sheet, setSheet] = useState<'' | 'orders' | 'shop' | 'income'>('')
  const [allWorks, setAllWorks] = useState(false)
  const guest = ses.mode === 'guest'
  const me = creatorById(ME)
  const isCreator = ses.mode === 'demo' || (isCloud() && !!ses.profile?.is_creator)
  const st = creatorStats(ME)
  const share = async () => {
    const url = `${location.origin}${location.pathname}#/creator/${ME}`
    try { if (navigator.share) await navigator.share({ title: me.name, url }); else { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์หน้าร้านแล้ว') } } catch { /* cancelled */ }
  }

  // buyer data
  const recent = db.purchases.slice(0, 10)
  const storyIds = new Set([...STORIES.map((s) => s.creatorId), ...(db.stories ?? []).filter((x) => x.expires > Date.now()).map((x) => x.authorId)])
  const savedN = db.posts.filter((x) => db.saved.includes(x.id)).length
  const cartN = db.cart.length
  // seller data
  const mine = ALL_PRODUCTS.filter((p) => p.creatorId === ME)
  const custThreads = db.threads.filter((t) => t.role === 'customer' && (HIRE_ON || !t.hire))
  const replyN = custThreads.filter((t) => t.tone === 'warn' || t.status.includes('รอคุณ')).length
  const reviewN = mine.filter((p) => statusChip(p)[0] === 'รอตรวจ').length
  const rejectN = mine.filter((p) => statusChip(p)[0] === 'ไม่ผ่าน').length
  const shopOrders = custThreads.filter((t) => t.orderNo)
  const sales = db.sales ?? []
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const month = sales.filter((x) => x.at >= monthStart && x.payout !== 'refunded')
  const income = isCloud() ? month.reduce((a, x) => a + x.net, 0) : 12480
  const myStories = (db.stories ?? []).filter((x) => x.authorId === ME && x.expires > Date.now()).length
  const todo = [
    { n: replyN, t: 'ตอบแชตลูกค้า', d: 'ลูกค้ารอคำตอบจากคุณ', to: '/chat' },
    { n: reviewN, t: 'ผลงานรอตรวจ', d: 'ทีมงานตรวจภายใน 24 ชม.', to: '#works' },
    { n: rejectN, t: 'แก้ผลงานที่ไม่ผ่าน', d: 'ดูเหตุผลแล้วส่งตรวจใหม่', to: '#works' },
    { n: db.drafts.length, t: 'ร่างที่ยังไม่เสร็จ', d: 'ทำต่อแล้วกดลงขาย', to: '/sell/drafts' },
  ].filter((x) => x.n > 0)
  const goTodo = (to: string) => (to === '#works' ? document.getElementById('v2-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : nav(to))

  return (
    <div className="v2 page">
      <header className="v2-bar">
        <h1>โปรไฟล์</h1>
        {!guest && <button className="v2-ib" onClick={share} aria-label="แชร์โปรไฟล์"><Icon name="share" size={21} /></button>}
        <Link to="/menu" className="v2-ib" aria-label="เมนูและตั้งค่า" data-open-menu><MenuIcon /></Link>
      </header>

      <section className="v2-card">
        {guest ? (
          <>
            <div className="v2-me"><Av src={me.avatar} size={64} /><div><b>ยังไม่ได้เข้าสู่ระบบ</b><small>เข้าสู่ระบบเพื่อซื้อ เก็บของที่ชอบ และเปิดร้าน</small></div></div>
            <div className="v2-row2"><Link to="/account/login" className="btn btn-p">เข้าสู่ระบบ</Link><button className="btn btn-o" onClick={startDemo}>ลองบัญชีตัวอย่าง</button></div>
          </>
        ) : (
          <>
            <div className="v2-me">
              <Av src={me.avatar} size={64} ring />
              <div style={{ minWidth: 0 }}>
                <b className="ell">{brandName(ses.profile?.display_name || me.name)}</b>
                {(HANDLE[ME] ?? me.handle ?? ses.profile?.handle) && <small>@{HANDLE[ME] ?? me.handle ?? ses.profile?.handle}</small>}
                <div className="v2-stats"><span><b>{st.followersLabel}</b>ผู้ติดตาม</span><span><b>{db.follows.length}</b>กำลังติดตาม</span></div>
              </div>
            </div>
            <div className="v2-row2">
              <Link to={isCloud() ? '/account' : '/menu'} className="btn btn-o" data-edit-profile>แก้ไขโปรไฟล์</Link>
              {isCreator ? <Link to={`/creator/${ME}`} className="btn btn-o">ดูหน้าร้าน</Link> : <Link to="/account" className="btn btn-s" data-open-shop>เปิดร้าน</Link>}
            </div>
          </>
        )}
      </section>

      {isCreator && !guest && <>
        <div className="v2-switch"><Seg value={side} onChange={setSide} options={[{ v: 'buyer', label: 'ฝั่งผู้ซื้อ' }, { v: 'seller', label: 'ร้านของฉัน' }]} /></div>
        <p className="v2-cap">บัญชีเดียว ใช้ได้ทั้งซื้อและขาย · แตะเพื่อสลับ</p>
      </>}

      <div key={side} className="tab-fade">
        {side === 'buyer' || !isCreator ? (
          <>
            <Card><div className="v2-tiles">
              <Tile to="/library" icon="download" label="ของที่ซื้อ" />
              <Tile to="/favorites" icon="heart" label="ที่ชอบ" />
              <Tile to="/cart" icon="cart" label="ตะกร้า" n={cartN} />
              <Tile icon="receipt" label="คำสั่งซื้อ" onClick={() => setSheet('orders')} />
            </div></Card>
            <Card title="ซื้อล่าสุด" more={recent.length > 0 && <Link to="/library">ดูทั้งหมด ›</Link>}>
              {recent.length === 0 ? <div className="v2-empty" style={{ padding: '8px 0' }}><p>ของที่ซื้อและของฟรีที่กดรับจะอยู่ที่นี่</p><Link to="/" className="btn btn-s btn-sm">เลือกดูผลงาน</Link></div> : (
                <div className="v2-shelf">{recent.map((b) => (
                  <Link key={b.id} to={`/library/${b.id}`} className="v2-work press"><div className="img"><Img src={b.image} style={{ width: '100%', height: '100%' }} /></div><span>{b.title}</span><small className="v2-sm">{ago(b.at)}</small></Link>
                ))}</div>
              )}
            </Card>
            <Card title="ครีเอเตอร์ที่ติดตาม" more={<span className="v2-mut">{db.follows.length} คน</span>}>
              {db.follows.length === 0 ? <div className="v2-empty" style={{ padding: '8px 0' }}><p>ยังไม่ได้ติดตามใคร</p><Link to="/search" className="btn btn-s btn-sm">ค้นหาครีเอเตอร์</Link></div> : (
                <div className="v2-shelf">{db.follows.map((id) => { const c = creatorById(id); return (
                  <Link key={id} to={storyIds.has(id) ? `/story/${id}` : `/creator/${id}`} className="v2-cr press"><Av src={c.avatar} size={60} ring={storyIds.has(id)} /><span>{c.name}</span></Link>
                ) })}</div>
              )}
            </Card>
            <Card flush>
              <Link to="/saved" className="v2-li" data-saved-row><span className="ic-w"><Icon name="bookmark" size={20} color="var(--p)" /></span><span className="tx">โพสต์ที่บันทึก<small>โพสต์จากชุมชนที่คุณกดบันทึกไว้</small></span><span className="end">{savedN}<Icon name="chev" size={16} color="var(--mut)" /></span></Link>
            </Card>
          </>
        ) : (
          <>
            <Card><div className="v2-tiles">
              <Tile icon="store" label="ผลงาน" onClick={() => goTodo('#works')} />
              <Tile icon="receipt" label="ออเดอร์" onClick={() => (isCloud() ? nav('/shop/orders') : setSheet('shop'))} />
              <Tile to={myStories ? `/story/${ME}` : '/story/new'} icon="camera" label="สตอรี่" />
              <Tile to="/sell/drafts" icon="file" label="ร่าง" n={db.drafts.length} />
            </div>
              <Link to="/sell" className="btn btn-p btn-block" style={{ marginTop: 12 }} data-new-listing><Icon name="plus" size={20} color="#fff" stroke={2.4} />ลงขายผลงานใหม่</Link>
            </Card>
            <Card title="ต้องทำวันนี้" flush>
              {todo.length === 0 ? <p className="v2-mut" style={{ padding: '0 16px 16px' }}>ไม่มีงานค้าง</p> : todo.map((x) => (
                <button key={x.t} className="v2-li" onClick={() => goTodo(x.to)}><span className="tx">{x.t}<small>{x.d}</small></span><span className="end"><span className="v2-cnt">{x.n}</span><Icon name="chev" size={16} color="var(--mut)" /></span></button>
              ))}
            </Card>
            <Card title="รายได้เดือนนี้" more={<button onClick={() => setSheet('income')} data-income>ดูรายได้ ›</button>}>
              <div className="v2-money">{baht(income)}</div>
              <div className="v2-sm">{isCloud() ? `ขายได้ ${month.length} ชิ้น` : 'ข้อมูลตัวอย่าง · ขายได้ 41 ชิ้น'}</div>
              <div className="v2-note" data-payout-note><Icon name="clock" size={18} color="#9A5B00" /><span>การโอนเงินเข้าบัญชียังไม่เปิด · รอเชื่อมระบบรับเงินให้เสร็จก่อน ยอดขายของคุณบันทึกไว้ครบ ไม่หาย</span></div>
            </Card>
            <section id="v2-works" className="v2-card" style={{ scrollMarginTop: 64 }}>
              <div className="v2-h"><b>ผลงานของฉัน</b>{mine.length > 4 ? <button onClick={() => setAllWorks((v) => !v)}>{allWorks ? 'ย่อ' : 'จัดการ ›'}</button> : mine.length > 0 && <Link to={`/creator/${ME}`}>จัดการ ›</Link>}</div>
              {mine.length === 0 && db.drafts.length === 0 ? <p className="v2-mut">ยังไม่มีผลงาน · กด “ลงขายผลงานใหม่” เพื่อเริ่ม</p> : <>
                {(allWorks ? mine : mine.slice(0, 4)).map((p) => { const [t, c] = statusChip(p); return (
                  <Link key={p.id} to={`/product/${p.id}`} className="v2-wk"><span className="img"><Img src={heroOf(p)} style={{ width: '100%', height: '100%' }} /></span><span className="tx"><b>{p.title}</b><small>{p.price ? baht(p.price) : 'ฟรี'}</small></span><span className={`v2-chip ${c}`}>{t}</span></Link>
                ) })}
                {db.drafts.slice(0, allWorks ? 99 : 1).map((d) => (
                  <Link key={d.id} to={`/sell?draft=${d.id}`} className="v2-wk"><span className="img"><Img src={d.covers[0]} style={{ width: '100%', height: '100%' }} /></span><span className="tx"><b>{d.title || 'ยังไม่ตั้งชื่อ'}</b><small>ทำต่อได้</small></span><span className="v2-chip c-n">ร่าง</span></Link>
                ))}
              </>}
            </section>
          </>
        )}
      </div>
      {ses.mode === 'demo' && <div style={{ padding: '4px 16px 0' }}><SampleNote>บัญชีตัวอย่าง · ข้อมูลเก็บในเครื่องนี้เท่านั้น</SampleNote></div>}

      <Sheet open={sheet === 'orders'} onClose={() => setSheet('')} title="คำสั่งซื้อ" sub={`${db.orders.length} รายการ`}>
        {db.orders.length === 0 ? <p className="v2-mut">ยังไม่มีคำสั่งซื้อ</p> : db.orders.map((o) => (
          <Link key={o.id} to="/library" onClick={() => setSheet('')} className="v2-li" style={{ padding: '8px 0' }}><span className="tx">#{o.no} · {o.items.length} ชิ้น<small>{ago(o.at)} · {o.method}</small></span><span className="end"><b style={{ color: 'var(--ink)' }}>{o.total ? baht(o.total) : 'ฟรี'}</b><Icon name="chev" size={16} color="var(--mut)" /></span></Link>
        ))}
      </Sheet>
      <Sheet open={sheet === 'shop'} onClose={() => setSheet('')} title="ออเดอร์ของร้าน" sub="ข้อมูลตัวอย่าง">
        {shopOrders.length === 0 ? <p className="v2-mut">ยังไม่มีออเดอร์</p> : shopOrders.map((t) => (
          <Link key={t.id} to={`/chat/${t.id}`} onClick={() => setSheet('')} className="v2-li" style={{ padding: '8px 0' }}><span className="tx">{t.title}<small>{creatorById(t.partnerId).name} · #{t.orderNo} · {t.status}</small></span><span className="end">{t.amount ? baht(t.amount) : 'ฟรี'}<Icon name="chev" size={16} color="var(--mut)" /></span></Link>
        ))}
      </Sheet>
      <Sheet open={sheet === 'income'} onClose={() => setSheet('')} title="รายได้" sub={isCloud() ? 'จากยอดขายจริงของคุณ' : 'ข้อมูลตัวอย่าง'}>
        <div className="v2-money">{baht(income)}</div>
        <div className="v2-sm">รายได้เดือนนี้ หลังหักค่าธรรมเนียม</div>
        <div className="v2-note"><Icon name="clock" size={18} color="#9A5B00" /><span>การโอนเงินเข้าบัญชียังไม่เปิด · เราจะแจ้งเมื่อเชื่อมระบบรับเงินเสร็จ ตอนนี้ยังไม่ต้องกรอกบัญชีธนาคาร</span></div>
        {isCloud() && month.map((x) => <div key={x.id} className="v2-li" style={{ padding: '8px 0' }}><span className="tx">{x.title}<small>#{x.orderNo} · {ago(x.at)}</small></span><span className="end">{baht(x.net)}</span></div>)}
      </Sheet>
    </div>
  )
}
