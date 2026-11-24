import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { getToastLifetime, getToastPriority, selectVisibleToasts } from '../notifications/toastPolicy'
import { formatCurrency } from '../utils/format'

export function ToastNotifications() {
  const { dispatch, state } = useGame()
  const [dialogOpen, setDialogOpen] = useState(false)
  const timers = useRef(new Map<string, number>())
  const onboarding = state.ui.onboarding
  const tutorialOpen = (!onboarding.isDismissed || onboarding.isReviewing) && !onboarding.isPaused
  const blocked = tutorialOpen || dialogOpen
  const toastEvents = selectVisibleToasts(
    state.uiEvents.filter((event) => state.settings.autoSellNotificationsEnabled || event.type !== 'items_auto_sold'),
    blocked,
  )

  useEffect(() => {
    const update = () => setDialogOpen(Boolean(document.querySelector('[role="dialog"]')))
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const visibleIds = new Set(toastEvents.map((event) => event.id))
    for (const [id, timer] of timers.current) {
      if (visibleIds.has(id)) continue
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    for (const event of toastEvents) {
      const lifetime = getToastLifetime(event)
      if (lifetime === undefined || timers.current.has(event.id)) continue
      const timer = window.setTimeout(() => {
        timers.current.delete(event.id)
        dispatch({ type: 'DISMISS_UI_EVENT', eventId: event.id })
      }, lifetime)
      timers.current.set(event.id, timer)
    }
  }, [dispatch, toastEvents])

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
  }, [])

  if (toastEvents.length === 0) {
    return null
  }

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed right-2 top-[calc(env(safe-area-inset-top)+6.5rem)] z-[75] flex max-h-[min(60dvh,30rem)] w-[min(21rem,calc(100%-1rem))] flex-col gap-2 overflow-y-auto sm:right-4 sm:top-24"
      data-testid="toast-stack"
    >
      {toastEvents.map((event) => (
        <div
          className={[
            'pointer-events-auto w-full min-w-0 max-w-full border bg-cs-surface p-2.5 shadow-glow sm:p-3',
            getToastPriority(event) === 'critical' ? 'border-rarity-covert' :
              getToastPriority(event) === 'important' ? 'border-rarity-special' : 'border-cs-green',
          ].join(' ')}
          key={event.id}
          data-toast-id={event.id}
          role={getToastPriority(event) === 'critical' ? 'alert' : 'status'}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 break-words">
              {event.type === 'case_opening_failed' || event.type === 'item_sale_failed' || event.type === 'trade_up_failed' ? (
                <><p className="font-mono text-xs uppercase text-rarity-covert">Action failed</p><p className="mt-1 text-sm text-cs-text">{event.message}</p></>
              ) : event.type === 'item_sold' ? (
                <>
                  <p className="font-mono text-xs uppercase text-cs-green">Item Sold</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">
                    {event.item.weapon} | {event.item.finish}
                  </p>
                  <p className="mt-1 text-sm text-cs-muted">
                    Sold for{' '}
                    <span className="font-semibold text-cs-green">{formatCurrency(event.salePrice)}</span>
                  </p>
                </>
              ) : event.type === 'items_sold' ? (
                <>
                  <p className="font-mono text-xs uppercase text-cs-green">Bulk Sale</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">
                    {event.itemCount} item{event.itemCount === 1 ? '' : 's'} sold
                  </p>
                  <p className="mt-1 text-sm text-cs-muted">
                    Sold for{' '}
                    <span className="font-semibold text-cs-green">{formatCurrency(event.salePrice)}</span>
                  </p>
                  {event.skippedLockedCount > 0 ? (
                    <p className="mt-1 text-xs text-cs-muted">
                      {event.skippedLockedCount} locked skipped
                    </p>
                  ) : null}
                </>
              ) : event.type === 'items_auto_sold' ? (
                <>
                  <p className="font-mono text-xs uppercase text-cs-green">Auto-Sold</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">
                    {event.itemCount} item{event.itemCount === 1 ? '' : 's'} matched rules
                  </p>
                  <p className="mt-1 text-sm text-cs-muted">
                    Sold for{' '}
                    <span className="font-semibold text-cs-green">{formatCurrency(event.salePrice)}</span>
                  </p>
                </>
              ) : event.type === 'achievement_unlocked' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Achievement</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.name}</p>
                  {event.reward ? (
                    <p className="mt-1 text-sm text-cs-muted">
                      New reward available
                    </p>
                  ) : null}
                </>
              ) : event.type === 'achievement_reward_claimed' ? (
                <><p className="font-mono text-xs uppercase text-rarity-special">Reward claimed</p><p className="mt-1 text-sm text-cs-text">{event.count} achievement{event.count === 1 ? '' : 's'} · {formatCurrency(event.cash)} cash</p></>
              ) : event.type === 'collection_reward_unlocked' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Collection Reward</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.title}</p>
                  <p className="mt-1 text-sm text-cs-muted">{event.effectLabel}</p>
                </>
              ) : event.type === 'game_event_started' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Event Started</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-cs-muted">{event.description}</p>
                </>
              ) : event.type === 'daily_reward_claimed' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Daily Reward</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">
                    Day {event.reward.day} claimed
                  </p>
                  <p className="mt-1 text-sm text-cs-muted">{event.reward.label}</p>
                </>
              ) : event.type === 'daily_challenge_claimed' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Challenge Complete</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.challenge.title}</p>
                  <p className="mt-1 text-sm text-cs-muted">Reward added</p>
                </>
              ) : event.type === 'daily_challenge_rerolled' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Challenge Rerolled</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.challenge.title}</p>
                  <p className="mt-1 text-sm text-cs-muted">Fresh daily task queued</p>
                </>
              ) : event.type === 'minigame_completed' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Minigame Complete</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.name}</p>
                  <p className="mt-1 text-sm text-cs-muted">
                    Earned <span className="font-semibold text-cs-green">{formatCurrency(event.reward)}</span>
                  </p>
                </>
              ) : event.type === 'quest_stage_ready' || event.type === 'quest_reward_claimed' || event.type === 'npc_item_delivered' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-classified">Quest update</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.message}</p>
                </>
              ) : event.type === 'game_event_ended' ? (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Event Ended</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.name}</p>
                </>
              ) : null}
              {event.type === 'achievement_unlocked' && event.reward ? <Link className="mt-2 inline-block text-xs font-semibold text-rarity-special underline" to="/progress?tab=achievements">Claim reward</Link> : null}
              {event.type === 'quest_stage_ready' ? <Link className="mt-2 inline-block text-xs font-semibold text-rarity-special underline" to="/quests">View quest</Link> : null}
              {event.type === 'case_opening_failed' || event.type === 'item_sale_failed' || event.type === 'trade_up_failed' ? <Link className="mt-2 inline-block text-xs font-semibold text-rarity-covert underline" to={event.type === 'case_opening_failed' ? '/cases' : event.type === 'item_sale_failed' ? '/inventory' : '/trade-ups'}>Review action</Link> : null}
            </div>
            <button
              aria-label={`Dismiss ${event.type.replaceAll('_', ' ')} notification`}
              className="grid h-8 w-8 shrink-0 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
              onClick={() => dispatch({ type: 'DISMISS_UI_EVENT', eventId: event.id })}
              title="Dismiss"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
