import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, SampleNote, TopBar } from '../../components/ui'
import type { Notif } from '../../data/appTypes'
import { notifications } from '../../services/api'
import { useDb } from '../../services/db'
import { ago, dayLabel } from '../../utils/time'
import s from './Shop.module.css'

const KIND: Record<Notif['kind'], [string, string, string]> = {
  order: ['receipt', '#2563EB', '#EAF1FF'], chat: ['chat', '#6C2BD9', '#F3ECFF'], like: ['heart', '#F0508A', '#FDEBF2'], follow: ['user', '#0B7A6E', '#E2F6F2'],
  system: ['sparkle', '#B45309', '#FFF4DB'], community: ['trophy', '#E0620B', '#FFF0E3'], sale: ['coin', '#15803D', '#E5F8EC'],
}
type F = 'all' | 'order' | 'social'

export function Notifications() {
  const db = useDb()
  const nav = useNavigate()
  const [f, setF] = useState<F>('all')
  const list = db.notifs.filter((n) => f === 'all' || (f === 'order' ? ['order', 'sale', 'chat'].includes(n.kind) : ['like', 'follow', 'community', 'system'].includes(n.kind)))
  const unread = db.notifs.filter((n) => !n.read).length
  let last = ''
  return (
    <div className="page">
      <TopBar title="แจ้งเตือน" sub={unread ? `ยังไม่อ่าน ${unread}` : undefined} right={unread > 0 && <button className="btn btn-xs btn-s" onClick={() => notifications.readAll()}>อ่านทั้งหมด</button>} />
      <div className="narrow">
        <div className="chips hscroll" style={{ padding: '10px 16px 4px' }}>
          {([['all', 'ทั้งหมด'], ['order', 'ออเดอร์และแชต'], ['social', 'ชุมชน']] as const).map(([v, l]) => <button key={v} className={`chip ${f === v ? 'on' : ''}`} onClick={() => setF(v)}>{l}</button>)}
        </div>
        {list.length === 0 ? <Empty icon="bell" title="ยังไม่มีแจ้งเตือน" text="ออเดอร์ ข้อความ และกิจกรรมจะแจ้งที่นี่" action={<button className="btn btn-o btn-sm" onClick={() => nav('/')}>ไปดูผลงาน</button>} /> : list.map((n, i) => {
          const d = dayLabel(n.at)
          const head = d !== last ? (last = d) : ''
          const [ic, c, bg] = KIND[n.kind]
          return (
            <div key={n.id}>
              {head && <div className={s.day}>{head}</div>}
              <button className={`${s.nf} ${n.read ? '' : s.un} rise`} style={{ '--i': Math.min(i, 8) } as React.CSSProperties} onClick={() => { notifications.read(n.id); nav(n.link) }}>
                <span className={s.nic}>{n.avatar ? <Av src={n.avatar} size={44} /> : <span className={s.nic} style={{ background: bg }}><Icon name={ic} size={20} color={c} /></span>}</span>
                <span className={s.nm}>{n.text}<small>{ago(n.at)}</small></span>
                {n.image && <Img src={n.image} className={s.nimg} />}
                {!n.read && <i className={s.udot} />}
              </button>
            </div>
          )
        })}
        <div style={{ padding: '14px 16px' }}><SampleNote>แจ้งเตือนตัวอย่าง · ยังไม่มีการส่ง push จริง</SampleNote></div>
      </div>
    </div>
  )
}
