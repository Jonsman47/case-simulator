import { describe, expect, it } from 'vitest'
import { defaultGameState, type GameUiEvent } from '../data/gameState'
import { gameReducer } from '../data/gameReducer'
import { getNotificationCountForPath } from './notificationSelectors'
import { getToastLifetime, selectVisibleToasts } from './toastPolicy'

const achievement: GameUiEvent = { id: 'earned:one', type: 'achievement_unlocked', achievementId: 'first_case_opened', name: 'First case', reward: { money: 10 }, createdAt: 1 }

describe('notification identity and lifetime', () => {
  it('removes one event without touching unrelated queued events or claimable badges', () => {
    const state = {
      ...defaultGameState,
      uiEvents: [achievement, { id: 'sale:one', type: 'item_sale_failed' as const, itemId: 'skin', message: 'Protected item.', createdAt: 2 }],
      achievements: [{ id: 'first_case_opened', isClaimed: false, unlockedAt: 1 }],
    }
    const count = getNotificationCountForPath(state, '/progress')
    expect(count).toBeGreaterThan(0)
    const next = gameReducer(state, { type: 'DISMISS_UI_EVENT', eventId: achievement.id })
    expect(next.uiEvents).toHaveLength(1)
    expect(next.uiEvents[0].id).toBe('sale:one')
    expect(getNotificationCountForPath(next, '/progress')).toBe(count)
  })

  it('keeps critical alerts visible through a blocked presentation and never times them out', () => {
    const error: GameUiEvent = { id: 'failed', type: 'case_opening_failed', caseId: 'starter', message: 'Not enough cash.', createdAt: 2 }
    expect(selectVisibleToasts([achievement, error], true)).toEqual([error])
    expect(getToastLifetime(achievement)).toBe(8_000)
    expect(getToastLifetime(error)).toBeUndefined()
    expect(selectVisibleToasts([achievement, achievement, error], false)).toEqual([error, achievement])
  })

  it('global administrative clearing does not claim an achievement reward', () => {
    const state = { ...defaultGameState, uiEvents: [achievement], achievements: [{ id: 'first_case_opened', isClaimed: false, unlockedAt: 1 }] }
    const cleared = gameReducer(state, { type: 'CLEAR_UI_EVENTS' })
    expect(cleared.uiEvents).toEqual([])
    expect(cleared.achievements[0].isClaimed).toBe(false)
  })

  it('does not replay temporary notifications from a loaded save', () => {
    const loaded = gameReducer(defaultGameState, { type: 'REPLACE_GAME_STATE', state: { ...defaultGameState, uiEvents: [achievement] } })
    expect(loaded.uiEvents).toEqual([])
  })
})
