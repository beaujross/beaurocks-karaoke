import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const STALE_ASSET_RELOAD_KEY = 'beaurocks:stale-asset-reload-at'

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    const now = Date.now()
    let previousReloadAt = 0
    try {
      previousReloadAt = Number(window.sessionStorage?.getItem(STALE_ASSET_RELOAD_KEY) || 0)
    } catch (_error) {
      // Storage can be disabled; the reload is still safe and useful.
    }
    if (previousReloadAt && now - previousReloadAt < 15000) return
    event.preventDefault()
    try {
      window.sessionStorage?.setItem(STALE_ASSET_RELOAD_KEY, String(now))
    } catch (_error) {
      // Continue with a one-time reload when storage is unavailable.
    }
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
