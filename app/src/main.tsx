import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initSession } from './services/session'
// registers the session hooks (hydrate on a restored sign-in); must be loaded before initSession()
import './services/cloud'
import './styles/global.css'
import './styles/kit.css'
import './styles/motion.css'
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

// after services/cloud is imported, so the session hooks are registered
initSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
