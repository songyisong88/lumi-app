import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDb } from '../services/db'
import { Icon } from './Icon'
import { Sheet } from './ui'
import s from './Header.module.css'

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

export function Brand() {
  return (
    <Link to="/" className={s.brand} aria-label="LUMI หน้าแรก">
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
      <Link to="/chat" className={s.ib} aria-label={`แชต${b.chat ? ` ยังไม่อ่าน ${b.chat}` : ''}`}><Icon name="chat" size={20} />{b.chat > 0 && <span className={s.cnt} style={{ background: 'var(--pink)' }}>{b.chat > 9 ? '9+' : b.chat}</span>}</Link>
      <Link to="/notifications" className={s.ib} aria-label="แจ้งเตือน"><Icon name="bell" size={20} />{b.notif > 0 && <span className={s.dot} />}</Link>
      <Link to="/cart" className={s.ib} aria-label="ตะกร้า"><Icon name="cart" size={20} />{b.cart > 0 && <span className={s.cnt}>{b.cart}</span>}</Link>
    </div>
  )
}

export function Header() {
  const [create, setCreate] = useState(false)
  return (
    <header className={s.hdr}>
      <div className={`wrap ${s.row}`}>
        <Brand />
        <nav className={s.desk} aria-label="เมนูหลัก">
          {NAV.filter((n) => n.to !== '/search').map((n) => 'mid' in n
            ? <button key={n.to} className={`${s.dl} ${s.sell}`} onClick={() => setCreate(true)}><Icon name="plus" size={18} stroke={2} />สร้าง</button>
            : <NavLink key={n.to} to={n.to} end className={({ isActive }) => `${s.dl} ${isActive ? s.on : ''}`}><Icon name={n.icon} size={18} stroke={2} />{n.label}</NavLink>)}
        </nav>
        <HeaderActions />
      </div>
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
          <span><b>โพสต์ลงชุมชน</b><small>โชว์ผลงาน แชร์ความรู้ ถาม-ตอบ แท็กสินค้าได้</small></span><Icon name="chev" size={18} color="var(--mut)" />
        </button>
        {db.drafts.length > 0 && (
          <button className={`${s.draft} rise`} style={{ '--i': 2 } as React.CSSProperties} onClick={() => go('/sell/drafts')}>
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
      {show && <div className="sample-badge" aria-hidden>ข้อมูลตัวอย่าง</div>}
      <nav className={`${s.tabbar} ${show ? '' : s.hide}`} aria-label="เมนูหลัก" aria-hidden={!show}>
        {NAV.map((n) => 'mid' in n ? (
          <button key={n.to} className={s.tab} onClick={() => setCreate(true)} aria-label="สร้าง: ลงขายหรือโพสต์" tabIndex={show ? 0 : -1}>
            <span className={s.mid}><Icon name="plus" size={26} color="#fff" stroke={2.4} /></span>
          </button>
        ) : (
          <NavLink key={n.to} to={n.to} end replace={ROOTS.includes(pathname)} tabIndex={show ? 0 : -1} className={({ isActive }) => `${s.tab} ${isActive ? s.tabOn : ''}`}>
            <span className={s.ti}><Icon name={n.icon} size={23} stroke={1.9} />{n.to === '/profile' && b.notif > 0 && <i className={s.tdot} />}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <CreateSheet open={create} onClose={() => setCreate(false)} />
    </>
  )
}
