import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../data/achievements'
import { defaultGameState, type GameState } from '../data/gameState'
import { getGameNotifications, getNotificationCountForPath, getNotificationCountForPaths } from './notificationSelectors'

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    ...overrides,
    ui: {
      ...defaultGameState.ui,
      ...overrides.ui,
      notifications: { ...defaultGameState.ui.notifications, ...overrides.ui?.notifications },
      onboarding: { ...defaultGameState.ui.onboarding, ...overrides.ui?.onboarding },
      tradeUpHistory: overrides.ui?.tradeUpHistory ?? [],
    },
  }
}

describe('notification selectors', () => {
  it('derives exactly three claimable achievements and drops after a claim', () => {
    const definitions = ACHIEVEMENTS.filter((achievement) => achievement.reward).slice(0, 3)
    const base = state({ achievements: definitions.map((achievement, index) => ({ id: achievement.id, isClaimed: false, unlockedAt: index + 1 })) })
    expect(getNotificationCountForPath(base, '/progress')).toBe(3)
    const claimed = state({ achievements: base.achievements.map((entry, index) => index === 0 ? { ...entry, isClaimed: true } : entry) })
    expect(getNotificationCountForPath(claimed, '/progress')).toBe(2)
    expect(getNotificationCountForPath(state({ achievements: claimed.achievements.map((entry) => ({ ...entry, isClaimed: true })) }), '/progress')).toBe(0)
  })

  it('deduplicates parent counts from child paths', () => {
    const achievement = ACHIEVEMENTS.find((entry) => entry.reward)!
    const base = state({ achievements: [{ id: achievement.id, isClaimed: false, unlockedAt: 1 }] })
    expect(getNotificationCountForPaths(base, ['/progress', '/progress'])).toBe(1)
  })

  it('counts business actions and journal unread identities without persisting totals', () => {
    const base = state({
      business: { ...defaultGameState.business, pendingTradeUpApproval: { id: 'approval', inputItemIds: [], inputValue: 10, expectedOutputValue: 12, expectedProfit: 2, expectedRoi: .2, createdAt: 1, reason: 'Review' } },
      dropJournal: { ...defaultGameState.dropJournal, entries: [{ id: 'journal:item', eventId: 'event', instanceId: 'item', skinId: 'skin', weapon: 'AK-47', finish: 'Test', image: '/x.png', rarity: 'Covert' as never, wear: 'FactoryNew' as never, floatValue: .01, valueAtDiscovery: 100, discoveredAt: 1, runId: 'run', isFirstRare: true, isPersonalBest: true }] },
    })
    expect(getNotificationCountForPath(base, '/business')).toBe(1)
    expect(getNotificationCountForPath(base, '/quests')).toBeGreaterThanOrEqual(1)
    const read = state({ ...base, ui: { ...base.ui, notifications: { ...base.ui.notifications, readDropJournalEntryIds: ['journal:item'] } } })
    expect(getGameNotifications(read).some((entry) => entry.id === 'journal:journal:item')).toBe(false)
  })
})
