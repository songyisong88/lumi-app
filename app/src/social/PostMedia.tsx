import { useEffect, useRef, useState } from 'react'
import { Img } from '../components/ui'
import { PhotoViewer } from './PhotoViewer'
import s from './Social.module.css'

const isVid = (u: string) => /^data:video|\.(mp4|webm|mov)(\?|#|$)/i.test(u)

/** Pictures of a post, Instagram style: one picture at its own shape (4:5 … 1.91:1), several = a swipe carousel
 *  with dots and a 1/3 counter. Tap = full-screen viewer at that picture, double-tap = like (big heart). */
export function PostMedia({ srcs, onDoubleLike, label }: { srcs: string[]; onDoubleLike?: () => void; label?: string }) {
  const sc = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const [ratio, setRatio] = useState<number>(1)
  const [counter, setCounter] = useState(true)
  const last = useRef<{ t: number; x: number; y: number } | null>(null)
  const tapT = useRef(0)
  const moved = useRef(false)
  const p0 = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => () => clearTimeout(tapT.current), [])
  // the counter fades after a moment like Instagram, and comes back while swiping
  useEffect(() => { setCounter(true); const t = setTimeout(() => setCounter(false), 2200); return () => clearTimeout(t) }, [i])

  const onScroll = () => { const el = sc.current; if (!el) return; const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (n !== i) setI(n) }
  const go = (n: number) => sc.current?.scrollTo({ left: n * (sc.current?.clientWidth ?? 0), behavior: 'smooth' })
  const tap = (e: React.PointerEvent) => {
    if (moved.current) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const p = { x: e.clientX - r.left, y: e.clientY - r.top }, now = performance.now(), L = last.current
    if (L && now - L.t < 300 && Math.hypot(p.x - L.x, p.y - L.y) < 50) {
      clearTimeout(tapT.current); last.current = null
      const id = now
      setHearts((h) => [...h, { id, ...p }]); setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1000)
      navigator.vibrate?.(8)
      onDoubleLike?.()
      return
    }
    last.current = { t: now, ...p }
    const at = i
    tapT.current = window.setTimeout(() => { last.current = null; setOpen(at) }, 300)
  }
  const firstRatio = (w: number, h: number) => { if (w && h) setRatio(Math.min(1.91, Math.max(0.8, w / h))) }
  const multi = srcs.length > 1
  return (
    <div className={s.pmWrap} aria-label={label ?? `รูปภาพในโพสต์ ${srcs.length} รูป`}>
      <div ref={sc} className={`${s.pm2} ${multi ? s.pmMulti : ''}`} style={{ aspectRatio: String(multi ? Math.min(ratio, 1) : ratio) }} onScroll={onScroll}
        onPointerDown={(e) => { moved.current = false; p0.current = { x: e.clientX, y: e.clientY } }}
        onPointerMove={(e) => { if (p0.current && Math.hypot(e.clientX - p0.current.x, e.clientY - p0.current.y) > 10) moved.current = true }}
        onPointerUp={tap}>
        {srcs.map((u, k) => (
          <div key={u + k} className={s.pmItem} data-pm={k}>
            {isVid(u)
              ? <video src={u} muted playsInline preload="metadata" loop autoPlay={k === i} onLoadedMetadata={(e) => k === 0 && firstRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight)} />
              : <span ref={(el) => { const im = el?.querySelector('img'); if (k === 0 && im) { if (im.complete) firstRatio(im.naturalWidth, im.naturalHeight); else im.onload = () => firstRatio(im.naturalWidth, im.naturalHeight) } }} style={{ display: 'contents' }}>
                  <Img src={u} sizes="100vw" eager={k === 0} alt={`รูปที่ ${k + 1}`} />
                </span>}
          </div>
        ))}
      </div>
      {hearts.map((h) => <span key={h.id} className={s.bigHeart} style={{ left: h.x, top: h.y }} aria-hidden>❤</span>)}
      {multi && <span className={s.pmCount} style={{ opacity: counter ? 1 : 0 }}>{i + 1}/{srcs.length}</span>}
      {multi && <div className={s.pmDots} role="tablist" aria-label="เลือกรูป">{srcs.map((_, k) => <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`รูปที่ ${k + 1}`} className={k === i ? s.on : Math.abs(k - i) > 2 ? s.far : ''} onClick={() => go(k)} />)}</div>}
      {open !== null && <PhotoViewer srcs={srcs} start={open} origin={() => sc.current?.querySelector<HTMLElement>(`[data-pm="${i}"]`) ?? null} onClose={(n) => { setOpen(null); if (n !== i) sc.current?.scrollTo({ left: n * (sc.current.clientWidth) }) }} />}
    </div>
  )
}
