import { CalendarClock, History, RadioTower, TestTube2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useEvents } from '../hooks/useEvents'
import {
  PREDEFINED_GAME_EVENTS,
  getGameEventDescription,
  getGameEventEffectSummary,
  getGameEventName,
  type ActiveGameEvent,
  type GameEventLog,
} from '../events/eventManager'

function formatDateTime(value: number | undefined) {
  if (!value) {
    return 'Pending'
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

function formatDuration(start: number | undefined, end: number | undefined) {
  if (!start || !end) {
    return 'Unknown'
  }

  const hours = Math.max(1, Math.round((end - start) / (60 * 60 * 1_000)))

  if (hours >= 24) {
    const days = Math.round(hours / 24)

    return `${days} day${days === 1 ? '' : 's'}`
  }

  return `${hours} hour${hours === 1 ? '' : 's'}`
}

function EventRow({
  event,
  now,
  tone,
}: {
  event: ActiveGameEvent | GameEventLog
  now: number
  tone: 'active' | 'past' | 'upcoming'
}) {
  const toneClass =
    tone === 'active'
      ? 'border-rarity-special bg-rarity-special/10'
      : tone === 'upcoming'
        ? 'border-rarity-industrial bg-rarity-industrial/10'
        : 'border-cs-border bg-cs-panel'
  const countdownTarget = tone === 'active' ? event.endTime : event.startTime
  const countdownLabel = tone === 'active' ? 'Ends' : tone === 'upcoming' ? 'Starts' : 'Ended'

  return (
    <article className={`border p-3 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase text-cs-muted">
            {formatDateTime(event.startTime)} / {formatDateTime(event.endTime)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-cs-text">{getGameEventName(event)}</h3>
          <p className="mt-1 text-sm text-cs-muted">{getGameEventDescription(event)}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <span className="border border-cs-border bg-cs-bg px-2 py-1 font-mono text-[10px] uppercase text-cs-muted">
            {formatDuration(event.startTime, event.endTime)}
          </span>
          {tone !== 'past' ? (
            <span className="border border-cs-border bg-cs-bg px-2 py-1 font-mono text-[10px] uppercase text-cs-green">
              {countdownLabel} {formatCountdown(countdownTarget - now)}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 border border-cs-border bg-cs-bg px-3 py-2 text-sm text-cs-text">
        {getGameEventEffectSummary(event)}
      </p>
    </article>
  )
}

function EventSection({
  emptyText,
  events,
  icon,
  now,
  title,
  tone,
}: {
  emptyText: string
  events: (ActiveGameEvent | GameEventLog)[]
  icon: ReactNode
  now: number
  title: string
  tone: 'active' | 'past' | 'upcoming'
}) {
  return (
    <section className="border border-cs-border bg-cs-surface p-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold text-cs-text">{title}</h2>
      </div>
      <div className="mt-3 grid gap-2">
        {events.length > 0 ? (
          events.map((event) => <EventRow event={event} key={event.id} now={now} tone={tone} />)
        ) : (
          <p className="border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  )
}

export function MarketEvents() {
  const { activeEvents, eventHistory, tickEventsNow, triggerGameEvent, upcomingEvents } = useEvents()
  const [now, setNow] = useState(() => Date.now())
  const sortedUpcoming = useMemo(() => {
    return [...upcomingEvents].sort((left, right) => left.startTime - right.startTime)
  }, [upcomingEvents])
  const sortedPast = useMemo(() => {
    return [...eventHistory].sort((left, right) => right.endedAt - left.endedAt)
  }, [eventHistory])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <section className="w-full">
      <div className="border border-cs-border bg-cs-surface p-4 sm:p-5">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Jonsman Tools</p>
          <h1 className="mt-1 text-2xl font-semibold text-cs-text sm:text-3xl">Admin Panel</h1>
          <p className="mt-2 max-w-3xl text-sm text-cs-muted">
            Timed events can change drops, case access, case prices, market movement, prestige gains and trade-up economics.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="grid gap-4">
          <EventSection
            emptyText="No live gameplay events right now."
            events={activeEvents}
            icon={<RadioTower aria-hidden="true" className="text-rarity-special" size={18} />}
            now={now}
            title="Active"
            tone="active"
          />
          <EventSection
            emptyText="No upcoming events are scheduled yet."
            events={sortedUpcoming}
            icon={<CalendarClock aria-hidden="true" className="text-rarity-industrial" size={18} />}
            now={now}
            title="Upcoming"
            tone="upcoming"
          />
          <EventSection
            emptyText="Past events will appear here after they end."
            events={sortedPast}
            icon={<History aria-hidden="true" className="text-cs-muted" size={18} />}
            now={now}
            title="Past"
            tone="past"
          />
        </div>

        <aside className="grid gap-4">
          <section className="border border-cs-border bg-cs-surface p-3">
            <div className="flex items-center gap-2">
              <TestTube2 aria-hidden="true" className="text-rarity-special" size={18} />
              <h2 className="text-lg font-semibold text-cs-text">Developer Triggers</h2>
            </div>
            <p className="mt-2 text-xs text-cs-muted">
              Trigger events manually for testing save/load, costs, odds and dashboard states.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {PREDEFINED_GAME_EVENTS.map((event) => (
                <button
                  className="border border-rarity-special px-3 py-2 text-left text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
                  key={event.type}
                  onClick={() => triggerGameEvent(event.type)}
                  type="button"
                >
                  {event.name}
                </button>
              ))}
            </div>
            <button
              className="mt-3 w-full border border-cs-border px-3 py-2 text-sm font-semibold text-cs-text transition-colors hover:bg-cs-panel"
              onClick={tickEventsNow}
              type="button"
            >
              Tick Events Now
            </button>
          </section>

          <section className="border border-cs-border bg-cs-surface p-3">
            <h2 className="text-lg font-semibold text-cs-text">Event Pool</h2>
            <div className="mt-3 grid gap-2">
              {PREDEFINED_GAME_EVENTS.map((event) => (
                <div className="border border-cs-border bg-cs-panel px-3 py-2" key={event.type}>
                  <p className="font-semibold text-cs-text">{event.name}</p>
                  <p className="mt-1 text-xs text-cs-muted">{event.description}</p>
                  <p className="mt-2 border border-cs-border bg-cs-bg px-2 py-1 text-xs text-cs-text">
                    {event.effectSummary}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
