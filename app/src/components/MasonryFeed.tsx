import { useEffect, useMemo, useState } from 'react'
import type { Product } from '../data/types'
import { ProductCard } from './ProductCard'
import s from './MasonryFeed.module.css'

/** Column count per breakpoint: mobile 2, tablet 3-4, desktop 5-6. */
const BPS: [number, number][] = [[1600, 6], [1200, 5], [960, 4], [600, 3], [0, 2]]
const colsFor = (w: number) => BPS.find(([min]) => w >= min)![1]

function useColumns() {
  const [cols, setCols] = useState(() => colsFor(window.innerWidth))
  useEffect(() => {
    const on = () => setCols(colsFor(window.innerWidth))
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return cols
}

/** Estimated card height relative to its width: media ratio + text body. */
function estHeight(p: Product) {
  const [w, h] = (p.ratio ?? (p.image ? `${p.image.w}/${p.image.h}` : '1/1')).split('/').map(Number)
  return h / w + 0.45
}

/**
 * Masonry in JS (shortest column first) so the reading order stays left-to-right,
 * unlike CSS columns which fill top-to-bottom.
 */
export function MasonryFeed({ items }: { items: Product[] }) {
  const cols = useColumns()
  const columns = useMemo(() => {
    const out: Product[][] = Array.from({ length: cols }, () => [])
    const hs = new Array(cols).fill(0)
    for (const p of items) {
      const i = hs.indexOf(Math.min(...hs))
      out[i].push(p)
      hs[i] += estHeight(p)
    }
    return out
  }, [items, cols])

  return (
    <div className={s.mas} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {columns.map((col, i) => (
        <div key={i} className={s.col}>
          {col.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      ))}
    </div>
  )
}
