/**
 * Supabase client (project “lumi”). Only the publishable key ships in the app; every table is
 * protected by row-level security on the server, so the key alone cannot read private data.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const sb: SupabaseClient | null = URL && KEY
  ? createClient(URL, KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'lumi_auth' } })
  : null

/** Public URL of an object in the public `previews` bucket (covers, avatars, stories, post images). */
export const publicUrl = (path?: string | null) => (!path ? undefined : /^(https?:|data:|blob:)/.test(path) ? path : `${URL}/storage/v1/object/public/previews/${path}`)

/** Where auth e-mails send people back to (GitHub Pages has no SPA fallback, so the app root). */
export const appUrl = () => `${location.origin}${location.pathname}`
