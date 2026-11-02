import { useState } from 'react'
import { Icon } from './Icon'
import { Sheet } from './ui'
import { toast } from '../services/toast'

type Target = 'product' | 'post' | 'creator'
const REASONS: Record<Target, string[]> = {
  product: ['ละเมิดลิขสิทธิ์ หรือเอางานคนอื่นมาขาย', 'มีข้อมูลส่วนบุคคล', 'โคลนเสียงหรือหน้าคนจริงโดยไม่ได้รับอนุญาต', 'ไฟล์มีไวรัสหรือไม่ตรงปก', 'เนื้อหาไม่เหมาะสมหรือผิดกฎหมาย', 'หลอกลวง หรือนัดชำระเงินนอก LUMI', 'อื่น ๆ'],
  post: ['สแปมหรือโฆษณาหลอกลวง', 'ละเมิดลิขสิทธิ์', 'คุกคามหรือใช้คำหยาบ', 'มีข้อมูลส่วนบุคคล', 'เนื้อหาไม่เหมาะสม', 'อื่น ๆ'],
  creator: ['แอบอ้างเป็นคนอื่น', 'ขายงานที่ละเมิดลิขสิทธิ์', 'หลอกลวง หรือนัดชำระเงินนอก LUMI', 'คุกคามหรือใช้คำหยาบ', 'อื่น ๆ'],
}
const NAME: Record<Target, string> = { product: 'ผลงานนี้', post: 'โพสต์นี้', creator: 'ครีเอเตอร์นี้' }
const KEY = 'lumi_reports'

/** Front-end only: keeps the report on this device. A real moderation queue needs the backend. */
function save(r: { target: Target; id: string; reason: string; note: string }) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown[]
    localStorage.setItem(KEY, JSON.stringify([{ ...r, at: Date.now() }, ...all].slice(0, 50)))
  } catch { /* storage full or blocked: the toast still confirms */ }
}

export function ReportSheet({ open, onClose, target, id }: { open: boolean; onClose: () => void; target: Target; id: string }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const close = () => { onClose(); setReason(''); setNote('') }
  const send = () => { save({ target, id, reason, note: note.trim() }); close(); toast('ส่งรายงานแล้ว ทีมงานจะตรวจสอบ (ทดลอง)') }
  return (
    <Sheet open={open} onClose={close} title={`รายงาน${NAME[target]}`} sub="ผู้ถูกรายงานจะไม่รู้ว่าใครรายงาน"
      footer={<button className="btn btn-p btn-block" disabled={!reason || (reason === 'อื่น ๆ' && !note.trim())} onClick={send}>ส่งรายงาน</button>}>
      <div className="chips" role="radiogroup" aria-label="เหตุผล">
        {REASONS[target].map((r) => <button key={r} role="radio" aria-checked={reason === r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
      </div>
      <label className="field" style={{ marginTop: 14 }}><span className="flabel">รายละเอียดเพิ่มเติม{reason === 'อื่น ๆ' ? '' : ' (ไม่บังคับ)'}</span>
        <textarea className="ta" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลิงก์งานต้นฉบับ หรือสิ่งที่พบ" /></label>
    </Sheet>
  )
}

export function ReportButton({ target, id, className = 'btn btn-xs btn-o', label = 'รายงาน' }: { target: Target; id: string; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={className} onClick={(e) => { e.stopPropagation(); setOpen(true) }} aria-label={`รายงาน${NAME[target]}`}><Icon name="flag" size={15} />{label}</button>
      <ReportSheet open={open} onClose={() => setOpen(false)} target={target} id={id} />
    </>
  )
}
