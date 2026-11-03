import { useEffect, useRef } from 'react'
import { SPRING, peekUnder, reducedMotion, skipNextTransition, takeSlideIn, zoomIn, zoomOut } from '../services/motion'

interface Opts {
  /** shared-element key, e.g. `p:<id>` */
  zoomKey: string
  /** element in this page that matches the thumbnail (hero image) */
  target?: () => Element | null
  /** leave the page (normally history back) */
  onClose: () => void
  /** neighbour in the list it was opened from: return true if it navigated */
  onSwipe?: (dir: 1 | -1) => boolean
  hasNeighbour?: (dir: 1 | -1) => boolean
  disabled?: boolean
}

/** Detail page motion: zoom in from the grid card, swipe down to shrink back into it, swipe sideways for the next item.
 *  Touch only (mouse users have the back button); runs at 60fps by writing transforms directly in rAF. */
export function useDetailGestures(anchor: React.RefObject<HTMLElement | null>, o: Opts) {
  const opts = useRef(o)
  opts.current = o
  useEffect(() => {
    if (o.disabled) return
    const layer = anchor.current?.closest<HTMLElement>('.layer')
    if (!layer) return
    // entrance: slide in after a sideways swipe, otherwise zoom out of the thumbnail
    const dir = takeSlideIn()
    if (dir && !reducedMotion()) {
      layer.classList.remove('l-zoom-in')
      layer.animate([{ transform: `translate3d(${dir * 100}%,0,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: 340, easing: SPRING })
    } else {
      requestAnimationFrame(() => zoomIn(layer, opts.current.zoomKey, opts.current.target?.()))
    }
    const sc = layer.querySelector<HTMLElement>('.lsc')
    const W = () => layer.clientWidth, H = () => layer.clientHeight
    let g: null | { x0: number; y0: number; t0: number; dx: number; dy: number; mode: '' | 'down' | 'side' | 'none'; raf: number } = null
    const paint = () => {
      if (!g) return
      g.raf = 0
      if (g.mode === 'down') {
        const p = Math.min(1, Math.max(0, g.dy) / H())
        layer.style.transform = `translate3d(${g.dx * 0.6}px,${Math.max(0, g.dy)}px,0) scale(${1 - p * 0.45})`
      } else if (g.mode === 'side') {
        const d = g.dx < 0 ? -1 : 1
        const can = opts.current.hasNeighbour?.(d === -1 ? 1 : -1)
        layer.style.transform = `translate3d(${can ? g.dx : g.dx * 0.25}px,0,0)`
      }
    }
    const inHScroll = (el: EventTarget | null, dx: number) => {
      let n = el as HTMLElement | null
      while (n && n !== layer) {
        if (n.scrollWidth > n.clientWidth + 2 && getComputedStyle(n).overflowX !== 'hidden') {
          if (dx < 0 && n.scrollLeft + n.clientWidth < n.scrollWidth - 2) return true
          if (dx > 0 && n.scrollLeft > 2) return true
        }
        n = n.parentElement
      }
      return false
    }
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || reducedMotion() || layer.dataset.active !== '1') { g = null; return }
      const t = e.touches[0]
      if (t.clientX < 24) return // left edge belongs to the iOS swipe-back
      g = { x0: t.clientX, y0: t.clientY, t0: performance.now(), dx: 0, dy: 0, mode: '', raf: 0 }
    }
    const move = (e: TouchEvent) => {
      if (!g || g.mode === 'none') return
      const t = e.touches[0]
      g.dx = t.clientX - g.x0; g.dy = t.clientY - g.y0
      if (!g.mode) {
        const ax = Math.abs(g.dx), ay = Math.abs(g.dy)
        if (ay < 10 && ax < 10) return
        if (g.dy > 0 && ay > ax && (sc?.scrollTop ?? 0) <= 0) { g.mode = 'down'; layer.classList.add('dismissing'); peekUnder(true) }
        else if (ax > ay * 1.2 && opts.current.onSwipe && !inHScroll(e.target, g.dx)) g.mode = 'side'
        else { g.mode = 'none'; return }
        layer.style.transition = 'none'
        g.x0 = t.clientX; g.y0 = t.clientY; g.dx = 0; g.dy = 0
      }
      e.preventDefault()
      if (!g.raf) g.raf = requestAnimationFrame(paint)
    }
    const springBack = () => {
      const from = layer.style.transform
      const a = layer.animate([{ transform: from }, { transform: 'translate3d(0,0,0) scale(1)' }], { duration: 380, easing: SPRING })
      layer.style.transform = ''
      a.onfinish = () => { layer.classList.remove('dismissing'); peekUnder(false) }
    }
    const end = () => {
      if (!g) return
      const G = g; g = null
      if (G.raf) cancelAnimationFrame(G.raf)
      if (G.mode !== 'down' && G.mode !== 'side') return
      const dt = Math.max(1, performance.now() - G.t0)
      if (G.mode === 'down') {
        const v = G.dy / dt
        if (G.dy > 110 || (v > 0.6 && G.dy > 30)) {
          skipNextTransition()
          void zoomOut(layer, opts.current.zoomKey, layer.style.transform, { target: opts.current.target?.() }).then(() => opts.current.onClose())
        } else springBack()
        return
      }
      const d: 1 | -1 = G.dx < 0 ? 1 : -1
      const v = Math.abs(G.dx) / dt
      if ((Math.abs(G.dx) > W() * 0.28 || v > 0.5) && opts.current.hasNeighbour?.(d)) {
        const a = layer.animate([{ transform: layer.style.transform }, { transform: `translate3d(${-d * W()}px,0,0)` }], { duration: 200, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' })
        a.onfinish = () => { skipNextTransition(); opts.current.onSwipe?.(d) }
      } else {
        const a = layer.animate([{ transform: layer.style.transform }, { transform: 'translate3d(0,0,0)' }], { duration: 360, easing: SPRING })
        layer.style.transform = ''
        a.onfinish = () => { layer.style.transition = '' }
      }
    }
    layer.addEventListener('touchstart', start, { passive: true })
    layer.addEventListener('touchmove', move, { passive: false })
    layer.addEventListener('touchend', end)
    layer.addEventListener('touchcancel', end)
    return () => {
      layer.removeEventListener('touchstart', start)
      layer.removeEventListener('touchmove', move)
      layer.removeEventListener('touchend', end)
      layer.removeEventListener('touchcancel', end)
    }
  }, [anchor, o.disabled])
}
