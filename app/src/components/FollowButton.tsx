import type { CSSProperties } from 'react'
import { creatorById } from '../data/sampleData'
import { follows } from '../services/api'
import { useDb } from '../services/db'
import { toast } from '../services/toast'

/** One follow button for the whole app: “+ ติดตาม” / “ติดตามแล้ว”, persisted, with the same toast everywhere. */
export function FollowButton({ id, className, onClass, style, guard }: { id: string; className?: string; onClass?: string; style?: CSSProperties; guard?: () => boolean }) {
  const db = useDb()
  const on = db.follows.includes(id)
  const cls = className ? `${className} ${on && onClass ? onClass : ''}` : `btn-follow ${on ? 'on' : ''}`
  return (
    <button type="button" className={`${cls} press`} style={style} aria-pressed={on}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        if (guard?.()) return
        const name = creatorById(id).name
        follows.toggle(id).then((v) => toast(v ? `ติดตาม ${name} แล้ว` : `เลิกติดตาม ${name} แล้ว`))
      }}>
      {on ? 'ติดตามแล้ว' : '+ ติดตาม'}
    </button>
  )
}
