import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { MasonryFeed } from '../components/MasonryFeed'
import { ALL_PRODUCTS, TYPES, TYPE_ORDER } from '../data/sampleData'
import type { TypeKey } from '../data/types'
import { useFavorites } from '../services/FavoritesContext'
import s from './Favorites.module.css'

export function Favorites() {
  const nav = useNavigate()
  const { ids } = useFavorites()
  const [type, setType] = useState<TypeKey | 'all'>('all')
  const favs = ids.map((id) => ALL_PRODUCTS.find((p) => p.id === id)).filter((p) => !!p)
  const shown = favs.filter((p) => type === 'all' || p.type === type)

  return (
    <>
      <header className={s.hdr}>
        <div className={`wrap ${s.row}`}>
          <button className={s.ib} onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="กลับ"><Icon name="back" size={20} /></button>
          <div><h1 className={s.t}>ที่ชอบ</h1><div className={s.n}>{ids.length} รายการ</div></div>
        </div>
      </header>
      <main className="wrap page">
        <div className={`hscroll ${s.fl}`}>
          {(['all', ...TYPE_ORDER] as const).map((t) => (
            <button key={t} className={`${s.chip} ${type === t ? s.on : ''}`} onClick={() => setType(t)}>
              {t === 'all' ? 'ทั้งหมด' : TYPES[t].name}
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
