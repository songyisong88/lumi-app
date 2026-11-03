import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Img } from '../../components/ui'
import { FEATURES, REAL, BRAND } from '../../config'
import type { Mention, StoryLinkLabel, StoryOverlay } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { ALL_PRODUCTS, ME, baht, creatorById, imgUrl } from '../../data/sampleData'
import { community, stories } from '../../services/api'
import { useDb } from '../../services/db'
import { useSession } from '../../services/session'
import { myStories } from '../../services/storyGroups'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import { BG_PRESETS, FILTERS, MT0, TEXT_BG, bakeImage, bgCss, drawStrokes, fitBox, measure, mediaCss, mediaTransform, ovlColors, ovlKind, sampleColors, type MT, type Stroke } from '../../social/storyCanvas'
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

interface Slide { id: string; src: string; kind: 'image' | 'video'; file?: Blob; bg?: string; mt?: MT; nat?: [number, number]; bgc?: string[]; durationMs?: number; overlays: StoryOverlay[]; filter: number; strokes: Stroke[]; productId?: string; linkLabel: StoryLinkLabel }
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

  const share = async (aud: 'public' | 'close_friends' = 'public') => {
    const fr = document.querySelector<HTMLElement>('[data-story-frame]')
    const W = fr?.clientWidth || window.innerWidth, H = fr?.clientHeight || window.innerHeight
    try {
      for (let i = 0; i < slides.length; i++) {
        const sl = slides[i]
        setBusy(`กำลังแชร์… ${i + 1}/${slides.length}`)
        const mentions: Mention[] = sl.overlays.filter((o) => o.t === 'mention' && o.uid).map((o) => ({ id: o.uid!, name: creatorById(o.uid!).name }))
        const caption = sl.overlays.filter((o) => o.t === 'text').map((o) => o.text).join(' ').slice(0, 200)
        if (sl.kind === 'image') {
          const file = await bakeImage({ src: sl.bg ? undefined : sl.src, bg: sl.bgc ?? (sl.bg ? BG_PRESETS[0] : undefined), bgDeg: sl.bg ? 135 : 180, mt: sl.mt, filter: FILTERS[sl.filter][1], strokes: sl.strokes, overlays: sl.overlays, frameW: W, frameH: H })
          await stories.post({ file, kind: 'image', caption, productId: sl.productId, linkLabel: sl.linkLabel, overlays: sl.overlays.map((o) => ({ ...o, baked: true })), mentions, audience: aud, allowReplies: db.privacy?.storyReplies === 'followers' ? 'following' : db.privacy?.storyReplies as 'everyone' | 'following' | 'off' | undefined })
        } else {
          await stories.post({ file: sl.file!, kind: 'video', caption, productId: sl.productId, linkLabel: sl.linkLabel, overlays: [{ id: '_m', t: 'media', text: '', ...(sl.mt ?? MT0), nw: sl.nat?.[0], nh: sl.nat?.[1], bg: sl.bgc }, ...sl.overlays], durationMs: sl.durationMs, mentions, audience: aud, allowReplies: db.privacy?.storyReplies === 'followers' ? 'following' : db.privacy?.storyReplies as 'everyone' | 'following' | 'off' | undefined })
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

type Target = string // overlay id or 'media'
type Gest = { id: Target; pts: Map<number, [number, number]>; start: Map<number, [number, number]>; base: StoryOverlay | MT; t0: number; moved: boolean; onEmpty: boolean }
const SNAP = 7

function Editor({ slide, index, total, panel, setPanel, onChange, onNext, onAdd, onRemove, onClose, onShare }: {
  slide: Slide; index: number; total: number; panel: Panel; setPanel: (p: Panel) => void; onChange: (s: Slide) => void
  onNext: () => void; onAdd: () => void; onRemove: () => void; onClose: () => void; onShare: (aud?: 'public' | 'close_friends') => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const mediaEl = useRef<HTMLElement | null>(null)
  const els = useRef(new Map<string, HTMLDivElement>())
  const g = useRef<Gest | null>(null)
  const [sel, setSel] = useState<string>()
  const [dragging, setDragging] = useState<'' | 'ovl' | 'media'>('')
  const [trashHot, setTrashHot] = useState(false)
  const hotRef = useRef(false)
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false })
  const [hint, setHint] = useState(() => !localStorage.getItem(HINT_KEY))
  const [text, setText] = useState<null | { id?: string; v: string; color: string; st: 0 | 1 | 2; al: 'l' | 'c' | 'r'; size: number }>(slide.bg && !slide.overlays.length ? { v: '', color: '#ffffff', st: 1, al: 'c', size: 1 } : null)
  const [draw, setDraw] = useState<null | { c: string; w: number }>(null)
  const [fname, setFname] = useState('')
  const fnT = useRef(0)
  const [q, setQ] = useState('')
  const [cands, setCands] = useState<{ id: string; reason: string }[]>([])
  const [lbl, setLbl] = useState<StoryLinkLabel>(slide.linkLabel)
  const [prod, setProd] = useState<string | undefined>(slide.productId)
  const [fsz, setFsz] = useState({ w: window.innerWidth, h: window.innerHeight })
  const cv = useRef<HTMLCanvasElement>(null)
  const stroke = useRef<Stroke | null>(null)
  const sref = useRef(slide); sref.current = slide
  const set = (patch: Partial<Slide>) => onChange({ ...sref.current, ...patch })
  const myWorks = useMemo(() => ALL_PRODUCTS.filter((p) => p.creatorId === ME && (!q || p.title.toLowerCase().includes(q.toLowerCase()))), [q])
  const mt = slide.mt ?? MT0
  const box = slide.nat ? fitBox(slide.nat[0], slide.nat[1], fsz.w, fsz.h) : null

  useLayoutEffect(() => {
    const f = frame.current; if (!f) return
    const ro = new ResizeObserver(() => setFsz({ w: f.clientWidth, h: f.clientHeight })); ro.observe(f)
    return () => ro.disconnect()
  }, [])
  // drawing layer
  useEffect(() => {
    const c = cv.current; if (!c) return
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    c.width = r.width * dpr; c.height = r.height * dpr
    const ctx = c.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawStrokes(ctx, slide.strokes, r.width, r.height, 1)
  }, [slide.strokes, fsz])
  useEffect(() => {
    if (panel !== 'men') return
    let on = true
    const h = setTimeout(() => void community.mentionCandidates(q).then((r) => { if (on) setCands(r.filter((x) => x.id !== ME)) }), 120)
    return () => { on = false; clearTimeout(h) }
  }, [q, panel])
  // remember each layer's real box so the shared picture is drawn exactly like the screen
  useLayoutEffect(() => {
    let changed = false
    const next = slide.overlays.map((o) => {
      const el = els.current.get(o.id); if (!el) return o
      const m = measure(el)
      if (o.m && Math.abs(o.m.w - m.w) < 0.5 && Math.abs(o.m.h - m.h) < 0.5 && o.m.fs === m.fs) return o
      changed = true; return { ...o, m }
    })
    if (changed) set({ overlays: next })
  })

  const onMediaReady = (el: HTMLImageElement | HTMLVideoElement) => {
    mediaEl.current = el
    const nw = (el as HTMLImageElement).naturalWidth || (el as HTMLVideoElement).videoWidth, nh = (el as HTMLImageElement).naturalHeight || (el as HTMLVideoElement).videoHeight
    if (!nw || !nh) return
    const patch: Partial<Slide> = {}
    if (!slide.nat || slide.nat[0] !== nw) patch.nat = [nw, nh]
    if (!slide.bgc) patch.bgc = sampleColors(el)
    if (Object.keys(patch).length) set(patch)
  }

  const addOverlay = (o: Omit<StoryOverlay, 'id' | 'x' | 'y' | 's' | 'r'> & { s?: number }, y = 0.42) => {
    const n: StoryOverlay = { id: rid(), x: 0.5, y: y + (slide.overlays.length % 4) * 0.05, s: 1, r: o.t === 'text' ? 0 : -3, ...o }
    set({ overlays: [...slide.overlays, n] }); setSel(n.id); setPanel(null)
  }
  const style = (o: StoryOverlay): React.CSSProperties => {
    const cl = ovlColors(o)
    return { left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: `translate(-50%,-50%) rotate(${o.r}deg) scale(${o.s})`, color: cl.fg, background: o.t === 'text' && o.st === 0 ? cl.bg : undefined, textAlign: o.al === 'l' ? 'left' : o.al === 'r' ? 'right' : 'center' }
  }

  // ---- gestures (Instagram): a finger on a layer moves it; on the photo moves the photo. Two fingers = pinch-zoom + rotate
  // of the layer you touched first (or the photo). Centre guides snap with a tick, drag a layer onto the bin to delete.
  // The DOM is moved directly at 60 fps; state is written once on release.
  const live = useRef(new Map<Target, StoryOverlay | MT>())
  const baseOf = (id: Target): StoryOverlay | MT => live.current.get(id) ?? (id === 'media' ? mt : slide.overlays.find((x) => x.id === id)!)
  const paint = (id: Target, v: StoryOverlay | MT, anim = false) => {
    const el = id === 'media' ? mediaEl.current : els.current.get(id)
    if (!el) return
    el.style.transition = anim ? 'transform .3s cubic-bezier(.2,1.25,.4,1), left .3s cubic-bezier(.2,1.25,.4,1), top .3s cubic-bezier(.2,1.25,.4,1), opacity .2s' : 'none'
    if (id === 'media') el.style.transform = mediaTransform(v as MT, fsz.w, fsz.h)
    else { const st = style(v as StoryOverlay); el.style.left = st.left as string; el.style.top = st.top as string; el.style.transform = st.transform as string }
  }
  const targetAt = (x: number, y: number): Target | null => {
    const hit = [...slide.overlays].reverse().find((o) => { const r = els.current.get(o.id)?.getBoundingClientRect(); return !!r && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8 })
    if (hit) return hit.id
    return slide.kind === 'video' || slide.src ? 'media' : null
  }
  const onDown = (e: React.PointerEvent) => {
    if (draw || text || panel) return
    const tgt = e.target as HTMLElement
    if (tgt.closest('button,input,textarea,[data-nogest]')) {
      // a layer that sits under a tool label is still draggable (but not the round tool icon itself)
      if (!tgt.closest('[data-tool]') || tgt.tagName === 'I') return
    }
    const G = g.current
    if (G) { // extra finger joins the current gesture
      G.base = baseOf(G.id); G.start = new Map(G.pts); G.pts.set(e.pointerId, [e.clientX, e.clientY]); G.start.set(e.pointerId, [e.clientX, e.clientY]); G.moved = true
      return
    }
    const id = targetAt(e.clientX, e.clientY)
    g.current = { id: id ?? 'none', pts: new Map([[e.pointerId, [e.clientX, e.clientY]]]), start: new Map([[e.pointerId, [e.clientX, e.clientY]]]), base: id ? baseOf(id) : MT0, t0: Date.now(), moved: false, onEmpty: !id || id === 'media' }
    if (id && id !== 'media') setSel(id)
  }
  const onMove = (e: React.PointerEvent) => {
    const G = g.current; if (!G || !G.pts.has(e.pointerId)) return
    G.pts.set(e.pointerId, [e.clientX, e.clientY])
    if (G.id === 'none') return
    const F = frame.current!.getBoundingClientRect()
    const ids = [...G.pts.keys()]
    const isM = G.id === 'media'
    let n: StoryOverlay | MT = { ...G.base }
    let gv = false, gh = false
    if (ids.length === 1) {
      const [sx, sy] = G.start.get(ids[0])!, [x, y] = G.pts.get(ids[0])!
      if (!G.moved && Math.hypot(x - sx, y - sy) < 6) return
      if (!G.moved) { G.moved = true; setDragging(isM ? 'media' : 'ovl') }
      if (isM) { const b = G.base as MT; n = { ...b, x: b.x + (x - sx) / F.width, y: b.y + (y - sy) / F.height } }
      else {
        const b = G.base as StoryOverlay
        let nx = b.x + (x - sx) / F.width, ny = b.y + (y - sy) / F.height
        if (Math.abs(nx - 0.5) * F.width < SNAP) { nx = 0.5; gv = true }
        if (Math.abs(ny - 0.5) * F.height < SNAP) { ny = 0.5; gh = true }
        n = { ...b, x: Math.min(1, Math.max(0, nx)), y: Math.min(1, Math.max(0, ny)) }
        const hot = Math.hypot(x - (F.left + F.width / 2), y - (F.bottom - 136)) < 64
        if (hot !== hotRef.current) { hotRef.current = hot; setTrashHot(hot); if (hot) navigator.vibrate?.(12) }
      }
      if (isM) { const m = n as MT; if (Math.abs(m.x) * F.width < SNAP) { m.x = 0; gv = true } if (Math.abs(m.y) * F.height < SNAP) { m.y = 0; gh = true } }
    } else {
      G.moved = true; if (!dragging) setDragging(isM ? 'media' : 'ovl')
      const [a, b] = ids.slice(0, 2), [a0, b0] = [G.start.get(a)!, G.start.get(b)!], [a1, b1] = [G.pts.get(a)!, G.pts.get(b)!]
      const d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]), d1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1])
      const r0 = Math.atan2(b0[1] - a0[1], b0[0] - a0[0]), r1 = Math.atan2(b1[1] - a1[1], b1[0] - a1[0])
      const m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], m1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2]
      let r = G.base.r + ((r1 - r0) * 180) / Math.PI
      const near = Math.round(r / 90) * 90; if (Math.abs(r - near) < 3) r = near // snap upright like IG
      n = { ...G.base, s: Math.min(isM ? 6 : 8, Math.max(isM ? 0.25 : 0.2, G.base.s * (d1 / Math.max(1, d0)))), r, x: G.base.x + (m1[0] - m0[0]) / F.width, y: G.base.y + (m1[1] - m0[1]) / F.height }
    }
    if (gv !== guides.v || gh !== guides.h) { if ((gv && !guides.v) || (gh && !guides.h)) navigator.vibrate?.(6); setGuides({ v: gv, h: gh }) }
    live.current.set(G.id, n)
    paint(G.id, n)
    const el = !isM && els.current.get(G.id)
    if (el) el.style.opacity = hotRef.current ? '0.55' : ''
    if (el && hotRef.current) el.style.transform += ' scale(.5)'
    if (hint) { setHint(false); localStorage.setItem(HINT_KEY, '1') }
  }
  const onUp = (e: React.PointerEvent) => {
    const G = g.current; if (!G || !G.pts.has(e.pointerId)) return
    G.pts.delete(e.pointerId); G.start.delete(e.pointerId)
    if (G.pts.size) { G.base = baseOf(G.id); G.start = new Map(G.pts); return }
    g.current = null; setDragging(''); setGuides({ v: false, h: false })
    const n = live.current.get(G.id); live.current.delete(G.id)
    const wasHot = hotRef.current; hotRef.current = false; setTrashHot(false)
    if (!G.moved && Date.now() - G.t0 < 350) {
      const o = slide.overlays.find((x) => x.id === G.id)
      if (o?.t === 'text') return setText({ id: o.id, v: o.text, color: o.color ?? '#ffffff', st: (o.st ?? 0) as 0 | 1 | 2, al: o.al ?? 'c', size: o.s })
      if (!o) { if (sel) setSel(undefined); else setText({ v: '', color: '#ffffff', st: 1, al: 'c', size: 1 }) } // tap on the picture = type (Instagram)
      return
    }
    if (!n) return
    if (G.id === 'media') { set({ mt: n as MT }); return }
    if (wasHot) {
      const el = els.current.get(G.id)
      if (el) { el.style.transition = 'transform .18s ease-in, opacity .18s'; el.style.opacity = '0'; el.style.transform += ' scale(.2)' }
      navigator.vibrate?.(20)
      setTimeout(() => { set({ overlays: sref.current.overlays.filter((x) => x.id !== G.id) }); setSel(undefined) }, 170)
      return
    }
    const o = n as StoryOverlay
    const fixed = { ...o, s: Math.min(6, Math.max(0.3, o.s)), x: Math.min(0.96, Math.max(0.04, o.x)), y: Math.min(0.96, Math.max(0.04, o.y)) }
    if (fixed.s !== o.s || fixed.x !== o.x || fixed.y !== o.y) paint(G.id, fixed, true)
    set({ overlays: sref.current.overlays.map((x) => (x.id === G.id ? fixed : x)) })
  }
  const saveText = () => {
    if (!text) return
    const v = text.v.replace(/\s+$/, '').replace(/^\s+/, '')
    const patch = { text: v, color: text.color, st: text.st, al: text.al, s: text.size }
    if (text.id) set({ overlays: v ? slide.overlays.map((o) => (o.id === text.id ? { ...o, ...patch, m: undefined } : o)) : slide.overlays.filter((o) => o.id !== text.id) })
    else if (v) addOverlay({ t: 'text', ...patch }, 0.35)
    setText(null)
  }
  const cycleFilter = () => { const f = (slide.filter + 1) % FILTERS.length; set({ filter: f }); setFname(FILTERS[f][0]); clearTimeout(fnT.current); fnT.current = window.setTimeout(() => setFname(''), 900) }
  const cycleBg = () => { const i = BG_PRESETS.findIndex((c) => c[0] === slide.bgc?.[0] && c[1] === slide.bgc?.[1]); set({ bgc: BG_PRESETS[(i + 1) % BG_PRESETS.length] }) }
  const p = prod ? ALL_PRODUCTS.find((x) => x.id === prod) : undefined
  const drawPt = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] }
  const textOnly = !!slide.bg
  const mStyle = box ? { ...mediaCss(mt, box, fsz.w, fsz.h), filter: FILTERS[slide.filter][1] || undefined } : { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'contain' as const, opacity: 0 }
  const media = textOnly ? null : slide.kind === 'video'
    ? <video ref={(v) => { if (v) mediaEl.current = v }} src={slide.src} autoPlay muted loop playsInline style={mStyle} onLoadedMetadata={(e) => onMediaReady(e.currentTarget)} onLoadedData={(e) => { if (!slide.bgc) onMediaReady(e.currentTarget) }} />
    : <img ref={(im) => { if (im) { mediaEl.current = im; if (im.complete && im.naturalWidth && !slide.nat) onMediaReady(im) } }} src={slide.src} alt="" crossOrigin="anonymous" style={mStyle} draggable={false} onLoad={(e) => onMediaReady(e.currentTarget)} />
  const busyUi = !!dragging
  const pillBtn = { fontWeight: 700, fontSize: 13, minHeight: 44, minWidth: 44, padding: '0 12px', borderRadius: 99, background: 'rgba(0,0,0,.35)' }
  return (
    <div className={s.dark} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: 'none' }}>
      <div ref={frame} className={`${s.media} ${s.fullh}`} data-story-frame style={{ touchAction: 'none', background: bgCss(slide.bgc ?? (textOnly ? BG_PRESETS[0] : undefined), textOnly ? 135 : 180) }}>{media}</div>
      <div className={s.shadeT} style={{ opacity: busyUi ? 0 : 1, transition: 'opacity .2s' }} />
      {guides.v && <div className={s.guideV} aria-hidden />}
      {guides.h && <div className={s.guideH} aria-hidden />}
      <canvas ref={cv} className={s.drawC} style={{ pointerEvents: draw ? 'auto' : 'none' }}
        onPointerDown={(e) => { if (!draw) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); stroke.current = { c: draw.c, w: draw.w, pts: [drawPt(e)] } }}
        onPointerMove={(e) => {
          const st = stroke.current; if (!draw || !st) return
          e.stopPropagation()
          st.pts.push(drawPt(e))
          const c = cv.current!, r = c.getBoundingClientRect(), ctx = c.getContext('2d')!
          drawStrokes(ctx, [{ ...st, pts: st.pts.slice(-2) }], r.width, r.height, 1)
        }}
        onPointerUp={(e) => { e.stopPropagation(); if (stroke.current) { set({ strokes: [...slide.strokes, stroke.current] }); stroke.current = null } }} />
      {slide.overlays.map((o) => (
        <div key={o.id} ref={(el) => { if (el) els.current.set(o.id, el); else els.current.delete(o.id) }} role="button" tabIndex={0} data-ovl={o.id}
          aria-label={o.t === 'text' ? `ข้อความ ${o.text}` : o.text} className={`${s.ovl} ${s[ovlKind(o)]} ${sel === o.id && !dragging ? s.selO : ''}`} style={{ ...style(o), pointerEvents: draw ? 'none' : undefined, visibility: text?.id === o.id ? 'hidden' : undefined }}
          onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') set({ overlays: slide.overlays.filter((x) => x.id !== o.id) }) }}>{o.text}</div>
      ))}
      {fname && <div className={s.fName}>{fname}</div>}
      <div className={s.etop} style={{ opacity: busyUi ? 0 : 1, transition: 'opacity .2s', pointerEvents: busyUi ? 'none' : undefined }}>
        <button type="button" className={s.vbtn} aria-label="ปิดตัวแก้ไข" onClick={onClose}><Icon name="x" size={26} color="#fff" /></button>
        <span style={{ display: 'flex', gap: 6 }}>
          {textOnly && <button type="button" style={pillBtn} aria-label="เปลี่ยนสีพื้นหลัง" onClick={cycleBg}><span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 99, border: '2px solid #fff', background: bgCss(slide.bgc ?? BG_PRESETS[0], 135), verticalAlign: 'middle' }} /></button>}
          {!textOnly && (mt.s !== 1 || mt.x || mt.y || mt.r) ? <button type="button" style={pillBtn} aria-label="จัดรูปกลับที่เดิม" onClick={() => { paint('media', MT0, true); set({ mt: MT0 }) }}>↺</button> : null}
          {total > 1 && <button type="button" style={pillBtn} aria-label="ภาพถัดไปที่จะแก้" onClick={onNext}>{index + 1} / {total} ▸</button>}
          <button type="button" style={pillBtn} aria-label="เพิ่มภาพ" onClick={onAdd}>＋</button>
          <button type="button" style={{ ...pillBtn, padding: '0 10px' }} aria-label="เอาภาพนี้ออก" onClick={onRemove}><Icon name="trash" size={16} color="#fff" /></button>
        </span>
      </div>
      {draw ? (
        <div className={s.drawBar} data-nogest>
          {COLORS.map((c) => <button key={c} type="button" aria-label={`สี ${c}`} className={draw.c === c ? s.on : ''} style={{ background: c }} onClick={() => setDraw({ ...draw, c })} />)}
          <button type="button" className={s.done} onClick={() => set({ strokes: slide.strokes.slice(0, -1) })} disabled={!slide.strokes.length}>ย้อน</button>
          <button type="button" className={s.done} style={{ marginLeft: 6 }} onClick={() => setDraw(null)}>เสร็จ</button>
        </div>
      ) : !panel && !text && (
        <div className={s.etools} style={{ opacity: busyUi ? 0 : 1, transition: 'opacity .2s', pointerEvents: busyUi ? 'none' : undefined }}>
          {([['Aa', 'ข้อความ', () => setText({ v: '', color: '#ffffff', st: 0, al: 'c', size: 1 })], ['😊', 'สติกเกอร์', () => { setQ(''); setPanel('stk') }], ['@', 'แท็กคน', () => { setQ(''); setPanel('men') }],
            ['🔗', 'ลิงก์ผลงาน', () => { setQ(''); setPanel('prod') }], ['✨', 'ฟิลเตอร์', cycleFilter],
            ['✏️', 'วาด', () => (slide.kind === 'video' ? toast('วาดได้เฉพาะรูปภาพ') : setDraw({ c: '#ffffff', w: 6 }))], ['🎵', 'เพลง', () => toast('ใส่เพลงยังไม่เปิดให้ใช้ · เร็ว ๆ นี้')]] as [string, string, () => void][])
            .map(([e, l, fn]) => <button key={l} type="button" data-tool className={(l === 'ลิงก์ผลงาน' && p) || (l === 'ฟิลเตอร์' && slide.filter) ? s.onT : ''}
              onClick={() => { if (g.current || dragging) return; fn() }}>{l}<i>{e}</i></button>)}
        </div>
      )}
      {p && !panel && !busyUi && <button type="button" className={s.elink} onClick={() => setPanel('prod')}>🛍️ {slide.linkLabel} · {p.title.slice(0, 22)}</button>}
      {hint && !panel && !text && !draw && !busyUi && <div className={s.gest}><i>🤏</i>{slide.overlays.length ? 'ลากเพื่อย้าย · ถ่างสองนิ้วเพื่อซูม/หมุน' : 'ลากรูปเพื่อย้าย · ถ่างสองนิ้วเพื่อซูม/หมุน'}<span style={{ opacity: .8, fontWeight: 500 }}>{slide.overlays.length ? 'ลากลงถังเพื่อลบ' : 'แตะที่รูปเพื่อพิมพ์ข้อความ'}</span></div>}
      {dragging === 'ovl' && <div className={`${s.trash} ${trashHot ? s.hot2 : ''}`} style={{ bottom: 110 }} aria-hidden><Icon name="trash" size={24} color="#fff" /></div>}
      {!panel && !text && !draw && !busyUi && (
        <div className={s.ebot}>
          <button type="button" className={s.pillD} onClick={() => onShare('public')} data-share="public"><Av src={creatorById(ME).avatar} size={26} />สตอรี่ของคุณ</button>
          <button type="button" className={s.pillD} onClick={() => onShare('close_friends')} data-share="close_friends" aria-label="แชร์ให้เพื่อนสนิท"><span style={{ width: 26, height: 26, borderRadius: 99, background: '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={15} color="#fff" fill="#fff" /></span>เพื่อนสนิท</button>
          <button type="button" className={s.share} onClick={() => onShare('public')} aria-label="แชร์ไปยังสตอรี่"><Icon name="arrow" size={18} /></button>
        </div>
      )}

      {text && (() => {
        const pv = ovlColors({ id: '', t: 'text', text: '', x: 0, y: 0, s: 1, r: 0, st: text.st, color: text.color })
        return (
          <div className={s.textEd} role="dialog" aria-label="ใส่ข้อความ" data-nogest>
            <button type="button" className={s.ok} onClick={saveText}>เสร็จ</button>
            <div className={s.tedTop}>
              <button type="button" className={s.stb} onClick={() => setText({ ...text, st: ((text.st + 1) % 3) as 0 | 1 | 2 })}>{['กล่องสี', 'ตัวหนังสือ', 'ไล่สี'][text.st]}</button>
              <button type="button" className={s.stb} aria-label="จัดตำแหน่งข้อความ" onClick={() => setText({ ...text, al: text.al === 'c' ? 'l' : text.al === 'l' ? 'r' : 'c' })}>{text.al === 'l' ? '⇤ ชิดซ้าย' : text.al === 'r' ? 'ชิดขวา ⇥' : '↔ กึ่งกลาง'}</button>
            </div>
            <input type="range" className={s.tsize} min={0.5} max={2.2} step={0.01} value={text.size} aria-label="ขนาดตัวอักษร" onChange={(e) => setText({ ...text, size: Number(e.target.value) })} />
            <textarea autoFocus rows={Math.min(5, text.v.split('\n').length + 1)} value={text.v} maxLength={120} aria-label="ข้อความบนสตอรี่" placeholder="พิมพ์ข้อความ…" onChange={(e) => setText({ ...text, v: e.target.value })}
              className={`${s.ted} ${s['t' + text.st]}`} style={{ color: pv.fg, background: text.st === 0 ? pv.bg : undefined, textAlign: text.al === 'l' ? 'left' : text.al === 'r' ? 'right' : 'center', fontSize: 30 * text.size }} />
            <div className={s.row}>
              {COLORS.map((c) => <button key={c} type="button" aria-label={`สีตัวอักษร ${c}`} className={text.color === c ? s.on : ''} style={{ background: c }} onClick={() => setText({ ...text, color: c })} />)}
            </div>
          </div>
        )
      })()}
      {panel === 'stk' && (
        <div className={s.dsheet} role="dialog" aria-label="สติกเกอร์">
          <div className={s.grab} /><button type="button" className={s.dclose} aria-label="ปิดแผง" onClick={() => setPanel(null)}><Icon name="x" size={20} color="#fff" /></button>
          <input className={s.dsearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสติกเกอร์" aria-label="ค้นหาสติกเกอร์" />
          <div className={s.stkg}>{STICKERS.filter(([, l]) => !q || l.includes(q)).map(([e, l, act]) => (
            <button key={l} type="button" className={act === 'link' ? s.hl : ''} onClick={() => {
              if (act === 'link') { setQ(''); setPanel('prod') } else if (act === 'mention') { setQ(''); setPanel('men') } else if (act === 'hash') { setPanel(null); setText({ v: '#', color: '#ffffff', st: 2, al: 'c', size: 1 }) }
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
          <b style={{ display: 'block', fontSize: 17, marginBottom: 4 }}>ลิงก์ไปที่ผลงานของคุณ</b><small style={{ color: '#aaa', fontSize: 13 }}>ไม่ใส่ก็ได้ · คนดูกดแล้วไปหน้าผลงานบน {BRAND}</small>
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
