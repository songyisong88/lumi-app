import { useState } from 'react'
import { useFavorites } from '../services/FavoritesContext'
import { Icon } from './Icon'
import s from './HeartButton.module.css'

export function HeartButton({ productId, className, variant = 'card' }: { productId: string; className?: string; variant?: 'card' | 'glass' }) {
  const { has, toggle } = useFavorites()
  const [pop, setPop] = useState(false)
  const on = has(productId)
  return (
    <button
      type="button"
      className={`${s.fav} ${variant === 'glass' ? s.glass : ''} ${on ? s.on : ''} ${pop ? s.pop : ''} ${className ?? ''}`}
      aria-pressed={on}
      aria-label={on ? 'เอาออกจากที่ชอบ' : 'เพิ่มในที่ชอบ'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!on) setPop(true)
        toggle(productId)
      }}
      onAnimationEnd={() => setPop(false)}
    >
      <Icon name="heart" size={variant === 'glass' ? 22 : 16} stroke={2.2} color={on ? '#F0508A' : variant === 'glass' ? '#fff' : '#16132B'} fill={on ? '#F0508A' : 'none'} />
    </button>
  )
}
