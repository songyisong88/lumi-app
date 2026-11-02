import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDb } from '../services/db'
import { Icon } from './Icon'
import { Sheet } from './ui'
import { scrollPageTop } from './Stage'
import s from './Header.module.css'
import { FEATURES, REAL } from '../config'

export const NAV = [
  { to: '/', label: 'หน้าแรก', icon: 'home' },
  { to: '/search', label: 'ค้นหา', icon: 'search' },
  { to: '#create', label: 'สร้าง', icon: 'plus', mid: true },
  { to: '/community', label: 'ชุมชน', icon: 'users' },
  { to: '/profile', label: 'โปรไฟล์', icon: 'user' },
] as const

/** Routes that keep the tab bar visible; every other page is a pushed detail screen. */
const TABBED = ['/', '/search', '/community', '/profile', '/chat', '/favorites', '/notifications']
const ROOTS = ['/', '/search', '/community', '/profile']

/** Re-tapping the tab or logo of the page you are already on scrolls it back to the top (like Instagram/TikTok). */
const reTap = (here: boolean) => (e: React.MouseEvent) => { if (here) { e.preventDefault(); scrollPageTop(true) } }

export function Brand() {
  const { pathname } = useLocation()
  return (
    <Link to="/" className={s.brand} aria-label="LUMI หน้าแรก" onClick={reTap(pathname === '/')}>
      <span className={s.logo}><Icon name="sparkle" size={22} color="none" stroke={0} fill="#fff" /></span>
      <span>LUMI<small>ตลาดงานครีเอเตอร์ AI</small></span>
    </Link>
  )
}

export function useBadges() {
  const db = useDb()
  return {
    chat: db.threads.reduce((a, t) => a + (t.muted ? 0 : t.unread), 0),
    notif: db.notifs.filter((n) => !n.read).length,
    cart: db.cart.filter((c) => !c.direct).length,
  }
}

export function HeaderActions({ search = true }: { search?: boolean }) {
  const b = useBadges()
  return (
    <div className={s.act}>
      {search && <Link to="/search" className={`${s.ib} ${s.deskOnly}`} aria-label="ค้นหา"><Icon name="search" size={20} /></Link>}
      <Link to="/chat" className={s.ib} aria-label={`แชต${b.chat ? ` ยังไม่อ่าน ${b.chat > 9 ? '9+' : b.chat}` : ''}`}><Icon name="chat" size={20} />{b.chat > 0 && <span className={s.cnt} style={{ background: 'var(--pink)' }}>{b.chat > 9 ? '9+' : b.chat}</span>}</Link>
      <Link to="/notifications" className={s.ib} aria-label={`แจ้งเตือน${b.notif ? ` ยังไม่อ่าน ${b.notif > 9 ? '9+' : b.notif}` : ''}`}><Icon name="bell" size={20} />{b.notif > 0 && <span className={s.cnt} style={{ background: 'var(--pink)' }}>{b.notif > 9 ? '9+' : b.notif}</span>}</Link>
      {/* cart icon only once something is in it (study 2/5) */}
      {b.cart > 0 && <Link to="/cart" className={s.ib} aria-label={`ตะกร้า ${b.cart} ชิ้น`}><Icon name="cart" size={20} /><span className={s.cnt}>{b.cart}</span></Link>}
    </div>
  )
}

export function Header() {
  const [create, setCreate] = useState(false)
  const { pathname } = useLocation()
  return (
    <header className={s.hdr}>
      <div className={`wrap ${s.row}`}>
        <Brand />
        {!REAL && <span className="sample-pill" title="ผลงาน ราคา และตัวเลขในแอปนี้เป็นข้อมูลตัวอย่าง">ข้อมูลตัวอย่าง</span>}
        <nav className={s.desk} aria-label="เมนูหลัก">
          {NAV.filter((n) => n.to !== '/search').map((n) => 'mid' in n
            ? <button key={n.to} className={`${s.dl} ${s.sell}`} onClick={() => setCreate(true)}><Icon name="plus" size={18} stroke={2} />สร้าง</button>
            : <NavLink key={n.to} to={n.to} end onClick={reTap(pathname === n.to)} className={({ isActive }) => `${s.dl} ${isActive ? s.on : ''}`}><Icon name={n.icon} size={18} stroke={2} />{n.label}</NavLink>)}
        </nav>
        <HeaderActions />
      </div>
      <div className={`wrap ${s.srow}`}><Link to="/search" className={s.sbar}><Icon name="search" size={19} color="var(--mut)" /><span>ค้นหาภาพ เทมเพลต บอท คอร์ส…</span></Link></div>
      <CreateSheet open={create} onClose={() => setCreate(false)} />
    </header>
  )
}

export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const db = useDb()
  const go = (to: string) => { onClose(); setTimeout(() => nav(to), 120) }
  return (
    <Sheet open={open} onClose={onClose} title="สร้างอะไรดี">
      <div className={s.cs}>
        <button className={`${s.csi} rise`} style={{ '--i': 0 } as React.CSSProperties} onClick={() => go('/sell')}>
          <span className={s.csic} style={{ background: 'var(--grad)' }}><Icon name="store" size={24} color="#fff" /></span>
          <span><b>ลงขายผลงาน</b><small>ภาพ เทมเพลต โปรแกรม บอท คอร์ส วิดีโอ ชุดข้อมูล หรือรับจ้าง</small></span><Icon name="chev" size={18} color="var(--mut)" />
        </button>
        <button className={`${s.csi} rise`} style={{ '--i': 1 } as React.CSSProperties} onClick={() => go('/community/new')}>
          <span className={s.csic} style={{ background: 'linear-gradient(135deg,#0EA5E9,#6366F1)' }}><Icon name="edit" size={22} color="#fff" /></span>
          <span><b>โพสต์ลงชุมชน</b><small>โชว์ผลงาน แชร์ความรู้ ถาม-ตอบ แท็กผลงานได้</small></span><Icon name="chev" size={18} color="var(--mut)" />
        </button>
        {FEATURES.accounts && <button className={`${s.csi} rise`} style={{ '--i': 2 } as React.CSSProperties} onClick={() => go('/story/new')}>
          <span className={s.csic} style={{ background: 'linear-gradient(135deg,#F0508A,#F59E0B)' }}><Icon name="camera" size={22} color="#fff" /></span>
          <span><b>ลงสตอรี่</b><small>รูปหรือคลิปสั้น อยู่ 24 ชั่วโมง ให้คนติดตามเห็นก่อน</small></span><Icon name="chev" size={18} color="var(--mut)" />
        </button>}
        {db.drafts.length > 0 && (
          <button className={`${s.draft} rise`} style={{ '--i': 3 } as React.CSSProperties} onClick={() => go('/sell/drafts')}>
            <Icon name="file" size={18} color="#B45309" />ร่างค้างไว้ {db.drafts.length} ชิ้น<span>ทำต่อ ›</span>
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function BottomNav() {
  const { pathname } = useLocation()
  const [create, setCreate] = useState(false)
  const b = useBadges()
  const show = TABBED.includes(pathname)
  return (
    <>
      <nav className={`${s.tabbar} ${show ? '' : s.hide}`} aria-label="เมนูหลัก" aria-hidden={!show}>
        {NAV.map((n) => 'mid' in n ? (
          <button key={n.to} className={s.tab} onClick={() => setCreate(true)} aria-label="สร้าง: ลงขาย โพสต์ หรือสตอรี่" tabIndex={show ? 0 : -1}>
            <span className={s.mid}><Icon name="plus" size={26} color="#fff" stroke={2.4} /></span>
          </button>
        ) : (
          <NavLink key={n.to} to={n.to} end replace={ROOTS.includes(pathname)} onClick={reTap(pathname === n.to)} tabIndex={show ? 0 : -1} className={({ isActive }) => `${s.tab} ${isActive ? s.tabOn : ''}`}>
            <span className={s.ti}><Icon name={n.icon} size={23} stroke={1.9} />{n.to === '/profile' && b.notif > 0 && <i className={s.tdot} />}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <CreateSheet open={create} onClose={() => setCreate(false)} />
    </>
  )
}
