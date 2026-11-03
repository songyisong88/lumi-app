import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Img, SampleNote, Sheet, TopBar, blockTap } from '../../components/ui'
import { ROOMS } from '../../data/appSeed'
import type { Mention, PostTag } from '../../data/appTypes'
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
import { REAL, BRAND } from '../../config'

const TAGS: PostTag[] = ['โชว์ผลงาน', 'ความรู้', 'เบื้องหลัง', 'ถาม-ตอบ', 'แจกฟรี']
export const FEELINGS = ['รู้สึก 😊 มีความสุข', 'รู้สึก 🤩 ตื่นเต้น', 'รู้สึก 🙏 ขอบคุณ', 'รู้สึก 😌 ภูมิใจ', 'รู้สึก 😴 เหนื่อย', 'รู้สึก 🤔 สงสัย', 'กำลัง 🎨 สร้างผลงาน', 'กำลัง 📚 เรียนรู้', 'กำลัง 🚀 เปิดตัวผลงาน', 'กำลัง ☕ พักผ่อน']
const MAX_MEDIA = 10
const MAX_VIDEO = 50 * 1024 * 1024

type SheetK = 'prod' | 'room' | 'tag' | 'aud' | 'feel' | null

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
  const fileRef = useRef<HTMLInputElement>(null)
  const api = useRef<MentionApi | null>(null)
  const ok = text.trim().length > 0 || media.length > 0
  const typing = ok || showPrompt || prods.length > 0 || !!feeling
  const list = useMemo(() => ALL_PRODUCTS.filter((p) => (!mineOnly || p.creatorId === ME) && (!q || p.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 40), [q, mineOnly])
  useEffect(() => { if (sp.get('add') === 'media') setTimeout(() => fileRef.current?.click(), 300) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (fs: FileList | null) => {
    if (!fs) return
    const out: string[] = []
    for (const f of Array.from(fs).slice(0, MAX_MEDIA - media.length)) {
      if (f.type.startsWith('image/')) out.push(await fileToDataUrl(f, 1280))
      else if (f.type.startsWith('video/')) {
        if (f.size > MAX_VIDEO) { toast('วิดีโอใหญ่เกิน 50 MB'); continue }
        // the cloud uploads the file itself; the sample mode keeps small clips on this device only
        if (!cloudOn() && f.size > 4 * 1024 * 1024) { toast('โหมดตัวอย่างเก็บวิดีโอได้ไม่เกิน 4 MB'); continue }
        out.push(cloudOn() ? URL.createObjectURL(f) : await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f) }))
      }
    }
    setMedia((x) => [...x, ...out].slice(0, MAX_MEDIA))
  }
  const post = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      const id = await community.create({ tag: tag ?? 'โชว์ผลงาน', text: text.trim(), images: media, productIds: prods, prompt: prompt.trim() || undefined, roomId: room, feeling, mentions: liveMentions(text, mentions) })
      toast('โพสต์แล้ว 🎉')
      nav(`/community/post/${id}`, { replace: true })
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  const r = ROOMS.find((x) => x.id === room)
  const OPTS: [string, string, () => void, boolean?][] = [
    ['🖼️', 'รูปภาพ/วิดีโอ', () => fileRef.current?.click(), media.length > 0],
    ['👤', 'แท็กคน (@)', () => api.current?.insert('@'), mentions.length > 0],
    ['🏷️', 'แท็กผลงาน · คนอ่านกดดูได้เลย', () => setSheet('prod'), prods.length > 0],
    ['😊', 'ความรู้สึก/กิจกรรม', () => setSheet('feel'), !!feeling],
    ['✨', 'ใส่พรอมต์ที่ใช้', () => setShowPrompt(true), showPrompt],
    ['👥', 'โพสต์ในกลุ่ม', () => setSheet('room'), !!room],
    ['❓', 'ถามชุมชน (ถาม-ตอบ)', () => setTag('ถาม-ตอบ'), tag === 'ถาม-ตอบ'],
    ['🎁', 'แจกฟรี', () => setTag('แจกฟรี'), tag === 'แจกฟรี'],
  ]
  return (
    <div className={`${s.composeWrap} ${typing ? s.typing : ''}`}>
      <TopBar title="สร้างโพสต์" center back onBack={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/community'))}
        right={<button className="btn btn-sm btn-p" style={ok ? undefined : { background: '#EEEAF5', color: '#A9A4BA', boxShadow: 'none' }} disabled={busy} {...blockTap(!ok, 'เขียนข้อความหรือเพิ่มรูปก่อนโพสต์')} onClick={post}>{busy ? 'กำลังโพสต์…' : 'โพสต์'}</button>} />
      <div className="narrow">
        <div className={s.ctop}><Av src={me.avatar} size={44} /><div style={{ minWidth: 0 }}>
          <b>{me.name}{feeling && <span className={s.feel}> — {feeling}</span>}</b>
          <div className={s.aud}>
            <button type="button" onClick={() => setSheet('aud')}><Icon name="globe" size={12} />สาธารณะ ▾</button>
            <button type="button" onClick={() => setSheet('room')}><Icon name="users" size={12} />{r ? r.name : 'ฟีดทั่วไป'} ▾</button>
            <button type="button" onClick={() => setSheet('tag')} style={tag ? { background: TAG_COLOR[tag][1], color: TAG_COLOR[tag][0] } : undefined}>🏷️ {tag ?? 'ประเภทโพสต์'} ▾</button>
          </div>
        </div></div>
        <MentionInput value={text} onChange={setText} mentions={mentions} onMentions={setMentions} apiRef={api} id="post-text" ariaLabel="ข้อความโพสต์" roomId={room} maxLength={2000}
          placeholder={tag === 'ถาม-ตอบ' ? 'อยากถามอะไรชุมชน…' : 'คุณกำลังคิดอะไรอยู่?'} />
        {media.length > 0 && (
          <div className={s.attach}>
            {media.map((x, i) => <div key={i} className="pop-in">{isVideo(x) || x.startsWith('blob:') ? <video src={x} muted playsInline /> : <img src={x} alt="" />}<button type="button" onClick={() => setMedia(media.filter((_, k) => k !== i))} aria-label="ลบรูป"><Icon name="x" size={14} color="#fff" /></button></div>)}
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
      <Sheet open={sheet === 'aud'} onClose={() => setSheet(null)} title="ใครเห็นโพสต์นี้ได้บ้าง">
        <div className="list-row" style={{ margin: '0 -16px' }}><Icon name="globe" size={20} /><span className="grow">สาธารณะ<small>ทุกคนบน {BRAND} · ตอนนี้ชุมชนเป็นแบบสาธารณะเท่านั้น</small></span><Icon name="check" size={18} color="var(--p)" /></div>
      </Sheet>
      <Sheet open={sheet === 'feel'} onClose={() => setSheet(null)} title="ความรู้สึก/กิจกรรม">
        <div className={s.feelGrid}>{FEELINGS.map((f) => <button key={f} type="button" className={feeling === f ? s.on : ''} onClick={() => { setFeeling(feeling === f ? undefined : f); setSheet(null) }}>{f}</button>)}</div>
        {feeling && <button type="button" className="btn btn-o btn-block" style={{ marginTop: 12 }} onClick={() => { setFeeling(undefined); setSheet(null) }}>ไม่ใส่ความรู้สึก</button>}
      </Sheet>
    </div>
  )
}
