/**
 * Real-account screens (sign in / sign up / forgot password, account settings, become creator,
 * shop orders, new story). Routed ONLY when FEATURES.accounts is on — the live build has it off
 * until the owner approves these screens. Everything reuses the existing kit classes.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, SampleNote, Sheet, Tabs, TopBar, blockTap } from '../../components/ui'
import type { Sale } from '../../data/appTypes'
import { ME, baht, creatorById, productById } from '../../data/sampleData'
import { account, orders, stories } from '../../services/api'
import { refreshSales, thaiError } from '../../services/cloud'
import { useDb } from '../../services/db'
import { endRecovery, leaveDemo, signOut, startDemo, useSession } from '../../services/session'
import { appUrl, publicUrl, sb } from '../../services/supabase'
import { SHOW_DEMO, SOCIAL, SOCIALS, type SocialId } from '../../config'
import a from './Auth.module.css'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'

const pad = { padding: '16px 16px 24px' }
const err = (e: unknown) => toast(e instanceof Error ? thaiError(e.message) : 'ทำรายการไม่สำเร็จ')

/** Protected route: real account required, otherwise go to sign in (and come back). */
export function NeedAccount({ children }: { children: ReactNode }) {
  const s = useSession()
  if (!s.ready && s.mode !== 'cloud') return <><TopBar title="" /><div style={pad}><p className="muted">กำลังโหลด…</p></div></>
  if (s.mode !== 'cloud') return <Navigate to={`/account/login?next=${encodeURIComponent(location.hash.slice(1))}`} replace />
  return <>{children}</>
}

// ---------------- sign in / sign up / verify / forgot (option B, mockups B1–B5) ----------------
const OK_EMAIL = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
type Step = 'in' | 'up' | 'verify' | 'code' | 'login-code' | 'forgot' | 'reset'

function Pw({ value, onChange, placeholder, auto }: { value: string; onChange: (v: string) => void; placeholder: string; auto: string }) {
  const [see, setSee] = useState(false)
  return <div className={a.fld}><input className={`inp ${a.big}`} type={see ? 'text' : 'password'} autoComplete={auto} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    <button type="button" className={a.eye} onClick={() => setSee(!see)} aria-label={see ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}><Icon name="eye" size={20} /></button></div>
}
function Otp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(true)
  return <div className={a.otp}>
    {Array.from({ length: 6 }, (_, i) => <b key={i} className={focus && i === Math.min(value.length, 5) ? a.f : ''}>{value[i] ?? ''}</b>)}
    <input inputMode="numeric" autoComplete="one-time-code" aria-label="รหัส 6 หลัก" autoFocus value={value} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
  </div>
}
/** “ส่งใหม่ได้ใน 0:42” countdown (60 s, like Shopee's OTP). */
function useCountdown() {
  const [until, setUntil] = useState(0)
  const [, tick] = useState(0)
  useEffect(() => { if (until <= Date.now()) return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [until])
  const left = Math.max(0, Math.ceil((until - Date.now()) / 1000))
  return { left, start: () => setUntil(Date.now() + 60_000), label: `0:${String(left % 60).padStart(2, '0')}`.replace(/^0:60$/, '1:00') }
}
const SOC_ICON: Record<SocialId, ReactNode> = {
  google: <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>,
  line: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><rect width="24" height="24" rx="6" fill="#06C755"/><path fill="#fff" d="M12 5.2c-4.2 0-7.6 2.7-7.6 6.1 0 3 2.7 5.6 6.4 6 .3.1.6.2.7.5.1.2 0 .6 0 .8l-.1.7c0 .2-.2.8.7.4.9-.4 4.8-2.8 6.5-4.8 1.2-1.3 1.7-2.6 1.7-3.6C20.4 7.9 16.2 5.2 12 5.2z"/></svg>,
  facebook: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="11" fill="#1877F2"/><path fill="#fff" d="M13.3 19.5v-6.2h2.1l.3-2.5h-2.4V9.3c0-.7.2-1.2 1.2-1.2h1.3V5.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.8H8.6v2.5h2.1v6.2z"/></svg>,
  apple: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path fill="#111" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 6.9 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.7zM14.2 5.8c.6-.8 1.1-1.8 1-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3z"/></svg>,
}
const SOC_NAME: Record<SocialId, string> = { google: 'Google', line: 'LINE', facebook: 'Facebook', apple: 'Apple' }
const SOC_PROVIDER: Record<SocialId, string> = { google: 'google', line: 'custom:line', facebook: 'facebook', apple: 'apple' }

export function SignIn() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/profile'
  const ses = useSession()
  const [step, setStep] = useState<Step>(sp.get('tab') === 'up' ? 'up' : 'in')
  const [hist, setHist] = useState<Step[]>([])
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const hold = useRef(false) // keep the page while a recovery code is being turned into a new password
  const cd = useCountdown()
  useEffect(() => { if (ses.mode === 'cloud' && !hold.current) nav(next, { replace: true }) }, [ses.mode, next, nav])
  const go = (s: Step) => { setHist((h) => [...h, step]); setStep(s); setCode('') }
  const back = () => { if (!hist.length) return (window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'); setStep(hist[hist.length - 1]); setHist((h) => h.slice(0, -1)); setCode('') }
  const okEmail = OK_EMAIL(email)
  const run = async (f: () => Promise<{ error: { message: string } | null }>, okMsg?: string) => {
    if (!sb) { toast('ยังไม่ได้เชื่อมเซิร์ฟเวอร์'); return false }
    setBusy(true)
    try { const { error } = await f(); if (error) toast(thaiError(error.message)); else if (okMsg) toast(okMsg); return !error } catch (e) { err(e); return false } finally { setBusy(false) }
  }
  const mail = () => email.trim()
  const signInPw = async () => {
    if (!sb) return toast('ยังไม่ได้เชื่อมเซิร์ฟเวอร์')
    setBusy(true)
    try {
      const { error } = await sb.auth.signInWithPassword({ email: mail(), password: pw })
      if (!error) return
      // signed up but never confirmed → send a fresh code and show “ยืนยันอีเมล” (B3) instead of a dead end
      if (/email not confirmed/i.test(error.message)) {
        const r = await sb.auth.resend({ type: 'signup', email: mail(), options: { emailRedirectTo: appUrl() } })
        toast(r.error ? thaiError(r.error.message) : 'ยังไม่ได้ยืนยันอีเมล · ส่งรหัสไปที่อีเมลแล้ว')
        if (!r.error) { cd.start(); go('verify') }
        return
      }
      toast(thaiError(error.message))
    } catch (e) { err(e) } finally { setBusy(false) }
  }
  const signUp = async () => {
    let exists = false
    const ok = await run(async () => {
      const r = await sb!.auth.signUp({ email: mail(), password: pw, options: { emailRedirectTo: appUrl(), data: { display_name: name.trim() } } })
      exists = !r.error && !!r.data.user && (r.data.user.identities?.length ?? 1) === 0 // Supabase hides “already registered”
      return r
    })
    if (!ok) return
    if (exists) { toast('อีเมลนี้มีบัญชีแล้ว · เข้าสู่ระบบแทน'); setPw(''); go('in'); return }
    toast('ส่งรหัสยืนยันไปที่อีเมลแล้ว'); cd.start(); go('verify')
  }
  const resendSignup = async () => { if (await run(() => sb!.auth.resend({ type: 'signup', email: mail(), options: { emailRedirectTo: appUrl() } }), 'ส่งรหัสใหม่แล้ว')) cd.start() }
  const verifySignup = () => run(() => sb!.auth.verifyOtp({ email: mail(), token: code, type: 'signup' }))
  const sendLoginCode = async (first = true) => {
    if (await run(() => sb!.auth.signInWithOtp({ email: mail(), options: { shouldCreateUser: false, emailRedirectTo: appUrl() } }), first ? 'ส่งรหัสไปที่อีเมลแล้ว' : 'ส่งรหัสใหม่แล้ว')) { cd.start(); if (first) go('code') }
  }
  const verifyLogin = () => run(() => sb!.auth.verifyOtp({ email: mail(), token: code, type: 'email' }))
  const sendReset = async (first = true) => {
    if (await run(() => sb!.auth.resetPasswordForEmail(mail(), { redirectTo: appUrl() }), first ? 'ส่งรหัสไปที่อีเมลแล้ว' : 'ส่งรหัสใหม่แล้ว')) { cd.start(); if (first) { setPw(''); setPw2(''); go('reset') } }
  }
  const saveNewPw = async () => {
    hold.current = true
    const ok = await run(() => sb!.auth.verifyOtp({ email: mail(), token: code, type: 'recovery' }))
    if (!ok) { hold.current = false; return }
    const ok2 = await run(() => sb!.auth.updateUser({ password: pw }), 'ตั้งรหัสผ่านใหม่แล้ว')
    endRecovery(); hold.current = false
    if (ok2) nav(next, { replace: true })
  }
  const social = (id: SocialId) => run(() => sb!.auth.signInWithOAuth({ provider: SOC_PROVIDER[id] as 'google', options: { redirectTo: appUrl() } }))
  const socials = SOCIALS.filter((id) => SOCIAL[id])
  const srow = (label: string) => socials.length > 0 && <>
    <div className={a.or}>{label}</div>
    <div className={a.srow}>{socials.map((id) => <button key={id} type="button" className={a.sbtn} disabled={busy} onClick={() => void social(id)} aria-label={`${label} ${SOC_NAME[id]}`}>{SOC_ICON[id]}</button>)}</div>
  </>
  const terms = <p className={`${a.small} ${a.terms}`}>การดำเนินการต่อถือว่ายอมรับ <span className={a.lnk}>ข้อตกลงการใช้งาน</span> และ <span className={a.lnk}>นโยบายความเป็นส่วนตัว</span></p>
  const emailIn = <input className={`inp ${a.big}`} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมลของคุณ" aria-label="อีเมล" />
  const resend = (f: () => void) => <p className={a.small} style={{ marginTop: 16 }}>ไม่ได้รับรหัส? ดูในจดหมายขยะ หรือ {cd.left > 0 ? <b>ส่งใหม่ได้ใน {cd.label}</b> : <button type="button" className={a.lnk} disabled={busy} onClick={f}>ส่งรหัสใหม่</button>}</p>
  const codeBlock = (title: string, btn: string, onOk: () => void, onResend: () => void, icon = true) => <>
    {icon && <div className={a.ok}><Icon name="mail" size={30} color="var(--p)" /></div>}
    <h1 className={a.h1}>{title}</h1><p className={a.sub}>ใส่รหัส 6 หลักที่ส่งไปที่ <b>{mail()}</b></p>
    <Otp value={code} onChange={setCode} />
    <button className={`btn btn-p ${a.bbig}`} disabled={busy} {...blockTap(code.length !== 6, 'ใส่รหัส 6 หลักจากอีเมลก่อน')} onClick={onOk}>{busy ? 'กำลังตรวจ…' : btn}</button>
    {resend(onResend)}
  </>

  let body: ReactNode, foot: ReactNode = null
  if (step === 'in') {
    body = <>
      <div className={a.brand}><div className={a.logo}><Icon name="sparkle" size={30} color="none" stroke={0} fill="#fff" /></div><div className={a.wm}>LUMI</div></div>
      <h1 className={`${a.h1} ${a.center}`} style={{ marginBottom: 20 }}>เข้าสู่ระบบ</h1>
      {emailIn}<div className={a.gap} />
      <Pw value={pw} onChange={setPw} placeholder="รหัสผ่าน" auto="current-password" />
      <button className={`btn btn-p ${a.bbig}`} style={{ marginTop: 4 }} disabled={busy} {...blockTap(!okEmail || !pw, !okEmail ? 'ใส่อีเมลให้ถูกต้องก่อน' : 'ใส่รหัสผ่านก่อน')} onClick={() => void signInPw()}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
      <div className={a.links}><button type="button" className={a.lnk} onClick={() => go('forgot')}>ลืมรหัสผ่าน?</button><button type="button" className={a.lnk} onClick={() => go('login-code')}>เข้าด้วยรหัสทางอีเมล</button></div>
      {srow('หรือเข้าสู่ระบบด้วย')}
    </>
    foot = <>
      <button className={`btn btn-o ${a.bbig}`} onClick={() => { setPw(''); go('up') }}>สร้างบัญชีใหม่</button>
      {SHOW_DEMO && <button className={a.demo} onClick={() => { startDemo(); nav('/') }}><Icon name="sparkle" size={18} color="var(--p)" />ลองใช้แบบตัวอย่าง (ไม่ต้องสมัคร)</button>}
      {SHOW_DEMO && ses.mode === 'demo' && <button className={a.demo} onClick={() => void leaveDemo()}><Icon name="user" size={18} />ออกจากโหมดตัวอย่าง</button>}
    </>
  } else if (step === 'up') {
    body = <>
      <h1 className={a.h1}>สร้างบัญชี LUMI</h1><p className={a.sub}>ฟรี ใช้ได้ทั้งซื้อและขายงาน</p>
      <input className={`inp ${a.big}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่แสดง" aria-label="ชื่อที่แสดง" maxLength={40} autoComplete="name" /><div className={a.gap} />
      {emailIn}<div className={a.gap} />
      <Pw value={pw} onChange={setPw} placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)" auto="new-password" />
      <button className={`btn btn-p ${a.bbig}`} style={{ marginTop: 4 }} disabled={busy} {...blockTap(!name.trim() || !okEmail || pw.length < 8, !name.trim() ? 'ใส่ชื่อที่แสดงก่อน' : !okEmail ? 'ใส่อีเมลให้ถูกต้องก่อน' : 'รหัสผ่านอย่างน้อย 8 ตัว')} onClick={() => void signUp()}>{busy ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}</button>
      {srow('หรือสมัครด้วย')}
    </>
    foot = <><p className={a.small} style={{ marginBottom: 10 }}>มีบัญชีแล้ว? <button type="button" className={a.lnk} onClick={() => go('in')}>เข้าสู่ระบบ</button></p>{terms}</>
  } else if (step === 'verify') {
    body = codeBlock('ยืนยันอีเมล', 'ยืนยันและเริ่มใช้', () => void verifySignup(), () => void resendSignup())
  } else if (step === 'login-code') {
    body = <>
      <h1 className={a.h1}>เข้าด้วยรหัสทางอีเมล</h1><p className={a.sub}>ใส่อีเมลที่ใช้สมัคร เราจะส่งรหัส 6 หลักไปให้ ไม่ต้องใช้รหัสผ่าน</p>
      {emailIn}
      <button className={`btn btn-p ${a.bbig}`} style={{ marginTop: 12 }} disabled={busy} {...blockTap(!okEmail, 'ใส่อีเมลให้ถูกต้องก่อน')} onClick={() => void sendLoginCode()}>{busy ? 'กำลังส่ง…' : 'ส่งรหัส'}</button>
      <p className={a.small} style={{ marginTop: 18 }}><button type="button" className={a.lnk} onClick={back}>กลับไปเข้าสู่ระบบ</button></p>
    </>
  } else if (step === 'code') {
    body = codeBlock('ใส่รหัสจากอีเมล', 'เข้าสู่ระบบ', () => void verifyLogin(), () => void sendLoginCode(false))
  } else if (step === 'forgot') {
    body = <>
      <h1 className={a.h1}>ค้นหาบัญชีของคุณ</h1><p className={a.sub}>ใส่อีเมลที่ใช้สมัคร เราจะส่งรหัสไปให้ตั้งรหัสผ่านใหม่</p>
      {emailIn}
      <button className={`btn btn-p ${a.bbig}`} style={{ marginTop: 12 }} disabled={busy} {...blockTap(!okEmail, 'ใส่อีเมลให้ถูกต้องก่อน')} onClick={() => void sendReset()}>{busy ? 'กำลังส่ง…' : 'ส่งรหัส'}</button>
      <p className={a.small} style={{ marginTop: 18 }}><button type="button" className={a.lnk} onClick={back}>กลับไปเข้าสู่ระบบ</button></p>
    </>
  } else {
    body = <>
      <h1 className={a.h1}>ตั้งรหัสผ่านใหม่</h1><p className={a.sub}>ใส่รหัสจากอีเมล แล้วตั้งรหัสผ่านใหม่</p>
      <Otp value={code} onChange={setCode} />
      <Pw value={pw} onChange={setPw} placeholder="รหัสผ่านใหม่" auto="new-password" />
      <Pw value={pw2} onChange={setPw2} placeholder="ยืนยันรหัสผ่านใหม่" auto="new-password" />
      <button className={`btn btn-p ${a.bbig}`} style={{ marginTop: 6 }} disabled={busy} {...blockTap(code.length !== 6 || pw.length < 8 || pw !== pw2, code.length !== 6 ? 'ใส่รหัส 6 หลักจากอีเมลก่อน' : pw.length < 8 ? 'รหัสผ่านอย่างน้อย 8 ตัว' : 'รหัสผ่านสองช่องยังไม่ตรงกัน')} onClick={() => void saveNewPw()}>{busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่าน'}</button>
      {resend(() => void sendReset(false))}
    </>
  }
  return (
    <div className={a.scr} data-auth-step={step}>
      <div className={a.top}><button className="tb-btn" onClick={back} aria-label="ย้อนกลับ"><Icon name="back" size={22} stroke={2.2} /></button></div>
      <div className={a.body}>{body}</div>
      {foot && <div className={a.foot}>{foot}</div>}
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
