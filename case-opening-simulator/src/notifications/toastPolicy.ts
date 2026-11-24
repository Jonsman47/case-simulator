import type { GameUiEvent } from '../data/gameState'

export type ToastPriority = 'critical' | 'important' | 'routine'

const criticalTypes = new Set<GameUiEvent['type']>([
  'case_opening_failed', 'item_sale_failed', 'trade_up_failed',
])

const importantTypes = new Set<GameUiEvent['type']>([
  'achievement_unlocked', 'collection_reward_unlocked', 'game_event_started',
  'achievement_reward_claimed', 'daily_reward_claimed', 'daily_challenge_claimed', 'quest_stage_ready',
  'quest_reward_claimed',
])

const toastTypes = new Set<GameUiEvent['type']>([
  ...criticalTypes, ...importantTypes,
  'item_sold', 'items_sold', 'items_auto_sold', 'game_event_ended',
  'daily_challenge_rerolled', 'minigame_completed', 'npc_item_delivered',
])

export function isToastEvent(event: GameUiEvent) {
  return toastTypes.has(event.type)
}

export function getToastPriority(event: GameUiEvent): ToastPriority {
  if (criticalTypes.has(event.type)) return 'critical'
  if (importantTypes.has(event.type)) return 'important'
  return 'routine'
}

export function getToastLifetime(event: GameUiEvent) {
  const priority = getToastPriority(event)
  return priority === 'critical' ? undefined : priority === 'important' ? 8_000 : 4_000
}

export function selectVisibleToasts(events: GameUiEvent[], blocked: boolean) {
  const unique = new Set<string>()
  const candidates = events.filter((event) => {
    if (!isToastEvent(event)) return false
    const key = `${event.type}:${event.id}`
    if (unique.has(key)) return false
    unique.add(key)
    return true
  })
  const critical = candidates.filter((event) => getToastPriority(event) === 'critical')
  if (blocked) return critical
  const noncritical = candidates.filter((event) => getToastPriority(event) !== 'critical')
  return [...critical, ...noncritical.slice(0, 3)]
}
