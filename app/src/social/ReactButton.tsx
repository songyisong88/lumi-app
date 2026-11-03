import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ReactKind } from '../data/appTypes'
import { Icon } from '../components/Icon'
import { REACTIONS, rxOf } from './reactions'
import s from './Social.module.css'

const COACH = 'lumi_rx_coach'
export const coachSeen = () => { try { return localStorage.getItem(COACH) === '1' } catch { return true } }
const markCoach = () => { try { localStorage.setItem(COACH, '1') } catch { /* private mode */ } }

/** “ถูกใจ” like Facebook: tap = ❤️ ถูกใจ (or remove), press & hold (450 ms) = the 6-reaction dock.
 *  While holding you can slide across the dock and let go on one; or let go and tap one. */
export function ReactButton({ mine, onPick, small, onDock }: { mine?: ReactKind; onPick: (k: ReactKind | null) => void; small?: boolean; onDock?: (open: boolean) => void }) {
  const [dock, setDock] = useState(false)
  const [hov, setHov] = useState<ReactKind>()
  const [burst, setBurst] = useState(0)
  const t = useRef<number>(0)
  const long = useRef(false)
  const dockRef = useRef<HTMLDivElement>(null)
  const r = rxOf(mine)
  useEffect(() => () => clearTimeout(t.current), [])
  // pop whenever my reaction is set or changed (tap, dock, or double-tap on the picture)
  const prev = useRef(mine)
  useEffect(() => { if (mine && mine !== prev.current) setBurst((n) => n + 1); prev.current = mine }, [mine])
  useEffect(() => {
    onDock?.(dock)
    if (!dock) return
    const off = (e: PointerEvent) => { if (!dockRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('[data-rxbtn]')) setDock(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setDock(false) }
    // while the finger is still down after the long-press, don't let the page start scrolling: slide across the dock instead
    const tm = (e: TouchEvent) => { if (long.current && e.cancelable) e.preventDefault() }
    window.addEventListener('pointerdown', off); window.addEventListener('keydown', k); window.addEventListener('touchmove', tm, { passive: false })
    return () => { window.removeEventListener('pointerdown', off); window.removeEventListener('keydown', k); window.removeEventListener('touchmove', tm) }
  }, [dock]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (k: ReactKind | null) => {
    setDock(false); setHov(undefined)
    if (k && dock) markCoach() // learned the long-press: stop showing the tip
    onPick(k)
  }
  const at = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const k = el?.closest?.('[data-rx]')?.getAttribute('data-rx') as ReactKind | null
    setHov(k ?? undefined)
    return k
  }
  return (
    <>
      {dock && (
        <div ref={dockRef} className={s.dock} role="menu" aria-label="เลือกความรู้สึก" style={small ? { bottom: 26, left: -6 } as CSSProperties : undefined}>
          {REACTIONS.map((x) => (
            <button key={x.k} type="button" role="menuitem" data-rx={x.k} data-l={x.l} aria-label={x.l} className={hov === x.k ? s.hov : ''}
              onPointerEnter={() => setHov(x.k)} onPointerLeave={() => setHov(undefined)} onClick={() => pick(x.k)}>{x.e}</button>
          ))}
        </div>
      )}
      <button type="button" data-rxbtn className={`${small ? '' : ''} ${s.rxBtn} ${mine ? s.on : ''}`} style={r ? { color: r.c } : undefined}
        aria-label={r ? `${r.l} (กดเพื่อเอาออก · กดค้างเพื่อเปลี่ยน)` : 'ถูกใจ'} aria-pressed={!!mine} aria-haspopup="menu"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          long.current = false
          clearTimeout(t.current)
          t.current = window.setTimeout(() => { long.current = true; setDock(true); navigator.vibrate?.(10) }, 450)
        }}
        onPointerMove={(e) => { if (long.current && dock) at(e.clientX, e.clientY) }}
        onPointerUp={(e) => {
          clearTimeout(t.current)
          if (long.current) { const k = at(e.clientX, e.clientY); if (k) pick(k); else window.setTimeout(() => { long.current = false }, 400) }
        }}
        onPointerCancel={() => clearTimeout(t.current)}
        onKeyDown={(e) => { if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) { e.preventDefault(); setDock(true) } }}
        onClick={(e) => {
          if (long.current) { e.preventDefault(); long.current = false; return }
          pick(mine ? null : 'like')
        }}>
        {small ? <>{r ? r.l : 'ถูกใจ'}</> : r ? <><span key={burst} className={`${s.emo} ${burst ? s.pop : ''}`}>{r.e}</span>{r.l}</> : <><Icon name="heart" size={20} />ถูกใจ</>}
        {burst > 0 && r && !small && (
          <span key={'b' + burst} className={s.burst} aria-hidden>
            {([[-30, -26, r.e], [8, -40, '✨'], [30, -22, r.e], [-8, -54, '✨']] as const).map(([x, y, e2], i) => <i key={i} style={{ transform: `translate(${x}px,${y}px)` }}>{e2}</i>)}
          </span>
        )}
        {burst > 0 && r && !small && (
          <span key={'r' + burst} aria-hidden style={{ position: 'absolute', left: 'calc(50% - 22px)', top: '50%', color: r.c }}><span className={s.ring} /></span>
        )}
      </button>
    </>
  )
}
