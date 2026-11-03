// Android / browser Back closes the top overlay (bottom sheet, photo viewer) instead of leaving the page — like the
// native apps. While an overlay is open it owns one same-URL history entry (tagged __ov); Back pops it → onClose.
// Closing by hand removes that entry again, so the history stays exactly as it was before the overlay opened.
import { useEffect, useRef } from 'react'

type Entry = { tag: string; close: () => void }
const stack: Entry[] = []
let skip = 0 // pops we caused ourselves (history.back() after a manual close)
const queue: (() => void)[] = [] // pushes waiting for our own back() to land first
let bound = false

const tagOf = () => (history.state as { __ov?: string } | null)?.__ov
function flush() { while (!skip && queue.length) queue.shift()!() }
function onPop() {
  if (skip) { skip--; flush(); return }
  const top = stack[stack.length - 1]
  const t = tagOf()
  if (top && t === top.tag) return // moved forward onto the open overlay's own entry
  if (top) { stack.pop(); top.close(); return }
  // landed on a leftover overlay entry (the overlay navigated away before it closed): step over it
  if (t) { skip++; history.back() }
}
function bind() {
  if (bound) return
  bound = true
  window.addEventListener('popstate', onPop)
  // a reload while an overlay was open leaves its entry as the current one: it is just the page now
  if (tagOf()) { const { __ov: _, ...rest } = history.state as Record<string, unknown>; history.replaceState(rest, '') } // eslint-disable-line @typescript-eslint/no-unused-vars
}

export function useBackClose(open: boolean, onClose: () => void) {
  const cb = useRef(onClose)
  cb.current = onClose
  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    bind()
    const e: Entry = { tag: Math.random().toString(36).slice(2), close: () => cb.current() }
    let pushed = false, gone = false
    const push = () => { if (gone) return; history.pushState({ ...(history.state ?? {}), __ov: e.tag }, ''); pushed = true }
    stack.push(e)
    if (skip) queue.push(push); else push()
    return () => {
      gone = true
      const i = stack.indexOf(e)
      if (i < 0) return // closed by Back: its entry is already gone
      stack.splice(i, 1)
      // wait a tick: if the app navigated while closing (e.g. delete → go to the feed), that page owns the entry now
      if (pushed) setTimeout(() => { if (tagOf() === e.tag) { skip++; history.back() } }, 0)
    }
  }, [open])
}

/** Resolves once a just-closed overlay has taken its history entry back. Await it between closing a sheet and
 *  navigating with replace / -1, otherwise that navigation lands on the sheet's entry instead of the page's. */
export function settle(): Promise<void> {
  return new Promise((res) => setTimeout(() => { if (skip) queue.push(() => res()); else res() }, 20))
}
