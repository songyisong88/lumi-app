import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Empty, Img, SampleNote, Sheet, Toggle, TopBar, blockTap } from '../../components/ui'
import { newSpec, licRows, presetRows, MAX_FILES, SPECS, uploadRule, fmtMB, arr, checkListing, completion, filesOf, on, str, visible, sellTypeOf, specOf, SELL_TYPE_ORDER, isReq, filled } from '../../data/listingSpec'
import type { Field, ListingDraft, SellType, Spec, SpecValue, Step, UploadedFile } from '../../data/listingSpec'
import { baht, ME, productById } from '../../data/sampleData'
import { creatorStats, heroOf, optionsOf } from '../../data/productExtras'
import { contentSig, draftToProduct, sell } from '../../services/api'
import type { Product } from '../../data/types'
import { getDb, uid, useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { fileToDataUrl } from '../../utils/image'
import { ago } from '../../utils/time'
import { ProductView } from '../product/ProductView'
import { PRICE_OPTS } from '../../data/sellDefaults'
import { CATEGORIES, childrenOf } from '../../data/searchData'
import { FEATURES, REAL } from '../../config'
import { useModStatus } from '../../components/ModStatus'
import { cloudOn, removeDeliverable, uploadDeliverable } from '../../services/cloud'
import s from './Sell.module.css'

/** d.step keeps the old 0–5 meaning (0 type · 1 files · 2 details · 3 price · 4 license · 5 preview) so drafts, edit links
 *  (?edit=…&step=n) and the server row stay compatible. The screen shows it as 2 stages (study 4): 1 ข้อมูลหลัก (steps 0–4 on one
 *  page) and 2 ดูตัวอย่าง (step 5). */

const STAGES = ['ข้อมูลหลัก', 'ดูตัวอย่าง']
const stageOf = (step: number) => (step >= 5 ? 1 : 0)
/** Fields shown on the main form: required ones the type's defaults leave empty. Everything else (optional, or required but
 *  pre-filled by a sensible default) sits under “เพิ่มรายละเอียด (ไม่บังคับ)”, which opens by itself if one of them goes missing. */
function mainIdsOf(t: SellType): Set<string> {
  const def = newSpec(t)
  return new Set(SPECS[t].fields.filter((f) => isReq(f, def) && !filled(f, def[f.id])).map((f) => f.id))
}
/** launch: the “data” type is closed (server: TYPE_CLOSED) */
const ORDER = FEATURES.launch ? SELL_TYPE_ORDER.filter((t) => t !== 'data') : SELL_TYPE_ORDER
const FEE = 0.1
type Opt = ListingDraft['options'][number]
const SAMPLE_COVERS: Record<SellType, string[]> = {
  img: ['g_lotus.jpg', 'g_anime.jpg', 'g_island.jpg'], tpl: ['c_template.jpg', 'cafe.jpg', 't_y2k.jpg'], media: ['c_media.jpg', 'g_cyber.jpg'], sw: ['c_software.jpg', 'c_app.jpg'], game: ['c_game.jpg', 'fantasy.jpg'],
  bot: ['c_bot.jpg', 'robot.jpg'], skill: ['c_skill.jpg', 'c_plugin.jpg'], data: ['c_data.jpg', 'c_sme.jpg'], course: ['c_course.jpg', 'g_product.jpg'], font: ['c_creator.jpg', 't_color.jpg'], hire: ['mascot.jpg', 'toys.jpg'],
}
const blank = (): ListingDraft => ({ id: uid('d'), type: null, step: 0, title: '', use: '', desc: '', tags: [], covers: [], spec: {}, free: false, tips: false, options: [], updatedAt: Date.now() })
/** Open a published listing in the wizard again (edit price, switch free ⇄ paid, fix details). Reuses an open edit draft if there is one. */
function editDraft(productId: string, step: number): ListingDraft | undefined {
  const ex = getDb().drafts.find((x) => x.publishedId === productId)
  if (ex) return { ...ex, step }
  const live0 = productById(productId)
  if (!live0 || live0.creatorId !== ME) return undefined
  // an edit already waiting for review continues from that version; it must be reviewed again
  const p = live0.rev?.next ?? live0
  const dr = draftOf(p, step)
  return { ...dr, origSig: live0.rev ? undefined : contentSig(dr) }
}
/** Step-6 preview. Editing a live listing keeps its real rating and sales, not “ใหม่”. */
function previewOf(d: ListingDraft): Product {
  const was = d.publishedId ? productById(d.publishedId) : undefined
  const p = draftToProduct(d)
  return was ? { ...was, ...p, mine: was.mine, rating: was.rating, mod: undefined, rev: undefined } : p
}
function draftOf(p: Product, step: number): ListingDraft {
  const covers = p.covers?.length ? p.covers : [heroOf(p)]
  if (p.listing) return { ...p.listing, free: p.listing.free && p.listing.type !== 'hire', covers, id: uid('d'), publishedId: p.id, step, updatedAt: Date.now() }
  const t = sellTypeOf(p)
  const live = p.price > 0 ? optionsOf(p).map((o) => ({ id: o.id, label: o.label, sub: o.sub, price: o.price, on: true, suffix: o.suffix })) : []
  return { ...blank(), type: t, step, title: p.title, use: p.use, desc: p.desc ?? `${p.title} · ${p.use}`, tags: p.tags ?? [], covers, spec: { ...specOf(p) }, free: p.price === 0 && t !== 'hire', tips: p.price === 0 && t !== 'hire', options: live.length ? live : PRICE_OPTS[t].map((x) => ({ ...x })), publishedId: p.id }
}
const sizeOf = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`)

const PAYOUT_ACK = 'lumi_payout_ack'

export function Sell() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const draftId = sp.get('draft')
  const [d, setD] = useState<ListingDraft>(() => {
    const ex = draftId ? getDb().drafts.find((x) => x.id === draftId) : undefined
    if (ex) return ex
    const ed = sp.get('edit') ? editDraft(sp.get('edit')!, Number(sp.get('step') ?? 1) || 1) : undefined
    if (ed) return ed
    const t = sp.get('type') as SellType | null
    const b = blank()
    return t && SPECS[t] && ORDER.includes(t) ? { ...b, type: t, spec: newSpec(t), options: PRICE_OPTS[t].map((x) => ({ ...x })), step: 1 } : b
  })
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  // same /sell screen re-targeted (deep link, “ทำต่อ” on another draft, back/forward): load what the URL asks for
  useEffect(() => {
    const dId = sp.get('draft'); const ty = sp.get('type') as SellType | null; const eId = sp.get('edit')
    if (eId && eId !== d.publishedId) {
      const ed = editDraft(eId, Number(sp.get('step') ?? 1) || 1)
      if (ed) { published.current = false; setDone(undefined); setD(ed) }
    } else if (dId && dId !== d.id) {
      const ex = getDb().drafts.find((x) => x.id === dId)
      if (ex) { published.current = false; setDone(undefined); setD(ex) }
    } else if (!dId && ty && SPECS[ty] && ORDER.includes(ty) && ty !== d.type) {
      published.current = false; setDone(undefined)
      setD({ ...blank(), type: ty, spec: newSpec(ty), options: PRICE_OPTS[ty].map((x) => ({ ...x })), step: 1 })
    }
  }, [sp]) // eslint-disable-line react-hooks/exhaustive-deps

  const [share, setShare] = useState(() => !sp.get('edit'))
  const [notify, setNotify] = useState(() => !sp.get('edit'))
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
  const stage = stageOf(d.step)
  const editing = !!d.publishedId && !!productById(d.publishedId)
  const mainIds = useMemo(() => (d.type ? mainIdsOf(d.type) : new Set<string>()), [d.type])
  const inMain = (f: Field) => mainIds.has(f.id)
  const inMore = (f: Field) => !mainIds.has(f.id)
  const moreMissing = t ? checks.filter((c) => !c.ok && t.fields.some((f) => f.id === c.id && !mainIds.has(f.id))).length : 0
  const [more, setMore] = useState(false)
  const moreOpen = more || moreMissing > 0
  const lastForm = useRef(1)

  // autosave (debounced) — only once the seller has actually entered something, so just
  // opening /sell or tapping a type never leaves empty drafts behind
  useEffect(() => {
    if (!d.type || published.current) return
    const exists = getDb().drafts.some((x) => x.id === d.id)
    const touched = !!(d.title.trim() || d.use.trim() || d.desc.trim() || d.tags.length || d.covers.length || d.step >= 2
      || JSON.stringify(d.spec) !== JSON.stringify(newSpec(d.type)))
    if (!exists && !touched && !d.publishedId) { setSaved('idle'); return }
    setSaved('saving')
    const h = setTimeout(() => { if (published.current) return; sell.saveDraft(d).then(() => setSaved('saved')); if (!draftId && /^#\/sell(\?|$)/.test(window.location.hash)) setSp({ draft: d.id }, { replace: true }) }, 600) // never pull the user back if they already left /sell
    return () => clearTimeout(h)
  }, [d]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((p: Partial<ListingDraft>) => setD((x) => ({ ...x, ...p })), [])
  const setSpec = useCallback((id: string, v: SpecValue | ((old: SpecValue | undefined) => SpecValue)) =>
    setD((x) => ({ ...x, spec: { ...x.spec, [id]: typeof v === 'function' ? v(x.spec[id]) : v } })), [])
  const scroller = () => topRef.current?.closest('.lsc') as HTMLElement | null
  /** Scroll the form to a section ([data-sec]) or a field (#f-<id>), below the sticky header. */
  const scrollTo = (sel: string) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = scroller(); const tg = el?.querySelector(sel) as HTMLElement | null
    if (el && tg) el.scrollTo({ top: Math.max(0, tg.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - (topRef.current?.offsetHeight ?? 0) - 8), behavior: 'smooth' })
  }))
  const go = (n: number) => {
    const from = stageOf(d.step), to = stageOf(n)
    setDir(to >= from ? 1 : -1)
    if (to === 1 && from === 0) lastForm.current = d.step
    patch({ step: n })
    if (to !== from || n === 5) scroller()?.scrollTo({ top: 0 })
    else if (n >= 1) scrollTo(`[data-sec="${n}"]`)
  }
  /** A missing item in the auto-check: open the form at it (and the optional box if it lives there). */
  const fix = (c: { id: string; step: number }) => {
    const inBox = !!t?.fields.some((f) => f.id === c.id && !mainIds.has(f.id))
    if (inBox) setMore(true)
    setDir(-1); patch({ step: Math.min(Math.max(c.step, d.type ? 1 : 0), 4) })
    scrollTo(c.id === 'covers' || c.id === 'title' || c.id === 'price' ? `[data-sec="${c.step}"]` : inBox ? `[data-more] #f-${c.id}, [data-sec="more"]` : `#f-${c.id}, [data-sec="${c.step}"]`)
  }
  // images: “ขายพรอมต์ด้วย” and the “ภาพ + พรอมต์” option are the same choice
  const setPrice: SetSpec = (id, v) => {
    setSpec(id, v)
    if (d.type === 'img' && id === 'sellPrompt' && typeof v === 'boolean' && !d.free) patch({ options: d.options.map((x) => (isPromptOpt(x) ? { ...x, on: v } : x)) })
  }
  const setLic: SetSpec = (id, v) => {
    setSpec(id, v)
    if (id === 'licPreset' && typeof v === 'string' && presetRows(d.type, v).length) setSpec('licAllowed', presetRows(d.type, v))
  }
  // opened at a section (edit links like ?edit=…&step=3 for the price): scroll there once
  useEffect(() => { if (d.step >= 2 && d.step <= 4) scrollTo(`[data-sec="${d.step}"]`) }, [d.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickType = (k: SellType) => {
    if (d.type === k) return
    setD((x) => ({ ...x, type: k, spec: newSpec(k), options: PRICE_OPTS[k].map((y) => ({ ...y })), step: Math.max(1, Math.min(x.step, 4)) }))
  }
  const [payout, setPayout] = useState(false)
  const publish = async (ack = false) => {
    if (missing.length) { setCheckOpen(true); return }
    // B5: before the first paid listing, say what real selling will need (ID check + payout account)
    const paid = !(d.free && d.type !== 'hire')
    const firstPaid = !d.publishedId && !getDb().published.some((x) => x.price > 0)
    if (paid && firstPaid && !ack && !localStorage.getItem(PAYOUT_ACK)) { setPayout(true); return }
    setBusy(true)
    try {
      published.current = true
      const isNew = !editing
      const id = await sell.publish({ ...d, publishedId: d.publishedId ?? `u-${d.id}` }, share, notify)
      // a new listing goes to “ผลงานของฉัน · สถานะการตรวจ” (study 4); edits keep the result screen
      if (isNew) nav(`/sell/status?sent=${encodeURIComponent(id)}`, { replace: true })
      else setDone(id)
    } catch (e) { published.current = false; if (cloudOn()) toast((e as Error).message); setCheckOpen(true) } finally { setBusy(false) }
  }

  const startNext = () => {
    published.current = false
    setDone(undefined); setSaved('idle'); setShare(true); setNotify(true); setDir(1)
    setD(blank())
    setSp({}, { replace: true })
    requestAnimationFrame(() => (document.querySelector('.layer[data-active="1"] .lsc') as HTMLElement | null)?.scrollTo({ top: 0 }))
  }
  if (done) return <Success edited={!!d.publishedId && d.publishedId !== `u-${d.id}`} id={done} d={d} share={share} notify={notify} onNext={startNext} />

  const close = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/profile?mode=creator'))
  const head = (
    <div className={s.head} ref={topRef}>
      <div className={s.hrow}>
        <button className="tb-btn" onClick={close} aria-label="ปิด"><Icon name="x" size={22} /></button>
        <div className={s.ht}><b>{d.publishedId && productById(d.publishedId) ? `แก้ไข · ${t?.name ?? ''}` : t ? `ลงขาย · ${t.name}` : 'ลงขายผลงาน'}</b><small className={saved === 'saved' ? s.ok : ''}>{saved === 'saving' ? 'กำลังบันทึก…' : saved === 'saved' ? 'บันทึกร่างแล้ว ✓' : 'บันทึกอัตโนมัติ'}</small></div>
        <Link to="/sell/drafts" className="btn btn-xs btn-s">ร่าง</Link>
      </div>
      <div className={s.prog}>{STAGES.map((x, i) => <button key={x} className={`${i <= stage ? s.pd : ''}`} {...blockTap(!d.type && i > 0, 'เลือกประเภทผลงานก่อน')} onClick={() => d.type && go(i === 0 ? Math.min(Math.max(d.step, 1), 4) : 5)} aria-label={`ขั้น ${x}`} />)}</div>
      <div className={s.stl}><span>ขั้นที่ <b>{stage + 1}</b> จาก 2 · {STAGES[stage]}</span>{d.type && <button className={s.pctB} onClick={() => setCheckOpen(true)}><span className={s.pbar}><i style={{ transform: `scaleX(${pct / 100})` }} /></span>{pct}% พร้อมลงขาย</button>}</div>
    </div>
  )

  return (
    <div className={`page has-bar ${s.page}`}>
      {head}
      <div key={stage} className={`narrow ${s.body} ${dir > 0 ? s.inR : s.inL}`}>
        {stage === 0 && <>
          <H t="ลงขายใน 1 นาที" s="ใส่ข้อมูลหลักก็ส่งตรวจได้ ที่เหลือตั้งค่าเริ่มต้นไว้ให้ แก้ทีหลังได้" />
          {!d.type && <OtherDrafts d={d} />}
          <div className="field" data-sec="0"><label className="flabel">ประเภท<span className="req">*</span></label>
            <div className={`chips hscroll ${s.typeRow}`} role="radiogroup" aria-label="ประเภทผลงาน">{ORDER.map((k) => <button key={k} role="radio" aria-checked={d.type === k} className={`chip ${s.typeChip} ${d.type === k ? 'on-p' : ''}`} onClick={() => pickType(k)}><Icon name={SPECS[k].icon} size={15} color={d.type === k ? 'currentColor' : SPECS[k].color} />{SPECS[k].name}</button>)}</div>
            {t && <span className="hint" data-type-cats>{t.sub}{childrenOf(d.type!).length > 0 && <> · หมวดบนหน้าค้นหา: {childrenOf(d.type!).map((k) => CATEGORIES[k].name).join(' · ')}</>}</span>}
          </div>
          {t && <>
            <div data-sec="1">
              <Covers d={d} patch={patch} />
              <Fields fs={t.fields} step="files" spec={d.spec} set={setSpec} type={d.type} draftId={d.id} only={inMain} />
            </div>
            <div data-sec="2">
              <div className="field"><label className="flabel">ชื่อผลงาน<span className="req">*</span></label><input className="inp" value={d.title} maxLength={70} onChange={(e) => patch({ title: e.target.value })} placeholder="เช่น ภาพตลาดกลางคืนแห่งแสงโคม" /><span className="hint">{d.title.length}/70</span></div>
              <div className="field"><label className="flabel">เหมาะกับใคร / ใช้ทำอะไร<span className="req">*</span></label><input className="inp" value={d.use} onChange={(e) => patch({ use: e.target.value })} placeholder="เช่น ทำปกเพจ โปสเตอร์ หรือวอลเปเปอร์" /></div>
              <div className="field"><label className="flabel">รายละเอียด<span className="req">*</span></label><textarea className="ta" rows={4} value={d.desc} onChange={(e) => patch({ desc: e.target.value })} placeholder="เล่าให้ผู้ซื้อเห็นภาพ ได้อะไร ใช้ยังไง" /></div>
              <Fields fs={t.fields} step="details" spec={d.spec} set={setSpec} type={d.type} draftId={d.id} only={inMain} />
            </div>
            <div data-sec="3">
              <PriceBlock d={d} patch={patch} set={setSpec} />
              <Fields fs={t.fields} step="price" spec={d.spec} set={setPrice} type={d.type} draftId={d.id} only={inMain} />
            </div>
            <div data-sec="4"><Fields fs={t.fields} step="license" spec={d.spec} set={setLic} type={d.type} draftId={d.id} only={inMain} /></div>
            <button className={`${s.bx} ${s.moreBtn}`} data-sec="more" aria-expanded={moreOpen} onClick={() => setMore(!moreOpen)}>
              <div className={s.row}><span className={s.ri} style={{ background: '#EEF2FF' }}><Icon name="edit" size={18} color="#4F46E5" /></span><span className="grow"><b>เพิ่มรายละเอียด (ไม่บังคับ)</b><small>{moreMissing ? `มี ${moreMissing} อย่างที่ต้องแก้ในส่วนนี้` : 'แท็ก ข้อมูลไฟล์ วิธีใช้ สิทธิ์การใช้งาน · ตั้งค่าเริ่มต้นไว้ให้แล้ว'}</small></span>{moreMissing > 0 && <span className={s.miss}>ขาด {moreMissing}</span>}<Icon name={moreOpen ? 'down' : 'chev'} size={18} color="var(--mut)" /></div>
            </button>
            {moreOpen && <div className={`${s.moreBox} rise`} data-more>
              <Tags d={d} patch={patch} />
              <Fields fs={t.fields} step="files" spec={d.spec} set={setSpec} type={d.type} draftId={d.id} only={inMore} />
              <Fields fs={t.fields} step="details" spec={d.spec} set={setSpec} type={d.type} draftId={d.id} only={inMore} />
              <Fields fs={t.fields} step="price" spec={d.spec} set={setPrice} type={d.type} draftId={d.id} only={inMore} />
              <Fields fs={t.fields} step="license" spec={d.spec} set={setLic} type={d.type} draftId={d.id} only={inMore} />
              {arr(d.spec.licAllowed).length > 0 && (
                <div className={s.lict}>{licRows(d.type).map((r) => { const ok = arr(d.spec.licAllowed).includes(r); return <div key={r}><span>{r}</span>{ok ? <b className={s.y}>ได้ ✓</b> : <b className={s.n}>ไม่ได้</b>}</div> })}</div>
              )}
            </div>}
          </>}
        </>}
        {d.step === 5 && t && <>
          <div className={s.prvb}><Icon name="eye" size={15} color="#fff" stroke={2} />ผู้ซื้อจะเห็นหน้านี้<span>กด “แก้ไข” เพื่อกลับไปแก้</span></div>
          <CheckList checks={checks} go={fix} compact />
          <div className={s.prvWrap}><ProductView p={previewOf(d)} preview /></div>
          <div className={s.bx}>
            <Row icon="share" c="#6C2BD9" bg="#F3ECFF" t="แชร์ลงชุมชน LUMI" sub="โพสต์พร้อมลิงก์ผลงาน" on={share} set={setShare} />
            <Row icon="megaphone" c="#D6336C" bg="#FDEBF2" t={`แจ้งผู้ติดตาม ${creatorStats(ME).followersLabel} คน`} sub={REAL ? 'แจ้งในแอปเมื่อผลงานขึ้นขาย' : 'ทดลอง · ยังไม่ส่งจริง'} on={notify} set={setNotify} />
          </div>
          <SampleNote>ลงขายในโหมดทดลอง ผลงานเก็บในเครื่องนี้ ยังไม่มีผู้ซื้อจริง</SampleNote>
        </>}
      </div>
      <div className="bottom-bar">
        {stage === 1 && <button className="btn btn-o" onClick={() => go(Math.min(Math.max(lastForm.current, 1), 4))}>แก้ไข</button>}
        {stage === 0
          ? <button className="btn btn-p" style={{ flex: 1 }} {...blockTap(!d.type, 'เลือกประเภทผลงานก่อน')} onClick={() => go(5)}><Icon name="eye" size={17} color="#fff" />ดูตัวอย่างก่อนส่ง{d.type && missing.length > 0 && <span className={s.miss}>ขาด {missing.length}</span>}</button>
          : <button className="btn btn-p" style={{ flex: 1 }} disabled={busy} onClick={() => publish()}>{busy ? 'กำลังส่ง…' : missing.length ? `ยังขาด ${missing.length} อย่าง` : editing ? productById(d.publishedId!)?.mod?.status === 'rejected' ? 'ส่งตรวจใหม่' : 'บันทึกการแก้ไข' : <><Icon name="send" size={17} color="#fff" />ส่งตรวจ</>}</button>}
      </div>
      <Sheet open={payout} onClose={() => setPayout(false)} title="ก่อนรับเงินจากการขายจริง" sub="ยืนยันตัวตนและผูกบัญชีรับเงิน · เร็ว ๆ นี้"
        footer={<button className="btn btn-p btn-block" onClick={() => { localStorage.setItem(PAYOUT_ACK, '1'); setPayout(false); publish(true) }}>รับทราบ ลงขายต่อ</button>}>
        <div className="list-row"><Icon name="user" size={20} color="var(--p)" /><span className="grow">ยืนยันตัวตน<small>ใช้บัตรประชาชน ตรวจครั้งเดียว · ป้องกันการแอบอ้างและโกง</small></span><span className="pill">เร็ว ๆ นี้</span></div>
        <div className="list-row"><Icon name="coin" size={20} color="#B45309" /><span className="grow">ผูกบัญชีรับเงิน<small>บัญชีธนาคารหรือพร้อมเพย์ที่ชื่อตรงกับบัญชีครีเอเตอร์</small></span><span className="pill">เร็ว ๆ นี้</span></div>
        <p className="hint" style={{ marginTop: 10 }}>{REAL ? 'ช่วงเปิดตัวลงได้เฉพาะของแจกฟรี ยังไม่มีการรับเงิน · ของแจกฟรีไม่ต้องยืนยัน' : 'ตอนนี้ลงขายในโหมดทดลองได้เลย ยังไม่มีการซื้อขายจริง · ของแจกฟรีไม่ต้องยืนยัน'}</p>
      </Sheet>
      <Sheet open={checkOpen} onClose={() => setCheckOpen(false)} title={missing.length ? `ตรวจอัตโนมัติ · ยังขาด ${missing.length} อย่าง` : 'ตรวจอัตโนมัติ · พร้อมลงขาย ✓'} sub={t ? `สิ่งที่ “${t.name}” ต้องมีก่อนลงขาย` : undefined} tall>
        <CheckList checks={checks} go={(c) => { setCheckOpen(false); setTimeout(() => fix(c), 200) }} />
      </Sheet>
    </div>
  )
}

function H({ t, s: sub }: { t: string; s: string }) {
  return <div className={s.h}><h1>{t}</h1><p>{sub}</p></div>
}

/** “ร่างค้างไว้” shortcut on a fresh form. */
function OtherDrafts({ d }: { d: ListingDraft }) {
  const other = useDb().drafts.filter((x) => x.id !== d.id)
  if (!other.length) return null
  return <Link to="/sell/drafts" className={`${s.drb} press`}><Img src={other[0].covers[0] ?? 'g_lotus.jpg'} className={s.drbI} /><span className="grow"><b>ร่างค้างไว้ {other.length} ชิ้น</b><small className="ell">{other[0].title || 'ยังไม่ตั้งชื่อ'} · แก้ล่าสุด {ago(other[0].updatedAt)}</small></span><span className={s.go}>ทำต่อ ›</span></Link>
}

/** Price on the one-page form. Launch (free only, not hire): a แจกฟรี / ตั้งราคา·เร็ว ๆ นี้ pair; otherwise the full price editor. */
function PriceBlock({ d, patch, set }: { d: ListingDraft; patch: (p: Partial<ListingDraft>) => void; set: SetSpec }) {
  useEffect(() => { if (FEATURES.launch && d.type !== 'hire' && !d.free) patch({ free: true }) }, [d.type, d.free]) // eslint-disable-line react-hooks/exhaustive-deps
  if (FEATURES.launch && d.type !== 'hire') return (
    <div className="field"><label className="flabel">ราคา</label>
      <div className={s.priceRow}><button className="chip on-p" aria-pressed="true">แจกฟรี</button><button className={`chip ${s.soon}`} aria-disabled="true" onClick={() => toast('ช่วงเปิดตัวลงได้เฉพาะผลงานฟรี · การขายแบบชำระเงินจะเปิดภายหลัง')}>ตั้งราคา · เร็ว ๆ นี้</button></div>
      {FEATURES.tips && <div className={s.bx} style={{ marginTop: 10 }}><Row icon="coin" c="#B45309" bg="#FFF4DB" t="เปิดรับทิป" sub="ผู้ใช้ให้ทิปได้ตามใจ" on={d.tips} set={(v) => patch({ tips: v })} /></div>}
    </div>
  )
  return <StepPrice d={d} patch={patch} set={set} />
}

function Covers({ d, patch }: { d: ListingDraft; patch: (p: Partial<ListingDraft>) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const add = async (fs: FileList | null) => {
    if (!fs) return
    const out: string[] = []
    for (const f of Array.from(fs).slice(0, 6 - d.covers.length)) {
      if (!f.type.startsWith('image/')) { toast(`“${f.name}” ไม่ใช่รูปภาพ · ใช้ JPG PNG หรือ WEBP`); continue }
      if (f.size > 10e6) { toast(`“${f.name}” ใหญ่เกิน 10 MB`); continue }
      out.push(await fileToDataUrl(f, 900))
    }
    if (fs.length > 6 - d.covers.length) toast('รูปปกได้สูงสุด 6 รูป')
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
      {!REAL && samples.length > 0 && d.covers.length < 6 && <div className={s.smp}><small>หรือใช้รูปตัวอย่าง:</small>{samples.map((x) => <button key={x} onClick={() => patch({ covers: [...d.covers, x] })} className="press"><Img src={x} /></button>)}</div>}
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

const isPromptOpt = (x?: { id: string; label: string }) => !!x && (x.id === 'both' || /พรอมต์/.test(x.label))

function StepPrice({ d, patch, set }: { d: ListingDraft; patch: (p: Partial<ListingDraft>) => void; set: SetSpec }) {
  const opts = d.options
  const live = opts.filter((x) => x.on && x.price > 0)
  const top = live.length ? Math.max(...live.map((x) => x.price)) : 0
  const upd = (id: string, p: Partial<Opt>) => {
    patch({ options: opts.map((x) => (x.id === id ? { ...x, ...p } : x)) })
    // images: the “ภาพ + พรอมต์” option and “ขายพรอมต์ด้วย” are the same choice
    if (d.type === 'img' && isPromptOpt(opts.find((x) => x.id === id)) && p.on !== undefined) set('sellPrompt', p.on)
  }
  // launch: free items only for now (server: PAID_SALES_LATER)
  useEffect(() => { if (FEATURES.launch && d.type !== 'hire' && !d.free) patch({ free: true }) }, [d.type, d.free]) // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <label className="flabel">ราคาและแบบที่ขาย<small className={s.fsub}>เปิดเฉพาะแบบที่อยากขาย ผู้ซื้อเลือกเองบนหน้าผลงาน</small></label>
    {d.type === 'hire' ? <p className="hint" style={{ marginTop: 0 }}>{FEATURES.launch ? 'ช่วงเปิดตัว: ผู้จ้างทักแชตและตกลงงานกันก่อน · การชำระเงินผ่าน LUMI จะเปิดภายหลัง · ราคาแพ็กเกจใช้แสดงเป็นราคาเริ่มต้น' : 'งานจ้างต้องตั้งราคาอย่างน้อย 1 แพ็กเกจ · ผู้จ้างจ่ายเมื่อรับข้อเสนอ · เงินโอนให้คุณเมื่อผู้จ้างกดรับงาน หรือครบ 3 วันหลังส่งงาน'}</p> : <div className={`${s.bx} ${d.free ? s.freeOn : ''}`}>
      <Row icon="gift" c="#16A34A" bg="#E5F8EC" t="แจกฟรี" sub={FEATURES.launch ? 'ช่วงเปิดตัวลงได้เฉพาะผลงานฟรี · การขายแบบชำระเงินจะเปิดภายหลัง' : 'ผู้ใช้กดรับได้เลย ยังต้องกรอกข้อมูลให้ครบเหมือนของขาย · สลับกลับเป็นขายได้ทุกเมื่อ'} on={d.free} set={(v) => (FEATURES.launch ? undefined : patch({ free: v }))} />
      {d.free && FEATURES.tips && <Row icon="coin" c="#B45309" bg="#FFF4DB" t="เปิดรับทิป" sub="ผู้ใช้ให้ทิปได้ตามใจ" on={d.tips} set={(v) => patch({ tips: v })} />}
    </div>}
    {(!d.free || d.type === 'hire') && <>
      <label className="flabel" style={{ marginTop: 16 }}>แบบที่ขาย<small className={s.fsub}>เปิดได้หลายแบบ</small></label>
      {opts.map((x) => (
        <div key={x.id} className={`${s.op} ${x.on ? s.opOn : ''}`}>
          <div className={s.opH}><span className="grow"><b>{x.label}</b><small>{x.sub}</small></span><Toggle on={x.on} onChange={(v) => upd(x.id, { on: v })} label={x.label} /></div>
          {x.on && <div className={s.opP}><span>฿</span><input inputMode="numeric" value={x.price || ''} onChange={(e) => upd(x.id, { price: Math.min(999999, parseInt(e.target.value.replace(/\D/g, '')) || 0) })} aria-label={`ราคา ${x.label}`} placeholder="0" />{x.suffix && <em>{x.suffix}</em>}</div>}
        </div>
      ))}
      {top > 0 && <><div className={s.earn}><div><small>ราคาสูงสุด</small><b>{baht(top)}</b></div><div><small>ค่าธรรมเนียม LUMI 10%</small><b>−{baht(Math.round(top * FEE))}</b></div><div><small>คุณได้รับ</small><b className={s.y}>{baht(top - Math.round(top * FEE))}</b></div></div><p className="hint" style={{ marginTop: 6, marginBottom: 14 }}>ตัวอย่าง · ยังไม่รวม VAT และค่าธรรมเนียมการชำระเงิน</p></>}
    </>}
  </>
}

type SetSpec = (id: string, v: SpecValue | ((old: SpecValue | undefined) => SpecValue)) => void

function Fields({ fs, step, spec, set, type = null, draftId, only }: { fs: Field[]; step: Step; spec: Spec; set: SetSpec; type?: SellType | null; draftId?: string; only?: (f: Field) => boolean }) {
  return <>{fs.filter((f) => f.step === step && visible(f, spec) && (!only || only(f))).map((f) => <div key={f.id} id={`f-${f.id}`}><FieldView f={f} v={spec[f.id]} spec={spec} set={set} type={type} draftId={draftId} /></div>)}</>
}

function FieldView({ f, v, spec, set, type, draftId }: { f: Field; v: SpecValue | undefined; spec: Spec; set: SetSpec; type: SellType | null; draftId?: string }) {
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
      {f.kind === 'files' && <FilesEdit f={f} v={v} set={set} type={type} spec={spec} draftId={draftId} />}
      {f.pattern && str(v) && !f.pattern.test(str(v)) && <span className="hint" style={{ color: '#DC2626' }}>{f.patternNote}</span>}
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
      <div className={s.li}><i>+</i><input value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add() } }} placeholder={f.placeholder ?? 'เพิ่มรายการ'} aria-label={`เพิ่ม ${f.label}`} /><button className={s.liAdd} onClick={add} {...blockTap(!n.trim(), 'พิมพ์ก่อนแล้วกดเพิ่ม')}>เพิ่ม</button></div>
      {(f.min ?? 1) > 1 && <span className="hint">อย่างน้อย {f.min} รายการ</span>}
    </div>
  )
}

function FilesEdit({ f, v, set, type, spec, draftId }: { f: Field; v: SpecValue | undefined; set: SetSpec; type: SellType | null; spec: Spec; draftId?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const files = filesOf(v)
  const rule = uploadRule(type, spec, f.id)
  const badExt = (n: string) => rule.exts.length > 0 && !rule.exts.includes((n.split('.').pop() ?? '').toLowerCase())
  const write = (fn: (xs: UploadedFile[]) => UploadedFile[]) => set(f.id, (old) => fn(filesOf(old)).map((x) => JSON.stringify(x)))
  const add = (fl: FileList | null) => {
    if (!fl) return
    let room = MAX_FILES - files.length
    for (const file of Array.from(fl)) {
      const name = file.name
      const ext = (name.split('.').pop() ?? '').toLowerCase()
      if (rule.exts.length && !rule.exts.includes(ext)) { toast(`“${name}” ไม่ใช่ไฟล์ที่รองรับ · ใช้ได้: ${rule.exts.map((x) => '.' + x).join(' ')}`); continue }
      if (file.size > rule.maxMB * 1048576) { toast(`“${name}” ใหญ่เกิน ${fmtMB(rule.maxMB)} ต่อไฟล์`); continue }
      if (file.size === 0) { toast(`“${name}” เป็นไฟล์ว่าง`); continue }
      if (room-- <= 0) { toast(`อัปโหลดได้สูงสุด ${MAX_FILES} ไฟล์ · รวมเป็น ZIP ได้`); break }
      write((xs) => [...xs.filter((x) => x.name !== name), { name, size: sizeOf(file.size), scan: 'scan', pct: 0 }])
      // signed-in account: real upload → private quarantine → server virus scan (same look as the demo)
      if (cloudOn() && draftId) {
        const upd = (u: Partial<UploadedFile>) => write((xs) => xs.map((x) => (x.name === name ? { ...x, ...u } : x)))
        void uploadDeliverable(draftId, file, (n) => upd({ pct: n }))
          .then((r) => { upd({ pct: 100, scan: r.scan, fileId: r.fileId, reason: r.reason }); toast(r.scan === 'ok' ? `สแกน “${name}” แล้ว ไม่พบภัยที่รู้จัก` : `“${name}” ${r.reason ?? 'ไม่ผ่านการสแกน ลงขายไม่ได้'}`) })
          .catch((e: Error) => { upd({ pct: 100, scan: 'fail', reason: e.message }); toast(e.message) })
        continue
      }
      let p = 0
      const h = setInterval(() => {
        p = Math.min(100, p + 18 + Math.random() * 22)
        const bad = /eicar|virus|malware/i.test(name)
        write((xs) => xs.map((x) => (x.name === name ? (p >= 100 ? { ...x, pct: 100, scan: bad ? 'fail' : 'ok' } : { ...x, pct: Math.round(p) }) : x)))
        if (p >= 100) { clearInterval(h); toast(bad ? `“${name}” ไม่ผ่านการสแกน ลงขายไม่ได้` : `สแกน “${name}” เบื้องต้นแล้ว ไม่พบภัยที่รู้จัก`) }
      }, 260)
    }
  }
  return (
    <div className={s.files}>
      {files.map((x) => (
        <div key={x.name} className={`${s.fi} ${x.scan === 'fail' || badExt(x.name) ? s.fail : ''} rise`}>
          <span className={s.fic}><Icon name="file" size={18} /></span>
          <span className="grow"><b className="ell">{x.name}</b>
            <small>{x.size}{x.size && ' · '}{badExt(x.name) ? 'ไม่ตรงรูปแบบที่เลือก · ลบแล้วอัปใหม่' : x.scan === 'scan' ? `กำลังสแกนไวรัส ${x.pct ?? 0}%` : x.scan === 'ok' ? 'ไม่พบภัยที่รู้จัก ✓' : 'พบความเสี่ยง · ลบแล้วอัปใหม่'}</small>
            {x.scan === 'scan' && <span className={s.fbar}><i style={{ transform: `scaleX(${(x.pct ?? 0) / 100})` }} /></span>}
          </span>
          <button onClick={() => { if (x.fileId && cloudOn()) void removeDeliverable(x.fileId); write((xs) => xs.filter((y) => y.name !== x.name)) }} aria-label={`ลบ ${x.name}`}><Icon name="trash" size={16} /></button>
        </div>
      ))}
      <button className={`${s.drop} press`} onClick={() => ref.current?.click()}><Icon name="upload" size={22} color="var(--p)" /><b>เลือกไฟล์จากเครื่อง</b><small>{f.hint}</small></button>
      <input ref={ref} type="file" multiple hidden accept={rule.exts.map((x) => '.' + x).join(',') || undefined} onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      <span className="hint">รองรับ {rule.exts.map((x) => '.' + x).join(' ')} · ไม่เกิน {fmtMB(rule.maxMB)} ต่อไฟล์ · สูงสุด {MAX_FILES} ไฟล์</span>
      <span className="hint"><Icon name="shield" size={12} /> {REAL ? 'ไฟล์อัปโหลดขึ้นระบบ LUMI และสแกนไวรัสอัตโนมัติก่อนขาย ผู้ซื้อดาวน์โหลดได้หลังรับของเท่านั้น' : 'ทดลอง: ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์ ระบบจำลองการสแกน (ชื่อไฟล์มีคำว่า virus จะไม่ผ่าน)'}</span>
    </div>
  )
}

function Row({ icon, c, bg, t, sub, on: v, set }: { icon: string; c: string; bg: string; t: string; sub: string; on: boolean; set: (v: boolean) => void }) {
  return <div className={s.row}><span className={s.ri} style={{ background: bg }}><Icon name={icon} size={18} color={c} /></span><span className="grow"><b>{t}</b><small>{sub}</small></span><Toggle on={v} onChange={set} label={t} /></div>
}

function CheckList({ checks, go, compact }: { checks: ReturnType<typeof checkListing>; go: (c: ReturnType<typeof checkListing>[number]) => void; compact?: boolean }) {
  const miss = checks.filter((c) => !c.ok)
  const list = compact ? miss : checks
  if (compact && !miss.length) return <div className={s.allOk}><span className="ok-ic"><Icon name="check" size={14} stroke={3} /></span>ตรวจอัตโนมัติผ่านครบ {checks.length} ข้อ พร้อมส่งให้ทีม LUMI ตรวจก่อนขึ้นขาย</div>
  return (
    <div className={compact ? s.ckC : s.ck}>
      {compact && <b className={s.ckH}>ยังขาด {miss.length} อย่างก่อนลงขาย</b>}
      {list.map((c) => (
        <button key={c.id} className={`${s.ci} ${c.ok ? s.ciOk : ''}`} onClick={() => go(c)}>
          <span className={c.ok ? 'ok-ic' : s.xic}>{c.ok ? <Icon name="check" size={13} stroke={3} /> : '!'}</span>
          <span className="grow">{c.label}{c.note && !c.ok && <small>{c.note}</small>}</span>
          {!c.ok && <span className={s.fix}>แก้ ›</span>}
        </button>
      ))}
    </div>
  )
}

function Success({ id, d, share, notify, onNext, edited }: { id: string; d: ListingDraft; share: boolean; notify: boolean; onNext: () => void; edited?: boolean }) {
  const nav = useNavigate()
  const p = draftToProduct(d, id)
  const opts = p.options ?? []
  const mod = useModStatus(id)
  const [reviewed] = useState(() => mod?.status === 'pending')
  const pending = mod?.status === 'pending', passed = reviewed && mod?.status === 'live'
  const rev = useDb().published.find((x) => x.id === id)?.rev
  const [revSent] = useState(() => rev?.status === 'pending')
  const revPending = rev?.status === 'pending', revPassed = revSent && !rev
  return (
    <div className={`page has-bar ${s.page}`}>
      <TopBar title="" back={false} right={<button className="tb-btn" onClick={() => nav('/profile?mode=creator', { replace: true })} aria-label="ปิด"><Icon name="x" size={22} /></button>} />
      <div className={`narrow ${s.okp}`}>
        <div className={`${s.okBg} pop-in`} style={pending || revPending ? { background: 'linear-gradient(135deg,#F59E0B,#B45309)' } : undefined}><Icon name={pending || revPending ? 'clock' : 'check'} size={48} color="#fff" stroke={3} /></div>
        <h2 className="rise" data-success={pending || revPending ? 'pending' : passed || !edited ? 'live' : 'edited'}>{pending ? 'ส่งตรวจแล้ว' : revPending ? 'ส่งการแก้ไขตรวจแล้ว' : revPassed ? 'อัปเดตผลงานแล้ว · ผ่านการตรวจ' : passed ? d.free && d.type !== 'hire' ? 'แจกฟรีแล้ว · ผ่านการตรวจ' : 'ลงขายแล้ว · ผ่านการตรวจ' : 'อัปเดตผลงานแล้ว!'}</h2>
        <p className="rise" style={{ '--i': 1 } as React.CSSProperties}>{pending ? `ทีม LUMI จะตรวจภายใน 24 ชม. เราจะแจ้งเตือนเมื่อผลงานขึ้นร้าน${REAL ? '' : ' (ตัวอย่างนี้ใช้เวลาราว 20 วินาที)'}` : revPending ? `ส่งการแก้ไขให้ทีม LUMI ตรวจแล้ว ปกติไม่เกิน 24 ชม.${REAL ? '' : ' (ตัวอย่างนี้ราว 20 วินาที)'} · ระหว่างรอ ผู้ซื้อยังเห็นฉบับเดิม` : revPassed ? 'การแก้ไขผ่านการตรวจแล้ว · ผู้ซื้อเห็นฉบับใหม่แล้ว' : passed ? 'ขึ้นหน้าแรก หน้าค้นหา และหน้าร้านแล้ว · ถ้าพบว่าผิดกฎภายหลัง LUMI ลบได้' : 'แก้ราคาและเงื่อนไขแล้ว มีผลทันที · การแก้รูป ไฟล์ ชื่อ หรือรายละเอียด จะส่งให้ทีม LUMI ตรวจก่อน'}</p>
        {reviewed && <div className="rise" data-mod-steps style={{ '--i': 1, display: 'flex', justifyContent: 'center', gap: 6, fontSize: 12, margin: '4px 0 10px' } as React.CSSProperties}>
          {['ส่งตรวจ', 'รอตรวจ', 'ขึ้นขาย'].map((x, i) => { const done = i === 0 || (i === 1 && !pending) || (i === 2 && passed); const cur = (i === 1 && pending) || (i === 2 && passed); return <span key={x} className={`pill ${done ? 'pill-g' : cur ? 'pill-w' : ''}`}>{done && <Icon name="check" size={11} stroke={3} />}{x}</span> })}
        </div>}
        <Link to={`/product/${id}`} className={`${s.mini} rise press`} style={{ '--i': 2 } as React.CSSProperties}><Img src={p.covers?.[0] ?? p.image?.src} className={s.drbI} /><span className="grow"><b className="ell">{p.title}</b><small>{p.price === 0 ? 'แจกฟรี' : `${opts.length} แบบ · เริ่ม ${baht(p.price)}`}</small></span><Icon name="chev" size={18} /></Link>
        <div className={`${s.bx} rise`} style={{ '--i': 3, textAlign: 'left' } as React.CSSProperties}>
          <div className={s.row}><span className={s.ri} style={{ background: '#F3ECFF' }}><Icon name="share" size={18} color="#6C2BD9" /></span><span className="grow"><b>แชร์ลงชุมชน LUMI</b><small>{share ? pending ? 'จะโพสต์ให้เมื่อผ่านการตรวจ' : 'โพสต์แล้ว พร้อมลิงก์ผลงาน' : 'ไม่ได้แชร์'}</small></span>{share && !pending && <span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>}</div>
          <div className={s.row}><span className={s.ri} style={{ background: '#FDEBF2' }}><Icon name="megaphone" size={18} color="#D6336C" /></span><span className="grow"><b>แจ้งผู้ติดตาม {creatorStats(ME).followersLabel} คน</b><small>{notify ? pending ? REAL ? 'จะแจ้งเมื่อผ่านการตรวจ' : 'จะแจ้งเมื่อผ่านการตรวจ (ทดลอง)' : REAL ? 'แจ้งในแอปแล้ว' : 'จำลองการแจ้งแล้ว (ทดลอง)' : 'ไม่ได้แจ้ง'}</small></span>{notify && !pending && <span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>}</div>
        </div>
        <SampleNote>โหมดทดลอง · เก็บในเครื่องนี้เท่านั้น</SampleNote>
      </div>
      <div className="bottom-bar">
        <button className="btn btn-o" onClick={() => nav(`/product/${id}`, { replace: true })}>ดูหน้าผลงาน</button>
        <button className="btn btn-p" style={{ flex: 1 }} onClick={onNext}>ลงขายชิ้นต่อไป</button>
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
        {db.drafts.length === 0 && <Empty icon="edit" title="ยังไม่มีร่าง" text="เริ่มลงขายชิ้นแรก ระบบจะบันทึกให้อัตโนมัติ" action={<Link to="/sell" className="btn btn-p btn-sm">เริ่มลงขาย</Link>} />}
        {db.drafts.map((x, i) => { const p = completion(x); const t = x.type ? SPECS[x.type] : undefined; return (
          <div key={x.id} className={`${s.dr} rise`} style={{ '--i': i } as React.CSSProperties}>
            <button className={s.drL} onClick={() => nav(`/sell?draft=${x.id}`)}>
              <Img src={x.covers[0] ?? 'g_lotus.jpg'} className={s.drbI} />
              <span className="grow"><b className="ell">{x.title || 'ยังไม่ตั้งชื่อ'}</b><small>{t?.name ?? '—'} · ค้างที่{x.step >= 5 ? 'ดูตัวอย่าง' : 'ข้อมูลหลัก'} · {ago(x.updatedAt)}</small><span className={s.pbar}><i style={{ transform: `scaleX(${p / 100})` }} /></span></span>
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

/* ===== ผลงานของฉัน · สถานะการตรวจ (study 4): where a new listing lands after “ส่งตรวจ” ===== */
type RevState = 'pending' | 'live' | 'rejected'
const REV_CHIPS: { v: RevState | 'all'; label: string }[] = [{ v: 'all', label: 'ทั้งหมด' }, { v: 'pending', label: 'รอตรวจ' }, { v: 'live', label: 'ผ่านแล้ว' }, { v: 'rejected', label: 'ต้องแก้' }]
const REV_PILL: Record<RevState, [string, string, string]> = { pending: ['รอตรวจ', '#B45309', '#FFF4DB'], live: ['ผ่านแล้ว', '#15803D', '#E5F8EC'], rejected: ['ต้องแก้', '#DC2626', '#FDECEC'] }
function revState(p: Product): RevState {
  if (p.mod?.status === 'rejected' || p.rev?.status === 'rejected') return 'rejected'
  if (p.mod?.status === 'pending' || p.rev?.status === 'pending') return 'pending'
  return 'live'
}
function revNote(p: Product, st: RevState) {
  if (st === 'rejected') return `${p.rev?.status === 'rejected' ? `การแก้ไขไม่ผ่าน · ${p.rev.reason ?? ''}` : p.mod?.reason ?? 'ยังไม่ผ่านการตรวจ'} · แก้แล้วส่งตรวจใหม่ได้เลย`
  if (st === 'pending') return p.rev ? `ส่งการแก้ไขเมื่อ ${ago(p.rev.at)} · ผู้ซื้อยังเห็นฉบับเดิม` : `ส่งเมื่อ ${ago(p.mod?.at ?? Date.now())} · แจ้งผลในแจ้งเตือน`
  return 'ขึ้นขายแล้ว · คนอื่นเห็นในหน้าแรกและหน้าค้นหา'
}
export function SellStatus() {
  const db = useDb()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const sent = sp.get('sent')
  const [f, setF] = useState<RevState | 'all'>('all')
  const mine = db.published.filter((p) => p.creatorId === ME).map((p) => ({ p, st: revState(p) }))
  const list = mine.filter((x) => f === 'all' || x.st === f)
  const sentOne = sent ? mine.find((x) => x.p.id === sent) : undefined
  return (
    <div className={`page has-bar ${s.page}`}>
      <TopBar title="ผลงานของฉัน" sub="สถานะการตรวจ" />
      <div className="narrow" style={{ padding: '12px 16px 24px' }}>
        <div className="chips hscroll" role="tablist" aria-label="สถานะ" style={{ marginBottom: 12 }}>{REV_CHIPS.map((c) => <button key={c.v} role="tab" aria-selected={f === c.v} className={`chip ${f === c.v ? 'on' : ''}`} onClick={() => setF(c.v)}>{c.label} {c.v === 'all' ? mine.length : mine.filter((x) => x.st === c.v).length}</button>)}</div>
        {sentOne && <div className={`${s.bx} ${s.sentBx} rise`} data-sent={sentOne.st}><div className={s.row}><span className={s.ri} style={{ background: '#fff' }}><Icon name={sentOne.st === 'live' ? 'check' : 'bell'} size={18} color="#6C2BD9" /></span><span className="grow">{sentOne.st === 'pending'
          ? <><b>ส่งตรวจแล้ว</b><small>ทีม LUMI จะตรวจภายใน 24 ชม. เราจะแจ้งเตือนเมื่อผลงานขึ้นร้าน{REAL ? '' : ' (ตัวอย่างนี้ใช้เวลาราว 20 วินาที)'}</small></>
          : sentOne.st === 'live' ? <><b>ผ่านการตรวจแล้ว · ผลงานขึ้นร้านแล้ว</b><small>ขึ้นหน้าแรก หน้าค้นหา และหน้าร้านแล้ว</small></> : <><b>ยังไม่ผ่านการตรวจ</b><small>ดูเหตุผลด้านล่าง แก้แล้วส่งตรวจใหม่ได้</small></>}</span></div></div>}
        {mine.length === 0 && <Empty icon="store" title="ยังไม่มีผลงาน" text="ลงขายชิ้นแรก แล้วติดตามสถานะการตรวจได้ที่นี่" action={<Link to="/sell" className="btn btn-p btn-sm">เริ่มลงขาย</Link>} />}
        {mine.length > 0 && list.length === 0 && <Empty icon="check" title="ไม่มีผลงานในสถานะนี้" />}
        {list.map(({ p, st }, i) => { const [lab, c, bg] = REV_PILL[st]; return (
          <div key={p.id} className={`${s.stRow} rise`} style={{ '--i': i } as React.CSSProperties} data-rev={st}>
            <Link to={`/product/${p.id}`} className={s.stL}>
              <Img src={p.covers?.[0] ?? heroOf(p)} className={s.stImg} />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ell2">{p.title}</b>
                <span className={s.stMeta}><em style={{ color: c, background: bg }}>{lab}</em><span className="muted">{p.price === 0 ? 'ฟรี' : baht(p.price)}</span></span>
                <small className="muted">{revNote(p, st)}</small>
              </span>
            </Link>
            {st === 'rejected' && <button className="btn btn-xs btn-p" onClick={() => nav(`/sell?edit=${p.id}&step=2`)}>แก้ไข</button>}
          </div>
        ) })}
      </div>
      <div className="bottom-bar"><button className="btn btn-p btn-block" onClick={() => nav('/sell', { replace: !!sent })}>ลงขายชิ้นต่อไป</button></div>
    </div>
  )
}
