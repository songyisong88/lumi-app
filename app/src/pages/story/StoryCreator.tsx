import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Img } from '../../components/ui'
import { FEATURES, REAL } from '../../config'
import type { Mention, StoryLinkLabel, StoryOverlay } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { ALL_PRODUCTS, ME, baht, creatorById, imgUrl } from '../../data/sampleData'
import { community, stories } from '../../services/api'
import { useDb } from '../../services/db'
import { useSession } from '../../services/session'
import { myStories } from '../../services/storyGroups'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import { FILTERS, TEXT_BG, bakeImage, drawStrokes, ovlKind, type Stroke } from '../../social/storyCanvas'
import s from '../../social/Social.module.css'

const MAX_SLIDES = 10
const MAX_VIDEO_MB = 50
const MAX_VIDEO_S = 60
const DEMO_GALLERY = ['g_lotus.jpg', 'g_tuktuk.jpg', 'cafe.jpg', 'g_poster.jpg', 'mascot.jpg', 'coffee.jpg', 'g_anime.jpg', 'shiba.jpg', 'thaitea.jpg', 'g_island.jpg', 'toys.jpg', 'g_frogs.jpg']
const COLORS = ['#ffffff', '#16132B', '#F0508A', '#7B2FF2', '#F59E0B', '#22C55E', '#38BDF8']
const LABELS: StoryLinkLabel[] = ['ดูสินค้า', 'ดูผลงาน', 'รับฟรี', 'จ้างเลย']
const STICKERS: [string, string, string][] = [['🔗', 'ลิงก์ผลงาน', 'link'], ['@', 'กล่าวถึง', 'mention'], ['#', 'แฮชแท็ก', 'hash'], ['📊', 'โพล', '📊 โพล · ใช่ / ไม่'], ['❓', 'ถามคำถาม', '❓ ถามอะไรก็ได้'], ['⏰', 'นับถอยหลัง', '⏰ นับถอยหลัง'], ['📍', 'สถานที่', '📍 กรุงเทพฯ'], ['🎁', 'ของฟรี', '🎁 แจกฟรี'], ['🕒', 'เวลา', 'time']]
const EMOJI = ['🌸', '✨', '🔥', '💜', '😍', '🎉', '👀', '💯', '🛺', '☕', '🎨', '🙏']
const HINT_KEY = 'lumi_story_gest'

interface Slide { id: string; src: string; kind: 'image' | 'video'; file?: Blob; bg?: string; durationMs?: number; overlays: StoryOverlay[]; filter: number; strokes: Stroke[]; productId?: string; linkLabel: StoryLinkLabel }
type Panel = null | 'stk' | 'prod' | 'men' | 'mine'
const rid = () => Math.random().toString(36).slice(2, 9)

function videoMeta(f: Blob) {
  return new Promise<number>((res) => {
    const v = document.createElement('video'); v.preload = 'metadata'; const u = URL.createObjectURL(f)
    v.onloadedmetadata = () => { res(v.duration * 1000); URL.revokeObjectURL(u) }; v.onerror = () => { res(NaN); URL.revokeObjectURL(u) }; v.src = u
  })
}

/** Story maker (Instagram-like): pick photos / short clips → text, stickers, @, optional link to your work, filter, draw → share. */
export function StoryCreator() {
  const sess = useSession()
  const loc = useLocation()
  if (FEATURES.accounts && sess.mode === 'guest' && sess.ready) return <Navigate to={`/account/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  return <Creator />
}

function Creator() {
  const nav = useNavigate()
  const db = useDb()
  const [slides, setSlides] = useState<Slide[]>([])
  const [cur, setCur] = useState(0)
  const [stage, setStage] = useState<'pick' | 'edit'>('pick')
  const [multi, setMulti] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const close = () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/', { replace: true }))

  const add = async (items: { src: string; kind: 'image' | 'video'; file?: Blob; bg?: string; durationMs?: number }[]) => {
    const room = MAX_SLIDES - slides.length
    if (items.length > room) toast(`ใส่ได้สูงสุด ${MAX_SLIDES} ภาพต่อครั้ง`)
    const next = items.slice(0, room).map((x) => ({ id: rid(), overlays: [], filter: 0, strokes: [], linkLabel: 'ดูสินค้า' as StoryLinkLabel, ...x }))
    if (!next.length) return
    setSlides((v) => [...v, ...next]); setCur(slides.length); setStage('edit'); setPicked([]); setMulti(false)
  }
  const fromFiles = async (fs: FileList | null) => {
    if (!fs) return
    const out: Parameters<typeof add>[0] = []
    for (const f of Array.from(fs)) {
      if (f.type.startsWith('image/')) out.push({ src: URL.createObjectURL(f), kind: 'image', file: f })
      else if (f.type.startsWith('video/')) {
        if (f.size > MAX_VIDEO_MB * 1024 * 1024) { toast(`วิดีโอใหญ่เกิน ${MAX_VIDEO_MB} MB`); continue }
        const d = await videoMeta(f)
        if (!(d > 0)) { toast('เปิดวิดีโอนี้ไม่ได้'); continue }
        if (d > MAX_VIDEO_S * 1000 + 500) { toast(`วิดีโอยาวเกิน ${MAX_VIDEO_S} วินาที`); continue }
        out.push({ src: URL.createObjectURL(f), kind: 'video', file: f, durationMs: d })
      } else toast('ใช้ได้เฉพาะรูปภาพหรือวิดีโอสั้น')
    }
    void add(out)
  }
  const tapGallery = (f: string) => {
    if (!multi) return void add([{ src: imgUrl(f), kind: 'image' }])
    setPicked((p) => (p.includes(f) ? p.filter((x) => x !== f) : p.length >= MAX_SLIDES ? p : [...p, f]))
  }

  const share = async () => {
    const W = window.innerWidth, H = window.innerHeight
    try {
      for (let i = 0; i < slides.length; i++) {
        const sl = slides[i]
        setBusy(`กำลังแชร์… ${i + 1}/${slides.length}`)
        const mentions: Mention[] = sl.overlays.filter((o) => o.t === 'mention' && o.uid).map((o) => ({ id: o.uid!, name: creatorById(o.uid!).name }))
        const caption = sl.overlays.filter((o) => o.t === 'text').map((o) => o.text).join(' ').slice(0, 200)
        if (sl.kind === 'image') {
          const file = await bakeImage({ src: sl.bg ? undefined : sl.src, filter: FILTERS[sl.filter][1], strokes: sl.strokes, overlays: sl.overlays, frameW: W, frameH: H })
          await stories.post({ file, kind: 'image', caption, productId: sl.productId, linkLabel: sl.linkLabel, overlays: sl.overlays.map((o) => ({ ...o, baked: true })), mentions })
        } else {
          await stories.post({ file: sl.file!, kind: 'video', caption, productId: sl.productId, linkLabel: sl.linkLabel, overlays: sl.overlays, durationMs: sl.durationMs, mentions })
        }
      }
      setBusy('')
      toast(slides.length > 1 ? `แชร์ ${slides.length} สตอรี่แล้ว · หายไปใน 24 ชม.` : 'แชร์สตอรี่แล้ว · หายไปใน 24 ชม.')
      nav(`/story/${ME}`, { replace: true })
    } catch (e) { setBusy(''); toast((e as Error).message || 'แชร์ไม่สำเร็จ') }
  }

  const mine = myStories(db)
  const files = (
    <>
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden aria-label="เลือกรูปหรือวิดีโอ" onChange={(e) => { void fromFiles(e.target.files); e.target.value = '' }} />
      <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" hidden aria-label="ถ่ายรูปหรือวิดีโอ" onChange={(e) => { void fromFiles(e.target.files); e.target.value = '' }} />
    </>
  )
  if (stage === 'edit' && slides[cur]) {
    return <>
      {files}
      <Editor key={slides[cur].id} slide={slides[cur]} index={cur} total={slides.length} panel={panel} setPanel={setPanel}
        onChange={(sl) => setSlides((v) => v.map((x) => (x.id === sl.id ? sl : x)))}
        onNext={() => setCur((cur + 1) % slides.length)}
        onAdd={() => (REAL ? fileRef.current?.click() : setStage('pick'))}
        onRemove={() => { const v = slides.filter((_, i) => i !== cur); setSlides(v); setCur(Math.max(0, Math.min(cur, v.length - 1))); if (!v.length) setStage('pick') }}
        onClose={() => { if (slides.length && !confirm('ทิ้งสตอรี่ที่ทำไว้?')) return; setSlides([]); setStage('pick') }}
        onShare={share} />
      {busy && <div className={s.busy} role="status">{busy}</div>}
    </>
  }
  return (
    <div className={s.pick}>
      {files}
      <div className={s.pickH}>
        <button type="button" aria-label="ปิด" onClick={() => (slides.length ? setStage('edit') : close())}><Icon name="x" size={24} color="#fff" /></button>
        <b>เพิ่มลงสตอรี่</b>
        <button type="button" aria-label="สตอรี่ของฉัน" onClick={() => setPanel('mine')}><Icon name="gear" size={22} color="#fff" /></button>
      </div>
      <div className={s.pickModes}>
        <button type="button" style={{ background: TEXT_BG }} onClick={() => void add([{ src: '', kind: 'image', bg: TEXT_BG }])}><b style={{ fontSize: 26 }}>Aa</b>ข้อความ</button>
        <button type="button" style={{ background: '#2C2840' }} onClick={() => camRef.current?.click()}><Icon name="camera" size={26} color="#fff" />ถ่ายรูป/วิดีโอ</button>
        <button type="button" style={{ background: '#2C2840' }} onClick={() => toast('ใส่เพลงยังไม่เปิดให้ใช้ · เร็ว ๆ นี้')}><span style={{ fontSize: 24 }}>🎵</span>เพลง</button>
      </div>
      <div className={s.pickBar}>
        <button type="button" onClick={() => fileRef.current?.click()}>{REAL ? 'คลังรูปในเครื่อง ▾' : 'ล่าสุด ▾'}</button>
        <small><button type="button" aria-pressed={multi} onClick={() => { setMulti(!multi); setPicked([]) }}>{multi ? '✓ เลือกหลายรายการ' : '⧉ เลือกหลายรายการ'}</button></small>
      </div>
      <div className={s.grid}>
        <button type="button" className={s.camBtn} onClick={() => camRef.current?.click()}><Icon name="camera" size={28} color="#fff" />กล้อง</button>
        {REAL ? (
          <button type="button" className={s.camBtn} onClick={() => fileRef.current?.click()}><Icon name="image" size={28} color="#fff" />เลือกรูป/วิดีโอ<small style={{ opacity: .7, fontSize: 12 }}>วิดีโอไม่เกิน {MAX_VIDEO_S} วิ</small></button>
        ) : DEMO_GALLERY.map((f) => {
          const n = picked.indexOf(f)
          return (
            <button key={f} type="button" aria-label={`เลือกรูป ${f}`} aria-pressed={n >= 0} style={{ backgroundImage: `url(${imgUrl(f, true)})` }} onClick={() => tapGallery(f)}>
              {multi && <b className={`${s.sel} ${n >= 0 ? s.on : ''}`}>{n >= 0 ? n + 1 : ''}</b>}
            </button>
          )
        })}
      </div>
      {multi && <button type="button" className={s.next} disabled={!picked.length} onClick={() => void add(picked.map((f) => ({ src: imgUrl(f), kind: 'image' as const })))}>ถัดไป ({picked.length}) <Icon name="arrow" size={18} color="#fff" /></button>}
      {panel === 'mine' && (
        <div className={s.dsheet} style={{ top: 200 }} role="dialog" aria-label="สตอรี่ของฉัน">
          <div className={s.grab} /><button type="button" className={s.dclose} aria-label="ปิดแผง" onClick={() => setPanel(null)}><Icon name="x" size={20} color="#fff" /></button>
          <b style={{ display: 'block', fontSize: 17, marginBottom: 4 }}>สตอรี่ของฉัน</b><small style={{ color: '#aaa', fontSize: 13 }}>สตอรี่หายเองใน 24 ชม. · ลบก่อนได้</small>
          {!mine?.slides.some((x) => x.storyId) && <p style={{ color: '#aaa', marginTop: 14 }}>ยังไม่มีสตอรี่ที่กำลังแสดง</p>}
          {mine?.slides.filter((x) => x.storyId).map((x) => (
            <div key={x.storyId} className={s.prow}>
              {x.kind === 'video' ? <video src={x.media} muted style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover' }} /> : <img src={x.media} alt="" />}
              <span style={{ minWidth: 0, flex: 1 }}><b className="ell">{x.caption || (x.kind === 'video' ? 'วิดีโอ' : 'รูปภาพ')}</b><small>{x.at ? ago(x.at) : x.postedAgo} · หายไปใน {Math.max(1, Math.ceil(((x.expires ?? 0) - Date.now()) / 3600e3))} ชม.</small></span>
              <button type="button" className="btn btn-xs" style={{ background: '#E5484D', color: '#fff' }} onClick={() => { if (confirm('ลบสตอรี่นี้?')) void stories.remove(x.storyId!).then(() => toast('ลบสตอรี่แล้ว'), (e: Error) => toast(e.message)) }}>ลบ</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Gest = { id: string; pts: Map<number, [number, number]>; base: StoryOverlay; start: Map<number, [number, number]>; t0: number; moved: boolean }

function Editor({ slide, index, total, panel, setPanel, onChange, onNext, onAdd, onRemove, onClose, onShare }: {
  slide: Slide; index: number; total: number; panel: Panel; setPanel: (p: Panel) => void; onChange: (s: Slide) => void
  onNext: () => void; onAdd: () => void; onRemove: () => void; onClose: () => void; onShare: () => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLDivElement>())
  const g = useRef<Gest | null>(null)
  const [sel, setSel] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const [trashHot, setTrashHot] = useState(false)
  const [hint, setHint] = useState(() => !localStorage.getItem(HINT_KEY))
  const [text, setText] = useState<null | { id?: string; v: string; color: string; st: 0 | 1 | 2 }>(slide.bg && !slide.overlays.length ? { v: '', color: '#ffffff', st: 1 } : null)
  const [draw, setDraw] = useState<null | { c: string; w: number }>(null)
  const [fname, setFname] = useState('')
  const fnT = useRef(0)
  const [q, setQ] = useState('')
  const [cands, setCands] = useState<{ id: string; reason: string }[]>([])
  const [lbl, setLbl] = useState<StoryLinkLabel>(slide.linkLabel)
  const [prod, setProd] = useState<string | undefined>(slide.productId)
  const cv = useRef<HTMLCanvasElement>(null)
  const stroke = useRef<Stroke | null>(null)
  const set = (patch: Partial<Slide>) => onChange({ ...slide, ...patch })
  const myWorks = useMemo(() => ALL_PRODUCTS.filter((p) => p.creatorId === ME && (!q || p.title.toLowerCase().includes(q.toLowerCase()))), [q])

  // drawing layer
  useEffect(() => {
    const c = cv.current; if (!c) return
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    c.width = r.width * dpr; c.height = r.height * dpr
    const ctx = c.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawStrokes(ctx, slide.strokes, r.width, r.height, 1)
  }, [slide.strokes])
  useEffect(() => {
    if (panel !== 'men') return
    let on = true
    const h = setTimeout(() => void community.mentionCandidates(q).then((r) => { if (on) setCands(r.filter((x) => x.id !== ME)) }), 120)
    return () => { on = false; clearTimeout(h) }
  }, [q, panel])

  const addOverlay = (o: Omit<StoryOverlay, 'id' | 'x' | 'y' | 's' | 'r'>, y = 0.42) => {
    const n: StoryOverlay = { id: rid(), x: 0.5, y: y + (slide.overlays.length % 4) * 0.05, s: 1, r: o.t === 'text' ? 0 : -3, ...o }
    set({ overlays: [...slide.overlays, n] }); setSel(n.id); setPanel(null)
  }
  const style = (o: StoryOverlay) => ({ left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: `translate(-50%,-50%) rotate(${o.r}deg) scale(${o.s})`, color: o.t === 'text' && o.color ? o.color : undefined })

  // gestures: 1 finger = move, 2 fingers = pinch zoom + rotate; drop on the bin = delete. DOM is moved directly (60 fps), state is set on release.
  const down = (e: React.PointerEvent, o: StoryOverlay) => {
    if (draw) return
    e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (!g.current || g.current.id !== o.id) g.current = { id: o.id, pts: new Map(), start: new Map(), base: o, t0: Date.now(), moved: false }
    const cur = live(o.id) ?? o
    g.current.base = cur; g.current.start = new Map(g.current.pts); g.current.pts.set(e.pointerId, [e.clientX, e.clientY]); g.current.start.set(e.pointerId, [e.clientX, e.clientY])
    const el = els.current.get(o.id); if (el) el.style.transition = 'none'
    setSel(o.id)
  }
  const swallow = useRef(false)
  const overlayAt = (x: number, y: number) => [...slide.overlays].reverse().find((o) => {
    const r = els.current.get(o.id)?.getBoundingClientRect()
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  })
  const liveMap = useRef(new Map<string, StoryOverlay>())
  const live = (id: string) => liveMap.current.get(id)
  const move = (e: React.PointerEvent) => {
    const G = g.current; if (!G || !G.pts.has(e.pointerId)) return
    G.pts.set(e.pointerId, [e.clientX, e.clientY])
    const F = frame.current!.getBoundingClientRect()
    const ids = [...G.pts.keys()]
    let n = { ...G.base }
    if (ids.length === 1) {
      const [sx, sy] = G.start.get(ids[0])!, [x, y] = G.pts.get(ids[0])!
      if (Math.hypot(x - sx, y - sy) > 6) G.moved = true
      n.x = Math.min(1, Math.max(0, G.base.x + (x - sx) / F.width)); n.y = Math.min(1, Math.max(0, G.base.y + (y - sy) / F.height))
      const hot = y > F.bottom - 150 && Math.abs(x - (F.left + F.width / 2)) < 70
      if (G.moved && !dragging) setDragging(true)
      if (hot !== trashHot) setTrashHot(hot)
    } else {
      G.moved = true
      const [a, b] = ids.slice(0, 2), [a0, b0] = [G.start.get(a)!, G.start.get(b)!], [a1, b1] = [G.pts.get(a)!, G.pts.get(b)!]
      const d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]), d1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1])
      const r0 = Math.atan2(b0[1] - a0[1], b0[0] - a0[0]), r1 = Math.atan2(b1[1] - a1[1], b1[0] - a1[0])
      n.s = Math.min(5, Math.max(0.25, G.base.s * (d1 / Math.max(1, d0))))
      n.r = G.base.r + ((r1 - r0) * 180) / Math.PI
      const m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], m1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2]
      n.x = G.base.x + (m1[0] - m0[0]) / F.width; n.y = G.base.y + (m1[1] - m0[1]) / F.height
    }
    liveMap.current.set(G.id, n)
    const el = els.current.get(G.id); if (el) Object.assign(el.style, style(n))
    if (hint) { setHint(false); localStorage.setItem(HINT_KEY, '1') }
  }
  const up = (e: React.PointerEvent) => {
    const G = g.current; if (!G) return
    G.pts.delete(e.pointerId); G.start.delete(e.pointerId)
    if (G.pts.size) { G.base = live(G.id) ?? G.base; G.start = new Map(G.pts); return }
    g.current = null; setDragging(false)
    const n = live(G.id); liveMap.current.delete(G.id)
    const o = slide.overlays.find((x) => x.id === G.id)!
    if (trashHot) { setTrashHot(false); set({ overlays: slide.overlays.filter((x) => x.id !== G.id) }); setSel(undefined); navigator.vibrate?.(15); return }
    if (!G.moved && Date.now() - G.t0 < 350 && o.t === 'text') { setText({ id: o.id, v: o.text, color: o.color ?? '#ffffff', st: (o.st ?? 0) as 0 | 1 | 2 }); return }
    if (n) {
      // spring back inside the frame / to a sane size
      const fixed = { ...n, s: Math.min(4, Math.max(0.4, n.s)), x: Math.min(0.95, Math.max(0.05, n.x)), y: Math.min(0.95, Math.max(0.05, n.y)) }
      const el = els.current.get(G.id)
      if (el) { el.style.transition = 'transform .32s cubic-bezier(.2,1.4,.4,1), left .32s cubic-bezier(.2,1.4,.4,1), top .32s cubic-bezier(.2,1.4,.4,1)'; Object.assign(el.style, style(fixed)) }
      set({ overlays: slide.overlays.map((x) => (x.id === G.id ? fixed : x)) })
    }
  }
  const saveText = () => {
    if (!text) return
    const v = text.v.trim()
    if (text.id) set({ overlays: v ? slide.overlays.map((o) => (o.id === text.id ? { ...o, text: v, color: text.color, st: text.st } : o)) : slide.overlays.filter((o) => o.id !== text.id) })
    else if (v) addOverlay({ t: 'text', text: v, color: text.color, st: text.st }, 0.35)
    setText(null)
  }
  const cycleFilter = () => { const f = (slide.filter + 1) % FILTERS.length; set({ filter: f }); setFname(FILTERS[f][0]); clearTimeout(fnT.current); fnT.current = window.setTimeout(() => setFname(''), 900) }
  const p = prod ? ALL_PRODUCTS.find((x) => x.id === prod) : undefined
  const drawPt = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] }
  const media = slide.bg
    ? <div className={s.mediaFill} style={{ background: slide.bg }} />
    : slide.kind === 'video'
      ? <video className={s.mediaFill} src={slide.src} autoPlay muted loop playsInline style={{ filter: FILTERS[slide.filter][1] || undefined }} />
      : <img className={s.mediaFill} src={slide.src} alt="" style={{ filter: FILTERS[slide.filter][1] || undefined }} draggable={false} />
  return (
    <div className={s.dark} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div ref={frame} className={`${s.media} ${s.fullh}`} style={{ touchAction: 'none' }} onPointerDown={(e) => { const o = g.current && slide.overlays.find((x) => x.id === g.current!.id); if (o) down(e, o); else setSel(undefined) }}>{media}</div>
      <div className={s.shadeT} />
      <canvas ref={cv} className={s.drawC} style={{ pointerEvents: draw ? 'auto' : 'none' }}
        onPointerDown={(e) => { if (!draw) return; e.currentTarget.setPointerCapture(e.pointerId); stroke.current = { c: draw.c, w: draw.w, pts: [drawPt(e)] } }}
        onPointerMove={(e) => {
          const st = stroke.current; if (!draw || !st) return
          st.pts.push(drawPt(e))
          const c = cv.current!, r = c.getBoundingClientRect(), ctx = c.getContext('2d')!
          drawStrokes(ctx, [{ ...st, pts: st.pts.slice(-2) }], r.width, r.height, 1)
        }}
        onPointerUp={() => { if (stroke.current) { set({ strokes: [...slide.strokes, stroke.current] }); stroke.current = null } }} />
      {slide.overlays.map((o) => (
        <div key={o.id} ref={(el) => { if (el) els.current.set(o.id, el); else els.current.delete(o.id) }} role="button" tabIndex={0}
          aria-label={o.t === 'text' ? `ข้อความ ${o.text}` : o.text} className={`${s.ovl} ${s[ovlKind(o)]} ${sel === o.id ? s.selO : ''}`} style={{ ...style(o), pointerEvents: draw ? 'none' : undefined }}
          onPointerDown={(e) => down(e, o)}
          onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') set({ overlays: slide.overlays.filter((x) => x.id !== o.id) }) }}>{o.text}</div>
      ))}
      {fname && <div className={s.fName}>{fname}</div>}
      <div className={s.etop}>
        <button type="button" className={s.vbtn} aria-label="ปิดตัวแก้ไข" onClick={onClose}><Icon name="x" size={26} color="#fff" /></button>
        <span style={{ display: 'flex', gap: 6 }}>
          {total > 1 && <button type="button" style={{ fontWeight: 700, fontSize: 13, minHeight: 44, minWidth: 44, padding: '0 12px', borderRadius: 99, background: 'rgba(0,0,0,.35)' }} aria-label="ภาพถัดไปที่จะแก้" onClick={onNext}>{index + 1} / {total} ▸</button>}
          <button type="button" style={{ fontWeight: 700, fontSize: 13, minHeight: 44, minWidth: 44, padding: '0 12px', borderRadius: 99, background: 'rgba(0,0,0,.35)' }} aria-label="เพิ่มภาพ" onClick={onAdd}>＋</button>
          <button type="button" style={{ fontWeight: 700, fontSize: 13, minHeight: 44, minWidth: 44, padding: '0 10px', borderRadius: 99, background: 'rgba(0,0,0,.35)' }} aria-label="เอาภาพนี้ออก" onClick={onRemove}><Icon name="trash" size={16} color="#fff" /></button>
        </span>
      </div>
      {draw ? (
        <div className={s.drawBar}>
          {COLORS.map((c) => <button key={c} type="button" aria-label={`สี ${c}`} className={draw.c === c ? s.on : ''} style={{ background: c }} onClick={() => setDraw({ ...draw, c })} />)}
          <button type="button" className={s.done} onClick={() => set({ strokes: slide.strokes.slice(0, -1) })} disabled={!slide.strokes.length}>ย้อน</button>
          <button type="button" className={s.done} style={{ marginLeft: 6 }} onClick={() => setDraw(null)}>เสร็จ</button>
        </div>
      ) : !panel && !text && (
        <div className={s.etools}>
          {([['Aa', 'ข้อความ', () => setText({ v: '', color: '#ffffff', st: 0 })], ['😊', 'สติกเกอร์', () => { setQ(''); setPanel('stk') }], ['@', 'แท็กคน', () => { setQ(''); setPanel('men') }],
            ['🔗', 'ลิงก์ผลงาน', () => { setQ(''); setPanel('prod') }], ['✨', 'ฟิลเตอร์', cycleFilter],
            ['✏️', 'วาด', () => (slide.kind === 'video' ? toast('วาดได้เฉพาะรูปภาพ') : setDraw({ c: '#ffffff', w: 6 }))], ['🎵', 'เพลง', () => toast('ใส่เพลงยังไม่เปิดให้ใช้ · เร็ว ๆ นี้')]] as [string, string, () => void][])
            .map(([e, l, fn]) => <button key={l} type="button" className={(l === 'ลิงก์ผลงาน' && p) || (l === 'ฟิลเตอร์' && slide.filter) ? s.onT : ''}
              onPointerDown={(ev) => { // a sticker under the label (not the round icon) still gets dragged
                swallow.current = false
                if ((ev.target as HTMLElement).tagName === 'I') return
                const o = overlayAt(ev.clientX, ev.clientY); if (o) { swallow.current = true; down(ev, o) } }}
              onClick={() => { if (swallow.current) { swallow.current = false; return } fn() }}>{l}<i>{e}</i></button>)}
        </div>
      )}
      {p && !panel && <button type="button" className={s.elink} onClick={() => setPanel('prod')}>🛍️ {slide.linkLabel} · {p.title.slice(0, 22)}</button>}
      {hint && !panel && !text && !draw && slide.overlays.length > 0 && <div className={s.gest}><i>🤏</i>ลากเพื่อย้าย · ถ่างสองนิ้วเพื่อซูม/หมุน<span style={{ opacity: .8, fontWeight: 500 }}>ลากลงถังเพื่อลบ</span></div>}
      {dragging && <div className={`${s.trash} ${trashHot ? s.hot2 : ''}`} aria-hidden><Icon name="trash" size={24} color="#fff" /></div>}
      {!panel && !text && !draw && !dragging && (
        <div className={s.ebot}>
          <span className={s.pillD}><Av src={creatorById(ME).avatar} size={26} />สตอรี่ของคุณ</span>
          <button type="button" className={s.share} onClick={onShare}>แชร์ไปยังสตอรี่ <Icon name="arrow" size={18} /></button>
        </div>
      )}

      {text && (
        <div className={s.textEd} role="dialog" aria-label="ใส่ข้อความ">
          <button type="button" className={s.ok} onClick={saveText}>เสร็จ</button>
          <textarea autoFocus rows={3} value={text.v} maxLength={120} aria-label="ข้อความบนสตอรี่" placeholder="พิมพ์ข้อความ…" onChange={(e) => setText({ ...text, v: e.target.value })} style={{ color: text.color }} />
          <div className={s.row}>
            <button type="button" className={s.stb} onClick={() => setText({ ...text, st: ((text.st + 1) % 3) as 0 | 1 | 2 })}>{['กล่องขาว', 'ตัวหนังสือ', 'ไล่สี'][text.st]}</button>
            {COLORS.map((c) => <button key={c} type="button" aria-label={`สีตัวอักษร ${c}`} className={text.color === c ? s.on : ''} style={{ background: c }} onClick={() => setText({ ...text, color: c })} />)}
          </div>
        </div>
      )}
      {panel === 'stk' && (
        <div className={s.dsheet} role="dialog" aria-label="สติกเกอร์">
          <div className={s.grab} /><button type="button" className={s.dclose} aria-label="ปิดแผง" onClick={() => setPanel(null)}><Icon name="x" size={20} color="#fff" /></button>
          <input className={s.dsearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสติกเกอร์" aria-label="ค้นหาสติกเกอร์" />
          <div className={s.stkg}>{STICKERS.filter(([, l]) => !q || l.includes(q)).map(([e, l, act]) => (
            <button key={l} type="button" className={act === 'link' ? s.hl : ''} onClick={() => {
              if (act === 'link') { setQ(''); setPanel('prod') } else if (act === 'mention') { setQ(''); setPanel('men') } else if (act === 'hash') { setPanel(null); setText({ v: '#', color: '#ffffff', st: 2 }) }
              else addOverlay({ t: 'sticker', text: act === 'time' ? `🕒 ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : act })
            }}>{e} {l}</button>))}</div>
          <div className={s.emog}>{EMOJI.map((e) => <button key={e} type="button" aria-label={`อีโมจิ ${e}`} onClick={() => addOverlay({ t: 'emoji', text: e }, 0.3)}>{e}</button>)}</div>
        </div>
      )}
      {panel === 'men' && (
        <div className={s.dsheet} role="dialog" aria-label="แท็กคน">
          <div className={s.grab} /><button type="button" className={s.dclose} aria-label="ปิดแผง" onClick={() => setPanel(null)}><Icon name="x" size={20} color="#fff" /></button>
          <input className={s.dsearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาคนที่จะแท็ก" aria-label="ค้นหาคนที่จะแท็ก" autoFocus />
          {cands.map((x) => { const c = creatorById(x.id); return (
            <button key={x.id} type="button" className={s.prow} onClick={() => addOverlay({ t: 'mention', text: '@' + c.name, uid: x.id }, 0.55)}>
              <Av src={c.avatar} size={40} /><span style={{ minWidth: 0 }}><b>{c.name}</b><small>{x.reason}</small></span>
            </button>) })}
          {!cands.length && <p style={{ color: '#aaa' }}>ไม่พบคน</p>}
        </div>
      )}
      {panel === 'prod' && (
        <div className={s.dsheet} style={{ top: 170 }} role="dialog" aria-label="ลิงก์ผลงาน">
          <div className={s.grab} /><button type="button" className={s.dclose} aria-label="ปิดแผง" onClick={() => setPanel(null)}><Icon name="x" size={20} color="#fff" /></button>
          <b style={{ display: 'block', fontSize: 17, marginBottom: 4 }}>ลิงก์ไปที่ผลงานของคุณ</b><small style={{ color: '#aaa', fontSize: 13 }}>ไม่ใส่ก็ได้ · คนดูกดแล้วไปหน้าผลงานบน LUMI</small>
          <div className={s.lblPick}>{LABELS.map((l) => <button key={l} type="button" className={lbl === l ? s.on : ''} onClick={() => setLbl(l)}>{l}</button>)}</div>
          <input className={s.dsearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาผลงานของฉัน" aria-label="ค้นหาผลงานของฉัน" />
          {myWorks.length === 0 && <p style={{ color: '#aaa' }}>ยังไม่มีผลงานของคุณ · ลงผลงานก่อนแล้วค่อยใส่ลิงก์</p>}
          {myWorks.map((w) => (
            <button key={w.id} type="button" className={s.prow} aria-pressed={prod === w.id} onClick={() => setProd(prod === w.id ? undefined : w.id)}>
              <Img src={heroOf(w)} /><span style={{ minWidth: 0 }}><b className="ell">{w.title}</b><small>{w.price ? baht(w.price) : 'ฟรี'}</small></span>
              <span className={`${s.ck} ${prod === w.id ? s.on : ''}`}>{prod === w.id && <Icon name="check" size={14} color="#fff" stroke={3} />}</span>
            </button>
          ))}
          <button type="button" className="btn btn-p btn-block" style={{ marginTop: 14 }} disabled={!prod} onClick={() => { set({ productId: prod, linkLabel: lbl }); setPanel(null) }}>ใส่ลิงก์</button>
          {slide.productId && <button type="button" className="btn btn-block" style={{ marginTop: 8, background: 'transparent', color: '#fff' }} onClick={() => { setProd(undefined); set({ productId: undefined }); setPanel(null) }}>เอาลิงก์ออก</button>}
        </div>
      )}
    </div>
  )
}
