import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { favoritesService } from './favorites'

interface FavCtx {
  ids: string[]
  has: (id: string) => boolean
  toggle: (id: string) => void
}

const Ctx = createContext<FavCtx | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    favoritesService.list().then(setIds)
  }, [])

  const toggle = useCallback(
    (id: string) => {
      const on = ids.includes(id)
      setIds(on ? ids.filter((x) => x !== id) : [id, ...ids]) // optimistic
      void (on ? favoritesService.remove(id) : favoritesService.add(id))
    },
    [ids],
  )

  const has = useCallback((id: string) => ids.includes(id), [ids])

  return <Ctx.Provider value={{ ids, has, toggle }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFavorites must be used inside FavoritesProvider')
  return c
}
