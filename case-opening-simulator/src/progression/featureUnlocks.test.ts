import { describe, expect, it } from 'vitest'
import { defaultGameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { analyzeTradeUp } from '../utils/tradeUp'
import { getFeatureProgress, getTradeUpEligibleProgress } from './featureUnlocks'

const sample = SKIN_DEFINITIONS.find((skin) => skin.rarity === Rarity.MilSpec && skin.caseIds.length > 0)!
function item(index: number): SkinInstance {
  return { ...sample, instanceId: `eligible-${index}`, wear: WearCondition.FieldTested, floatValue: 0.2, marketValue: 1, isLocked: false, isFavorited: false, discoveredAt: index }
}

describe('feature progression', () => {
  it('starts with core gameplay and real milestones', () => {
    const features = getFeatureProgress(defaultGameState)
    expect(features.find((entry) => entry.id === 'collection-book')).toMatchObject({ current: 0, unlocked: false })
    expect(features.find((entry) => entry.id === 'quests')).toMatchObject({ current: 0, unlocked: false })
    expect(features.find((entry) => entry.id === 'business')?.unlocked).toBe(false)
    expect(features.find((entry) => entry.id === 'prestige')?.unlocked).toBe(false)
  })

  it('unlocks collection and quests from a genuine opening', () => {
    const state = { ...defaultGameState, inventory: [item(0)], statistics: { ...defaultGameState.statistics, casesOpened: 1 } }
    expect(getFeatureProgress(state).find((entry) => entry.id === 'collection-book')?.unlocked).toBe(true)
    expect(getFeatureProgress(state).find((entry) => entry.id === 'quests')?.unlocked).toBe(true)
  })

  it('requires a real eligible contract rather than ten arbitrary items', () => {
    const compatible = Array.from({ length: 10 }, (_, index) => item(index))
    expect(analyzeTradeUp({ inputItems: compatible, marketValues: defaultGameState.marketValues }).canTradeUp).toBe(true)
    const state = { ...defaultGameState, inventory: compatible }
    expect(getTradeUpEligibleProgress(state)).toBe(10)
    expect(getFeatureProgress(state).find((entry) => entry.id === 'trade-ups')?.unlocked).toBe(true)
    const incompatible = compatible.map((entry, index) => ({ ...entry, isLocked: index % 2 === 0 }))
    expect(getTradeUpEligibleProgress({ ...defaultGameState, inventory: incompatible })).toBeLessThan(10)
  })

  it('keeps a recorded unlock after inputs are consumed', () => {
    const state = { ...defaultGameState, ui: { ...defaultGameState.ui, featureUnlocks: { unlockedIds: ['trade-ups' as const], acknowledgedIds: [], introducedIds: [] } } }
    expect(getFeatureProgress(state).find((entry) => entry.id === 'trade-ups')?.unlocked).toBe(true)
  })
})
