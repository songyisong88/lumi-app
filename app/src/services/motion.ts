/**
 * Pinterest-style shared-element motion.
 *  - `rememberOrigin(key, el)` on tap of a grid card / story ring stores where the item sits on screen.
 *  - The page that opens (product detail, story viewer) calls `zoomIn(layer, key, target)`: its whole layer
 *    grows out of that rect (uniform scale + rounded clip), so the thumbnail looks like it becomes the page.
 *  - `zoomOut(layer, key)` does the reverse into the slot of the item in the page underneath (`[data-zoom=key]`).
 *  - `peekUnder(true)` asks the Stage to render the previous page under the current one (for swipe-down dismiss).
 * Only transform / clip-path / opacity animate (compositor). prefers-reduced-motion → no zoom.
 */
type R = { x: number; y: number; w: number; h: number; r: number; t?: number }
const origins = new Map<string, R>()
let pending: { key: string; t: number } | null = null
let skipAt = 0
let context: { key: string; ids: string[] } | null = null

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const SPRING = 'cubic-bezier(.2,1.12,.32,1)' // ~ spring with a touch of overshoot
export const SPRING_MS = 360

const rectOf = (el: Element): R => {
  const b = el.getBoundingClientRect()
  return { x: b.left, y: b.top, w: b.width, h: b.height, r: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 }
}
export function rememberOrigin(key: string, el: Element | null) {
  if (!el || reducedMotion()) return
  origins.set(key, { ...rectOf(el), t: Date.now() }); pending = { key, t: Date.now() }
}
/** Stage: is this navigation a zoom? (render-phase safe: not consumed until `motionCommitted`) */
export const pendingZoom = () => !!pending && Date.now() - pending.t < 800
export const hasOrigin = (key: string) => origins.has(key)
/** Stage: next location change without its own animation (a gesture already animated it). */
export const skipNextTransition = () => { skipAt = Date.now() }
export const takeSkip = () => Date.now() - skipAt < 800
/** Stage, after a location change committed. */
export const motionCommitted = () => { pending = null; skipAt = 0 }
/** List the detail page can swipe through (the grid it was opened from). */
export const setSwipeContext = (key: string, ids: string[]) => { context = { key, ids } }
export const swipeContext = () => context

export function peekUnder(on: boolean) { window.dispatchEvent(new CustomEvent('stage:peek', { detail: on })) }

function frames(src: R, dst: R, W: number, H: number) {
  // the layer is scaled uniformly so `dst` (in layer coords) lands on `src` (screen coords)
  const s = src.w / dst.w
  const tx = src.x - dst.x * s, ty = src.y - dst.y * s
  const clipH = src.h / s
  const inset = `inset(${dst.y}px ${W - dst.x - dst.w}px ${Math.max(0, H - dst.y - clipH)}px ${dst.x}px round ${src.r / s}px)`
  return { transform: `translate3d(${tx}px,${ty}px,0) scale(${s})`, clipPath: inset }
}
const FULL = (r = 0) => ({ transform: 'translate3d(0,0,0) scale(1)', clipPath: `inset(0px 0px 0px 0px round ${r}px)` })

/** Grow `layer` from the remembered rect of `key`. `target` = the element in the layer that matches the thumbnail. */
export function zoomIn(layer: HTMLElement | null, key: string, target?: Element | null, opts: { fit?: 'width' | 'center' } = {}) {
  const src = origins.get(key)
  origins.delete(key)
  const fresh = !!layer?.classList.contains('l-zoom-in')
  layer?.classList.remove('l-zoom-in')
  // too late (slow chunk load, the fallback fade already showed the page) or not opened from a thumbnail
  if (!layer || !src || !fresh || reducedMotion() || Date.now() - (src.t ?? 0) > 450) return null
  const W = layer.clientWidth, H = layer.clientHeight
  let dst: R
  if (opts.fit === 'center') {
    // full-screen viewer: the circle maps onto a centered square crop
    dst = { x: 0, y: (H - W * (src.h / src.w)) / 2, w: W, h: W * (src.h / src.w), r: 0 }
  } else if (target) {
    const b = target.getBoundingClientRect(), L = layer.getBoundingClientRect()
    dst = { x: b.left - L.left, y: b.top - L.top, w: b.width, h: b.width * (src.h / src.w), r: 0 }
  } else dst = { x: 0, y: 0, w: W, h: W * (src.h / src.w), r: 0 }
  layer.style.transformOrigin = '0 0'
  const a = layer.animate([{ ...frames(src, dst, W, H), opacity: 1 }, { ...FULL(), opacity: 1 }], { duration: SPRING_MS, easing: SPRING })
  a.onfinish = () => { layer.style.transformOrigin = '' }
  return a
}

/** Shrink `layer` (already moved by a finger: `from` = its current transform) into the item's slot underneath. */
export function zoomOut(layer: HTMLElement, key: string, from: string, opts: { fit?: 'width' | 'center'; target?: Element | null } = {}) {
  const under = document.querySelector('.layer[data-under="1"]')
  const slot = under?.querySelector(`[data-zoom="${CSS.escape(key)}"]`)
  const W = layer.clientWidth, H = layer.clientHeight
  if (!slot || reducedMotion()) {
    return layer.animate([{ transform: from, opacity: 1 }, { transform: `${from} scale(.92)`, opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished
  }
  // Pinterest scrolls the grid so the card you leave to is on screen
  const b0 = slot.getBoundingClientRect()
  const usc = under?.querySelector<HTMLElement>('.lsc')
  if (usc && (b0.bottom < 60 || b0.top > window.innerHeight - 80)) usc.scrollTop += b0.top - window.innerHeight / 2 + b0.height / 2
  const src = rectOf(slot)
  if (src.r === 0 && opts.fit === 'center') src.r = src.w / 2
  let dst: R
  if (opts.fit === 'center') dst = { x: 0, y: (H - W * (src.h / src.w)) / 2, w: W, h: W * (src.h / src.w), r: 0 }
  else if (opts.target) {
    const b = opts.target.getBoundingClientRect(), L = layer.getBoundingClientRect(), k = L.width / W
    dst = { x: (b.left - L.left) / k, y: (b.top - L.top) / k, w: b.width / k, h: (b.width / k) * (src.h / src.w), r: 0 }
  } else dst = { x: 0, y: 0, w: W, h: W * (src.h / src.w), r: 0 }
  layer.style.transformOrigin = '0 0'
  // `from` was written with the default (center) origin: convert it by measuring the current box
  const L = layer.getBoundingClientRect(), k = L.width / W
  const start = { transform: `translate3d(${L.left}px,${L.top}px,0) scale(${k})`, clipPath: `inset(0px 0px 0px 0px round ${24 / k}px)` }
  layer.style.transform = start.transform
  ;(slot as HTMLElement).style.visibility = 'hidden'
  const a = layer.animate([start, frames(src, dst, W, H)], { duration: 340, easing: SPRING, fill: 'forwards' })
  return a.finished.then(() => { (slot as HTMLElement).style.visibility = '' })
}

/** Critically-damped-ish spring stepper for finger-follow release animations (60fps, rAF). */
export function spring(from: number, to: number, onStep: (v: number) => void, k = 0.22, d = 0.72) {
  let x = from, v = 0, raf = 0, stop = false
  const done = new Promise<void>((res) => {
    const tick = () => {
      if (stop) return res()
      v = (v + (to - x) * k) * d; x += v
      if (Math.abs(v) < 0.001 && Math.abs(to - x) < 0.001) { onStep(to); return res() }
      onStep(x); raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  })
  return { done, cancel: () => { stop = true; cancelAnimationFrame(raf) } }
}

let slideIn: { dir: number; t: number } | null = null
/** Horizontal swipe between items: the next page slides in from this side (1 = from the right). */
export const setSlideIn = (dir: number) => { slideIn = { dir, t: Date.now() } }
export const takeSlideIn = () => { const v = slideIn && Date.now() - slideIn.t < 1500 ? slideIn.dir : 0; slideIn = null; return v }
