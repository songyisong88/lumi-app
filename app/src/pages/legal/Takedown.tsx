import { useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Empty, Img, Seg, Sheet, TopBar } from '../../components/ui'
import { BRAND } from '../../config'
import { itemInfo } from '../../services/moderation'
import { useIsAdmin } from '../../services/staff'
import { toast } from '../../services/toast'

/** DEMO DRAFT (not on the real site): takedown notice, counter-notice and the admin takedown queue.
 *  Mirrors the live backend (0041): submit_takedown, submit_counter_notice, takedown_queue, takedown_decide.
 *  On the demo everything stays on this device. ⚖️ wording and deadlines wait for the lawyer. */
type Kind = 'copyright' | 's14_1' | 's14_2_3' | 's14_4'
type Status = 'content_hidden' | 'received' | 'counter_received' | 'restored' | 'removed' | 'rejected'
interface Case { ref: string; kind: Kind; productId: string; notifier: string; work: string; content: string; status: Status; at: number; respondBy: number; counterAt?: number; forwarded?: boolean; counter?: string; mine?: boolean }
const KIND: Record<Kind, { t: string; due: number }> = {
  copyright: { t: 'ละเมิดลิขสิทธิ์', due: 1 },
  s14_1: { t: 'ข้อมูลเท็จ ทำให้ผู้อื่นเสียหาย', due: 7 },
  s14_2_3: { t: 'กระทบความมั่นคงหรือความสงบ', due: 1 },
  s14_4: { t: 'ลามกอนาจาร', due: 3 },
}
const ST: Record<Status, { t: string; c: string }> = {
  received: { t: 'รอตรวจ', c: 'c-a' }, content_hidden: { t: 'ระงับไว้แล้ว', c: 'c-a' }, counter_received: { t: 'มีคำโต้แย้ง', c: 'c-n' },
  restored: { t: 'คืนเนื้อหาแล้ว', c: 'c-g' }, removed: { t: 'นำออกแล้ว', c: 'c-r' }, rejected: { t: 'ปฏิเสธคำร้อง', c: 'c-n' },
}
const D = 864e5
const KEY = 'lumi_takedown_demo'
const SAMPLE: Case[] = [
  { ref: 'TD-7F3A21C9', kind: 'copyright', productId: 'p09', notifier: 'Studio Kaew', work: 'ชุดภาพประกอบ “ทะเลสีชมพู” ปี 2025', content: 'ภาพปกและไฟล์ในสินค้านี้คัดลอกจากผลงานของเรา', status: 'content_hidden', at: Date.now() - 0.3 * D, respondBy: Date.now() + 0.7 * D, mine: true },
  { ref: 'TD-21B0E4D7', kind: 'copyright', productId: 'p24', notifier: 'คุณพิมพ์', work: 'ฟอนต์ลายมือ “พิมพ์ใจ”', content: 'ใช้ฟอนต์ของเราในเทมเพลตโดยไม่ได้รับอนุญาต', status: 'counter_received', at: Date.now() - 9 * D, respondBy: Date.now() - 8 * D, counterAt: Date.now() - 6 * D, counter: 'ฟอนต์นี้ซื้อสิทธิ์เชิงพาณิชย์มาแล้ว มีใบเสร็จ' },
]
const load = (): Case[] => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(s)) return s } catch { /* */ } return SAMPLE }
let cases = load()
const subs = new Set<() => void>()
const save = (c: Case[]) => { cases = c; try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* */ } subs.forEach((f) => f()) }
const patch = (ref: string, p: Partial<Case>) => save(cases.map((x) => (x.ref === ref ? { ...x, ...p } : x)))
const useCases = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => cases)
const dt = (t: number) => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const DraftNote = () => <p className="v2-sm" style={{ textAlign: 'center', padding: '4px 24px 16px' }}>ร่างบนเว็บเดโม · ข้อมูลอยู่ในเครื่องนี้ ยังไม่ส่งถึงทีมงานจริง · ข้อความรอทนายตรวจ</p>

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span className="flabel">{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>
}

/** /takedown/new — anyone (guests too) can file a notice. Fields = Copyright Act s.43/6 + MDES notice 2560 clause 5. */
export function TakedownForm() {
  const nav = useNavigate()
  const [kind, setKind] = useState<'copyright' | 'law'>('copyright')
  const [law, setLaw] = useState<Kind>('s14_1')
  const [f, setF] = useState({ link: '', work: '', content: '', harm: '', name: '', org: '', address: '', phone: '', email: '', sign: '' })
  const [truth, setTruth] = useState(false)
  const [done, setDone] = useState<Case | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const k: Kind = kind === 'copyright' ? 'copyright' : law
  const miss = [!f.link && 'ลิงก์เนื้อหา', f.work.length < 5 && (k === 'copyright' ? 'งานที่ถูกละเมิด' : 'เหตุที่ผิดกฎหมาย'), f.content.length < 5 && 'รายละเอียด',
    f.name.length < 2 && 'ชื่อ', f.address.length < 5 && 'ที่อยู่', f.phone.length < 6 && 'โทรศัพท์', !/^\S+@\S+\.\S+$/.test(f.email) && 'อีเมล', !truth && 'คำรับรอง', f.sign.length < 2 && 'ลายมือชื่อ'].filter(Boolean) as string[]
  if (done) return (
    <div className="v2 page">
      <TopBar title="ส่งคำร้องแล้ว" />
      <section className="v2-card" style={{ marginTop: 12, textAlign: 'center' }} data-td-done>
        <span style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 32, background: '#E7F7EC', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={32} color="#15803D" stroke={2.6} /></span>
        <h3 style={{ margin: '12px 0 4px' }}>เลขที่คำร้อง {done.ref}</h3>
        <p className="v2-mut">{done.kind === 'copyright' ? 'ระบบระงับเนื้อหาไว้ก่อนแล้ว และแจ้งผู้โพสต์ให้โต้แย้งได้' : `ทีมงานจะตรวจและตอบภายใน ${KIND[done.kind].due === 1 ? '24 ชั่วโมง' : `${KIND[done.kind].due} วัน`}`}</p>
        <p className="v2-sm" style={{ marginTop: 8 }}>เก็บเลขนี้ไว้ ใช้ติดตามผลพร้อมอีเมลที่กรอก</p>
        <button className="btn btn-o btn-block" style={{ marginTop: 16 }} onClick={() => nav('/')}>กลับหน้าแรก</button>
      </section>
      <DraftNote />
    </div>
  )
  return (
    <div className="v2 page">
      <TopBar title="แจ้งลบเนื้อหา" sub={`ส่งถึงทีม ${BRAND} · ไม่ต้องมีบัญชี`} />
      <div style={{ height: 12 }} />
      <section className="v2-card">
        <Seg value={kind} onChange={setKind} options={[{ v: 'copyright', label: 'ลิขสิทธิ์' }, { v: 'law', label: 'ผิดกฎหมายอื่น' }]} />
        <div style={{ height: 16 }} />
        {kind === 'law' && <Field label="เรื่องที่แจ้ง">
          <select className="sel" value={law} onChange={(e) => setLaw(e.target.value as Kind)}>
            {(['s14_1', 's14_2_3', 's14_4'] as Kind[]).map((x) => <option key={x} value={x}>{KIND[x].t}</option>)}
          </select></Field>}
        <Field label="ลิงก์ของเนื้อหา" hint="คัดลอกจากปุ่มแชร์ของโพสต์ ผลงาน หรือสตอรี่"><input className="inp" value={f.link} onChange={set('link')} placeholder="https://…" inputMode="url" /></Field>
        <Field label={k === 'copyright' ? 'งานของคุณที่ถูกละเมิด' : 'ผิดกฎหมายอย่างไร'} hint={k === 'copyright' ? 'ชื่องาน ปีที่สร้าง หรือลิงก์ต้นฉบับ' : undefined}><textarea className="ta" rows={2} value={f.work} onChange={set('work')} maxLength={2000} /></Field>
        <Field label="รายละเอียดเนื้อหาที่แจ้ง"><textarea className="ta" rows={3} value={f.content} onChange={set('content')} maxLength={2000} placeholder="ส่วนไหนของเนื้อหาที่ละเมิดหรือผิดกฎหมาย" /></Field>
        <Field label="ความเสียหาย (ถ้ามี)"><textarea className="ta" rows={2} value={f.harm} onChange={set('harm')} maxLength={2000} /></Field>
      </section>
      <div className="v2-glabel">ข้อมูลผู้แจ้ง (ทีมงานใช้ติดต่อกลับ)</div>
      <section className="v2-card">
        <Field label="ชื่อ-นามสกุล"><input className="inp" value={f.name} onChange={set('name')} autoComplete="name" /></Field>
        <Field label="บริษัทหรือในนามของ (ถ้ามี)"><input className="inp" value={f.org} onChange={set('org')} /></Field>
        <Field label="ที่อยู่"><textarea className="ta" rows={2} value={f.address} onChange={set('address')} autoComplete="street-address" /></Field>
        <Field label="โทรศัพท์"><input className="inp" value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></Field>
        <Field label="อีเมล"><input className="inp" value={f.email} onChange={set('email')} inputMode="email" autoComplete="email" /></Field>
        <button className={`v2-reason ${truth ? 'on' : ''}`} role="checkbox" aria-checked={truth} onClick={() => setTruth(!truth)}><i />ข้อมูลทั้งหมดเป็นความจริง และฉันเป็นเจ้าของสิทธิ์หรือได้รับมอบอำนาจ การแจ้งเท็จอาจมีความผิดตามกฎหมาย</button>
        <div style={{ height: 12 }} />
        <Field label="ลายมือชื่ออิเล็กทรอนิกส์" hint="พิมพ์ชื่อ-นามสกุลอีกครั้ง"><input className="inp" value={f.sign} onChange={set('sign')} /></Field>
        <button className="btn btn-p btn-block" data-td-submit disabled={miss.length > 0} onClick={() => {
          const c: Case = { ref: 'TD-' + Math.random().toString(16).slice(2, 10).toUpperCase(), kind: k, productId: 'p12', notifier: f.org || f.name, work: f.work, content: f.content,
            status: k === 'copyright' ? 'content_hidden' : 'received', at: Date.now(), respondBy: Date.now() + KIND[k].due * D }
          save([c, ...cases]); setDone(c)
        }}>ส่งคำร้อง</button>
        {miss.length > 0 && <p className="hint" style={{ textAlign: 'center' }}>ยังขาด: {miss.join(' · ')}</p>}
      </section>
      <DraftNote />
    </div>
  )
}

/** /takedown/:ref — the poster sees what was taken down and can object (Copyright Act s.43/7). */
export function TakedownCase() {
  const { ref = '' } = useParams()
  const all = useCases()
  const c = all.find((x) => x.ref === ref)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', address: '', phone: '', email: '', reason: '', sign: '' })
  const [truth, setTruth] = useState(false)
  if (!c) return <div className="v2 page"><TopBar title="คำร้องแจ้งลบ" /><Empty icon="file" title="ไม่พบคำร้องนี้" /></div>
  const i = itemInfo(c.productId)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const ok = f.name.length > 1 && f.address.length > 4 && f.phone.length > 5 && /^\S+@\S+\.\S+$/.test(f.email) && f.reason.length >= 10 && f.sign.length > 1 && truth
  const back = c.counterAt ? c.counterAt + 30 * D : 0
  return (
    <div className="v2 page">
      <TopBar title="เนื้อหาถูกระงับ" sub={c.ref} />
      <div style={{ height: 12 }} />
      <section className="v2-card" data-td-case>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', flex: 'none' }}><Img src={i.image} style={{ width: '100%', height: '100%' }} /></span>
          <div style={{ minWidth: 0 }}><b>{i.title}</b><div className="v2-sm">ผู้แจ้ง: {c.notifier} · {dt(c.at)}</div>
            <div style={{ marginTop: 6 }}><span className={`v2-chip ${ST[c.status].c}`}>{ST[c.status].t}</span> <span className="v2-chip c-n">{KIND[c.kind].t}</span></div></div>
        </div>
        <div className="v2-glabel" style={{ padding: '16px 0 4px' }}>ผู้แจ้งอ้างว่า</div>
        <p style={{ fontSize: 15, lineHeight: 1.5 }}>{c.work}<br /><span className="v2-mut">{c.content}</span></p>
        {c.status === 'counter_received'
          ? <div className="v2-note"><Icon name="clock" size={18} color="#7A4A00" /><span>ได้รับคำโต้แย้งแล้ว ทีมงานส่งสำเนาให้ผู้แจ้ง ถ้าผู้แจ้งไม่แสดงหลักฐานว่าฟ้องคดีภายใน 30 วัน เนื้อหาจะกลับมาแสดงประมาณ {new Date(back).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span></div>
          : c.status === 'content_hidden' || c.status === 'received'
            ? <div className="v2-note"><Icon name="flag" size={18} color="#7A4A00" /><span>ถ้าคุณเป็นเจ้าของงานนี้หรือมีสิทธิ์ใช้ ส่งคำโต้แย้งได้ ทีมงานจะส่งสำเนาให้ผู้แจ้ง และคืนเนื้อหาเมื่อครบ 30 วันถ้าไม่มีการฟ้องคดี</span></div>
            : null}
        {(c.status === 'content_hidden' || c.status === 'received') && <button className="btn btn-p btn-block" style={{ marginTop: 16 }} data-td-counter onClick={() => setOpen(true)}>ส่งคำโต้แย้ง</button>}
      </section>
      <DraftNote />
      <Sheet open={open} onClose={() => setOpen(false)} title="คำโต้แย้ง" sub="ข้อมูลนี้จะส่งให้ผู้แจ้งตามกฎหมาย" tall
        footer={<><button className="btn btn-o" style={{ flex: 1 }} onClick={() => setOpen(false)}>ยกเลิก</button><button className="btn btn-p" style={{ flex: 1.4 }} disabled={!ok} onClick={() => { patch(c.ref, { status: 'counter_received', counterAt: Date.now(), counter: f.reason }); setOpen(false); toast('ส่งคำโต้แย้งแล้ว') }}>ส่งคำโต้แย้ง</button></>}>
        <Field label="ทำไมการระงับนี้ผิดพลาด"><textarea className="ta" rows={3} value={f.reason} onChange={set('reason')} maxLength={3000} placeholder="เช่น เป็นงานที่ฉันสร้างเอง มีไฟล์ต้นฉบับ หรือได้รับอนุญาตแล้ว" /></Field>
        <Field label="ชื่อ-นามสกุล"><input className="inp" value={f.name} onChange={set('name')} /></Field>
        <Field label="ที่อยู่"><textarea className="ta" rows={2} value={f.address} onChange={set('address')} /></Field>
        <Field label="โทรศัพท์"><input className="inp" value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
        <Field label="อีเมล"><input className="inp" value={f.email} onChange={set('email')} inputMode="email" /></Field>
        <button className={`v2-reason ${truth ? 'on' : ''}`} role="checkbox" aria-checked={truth} onClick={() => setTruth(!truth)}><i />ข้อมูลเป็นความจริง และยินยอมให้ส่งข้อมูลติดต่อนี้ให้ผู้แจ้ง</button>
        <div style={{ height: 12 }} />
        <Field label="ลายมือชื่ออิเล็กทรอนิกส์" hint="พิมพ์ชื่อ-นามสกุลอีกครั้ง"><input className="inp" value={f.sign} onChange={set('sign')} /></Field>
      </Sheet>
    </div>
  )
}

/** /admin/takedown — moderators: notices by deadline, the next legal step, and one-tap decisions. */
export function AdminTakedown() {
  const admin = useIsAdmin()
  const all = useCases()
  if (!admin) return <div className="v2 page"><TopBar title="คำร้องแจ้งลบ" /><Empty icon="lock" title="หน้านี้สำหรับแอดมินเท่านั้น" /></div>
  const open = all.filter((c) => ['received', 'content_hidden', 'counter_received'].includes(c.status))
  const next = (c: Case) => c.status === 'received' ? 'ตรวจแล้วระงับ หรือปฏิเสธ'
    : c.status === 'content_hidden' ? 'รอผู้โพสต์โต้แย้ง'
      : !c.forwarded ? 'ส่งสำเนาคำโต้แย้งให้ผู้แจ้ง'
        : Date.now() >= (c.counterAt ?? 0) + 30 * D ? 'คืนเนื้อหา (ไม่มีหลักฐานฟ้องคดี)' : 'รอครบ 30 วัน หรือหลักฐานฟ้องคดี'
  const act = (c: Case, s: Partial<Case>, t: string) => { patch(c.ref, s); toast(t) }
  return (
    <div className="v2 page">
      <TopBar title="คำร้องแจ้งลบ" sub="เฉพาะแอดมิน · เรียงตามกำหนดตอบ" />
      <div style={{ height: 12 }} />
      {open.length === 0 ? <section className="v2-card v2-empty"><b>ไม่มีคำร้องค้าง</b></section> : open.sort((a, b) => a.respondBy - b.respondBy).map((c) => {
        const i = itemInfo(c.productId); const late = c.status === 'received' && Date.now() > c.respondBy
        return (
          <section key={c.ref} className="v2-card v2-q" data-td-item={c.ref}>
            <div className="top">
              <span className="img"><Img src={i.image} style={{ width: '100%', height: '100%' }} /></span>
              <div style={{ minWidth: 0 }}><b>{i.title}</b><div className="v2-sm">{c.ref} · ผู้แจ้ง {c.notifier}</div>
                <div className="chips"><span className={`v2-chip ${ST[c.status].c}`}>{ST[c.status].t}</span><span className="v2-chip c-n">{KIND[c.kind].t}</span>{late && <span className="v2-chip c-r">เลยกำหนด</span>}</div></div>
            </div>
            <div className="v2-rep"><div className="lab">ผู้แจ้งอ้างว่า</div>{c.work} — {c.content}</div>
            {c.counter && <div className="v2-ai"><div className="lab">ผู้โพสต์โต้แย้ง {c.counterAt ? dt(c.counterAt) : ''}</div>{c.counter}</div>}
            <p className="v2-sm" style={{ margin: '8px 0' }}><b style={{ color: 'var(--p)' }}>ขั้นต่อไป:</b> {next(c)} · {c.status === 'counter_received' ? `คืนได้ตั้งแต่ ${dt((c.counterAt ?? 0) + 30 * D)}` : `ตอบภายใน ${dt(c.respondBy)}`}</p>
            <Link to={`/product/${c.productId}`} className="v2-full">ดูเนื้อหาเต็ม ›</Link>
            <div className="v2-act">
              {c.status === 'received' && <><button className="btn btn-o" onClick={() => act(c, { status: 'rejected' }, 'ปฏิเสธคำร้องแล้ว')}>ปฏิเสธ</button><button className="btn btn-p" onClick={() => act(c, { status: 'content_hidden' }, 'ระงับแล้ว · แจ้งผู้โพสต์แล้ว')}>ระงับเนื้อหา</button></>}
              {c.status === 'content_hidden' && <><button className="btn btn-o" onClick={() => act(c, { status: 'restored' }, 'คืนเนื้อหาแล้ว')}>คำร้องไม่ถูกต้อง</button><button className="btn btn-p" onClick={() => act(c, { status: 'removed' }, 'นำออกถาวรแล้ว')}>ลบถาวร</button></>}
              {c.status === 'counter_received' && !c.forwarded && <button className="btn btn-p" style={{ flex: 1 }} onClick={() => act(c, { forwarded: true }, 'บันทึกว่าส่งสำเนาแล้ว')}>ส่งสำเนาให้ผู้แจ้งแล้ว</button>}
              {c.status === 'counter_received' && c.forwarded && <><button className="btn btn-o" onClick={() => act(c, { status: 'removed' }, 'บันทึกว่ามีการฟ้องคดี')}>มีหลักฐานฟ้องคดี</button><button className="btn btn-p" disabled={Date.now() < (c.counterAt ?? 0) + 30 * D} onClick={() => act(c, { status: 'restored' }, 'คืนเนื้อหาแล้ว')}>คืนเนื้อหา</button></>}
            </div>
          </section>
        )
      })}
      <DraftNote />
    </div>
  )
}
