/**
 * Tiny local database: one JSON document in localStorage plus a subscribe API for React.
 * Only services/api.ts writes to it. Swap api.ts for a Supabase client later and keep
 * the same DB shape (see data/appTypes.ts) as tables.
 */
import { useSyncExternalStore } from 'react'
import { seed } from '../data/appSeed'
import type { DB } from '../data/appTypes'
import { registerProducts } from '../data/sampleData'

const KEY = 'lumi_app_db'
// bump when the seed or stored shapes change; older local data is replaced by the new seed
const VERSION = 5
type Listener = () => void
const listeners = new Set<Listener>()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as DB
      if (d && d.v === VERSION) return d
    }
  } catch { /* corrupted: fall back to seed */ }
  return { ...seed(), v: VERSION }
}

let state: DB = load()
registerProducts(state.published)

export const getDb = () => state

export function update(fn: (d: DB) => DB | void) {
  const draft = structuredClone(state)
  const out = fn(draft)
  state = out ?? draft
  registerProducts(state.published)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    window.dispatchEvent(new CustomEvent('lumi-toast', { detail: 'พื้นที่เก็บข้อมูลในเครื่องเต็ม ลองลบรูปบางรูป' }))
  }
  listeners.forEach((l) => l())
}

export function resetDb() {
  localStorage.removeItem(KEY)
  state = { ...seed(), v: VERSION }
  listeners.forEach((l) => l())
}

const subscribe = (l: Listener) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

// keep several tabs in sync
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      registerProducts(state.published)
      listeners.forEach((l) => l())
    }
  })

/** Read the whole local DB; re-renders on every change. Select inside the component. */
export function useDb(): DB {
  return useSyncExternalStore(subscribe, getDb, getDb)
}

export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
