import { CalendarClock, RadioTower, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEvents } from '../hooks/useEvents'
import { useGame } from '../hooks/useGame'
import {
  getGameEventDescription,
  getGameEventName,
  type ActiveGameEvent,
} from '../events/eventManager'
import { isAdminSession } from '../utils/admin'

const dismissedBannerStorageKey = 'case-opening-simulator-dismissed-event-banners'

function readDismissedBannerIds() {
  if (typeof window === 'undefined') {
    return new Set<string>()
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(dismissedBannerStorageKey) ?? '[]')

    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function writeDismissedBannerIds(ids: Set<string>) {
  try {
    window.sessionStorage.setItem(dismissedBannerStorageKey, JSON.stringify([...ids]))
  } catch {
    // Dismissal is a session-only preference; failing to write should not affect gameplay.
  }
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m ${seconds}s`
}

function getSoonestEvent(events: ActiveGameEvent[]) {
  return [...events].sort((left, right) => {
    return (left.startTime ?? 0) - (right.startTime ?? 0)
  })[0]
}

export function MarketEventBanner() {
  const { cloud, state } = useGame()
  const { activeEvents, upcomingEvents } = useEvents()
  const [now, setNow] = useState(() => Date.now())
  const [dismissedEventIds, setDismissedEventIds] = useState(readDismissedBannerIds)
  const featuredEvent = activeEvents[0] ?? getSoonestEvent(upcomingEvents)
  const isActive = Boolean(activeEvents[0])
  const isAdminUser = isAdminSession(cloud.session)
  const countdownTarget = isActive ? featuredEvent?.endTime : featuredEvent?.startTime
  const countdown = countdownTarget ? formatCountdown(countdownTarget - now) : undefined
  const description = useMemo(() => {
    return featuredEvent ? getGameEventDescription(featuredEvent) : ''
  }, [featuredEvent])

  useEffect(() => {
    if (!featuredEvent) {
      return undefined
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [featuredEvent])

  if (!state.settings.marketEventBannersEnabled || !featuredEvent || dismissedEventIds.has(featuredEvent.id)) {
    return null
  }

  function dismissBanner() {
    if (!featuredEvent) {
      return
    }

    setDismissedEventIds((currentIds) => {
      const nextIds = new Set(currentIds)

      nextIds.add(featuredEvent.id)
      writeDismissedBannerIds(nextIds)

      return nextIds
    })
  }

  return (
    <aside className="border-x border-b border-rarity-special bg-rarity-special/10 px-3 py-2 text-cs-text sm:px-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center border border-rarity-special bg-cs-bg text-rarity-special">
            {isActive ? <RadioTower aria-hidden="true" size={17} /> : <CalendarClock aria-hidden="true" size={17} />}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-rarity-special">
              {isActive ? 'Live Event' : 'Upcoming Event'}
            </p>
            <h2 className="mt-1 truncate text-base font-semibold text-cs-text">
              {getGameEventName(featuredEvent)}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-cs-muted">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {countdown ? (
            <span className="border border-cs-border bg-cs-panel px-3 py-2 font-mono text-xs uppercase text-cs-green">
              {isActive ? 'Ends' : 'Starts'} {countdown}
            </span>
          ) : null}
          {isAdminUser ? (
            <Link
              className="border border-rarity-special px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
              to="/events"
            >
              Admin Panel
            </Link>
          ) : null}
          <button
            aria-label="Dismiss event popup"
            className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
            onClick={dismissBanner}
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
