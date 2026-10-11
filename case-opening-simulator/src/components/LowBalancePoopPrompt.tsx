import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'

const LOW_BALANCE_THRESHOLD = 3
const SESSION_DISMISSED_KEY = 'case-opening-simulator:work:low-balance-dismissed'

function readSessionDismissed() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.sessionStorage.getItem(SESSION_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

function writeSessionDismissed() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true')
  } catch {
    // The prompt still dismisses in memory if sessionStorage is unavailable.
  }
}

function clearSessionDismissed() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(SESSION_DISMISSED_KEY)
  } catch {
    // Best effort only.
  }
}

export function LowBalancePoopPrompt() {
  const { state } = useGame()
  const location = useLocation()
  const navigate = useNavigate()
  const [isDismissed, setIsDismissed] = useState(readSessionDismissed)
  const isLowBalance = state.money < LOW_BALANCE_THRESHOLD
  const shouldShow = isLowBalance && !isDismissed && location.pathname !== '/work'

  useEffect(() => {
    if (!isLowBalance) {
      clearSessionDismissed()
    }
  }, [isLowBalance])

  function dismiss() {
    writeSessionDismissed()
    setIsDismissed(true)
  }

  function goToWork() {
    dismiss()
    navigate('/work')
  }

  if (!shouldShow) {
    return null
  }

  return (
    <section
      aria-label="Low balance help"
      className="fixed bottom-4 right-4 z-40 w-[min(calc(100vw-2rem),22rem)] border border-cs-green bg-cs-surface p-3 text-cs-text shadow-glow"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Need money? Do some work.</p>
          <button
            className="mt-3 inline-flex min-h-10 items-center justify-center border border-cs-green bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green transition-colors hover:bg-cs-green/20"
            onClick={goToWork}
            type="button"
          >
            Take me to Work
          </button>
        </div>
        <button
          aria-label="Close low balance prompt"
          className="grid h-9 w-9 shrink-0 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
          onClick={dismiss}
          type="button"
        >
          <X size={16} />
        </button>
      </div>
    </section>
  )
}
