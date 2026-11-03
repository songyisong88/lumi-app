import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, SampleNote, Sheet, TopBar } from '../../components/ui'
import { ROOMS } from '../../data/appSeed'
import type { Notif } from '../../data/appTypes'
import { creatorById } from '../../data/sampleData'
import { community, notifications } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import s from '../../social/Social.module.css'

/** Badge on the avatar: [emoji, background, text colour]. Same colours as the approved mockup. */
const BADGE: Record<string, [string, string]> = { '@': ['#6C2BD9', '#fff'], '🔥': ['#FFEDD5', ''], '💬': ['#E2F6F2', ''], '👥': ['#EAF1FF', ''] }
const KIND: Record<Notif['kind'], [string, string, string]> = {
  order: ['🧾', 'receipt', '#EAF1FF'], chat: ['💬', 'chat', '#E2F6F2'], like: ['❤️', 'heart', '#FDEBF2'], follow: ['👤', 'user', '#E2F6F2'],
  system: ['✨', 'sparkle', '#FFF4DB'], community: ['🏆', 'trophy', '#FFF0E3'], sale: ['💰', 'coin', '#E5F8EC'],
}
type F = 'all' | 'mention' | 'group' | 'order'
const isGroup = (n: Notif) => n.sub === 'group_invite' || /\/community\/(group|room)\//.test(n.link)
const isOrder = (n: Notif) => ['order', 'sale', 'chat'].includes(n.kind) && !n.sub

function Row({ n, i }: { n: Notif; i: number }) {
  const db = useDb()
  const nav = useNavigate()
  const [emo, icon, kbg] = KIND[n.kind]
  const badge = n.badge ?? (n.sub === 'mention' ? '@' : n.sub === 'reply' ? '💬' : n.sub === 'group_invite' ? '👥' : emo)
  const [bbg, bfg] = BADGE[badge] ?? [n.badge ? '#FFEDD5' : kbg, '']
  const avatar = n.actor ? creatorById(n.actor).avatar : n.avatar
  const name = n.actor ? creatorById(n.actor).name : ''
  const text = name && n.text.startsWith(name) ? <><b>{name}</b>{n.text.slice(name.length)}</> : n.text
  const gid = n.sub === 'group_invite' ? /\/community\/(?:group|room)\/([^/?#]+)/.exec(n.link)?.[1] : undefined
  const g = gid ? ROOMS.find((r) => r.id === gid) : undefined
  return (
    <div className={`${s.nt} ${n.read ? '' : s.unread} rise`} style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
      <button type="button" data-notif={n.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0, textAlign: 'left' }} onClick={() => { notifications.read(n.id); nav(n.link) }}>
        <span className={s.ntAv}>
          {avatar ? <Av src={avatar} size={52} /> : <span className={s.ntIco} style={{ background: kbg }}><Icon name={icon} size={24} color="var(--p)" /></span>}
          <i style={{ background: bbg, color: bfg || undefined, fontWeight: badge === '@' ? 800 : undefined }}>{badge}</i>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}><p>{text}</p><small style={n.read ? { color: 'var(--mut)' } : undefined}>{ago(n.at)}</small></span>
        {n.image && <Img src={n.image} className={s.ntImg} />}
        {!n.read && <i className={s.udot} aria-label="ยังไม่อ่าน" />}
      </button>
      {g && !db.joined.includes(g.id) && <button type="button" className="btn btn-xs btn-p" onClick={() => community.join(g.id).then(() => { notifications.read(n.id); toast(`เข้าร่วม ${g.name} แล้ว`) }, (e: Error) => toast(e.message))}>ตอบรับ</button>}
    </div>
  )
}

export function Notifications() {
  const db = useDb()
  const nav = useNavigate()
  const [f, setF] = useState<F>('all')
  const [menu, setMenu] = useState(false)
  const list = db.notifs.filter((n) => f === 'all' || (f === 'mention' ? n.sub === 'mention' : f === 'group' ? isGroup(n) : isOrder(n)))
  const unread = db.notifs.filter((n) => !n.read).length
  const fresh = list.filter((n) => !n.read), old = list.filter((n) => n.read)
  return (
    <div className={`page ${s.white}`} style={{ minHeight: '100dvh' }}>
      <TopBar back={false} title="การแจ้งเตือน" sub={unread ? `ยังไม่อ่าน ${unread}` : undefined} right={<button type="button" className="tb-btn" aria-label="ตัวเลือก" onClick={() => setMenu(true)}><Icon name="dots" size={20} /></button>} />
      <div className="narrow">
        <div className={s.gpills} style={{ paddingTop: 4 }} role="tablist">
          {([['all', 'ทั้งหมด'], ['mention', 'กล่าวถึงคุณ'], ['group', 'กลุ่ม'], ['order', 'ออเดอร์']] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={f === v} className={f === v ? s.on : ''} onClick={() => setF(v)}>{l}</button>)}
        </div>
        {list.length === 0 ? <Empty icon="bell" title={f === 'mention' ? 'ยังไม่มีใครกล่าวถึงคุณ' : 'ยังไม่มีแจ้งเตือน'} text="ออเดอร์ ข้อความ และกิจกรรมจะแจ้งที่นี่" action={<button className="btn btn-o btn-sm" onClick={() => nav('/')}>ไปดูผลงาน</button>} /> : <>
          {fresh.length > 0 && old.length > 0 && <div className={s.secH} style={{ paddingTop: 6, paddingBottom: 4 }}>ใหม่</div>}
          {fresh.map((n, i) => <Row key={n.id} n={n} i={i} />)}
          {fresh.length > 0 && old.length > 0 && <div className={s.secH} style={{ paddingBottom: 4 }}>ก่อนหน้านี้</div>}
          {old.map((n, i) => <Row key={n.id} n={n} i={i + fresh.length} />)}
        </>}
        <div style={{ padding: '14px 16px' }}><SampleNote>แจ้งเตือนตัวอย่าง · ยังไม่มีการส่ง push จริง</SampleNote></div>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title="การแจ้งเตือน">
        <div style={{ margin: '0 -16px' }}>
          <button className="list-row" style={{ width: '100%' }} disabled={!unread} onClick={() => { void notifications.readAll(); setMenu(false); toast('อ่านทั้งหมดแล้ว') }}><Icon name="check" size={20} /><span className="grow">อ่านทั้งหมด<small>{unread ? `ยังไม่อ่าน ${unread} รายการ` : 'อ่านครบแล้ว'}</small></span></button>
          <button className="list-row" style={{ width: '100%' }} onClick={() => { setMenu(false); nav('/account') }}><Icon name="gear" size={20} /><span className="grow">ตั้งค่าการแจ้งเตือน</span></button>
        </div>
      </Sheet>
    </div>
  )
}
