import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Empty, Img, SampleNote, Sheet, Toggle, TopBar } from '../../components/ui'
import { LIC_PRESETS, LIC_ROWS, SPECS, arr, checkListing, completion, filesOf, on, str, visible } from '../../data/listingSpec'
import type { Field, ListingDraft, SellType, Spec, SpecValue, Step, UploadedFile } from '../../data/listingSpec'
import { baht } from '../../data/sampleData'
import { draftToProduct, sell } from '../../services/api'
import { getDb, uid, useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { fileToDataUrl } from '../../utils/image'
import { ago } from '../../utils/time'
import { ProductView } from '../product/ProductView'
import { PRICE_OPTS } from '../../data/sellDefaults'
import s from './Sell.module.css'

const STEPS = ['ประเภท', 'ไฟล์', 'รายละเอียด', 'ราคา', 'สิทธิ์', 'ตัวอย่าง']
const ORDER: SellType[] = ['img', 'tpl', 'media', 'sw', 'game', 'bot', 'skill', 'data', 'course', 'font', 'hire']
const FEE = 0.1
type Opt = ListingDraft['options'][number]
const SAMPLE_COVERS: Record<SellType, string[]> = {
  img: ['g_lotus.jpg', 'g_anime.jpg', 'g_island.jpg'], tpl: ['c_template.jpg', 'cafe.jpg', 't_y2k.jpg'], media: ['c_media.jpg', 'g_cyber.jpg'], sw: ['c_software.jpg', 'c_app.jpg'], game: ['c_game.jpg', 'fantasy.jpg'],
  bot: ['c_bot.jpg', 'robot.jpg'], skill: ['c_skill.jpg', 'c_plugin.jpg'], data: ['c_data.jpg', 'c_sme.jpg'], course: ['c_course.jpg', 'g_product.jpg'], font: ['c_creator.jpg', 't_color.jpg'], hire: ['mascot.jpg', 'toys.jpg'],
}
const blank = (): ListingDraft => ({ id: uid('d'), type: null, step: 0, title: '', use: '', desc: '', tags: [], covers: [], spec: {}, free: false, tips: false, options: [], updatedAt: Date.now() })
const sizeOf = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`)

export function Sell() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const draftId = sp.get('draft')
  const [d, setD] = useState<ListingDraft>(() => {
    const ex = draftId ? getDb().drafts.find((x) => x.id === draftId) : undefined
    if (ex) return ex
    const t = sp.get('type') as SellType | null
    const b = blank()
    return t && SPECS[t] ? { ...b, type: t, spec: { ...SPECS[t].defaults }, options: PRICE_OPTS[t].map((x) => ({ ...x })), step: 1 } : b
  })
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [share, setShare] = useState(true)
  const [notify, setNotify] = useState(true)
  const [done, setDone] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [dir, setDir] = useState(1)
  const published = useRef(false)
  const topRef = useRef<HTMLDivElement>(null)
  const checks = useMemo(() => checkListing(d), [d])
  const pct = completion(d)
  const missing = checks.filter((c) => !c.ok)
  const t = d.type ? SPECS[d.type] : undefined

  // autosave (debounced) — only once a type is chosen
  useEffect(() => {
    if (!d.type || published.current) return
    setSaved('saving')
    const h = setTimeout(() => { if (published.current) return; sell.saveDraft(d).then(() => setSaved('saved')); if (!draftId) setSp({ draft: d.id }, { replace: true }) }, 600)
    return () => clearTimeout(h)
  }, [d]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((p: Partial<ListingDraft>) => setD((x) => ({ ...x, ...p })), [])
  const setSpec = useCallback((id: string, v: SpecValue | ((old: SpecValue | undefined) => SpecValue)) =>
    setD((x) => ({ ...x, spec: { ...x.spec, [id]: typeof v === 'function' ? v(x.spec[id]) : v } })), [])
  const go = (n: number) => {
    setDir(n > d.step ? 1 : -1)
    patch({ step: n })
    const el = topRef.current?.closest('.lsc') as HTMLElement | null
    el?.scrollTo({ top: 0 })
  }
  const pickType = (k: SellType) => {
    if (d.type === k) return go(1)
    setD((x) => ({ ...x, type: k, spec: { ...SPECS[k].defaults }, options: PRICE_OPTS[k].map((y) => ({ ...y })), step: 1 }))
    setDir(1)
  }
  const publish = async () => {
    if (missing.length) { setCheckOpen(true); return }
    setBusy(true)
    try {
      published.current = true
      const id = await sell.publish({ ...d, publishedId: d.publishedId ?? `u-${d.id}` }, share, notify)
      setDone(id)
    } catch { published.current = false; setCheckOpen(true) } finally { setBusy(false) }
  }

  if (done) return <Success id={done} d={d} share={share} notify={notify} />

  const stepMissing = (n: number) => checks.filter((c) => !c.ok && c.step === n).length
  const close = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/profile?mode=creator'))
  const head = (
    <div className={s.head} ref={topRef}>
      <div className={s.hrow}>
        <button className="tb-btn" onClick={close} aria-label="ปิด"><Icon name="x" size={22} /></button>
        <div className={s.ht}><b>{t ? `ลงขาย · ${t.name}` : 'ลงขายผลงาน'}</b><small className={saved === 'saved' ? s.ok : ''}>{saved === 'saving' ? 'กำลังบันทึก…' : saved === 'saved' ? 'บันทึกร่างแล้ว ✓' : 'บันทึกอัตโนมัติ'}</small></div>
        <Link to="/sell/drafts" className="btn btn-xs btn-s">ร่าง</Link>
      </div>
      <div className={s.prog}>{STEPS.map((x, i) => <button key={x} className={`${i <= d.step ? s.pd : ''}`} disabled={!d.type && i > 0} onClick={() => d.type && go(i)} aria-label={`ขั้น ${x}`} />)}</div>
      <div className={s.stl}><span>ขั้นที่ <b>{d.step + 1}</b> จาก 6 · {STEPS[d.step]}</span>{d.type && <button className={s.pctB} onClick={() => setCheckOpen(true)}><span className={s.pbar}><i style={{ transform: `scaleX(${pct / 100})` }} /></span>{pct}% พร้อมลงขาย</button>}</div>
    </div>
  )

  return (
    <div className={`page has-bar ${s.page}`}>
      {head}
      <div key={d.step} className={`narrow ${s.body} ${dir > 0 ? s.inR : s.inL}`}>
        {d.step === 0 && <StepType d={d} pick={pickType} />}
        {d.step === 1 && t && <>
          <H t={d.type === 'hire' ? 'ผลงานตัวอย่างและสิ่งที่ส่ง' : 'อัปโหลดผลงาน'} s="รูปหน้าปก ไฟล์ที่ผู้ซื้อได้รับ และข้อมูลไฟล์" />
          <Covers d={d} patch={patch} />
          <Fields fs={t.fields} step="files" spec={d.spec} set={setSpec} />
        </>}
        {d.step === 2 && t && <>
          <H t="บอกผู้ซื้อให้ชัด" s="ชื่อ ประโยคบอกว่าเหมาะกับใคร และรายละเอียด" />
          <div className="field"><label className="flabel">ชื่อผลงาน<span className="req">*</span></label><input className="inp" value={d.title} maxLength={70} onChange={(e) => patch({ title: e.target.value })} placeholder="เช่น ภาพตลาดกลางคืนแห่งแสงโคม" /><span className="hint">{d.title.length}/70</span></div>
          <div className="field"><label className="flabel">เหมาะกับใคร / ใช้ทำอะไร<span className="req">*</span></label><input className="inp" value={d.use} onChange={(e) => patch({ use: e.target.value })} placeholder="เช่น ทำปกเพจ โปสเตอร์ หรือวอลเปเปอร์" /></div>
          <div className="field"><label className="flabel">รายละเอียด<span className="req">*</span></label><textarea className="ta" rows={5} value={d.desc} onChange={(e) => patch({ desc: e.target.value })} placeholder="เล่าให้ผู้ซื้อเห็นภาพ ได้อะไร ใช้ยังไง" /></div>
          <Tags d={d} patch={patch} />
          <Fields fs={t.fields} step="details" spec={d.spec} set={setSpec} />
        </>}
        {d.step === 3 && t && <StepPrice d={d} patch={patch} set={setSpec} />}
        {d.step === 4 && t && <>
          <H t="สิทธิ์การใช้งาน" s="ผู้ซื้อทำอะไรได้บ้าง ตารางนี้จะโชว์บนหน้าสินค้า" />
          <Fields fs={t.fields} step="license" spec={d.spec} set={(id, v) => {
            setSpec(id, v)
            if (id === 'licPreset' && typeof v === 'string' && LIC_PRESETS[v]?.length) setSpec('licAllowed', LIC_PRESETS[v])
          }} />
          {arr(d.spec.licAllowed).length > 0 && (
            <div className={s.lict}>{LIC_ROWS.map((r) => { const ok = arr(d.spec.licAllowed).includes(r); return <div key={r}><span>{r}</span>{ok ? <b className={s.y}>ได้ ✓</b> : <b className={s.n}>ไม่ได้</b>}</div> })}</div>
          )}
        </>}
        {d.step === 5 && t && <>
          <div className={s.prvb}><Icon name="eye" size={15} color="#fff" stroke={2} />ผู้ซื้อจะเห็นหน้านี้<span>กด “แก้ไข” เพื่อกลับไปแก้</span></div>
          <CheckList checks={checks} go={go} compact />
          <div className={s.prvWrap}><ProductView p={draftToProduct(d)} preview /></div>
          <div className={s.bx}>
            <Row icon="share" c="#6C2BD9" bg="#F3ECFF" t="แชร์ลงชุมชน LUMI" sub="โพสต์พร้อมลิงก์สินค้า" on={share} set={setShare} />
            <Row icon="megaphone" c="#D6336C" bg="#FDEBF2" t="แจ้งผู้ติดตาม 1.2K คน" sub="ทดลอง · ยังไม่ส่งจริง" on={notify} set={setNotify} />
          </div>
          <SampleNote>ลงขายในโหมดทดลอง ผลงานเก็บในเครื่องนี้ ยังไม่มีผู้ซื้อจริง</SampleNote>
        </>}
      </div>
      <div className="bottom-bar">
        {d.step > 0 ? <button className="btn btn-o" onClick={() => go(d.step - 1)}>{d.step === 5 ? 'แก้ไข' : 'ย้อนกลับ'}</button> : <span />}
        {d.step < 5
          ? <button className="btn btn-p" style={{ flex: 1 }} disabled={!d.type} onClick={() => go(d.step + 1)}>ถัดไป · {STEPS[d.step + 1]}{d.step > 0 && stepMissing(d.step) > 0 && <span className={s.miss}>ขาด {stepMissing(d.step)}</span>}</button>
          : <button className="btn btn-p" style={{ flex: 1 }} disabled={busy} onClick={publish}>{busy ? 'กำลังลงขาย…' : missing.length ? `ยังขาด ${missing.length} อย่าง` : 'ลงขายเลย'}</button>}
      </div>
      <Sheet open={checkOpen} onClose={() => setCheckOpen(false)} title={missing.length ? `ตรวจอัตโนมัติ · ยังขาด ${missing.length} อย่าง` : 'ตรวจอัตโนมัติ · พร้อมลงขาย ✓'} sub={t ? `สิ่งที่ “${t.name}” ต้องมีก่อนลงขาย` : undefined} tall>
        <CheckList checks={checks} go={(n) => { setCheckOpen(false); setTimeout(() => go(n), 200) }} />
      </Sheet>
    </div>
  )
}

function H({ t, s: sub }: { t: string; s: string }) {
  return <div className={s.h}><h1>{t}</h1><p>{sub}</p></div>
}

function StepType({ d, pick }: { d: ListingDraft; pick: (k: SellType) => void }) {
  const db = useDb()
  const other = db.drafts.filter((x) => x.id !== d.id)
  return <>
    {other.length > 0 && (
      <Link to="/sell/drafts" className={`${s.drb} press`}><Img src={other[0].covers[0] ?? 'g_lotus.jpg'} className={s.drbI} /><span className="grow"><b>ร่างค้างไว้ {other.length} ชิ้น</b><small className="ell">{other[0].title || 'ยังไม่ตั้งชื่อ'} · แก้ล่าสุด{ago(other[0].updatedAt)}</small></span><span className={s.go}>ทำต่อ ›</span></Link>
    )}
    <H t="จะลงขายอะไรดี?" s="เลือกประเภท แล้ว LUMI จะถามเฉพาะสิ่งที่จำเป็น" />
    <div className={s.tyg}>
      {ORDER.map((k, i) => { const x = SPECS[k]; return (
        <button key={k} className={`${s.ty} ${d.type === k ? s.on : ''} press rise`} style={{ '--i': i } as React.CSSProperties} onClick={() => pick(k)}>
          <span className={s.tyi} style={{ background: x.bg }}><Icon name={x.icon} size={22} color={x.color} /></span>
          <b>{x.name}</b><small>{x.sub}</small>
          {['media', 'skill', 'data'].includes(k) && <em className={s.nw}>ใหม่</em>}
        </button>
      ) })}
    </div>
    <div className={s.bx} style={{ marginTop: 12 }}><div className={s.row}><span className={s.ri} style={{ background: '#E5F8EC' }}><Icon name="gift" size={18} color="#16A34A" /></span><span className="grow"><b>อยากแจกฟรี?</b><small>เปิดได้ในขั้นราคา ทุกประเภท</small></span></div></div>
  </>
}

function Covers({ d, patch }: { d: ListingDraft; patch: (p: Partial<ListingDraft>) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const add = async (fs: FileList | null) => {
    if (!fs) return
    const out: string[] = []
    for (const f of Array.from(fs).slice(0, 6 - d.covers.length)) if (f.type.startsWith('image/')) out.push(await fileToDataUrl(f, 900))
    patch({ covers: [...d.covers, ...out] })
  }
  const samples = SAMPLE_COVERS[d.type ?? 'img'].filter((x) => !d.covers.includes(x))
  return (
    <div className="field">
      <label className="flabel">{d.type === 'hire' ? 'รูปผลงานตัวอย่าง' : 'รูปหน้าปก'}<span className="req">*</span><small className={s.fsub}>อย่างน้อย 1 รูป · รูปแรกคือปก</small></label>
      <div className={s.upg}>
        {d.covers.map((c, i) => (
          <div key={c.slice(-40) + i} className={`${s.cv} pop-in`}>
            <Img src={c} />
            {i === 0 && <em>ปก</em>}
            <button onClick={() => patch({ covers: d.covers.filter((_, k) => k !== i) })} aria-label="ลบรูป"><Icon name="x" size={13} color="#fff" /></button>
          </div>
        ))}
        {d.covers.length < 6 && <button className={`${s.add} press`} onClick={() => ref.current?.click()}><Icon name="plus" size={22} />เพิ่มรูป</button>}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      {samples.length > 0 && d.covers.length < 6 && <div className={s.smp}><small>หรือใช้รูปตัวอย่าง:</small>{samples.map((x) => <button key={x} onClick={() => patch({ covers: [...d.covers, x] })} className="press"><Img src={x} /></button>)}</div>}
    </div>
  )
}

function Tags({ d, patch }: { d: ListingDraft; patch: (p: Partial<ListingDraft>) => void }) {
  const [v, setV] = useState('')
  const add = () => { const x = v.trim().replace(/^#/, ''); if (x && !d.tags.includes(x) && d.tags.length < 8) patch({ tags: [...d.tags, x] }); setV('') }
  return (
    <div className="field">
      <label className="flabel">แท็ก<small className={s.fsub}>ช่วยให้ค้นเจอ · สูงสุด 8</small></label>
      <div className={s.tagw}>
        {d.tags.map((x) => <span key={x} className={`${s.tg} pop-in`}>#{x}<button onClick={() => patch({ tags: d.tags.filter((y) => y !== x) })} aria-label={`ลบ ${x}`}><Icon name="x" size={12} /></button></span>)}
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent.isComposing) { e.preventDefault(); add() } }} onBlur={add} placeholder={d.tags.length ? 'เพิ่มแท็ก' : 'พิมพ์แล้วกด Enter'} aria-label="เพิ่มแท็ก" />
      </div>
    </div>
  )
}

function StepPrice({ d, patch, set }: { d: ListingDraft; patch: (p: Partial<ListingDraft>) => void; set: SetSpec }) {
  const t = SPECS[d.type!]
  const opts = d.options
  const live = opts.filter((x) => x.on && x.price > 0)
  const top = live.length ? Math.max(...live.map((x) => x.price)) : 0
  const upd = (id: string, p: Partial<Opt>) => patch({ options: opts.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  return <>
    <H t="ตั้งราคาและแบบที่ขาย" s="เปิดเฉพาะแบบที่อยากขาย ผู้ซื้อเลือกเองบนหน้าสินค้า" />
    <div className={`${s.bx} ${d.free ? s.freeOn : ''}`}>
      <Row icon="gift" c="#16A34A" bg="#E5F8EC" t="แจกฟรี" sub="ผู้ใช้กดรับได้เลย ยังต้องกรอกข้อมูลให้ครบเหมือนของขาย" on={d.free} set={(v) => patch({ free: v })} />
      {d.free && <Row icon="coin" c="#B45309" bg="#FFF4DB" t="เปิดรับทิป" sub="ผู้ใช้ให้ทิปได้ตามใจ" on={d.tips} set={(v) => patch({ tips: v })} />}
    </div>
    {!d.free && <>
      <label className="flabel" style={{ marginTop: 16 }}>แบบที่ขาย<small className={s.fsub}>เปิดได้หลายแบบ</small></label>
      {opts.map((x) => (
        <div key={x.id} className={`${s.op} ${x.on ? s.opOn : ''}`}>
          <div className={s.opH}><span className="grow"><b>{x.label}</b><small>{x.sub}</small></span><Toggle on={x.on} onChange={(v) => upd(x.id, { on: v })} label={x.label} /></div>
          {x.on && <div className={s.opP}><span>฿</span><input inputMode="numeric" value={x.price || ''} onChange={(e) => upd(x.id, { price: Math.min(999999, parseInt(e.target.value.replace(/\D/g, '')) || 0) })} aria-label={`ราคา ${x.label}`} placeholder="0" />{x.suffix && <em>{x.suffix}</em>}</div>}
        </div>
      ))}
      {top > 0 && <div className={s.earn}><div><small>ราคาสูงสุด</small><b>{baht(top)}</b></div><div><small>ค่าธรรมเนียม LUMI 10%</small><b>−{baht(Math.round(top * FEE))}</b></div><div><small>คุณได้รับ</small><b className={s.y}>{baht(top - Math.round(top * FEE))}</b></div></div>}
    </>}
    <Fields fs={t.fields} step="price" spec={d.spec} set={set} />
  </>
}

type SetSpec = (id: string, v: SpecValue | ((old: SpecValue | undefined) => SpecValue)) => void

function Fields({ fs, step, spec, set }: { fs: Field[]; step: Step; spec: Spec; set: SetSpec }) {
  return <>{fs.filter((f) => f.step === step && visible(f, spec)).map((f) => <FieldView key={f.id} f={f} v={spec[f.id]} spec={spec} set={set} />)}</>
}

function FieldView({ f, v, spec, set }: { f: Field; v: SpecValue | undefined; spec: Spec; set: SetSpec }) {
  const req = typeof f.required === 'function' ? f.required(spec) : !!f.required
  const label = <label className="flabel">{f.label}{(req || f.mustBeOn) && <span className="req">*</span>}</label>
  if (f.kind === 'toggle') return (
    <div className={`${s.tgl} ${f.mustBeOn && !on(v) ? s.must : ''}`}>
      <span className="grow"><b>{f.label}{f.mustBeOn && <span className="req">*</span>}</b>{f.hint && <small>{f.hint}</small>}</span>
      <Toggle on={on(v)} onChange={(x) => set(f.id, x)} label={f.label} />
    </div>
  )
  return (
    <div className="field">
      {label}
      {f.kind === 'text' && <input className="inp" value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.id, e.target.value)} placeholder={f.placeholder} />}
      {f.kind === 'textarea' && <textarea className="ta" rows={4} value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.id, e.target.value)} placeholder={f.placeholder} />}
      {f.kind === 'chips' && <div className="chips" style={{ flexWrap: 'wrap' }}>{f.options!.map((x) => <button key={x} className={`chip ${str(v) === x ? 'on' : ''}`} onClick={() => set(f.id, x)}>{x}</button>)}</div>}
      {f.kind === 'multi' && <div className="chips" style={{ flexWrap: 'wrap' }}>{f.options!.map((x) => { const sel = arr(v).includes(x); return <button key={x} className={`chip ${sel ? 'on' : ''}`} onClick={() => set(f.id, (old) => (sel ? arr(old).filter((y) => y !== x) : [...arr(old), x]))}>{sel && '✓ '}{x}</button> })}</div>}
      {f.kind === 'list' && <ListEdit f={f} v={v} set={set} />}
      {f.kind === 'files' && <FilesEdit f={f} v={v} set={set} />}
      {f.hint && f.kind !== 'files' && <span className="hint">{f.hint}</span>}
    </div>
  )
}

function ListEdit({ f, v, set }: { f: Field; v: SpecValue | undefined; set: SetSpec }) {
  const items = Array.isArray(v) ? v : []
  const [n, setN] = useState('')
  const add = () => { const x = n.trim(); if (x) set(f.id, (old) => [...(Array.isArray(old) ? old : []), x]); setN('') }
  return (
    <div className={s.list}>
      {items.map((x, i) => (
        <div key={i} className={`${s.li} rise`}>
          <i>{i + 1}</i>
          <input value={x} onChange={(e) => set(f.id, (old) => (Array.isArray(old) ? old.map((y, k) => (k === i ? e.target.value : y)) : []))} aria-label={`${f.label} ${i + 1}`} />
          <button onClick={() => set(f.id, (old) => (Array.isArray(old) ? old.filter((_, k) => k !== i) : []))} aria-label="ลบ"><Icon name="trash" size={15} /></button>
        </div>
      ))}
      <div className={s.li}><i>+</i><input value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add() } }} placeholder={f.placeholder ?? 'เพิ่มรายการ'} aria-label={`เพิ่ม ${f.label}`} /><button className={s.liAdd} onClick={add} disabled={!n.trim()}>เพิ่ม</button></div>
      {(f.min ?? 1) > 1 && <span className="hint">อย่างน้อย {f.min} รายการ</span>}
    </div>
  )
}

function FilesEdit({ f, v, set }: { f: Field; v: SpecValue | undefined; set: SetSpec }) {
  const ref = useRef<HTMLInputElement>(null)
  const files = filesOf(v)
  const write = (fn: (xs: UploadedFile[]) => UploadedFile[]) => set(f.id, (old) => fn(filesOf(old)).map((x) => JSON.stringify(x)))
  const add = (fl: FileList | null) => {
    if (!fl) return
    for (const file of Array.from(fl)) {
      const name = file.name
      write((xs) => [...xs.filter((x) => x.name !== name), { name, size: sizeOf(file.size), scan: 'scan', pct: 0 }])
      let p = 0
      const h = setInterval(() => {
        p = Math.min(100, p + 18 + Math.random() * 22)
        const bad = /eicar|virus|malware/i.test(name)
        write((xs) => xs.map((x) => (x.name === name ? (p >= 100 ? { ...x, pct: 100, scan: bad ? 'fail' : 'ok' } : { ...x, pct: Math.round(p) }) : x)))
        if (p >= 100) { clearInterval(h); toast(bad ? `“${name}” ไม่ผ่านการสแกน ลงขายไม่ได้` : `สแกน “${name}” แล้ว ปลอดภัย`) }
      }, 260)
    }
  }
  return (
    <div className={s.files}>
      {files.map((x) => (
        <div key={x.name} className={`${s.fi} ${x.scan === 'fail' ? s.fail : ''} rise`}>
          <span className={s.fic}><Icon name="file" size={18} /></span>
          <span className="grow"><b className="ell">{x.name}</b>
            <small>{x.size}{x.size && ' · '}{x.scan === 'scan' ? `กำลังสแกนไวรัส ${x.pct ?? 0}%` : x.scan === 'ok' ? 'สแกนแล้ว ปลอดภัย ✓' : 'พบความเสี่ยง · ลบแล้วอัปใหม่'}</small>
            {x.scan === 'scan' && <span className={s.fbar}><i style={{ transform: `scaleX(${(x.pct ?? 0) / 100})` }} /></span>}
          </span>
          <button onClick={() => write((xs) => xs.filter((y) => y.name !== x.name))} aria-label={`ลบ ${x.name}`}><Icon name="trash" size={16} /></button>
        </div>
      ))}
      <button className={`${s.drop} press`} onClick={() => ref.current?.click()}><Icon name="upload" size={22} color="var(--p)" /><b>เลือกไฟล์จากเครื่อง</b><small>{f.hint}</small></button>
      <input ref={ref} type="file" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      <span className="hint"><Icon name="shield" size={12} /> ทดลอง: ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์ ระบบจำลองการสแกน (ชื่อไฟล์มีคำว่า virus จะไม่ผ่าน)</span>
    </div>
  )
}

function Row({ icon, c, bg, t, sub, on: v, set }: { icon: string; c: string; bg: string; t: string; sub: string; on: boolean; set: (v: boolean) => void }) {
  return <div className={s.row}><span className={s.ri} style={{ background: bg }}><Icon name={icon} size={18} color={c} /></span><span className="grow"><b>{t}</b><small>{sub}</small></span><Toggle on={v} onChange={set} label={t} /></div>
}

function CheckList({ checks, go, compact }: { checks: ReturnType<typeof checkListing>; go: (n: number) => void; compact?: boolean }) {
  const miss = checks.filter((c) => !c.ok)
  const list = compact ? miss : checks
  if (compact && !miss.length) return <div className={s.allOk}><span className="ok-ic"><Icon name="check" size={14} stroke={3} /></span>ตรวจอัตโนมัติผ่านครบ {checks.length} ข้อ พร้อมลงขาย</div>
  return (
    <div className={compact ? s.ckC : s.ck}>
      {compact && <b className={s.ckH}>ยังขาด {miss.length} อย่างก่อนลงขาย</b>}
      {list.map((c) => (
        <button key={c.id} className={`${s.ci} ${c.ok ? s.ciOk : ''}`} onClick={() => !c.ok && go(c.step)}>
          <span className={c.ok ? 'ok-ic' : s.xic}>{c.ok ? <Icon name="check" size={13} stroke={3} /> : '!'}</span>
          <span className="grow">{c.label}{c.note && !c.ok && <small>{c.note}</small>}</span>
          {!c.ok && <span className={s.fix}>ขั้น {STEPS[c.step]} ›</span>}
        </button>
      ))}
    </div>
  )
}

function Success({ id, d, share, notify }: { id: string; d: ListingDraft; share: boolean; notify: boolean }) {
  const nav = useNavigate()
  const p = draftToProduct(d, id)
  const opts = p.options ?? []
  return (
    <div className={`page has-bar ${s.page}`}>
      <TopBar title="" back={false} right={<button className="tb-btn" onClick={() => nav('/profile?mode=creator', { replace: true })} aria-label="ปิด"><Icon name="x" size={22} /></button>} />
      <div className={`narrow ${s.okp}`}>
        <div className={`${s.okBg} pop-in`}><Icon name="check" size={48} color="#fff" stroke={3} /></div>
        <h2 className="rise">ลงขายแล้ว!</h2>
        <p className="rise" style={{ '--i': 1 } as React.CSSProperties}>ผลงานของคุณขึ้นหน้าร้าน ฟีด และหน้าค้นหาแล้ว</p>
        <Link to={`/product/${id}`} className={`${s.mini} rise press`} style={{ '--i': 2 } as React.CSSProperties}><Img src={p.covers?.[0] ?? p.image?.src} className={s.drbI} /><span className="grow"><b className="ell">{p.title}</b><small>{p.price === 0 ? 'แจกฟรี' : `${opts.length} แบบ · เริ่ม ${baht(p.price)}`}</small></span><Icon name="chev" size={18} /></Link>
        <div className={`${s.bx} rise`} style={{ '--i': 3, textAlign: 'left' } as React.CSSProperties}>
          <div className={s.row}><span className={s.ri} style={{ background: '#F3ECFF' }}><Icon name="share" size={18} color="#6C2BD9" /></span><span className="grow"><b>แชร์ลงชุมชน LUMI</b><small>{share ? 'โพสต์แล้ว พร้อมลิงก์สินค้า' : 'ไม่ได้แชร์'}</small></span>{share && <span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>}</div>
          <div className={s.row}><span className={s.ri} style={{ background: '#FDEBF2' }}><Icon name="megaphone" size={18} color="#D6336C" /></span><span className="grow"><b>แจ้งผู้ติดตาม 1.2K คน</b><small>{notify ? 'จำลองการแจ้งแล้ว (ทดลอง)' : 'ไม่ได้แจ้ง'}</small></span>{notify && <span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>}</div>
        </div>
        <SampleNote>โหมดทดลอง · เก็บในเครื่องนี้เท่านั้น</SampleNote>
      </div>
      <div className="bottom-bar">
        <button className="btn btn-o" onClick={() => nav(`/product/${id}`, { replace: true })}>ดูหน้าสินค้า</button>
        <button className="btn btn-p" style={{ flex: 1 }} onClick={() => nav('/sell', { replace: true })}>ลงขายชิ้นต่อไป</button>
      </div>
    </div>
  )
}

export function Drafts() {
  const db = useDb()
  const nav = useNavigate()
  const [del, setDel] = useState<string>()
  return (
    <div className="page has-bar">
      <TopBar title="ร่างของฉัน" sub="บันทึกอัตโนมัติทุกครั้งที่แก้" />
      <div className="narrow" style={{ padding: '8px 16px' }}>
        {db.drafts.length === 0 && <Empty icon="edit" title="ยังไม่มีร่าง" text="เริ่มลงขายชิ้นแรก ระบบจะบันทึกให้อัตโนมัติ" />}
        {db.drafts.map((x, i) => { const p = completion(x); const t = x.type ? SPECS[x.type] : undefined; return (
          <div key={x.id} className={`${s.dr} rise`} style={{ '--i': i } as React.CSSProperties}>
            <button className={s.drL} onClick={() => nav(`/sell?draft=${x.id}`)}>
              <Img src={x.covers[0] ?? 'g_lotus.jpg'} className={s.drbI} />
              <span className="grow"><b className="ell">{x.title || 'ยังไม่ตั้งชื่อ'}</b><small>{t?.name ?? '—'} · ค้างที่ขั้น{STEPS[x.step]} · {ago(x.updatedAt)}</small><span className={s.pbar}><i style={{ transform: `scaleX(${p / 100})` }} /></span></span>
              <b className={s.pctN}>{p}%</b>
            </button>
            <button className={s.drX} onClick={() => setDel(x.id)} aria-label="ลบร่าง"><Icon name="trash" size={16} /></button>
          </div>
        ) })}
        <div style={{ marginTop: 12 }}><SampleNote>ร่างเก็บในเครื่องนี้ (ตัวอย่าง)</SampleNote></div>
      </div>
      <div className="bottom-bar"><button className="btn btn-p btn-block" onClick={() => nav('/sell')}>ลงขายชิ้นใหม่</button></div>
      <Sheet open={!!del} onClose={() => setDel(undefined)} title="ลบร่างนี้?" sub="ลบแล้วกู้คืนไม่ได้">
        <button className="btn btn-d btn-block" onClick={() => { sell.deleteDraft(del!); setDel(undefined); toast('ลบร่างแล้ว') }}>ลบร่าง</button>
        <button className="btn btn-s btn-block" style={{ marginTop: 8 }} onClick={() => setDel(undefined)}>ยกเลิก</button>
      </Sheet>
    </div>
  )
}
