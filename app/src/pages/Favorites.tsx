import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { MasonryFeed } from '../components/MasonryFeed'
import { ALL_PRODUCTS } from '../data/sampleData'
import { SELL_TYPE_ORDER, SPECS, sellTypeOf, type SellType } from '../data/listingSpec'
import { useFavorites } from '../services/FavoritesContext'
import s from './Favorites.module.css'

export function Favorites() {
  const nav = useNavigate()
  const { ids } = useFavorites()
  const [type, setType] = useState<SellType | 'all'>('all')
  const favs = ids.map((id) => ALL_PRODUCTS.find((p) => p.id === id)).filter((p) => !!p)
  const shown = favs.filter((p) => type === 'all' || sellTypeOf(p) === type)

  return (
    <>
      <header className={s.hdr}>
        <div className={`wrap ${s.row}`}>
          <button className={s.ib} onClick={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/profile'))} aria-label="กลับ"><Icon name="back" size={20} /></button>
          <div><h1 className={s.t}>ที่ชอบ</h1><div className={s.n}>{ids.length} รายการ</div></div>
        </div>
      </header>
      <main className="wrap page">
        <div className={`hscroll ${s.fl}`}>
          {(['all', ...SELL_TYPE_ORDER.filter((t) => favs.some((p) => sellTypeOf(p) === t))] as const).map((t) => (
            <button key={t} className={`${s.chip} ${type === t ? s.on : ''}`} onClick={() => setType(t)}>
              {t === 'all' ? 'ทั้งหมด' : SPECS[t].name}
            </button>
          ))}
        </div>
        {shown.length ? (
          <MasonryFeed items={shown} />
        ) : (
          <div className={s.empty}>
            <span className={s.eh}><Icon name="heart" size={32} color="#F0508A" /></span>
            <b>{ids.length ? 'ยังไม่มีรายการในประเภทนี้' : 'ยังไม่มีผลงานที่ชอบ'}</b>
            กดรูปหัวใจบนผลงานที่ถูกใจ แล้วจะมาอยู่ที่นี่
            <Link to="/" className={s.btn}>ไปดูผลงาน</Link>
          </div>
        )}
      </main>
    </>
  )
}
