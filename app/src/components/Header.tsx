import { Link, NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import s from './Header.module.css'

export const NAV = [
  { to: '/', label: 'หน้าแรก', icon: 'home' },
  { to: '/search', label: 'ค้นหา', icon: 'search' },
  { to: '/sell', label: 'ลงขาย', icon: 'plus', mid: true },
  { to: '/chat', label: 'แชต', icon: 'chat' },
  { to: '/favorites', label: 'โปรไฟล์', icon: 'user' },
] as const

export function Brand() {
  return (
    <Link to="/" className={s.brand} aria-label="LUMI หน้าแรก">
      <span className={s.logo}><Icon name="sparkle" size={22} color="none" stroke={0} fill="#fff" /></span>
      <span>LUMI<small>ตลาดงานครีเอเตอร์ AI</small></span>
    </Link>
  )
}

export function Header() {
  return (
    <header className={s.hdr}>
      <div className={`wrap ${s.row}`}>
        <Brand />
        <nav className={s.desk} aria-label="เมนูหลัก">
          {NAV.filter((n) => n.to !== '/search').map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => `${s.dl} ${isActive ? s.on : ''} ${'mid' in n ? s.sell : ''}`}>
              <Icon name={n.icon} size={18} stroke={2} />{n.to === '/favorites' ? 'ที่ชอบ' : n.label}
            </NavLink>
          ))}
        </nav>
        <div className={s.act}>
          <Link to="/search" className={s.ib} aria-label="ค้นหา"><Icon name="search" size={20} /></Link>
          <Link to="/notifications" className={s.ib} aria-label="แจ้งเตือน"><Icon name="bell" size={20} /><span className={s.dot} /></Link>
          <Link to="/cart" className={s.ib} aria-label="ตะกร้า"><Icon name="cart" size={20} /><span className={s.cnt}>2</span></Link>
        </div>
      </div>
    </header>
  )
}

export function BottomNav() {
  return (
    <nav className={s.tabbar} aria-label="เมนูหลัก">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end className={({ isActive }) => `${s.tab} ${isActive ? s.tabOn : ''}`}>
          {'mid' in n ? <span className={s.mid}><Icon name="plus" size={26} color="#fff" stroke={2.4} /></span> : <Icon name={n.icon} size={23} stroke={1.9} />}
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
