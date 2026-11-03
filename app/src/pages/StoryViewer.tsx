import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Av, Sheet, copyText } from '../components/ui'
import type { StoryActivity } from '../data/appTypes'
import { heroOf } from '../data/productExtras'
import { ME, baht, creatorById, imgUrl, productById } from '../data/sampleData'
import type { Story, StorySlide } from '../data/types'
import { follows, stories } from '../services/api'
import { useDb } from '../services/db'
import { SPRING, peekUnder, reducedMotion, skipNextTransition, spring, zoomIn, zoomOut } from '../services/motion'
import { markStorySeen } from '../services/seenStories'
import { storyGroups } from '../services/storyGroups'
import { toast } from '../services/toast'
import { STORY_EMOJI } from '../social/reactions'
import { ovlKind } from '../social/storyCanvas'
import { ago } from '../utils/time'
import s from '../social/Social.module.css'

const IMG_MS = 5000
const HINT_KEY = 'lumi_story_hint'
const HOLD_MS = 220
const mediaUrl = (m: string) => (/^(data:|blob:|https?:)/.test(m) ? m : imgUrl(m))
/** What a slide shows: its own picture/clip, or (sample stories) the work's picture. */
const bgOf = (sl: StorySlide) => {
  if (sl.media) return mediaUrl(sl.media)
  const p = sl.productId ? productById(sl.productId) : undefined
  return p ? imgUrl(heroOf(p)) : undefined
}
const close = (nav: ReturnType<typeof useNavigate>) => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/', { replace: true }))

/** Full-screen stories (Instagram-like). Zooms out of the ring, follow-the-finger cube between people,
 *  swipe down to shrink back into the ring, hold to pause, smooth progress, 24 h expiry (server / storyGroups). */
export function StoryViewer() {
  const { creatorId = '' } = useParams()
  const db = useDb()
  // the list is frozen when the viewer opens so it doesn't reshuffle while you watch
  const live = storyGroups(db)
  const [order] = useState(() => live.map((g) => g.creatorId))
  const groups = order.map((id) => live.find((g) => g.creatorId === id)).filter(Boolean) as Story[]
  const start = groups.findIndex((g) => g.creatorId === creatorId)
  if (start < 0) return <Navigate to="/" replace />
  return <Viewer groups={groups} start={start} />
}

function Viewer({ groups, start }: { groups: Story[]; start: number }) {
  const nav = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  const cube = useRef<HTMLDivElement>(null)
  const [gi, setGi] = useState(start)
  const [slideOf, setSlideOf] = useState<Record<string, number>>({})
  const [hint, setHint] = useState(() => !localStorage.getItem(HINT_KEY))
  const [held, setHeld] = useState(false)
  const [ui, setUi] = useState<null | 'more' | 'act' | 'typing'>(null)
  const pos = useRef(start) // continuous cube position (gi while idle)
  const anim = useRef<{ cancel: () => void } | null>(null)
  const g = groups[gi]

  // entrance: zoom out of the ring that was tapped
  useLayoutEffect(() => {
    const layer = root.current?.closest<HTMLElement>('.layer')
    zoomIn(layer ?? null, `s:${groups[start].creatorId}`, null, { fit: 'center' })
  }, [groups, start])
  useEffect(() => { markStorySeen(g.creatorId) }, [g.creatorId])

  const paint = (p: number) => {
    const faces = cube.current?.querySelectorAll<HTMLElement>('[data-face]')
    faces?.forEach((f) => {
      const o = Number(f.dataset.face) - p
      const vis = Math.abs(o) < 1.001
      f.style.visibility = vis ? 'visible' : 'hidden'
      if (!vis) return
      if (reducedMotion()) { f.style.transform = `translate3d(${o * 100}%,0,0)`; return }
      f.style.transformOrigin = o > 0 ? '0% 50%' : '100% 50%'
      f.style.transform = `translate3d(${o * 100}%,0,0) rotateY(${o * 90}deg)`
      f.style.filter = o === 0 ? '' : `brightness(${1 - Math.abs(o) * 0.45})`
    })
  }
  useLayoutEffect(() => { paint(pos.current) })

  const goGroup = (to: number, from = pos.current) => {
    anim.current?.cancel()
    if (to < 0) { pos.current = 0; paint(0); return }
    if (to >= groups.length) { void dismiss(); return }
    const done = () => { pos.current = to; paint(to); setGi(to) }
    if (reducedMotion()) return done()
    const sp = spring(from, to, (v) => { pos.current = v; paint(v) }, 0.16, 0.7)
    anim.current = sp
    let cancelled = false
    anim.current = { cancel: () => { cancelled = true; sp.cancel() } }
    void sp.done.then(() => { if (!cancelled) done() })
  }
  const dismiss = async (fromGesture = false) => {
    const layer = root.current?.closest<HTMLElement>('.layer')
    if (!layer) return close(nav)
    if (!fromGesture) { peekUnder(true); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) }
    skipNextTransition()
    await zoomOut(layer, `s:${groups[gi].creatorId}`, layer.style.transform, { fit: 'center' })
    close(nav)
  }

  // gestures: horizontal = cube between people (1:1 with the finger), down = shrink back to the ring, hold = pause
  const gs = useRef<null | { x0: number; y0: number; t0: number; mode: '' | 'x' | 'y' | 'no'; dx: number; dy: number; holdT: number; dragged: boolean; raf: number }>(null)
  const suppressClick = useRef(false)
  const onDown = (e: React.PointerEvent) => {
    if (ui || hint || (e.target as HTMLElement).closest('input,textarea,[data-nogest]')) return
    anim.current?.cancel(); pos.current = Math.round(pos.current) === gi ? pos.current : gi
    const holdT = window.setTimeout(() => { setHeld(true); suppressClick.current = true }, HOLD_MS)
    gs.current = { x0: e.clientX, y0: e.clientY, t0: performance.now(), mode: '', dx: 0, dy: 0, holdT, dragged: false, raf: 0 }
    suppressClick.current = false
  }
  const onMove = (e: React.PointerEvent) => {
    const G = gs.current; if (!G || G.mode === 'no') return
    G.dx = e.clientX - G.x0; G.dy = e.clientY - G.y0
    if (!G.mode) {
      if (Math.abs(G.dx) < 8 && Math.abs(G.dy) < 8) return
      clearTimeout(G.holdT); setHeld(true); suppressClick.current = true; G.dragged = true
      G.mode = Math.abs(G.dx) > Math.abs(G.dy) ? 'x' : G.dy > 0 ? 'y' : 'no'
      if (G.mode === 'no') { setHeld(false); return }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      if (G.mode === 'y') { peekUnder(true); root.current?.closest('.layer')?.classList.add('dismissing') }
      G.x0 = e.clientX; G.y0 = e.clientY; G.dx = 0; G.dy = 0
    }
    if (G.raf) return
    G.raf = requestAnimationFrame(() => {
      G.raf = 0
      const W = root.current?.clientWidth ?? 390, H = root.current?.clientHeight ?? 844
      if (G.mode === 'x') {
        let p = gi - G.dx / W
        if (p < 0) p = p * 0.3; if (p > groups.length - 1) p = groups.length - 1 + (p - groups.length + 1) * 0.3
        pos.current = p; paint(p)
      } else if (G.mode === 'y') {
        const layer = root.current?.closest<HTMLElement>('.layer')
        const dy = Math.max(0, G.dy), k = Math.min(1, dy / H)
        if (layer) { layer.style.transform = `translate3d(${G.dx * 0.5}px,${dy}px,0) scale(${1 - k * 0.5})`; layer.style.borderRadius = '24px' }
      }
    })
  }
  const onUp = () => {
    const G = gs.current; gs.current = null
    if (!G) return
    clearTimeout(G.holdT); if (G.raf) cancelAnimationFrame(G.raf)
    setHeld(false)
    const dt = Math.max(1, performance.now() - G.t0)
    if (G.mode === 'x') {
      const W = root.current?.clientWidth ?? 390, v = G.dx / dt
      let to = gi
      if (G.dx < -W * 0.25 || v < -0.45) to = gi + 1
      else if (G.dx > W * 0.25 || v > 0.45) to = gi - 1
      to = Math.max(0, to)
      if (to >= groups.length) { goGroup(groups.length - 1); return }
      goGroup(to)
    } else if (G.mode === 'y') {
      const layer = root.current?.closest<HTMLElement>('.layer')
      if (G.dy > 110 || (G.dy / dt > 0.6 && G.dy > 30)) void dismiss(true)
      else if (layer) {
        const a = layer.animate([{ transform: layer.style.transform, borderRadius: '24px' }, { transform: 'translate3d(0,0,0) scale(1)', borderRadius: '0px' }], { duration: 380, easing: SPRING })
        layer.style.transform = ''; layer.style.borderRadius = ''
        a.onfinish = () => { layer.classList.remove('dismissing'); peekUnder(false) }
      }
    }
  }

  const near = [gi - 1, gi, gi + 1].filter((i) => i >= 0 && i < groups.length)
  return (
    <div ref={root} className={s.dark} style={{ perspective: 1100, touchAction: 'none' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onClickCapture={(e) => { if (suppressClick.current && !(e.target as HTMLElement).closest('[data-nogest]')) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false } }}>
      <div ref={cube} style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
        {near.map((i) => (
          <div key={groups[i].creatorId} data-face={i} style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', willChange: 'transform' }} aria-hidden={i !== gi}>
            <Face g={groups[i]} active={i === gi} paused={held || !!ui || hint} hideUi={held}
              slide={slideOf[groups[i].creatorId] ?? 0} setSlide={(n) => setSlideOf((m) => ({ ...m, [groups[i].creatorId]: n }))}
              onNextGroup={() => goGroup(gi + 1)} onPrevGroup={() => goGroup(gi - 1)} onClose={() => void dismiss()} ui={ui} setUi={setUi} />
          </div>
        ))}
      </div>
      {hint && (
        <>
          <div className={s.hint} role="dialog" aria-label="วิธีดูสตอรี่">
            <div><i>👈</i>แตะซ้าย<br />ย้อนกลับ</div><div><i>✋</i>กดค้าง<br />หยุดดู</div><div><i>👉</i>แตะขวา<br />ถัดไป</div>
          </div>
          <button type="button" className={s.hintOk} data-nogest onClick={() => { localStorage.setItem(HINT_KEY, '1'); setHint(false) }}>เข้าใจแล้ว</button>
        </>
      )}
    </div>
  )
}

function Face({ g, active, paused, hideUi, slide, setSlide, onNextGroup, onPrevGroup, onClose, ui, setUi }: {
  g: Story; active: boolean; paused: boolean; hideUi: boolean; slide: number; setSlide: (n: number) => void
  onNextGroup: () => void; onPrevGroup: () => void; onClose: () => void; ui: null | 'more' | 'act' | 'typing'; setUi: (v: null | 'more' | 'act' | 'typing') => void
}) {
  const db = useDb()
  const c = creatorById(g.creatorId)
  const i = Math.min(slide, g.slides.length - 1)
  const sl = g.slides[i]
  const mine = g.creatorId === ME
  const p = sl.productId ? productById(sl.productId) : undefined
  const bg = bgOf(sl)
  const isVid = sl.kind === 'video'
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [floats, setFloats] = useState<{ id: number; e: string }[]>([])
  const [act, setAct] = useState<Record<string, StoryActivity[]>>({})
  const bar = useRef<HTMLElement>(null)
  const vid = useRef<HTMLVideoElement>(null)
  const elapsed = useRef(0)
  const myRx = sl.storyId ? db.storyReactions?.[sl.storyId] : undefined
  const dur = isVid ? (sl.durationMs ?? IMG_MS) : IMG_MS

  useEffect(() => { setLoaded(false); elapsed.current = 0; if (bar.current) bar.current.style.width = '0%' }, [g.creatorId, i])
  useEffect(() => { if (active && sl.storyId && !mine) void stories.view(sl.storyId).catch(() => {}) }, [active, sl.storyId, mine])
  useEffect(() => { if (active && mine) { const ids = g.slides.map((x) => x.storyId).filter(Boolean) as string[]; if (ids.length) void stories.activity(ids).then(setAct) } }, [active, mine, g.slides])

  const next = () => (i < g.slides.length - 1 ? setSlide(i + 1) : onNextGroup())
  const prev = () => (i > 0 ? setSlide(i - 1) : onPrevGroup())

  // smooth progress: rAF writes the bar width directly; stops while held, a sheet is open or the media is loading
  const run = active && !paused && loaded
  useEffect(() => {
    const v = vid.current
    if (v) { if (run) void v.play().catch(() => {}); else v.pause() }
    if (!run) return
    let raf = 0, last = performance.now()
    const tick = (t: number) => {
      if (v && isVid && v.duration) elapsed.current = (v.currentTime / v.duration) * dur
      else elapsed.current += t - last
      last = t
      const k = Math.min(1, elapsed.current / dur)
      if (bar.current) bar.current.style.width = `${k * 100}%`
      if (k >= 1) { next(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })

  const burst = (e: string) => {
    const id = Date.now() + Math.random()
    setFloats((f) => [...f, { id, e }, { id: id + 0.1, e }, { id: id + 0.2, e }])
    setTimeout(() => setFloats((f) => f.filter((x) => Math.floor(x.id) !== Math.floor(id))), 1700)
  }
  const react = async (e: string) => {
    burst(e)
    try {
      if (sl.storyId) await stories.react(sl.storyId, myRx === e ? null : e)
      toast(myRx === e ? 'เอาความรู้สึกออกแล้ว' : `ส่ง ${e} ให้ ${c.name} แล้ว`)
    } catch (er) { toast((er as Error).message) }
  }
  const send = async () => {
    const t = text.trim(); if (!t) return
    try { await stories.reply(sl.storyId, g.creatorId, t); setText(''); setUi(null); (document.activeElement as HTMLElement | null)?.blur?.(); toast(`ส่งข้อความถึง ${c.name} แล้ว`) } catch (er) { toast((er as Error).message) }
  }
  const share = () => {
    if (p) { copyText(`${location.origin}${location.pathname}#/product/${p.id}`); toast('คัดลอกลิงก์ผลงานแล้ว') }
    else { copyText(`${location.origin}${location.pathname}#/story/${g.creatorId}`); toast('คัดลอกลิงก์สตอรี่แล้ว') }
  }
  const acts = sl.storyId ? act[sl.storyId] ?? [] : []
  const following = db.follows.includes(g.creatorId)
  const left = sl.expires ? Math.max(1, Math.ceil((sl.expires - Date.now()) / 3600e3)) : undefined
  const chrome = { opacity: hideUi ? 0 : 1, transition: 'opacity .2s' }

  return (
    <div className={s.dark} style={{ position: 'absolute' }}>
      {/* media: dark skeleton until it's ready, then fade in */}
      <div className={`${s.media} ${s.fullh} ${loaded ? '' : 'sk-dark'}`} style={{ background: !bg && p ? p.gradient : undefined }}>
        {bg && (isVid
          ? <video ref={vid} key={bg} src={bg} muted={!active} playsInline preload="auto" className={`img-fade ${loaded ? 'is-in' : ''}`} onLoadedData={() => setLoaded(true)} onError={() => setLoaded(true)} />
          : <img key={bg} src={bg} alt={sl.caption ?? ''} className={`img-fade ${loaded ? 'is-in' : ''}`} draggable={false} decoding="async"
            ref={(im) => { if (im?.complete && im.naturalWidth && !loaded) setLoaded(true) }} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />)}
        {!bg && <LoadedNow onReady={() => !loaded && setLoaded(true)} />}
      </div>
      <div className={s.shadeT} />
      {/* layers that were not burned into the picture (clips); mentions on pictures are tappable spots */}
      {sl.overlays?.map((o) => o.baked
        ? (o.t === 'mention' && o.uid ? <Link key={o.id} to={`/creator/${o.uid}`} className={s.hot} data-nogest aria-label={`ดูโปรไฟล์ ${o.text}`} style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }} /> : null)
        : <div key={o.id} className={`${s.ovl} ${s[ovlKind(o)]}`} style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: `translate(-50%,-50%) rotate(${o.r}deg) scale(${o.s})`, color: o.t === 'text' && o.color ? o.color : undefined, pointerEvents: 'none' }}>{o.text}</div>)}
      {!sl.media && sl.caption && <div className={`${s.ovl} ${s.t1}`} style={{ left: '50%', top: '40%', transform: 'translate(-50%,-50%)', fontSize: 22, whiteSpace: 'normal', width: '86%', textAlign: 'center', pointerEvents: 'none' }}>{sl.caption}</div>}

      <div className={s.bars} style={chrome}>
        {g.slides.map((_, k) => <i key={k}><b ref={k === i ? bar : undefined} style={{ width: k < i ? '100%' : k > i ? '0%' : undefined }} /></i>)}
      </div>
      <div className={s.vh} style={chrome}>
        <Link to={`/creator/${g.creatorId}`} data-nogest><span style={{ backgroundImage: `url(${imgUrl(c.avatar)})` }} /><b className="ell">{mine ? 'สตอรี่ของคุณ' : c.name}</b><small>{sl.at ? ago(sl.at, Date.now(), true) : sl.postedAgo.replace('ที่แล้ว', '')}</small></Link>
        <button type="button" className={s.vbtn} aria-label="ตัวเลือกสตอรี่" data-nogest onClick={() => setUi('more')}><Icon name="dots" size={22} color="#fff" /></button>
        <button type="button" className={s.vbtn} aria-label="ปิด" data-nogest onClick={onClose}><Icon name="x" size={24} color="#fff" /></button>
      </div>
      <button type="button" className={s.tapL} aria-label="ก่อนหน้า" onClick={prev} />
      <button type="button" className={s.tapR} aria-label="ถัดไป" onClick={next} />

      {p && (
        <Link to={`/product/${p.id}`} className={s.linkPill} data-nogest style={chrome} onClick={() => { if (sl.storyId) void stories.clicked(sl.storyId).catch(() => {}) }}>
          <img src={imgUrl(heroOf(p), true)} alt="" /><span><span style={{ display: 'block' }}>🛍️ {sl.linkLabel ?? 'ดูผลงาน'}</span><small>{p.title.slice(0, 26)} · {p.price ? baht(p.price) : 'ฟรี'}</small></span><Icon name="chev" size={16} />
        </Link>
      )}
      <div className={s.float}>{floats.map((f, k) => <i key={f.id} style={{ animationDelay: `${(k % 3) * 120}ms`, marginRight: (k % 3) * 18 }}>{f.e}</i>)}</div>

      {mine ? (
        <div className={s.mineBar} style={chrome}>
          <button type="button" data-nogest onClick={() => setUi('act')} aria-label="ดูคนที่ดูสตอรี่">👁 {acts.length} คนดู</button>
          <span style={{ flex: 1 }} />
          {left && <button type="button" data-nogest style={{ fontWeight: 600, fontSize: 13, minHeight: 44 }} onClick={() => toast(`สตอรี่นี้จะหายไปใน ${left} ชม.`)}>⏱ {left} ชม.</button>}
          <Link to="/story/new" className="press" data-nogest aria-label="สร้างสตอรี่ใหม่" style={{ height: 44, width: 44, borderRadius: 99, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={20} color="#fff" /></Link>
        </div>
      ) : (
        <>
          {(ui === 'typing' || !p) && active && (
            <div className={s.qr} style={chrome}>{STORY_EMOJI.map((e) => <button key={e} type="button" data-nogest aria-label={`ส่ง ${e}`} aria-pressed={myRx === e} onPointerDown={(ev) => ev.preventDefault()} onClick={() => void react(e)}>{e}</button>)}</div>
          )}
          <form className={s.reply} style={chrome} data-nogest onSubmit={(e) => { e.preventDefault(); void send() }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`ส่งข้อความถึง ${c.name}…`} aria-label={`ส่งข้อความถึง ${c.name}`} maxLength={500}
              onFocus={() => setUi('typing')} onClick={() => setUi('typing')} onBlur={() => setTimeout(() => setUi(null), 150)} tabIndex={active ? 0 : -1} />
            {text.trim()
              ? <button type="submit" aria-label="ส่งข้อความ" onPointerDown={(e) => e.preventDefault()}><Icon name="send" size={22} color="#fff" /></button>
              : <button type="button" aria-label="ส่งหัวใจ" aria-pressed={myRx === '❤️'} onClick={() => void react('❤️')}>{myRx === '❤️' ? '❤️' : '🤍'}</button>}
          </form>
        </>
      )}

      {active && (
        <Sheet open={ui === 'more'} onClose={() => setUi(null)} title={mine ? 'สตอรี่ของคุณ' : c.name}>
          {!mine && <button type="button" className="list-row" onClick={() => { void follows.toggle(g.creatorId).then((v) => toast(v ? `ติดตาม ${c.name} แล้ว` : `เลิกติดตาม ${c.name} แล้ว`), (e: Error) => toast(e.message)); setUi(null) }}>
            <Icon name="user" size={20} /><span className="grow">{following ? 'เลิกติดตาม' : '+ ติดตาม'}<small>{c.name}</small></span></button>}
          <button type="button" className="list-row" aria-label="แชร์" onClick={() => { share(); setUi(null) }}><Icon name="share" size={20} /><span className="grow">แชร์{p ? 'ผลงานในสตอรี่' : 'สตอรี่'}<small>คัดลอกลิงก์</small></span></button>
          {mine && sl.storyId && <button type="button" className="list-row" style={{ color: '#E5484D' }} onClick={() => { if (!confirm('ลบสตอรี่นี้?')) return; void stories.remove(sl.storyId!).then(() => { toast('ลบสตอรี่แล้ว'); setUi(null); if (g.slides.length <= 1) onClose(); else setSlide(Math.max(0, i - 1)) }, (e: Error) => toast(e.message)) }}>
            <Icon name="trash" size={20} color="#E5484D" /><span className="grow">ลบสตอรี่นี้</span></button>}
          {!mine && <button type="button" className="list-row" onClick={() => { setUi(null); toast('ส่งรายงานให้ทีม LUMI แล้ว · ขอบคุณที่ช่วยดูแลชุมชน') }}><Icon name="flag" size={20} /><span className="grow">รายงานสตอรี่</span></button>}
        </Sheet>
      )}
      {active && mine && ui === 'act' && (
        <>
          <div className={s.thumbs} data-nogest>{g.slides.map((x, k) => <button key={k} type="button" aria-label={`สตอรี่ที่ ${k + 1}`} className={k === i ? s.on : ''} style={{ backgroundImage: bgOf(x) && x.kind !== 'video' ? `url(${bgOf(x)})` : undefined }} onClick={() => setSlide(k)} />)}</div>
          <div className={s.vsheet} role="dialog" aria-label="คนที่ดูสตอรี่" data-nogest>
            <button type="button" className={s.vclose} aria-label="ปิดแผง" onClick={() => setUi(null)}><Icon name="x" size={20} /></button>
            <div className={s.vsH}>
              <span><b>{acts.length}</b>คนดู</span><span><b>{acts.filter((a) => a.emoji).length}</b>ความรู้สึก</span>
              <span><b>{acts.filter((a) => a.clicked).length}</b>กดลิงก์</span><span><b>{acts.filter((a) => a.replied).length}</b>ตอบกลับ</span>
            </div>
            {!sl.storyId && <p className="muted" style={{ padding: 16, fontSize: 13 }}>สตอรี่ตัวอย่าง · ยังไม่มีคนดูจริง</p>}
            {sl.storyId && !acts.length && <p className="muted" style={{ padding: 16, fontSize: 13 }}>ยังไม่มีใครดู</p>}
            {acts.map((a) => { const u = creatorById(a.userId); return (
              <div key={a.userId} className={s.vrow}><Av src={u.avatar} size={40} /><span style={{ minWidth: 0 }}><b>{u.name}</b><small>{ago(a.at)}{a.clicked ? ' · กดลิงก์ผลงาน' : ''}{a.replied ? ' · ตอบกลับ' : ''}</small></span>{a.emoji && <span className="e">{a.emoji}</span>}</div>) })}
            {left && <div className={s.exp}>⏱ หายไปใน {left} ชม.</div>}
          </div>
        </>
      )}
    </div>
  )
}

/** Slides with nothing to load (gradient only) are ready at once. */
function LoadedNow({ onReady }: { onReady: () => void }) {
  const r = useRef(onReady); r.current = onReady
  useEffect(() => { r.current() }, [])
  return null
}

