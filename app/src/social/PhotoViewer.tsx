import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { imgUrl } from '../data/sampleData'
import { reducedMotion } from '../services/motion'
import s from './Social.module.css'

const isVid = (u: string) => /^data:video|\.(mp4|webm|mov)(\?|#|$)/i.test(u)
const full = (u: string) => (/^(data:|blob:|https?:)/.test(u) ? u : imgUrl(u))
type Pt = { x: number; y: number }
type Z = { s: number; x: number; y: number }
const MAX = 4

/** Full-screen photo viewer (Instagram / Facebook style):
 *  opens by growing out of the tapped picture, swipe left/right between pictures (follows the finger, springs),
 *  pinch to zoom (around the fingers), double-tap to zoom in/out, drag a zoomed picture, swipe down to close
 *  (the picture shrinks back into the post), tap to show/hide the counter. */
export function PhotoViewer({ srcs, start, origin, onClose }: { srcs: string[]; start: number; origin?: () => HTMLElement | null; onClose: (last: number) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(start)
  const [chrome, setChrome] = useState(true)
  const idx = useRef(start)
  const z = useRef<Z>({ s: 1, x: 0, y: 0 })
  const pts = useRef(new Map<number, Pt>())
  const g = useRef<null | { mode: '' | 'x' | 'y' | 'pan' | 'pinch'; p0: Pt; t0: number; z0: Z; d0: number; m0: Pt; dx: number; dy: number }>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)
  const tapT = useRef(0)
  const closing = useRef(false)
  const W = () => root.current?.clientWidth ?? window.innerWidth
  const H = () => root.current?.clientHeight ?? window.innerHeight
  const img = (k = idx.current) => track.current?.querySelector<HTMLElement>(`[data-k="${k}"] .pv-m`) ?? null

  // size of the picture when it is fitted to the screen (contain)
  const fitted = (k = idx.current) => {
    const el = img(k) as HTMLImageElement | HTMLVideoElement | null
    const nw = (el as HTMLImageElement)?.naturalWidth || (el as HTMLVideoElement)?.videoWidth || W()
    const nh = (el as HTMLImageElement)?.naturalHeight || (el as HTMLVideoElement)?.videoHeight || H()
    const f = Math.min(W() / nw, H() / nh)
    return { w: nw * f, h: nh * f }
  }
  const bounds = (sc: number) => { const f = fitted(); return { x: Math.max(0, (f.w * sc - W()) / 2), y: Math.max(0, (f.h * sc - H()) / 2) } }
  const paintZ = (v: Z, anim = false) => {
    const el = img(); if (!el) return
    el.style.transition = anim ? 'transform .32s cubic-bezier(.2,1,.3,1)' : 'none'
    el.style.transform = `translate3d(${v.x}px,${v.y}px,0) scale(${v.s})`
  }
  const paintTrack = (dx: number, anim = false) => {
    const t = track.current; if (!t) return
    t.style.transition = anim ? 'transform .38s cubic-bezier(.2,1,.3,1)' : 'none'
    t.style.transform = `translate3d(${-idx.current * W() + dx}px,0,0)`
  }
  const setBg = (a: number) => { if (bg.current) bg.current.style.opacity = String(a) }

  // grow out of the tapped picture
  useLayoutEffect(() => {
    paintTrack(0)
    const from = origin?.()?.getBoundingClientRect(), el = img()
    if (!from || !el || reducedMotion()) return
    const run = () => {
      const f = fitted(), cx = W() / 2, cy = H() / 2
      const sc = Math.max(from.width / f.w, from.height / f.h)
      const tx = from.left + from.width / 2 - cx, ty = from.top + from.height / 2 - cy
      el.animate([{ transform: `translate3d(${tx}px,${ty}px,0) scale(${sc})` }, { transform: 'translate3d(0,0,0) scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,1,.3,1)' })
      bg.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 })
    }
    if ((el as HTMLImageElement).complete === false) el.addEventListener('load', run, { once: true }); else run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(idx.current + 1); if (e.key === 'ArrowLeft') go(idx.current - 1) }
    const rs = () => paintTrack(0)
    window.addEventListener('keydown', k); window.addEventListener('resize', rs)
    document.documentElement.classList.add('pv-open')
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('resize', rs); document.documentElement.classList.remove('pv-open') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to: number) => {
    to = Math.max(0, Math.min(srcs.length - 1, to))
    if (to !== idx.current) { z.current = { s: 1, x: 0, y: 0 }; paintZ(z.current); idx.current = to; setI(to) }
    paintTrack(0, true)
  }
  const close = (fromY = 0) => {
    if (closing.current) return; closing.current = true
    const el = img(), to = origin?.()?.getBoundingClientRect()
    const done = () => onClose(idx.current)
    if (!el || reducedMotion()) return done()
    const f = fitted(), cur = el.style.transform || 'none'
    const end = to && to.width > 0 && idx.current === start
      ? `translate3d(${to.left + to.width / 2 - W() / 2}px,${to.top + to.height / 2 - H() / 2}px,0) scale(${Math.max(to.width / f.w, to.height / f.h)})`
      : `translate3d(0,${fromY > 0 ? H() : 0}px,0) scale(${fromY > 0 ? 0.6 : 0.9})`
    const a = el.animate([{ transform: cur }, { transform: end, opacity: to ? 1 : 0 }], { duration: 260, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' })
    bg.current?.animate([{ opacity: bg.current.style.opacity || 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' })
    a.onfinish = done
  }

  const zoomAt = (p: Pt, sc: number) => {
    const c = { x: p.x - W() / 2, y: p.y - H() / 2 }, o = z.current
    const k = sc / o.s
    let x = c.x - (c.x - o.x) * k, y = c.y - (c.y - o.y) * k
    const b = bounds(sc); x = Math.max(-b.x, Math.min(b.x, x)); y = Math.max(-b.y, Math.min(b.y, y))
    z.current = sc <= 1 ? { s: 1, x: 0, y: 0 } : { s: sc, x, y }
    paintZ(z.current, true)
  }
  const tap = (p: Pt) => {
    const now = performance.now(), L = lastTap.current
    if (L && now - L.t < 280 && Math.hypot(p.x - L.x, p.y - L.y) < 40) {
      clearTimeout(tapT.current); lastTap.current = null
      zoomAt(p, z.current.s > 1.05 ? 1 : 2.5)
      return
    }
    lastTap.current = { t: now, ...p }
    tapT.current = window.setTimeout(() => setChrome((v) => !v), 290)
  }

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-pvbtn]')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const list = [...pts.current.values()]
    if (list.length >= 2) {
      const [a, b] = list
      g.current = { mode: 'pinch', p0: a, t0: performance.now(), z0: { ...z.current }, d0: Math.hypot(b.x - a.x, b.y - a.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dx: 0, dy: 0 }
      paintTrack(0, true)
    } else {
      g.current = { mode: '', p0: { x: e.clientX, y: e.clientY }, t0: performance.now(), z0: { ...z.current }, d0: 0, m0: { x: 0, y: 0 }, dx: 0, dy: 0 }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const G = g.current; if (!G) return
    if (G.mode === 'pinch') {
      const [a, b] = [...pts.current.values()]; if (!b) return
      const d = Math.hypot(b.x - a.x, b.y - a.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      let sc = G.z0.s * (d / Math.max(1, G.d0))
      if (sc > MAX) sc = MAX + (sc - MAX) * 0.25
      if (sc < 1) sc = 1 - (1 - sc) * 0.45
      const c0 = { x: G.m0.x - W() / 2, y: G.m0.y - H() / 2 }, k = sc / G.z0.s
      z.current = { s: sc, x: c0.x - (c0.x - G.z0.x) * k + (m.x - G.m0.x), y: c0.y - (c0.y - G.z0.y) * k + (m.y - G.m0.y) }
      paintZ(z.current); setBg(Math.min(1, sc))
      return
    }
    G.dx = e.clientX - G.p0.x; G.dy = e.clientY - G.p0.y
    if (!G.mode) {
      if (Math.hypot(G.dx, G.dy) < 7) return
      G.mode = z.current.s > 1.02 ? 'pan' : Math.abs(G.dx) > Math.abs(G.dy) ? 'x' : 'y'
      clearTimeout(tapT.current); setChrome(false)
    }
    if (G.mode === 'pan') {
      const b = bounds(z.current.s), rub = (v: number, m: number) => (v > m ? m + (v - m) * 0.3 : v < -m ? -m + (v + m) * 0.3 : v)
      const x = G.z0.x + G.dx
      // past the edge of a zoomed picture → hand over to the carousel like Instagram
      if (srcs.length > 1 && ((x > b.x + 40 && idx.current > 0) || (x < -b.x - 40 && idx.current < srcs.length - 1))) {
        G.mode = 'x'; G.p0 = { x: e.clientX - (x > 0 ? x - b.x : x + b.x), y: e.clientY }; return
      }
      z.current = { s: z.current.s, x: rub(x, b.x), y: rub(G.z0.y + G.dy, b.y) }
      paintZ(z.current)
    } else if (G.mode === 'x') {
      let dx = G.dx
      if ((idx.current === 0 && dx > 0) || (idx.current === srcs.length - 1 && dx < 0)) dx *= 0.3
      paintTrack(dx)
    } else if (G.mode === 'y') {
      const el = img(); if (!el) return
      const k = Math.min(1, Math.abs(G.dy) / H())
      el.style.transition = 'none'
      el.style.transform = `translate3d(${G.dx}px,${G.dy}px,0) scale(${1 - k * 0.35})`
      setBg(1 - k * 1.6)
    }
  }
  const onUp = (e: React.PointerEvent) => {
    const had = pts.current.delete(e.pointerId)
    const G = g.current; if (!G || !had) return
    if (G.mode === 'pinch') {
      if (pts.current.size) { const [a] = [...pts.current.values()]; g.current = { mode: z.current.s > 1.02 ? 'pan' : '', p0: a, t0: performance.now(), z0: { ...z.current }, d0: 0, m0: a, dx: 0, dy: 0 }; return }
      g.current = null
      const sc = Math.min(MAX, Math.max(1, z.current.s)), b = bounds(sc)
      z.current = sc <= 1.01 ? { s: 1, x: 0, y: 0 } : { s: sc, x: Math.max(-b.x, Math.min(b.x, z.current.x)), y: Math.max(-b.y, Math.min(b.y, z.current.y)) }
      paintZ(z.current, true); setBg(1)
      return
    }
    if (pts.current.size) return
    g.current = null
    const dt = Math.max(1, performance.now() - G.t0)
    if (!G.mode) { tap({ x: e.clientX, y: e.clientY }); return }
    if (G.mode === 'pan') { const b = bounds(z.current.s); z.current = { ...z.current, x: Math.max(-b.x, Math.min(b.x, z.current.x)), y: Math.max(-b.y, Math.min(b.y, z.current.y)) }; paintZ(z.current, true); return }
    if (G.mode === 'x') {
      const v = G.dx / dt
      if ((G.dx < -W() * 0.22 || v < -0.4) && idx.current < srcs.length - 1) go(idx.current + 1)
      else if ((G.dx > W() * 0.22 || v > 0.4) && idx.current > 0) go(idx.current - 1)
      else paintTrack(0, true)
      return
    }
    if (G.mode === 'y') {
      if (Math.abs(G.dy) > 120 || (Math.abs(G.dy) / dt > 0.6 && Math.abs(G.dy) > 40)) close(G.dy)
      else { paintZ({ s: 1, x: 0, y: 0 }, true); z.current = { s: 1, x: 0, y: 0 }; setBg(1); if (bg.current) bg.current.style.transition = 'opacity .3s' }
    }
  }

  return createPortal(
    <div ref={root} className={s.pv} role="dialog" aria-modal="true" aria-label={`รูปภาพ ${i + 1} จาก ${srcs.length}`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-zoom={z.current.s > 1.02 ? '1' : '0'}>
      <div ref={bg} className={s.pvBg} />
      <div ref={track} className={s.pvTrack}>
        {srcs.map((u, k) => (
          <div key={u + k} data-k={k} className={s.pvSlide} style={{ left: `${k * 100}%` }}>
            {Math.abs(k - i) <= 1 && (isVid(u)
              ? <video className="pv-m" src={full(u)} controls={k === i} playsInline autoPlay={k === i} muted />
              : <img className="pv-m" src={full(u)} alt={`รูปที่ ${k + 1}`} draggable={false} decoding="async" />)}
          </div>
        ))}
      </div>
      <div className={s.pvTop} style={{ opacity: chrome ? 1 : 0 }}>
        <button type="button" data-pvbtn aria-label="ปิดรูปภาพ" onClick={() => close()}>✕</button>
        {srcs.length > 1 && <span aria-live="polite">{i + 1} / {srcs.length}</span>}
      </div>
      {srcs.length > 1 && <div className={s.pvDots} style={{ opacity: chrome ? 1 : 0 }}>{srcs.map((_, k) => <i key={k} className={k === i ? s.on : ''} />)}</div>}
    </div>,
    document.body,
  )
}
