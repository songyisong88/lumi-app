import { FEATURES } from '../config'
import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Sheet, Stars, blockTap } from './ui'
import { orders } from '../services/api'
import { toast } from '../services/toast'
import { cloudOn } from '../services/cloud'

/** Buyers can report a problem on a digital purchase within this many days (matches the checkout text). */
export const ISSUE_DAYS = 7
const DAY = 86400000
export const issueOpen = (at: number) => Date.now() - at < ISSUE_DAYS * DAY

/** launch rule: after a download only these reasons can be refunded (server: refund_rules) */
const AFTER_DOWNLOAD = ['ไฟล์เปิดไม่ได้ หรือเสีย', 'ไม่ตรงกับคำอธิบายหรือภาพตัวอย่าง']
const REASONS = {
  file: ['ไฟล์เปิดไม่ได้ หรือเสีย', 'ไม่ตรงกับคำอธิบายหรือภาพตัวอย่าง', 'คีย์หรือลิงก์ใช้ไม่ได้', 'ไฟล์ไม่ครบตามรายการ', 'ซื้อซ้ำ หรือกดผิด', 'อื่น ๆ'],
  hire: ['ส่งงานช้าเกินกำหนด · ขอยกเลิกและคืนเงิน', 'งานไม่ตรงบรีฟหรือใบเสนอราคา', 'ครีเอเตอร์ไม่ตอบแชต', 'อื่น ๆ'],
}

/** "แจ้งปัญหา / ขอคืนเงิน": front-end only. A real dispute queue and refunds need the backend. */
export function IssueSheet({ open, onClose, purchaseId, threadId, hire = false, preset }: {
  open: boolean; onClose: () => void; purchaseId?: string; threadId?: string; hire?: boolean; preset?: string
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => { if (open) { setReason(preset ?? ''); setNote('') } }, [open, preset])
  const send = async () => {
    try { await orders.reportIssue({ purchaseId, threadId }, reason, note.trim()) } catch (e) { toast((e as Error).message); return }
    onClose()
    toast(`ส่งเรื่องแล้ว · ครีเอเตอร์ต้องตอบภายใน 3 วัน${cloudOn() ? '' : ' (ตัวอย่าง)'}`)
  }
  return (
    <Sheet open={open} onClose={onClose} title="แจ้งปัญหา / ขอคืนเงิน" sub={hire ? 'ยังไม่โอนเงินให้ครีเอเตอร์ระหว่างตรวจสอบ' : `แจ้งได้ภายใน ${ISSUE_DAYS} วันหลังซื้อ`}
      footer={<button className="btn btn-p btn-block" {...blockTap(!reason || (reason === 'อื่น ๆ' && !note.trim()), reason ? 'เล่ารายละเอียดเพิ่มอีกนิดก่อนส่ง' : 'เลือกปัญหาที่พบก่อนส่งเรื่อง')} onClick={send}>ส่งเรื่อง</button>}>
      <div className="chips" role="radiogroup" aria-label="ปัญหาที่พบ">
        {REASONS[hire ? 'hire' : 'file'].map((r) => <button key={r} role="radio" aria-checked={reason === r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
      </div>
      {FEATURES.launch && !hire && <p className="hint" style={{ marginTop: 10 }}>หลังดาวน์โหลดแล้ว คืนเงินได้เฉพาะกรณี{AFTER_DOWNLOAD.map((r) => `“${r}”`).join(' หรือ ')} · เปลี่ยนใจหลังดาวน์โหลดคืนเงินไม่ได้</p>}
      <label className="field" style={{ marginTop: 14 }}><span className="flabel">เล่ารายละเอียด{reason === 'อื่น ๆ' ? '' : ' (ไม่บังคับ)'}</span>
        <textarea className="ta" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เปิดด้วยโปรแกรมอะไรแล้วขึ้นข้อความอะไร" /></label>
      <div style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.55, background: '#F6F4FB', borderRadius: 12, padding: '10px 12px' }}>
        <b style={{ display: 'block', marginBottom: 2 }}>ขั้นตอนหลังส่งเรื่อง</b>
        1. ครีเอเตอร์ตอบหรือแก้ให้ภายใน 3 วัน<br />2. ถ้าไม่ตอบหรือตกลงกันไม่ได้ ทีม LUMI จะตัดสิน<br />3. ถ้าได้คืนเงิน จะคืนเข้าช่องทางที่ชำระ
        {!cloudOn() && <small style={{ display: 'block', marginTop: 4, color: 'var(--mut)' }}>ตัวอย่าง · ยังไม่ได้ส่งเรื่องถึงครีเอเตอร์จริง</small>}
      </div>
    </Sheet>
  )
}

/** Write or edit the buyer's own review of a purchase (stored on this device). */
export function WriteReviewSheet({ open, onClose, purchaseId, initial }: {
  open: boolean; onClose: () => void; purchaseId: string; initial?: { stars: number; text: string }
}) {
  const [st, setSt] = useState(5)
  const [r, setR] = useState('')
  useEffect(() => { if (open) { setSt(initial?.stars ?? 5); setR(initial?.text ?? '') } }, [open, initial])
  return (
    <Sheet open={open} onClose={onClose} title={initial ? 'แก้ไขรีวิว' : 'เขียนรีวิว'} sub="รีวิวจากผู้ซื้อจริงเท่านั้น · แก้ไขได้ภายหลัง"
      footer={<button className="btn btn-p btn-block" onClick={async () => { await orders.review(purchaseId, st, r.trim()); onClose(); toast(initial ? 'แก้ไขรีวิวแล้ว' : 'ขอบคุณสำหรับรีวิว') }}>{initial ? 'บันทึกรีวิว' : 'ส่งรีวิว'}</button>}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '4px 0 8px' }}>
        {[1, 2, 3, 4, 5].map((i) => <button key={i} onClick={() => setSt(i)} aria-label={`${i} ดาว`}><Icon name="star" size={34} stroke={0} color="none" fill={i <= st ? '#F5A524' : '#E4E1EC'} /></button>)}
      </div>
      <p style={{ textAlign: 'center', marginBottom: 10 }}><Stars v={st} /> {['', 'ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก', 'ประทับใจมาก'][st]}</p>
      <textarea className="ta" rows={3} value={r} onChange={(e) => setR(e.target.value)} placeholder="เล่าให้คนอื่นฟังหน่อย ใช้งานเป็นอย่างไรบ้าง (ไม่บังคับ)" />
    </Sheet>
  )
}
