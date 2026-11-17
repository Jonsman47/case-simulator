import { describe, expect, it } from 'vitest'
import { getCumulativeXpForLevel } from '../career/careerProgress'
import { gameReducer } from '../data/gameReducer'
import { defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { createSaveEnvelope, parseGameSaveText } from '../utils/save'
import { calculatePrestigePointsV2, createPrestigeRecoveryProof, getLegacyVaultCapacity, getPrestigeEligibilityV2, getPrestigeXpMultiplier } from './prestigeSystem'

function item(id: string, value = 1_000): SkinInstance {
  return {
    id: `skin-${id}`, instanceId: id, weapon: 'AK-47', finish: 'Case Hardened', rarity: Rarity.Classified,
    baseValue: 100, caseIds: ['starter_case'], image: '/assets/placeholder.png', wear: WearCondition.MinimalWear,
    floatValue: .12, marketValue: value, baseMarketValue: 100, patternPremium: value - 100, paintSeed: 661,
    pattern: { family: 'case_hardened', name: 'Blue Gem — Tier 1', tier: 'iconic', premiumMultiplier: 10, referenceConfidence: 'verified' },
    isLocked: true, isFavorited: true, discoveredAt: 1,
  }
}

function eligibleState(overrides: Partial<GameState> = {}): GameState {
  const kept = item('keep', 25_000)
  const reset = item('reset', 500)
  const state: GameState = {
    ...defaultGameState,
    money: 20_000,
    inventory: [kept, reset],
    inventoryValue: 25_500,
    collectionBook: [{ skinId: kept.id, foundWearConditions: [kept.wear], bestFloat: kept.floatValue, highestValue: kept.marketValue, timesFound: 1, firstFoundAt: 1 }],
    currentRunCollectionBook: [{ skinId: kept.id, foundWearConditions: [kept.wear], bestFloat: kept.floatValue, highestValue: kept.marketValue, timesFound: 1, firstFoundAt: 1 }],
    statistics: { ...defaultGameState.statistics, casesOpened: 800, drops: 800 },
    career: {
      ...defaultGameState.career,
      currentRunXp: getCumulativeXpForLevel(25),
      lifetimeXp: getCumulativeXpForLevel(25),
      currentRunDiscoveryKeys: Array.from({ length: 100 }, (_, index) => `discovery-${index}`),
    },
    economyLedger: {
      ...defaultGameState.economyLedger,
      currentRun: { ...defaultGameState.economyLedger.currentRun, tradeUpOutputValue: 6_000 },
      itemCostBasis: { keep: 2_500, reset: 300 },
    },
    ...overrides,
  }
  return state
}

function prestigeAction(state: GameState, requestId: string, now: number, vaultItemIds: string[] = []) {
  const sourceRunId = state.economyLedger.currentRunId
  return { type: 'PRESTIGE' as const, requestId: `${requestId}:${sourceRunId}`, sourceRunId, vaultItemIds, backupProof: createPrestigeRecoveryProof(state), now }
}

describe('Prestige v38', () => {
  it('uses clamped score components and bounded tier-one points', () => {
    const state = eligibleState()
    const eligibility = getPrestigeEligibilityV2(state)
    expect(eligibility.canPrestige).toBe(true)
    expect(Object.values(eligibility.score).every((value) => value >= 0 && value <= 100)).toBe(true)
    expect(calculatePrestigePointsV2(state)).toBeGreaterThanOrEqual(4)
    expect(calculatePrestigePointsV2(state)).toBeLessThanOrEqual(10)
  })

  it('preserves exact Vault identity and cost basis while resetting non-vault run state', () => {
    const state = eligibleState()
    const action = prestigeAction(state, 'prestige-request-1', 10_000, ['keep'])
    const next = gameReducer(state, action)
    expect(next.inventory).toHaveLength(1)
    expect(next.inventory[0]).toMatchObject({ instanceId: 'keep', paintSeed: 661, floatValue: .12, isLocked: true, isFavorited: true })
    expect(next.economyLedger.itemCostBasis).toEqual({ keep: 2_500 })
    expect(next.career.currentRunXp).toBe(0)
    expect(next.currentRunCollectionBook).toEqual([])
    expect(next.prestigeSystem.runHistory[0].vaultedItemIds).toEqual(['keep'])
    const replay = gameReducer(next, action)
    expect(replay.prestigeLevel).toBe(1)
    expect(replay.prestigePoints).toBe(next.prestigePoints)
  })

  it('blocks unsafe resets and unverified backups', () => {
    const unverifiedState = eligibleState()
    const unverified = gameReducer(unverifiedState, { type: 'PRESTIGE', requestId: `unverified:${unverifiedState.economyLedger.currentRunId}`, sourceRunId: unverifiedState.economyLedger.currentRunId, vaultItemIds: [], now: 10 })
    expect(unverified.prestigeLevel).toBe(0)
    expect(unverified.lastError).toContain('backup')
    const staleProofState = { ...unverifiedState, money: unverifiedState.money + 1 }
    const stale = gameReducer(staleProofState, prestigeAction(unverifiedState, 'stale', 11))
    expect(stale.prestigeLevel).toBe(0)
    expect(stale.lastError).toContain('exact run state')
    const listed = item('listed')
    const blocked = eligibleState({ marketplace: { ...defaultGameState.marketplace, playerListings: [{ id: 'listing', item: listed, askingPrice: 100, fairMarketValue: 100, createdAt: 1, expiresAt: 2, status: 'active' }] } })
    expect(getPrestigeEligibilityV2(blocked).blockers).toContain('Cancel or complete all player market listings.')
  })

  it('caps permanent effects and migrates v37 without touching inventory', () => {
    const legacy = {
      ...eligibleState(),
      prestigeLevel: 3,
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        drop_luck: 6,
        starting_money: 6,
        inventory_capacity: 4,
        automation_speed: 4,
      },
    }
    const loaded = parseGameSaveText(JSON.stringify({ version: 37, savedAt: 100, state: legacy }))
    expect(createSaveEnvelope(loaded).version).toBe(40)
    expect(loaded.inventory.map((entry) => entry.instanceId)).toEqual(['keep', 'reset'])
    expect(loaded.prestigeSystem.highestTier).toBe(3)
    expect(loaded.prestigeSystem.perkLevels).toMatchObject({
      xpAcceleration: 2,
      startingCash: 2,
      legacyVault: 4,
      businessEfficiency: 2,
      careerCosmetics: 3,
    })
    const capped = { ...loaded.prestigeSystem, perkLevels: { ...loaded.prestigeSystem.perkLevels, xpAcceleration: 999, legacyVault: 999 } }
    expect(getPrestigeXpMultiplier(capped)).toBe(1.4)
    expect(getLegacyVaultCapacity(capped)).toBe(10)
  })
})
