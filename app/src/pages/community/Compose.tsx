import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { settle } from '../../services/backClose'
import { Icon } from '../../components/Icon'
import { Av, Img, SampleNote, Sheet, TopBar, blockTap } from '../../components/ui'
import { ROOMS } from '../../data/appSeed'
import type { Audience, Mention, PostTag } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { ALL_PRODUCTS, ME, baht, creatorById, productById } from '../../data/sampleData'
import { CHALLENGE } from '../../data/searchData'
import { community } from '../../services/api'
import { cloudOn } from '../../services/cloud'
import { fileToDataUrl } from '../../utils/image'
import { toast } from '../../services/toast'
import { MentionInput, liveMentions, type MentionApi } from '../../social/Mention'
import { TAG_COLOR, isVideo } from './PostCard'
import c from './Community.module.css'
import s from '../../social/Social.module.css'
import { REAL } from '../../config'
import { getDb, update } from '../../services/db'
import { AUDIENCE } from '../../services/social'
import { AudiencePick } from '../../social/PostOptions'
import { FILTERS, bakePhoto, type Aspect } from '../../social/photoEdit'

const TAGS: PostTag[] = ['โชว์ผลงาน', 'ความรู้', 'เบื้องหลัง', 'ถาม-ตอบ', 'แจกฟรี']
export const FEELINGS = ['รู้สึก 😊 มีความสุข', 'รู้สึก 🤩 ตื่นเต้น', 'รู้สึก 🙏 ขอบคุณ', 'รู้สึก 😌 ภูมิใจ', 'รู้สึก 😴 เหนื่อย', 'รู้สึก 🤔 สงสัย', 'กำลัง 🎨 สร้างผลงาน', 'กำลัง 📚 เรียนรู้', 'กำลัง 🚀 เปิดตัวผลงาน', 'กำลัง ☕ พักผ่อน']
const MAX_MEDIA = 10
const MAX_VIDEO = 50 * 1024 * 1024

type SheetK = 'prod' | 'room' | 'tag' | 'aud' | 'feel' | 'people' | 'loc' | 'photo' | 'leave' | null
interface Edit { orig: string; filter: string; aspect: Aspect }

export function Compose() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const me = creatorById(ME)
  const [tag, setTag] = useState<PostTag | undefined>(sp.get('challenge') ? 'โชว์ผลงาน' : undefined)
  const [text, setText] = useState(sp.get('challenge') && !REAL ? `ส่งผลงานชาเลนจ์ “${CHALLENGE.prompt}” 🚀 #ชาเลนจ์` : '')
  const [mentions, setMentions] = useState<Mention[]>([])
  const [media, setMedia] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(sp.get('add') === 'prompt')
  const [feeling, setFeeling] = useState<string>()
  const [prods, setProds] = useState<string[]>(sp.get('tag') ? [sp.get('tag')!] : [])
  const [room, setRoom] = useState<string | undefined>(sp.get('room') ?? undefined)
  const [sheet, setSheet] = useState<SheetK>(sp.get('add') === 'product' ? 'prod' : null)
  const [q, setQ] = useState('')
  const [mineOnly, setMineOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [audience, setAudience] = useState<Audience>('public')
  const [location, setLocation] = useState('')
  const [alt, setAlt] = useState<string[]>([])
  const [tagged, setTagged] = useState<Mention[]>([])
  const [edits, setEdits] = useState<(Edit | undefined)[]>([])
  const [ph, setPh] = useState(0)
  const [pq, setPq] = useState('')
  const [cands, setCands] = useState<{ id: string }[]>([])
  const fresh = !sp.toString()
  const [draftAsk, setDraftAsk] = useState(() => fresh && !!getDb().postDraft)
  const fileRef = useRef<HTMLInputElement>(null)
  const api = useRef<MentionApi | null>(null)
  const ok = text.trim().length > 0 || media.length > 0
  const typing = ok || showPrompt || prods.length > 0 || !!feeling
  const list = useMemo(() => ALL_PRODUCTS.filter((p) => (!mineOnly || p.creatorId === ME) && (!q || p.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 40), [q, mineOnly])
  useEffect(() => { if (sp.get('add') === 'media') setTimeout(() => fileRef.current?.click(), 300) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sheet !== 'people') return; const h = setTimeout(() => { void community.mentionCandidates(pq).then(setCands) }, 150); return () => clearTimeout(h) }, [pq, sheet])
  // Instagram keeps drafts on the device: saved when you leave with “บันทึกฉบับร่าง”.
  const restore = () => { const d = getDb().postDraft; if (d) { setText(d.text); setMedia(d.images); setAlt(d.alt); setAudience(d.audience); setLocation(d.location); setTagged(d.tagged) } setDraftAsk(false) }
  const saveDraft = () => {
    const images = media.filter((x) => x.startsWith('data:image')).reduce<string[]>((a, x) => (a.join('').length + x.length < 2_500_000 ? [...a, x] : a), [])
    try { update((d) => { d.postDraft = { text, images, alt, audience, location, tagged, at: Date.now() } }); toast(images.length < media.length ? 'บันทึกฉบับร่างแล้ว (บางรูปใหญ่เกินเก็บในเครื่อง)' : 'บันทึกฉบับร่างแล้ว') } catch { toast('บันทึกฉบับร่างไม่ได้ (พื้นที่ในเครื่องเต็ม)') }
  }
  const clearDraft = () => update((d) => { delete d.postDraft })
  const leave = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/community'))
  const move = (i: number, by: number) => {
    const j = i + by; if (j < 0 || j >= media.length) return
    const sw = <T,>(a: T[]) => { const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n }
    setMedia(sw); setAlt(sw); setEdits(sw); setPh(j)
  }
  const removeAt = (i: number) => { const f = <T,>(a: T[]) => a.filter((_, k) => k !== i); setMedia(f); setAlt(f); setEdits(f) }
  const applyEdit = async (i: number, e: Edit) => {
    setEdits((a) => { const n = [...a]; n[i] = e; return n })
    const out = await bakePhoto(e.orig, e.filter, e.aspect)
    setMedia((a) => { const n = [...a]; n[i] = out; return n })
  }

  // pictures are shrunk on the device first; until that is done “โพสต์” waits (a big batch used to post without them)
  const [prep, setPrep] = useState(0)
  const posting = useRef(false)
  const addFiles = async (fs: FileList | null) => {
    if (!fs) return
    const files = Array.from(fs).slice(0, Math.max(0, MAX_MEDIA - media.length - prep))
    if (fs.length > files.length) toast(`เพิ่มได้สูงสุด ${MAX_MEDIA} รูป/วิดีโอต่อโพสต์`)
    setPrep((n) => n + files.length)
    const out: string[] = []
    try {
      for (const f of files) {
        if (f.type.startsWith('image/')) { try { out.push(await fileToDataUrl(f, 1280)) } catch { toast(`เปิดรูป ${f.name} ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG`) } }
        else if (f.type.startsWith('video/')) {
          if (f.size > MAX_VIDEO) { toast('วิดีโอใหญ่เกิน 50 MB'); continue }
          // the cloud uploads the file itself; the sample mode keeps small clips on this device only
          if (!cloudOn() && f.size > 4 * 1024 * 1024) { toast('โหมดตัวอย่างเก็บวิดีโอได้ไม่เกิน 4 MB'); continue }
          out.push(cloudOn() ? URL.createObjectURL(f) : await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f) }))
        }
      }
    } finally {
      setMedia((x) => [...x, ...out].slice(0, MAX_MEDIA))
      setPrep((n) => n - files.length)
    }
  }
  const post = async () => {
    if (!ok || busy || prep > 0 || posting.current) return
    posting.current = true; setBusy(true)
    try {
      const id = await community.create({ tag: tag ?? 'โชว์ผลงาน', text: text.trim(), images: media, productIds: prods, prompt: prompt.trim() || undefined, roomId: room, feeling, mentions: liveMentions(text, mentions),
        audience, location: location.trim() || undefined, alt: media.map((_, i) => (alt[i] ?? '').trim()), tagged: tagged.length ? tagged : undefined })
      clearDraft()
      toast('โพสต์แล้ว 🎉')
      nav(`/community/post/${id}`, { replace: true })
    } catch (e) { toast((e as Error).message); setBusy(false); posting.current = false }
  }
  const r = ROOMS.find((x) => x.id === room)
  const OPTS: [string, string, () => void, boolean?][] = [
    ['🖼️', 'รูปภาพ/วิดีโอ', () => fileRef.current?.click(), media.length > 0],
    ['👤', 'แท็กคน (@)', () => api.current?.insert('@'), mentions.length > 0],
    ['🧑‍🤝‍🧑', tagged.length ? `แท็กคนในรูป · ${tagged.length} คน` : 'แท็กคนในรูป', () => setSheet('people'), tagged.length > 0],
    ['📍', location ? `สถานที่ · ${location}` : 'เพิ่มสถานที่', () => setSheet('loc'), !!location],
    ['🏷️', 'แท็กผลงาน · คนอ่านกดดูได้เลย', () => setSheet('prod'), prods.length > 0],
    ['😊', 'ความรู้สึก/กิจกรรม', () => setSheet('feel'), !!feeling],
    ['✨', 'ใส่พรอมต์ที่ใช้', () => setShowPrompt(true), showPrompt],
    ['👥', 'โพสต์ในกลุ่ม', () => setSheet('room'), !!room],
    ['❓', 'ถามชุมชน (ถาม-ตอบ)', () => setTag('ถาม-ตอบ'), tag === 'ถาม-ตอบ'],
    ['🎁', 'แจกฟรี', () => setTag('แจกฟรี'), tag === 'แจกฟรี'],
  ]
  return (
    <div className={`${s.composeWrap} ${typing ? s.typing : ''}`}>
      <TopBar title="สร้างโพสต์" center back onBack={() => (ok ? setSheet('leave') : leave())}
        right={<button className="btn btn-sm btn-p" style={ok ? undefined : { background: '#EEEAF5', color: '#A9A4BA', boxShadow: 'none' }} disabled={busy} {...blockTap(!ok || prep > 0, prep > 0 ? 'กำลังเตรียมรูป รอสักครู่' : 'เขียนข้อความหรือเพิ่มรูปก่อนโพสต์')} onClick={post}>{busy ? 'กำลังโพสต์…' : 'โพสต์'}</button>} />
      <div className="narrow">
        <div className={s.ctop}><Av src={me.avatar} size={44} /><div style={{ minWidth: 0 }}>
          <b>{me.name}{feeling && <span className={s.feel}> — {feeling}</span>}</b>
          {(location || tagged.length > 0) && <small style={{ display: 'block', color: 'var(--mut)' }}>{location && <>📍 {location}</>}{location && tagged.length > 0 && ' · '}{tagged.length > 0 && <>กับ {tagged.map((m) => m.name).join(', ')}</>}</small>}
          <div className={s.aud}>
            <button type="button" data-audience={audience} onClick={() => setSheet('aud')}><Icon name={AUDIENCE[audience].icon} size={12} />{AUDIENCE[audience].l} ▾</button>
            <button type="button" onClick={() => setSheet('room')}><Icon name="users" size={12} />{r ? r.name : 'ฟีดทั่วไป'} ▾</button>
            <button type="button" onClick={() => setSheet('tag')} style={tag ? { background: TAG_COLOR[tag][1], color: TAG_COLOR[tag][0] } : undefined}>🏷️ {tag ?? 'ประเภทโพสต์'} ▾</button>
          </div>
        </div></div>
        {draftAsk && <div className={s.prod} style={{ margin: '0 16px 10px' }} data-draft><span className="grow"><b>มีฉบับร่างที่บันทึกไว้</b><small>{new Date(getDb().postDraft!.at).toLocaleString('th-TH')}</small></span><button type="button" className="btn btn-xs btn-p" onClick={restore}>ใช้ฉบับร่าง</button><button type="button" className="btn btn-xs btn-o" onClick={() => { clearDraft(); setDraftAsk(false) }}>ทิ้ง</button></div>}
        <MentionInput value={text} onChange={setText} mentions={mentions} onMentions={setMentions} apiRef={api} id="post-text" ariaLabel="ข้อความโพสต์" roomId={room} maxLength={2000}
          placeholder={tag === 'ถาม-ตอบ' ? 'อยากถามอะไรชุมชน…' : 'คุณกำลังคิดอะไรอยู่?'} />
        {media.length > 0 && (
          <div className={s.attach}>
            {media.map((x, i) => <div key={i} className="pop-in" data-media={i}>{isVideo(x) || x.startsWith('blob:') ? <video src={x} muted playsInline /> : <img src={x} alt={alt[i] ?? ''} onClick={() => { setPh(i); setSheet('photo') }} />}<button type="button" onClick={() => removeAt(i)} aria-label="ลบรูป"><Icon name="x" size={14} color="#fff" /></button>
              {!(isVideo(x) || x.startsWith('blob:')) && <span style={{ position: 'absolute', left: 4, bottom: 4, display: 'flex', gap: 4 }}><button type="button" aria-label={`แก้รูปที่ ${i + 1}`} onClick={() => { setPh(i); setSheet('photo') }} style={{ position: 'static', width: 'auto', padding: '0 7px', height: 22, borderRadius: 11, fontSize: 11, color: '#fff' }}>แก้ไข{alt[i] ? ' · ALT' : ''}</button></span>}
            </div>)}
            {media.length < MAX_MEDIA && <button type="button" className={`${c.cAdd} press`} style={{ width: 96, height: 96 }} onClick={() => fileRef.current?.click()}><Icon name="image" size={22} />เพิ่ม {media.length}/{MAX_MEDIA}</button>}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} aria-label="เลือกรูปภาพหรือวิดีโอ" />
        {showPrompt && <>
          <textarea className={s.promptIn} rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="/imagine prompt: … (คนอ่านกดคัดลอกได้)" aria-label="พรอมต์ที่ใช้" maxLength={2000} />
          <div style={{ padding: '2px 16px 0', display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="btn btn-xs btn-o" onClick={() => { setPrompt(''); setShowPrompt(false) }}>เอาพรอมต์ออก</button></div>
        </>}
        {prods.map((id) => { const p = productById(id); return p && (
          <div key={id} className={s.prod} style={{ marginTop: 10 }}><Img src={heroOf(p)} className={s.prodI} /><span className="grow" style={{ minWidth: 0 }}><b className="ell">{p.title}</b><small>แท็กผลงาน · {p.price ? baht(p.price) : 'ฟรี'}</small></span><button type="button" onClick={() => setProds(prods.filter((x) => x !== id))} aria-label="เอาแท็กออก"><Icon name="x" size={18} /></button></div>
        ) })}
        <div style={{ padding: '12px 16px 0' }}><SampleNote>โพสต์จะถูกเก็บในเครื่องนี้เท่านั้น (ตัวอย่าง) ยังไม่ส่งขึ้นเซิร์ฟเวอร์</SampleNote></div>
      </div>
      {typing ? (
        <div className={s.toolbar}><b>เพิ่มลงในโพสต์</b><span>
          <button type="button" aria-label="รูปภาพ/วิดีโอ" onClick={() => fileRef.current?.click()}>🖼️</button>
          <button type="button" aria-label="แท็กคน" onClick={() => api.current?.insert('@')}>👤</button>
          <button type="button" aria-label={`แท็กผลงาน${prods.length ? ` (${prods.length})` : ''}`} onClick={() => setSheet('prod')}>🏷️</button>
          <button type="button" aria-label="แท็กคนในรูป" onClick={() => setSheet('people')}>🧑‍🤝‍🧑</button>
          <button type="button" aria-label="เพิ่มสถานที่" onClick={() => setSheet('loc')}>📍</button>
          <button type="button" aria-label="ความรู้สึก/กิจกรรม" onClick={() => setSheet('feel')}>😊</button>
          <button type="button" aria-label="ใส่พรอมต์" onClick={() => setShowPrompt(true)}>✨</button>
        </span></div>
      ) : (
        <div className={s.sheetL}><div className={s.grab} />
          {OPTS.map(([e, l, fn, on]) => <button key={l} type="button" className={s.opt} onClick={fn} aria-pressed={!!on}><span className={s.oi}>{e}</span>{l}</button>)}
        </div>
      )}

      <Sheet open={sheet === 'prod'} onClose={() => setSheet(null)} title="แท็กผลงานในโพสต์" sub="คนอ่านกดดูผลงานได้จากโพสต์ทันที" tall>
        <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาผลงาน…" aria-label="ค้นหาผลงาน" />
        <div className="chips" style={{ margin: '10px 0 4px' }}><button className={`chip ${mineOnly ? 'on' : ''}`} onClick={() => setMineOnly(true)}>ผลงานของฉัน</button><button className={`chip ${!mineOnly ? 'on' : ''}`} onClick={() => setMineOnly(false)}>ทั้งหมด</button></div>
        {list.map((p) => {
          const on = prods.includes(p.id)
          return (
            <button key={p.id} className={c.pk} onClick={() => setProds(on ? prods.filter((x) => x !== p.id) : [...prods, p.id].slice(-3))}>
              <Img src={heroOf(p)} className={c.pkI} /><span className="grow"><b className="ell">{p.title}</b><small>{creatorById(p.creatorId).name} · {p.price ? baht(p.price) : 'ฟรี'}</small></span>
              <span className={`check ${on ? 'on' : ''}`}>{on && <Icon name="check" size={14} stroke={3} color="#fff" />}</span>
            </button>
          )
        })}
        {list.length === 0 && <p className="muted" style={{ padding: 16, textAlign: 'center' }}>ไม่พบผลงาน</p>}
        <button className="btn btn-p btn-block" style={{ marginTop: 12 }} onClick={() => setSheet(null)}>เสร็จ{prods.length ? ` · ${prods.length} ชิ้น` : ''}</button>
      </Sheet>
      <Sheet open={sheet === 'room'} onClose={() => setSheet(null)} title="โพสต์ในกลุ่ม">
        <button className="list-row" onClick={() => { setRoom(undefined); setSheet(null) }}><span className="grow">ฟีดทั่วไป (ไม่เลือกกลุ่ม)</span>{!room && <Icon name="check" size={18} color="var(--p)" />}</button>
        {ROOMS.map((x) => <button key={x.id} className="list-row" onClick={() => { setRoom(x.id); setSheet(null) }}><span className={c.ric} style={{ background: x.bg, width: 36, height: 36, borderRadius: 10 }}><Icon name={x.icon} size={18} color={x.color} /></span><span className="grow">{x.name}</span>{room === x.id && <Icon name="check" size={18} color="var(--p)" />}</button>)}
      </Sheet>
      <Sheet open={sheet === 'tag'} onClose={() => setSheet(null)} title="ประเภทโพสต์">
        {TAGS.map((t) => <button key={t} className="list-row" onClick={() => { setTag(t); setSheet(null) }}><span className="pill" style={{ background: TAG_COLOR[t][1], color: TAG_COLOR[t][0] }}>{t}</span><span className="grow" />{(tag ?? 'โชว์ผลงาน') === t && <Icon name="check" size={18} color="var(--p)" />}</button>)}
      </Sheet>
      <Sheet open={sheet === 'aud'} onClose={() => setSheet(null)} title="ใครเห็นโพสต์นี้ได้บ้าง" sub="เซิร์ฟเวอร์ตรวจสิทธิ์ทุกครั้ง คนที่ไม่อยู่ในกลุ่มนี้จะเปิดโพสต์ไม่ได้แม้มีลิงก์">
        <AudiencePick value={audience} onChange={(v) => { setAudience(v); setSheet(null) }} />
      </Sheet>
      <Sheet open={sheet === 'loc'} onClose={() => setSheet(null)} title="เพิ่มสถานที่" footer={<button type="button" className="btn btn-p btn-block" onClick={() => setSheet(null)}>เสร็จ</button>}>
        <input className="inp" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="เช่น กรุงเทพฯ, เชียงใหม่" aria-label="สถานที่" />
        {location && <button type="button" className="btn btn-o btn-block" style={{ marginTop: 10 }} onClick={() => { setLocation(''); setSheet(null) }}>เอาสถานที่ออก</button>}
      </Sheet>
      <Sheet open={sheet === 'people'} onClose={() => setSheet(null)} title="แท็กคนในรูป" sub="คนที่ตั้งค่าไม่ให้แท็ก หรือบล็อกคุณ จะแท็กไม่ได้ (เซิร์ฟเวอร์ตรวจ)" tall>
        {tagged.length > 0 && <div className="chips" style={{ marginBottom: 10 }}>{tagged.map((m) => <button key={m.id} type="button" className="chip on" onClick={() => setTagged(tagged.filter((x) => x.id !== m.id))}>{m.name} ✕</button>)}</div>}
        <input className="inp" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="ค้นหาชื่อ…" aria-label="ค้นหาคนที่จะแท็ก" />
        {cands.filter((x) => x.id !== ME && !tagged.some((m) => m.id === x.id)).slice(0, 20).map((x) => { const cr = creatorById(x.id); return (
          <button key={x.id} type="button" className="list-row" data-tag-cand={x.id} style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }} onClick={() => setTagged([...tagged, { id: x.id, name: cr.name }].slice(0, 20))}><Av src={cr.avatar} size={36} /><span className="grow">{cr.name}</span><Icon name="plus" size={18} /></button>) })}
      </Sheet>
      <Sheet open={sheet === 'photo' && !!media[ph]} onClose={() => setSheet(null)} title={`รูปที่ ${ph + 1} จาก ${media.length}`} tall footer={<button type="button" className="btn btn-p btn-block" onClick={() => setSheet(null)}>เสร็จ</button>}>
        {media[ph] && <>
          <img src={media[ph]} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#111', borderRadius: 12 }} />
          <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>ฟิลเตอร์</div>
          <div className="chips">{FILTERS.map((f) => <button key={f.k} type="button" className={`chip ${(edits[ph]?.filter ?? 'none') === f.k ? 'on' : ''}`} onClick={() => void applyEdit(ph, { orig: edits[ph]?.orig ?? media[ph], filter: f.k, aspect: edits[ph]?.aspect ?? 'orig' })}>{f.l}</button>)}</div>
          <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>ครอป</div>
          <div className="chips">{([['orig', 'ต้นฉบับ'], ['1:1', '1:1'], ['4:5', '4:5'], ['16:9', '16:9']] as [Aspect, string][]).map(([k, l]) => <button key={k} type="button" className={`chip ${(edits[ph]?.aspect ?? 'orig') === k ? 'on' : ''}`} onClick={() => void applyEdit(ph, { orig: edits[ph]?.orig ?? media[ph], filter: edits[ph]?.filter ?? 'none', aspect: k })}>{l}</button>)}</div>
          <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>ลำดับ</div>
          <div className="chips"><button type="button" className="chip" disabled={ph === 0} onClick={() => move(ph, -1)}>◀ เลื่อนไปก่อน</button><button type="button" className="chip" disabled={ph === media.length - 1} onClick={() => move(ph, 1)}>เลื่อนไปหลัง ▶</button></div>
          <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>คำอธิบายรูป (alt text)</div>
          <input className="inp" value={alt[ph] ?? ''} onChange={(e) => setAlt((a) => { const n = [...a]; n[ph] = e.target.value; return n })} maxLength={300} placeholder="อธิบายรูปให้ผู้ใช้โปรแกรมอ่านหน้าจอ" aria-label="คำอธิบายรูป" />
        </>}
      </Sheet>
      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title="บันทึกเป็นฉบับร่างไหม?" sub="ฉบับร่างเก็บไว้ในเครื่องนี้ เปิดหน้าสร้างโพสต์ครั้งหน้าจะถามให้ทำต่อ">
        <button type="button" className="btn btn-p btn-block" onClick={async () => { saveDraft(); setSheet(null); await settle(); leave() }}>บันทึกฉบับร่าง</button>
        <button type="button" className="btn btn-block" style={{ marginTop: 8, color: '#DC2626' }} onClick={async () => { setSheet(null); await settle(); leave() }}>ทิ้ง</button>
      </Sheet>
      <Sheet open={sheet === 'feel'} onClose={() => setSheet(null)} title="ความรู้สึก/กิจกรรม">
        <div className={s.feelGrid}>{FEELINGS.map((f) => <button key={f} type="button" className={feeling === f ? s.on : ''} onClick={() => { setFeeling(feeling === f ? undefined : f); setSheet(null) }}>{f}</button>)}</div>
        {feeling && <button type="button" className="btn btn-o btn-block" style={{ marginTop: 12 }} onClick={() => { setFeeling(undefined); setSheet(null) }}>ไม่ใส่ความรู้สึก</button>}
      </Sheet>
    </div>
  )
}
