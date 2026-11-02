/**
 * Real-account screens (sign in / sign up / forgot password, account settings, become creator,
 * shop orders, new story). Routed ONLY when FEATURES.accounts is on — the live build has it off
 * until the owner approves these screens. Everything reuses the existing kit classes.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, SampleNote, Seg, Sheet, Tabs, TopBar, blockTap } from '../../components/ui'
import type { Sale } from '../../data/appTypes'
import { ME, baht, creatorById, productById } from '../../data/sampleData'
import { account, orders, stories } from '../../services/api'
import { refreshSales, thaiError } from '../../services/cloud'
import { useDb } from '../../services/db'
import { endRecovery, leaveDemo, signOut, startDemo, useSession } from '../../services/session'
import { appUrl, publicUrl, sb } from '../../services/supabase'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import { REAL } from '../../config'

const pad = { padding: '16px 16px 24px' }
const err = (e: unknown) => toast(e instanceof Error ? thaiError(e.message) : 'ทำรายการไม่สำเร็จ')

/** Protected route: real account required, otherwise go to sign in (and come back). */
export function NeedAccount({ children }: { children: ReactNode }) {
  const s = useSession()
  if (!s.ready && s.mode !== 'cloud') return <><TopBar title="" /><div style={pad}><p className="muted">กำลังโหลด…</p></div></>
  if (s.mode !== 'cloud') return <Navigate to={`/account/login?next=${encodeURIComponent(location.hash.slice(1))}`} replace />
  return <>{children}</>
}

// ---------------- sign in / sign up / forgot ----------------
export function SignIn() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/profile'
  const ses = useSession()
  const [tab, setTab] = useState<'in' | 'up'>(sp.get('tab') === 'up' ? 'up' : 'in')
  const [how, setHow] = useState<'otp' | 'pw'>('otp')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  useEffect(() => { if (ses.mode === 'cloud') nav(next, { replace: true }) }, [ses.mode, next, nav])
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const run = async (f: () => Promise<{ error: { message: string } | null }>, okMsg?: string) => {
    if (!sb) return toast('ยังไม่ได้เชื่อมเซิร์ฟเวอร์')
    setBusy(true)
    try { const { error } = await f(); if (error) toast(thaiError(error.message)); else if (okMsg) toast(okMsg); return !error } finally { setBusy(false) }
  }
  const sendCode = async () => { if (await run(() => sb!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: tab === 'up', emailRedirectTo: appUrl(), data: name ? { display_name: name.trim() } : undefined } }), 'ส่งรหัสไปที่อีเมลแล้ว')) setSent(true) }
  const verify = () => run(() => sb!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }))
  const withPw = () => tab === 'in'
    ? run(() => sb!.auth.signInWithPassword({ email: email.trim(), password: pw }))
    : run(() => sb!.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: appUrl(), data: { display_name: name.trim() } } }), 'สมัครแล้ว · เปิดอีเมลเพื่อยืนยัน')
  const reset = async () => { if (await run(() => sb!.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() }), 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว')) setForgot(false) }

  return (
    <div className="page">
      <TopBar title={tab === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'} />
      <div className="narrow">
        <Tabs value={tab} options={[{ v: 'in', label: 'เข้าสู่ระบบ' }, { v: 'up', label: 'สมัครใหม่' }]} onChange={(v) => { setTab(v); setSent(false); setCode('') }} />
        <div style={pad}>
          {tab === 'up' && <label className="field"><span className="flabel">ชื่อที่แสดง</span><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฟ้าใส สตูดิโอ" maxLength={40} /></label>}
          <label className="field"><span className="flabel">อีเมล</span><input className="inp" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false) }} placeholder="you@example.com" /></label>
          <Seg value={how} options={[{ v: 'otp', label: 'รหัสทางอีเมล' }, { v: 'pw', label: 'รหัสผ่าน' }]} onChange={setHow} />
          <div style={{ height: 16 }} />
          {how === 'otp' ? (!sent
            ? <button className="btn btn-p btn-block" disabled={busy} {...blockTap(!okEmail || (tab === 'up' && !name.trim()), !okEmail ? 'ใส่อีเมลให้ถูกต้องก่อน' : 'ใส่ชื่อที่จะแสดงก่อน')} onClick={sendCode}>{busy ? 'กำลังส่ง…' : 'ส่งรหัส 6 หลักไปที่อีเมล'}</button>
            : <>
              <label className="field"><span className="flabel">รหัสจากอีเมล</span><input className="inp" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="______" autoFocus /></label>
              <button className="btn btn-p btn-block" disabled={busy} {...blockTap(code.length !== 6, 'ใส่รหัส 6 หลักจากอีเมลก่อน')} onClick={verify}>{busy ? 'กำลังตรวจ…' : 'ยืนยันรหัส'}</button>
              <button className="btn btn-s btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={sendCode}>ส่งรหัสอีกครั้ง</button>
            </>)
            : <>
              <label className="field"><span className="flabel">รหัสผ่าน</span><input className="inp" type="password" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tab === 'up' ? 'อย่างน้อย 8 ตัว' : ''} /></label>
              <button className="btn btn-p btn-block" disabled={busy} {...blockTap(!okEmail || pw.length < (tab === 'up' ? 8 : 1) || (tab === 'up' && !name.trim()), !okEmail ? 'ใส่อีเมลให้ถูกต้องก่อน' : tab === 'up' && !name.trim() ? 'ใส่ชื่อที่จะแสดงก่อน' : tab === 'up' ? 'รหัสผ่านอย่างน้อย 8 ตัว' : 'ใส่รหัสผ่านก่อน')} onClick={withPw}>{busy ? 'กำลังดำเนินการ…' : tab === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
              {tab === 'in' && <button className="btn btn-s btn-block" style={{ marginTop: 10 }} onClick={() => setForgot(true)}>ลืมรหัสผ่าน</button>}
            </>}
          <p className="hint" style={{ marginTop: 14 }}>การสมัครถือว่ายอมรับข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัวของ LUMI</p>
          {/* the sample persona lives on the demo site only */}
          {!REAL && <button className="list-row" style={{ margin: '12px -16px 0', width: 'calc(100% + 32px)' }} onClick={() => { startDemo(); nav('/') }}><Icon name="sparkle" size={20} color="var(--p)" /><span className="grow">ลองใช้แบบตัวอย่าง<small>บัญชีตัวอย่าง ข้อมูลอยู่ในเครื่องนี้เท่านั้น</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>}
          {ses.mode === 'demo' && <button className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }} onClick={() => void leaveDemo()}><Icon name="user" size={20} /><span className="grow">ออกจากโหมดตัวอย่าง</span></button>}
        </div>
      </div>
      <Sheet open={forgot} onClose={() => setForgot(false)} title="ลืมรหัสผ่าน" sub="เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล" footer={<button className="btn btn-p btn-block" disabled={busy} {...blockTap(!okEmail, 'ใส่อีเมลให้ถูกต้องก่อน')} onClick={reset}>ส่งลิงก์</button>}>
        <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="อีเมล" />
      </Sheet>
    </div>
  )
}

/** Opened from the reset-password e-mail (PASSWORD_RECOVERY) or from settings. */
export const NewPassword = () => <NeedAccount><NewPasswordPage /></NeedAccount>
function NewPasswordPage() {
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="page">
      <TopBar title="ตั้งรหัสผ่านใหม่" />
      <div className="narrow" style={pad}>
        <label className="field"><span className="flabel">รหัสผ่านใหม่</span><input className="inp" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="อย่างน้อย 8 ตัว" /></label>
        <label className="field"><span className="flabel">ยืนยันรหัสผ่าน</span><input className={`inp ${pw2 && pw2 !== pw ? 'bad' : ''}`} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn btn-p btn-block" disabled={busy} {...blockTap(pw.length < 8 || pw !== pw2, pw.length < 8 ? 'รหัสผ่านอย่างน้อย 8 ตัว' : 'รหัสผ่านสองช่องยังไม่ตรงกัน')} onClick={async () => { setBusy(true); try { await account.changePassword(pw); endRecovery(); toast('ตั้งรหัสผ่านใหม่แล้ว'); nav('/profile', { replace: true }) } catch (e) { err(e) } finally { setBusy(false) } }}>บันทึกรหัสผ่าน</button>
      </div>
    </div>
  )
}

// ---------------- settings ----------------
export const AccountSettings = () => <NeedAccount><AccountSettingsPage /></NeedAccount>
function AccountSettingsPage() {
  const nav = useNavigate()
  const ses = useSession()
  const pr = ses.profile
  const me = creatorById(ME)
  const [name, setName] = useState(pr?.display_name ?? me.name)
  const [handle, setHandle] = useState(pr?.handle ?? '')
  const [bio, setBio] = useState(pr?.bio ?? '')
  const [avatar, setAvatar] = useState<Blob>()
  const [preview, setPreview] = useState<string>()
  const [sheet, setSheet] = useState<null | 'email' | 'delete' | 'creator'>(null)
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [reqs, setReqs] = useState<{ kind: string; status: string }[]>([])
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { account.requests().then((r) => setReqs(r as { kind: string; status: string }[])).catch(() => {}) }, [])
  useEffect(() => { if (pr) { setName(pr.display_name); setHandle(pr.handle ?? ''); setBio(pr.bio ?? '') } }, [pr])
  const pendingDelete = reqs.some((r) => r.kind === 'delete' && r.status === 'open')
  const dirty = !!avatar || name !== (pr?.display_name ?? me.name) || handle !== (pr?.handle ?? '') || bio !== (pr?.bio ?? '')
  const save = async () => {
    setBusy(true)
    try { await account.saveProfile({ display_name: name.trim(), handle: handle.trim() || null, bio: bio.trim() || null, avatar }); setAvatar(undefined); toast('บันทึกโปรไฟล์แล้ว') } catch (e) { err(e) } finally { setBusy(false) }
  }
  return (
    <div className="page">
      <TopBar title="ตั้งค่าบัญชี" right={<button className="btn btn-sm btn-p" disabled={busy} {...blockTap(!dirty || !name.trim(), !name.trim() ? 'ใส่ชื่อก่อนบันทึก' : 'ยังไม่มีอะไรเปลี่ยน')} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>} />
      <div className="narrow">
        <div className="sec" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Av src={preview ?? (pr?.avatar_path ? publicUrl(pr.avatar_path)! : me.avatar)} size={64} />
          <button className="btn btn-sm btn-s" onClick={() => file.current?.click()}><Icon name="camera" size={16} />เปลี่ยนรูปโปรไฟล์</button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatar(f); setPreview(URL.createObjectURL(f)) } e.target.value = '' }} />
        </div>
        <div style={{ padding: '0 16px' }}>
          <label className="field"><span className="flabel">ชื่อที่แสดง</span><input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
          <label className="field"><span className="flabel">ชื่อผู้ใช้ (@)</span><input className="inp" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24))} placeholder="เช่น fahsai.studio" /></label>
          <label className="field"><span className="flabel">แนะนำตัว</span><textarea className="ta" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} /></label>
        </div>
        <div className="sec">
          <div className="sec-h">บัญชี</div>
          <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
            <button className="list-row" onClick={() => { setEmail(''); setSheet('email') }}><Icon name="globe" size={20} color="var(--ink2)" /><span className="grow">อีเมล<small>{ses.email}</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>
            <button className="list-row" onClick={() => nav('/account/password')}><Icon name="lock" size={20} color="var(--ink2)" /><span className="grow">เปลี่ยนรหัสผ่าน<small>หรือเข้าสู่ระบบด้วยรหัสทางอีเมลก็ได้</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>
            {!pr?.is_creator && <button className="list-row" onClick={() => setSheet('creator')}><Icon name="store" size={20} color="var(--p)" /><span className="grow">เปิดร้านครีเอเตอร์<small>ลงขายผลงาน รับงานจ้าง และลงสตอรี่</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>}
            {pr?.is_creator && <button className="list-row" onClick={() => nav('/story/new')}><Icon name="camera" size={20} color="var(--ink2)" /><span className="grow">ลงสตอรี่<small>รูปหรือวิดีโอ แสดง 24 ชั่วโมง</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>}
            {pr?.is_creator && <button className="list-row" onClick={() => nav('/shop/orders')}><Icon name="receipt" size={20} color="var(--ink2)" /><span className="grow">ออเดอร์ของร้าน<small>ยอดขาย สถานะการโอน และคำขอคืนเงิน</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>}
            <button className="list-row" onClick={async () => { await signOut(); toast('ออกจากระบบแล้ว'); nav('/', { replace: true }) }}><Icon name="back" size={20} color="var(--ink2)" /><span className="grow">ออกจากระบบ</span></button>
            <button className="list-row" style={{ color: '#DC2626' }} onClick={() => setSheet('delete')}><Icon name="trash" size={20} color="#DC2626" /><span className="grow">{pendingDelete ? 'คำขอลบบัญชีกำลังดำเนินการ' : 'ขอลบบัญชี'}<small>{pendingDelete ? 'ยกเลิกได้ก่อนทีม LUMI ดำเนินการ' : 'ลบข้อมูลส่วนตัวภายใน 30 วัน'}</small></span></button>
          </div>
        </div>
      </div>
      <Sheet open={sheet === 'email'} onClose={() => setSheet(null)} title="เปลี่ยนอีเมล" sub="ต้องกดยืนยันจากทั้งอีเมลเดิมและอีเมลใหม่" footer={<button className="btn btn-p btn-block" disabled={busy} {...blockTap(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'ใส่อีเมลใหม่ให้ถูกต้องก่อน')} onClick={async () => { setBusy(true); try { await account.changeEmail(email.trim()); toast('ส่งลิงก์ยืนยันไปที่อีเมลแล้ว'); setSheet(null) } catch (e) { err(e) } finally { setBusy(false) } }}>ส่งลิงก์ยืนยัน</button>}>
        <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมลใหม่" aria-label="อีเมลใหม่" />
      </Sheet>
      <Sheet open={sheet === 'delete'} onClose={() => setSheet(null)} title={pendingDelete ? 'ยกเลิกคำขอลบบัญชี?' : 'ขอลบบัญชี'} sub={pendingDelete ? undefined : 'ของที่ซื้อแล้วจะดาวน์โหลดไม่ได้อีก · ใบเสร็จที่กฎหมายกำหนดจะเก็บไว้ตามระยะเวลา'}
        footer={pendingDelete
          ? <button className="btn btn-p btn-block" onClick={async () => { try { await account.cancelDeletion(); setReqs(await account.requests() as { kind: string; status: string }[]); setSheet(null) } catch (e) { err(e) } }}>ยกเลิกคำขอ</button>
          : <button className="btn btn-block" style={{ background: '#DC2626', color: '#fff' }} disabled={busy} onClick={async () => { try { await account.requestDeletion(reason); setReqs(await account.requests() as { kind: string; status: string }[]); setSheet(null) } catch (e) { err(e) } }}>ส่งคำขอลบบัญชี</button>}>
        {!pendingDelete && <textarea className="ta" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล (ไม่บังคับ)" aria-label="เหตุผล" />}
      </Sheet>
      <BecomeCreatorSheet open={sheet === 'creator'} onClose={() => setSheet(null)} name={name} handle={handle} bio={bio} />
    </div>
  )
}

function BecomeCreatorSheet({ open, onClose, ...init }: { open: boolean; onClose: () => void; name: string; handle: string; bio: string }) {
  const [name, setName] = useState(init.name)
  const [handle, setHandle] = useState(init.handle)
  const [bio, setBio] = useState(init.bio)
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={open} onClose={onClose} title="เปิดร้านครีเอเตอร์" sub="ฟรี · เริ่มจากผลงานฟรีก่อน การขายแบบชำระเงินจะเปิดภายหลัง" tall
      footer={<button className="btn btn-p btn-block" disabled={busy} {...blockTap(!name.trim() || handle.length < 3, !name.trim() ? 'ใส่ชื่อร้านก่อน' : 'ชื่อผู้ใช้อย่างน้อย 3 ตัว')} onClick={async () => { setBusy(true); try { await account.becomeCreator(name.trim(), handle, bio.trim()); toast('เปิดร้านแล้ว 🎉'); onClose() } catch (e) { err(e) } finally { setBusy(false) } }}>เปิดร้าน</button>}>
      <label className="field"><span className="flabel">ชื่อร้าน</span><input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
      <label className="field"><span className="flabel">ชื่อผู้ใช้ (@)</span><input className="inp" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24))} placeholder="อย่างน้อย 3 ตัว" /></label>
      <label className="field"><span className="flabel">แนะนำร้าน</span><textarea className="ta" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} placeholder="ทำผลงานแนวไหน รับจ้างอะไรบ้าง" /></label>
      <p className="hint">ผลงานทุกชิ้นจะผ่านการตรวจก่อนขึ้นร้าน</p>
    </Sheet>
  )
}

// ---------------- creator shop orders ----------------
const PAYOUT: Record<Sale['payout'], [string, string]> = {
  held: ['รอปล่อยยอด', 'pill'], released: ['รอบโอนถัดไป', 'pill pill-p'], paid_out: ['โอนแล้ว', 'pill pill-g'], refunded: ['คืนเงินแล้ว', 'pill'], disputed: ['มีข้อโต้แย้ง', 'pill'],
}
export const ShopOrders = () => <NeedAccount><ShopOrdersPage /></NeedAccount>
function ShopOrdersPage() {
  const db = useDb()
  const [tab, setTab] = useState<'all' | 'refund' | 'paid'>('all')
  const [open, setOpen] = useState<Sale>()
  const [note, setNote] = useState('')
  useEffect(() => { void refreshSales().catch(() => {}) }, [])
  const sales = db.sales ?? []
  const list = sales.filter((x) => (tab === 'refund' ? x.refund?.status === 'open' : tab === 'paid' ? x.payout === 'paid_out' : true))
  const sum = (f: (x: Sale) => boolean) => sales.filter(f).reduce((a, x) => a + x.net, 0)
  const nOpen = sales.filter((x) => x.refund?.status === 'open').length
  return (
    <div className="page">
      <TopBar title="ออเดอร์ของร้าน" sub={`${sales.length} ออเดอร์`} />
      <div className="narrow">
        <div className="sec" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {([['รอปล่อยยอด', sum((x) => x.payout === 'held')], ['รอบโอนถัดไป', sum((x) => x.payout === 'released')], ['โอนแล้ว', sum((x) => x.payout === 'paid_out')]] as const).map(([t, v]) => (
            <div key={t} className="card2" style={{ padding: 12 }}><small className="muted">{t}</small><b style={{ display: 'block', fontSize: 17 }}>{baht(v)}</b></div>
          ))}
        </div>
        <Tabs value={tab} options={[{ v: 'all', label: 'ทั้งหมด' }, { v: 'refund', label: `ขอคืนเงิน${nOpen ? ` (${nOpen})` : ''}` }, { v: 'paid', label: 'โอนแล้ว' }]} onChange={setTab} sticky />
        {list.length === 0 && <Empty icon="receipt" title={tab === 'refund' ? 'ไม่มีคำขอคืนเงิน' : 'ยังไม่มีออเดอร์'} text="ออเดอร์จะขึ้นที่นี่เมื่อมีคนซื้อหรือจ้างงาน" />}
        <div className="card2" style={{ padding: 0, overflow: 'hidden', margin: '8px 16px' }}>
          {list.map((x) => (
            <button key={x.id} className="list-row" onClick={() => { setNote(''); setOpen(x) }}>
              <Av src={creatorById(x.buyerId).avatar} size={36} />
              <span className="grow"><b className="ell" style={{ display: 'block' }}>{x.title}</b><small>#{x.orderNo} · {creatorById(x.buyerId).name} · {ago(x.at)}</small></span>
              <span style={{ textAlign: 'right' }}><b style={{ display: 'block' }}>{x.gross ? baht(x.net) : 'ฟรี'}</b>{x.refund?.status === 'open' ? <span className="pill" style={{ background: '#FEF2F2', color: '#B91C1C' }}>ขอคืนเงิน</span> : <span className={PAYOUT[x.payout][1]}>{PAYOUT[x.payout][0]}</span>}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '4px 16px 24px' }}><SampleNote keep>โหมดทดลอง · ยังไม่มีการรับหรือโอนเงินจริง สถานะการโอนเป็นการจำลอง</SampleNote></div>
      </div>
      <Sheet open={!!open} onClose={() => setOpen(undefined)} title={open?.title} sub={open ? `ออเดอร์ #${open.orderNo} · ${ago(open.at)}` : ''}
        footer={open?.refund?.status === 'open' ? <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-s" style={{ flex: 1 }} onClick={async () => { try { await orders.answerRefund(open.refund!.id, false, note); toast('ส่งให้ทีม LUMI ตัดสินแล้ว'); setOpen(undefined) } catch (e) { err(e) } }}>ไม่คืน · ให้ทีมตัดสิน</button>
          <button className="btn btn-p" style={{ flex: 1 }} onClick={async () => { try { await orders.answerRefund(open.refund!.id, true, note); toast('คืนเงินแล้ว (ทดลอง)'); setOpen(undefined) } catch (e) { err(e) } }}>คืนเงิน</button>
        </div> : undefined}>
        {open && <div>
          <div className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }}><span className="grow">ยอดขาย</span><b>{baht(open.gross)}</b></div>
          <div className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }}><span className="grow">ค่าธรรมเนียม LUMI</span><b>−{baht(open.fee)}</b></div>
          <div className="list-row" style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }}><span className="grow">รับสุทธิ<small>{PAYOUT[open.payout][0]}{open.releaseAt && open.payout === 'held' ? ` · ปล่อยยอด ${new Date(open.releaseAt).toLocaleDateString('th-TH')}` : ''}</small></span><b>{baht(open.net)}</b></div>
          {open.productId && productById(open.productId) && <p className="hint">{open.optionLabel ?? ''}</p>}
          {open.refund && <div className="hint" style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 12, padding: '10px 12px', marginTop: 8 }}><b>ขอคืนเงิน: {open.refund.reason}</b>{open.refund.note && <><br />{open.refund.note}</>}</div>}
          {open.refund?.status === 'open' && <textarea className="ta" rows={2} style={{ marginTop: 10 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ข้อความถึงผู้ซื้อ (ไม่บังคับ)" aria-label="ข้อความถึงผู้ซื้อ" />}
        </div>}
      </Sheet>
    </div>
  )
}

// ---------------- new story (24 h) ----------------
export const NewStory = () => <NeedAccount><NewStoryPage /></NeedAccount>
function NewStoryPage() {
  const nav = useNavigate()
  const db = useDb()
  const [f, setF] = useState<File>()
  const [url, setUrl] = useState<string>()
  const [cap, setCap] = useState('')
  const [prod, setProd] = useState<string>()
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const kind = f?.type.startsWith('video/') ? 'video' : 'image'
  const mine = db.published.filter((p) => p.creatorId === ME).slice(0, 12)
  const pick = (x?: File) => { if (!x) return; if (x.size > 10 * 1048576) return toast('ไฟล์ใหญ่เกิน 10 MB'); setF(x); setUrl(URL.createObjectURL(x)) }
  const mineStories = (db.stories ?? []).filter((s) => s.authorId === ME && s.expires > Date.now())
  return (
    <div className="page">
      <TopBar title="ลงสตอรี่" sub="หายไปเองใน 24 ชั่วโมง" right={<button className="btn btn-sm btn-p" disabled={busy} {...blockTap(!f, 'เลือกรูปหรือคลิปก่อน')} onClick={async () => { setBusy(true); try { await stories.post(f!, kind, cap.trim(), prod); toast('ลงสตอรี่แล้ว'); nav(`/story/${ME}`, { replace: true }) } catch (e) { err(e) } finally { setBusy(false) } }}>{busy ? 'กำลังลง…' : 'ลงสตอรี่'}</button>} />
      <div className="narrow" style={pad}>
        <button className="card2 press" style={{ width: '100%', aspectRatio: '9/14', maxHeight: 420, display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 0 }} onClick={() => file.current?.click()}>
          {!url ? <span className="muted" style={{ display: 'grid', placeItems: 'center', gap: 8 }}><Icon name="camera" size={30} color="var(--p)" />เลือกรูปหรือวิดีโอ (ไม่เกิน 10 MB)</span>
            : kind === 'video' ? <video src={url} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </button>
        <input ref={file} type="file" accept="image/*,video/mp4,video/webm" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
        <label className="field" style={{ marginTop: 14 }}><span className="flabel">ข้อความ (ไม่บังคับ)</span><input className="inp" value={cap} onChange={(e) => setCap(e.target.value)} maxLength={200} placeholder="เช่น งานใหม่มาแล้ว ✨" /></label>
        {mine.length > 0 && <><span className="flabel">แท็กผลงาน (ไม่บังคับ)</span><div className="chips hscroll">{mine.map((p) => <button key={p.id} className={`chip ${prod === p.id ? 'on' : ''}`} onClick={() => setProd(prod === p.id ? undefined : p.id)}>{p.title}</button>)}</div></>}
        {mineStories.length > 0 && <div className="sec" style={{ padding: '16px 0 0' }}>
          <div className="sec-h">สตอรี่ที่ยังแสดงอยู่</div>
          <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
            {mineStories.map((s) => <div key={s.id} className="list-row"><Icon name={s.kind === 'video' ? 'play' : 'image'} size={20} /><span className="grow">{s.caption || (s.kind === 'video' ? 'วิดีโอ' : 'รูปภาพ')}<small>{ago(s.at)} · ดู {s.views} ครั้ง</small></span><button className="btn btn-xs btn-s" onClick={async () => { if (!confirm('ลบสตอรี่นี้?')) return; try { await stories.remove(s.id); toast('ลบสตอรี่แล้ว') } catch (e) { err(e) } }}><Icon name="trash" size={14} />ลบ</button></div>)}
          </div>
        </div>}
      </div>
    </div>
  )
}
