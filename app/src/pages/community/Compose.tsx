import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Img, SampleNote, Sheet, TopBar } from '../../components/ui'
import { ROOMS } from '../../data/appSeed'
import type { PostTag } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { ALL_PRODUCTS, ME, baht, creatorById, productById } from '../../data/sampleData'
import { CHALLENGE } from '../../data/searchData'
import { community } from '../../services/api'
import { fileToDataUrl } from '../../utils/image'
import { toast } from '../../services/toast'
import { TAG_COLOR } from './PostCard'
import s from './Community.module.css'

const TAGS: PostTag[] = ['โชว์ผลงาน', 'ความรู้', 'เบื้องหลัง', 'ถาม-ตอบ', 'แจกฟรี']

export function Compose() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const me = creatorById(ME)
  const [tag, setTag] = useState<PostTag>('โชว์ผลงาน')
  const [text, setText] = useState(sp.get('challenge') ? `ส่งผลงานชาเลนจ์ “${CHALLENGE.prompt}” 🚀 #ชาเลนจ์` : '')
  const [images, setImages] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const [prods, setProds] = useState<string[]>(sp.get('tag') ? [sp.get('tag')!] : [])
  const [room, setRoom] = useState<string | undefined>(sp.get('room') ?? undefined)
  const [sheet, setSheet] = useState<'prod' | 'room' | null>(null)
  const [q, setQ] = useState('')
  const [mineOnly, setMineOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const ok = text.trim().length > 0 || images.length > 0
  const list = useMemo(() => ALL_PRODUCTS.filter((p) => (!mineOnly || p.creatorId === ME) && (!q || p.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 40), [q, mineOnly])

  const addFiles = async (fs: FileList | null) => {
    if (!fs) return
    const out: string[] = []
    for (const f of Array.from(fs).slice(0, 4 - images.length)) { if (f.type.startsWith('image/')) out.push(await fileToDataUrl(f)) }
    setImages((x) => [...x, ...out].slice(0, 4))
  }
  const post = async () => {
    if (!ok || busy) return
    setBusy(true)
    const id = await community.create({ tag, text: text.trim(), images, productIds: prods, prompt: prompt.trim() || undefined, roomId: room })
    toast('โพสต์แล้ว 🎉')
    nav(`/community/post/${id}`, { replace: true })
  }
  const r = ROOMS.find((x) => x.id === room)
  return (
    <div className="page">
      <TopBar title="สร้างโพสต์" back onBack={() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/community'))} right={<button className="btn btn-sm btn-p" disabled={!ok || busy} onClick={post}>{busy ? 'กำลังโพสต์…' : 'โพสต์'}</button>} />
      <div className="narrow">
        <div className={s.cTop}><Av src={me.avatar} size={40} /><div><b>{me.name}</b><div className="muted" style={{ fontSize: 12 }}>{r ? `โพสต์ใน ${r.name}` : 'สาธารณะ · ชุมชน LUMI'}</div></div></div>
        <div className="chips hscroll" style={{ padding: '12px 16px 0' }}>
          {TAGS.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} style={tag === t ? { background: TAG_COLOR[t][1], color: TAG_COLOR[t][0], borderColor: 'transparent' } : undefined} onClick={() => setTag(t)}>{t}</button>)}
        </div>
        <textarea className={s.cTa} value={text} onChange={(e) => setText(e.target.value)} placeholder={tag === 'ถาม-ตอบ' ? 'อยากถามอะไรชุมชน…' : tag === 'ความรู้' ? 'แชร์เทคนิคที่ใช้ได้จริง…' : 'เล่าเกี่ยวกับผลงานของคุณ… ใส่ #แท็ก ได้'} aria-label="ข้อความโพสต์" autoFocus />
        <div className={s.cImgs}>
          {images.map((x, i) => <div key={i} className={`${s.cImg} pop-in`}><img src={x} alt="" /><button onClick={() => setImages(images.filter((_, k) => k !== i))} aria-label="ลบรูป"><Icon name="x" size={14} color="#fff" /></button></div>)}
          {images.length < 4 && <button className={`${s.cAdd} press`} onClick={() => fileRef.current?.click()}><Icon name="image" size={22} />เพิ่มรูป {images.length}/4</button>}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>
        {showPrompt && <div className="field" style={{ padding: '12px 16px 0' }}><label className="flabel">พรอมต์ที่ใช้ (ไม่บังคับ)</label><textarea className="ta" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="/imagine prompt: …" /><span className="hint">คนอ่านกดคัดลอกได้จากหน้าโพสต์</span></div>}
        {prods.map((id) => { const p = productById(id); return p && (
          <div key={id} className={s.prod}><Img src={heroOf(p)} className={s.prodI} /><span className="grow"><b className="ell">{p.title}</b><small>แท็กสินค้า · {p.price ? baht(p.price) : 'ฟรี'}</small></span><button onClick={() => setProds(prods.filter((x) => x !== id))} aria-label="เอาแท็กออก"><Icon name="x" size={18} /></button></div>
        ) })}
        <div className={s.cTools}>
          <button className={`${s.cTool} press`} onClick={() => fileRef.current?.click()}><Icon name="image" size={16} />รูปภาพ</button>
          <button className={`${s.cTool} ${prods.length ? s.on : ''} press`} onClick={() => setSheet('prod')}><Icon name="tag" size={16} />แท็กสินค้า{prods.length ? ` (${prods.length})` : ''}</button>
          <button className={`${s.cTool} ${showPrompt ? s.on : ''} press`} onClick={() => setShowPrompt(!showPrompt)}><Icon name="sparkle" size={16} />ใส่พรอมต์</button>
          <button className={`${s.cTool} ${room ? s.on : ''} press`} onClick={() => setSheet('room')}><Icon name="users" size={16} />{r ? r.name : 'เลือกห้อง'}</button>
        </div>
        <div style={{ padding: '4px 16px 24px' }}><SampleNote>โพสต์จะถูกเก็บในเครื่องนี้เท่านั้น (ตัวอย่าง) ยังไม่ส่งขึ้นเซิร์ฟเวอร์</SampleNote></div>
      </div>
      <Sheet open={sheet === 'prod'} onClose={() => setSheet(null)} title="แท็กสินค้าในโพสต์" sub="คนอ่านกดซื้อได้จากโพสต์ทันที" tall>
        <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาผลงาน…" aria-label="ค้นหาผลงาน" />
        <div className="chips" style={{ margin: '10px 0 4px' }}><button className={`chip ${mineOnly ? 'on' : ''}`} onClick={() => setMineOnly(true)}>ผลงานของฉัน</button><button className={`chip ${!mineOnly ? 'on' : ''}`} onClick={() => setMineOnly(false)}>ทั้งหมด</button></div>
        {list.map((p) => {
          const on = prods.includes(p.id)
          return (
            <button key={p.id} className={s.pk} onClick={() => setProds(on ? prods.filter((x) => x !== p.id) : [...prods, p.id].slice(-3))}>
              <Img src={heroOf(p)} className={s.pkI} /><span className="grow"><b className="ell">{p.title}</b><small>{creatorById(p.creatorId).name} · {p.price ? baht(p.price) : 'ฟรี'}</small></span>
              <span className={`check ${on ? 'on' : ''}`}>{on && <Icon name="check" size={14} stroke={3} color="#fff" />}</span>
            </button>
          )
        })}
        {list.length === 0 && <p className="muted" style={{ padding: 16, textAlign: 'center' }}>ไม่พบผลงาน</p>}
        <button className="btn btn-p btn-block" style={{ marginTop: 12 }} onClick={() => setSheet(null)}>เสร็จ{prods.length ? ` · ${prods.length} ชิ้น` : ''}</button>
      </Sheet>
      <Sheet open={sheet === 'room'} onClose={() => setSheet(null)} title="โพสต์ในห้อง">
        <button className="list-row" onClick={() => { setRoom(undefined); setSheet(null) }}><span className="grow">ไม่เลือกห้อง (ฟีดทั่วไป)</span>{!room && <Icon name="check" size={18} color="var(--p)" />}</button>
        {ROOMS.map((x) => <button key={x.id} className="list-row" onClick={() => { setRoom(x.id); setSheet(null) }}><span className={s.ric} style={{ background: x.bg, width: 36, height: 36, borderRadius: 10 }}><Icon name={x.icon} size={18} color={x.color} /></span><span className="grow">{x.name}</span>{room === x.id && <Icon name="check" size={18} color="var(--p)" />}</button>)}
      </Sheet>
    </div>
  )
}
