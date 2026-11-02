import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { imgSrcSet, imgUrl } from '../data/sampleData'
import { Icon } from './Icon'
import { toast } from '../services/toast'
import { REAL } from '../config'

/** A button that is not ready yet keeps the disabled look (aria-disabled) but still answers a tap
 *  with a toast saying what is missing, so it never feels frozen. */
export const blockTap = (blocked: boolean, why: string) => ({
  'aria-disabled': blocked || undefined,
  onClickCapture: (e: React.MouseEvent) => { if (blocked) { e.stopPropagation(); e.preventDefault(); toast(why) } },
})

/* ---------- Bottom sheet: spring in, drag handle / swipe down to dismiss ---------- */
export function Sheet({ open, onClose, title, sub, children, footer, tall }: {
  open: boolean; onClose: () => void; title?: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null)

  if (open && !mounted) setMounted(true)
  useEffect(() => {
    if (open) {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const h = setTimeout(() => setMounted(false), 420)
    return () => clearTimeout(h)
  }, [open])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  if (!mounted) return null
  const el = () => ref.current!
  const down = (e: React.PointerEvent, fromBody = false) => {
    if (fromBody && (body.current?.scrollTop ?? 0) > 0) return
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.dy = e.clientY - d.y0
    if (d.dy <= 0) { el().style.transform = ''; return }
    if (d.dy > 6) { el().classList.add('dragging'); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }
    el().style.transform = `translate3d(0,${d.dy}px,0)`
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    el().classList.remove('dragging')
    el().style.transform = ''
    const v = d.dy / Math.max(1, performance.now() - d.t0)
    if (d.dy > 120 || (d.dy > 30 && v > 0.6)) onClose()
  }
  return createPortal(
    <>
      <div className={`sheet-back ${shown ? 'open' : ''}`} onClick={onClose} />
      <div ref={ref} className={`sheet ${shown ? 'open' : ''}`} role="dialog" aria-modal="true" style={tall ? { height: '88vh' } : undefined}>
        <div className="sheet-grab" onPointerDown={(e) => down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {(title || sub) && (
            <div className="sheet-h">
              <div>{title}{sub && <small>{sub}</small>}</div>
              <button className="sheet-x" onClick={onClose} aria-label="ปิด"><Icon name="x" size={16} stroke={2.4} /></button>
            </div>
          )}
        </div>
        <div ref={body} className="sheet-body" style={{ flex: 1 }} onPointerDown={(e) => e.pointerType === 'touch' && down(e, true)} onPointerMove={(e) => drag.current && e.pointerType === 'touch' && move(e)} onPointerUp={up} onPointerCancel={up}>{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  )
}

/* ---------- Image with shimmer skeleton + fade-in ---------- */
export function Img({ src, alt = '', className, style, fit = 'cover', ratio, sizes = '50vw', eager }: { src?: string; alt?: string; className?: string; style?: CSSProperties; fit?: 'cover' | 'contain'; ratio?: string; sizes?: string; eager?: boolean }) {
  const [ok, setOk] = useState(false)
  const url = src ? imgUrl(src) : ''
  return (
    <span className={`img-box ${ok ? '' : 'sk'} ${className ?? ''}`} style={{ aspectRatio: ratio, ...style }}>
      {url && (
        <img src={url} srcSet={src ? imgSrcSet(src) : undefined} sizes={sizes} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" className={`img-fade ${ok ? 'is-in' : ''}`} style={{ objectFit: fit }}
          ref={(i) => { if (i?.complete && i.naturalWidth && !ok) setOk(true) }} onLoad={() => setOk(true)} onError={() => setOk(true)} />
      )}
    </span>
  )
}

export function Av({ src, size = 40, ring, online }: { src: string; size?: number; ring?: boolean; online?: boolean }) {
  return (
    <span className={`av2 ${ring ? 'ring' : ''}`} style={{ width: size, height: size }}>
      <Img src={src} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
      {online && <i className="online" />}
    </span>
  )
}

/* ---------- Toasts (global, event driven) ---------- */
export function Toaster() {
  const [msg, setMsg] = useState<{ t: string; n: number } | null>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    let h = 0
    const on = (e: Event) => {
      setMsg({ t: (e as CustomEvent<string>).detail, n: Date.now() })
      setShow(true)
      clearTimeout(h)
      h = window.setTimeout(() => setShow(false), 2300)
    }
    window.addEventListener('lumi-toast', on)
    return () => { window.removeEventListener('lumi-toast', on); clearTimeout(h) }
  }, [])
  return <div className={`toast2 ${show ? 'show' : ''}`} role="status" aria-live="polite">{msg?.t}</div>
}

/* ---------- Top bar for inner pages ---------- */
export function TopBar({ title, sub, right, back = true, onBack, transparent, center }: {
  title?: ReactNode; sub?: ReactNode; right?: ReactNode; back?: boolean; onBack?: () => void; transparent?: boolean; center?: boolean
}) {
  const nav = useNavigate()
  const goBack = onBack ?? (() => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/')))
  return (
    <header className={`topbar ${transparent ? 'tb-clear' : ''} ${center ? 'tb-center' : ''}`}>
      {back && <button className="tb-btn" onClick={goBack} aria-label="ย้อนกลับ"><Icon name="back" size={22} stroke={2.2} /></button>}
      <div className="tb-title">{title}{sub && <small>{sub}</small>}</div>
      <div className="tb-right">{right}</div>
    </header>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`tgl ${on ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onChange(!on) }}><i /></button>
}

export function Seg<T extends string>({ value, options, onChange, className }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  const i = Math.max(0, options.findIndex((o) => o.v === value))
  return (
    <div className={`seg ${className ?? ''}`} style={{ '--n': options.length, '--i': i } as CSSProperties}>
      <span className="seg-thumb" />
      {options.map((o) => <button key={o.v} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  )
}

/** Underlined tab strip with a sliding indicator (transform only). */
export function Tabs<T extends string>({ value, options, onChange, sticky }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; sticky?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState({ x: 0, w: 0 })
  useEffect(() => {
    const b = wrap.current?.querySelector<HTMLElement>('button.on')
    if (b) {
      setBar({ x: b.offsetLeft, w: b.offsetWidth })
      b.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
  }, [value, options.length])
  return (
    <div ref={wrap} className={`tabs hscroll ${sticky ? 'tabs-sticky' : ''}`} role="tablist">
      {options.map((o) => <button key={o.v} role="tab" aria-selected={o.v === value} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>)}
      <i className="tabs-bar" style={{ transform: `translate3d(${bar.x}px,0,0) scaleX(${bar.w / 100})` }} />
    </div>
  )
}

/** “ข้อมูลตัวอย่าง” notes belong to the demo site; the real site hides them unless `keep` (a true statement there too). */
export function SampleNote({ children = 'ข้อมูลตัวอย่าง · ยังไม่มีการซื้อขาย/ส่งข้อความจริง', keep = false }: { children?: ReactNode; keep?: boolean }) {
  if (REAL && !keep) return null
  return <div className="sample-note"><Icon name="flag" size={14} />{children}</div>
}

export function Empty({ icon = 'sparkle', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty pop-in">
      <span className="empty-ic"><Icon name={icon} size={30} color="var(--p)" /></span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Stars({ v, size = 12 }: { v: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${v} ดาว`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} stroke={0} color="none" fill={i <= Math.round(v) ? '#F5A524' : '#E4E1EC'} />)}
    </span>
  )
}

export function copyText(t: string) {
  try { void navigator.clipboard?.writeText(t) } catch { /* ignore */ }
}
