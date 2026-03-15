/**
 * InstallPrompt — drie PWA-onderdelen in één component:
 *
 * 1. Install-banner    → "Voeg toe aan beginscherm" (beforeinstallprompt)
 * 2. Offline-indicator → oranje balk wanneer er geen netwerk is
 * 3. Update-toast      → "Nieuwe versie beschikbaar" na SW-update
 */
import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// ── 1. Install-banner ─────────────────────────────────────────────────────────
function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Reeds geïnstalleerd als standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handler = e => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setPrompt(null)
    })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function triggerInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  return { canInstall: !!prompt && !installed, triggerInstall }
}

// ── 2. Online/offline-status ──────────────────────────────────────────────────
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

// ── Hoofd-component ────────────────────────────────────────────────────────────
export default function InstallPrompt() {
  const { canInstall, triggerInstall } = useInstallPrompt()
  const online = useOnlineStatus()

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Controleer periodiek op updates (elke 60 minuten)
      if (r) setInterval(() => r.update(), 60 * 60 * 1000)
    },
  })

  const [installDismissed, setInstallDismissed] = useState(
    () => sessionStorage.getItem('install_dismissed') === '1'
  )

  function dismissInstall() {
    sessionStorage.setItem('install_dismissed', '1')
    setInstallDismissed(true)
  }

  return (
    <>
      {/* ── Offline-balk (altijd zichtbaar wanneer offline) ── */}
      {!online && (
        <div
          className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white"
          style={{ background: '#E74C3C' }}
        >
          <span>📡</span>
          <span>Geen internetverbinding — app werkt offline</span>
        </div>
      )}

      {/* ── Install-banner (onderaan) ── */}
      {canInstall && !installDismissed && (
        <div
          className="fixed bottom-0 inset-x-0 z-[90] flex items-center gap-3 px-4 py-3 shadow-xl"
          style={{ background: '#2C3E50' }}
        >
          <span className="text-2xl flex-shrink-0">📲</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">Voeg LO App toe aan beginscherm</p>
            <p className="text-white/60 text-xs">Snelle toegang, werkt ook offline</p>
          </div>
          <button
            onClick={triggerInstall}
            className="px-4 py-2 rounded-xl font-semibold text-sm text-white flex-shrink-0"
            style={{ background: '#E67E22' }}
          >
            Installeer
          </button>
          <button
            onClick={dismissInstall}
            className="text-white/50 hover:text-white text-xl leading-none flex-shrink-0"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Update-toast (rechts bovenaan) ── */}
      {needRefresh && (
        <div
          className="fixed top-16 right-3 z-[90] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl max-w-xs"
          style={{ background: '#27AE60' }}
        >
          <span className="text-xl flex-shrink-0">🔄</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Nieuwe versie</p>
            <p className="text-white/75 text-xs">Update beschikbaar</p>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            className="px-3 py-1.5 rounded-xl bg-white text-green-700 font-semibold text-xs flex-shrink-0"
          >
            Herlaad
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="text-white/60 hover:text-white text-lg leading-none flex-shrink-0"
            aria-label="Later"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
