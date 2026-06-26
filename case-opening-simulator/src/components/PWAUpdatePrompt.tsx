import { RefreshCw, Wifi, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })
  const isVisible = needRefresh || offlineReady

  if (!isVisible) {
    return null
  }

  function dismiss() {
    setNeedRefresh(false)
    setOfflineReady(false)
  }

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-3 right-3 z-[80] w-[min(24rem,calc(100vw-1.5rem))] border border-cs-border bg-cs-surface p-4 text-cs-text shadow-glow"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase text-rarity-special">
            {needRefresh ? 'Update Available' : 'Offline Ready'}
          </p>
          <h2 className="mt-1 text-base font-semibold text-cs-text">
            {needRefresh ? 'A new build is ready' : 'Case Opening Simulator works offline'}
          </h2>
        </div>
        <button
          aria-label="Dismiss PWA notification"
          className="grid h-9 w-9 shrink-0 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
          onClick={dismiss}
          type="button"
        >
          <X size={17} />
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-cs-muted">
        {needRefresh
          ? 'Reload to use the latest cached release.'
          : 'The app shell and core assets are cached for offline play.'}
      </p>
      {needRefresh ? (
        <button
          className="mt-3 inline-flex min-h-10 items-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
          onClick={() => void updateServiceWorker(true)}
          type="button"
        >
          <RefreshCw size={16} />
          Reload
        </button>
      ) : (
        <div className="mt-3 inline-flex min-h-10 items-center gap-2 border border-cs-green/70 bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green">
          <Wifi size={16} />
          Cached
        </div>
      )}
    </aside>
  )
}
