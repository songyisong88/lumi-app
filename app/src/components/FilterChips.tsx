import { SELL_TYPE_ORDER, SPECS, type SellType } from '../data/listingSpec'
import { FEATURES } from '../config'
import s from './FilterChips.module.css'

interface Props {
  quick: string
  onQuick: (id: string) => void
  type: SellType | null
  onType: (t: SellType | null) => void
}

/** Home category row (study 1, Shopee/Etsy style): one row — ทั้งหมด + each sell type. The “data” type is closed at launch. */
const TYPES = FEATURES.launch ? SELL_TYPE_ORDER.filter((t) => t !== 'data') : SELL_TYPE_ORDER
export function FilterChips({ onQuick, type, onType }: Props) {
  return (
    <div className={s.box}>
      <div className={`hscroll ${s.r1}`} role="tablist" aria-label="หมวด">
        <button role="tab" aria-selected={!type} className={`${s.chip} ${!type ? s.on : ''}`} onClick={() => { onQuick('all'); onType(null) }}>ทั้งหมด</button>
        {TYPES.map((t) => (
          <button key={t} role="tab" aria-selected={type === t} className={`${s.chip} ${type === t ? s.on : ''}`} onClick={() => onType(type === t ? null : t)}>{SPECS[t].name}</button>
        ))}
      </div>
    </div>
  )
}
