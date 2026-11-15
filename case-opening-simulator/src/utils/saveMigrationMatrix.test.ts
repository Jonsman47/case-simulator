import { describe, expect, it } from 'vitest'
import { defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { CURRENT_SAVE_VERSION, MAX_PERSISTED_INVENTORY_ITEMS, SaveGameError, createSaveEnvelope, parseGameSaveText, serializeGameState } from './save'

const SAVED_AT = 1_782_147_700_000

function valuableItem(): SkinInstance {
  return {
    id: 'ak-case-hardened', instanceId: 'legacy-blue-gem', weapon: 'AK-47', finish: 'Case Hardened',
    rarity: Rarity.Classified, baseValue: 100, caseIds: ['starter_case'], image: '/assets/placeholder.png',
    wear: WearCondition.MinimalWear, floatValue: .1234, marketValue: 25_000, baseMarketValue: 2_500,
    paintSeed: 661, patternPremium: 22_500,
    pattern: { family: 'case_hardened', name: 'Blue Gem — Tier 1', tier: 'iconic', premiumMultiplier: 10, referenceConfidence: 'verified' },
    isLocked: true, isFavorited: true, discoveredAt: SAVED_AT - 1_000,
  }
}

function fixture(version: number) {
  const state = structuredClone({
    ...defaultGameState,
    money: 12_345.67,
    inventory: [valuableItem()],
    inventoryValue: 25_000,
    lastSaved: SAVED_AT,
  }) as Partial<GameState> & Pick<GameState, 'inventory' | 'marketplace'>

  if (version < 38) {
    delete state.prestigeSystem
    delete state.currentRunCollectionBook
  }
  if (version < 37) delete state.careerUpgrades
  if (version < 36) delete state.business
  if (version < 35) delete state.career
  if (version < 34) delete state.economyLedger
  if (version < 33) {
    state.marketplace.virtualMarketEpoch = 12
    state.marketplace.virtualMarketNextEpochAt = 13
  }
  if (version < 32) {
    const marketplace = state.marketplace as unknown as Record<string, unknown>
    delete marketplace.virtualMarketEpoch
    delete marketplace.virtualMarketNextEpochAt
    delete marketplace.virtualMarketSeed
    delete marketplace.removedVirtualListingIds
  }
  return { version, savedAt: SAVED_AT, state }
}

describe('v31-v39 save migration matrix', () => {
  for (const version of [31, 32, 33, 34, 35, 36, 37, 38, 39]) {
    it(`migrates v${version} deterministically without changing valuable item identity`, () => {
      const loaded = parseGameSaveText(JSON.stringify(fixture(version)))
      expect(loaded.money).toBe(12_345.67)
      expect(loaded.inventory).toHaveLength(1)
      expect(loaded.inventory[0]).toMatchObject({
        instanceId: 'legacy-blue-gem', paintSeed: 661, floatValue: .1234, marketValue: 25_000,
        isLocked: true, isFavorited: true,
      })
      const first = serializeGameState(loaded)
      const reloaded = parseGameSaveText(first)
      const second = createSaveEnvelope(reloaded)
      expect(second.version).toBe(CURRENT_SAVE_VERSION)
      expect(reloaded.money).toBe(loaded.money)
      expect(reloaded.inventory).toEqual(loaded.inventory)
      expect(reloaded.career.lifetimeXp).toBe(loaded.career.lifetimeXp)
      expect(reloaded.prestigePoints).toBe(loaded.prestigePoints)
      expect(reloaded.prestigeSystem.totalPointsEarned).toBe(loaded.prestigeSystem.totalPointsEarned)
    })
  }
})

describe('save corruption fails closed', () => {
  it('rejects truncated JSON and unknown future schemas', () => {
    expect(() => parseGameSaveText('{"version":39')).toThrow(SaveGameError)
    expect(() => parseGameSaveText(JSON.stringify({ ...fixture(39), version: 999 }))).toThrow('newer version')
  })

  it('rejects invalid floats, pattern IDs, and duplicate identities', () => {
    const invalidFloat = fixture(39)
    invalidFloat.state.inventory[0].floatValue = 1.5
    expect(() => parseGameSaveText(JSON.stringify(invalidFloat))).toThrow('invalid inventory')
    const invalidPattern = fixture(39)
    invalidPattern.state.inventory[0].paintSeed = 1001
    expect(() => parseGameSaveText(JSON.stringify(invalidPattern))).toThrow('invalid inventory')
    const duplicate = fixture(39)
    duplicate.state.inventory.push({ ...duplicate.state.inventory[0], marketValue: 999_999 })
    expect(() => parseGameSaveText(JSON.stringify(duplicate))).toThrow('duplicate item identity')
  })

  it('rejects impossible escrow and excessive inventory without deleting data', () => {
    const duplicateEscrow = fixture(39)
    duplicateEscrow.state.marketplace.playerListings = [{
      id: 'listing', item: duplicateEscrow.state.inventory[0], askingPrice: 25_000, fairMarketValue: 25_000,
      createdAt: SAVED_AT, expiresAt: SAVED_AT + 1_000, status: 'active',
    }]
    expect(() => parseGameSaveText(JSON.stringify(duplicateEscrow))).toThrow('both inventory and marketplace escrow')

    const excessive = fixture(39)
    excessive.state.inventory = Array.from({ length: MAX_PERSISTED_INVENTORY_ITEMS + 1 }, (_, index) => ({
      ...valuableItem(), instanceId: `item-${index}`,
    }))
    expect(() => parseGameSaveText(JSON.stringify(excessive))).toThrow('too large')
  })
})
