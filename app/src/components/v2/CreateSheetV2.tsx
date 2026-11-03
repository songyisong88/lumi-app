import { useNavigate } from 'react-router-dom'
import { Icon } from '../Icon'
import { Sheet } from '../ui'
import { HIRE_ON } from '../../config'
import { useDb } from '../../services/db'

/** UI v2 (demo): the + button sheet. Three choices and a close button, as in mockup 04. */
export function CreateSheetV2({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const db = useDb()
  const go = (to: string) => { onClose(); setTimeout(() => nav(to), 120) }
  const opts = [
    { to: '/sell', icon: 'store', grad: true, t: 'ลงขายผลงาน', d: HIRE_ON ? 'ภาพ เทมเพลต โปรแกรม บอท คอร์ส หรือรับจ้าง' : 'ภาพ เทมเพลต โปรแกรม บอท คอร์ส วิดีโอ' },
    { to: '/community/new', icon: 'edit', t: 'โพสต์ในชุมชน', d: 'โชว์ผลงาน แชร์ความรู้ ถาม-ตอบ' },
    { to: '/story/new', icon: 'camera', t: 'ลงสตอรี่', d: 'รูปหรือข้อความสั้น ๆ อยู่ 24 ชั่วโมง' },
  ]
  return (
    <Sheet open={open} onClose={onClose} title="สร้าง" footer={<button className="btn btn-o btn-block" onClick={onClose} data-v2-close>ปิด</button>}>
      <div className="v2-cs">
        {opts.map((o) => (
          <button key={o.to} className="v2-co press" onClick={() => go(o.to)} data-create={o.to}>
            <i className={o.grad ? 'grad' : ''}><Icon name={o.icon} size={24} color={o.grad ? '#fff' : 'var(--p)'} /></i>
            <span style={{ flex: 1 }}><b>{o.t}</b><small>{o.d}</small></span>
            <Icon name="chev" size={18} color="var(--mut)" />
          </button>
        ))}
        {db.drafts.length > 0 && <button className="v2-li" style={{ padding: '8px 4px' }} onClick={() => go('/sell/drafts')}><span className="tx">ร่างค้างไว้ {db.drafts.length} ชิ้น</span><span className="end" style={{ color: 'var(--p)', fontWeight: 600 }}>ทำต่อ ›</span></button>}
      </div>
    </Sheet>
  )
}

/** ☰ icon (not in the shared icon set). */
export const MenuIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
