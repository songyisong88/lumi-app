import { QUICK_FILTERS, TYPES, TYPE_ORDER } from '../data/sampleData'
import type { TypeKey } from '../data/types'
import s from './FilterChips.module.css'

interface Props {
  quick: string
  onQuick: (id: string) => void
  type: TypeKey | null
  onType: (t: TypeKey | null) => void
}

export function FilterChips({ quick, onQuick, type, onType }: Props) {
  return (
    <div className={s.box}>
      <div className={`hscroll ${s.r1}`} role="tablist" aria-label="ตัวกรอง">
        {QUICK_FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={quick === f.id} className={`${s.chip} ${quick === f.id ? s.on : ''}`} onClick={() => onQuick(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className={`hscroll ${s.r2}`} aria-label="ประเภท">
        {TYPE_ORDER.map((t) => {
          const on = type === t
          return (
            <button key={t} aria-pressed={on} className={`${s.tchip} ${on ? s.ton : ''}`}
              style={on ? { background: TYPES[t].bg, color: TYPES[t].color, borderColor: TYPES[t].color } : undefined}
              onClick={() => onType(on ? null : t)}>
              <i style={{ background: TYPES[t].color }} />{TYPES[t].name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
