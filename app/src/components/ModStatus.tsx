import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { Sheet } from './ui'
import { REVIEW_REASONS, sell } from '../services/api'
import { useDb } from '../services/db'
import { toast } from '../services/toast'

const box: React.CSSProperties = { borderRadius: 14, padding: '12px 14px', margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }

/** Owner-only status of a listing under review (A2). The ผ่าน / ไม่ผ่าน buttons stand in for the LUMI team in this demo. */
export function ModBanner({ id }: { id: string }) {
  const p = useDb().published.find((x) => x.id === id)
  const nav = useNavigate()
  const [pick, setPick] = useState(false)
  const [reason, setReason] = useState(REVIEW_REASONS[0])
  if (!p?.mod || p.mod.status === 'live') return null
  if (p.mod.status === 'rejected') return (
    <div style={{ ...box, background: '#FDECEF', border: '1px solid #F9C6D0' }} data-mod-banner="rejected">
      <b style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#BE123C' }}><Icon name="x" size={15} color="#BE123C" stroke={2.6} />ยังไม่ผ่านการตรวจ</b>
      <div>เหตุผล: {p.mod.reason}</div>
      <div className="muted" style={{ fontSize: 12 }}>ผลงานนี้ยังไม่ขึ้นหน้าแรกและหน้าค้นหา · แก้ตามเหตุผลแล้วส่งตรวจใหม่ได้</div>
      <button className="btn btn-p btn-sm" style={{ marginTop: 8 }} onClick={() => nav(`/sell?edit=${p.id}&step=1`)}><Icon name="edit" size={15} color="#fff" />แก้ไขแล้วส่งตรวจใหม่</button>
    </div>
  )
  return (
    <div style={{ ...box, background: '#FFF4E5', border: '1px solid #FCE3A6' }} data-mod-banner="pending">
      <b style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309' }}><Icon name="clock" size={15} color="#B45309" />รอตรวจ</b>
      <div>ทีม LUMI ตรวจทุกชิ้นก่อนขึ้นขาย ปกติไม่เกิน 24 ชม. · ระหว่างรอ ผลงานยังไม่ขึ้นหน้าแรก หน้าค้นหา และหน้าร้าน</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 12 }}>ตัวอย่าง: จำลองผลตรวจ</span>
        <button className="btn btn-xs btn-s" onClick={async () => { await sell.review(p.id, true); toast('ผ่านการตรวจแล้ว · ขึ้นขายแล้ว') }}>ผ่าน</button>
        <button className="btn btn-xs btn-s" onClick={() => setPick(true)}>ไม่ผ่าน</button>
      </div>
      <Sheet open={pick} onClose={() => setPick(false)} title="จำลองผลตรวจ: ไม่ผ่าน" sub="ครีเอเตอร์จะเห็นเหตุผลนี้และแก้ไขได้">
        <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0 14px' }}>
          {REVIEW_REASONS.map((r) => <button key={r} className={`chip ${reason === r ? 'on' : ''}`} aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
        </div>
        <button className="btn btn-p btn-block" onClick={async () => { await sell.review(p.id, false, reason); setPick(false); toast('แจ้งผลตรวจแล้ว (ตัวอย่าง)') }}>ส่งผลตรวจ</button>
      </Sheet>
    </div>
  )
}

/** Status line for the sell success screen (reactive: flips when the demo review finishes). */
export function useModStatus(id: string) {
  return useDb().published.find((x) => x.id === id)?.mod
}
