import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initSession } from './services/session'
import { toast } from './services/toast'
// registers the session hooks (hydrate on a restored sign-in); must be loaded before initSession()
import './services/cloud'
import './styles/global.css'
import './styles/kit.css'
import './styles/motion.css'
// UI v2 (demo site only): every rule in v2.css is scoped under html.ui2, which only the demo build sets
import './styles/v2.css'
import { registerSW } from 'virtual:pwa-register'

/* Service worker auto-update: the new SW activates at once (skipWaiting + clientsClaim),
   we check for a new deploy on open, when the app comes back to the foreground, and hourly,
   and reload once when a new SW takes control so nobody keeps running a stale version. */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })
}

/* A tab opened before a deploy may ask for a page chunk that no longer exists (old hash → 404),
   which looks like a button that does nothing. Reload once to pick up the new version. */
window.addEventListener('vite:preloadError', (e) => {
  const last = Number(sessionStorage.getItem('lumi-chunk-reload') || 0)
  if (Date.now() - last < 10_000) return
  sessionStorage.setItem('lumi-chunk-reload', String(Date.now()))
  e.preventDefault()
  window.location.reload()
})

/* Guest taps on follow/like/save/chat etc. are sent to the sign-in page by a thrown "sign in first" error.
   Show that reason as a toast instead of leaving it as an uncaught error. */
const SIGN_IN_FIRST = 'เข้าสู่ระบบก่อนนะ'
const signInNotice = (err: unknown, e: Event) => {
  if (err instanceof Error && err.message === SIGN_IN_FIRST) { e.preventDefault(); toast(SIGN_IN_FIRST); return }
  // Any other app error already worded for people (Thai, e.g. "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง") that a tap handler
  // did not catch: show it instead of a silent tap.
  if (err instanceof Error && /[\u0E00-\u0E7F]/.test(err.message)) { e.preventDefault(); toast(err.message) }
}
window.addEventListener('error', (e) => signInNotice(e.error, e))
window.addEventListener('unhandledrejection', (e) => signInNotice(e.reason, e))

// after services/cloud is imported, so the session hooks are registered
initSession()
// UI v2 (= config UI_V2), inlined so the real build drops this branch
if (import.meta.env.VITE_SITE === 'demo') { document.documentElement.classList.add('ui2'); void import('./services/moderation').then((m) => m.initModeration()) }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
