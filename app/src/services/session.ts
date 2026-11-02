/**
 * Who is using the app right now.
 *  - 'cloud': signed in with a real LUMI account (Supabase). Data is saved on the server.
 *  - 'demo' : the sample persona (ฟ้าใส ครีเอท). Everything stays in this browser, nothing is sent.
 *  - 'guest': not signed in. Public pages work; account pages ask to sign in (or try the demo).
 */
import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { seed } from '../data/appSeed'
import type { DB } from '../data/appTypes'
import { setMe } from '../data/sampleData'
import { switchDb } from './db'
import { AUTH_STORAGE_KEY, sb } from './supabase'
import { FEATURES, REAL } from '../config'

export type Mode = 'cloud' | 'demo' | 'guest'
export interface Profile { id: string; handle: string | null; display_name: string; avatar_path: string | null; bio: string | null; is_creator: boolean; mode: string | null; follower_count?: number; product_count?: number; rating?: number | null }
export interface SessionState { mode: Mode; userId?: string; email?: string; profile?: Profile; recovering?: boolean; ready: boolean }

const MODE_KEY = 'lumi_mode'
const AUTH_KEY = AUTH_STORAGE_KEY
/** The real site never runs the sample persona and keeps its own local caches (the demo site shares this origin). */
const demoOn = () => !REAL && localStorage.getItem(MODE_KEY) === 'demo'
const GUEST_DB = REAL ? 'lumi_real_guest_db' : 'lumi_guest_db'
const CLOUD_DB = REAL ? 'lumi_real_cloud_db:' : 'lumi_cloud_db:'
const listeners = new Set<() => void>()
let state: SessionState = { mode: 'guest', ready: false }
const set = (p: Partial<SessionState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()) }
export const getSession = () => state
export const isCloud = () => state.mode === 'cloud' && !!state.userId
export const isDemo = () => state.mode === 'demo'
export function useSession(): SessionState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, getSession, getSession)
}

/** A real account starts with no sample orders, chats or listings. On the demo site the community feed keeps the
 *  sample posts; the real site starts empty and shows only server posts. */
export function cloudSeed(): DB {
  const s = seed()
  return {
    ...s, follows: [], cart: [], orders: [], purchases: [], threads: [], messages: {}, liked: [], saved: [], likedComments: [], joined: [], votes: [],
    notifs: [], drafts: [], published: [], missions: [], replies: {},
    posts: REAL ? [] : s.posts.map((p) => ({ ...p, mine: false })),
    ...(REAL ? { comments: [] } : {}),
  }
}

let hooks: { onCloud?: (uid: string) => void; onLeave?: () => void; onGuest?: () => void } = {}
/** cloud.ts registers how to fill the local cache after sign-in (avoids an import cycle). */
export function registerSessionHooks(h: typeof hooks) { hooks = h }

function enterGuest() {
  setMe('guest')
  switchDb(GUEST_DB, cloudSeed)
  set({ mode: 'guest', userId: undefined, email: undefined, profile: undefined })
  hooks.onGuest?.()
}
function enterDemo() {
  setMe('fasai')
  switchDb(null)
  set({ mode: 'demo', userId: undefined, email: undefined, profile: undefined })
}
function enterCloud(uid: string, email?: string) {
  if (state.mode === 'cloud' && state.userId === uid) { if (email && email !== state.email) set({ email }); return }
  setMe(uid)
  switchDb(`${CLOUD_DB}${uid}`, cloudSeed)
  set({ mode: 'cloud', userId: uid, email })
  hooks.onCloud?.(uid)
}

/** Decide the mode before the first render (sync, from localStorage), then confirm with Supabase. */
export function initSession() {
  // accounts OFF (live build): exactly today's demo, nothing is switched or loaded
  if (!FEATURES.accounts || !sb) { set({ mode: 'demo', ready: true }); return }
  if (demoOn()) { enterDemo(); set({ ready: true }); return }
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    const u = raw ? (JSON.parse(raw) as { user?: { id: string; email?: string } }).user : undefined
    if (u?.id) enterCloud(u.id, u.email); else enterGuest()
  } catch { enterGuest() }
  void sb.auth.getSession().then(({ data }) => { apply(data.session); set({ ready: true }) })
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') { set({ recovering: true }); location.hash = '#/account/password' }
    if (demoOn()) return
    // run outside the auth callback (supabase-js holds a lock while it runs)
    setTimeout(() => apply(session), 0)
  })
}
function apply(session: Session | null) {
  if (demoOn()) return
  if (session?.user) enterCloud(session.user.id, session.user.email)
  else if (state.mode === 'cloud') { hooks.onLeave?.(); enterGuest() }
}

export function setProfile(p: Profile | undefined) { set({ profile: p }) }
export function endRecovery() { set({ recovering: false }) }

/** “ลองใช้แบบตัวอย่าง”: the sample persona, nothing leaves the device. */
export function startDemo() { if (REAL) return; localStorage.setItem(MODE_KEY, 'demo'); enterDemo() }
/** Leave the demo and go back to the real (signed-in or guest) app. */
export async function leaveDemo() {
  localStorage.removeItem(MODE_KEY)
  const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } }
  if (data.session?.user) enterCloud(data.session.user.id, data.session.user.email); else enterGuest()
}
export async function signOut() {
  hooks.onLeave?.()
  await sb?.auth.signOut()
  enterGuest()
}
