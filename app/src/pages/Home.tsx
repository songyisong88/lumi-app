import { useMemo, useState } from 'react'
import { ComingSoonBand } from '../components/ComingSoonBand'
import { FilterChips } from '../components/FilterChips'
import { Header } from '../components/Header'
import { MasonryFeed } from '../components/MasonryFeed'
import { StoriesRow } from '../components/StoriesRow'
import { PRODUCTS, QUICK_FILTERS } from '../data/sampleData'
import type { TypeKey } from '../data/types'
import s from './Home.module.css'

/** How many feed items appear before the "เร็ว ๆ นี้" band. */
const FIRST_CHUNK = 14

export function Home() {
  const [quick, setQuick] = useState('all')
  const [type, setType] = useState<TypeKey | null>(null)

  const items = useMemo(() => {
    const qf = QUICK_FILTERS.find((f) => f.id === quick)!
    return PRODUCTS.filter((p) => qf.match(p) && (!type || p.type === type))
  }, [quick, type])

  const filtered = quick !== 'all' || type !== null
  const first = filtered ? items : items.slice(0, FIRST_CHUNK)
  const rest = filtered ? [] : items.slice(FIRST_CHUNK)

  return (
    <>
      <Header />
      <main className="wrap page">
        <StoriesRow />
        <FilterChips quick={quick} onQuick={setQuick} type={type} onType={setType} />
        {items.length === 0 ? (
          <div className={s.empty}>ยังไม่มีผลงานที่ตรงกับตัวกรองนี้<button onClick={() => { setQuick('all'); setType(null) }}>ล้างตัวกรอง</button></div>
        ) : (
          <MasonryFeed items={first} />
        )}
        <ComingSoonBand />
        {rest.length > 0 && <MasonryFeed items={rest} />}
      </main>
    </>
  )
}
