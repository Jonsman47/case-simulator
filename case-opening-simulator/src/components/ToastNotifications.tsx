import { X } from 'lucide-react'
import type { GameUiEvent } from '../data/gameState'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'

type ItemSoldEvent = Extract<GameUiEvent, { type: 'item_sold' }>
type ItemsSoldEvent = Extract<GameUiEvent, { type: 'items_sold' }>
type ItemsAutoSoldEvent = Extract<GameUiEvent, { type: 'items_auto_sold' }>
type AchievementUnlockedEvent = Extract<GameUiEvent, { type: 'achievement_unlocked' }>
type CollectionRewardUnlockedEvent = Extract<GameUiEvent, { type: 'collection_reward_unlocked' }>
type GameEventStartedEvent = Extract<GameUiEvent, { type: 'game_event_started' }>
type GameEventEndedEvent = Extract<GameUiEvent, { type: 'game_event_ended' }>
type DailyRewardClaimedEvent = Extract<GameUiEvent, { type: 'daily_reward_claimed' }>
type DailyChallengeClaimedEvent = Extract<GameUiEvent, { type: 'daily_challenge_claimed' }>
type DailyChallengeRerolledEvent = Extract<GameUiEvent, { type: 'daily_challenge_rerolled' }>
type MinigameCompletedEvent = Extract<GameUiEvent, { type: 'minigame_completed' }>
type SaleEvent = ItemSoldEvent | ItemsSoldEvent | ItemsAutoSoldEvent
type ToastEvent =
  | SaleEvent
  | AchievementUnlockedEvent
  | CollectionRewardUnlockedEvent
  | GameEventStartedEvent
  | GameEventEndedEvent
  | DailyRewardClaimedEvent
  | DailyChallengeClaimedEvent
  | DailyChallengeRerolledEvent
  | MinigameCompletedEvent

function isSaleEvent(event: GameUiEvent): event is SaleEvent {
  return event.type === 'item_sold' || event.type === 'items_sold' || event.type === 'items_auto_sold'
}

function isToastEvent(event: GameUiEvent): event is ToastEvent {
  return (
    isSaleEvent(event) ||
    event.type === 'achievement_unlocked' ||
    event.type === 'collection_reward_unlocked' ||
    event.type === 'game_event_started' ||
    event.type === 'game_event_ended' ||
    event.type === 'daily_reward_claimed' ||
    event.type === 'daily_challenge_claimed' ||
    event.type === 'daily_challenge_rerolled' ||
    event.type === 'minigame_completed'
  )
}

export function ToastNotifications() {
  const { clearUiEvents, state } = useGame()
  const toastEvents = state.uiEvents
    .filter(isToastEvent)
    .filter((event) => state.settings.autoSellNotificationsEnabled || event.type !== 'items_auto_sold')
    .slice(0, 3)

  if (toastEvents.length === 0) {
    return null
  }

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toastEvents.map((event) => (
        <div
          className={[
            'border bg-cs-surface p-3 shadow-glow',
            event.type === 'achievement_unlocked' ||
              event.type === 'collection_reward_unlocked' ||
              event.type === 'game_event_started' ||
              event.type === 'game_event_ended' ||
              event.type === 'daily_reward_claimed' ||
              event.type === 'daily_challenge_claimed' ||
              event.type === 'daily_challenge_rerolled' ||
              event.type === 'minigame_completed'
              ? 'border-rarity-special'
              : 'border-cs-green',
          ].join(' ')}
          key={event.id}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {event.type === 'item_sold' ? (
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
              ) : (
                <>
                  <p className="font-mono text-xs uppercase text-rarity-special">Event Ended</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">{event.name}</p>
                </>
              )}
            </div>
            <button
              aria-label="Dismiss sale notification"
              className="grid h-8 w-8 shrink-0 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
              onClick={clearUiEvents}
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
