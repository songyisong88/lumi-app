import { useMemo, useState } from 'react'
import { FilterChips } from '../components/FilterChips'
import { Header } from '../components/Header'
import { MasonryFeed } from '../components/MasonryFeed'
import { StoriesRow } from '../components/StoriesRow'
import { NEW_CATEGORY_WORKS, PRODUCTS, QUICK_FILTERS } from '../data/sampleData'
import { sellTypeOf, type SellType } from '../data/listingSpec'
import { isLive } from '../data/sampleData'
import { useDb } from '../services/db'
import s from './Home.module.css'

export function Home() {
  const [quick, setQuick] = useState('all')
  const [type, setType] = useState<SellType | null>(null)
  const published = useDb().published

  const items = useMemo(() => {
    const qf = QUICK_FILTERS.find((f) => f.id === quick)!
    return [...published, ...PRODUCTS, ...NEW_CATEGORY_WORKS].filter((p) => isLive(p) && qf.match(p) && (!type || sellTypeOf(p) === type))
  }, [quick, type, published])

  return (
    <>
      <Header />
      <main className="wrap page">
        <StoriesRow />
        <FilterChips quick={quick} onQuick={setQuick} type={type} onType={setType} />
        {items.length === 0 ? (
          <div className={s.empty}>ยังไม่มีผลงานที่ตรงกับตัวกรองนี้<button onClick={() => { setQuick('all'); setType(null) }}>ล้างตัวกรอง</button></div>
        ) : (
          <MasonryFeed items={items} />
        )}
      </main>
    </>
  )
}
