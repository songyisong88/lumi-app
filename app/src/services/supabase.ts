/**
 * Supabase client (project “lumi”). Only the publishable key ships in the app; every table is
 * protected by row-level security on the server, so the key alone cannot read private data.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEMO_SITE } from '../config'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** The demo site (testing ground) keeps its own sign-in, so test accounts never stay signed in on the real site
 *  (both sites share one origin and one localStorage). */
export const AUTH_STORAGE_KEY = DEMO_SITE ? 'lumi_demo_auth' : 'lumi_auth'

export const sb: SupabaseClient | null = URL && KEY
  ? createClient(URL, KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY } })
  : null

/** Public URL of an object in the public `previews` bucket (covers, avatars, stories, post images). */
export const publicUrl = (path?: string | null) => (!path ? undefined : /^(https?:|data:|blob:)/.test(path) ? path : `${URL}/storage/v1/object/public/previews/${path}`)

/** Where auth e-mails send people back to (GitHub Pages has no SPA fallback, so the app root). */
export const appUrl = () => `${location.origin}${location.pathname}`
