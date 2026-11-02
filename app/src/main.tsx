import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initSession } from './services/session'
// registers the session hooks (hydrate on a restored sign-in); must be loaded before initSession()
import './services/cloud'
import './styles/global.css'
import './styles/kit.css'
import './styles/motion.css'

// after services/cloud is imported, so the session hooks are registered
initSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
