/**
 * iOS-style navigation stage.
 * Every route renders in its own full-screen scroll layer. On navigation the old layer is
 * kept for one transition so it can slide/fade out:
 *   push  → new page slides in from the right, old page parallaxes 30% left under a shade
 *   pop   → reverse; also driven interactively by a swipe from the left edge
 *   fade  → tab switches (cross-fade), story viewer
 *   up / down → modal screens (composer, sell wizard) slide up from the bottom
 * Only transform + opacity are animated (compositor-only, 60fps). prefers-reduced-motion → instant.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useNavigationType, type Location } from 'react-router-dom'
import { motionCommitted, pendingZoom, takeSkip } from '../services/motion'

type Kind = 'push' | 'pop' | 'fade' | 'up' | 'down' | 'zoom' | 'none'
export const TAB_ROOTS = ['/', '/search', '/community', '/profile']
const MODAL = [/^\/community\/new/, /^\/sell(\/|$)/]
const FADE = [/^\/story\//]
const isModal = (p: string) => MODAL.some((r) => r.test(p))
const isFade = (p: string) => FADE.some((r) => r.test(p))
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function kindFor(from: string, to: string, nav: string): Kind {
  if (reduced()) return 'none'
  // grid card / story ring → detail: the new page zooms out of the thumbnail (it runs the animation itself)
  if (nav === 'PUSH' && pendingZoom()) return 'zoom'
  // tab bar switches are instant (no cross-fade flash); each tab keeps its own scroll position (scrollMem)
  if (TAB_ROOTS.includes(from) && TAB_ROOTS.includes(to)) return 'none'
  if (isFade(from) || isFade(to)) return 'fade'
  if (nav === 'POP') {
    if (isModal(from) && !isModal(to)) return 'down'
    return 'pop'
  }
  if (nav === 'REPLACE') return isModal(to) === isModal(from) ? 'fade' : isModal(to) ? 'up' : 'fade'
  if (isModal(to) && !isModal(from)) return 'up'
  return 'push'
}

const scrollMem = new Map<string, number>()
const memKey = (l: Location) => (TAB_ROOTS.includes(l.pathname) ? `tab:${l.pathname}` : l.key)

/** The scroll container of the visible page (pages don't scroll the window). */
export const pageScroller = () => document.querySelector<HTMLElement>('.layer[data-active="1"] > .lsc')
export const scrollPageTop = (smooth = false) => pageScroller()?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })

function Layer({ loc, render, cls, z, active, under }: { loc: Location; render: (l: Location) => ReactNode; cls: string; z: number; active: boolean; under?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const sc = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = sc.current!
    el.scrollTop = scrollMem.get(memKey(loc)) ?? 0
    const on = () => scrollMem.set(memKey(loc), el.scrollTop)
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [loc])
  return (
    <div ref={ref} className={`layer ${cls}`} style={{ zIndex: z }} data-active={active ? '1' : '0'} data-under={under ? '1' : undefined} data-path={loc.pathname} aria-hidden={!active}>
      <div ref={sc} className="lsc">{render(loc)}</div>
    </div>
  )
}

export function Stage({ render }: { render: (l: Location) => ReactNode }) {
  const location = useLocation()
  const navType = useNavigationType()
  const navigate = useNavigate()
  const [cur, setCur] = useState<Location>(location)
  const [exit, setExit] = useState<{ loc: Location; kind: Kind } | null>(null)
  const [under, setUnder] = useState<Location | null>(null)
  const [peek, setPeek] = useState(false)
  const skip = useRef(false)
  const stack = useRef<Location[]>([])
  const root = useRef<HTMLDivElement>(null)

  // derive transition state from the router location (render-phase update, React-sanctioned)
  if (location !== cur) {
    if (location.pathname === cur.pathname) {
      setCur(location)
    } else {
      const sk = skip.current || takeSkip()
      const k = sk ? 'none' : kindFor(cur.pathname, location.pathname, navType)
      setExit(k === 'none' ? null : { loc: cur, kind: k })
      setCur(location)
      if (sk) { setUnder(null); setPeek(false) }
      skip.current = false
    }
  }

  // keep our own copy of the history stack so the swipe-back gesture can show the page underneath
  useEffect(() => {
    // idx can be missing or NaN (page reached by a typed / plain-link hash change, then a sheet's history entry):
    // never let it reach Array.length, that throws and blanks the app
    const raw = window.history.state?.idx as unknown
    const idx = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0
    stack.current[idx] = location
    if (navType === 'PUSH') stack.current.length = idx + 1
  }, [location, navType])

  // end of transition: drop the old layer
  useEffect(() => {
    if (!exit) return
    const h = window.setTimeout(() => setExit(null), exit.kind === 'fade' ? 260 : exit.kind === 'zoom' ? 420 : 480)
    return () => clearTimeout(h)
  }, [exit])

  // clear inline gesture styles once the new page is current
  useLayoutEffect(() => {
    motionCommitted()
    root.current?.querySelectorAll<HTMLElement>('.layer').forEach((el) => { el.style.transform = ''; el.style.transition = '' })
    const sh = root.current?.querySelector<HTMLElement>('.shade-g')
    if (sh) { sh.style.opacity = ''; sh.style.transition = '' }
  }, [cur])

  // swipe-down dismiss (detail page / story viewer): show the previous page, untransformed, underneath
  useEffect(() => {
    const on = (e: Event) => {
      const want = (e as CustomEvent<boolean>).detail
      // idx can be missing or NaN (page reached by a typed / plain-link hash change, then a sheet's history entry):
    // never let it reach Array.length, that throws and blanks the app
    const raw = window.history.state?.idx as unknown
    const idx = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0
      const prev = idx > 0 ? stack.current[idx - 1] : undefined
      if (want && prev && !exit) { setUnder(prev); setPeek(true) } else if (!want) { setUnder(null); setPeek(false) }
    }
    window.addEventListener('stage:peek', on)
    return () => window.removeEventListener('stage:peek', on)
  }, [exit])

  // interactive edge swipe back (touch only)
  useEffect(() => {
    const el = root.current!
    let g: { x0: number; y0: number; t0: number; dx: number; locked: boolean } | null = null
    const W = () => window.innerWidth
    const els = () => ({
      top: el.querySelector<HTMLElement>('.layer[data-active="1"]'),
      bot: el.querySelector<HTMLElement>('.layer[data-under="1"]'),
      sh: el.querySelector<HTMLElement>('.shade-g'),
    })
    const prev = () => {
      // idx can be missing or NaN (page reached by a typed / plain-link hash change, then a sheet's history entry):
    // never let it reach Array.length, that throws and blanks the app
    const raw = window.history.state?.idx as unknown
    const idx = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0
      return idx > 0 ? stack.current[idx - 1] : undefined
    }
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || exit || reduced()) return
      const t = e.touches[0]
      if (t.clientX > 22 || !prev() || TAB_ROOTS.includes(cur.pathname)) return
      g = { x0: t.clientX, y0: t.clientY, t0: performance.now(), dx: 0, locked: false }
    }
    const move = (e: TouchEvent) => {
      if (!g) return
      const t = e.touches[0]
      const dx = t.clientX - g.x0, dy = t.clientY - g.y0
      if (!g.locked) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return }
        if (dx > 8) { g.locked = true; setUnder(prev()!) } else return
      }
      e.preventDefault()
      g.dx = Math.max(0, dx)
      const { top, bot, sh } = els()
      if (top) { top.style.transition = 'none'; top.style.transform = `translate3d(${g.dx}px,0,0)` }
      if (bot) { bot.style.transition = 'none'; bot.style.transform = `translate3d(${-0.3 * W() + g.dx * 0.3}px,0,0)` }
      if (sh) { sh.style.transition = 'none'; sh.style.opacity = String(1 - g.dx / W()) }
    }
    const end = () => {
      if (!g) return
      const { dx, t0, locked } = g
      g = null
      if (!locked) return
      const v = dx / Math.max(1, performance.now() - t0)
      const done = dx > W() * 0.35 || v > 0.45
      const { top, bot, sh } = els()
      const ease = 'transform .28s cubic-bezier(.2,.8,.2,1)'
      if (top) { top.style.transition = ease; top.style.transform = done ? `translate3d(${W()}px,0,0)` : 'translate3d(0,0,0)' }
      if (bot) { bot.style.transition = ease; bot.style.transform = done ? 'translate3d(0,0,0)' : `translate3d(${-0.3 * W()}px,0,0)` }
      if (sh) { sh.style.transition = 'opacity .28s'; sh.style.opacity = done ? '0' : '1' }
      window.setTimeout(() => {
        if (done) { skip.current = true; navigate(-1) } else setUnder(null)
      }, 290)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [cur, exit, navigate])

  const k = exit?.kind
  const back = k === 'pop' || k === 'down'
  // zoom: the old page stays still underneath while the new one grows from the thumbnail
  const layers: { loc: Location; cls: string; z: number; active: boolean; under?: boolean }[] = []
  if (under && under.pathname !== cur.pathname) layers.push({ loc: under, cls: peek ? 'l-peek' : 'l-under', z: 1, active: false, under: true })
  if (exit) layers.push({ loc: exit.loc, cls: `l-${k}-out`, z: back ? 3 : 1, active: false })
  layers.push({ loc: cur, cls: exit ? `l-${k}-in` : '', z: back ? 1 : 3, active: true })

  return (
    <div ref={root} className="stage">
      {layers.map((l) => <Layer key={l.loc.pathname} render={render} {...l} />)}
      {exit && (k === 'push' || k === 'pop') && <div className={`shade ${k === 'push' ? 'shade-in' : 'shade-out'}`} style={{ zIndex: 2 }} />}
      {exit && (k === 'up' || k === 'down') && <div className={`shade ${k === 'up' ? 'shade-in' : 'shade-out'}`} style={{ zIndex: 2 }} />}
      {under && !peek && <div className="shade shade-g" style={{ zIndex: 2 }} />}
    </div>
  )
}
