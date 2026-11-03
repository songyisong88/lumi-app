import { useEffect, useState } from 'react'
import { sb } from './supabase'
import { useSession } from './session'

/** Staff check for the admin screens. The role lives in the server table admin_roles (RLS: a user reads only
 *  their own rows), never in user-editable data. The sample persona and guests are never admins. */
const cache = new Map<string, boolean>()
export function useIsAdmin(): boolean {
  const s = useSession()
  const uid = s.mode === 'cloud' ? s.userId : undefined
  const [ok, setOk] = useState(() => (uid ? cache.get(uid) ?? false : false))
  useEffect(() => {
    if (!uid || !sb) { setOk(false); return }
    if (cache.has(uid)) { setOk(cache.get(uid)!); return }
    let live = true
    void sb.from('admin_roles').select('role').eq('user_id', uid).then(({ data }) => {
      const v = !!data?.some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator')
      cache.set(uid, v)
      if (live) setOk(v)
    })
    return () => { live = false }
  }, [uid])
  return ok
}
