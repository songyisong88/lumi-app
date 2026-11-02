import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initSession } from './services/session'
import './styles/global.css'
import './styles/kit.css'
import './styles/motion.css'

// after App (and services/api → cloud) are imported, so the session hooks are registered
initSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
