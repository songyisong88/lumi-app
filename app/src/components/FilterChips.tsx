import { QUICK_FILTERS } from '../data/sampleData'
import { SELL_TYPE_ORDER, SPECS, type SellType } from '../data/listingSpec'
import s from './FilterChips.module.css'

interface Props {
  quick: string
  onQuick: (id: string) => void
  type: SellType | null
  onType: (t: SellType | null) => void
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
        {SELL_TYPE_ORDER.map((t) => {
          const on = type === t
          return (
            <button key={t} aria-pressed={on} className={`${s.tchip} ${on ? s.ton : ''}`}
              style={on ? { background: SPECS[t].bg, color: SPECS[t].color, borderColor: SPECS[t].color } : undefined}
              onClick={() => onType(on ? null : t)}>
              <i style={{ background: SPECS[t].color }} />{SPECS[t].name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
