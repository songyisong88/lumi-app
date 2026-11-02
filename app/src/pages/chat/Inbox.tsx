import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, SampleNote, Sheet, TopBar } from '../../components/ui'
import type { Message, Thread } from '../../data/appTypes'
import { creatorById } from '../../data/sampleData'
import { chat } from '../../services/api'
import { useDb } from '../../services/db'
import { ago } from '../../utils/time'
import s from './Chat.module.css'

type F = 'all' | 'unread' | 'hire' | 'buy' | 'sell'
const FILTERS: { v: F; label: string }[] = [
  { v: 'all', label: 'ทั้งหมด' }, { v: 'unread', label: 'ยังไม่อ่าน' }, { v: 'hire', label: 'งานจ้าง' }, { v: 'buy', label: 'ที่ซื้อ' }, { v: 'sell', label: 'ลูกค้าของฉัน' },
]
const TONE: Record<Thread['tone'], string> = { warn: s.tWarn, info: s.tInfo, ok: s.tOk, done: s.tDone }

export function preview(m?: Message) {
  if (!m) return 'เริ่มคุยได้เลย'
  const who = m.from === 'me' ? 'คุณ: ' : ''
  switch (m.kind) {
    case 'text': return who + (m.text ?? '')
    case 'brief': return `${who}ส่งบรีฟงาน`
    case 'offer': return `ใบเสนอราคา ฿${m.amount?.toLocaleString('th-TH')}`
    case 'progress': return `อัปเดตงาน ${m.pct}%`
    case 'delivery': return `📦 ${m.title}`
    case 'key': return `🔑 ${m.title}`
    case 'file': return `📎 ${m.fileName}`
    case 'product': return `${who}แชร์สินค้า`
    case 'system': return m.text ?? ''
    case 'sticker': return `${who}ส่งสติกเกอร์`
    case 'tip': return `${who}ให้ทิป ฿${m.amount}`
    case 'coupon': return `🎁 ${m.title}`
    case 'typing': return 'กำลังพิมพ์…'
  }
}

export function Inbox() {
  const db = useDb()
  const [f, setF] = useState<F>('all')
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState<Thread>()
  const press = useRef(0)
  const list = db.threads
    .filter((t) => f === 'all' || (f === 'unread' ? t.unread > 0 : f === 'hire' ? t.hire : f === 'buy' ? t.role === 'creator' : t.role === 'customer'))
    .filter((t) => !q.trim() || `${creatorById(t.partnerId).name} ${t.title}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt)
  const unread = db.threads.reduce((a, t) => a + t.unread, 0)
  const startPress = (t: Thread) => { press.current = window.setTimeout(() => { navigator.vibrate?.(10); setMenu(t) }, 480) }
  const endPress = () => clearTimeout(press.current)

  return (
    <div className="page">
      <TopBar title="แชต" sub={unread ? `ยังไม่อ่าน ${unread} ข้อความ` : 'อ่านครบแล้ว'} />
      <div className="narrow">
        <div className={s.search}><Icon name="search" size={18} color="var(--mut)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ หรือชื่องาน" aria-label="ค้นหาแชต" />{q && <button onClick={() => setQ('')} aria-label="ล้าง"><Icon name="x" size={16} /></button>}</div>
        <div className="chips hscroll" style={{ padding: '10px 16px 4px' }}>
          {FILTERS.map((x) => {
            const n = x.v === 'unread' ? db.threads.filter((t) => t.unread).length : 0
            return <button key={x.v} className={`chip ${f === x.v ? 'on' : ''}`} onClick={() => setF(x.v)}>{x.label}{n > 0 && <span className="badge-n">{n}</span>}</button>
          })}
        </div>
        <div style={{ padding: '6px 16px 2px' }}><SampleNote>แชตตัวอย่าง · ข้อความไม่ได้ส่งถึงใครจริง</SampleNote></div>
        {list.length === 0 ? <Empty icon="chat" title={q ? 'ไม่พบแชตที่ค้นหา' : 'ยังไม่มีแชตในหมวดนี้'} text="ทักครีเอเตอร์ได้จากหน้าสินค้า หรือกดส่งบรีฟเพื่อจ้างงาน" /> : (
          <div className={s.list}>
            {list.map((t, i) => {
              const c = creatorById(t.partnerId)
              const ms = db.messages[t.id] ?? []
              const last = [...ms].reverse().find((m) => m.kind !== 'typing')
              const typing = ms.some((m) => m.kind === 'typing')
              return (
                <Link key={t.id} to={`/chat/${t.id}`} className={`${s.row} rise press`} style={{ '--i': Math.min(i, 8) } as React.CSSProperties}
                  onTouchStart={() => startPress(t)} onTouchEnd={endPress} onTouchMove={endPress} onContextMenu={(e) => { e.preventDefault(); setMenu(t) }}>
                  <Av src={c.avatar} size={52} online={t.online} />
                  <div className={s.rm}>
                    <div className={s.r1}><b className="ell">{c.name}</b>{t.pinned && <Icon name="pin" size={13} color="var(--mut)" />}{t.muted && <Icon name="eyeoff" size={13} color="var(--mut)" />}<small>{ago(t.updatedAt)}</small></div>
                    <div className={s.r2}><span className={`${s.tone} ${TONE[t.tone]}`}>{t.hire ? 'งานจ้าง · ' : t.role === 'customer' ? 'ลูกค้า · ' : ''}{t.status}</span></div>
                    <div className={s.r3}><span className={`ell ${t.unread ? s.bold : ''}`}>{typing ? <em className={s.typ}>กำลังพิมพ์…</em> : preview(last)}</span>{t.unread > 0 && <span className="badge-n">{t.unread}</span>}</div>
                  </div>
                  {t.image && <Img src={t.image} className={s.rimg} />}
                </Link>
              )
            })}
          </div>
        )}
        <p className="hint" style={{ textAlign: 'center', margin: '14px 0' }}>กดค้างที่แชตเพื่อปักหมุดหรือปิดเสียง</p>
      </div>
      <Sheet open={!!menu} onClose={() => setMenu(undefined)} title={menu ? creatorById(menu.partnerId).name : ''} sub={menu?.title}>
        {menu && <div className={s.menu}>
          <button className="list-row" onClick={() => { chat.setFlag(menu.id, 'pinned'); setMenu(undefined) }}><Icon name="pin" size={20} />{menu.pinned ? 'เลิกปักหมุด' : 'ปักหมุดไว้บนสุด'}</button>
          <button className="list-row" onClick={() => { chat.setFlag(menu.id, 'muted'); setMenu(undefined) }}><Icon name="eyeoff" size={20} />{menu.muted ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน'}</button>
          <button className="list-row" onClick={() => { chat.markRead(menu.id); setMenu(undefined) }}><Icon name="check" size={20} />ทำเครื่องหมายว่าอ่านแล้ว</button>
        </div>}
      </Sheet>
    </div>
  )
}
