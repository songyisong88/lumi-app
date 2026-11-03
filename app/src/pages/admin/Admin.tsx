import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Empty, Img, Sheet, TopBar } from '../../components/ui'
import { baht } from '../../data/sampleData'
import { AUTO_HIDE_AT, REJECT_REASONS, autoHidden, decide, initModeration, decisionOf, fullLog, itemInfo, pending, queue, reportCount, todayCounts, useModeration, type Act, type LogEntry, type QItem, type Tab } from '../../services/moderation'
import { useIsAdmin } from '../../services/staff'
import { toast } from '../../services/toast'

const ACT: Record<Act, { t: string; ic: string; bg: string; fg: string }> = {
  approve: { t: 'อนุมัติ', ic: 'check', bg: '#E7F7EC', fg: '#15803D' },
  reject: { t: 'ไม่อนุมัติ', ic: 'x', bg: '#FDECEC', fg: '#C2282E' },
  auto_approve: { t: 'AI อนุมัติเอง', ic: 'robot', bg: '#F3EDFF', fg: '#6C2BD9' },
  auto_hide: { t: 'ซ่อนอัตโนมัติ', ic: 'eyeoff', bg: '#FFF1D6', fg: '#9A5B00' },
}
const hm = (t: number) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
const ago = (t: number) => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? `${m} นาทีที่แล้ว` : `${Math.round(m / 60)} ชม.ที่แล้ว` }

function NoAccess() {
  return <div className="v2 page"><TopBar title="ตรวจผลงาน" /><Empty icon="lock" title="หน้านี้สำหรับแอดมินเท่านั้น" text="บัญชีนี้ไม่มีสิทธิ์ตรวจผลงาน" action={<Link to="/" className="btn btn-s btn-sm">กลับหน้าแรก</Link>} /></div>
}
const Sample = () => <p className="v2-sm" style={{ textAlign: 'center', padding: '0 24px 12px' }}>คิวตัวอย่างบนเว็บเดโม · การตัดสินเก็บในเครื่องนี้ ยังไม่เชื่อมคิวจริงของระบบ</p>

function RejectSheet({ item, onClose }: { item: QItem | null; onClose: () => void }) {
  const [r, setR] = useState(-1)
  const [note, setNote] = useState('')
  useEffect(() => { if (item) { setR(-1); setNote('') } }, [item])
  return (
    <Sheet open={!!item} onClose={onClose} title="ไม่อนุมัติเพราะอะไร" sub="ครีเอเตอร์จะเห็นเหตุผลนี้ และแก้แล้วส่งใหม่ได้"
      footer={<><button className="btn btn-o" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button><button className="btn btn-p" style={{ flex: 1.4 }} disabled={r < 0} data-confirm-reject onClick={() => { if (!item) return; decide(item.productId, 'reject', REJECT_REASONS[r], note.trim() || undefined); toast('ไม่อนุมัติแล้ว · แจ้งครีเอเตอร์แล้ว'); onClose() }}>ยืนยันไม่อนุมัติ</button></>}>
      {REJECT_REASONS.map((x, i) => <button key={x} className={`v2-reason ${r === i ? 'on' : ''}`} onClick={() => setR(i)} role="radio" aria-checked={r === i}><i />{x}</button>)}
      <div className="v2-glabel" style={{ padding: '16px 0 0' }}>ข้อความถึงครีเอเตอร์ (ไม่บังคับ)</div>
      <textarea className="v2-ta" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลองเปลี่ยนภาพตัวอย่างให้ตรงกับไฟล์จริง" />
    </Sheet>
  )
}

function QCard({ q, onReject }: { q: QItem; onReject: () => void }) {
  const i = itemInfo(q.productId)
  const n = reportCount(q)
  return (
    <section className="v2-card v2-q" data-q={q.id}>
      <div className="top">
        <span className="img"><Img src={i.image} style={{ width: '100%', height: '100%' }} /></span>
        <div style={{ minWidth: 0 }}>
          <b>{i.title}</b>
          <div className="v2-sm">{i.creator?.name} · {ago(q.at)}</div>
          <div className="chips">{i.label && <span className="v2-chip c-n">{i.label}</span>}<span className="v2-chip c-n">{i.price ? baht(i.price) : 'ฟรี'}</span>{q.tab === 'reported' && <span className="v2-chip c-r">รายงาน {n} ครั้ง</span>}</div>
        </div>
      </div>
      {q.aiReason && <div className="v2-ai"><div className="lab">AI สงสัยว่า</div>{q.aiReason}<div className="v2-conf">ความมั่นใจ<span><i style={{ width: `${Math.round((q.aiConf ?? 0) * 100)}%` }} /></span>{Math.round((q.aiConf ?? 0) * 100)}%</div></div>}
      {q.tab === 'reported' && <div className="v2-rep"><div className="lab">ผู้ใช้รายงานว่า</div>{q.reports.map((r) => <div key={r.reason}>• {r.reason} <span className="v2-sm">×{r.n}</span></div>)}
        {autoHidden(q) && <span className="v2-hid" data-auto-hidden><Icon name="eyeoff" size={14} color="#9A5B00" />ซ่อนจากร้านไว้ก่อนแล้ว</span>}</div>}
      <Link to={`/product/${q.productId}`} className="v2-full">ดูผลงานเต็ม ›</Link>
      <div className="v2-act">
        <button className="btn btn-o" onClick={onReject} data-reject={q.id}>ไม่อนุมัติ</button>
        <button className="btn btn-p" data-approve={q.id} onClick={() => { decide(q.productId, 'approve'); toast(q.tab === 'reported' ? 'อนุมัติแล้ว · ผลงานกลับขึ้นร้าน' : 'อนุมัติแล้ว · ผลงานขึ้นร้านแล้ว') }}>อนุมัติ</button>
      </div>
    </section>
  )
}

/** /admin — moderation desk (approved admin mockups 1–5), restyled to UI v2. Admins only. */
export function Admin() {
  const admin = useIsAdmin()
  const nav = useNavigate()
  useModeration()
  useEffect(() => initModeration(), [])
  const [tab, setTab] = useState<Tab>('ai')
  const [rej, setRej] = useState<QItem | null>(null)
  if (!admin) return <NoAccess />
  const all = pending()
  const list = all.filter((q) => q.tab === tab)
  const nAi = all.filter((q) => q.tab === 'ai').length, nRep = all.length - nAi
  const c = todayCounts()
  return (
    <div className="v2 page">
      <TopBar title="ตรวจผลงาน" sub="เฉพาะแอดมิน · คนอื่นมองไม่เห็นหน้านี้" right={<button className="btn btn-s btn-sm" onClick={() => nav('/admin/log')} data-open-log>ประวัติ</button>} />
      <div style={{ height: 8 }} />
      <div className="v2-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'ai'} className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>AI ไม่แน่ใจ{nAi > 0 && <em>{nAi}</em>}</button>
        <button role="tab" aria-selected={tab === 'reported'} className={tab === 'reported' ? 'on' : ''} onClick={() => setTab('reported')}>ถูกรายงาน{nRep > 0 && <em>{nRep}</em>}</button>
      </div>
      {list.length === 0 ? (
        <section className="v2-card v2-empty" data-empty>
          <span className="ok"><Icon name="check" size={34} color="#15803D" stroke={2.6} /></span>
          <b>ไม่มีงานรอตรวจ</b>
          <p>วันนี้ AI อนุมัติเอง {c.ai} งาน · คุณตัดสิน {c.you} งาน</p>
          <button className="btn btn-o" onClick={() => nav('/admin/log')}>ดูประวัติการตัดสิน</button>
        </section>
      ) : <>
        {tab === 'reported' && <p className="v2-sm" style={{ padding: '0 24px 12px' }}>ถูกรายงานครบ {AUTO_HIDE_AT} ครั้ง ระบบซ่อนจากร้านไว้ก่อนจนกว่าแอดมินจะตัดสิน</p>}
        {list.map((q) => <QCard key={q.id} q={q} onReject={() => setRej(q)} />)}
      </>}
      <Sample />
      <RejectSheet item={rej} onClose={() => setRej(null)} />
    </div>
  )
}

const FILTERS: { v: 'all' | Act; t: string }[] = [{ v: 'all', t: 'ทั้งหมด' }, { v: 'approve', t: 'อนุมัติ' }, { v: 'reject', t: 'ไม่อนุมัติ' }, { v: 'auto_approve', t: 'AI อนุมัติเอง' }, { v: 'auto_hide', t: 'ซ่อนอัตโนมัติ' }]
const dayLabel = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); const today = new Date(); today.setHours(0, 0, 0, 0); const diff = Math.round((today.getTime() - d.getTime()) / 864e5); return diff === 0 ? 'วันนี้' : diff === 1 ? 'เมื่อวาน' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) }

/** /admin/log — append-only decision history (mockup 6–7). "เปลี่ยนผล" adds a new entry; old entries never change. */
export function AdminLog() {
  const admin = useIsAdmin()
  useModeration()
  useEffect(() => initModeration(), [])
  const [f, setF] = useState<'all' | Act>('all')
  const [chg, setChg] = useState<LogEntry | null>(null)
  const [r, setR] = useState(0)
  if (!admin) return <NoAccess />
  const log = fullLog().filter((x) => f === 'all' || x.act === f)
  const groups: [string, LogEntry[]][] = []
  for (const e of log) { const k = dayLabel(e.at); const g = groups.find((x) => x[0] === k); if (g) g[1].push(e); else groups.push([k, [e]]) }
  const latest = (pid: string) => fullLog().find((x) => x.productId === pid)
  const cur = chg ? (decisionOf(chg.productId) ?? (chg.act === 'auto_approve' ? 'approve' : chg.act === 'auto_hide' ? 'reject' : chg.act)) : 'approve'
  const target: Act = cur === 'approve' ? 'reject' : 'approve'
  const isQueued = (pid: string) => queue().some((q) => q.productId === pid)
  return (
    <div className="v2 page">
      <TopBar title="ประวัติการตัดสิน" sub="เฉพาะแอดมิน" />
      <div style={{ height: 12 }} />
      <div className="v2-filters">{FILTERS.map((x) => <button key={x.v} className={f === x.v ? 'on' : ''} onClick={() => setF(x.v)}>{x.t}</button>)}</div>
      {groups.length === 0 ? <section className="v2-card"><p className="v2-mut">ยังไม่มีรายการ</p></section> : groups.map(([k, es]) => (
        <div key={k}>
          <div className="v2-glabel">{k}</div>
          <section className="v2-card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {es.map((e) => { const a = ACT[e.act]; const i = itemInfo(e.productId); const canChange = latest(e.productId)?.id === e.id && (e.by === 'you' || isQueued(e.productId) || e.act === 'auto_approve'); return (
              <div key={e.id} className="v2-log" data-log={e.act}>
                <span className="dot" style={{ background: a.bg }}><Icon name={a.ic} size={18} color={a.fg} /></span>
                <div className="tx"><span style={{ color: a.fg, fontWeight: 600 }}>{a.t}</span> · {i.title}
                  <small>{hm(e.at)} · {e.by === 'you' ? 'โดยคุณ' : e.by === 'ai' ? 'โดย AI' : 'โดยระบบ'}{e.reason ? ` · ${e.reason}` : ''}{e.changes ? ` · ${e.changes}` : ''}</small>
                  {e.note && <small>ข้อความถึงครีเอเตอร์: {e.note}</small>}
                </div>
                {canChange && <button className="chg" onClick={() => { setR(0); setChg(e) }} data-change={e.id}>เปลี่ยนผล</button>}
              </div>
            ) })}
          </section>
        </div>
      ))}
      <p className="v2-foot">ประวัติลบหรือแก้ย้อนหลังไม่ได้ · ถ้ากด “เปลี่ยนผล” ระบบบันทึกเป็นรายการใหม่</p>
      <Sheet open={!!chg} onClose={() => setChg(null)} title="เปลี่ยนผลการตัดสิน" sub={chg ? itemInfo(chg.productId).title : ''}
        footer={<><button className="btn btn-o" style={{ flex: 1 }} onClick={() => setChg(null)}>ยกเลิก</button><button className="btn btn-p" style={{ flex: 1.4 }} data-confirm-change onClick={() => { if (!chg) return; decide(chg.productId, target === 'reject' ? 'reject' : 'approve', target === 'reject' ? REJECT_REASONS[r] : undefined, undefined, `เปลี่ยนจาก “${ACT[chg.act].t}”`); toast('บันทึกเป็นรายการใหม่แล้ว'); setChg(null) }}>{target === 'reject' ? 'เปลี่ยนเป็นไม่อนุมัติ' : 'เปลี่ยนเป็นอนุมัติ'}</button></>}>
        <p className="v2-mut" style={{ marginBottom: 12 }}>รายการเดิมยังอยู่ในประวัติ ระบบจะบันทึกผลใหม่ต่อท้าย</p>
        {target === 'reject' && REJECT_REASONS.map((x, i) => <button key={x} className={`v2-reason ${r === i ? 'on' : ''}`} onClick={() => setR(i)} role="radio" aria-checked={r === i}><i />{x}</button>)}
      </Sheet>
    </div>
  )
}
