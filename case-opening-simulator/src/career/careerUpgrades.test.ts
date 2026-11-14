import { describe, expect, it } from 'vitest'
import { defaultGameState } from '../data/gameState'
import { gameReducer } from '../data/gameReducer'
import { Rarity, WearCondition } from '../data/models'
import { createSaveEnvelope, parseGameSaveText } from '../utils/save'
import { getCumulativeXpForLevel } from './careerProgress'
import {
  CAREER_UPGRADE_COUNTS,
  CAREER_UPGRADE_DEFINITIONS,
  createDefaultCareerUpgradeState,
  createLegacyCareerUpgradeState,
  getActiveCareerUpgradeCapabilities,
  getCareerInventoryCapacityBonus,
  getCareerMultiOpenBatch,
  getCareerOpeningAnimationSpeedBonus,
  getCareerOperatingCapacityBonus,
  getCareerUpgradeCost,
  getCareerUpgradeCurrentEffect,
  getCareerUpgradeEffect,
  getCareerUpgradeNextEffect,
  getCareerUpgradeStatus,
  normalizeCareerUpgradeState,
} from './careerUpgrades'

function levelState(level: number) {
  return {
    ...defaultGameState,
    money: 10_000_000,
    career: {
      ...defaultGameState.career,
      currentRunXp: getCumulativeXpForLevel(level),
      lifetimeXp: getCumulativeXpForLevel(level),
      specializations: Object.fromEntries(Object.entries(defaultGameState.career.specializations).map(([id, progress]) => [id, {
        ...progress,
        currentRunXp: 100_000,
        lifetimeXp: 100_000,
      }])) as typeof defaultGameState.career.specializations,
    },
  }
}

describe('career specialization upgrades', () => {
  it('registers exactly 95 stable, meaningful nodes in the requested distribution', () => {
    expect(CAREER_UPGRADE_COUNTS).toEqual({ caseOpening: 18, trading: 22, collecting: 16, tradeUps: 18, business: 21, total: 95 })
    expect(new Set(CAREER_UPGRADE_DEFINITIONS.map((definition) => definition.id)).size).toBe(95)
    for (const definition of CAREER_UPGRADE_DEFINITIONS) {
      expect(definition.consumer.length).toBeGreaterThan(5)
      expect(definition.description.length).toBeGreaterThan(20)
      expect(definition.maxLevel).toBeGreaterThan(0)
      expect(definition.effectPerLevel).toBeGreaterThan(0)
      expect(getCareerUpgradeCost(definition, 1)).toBeGreaterThan(getCareerUpgradeCost(definition, 0))
      for (let level = 0; level < definition.maxLevel; level += 1) {
        expect(getCareerUpgradeNextEffect(definition, level)).not.toBe(getCareerUpgradeCurrentEffect(definition, level))
      }
    }
  })

  it('aggregates the real effect families consumed by opening, inventory, and Business', () => {
    const upgrades = createDefaultCareerUpgradeState()
    upgrades.levels = {
      'case-opening.presentation-drive': 2,
      'case-opening.batch-controls': 3,
      'collecting.storage-cases': 2,
      'business.warehouse-racks': 1,
      'business.operating-desk': 2,
    }
    expect(getCareerOpeningAnimationSpeedBonus(upgrades)).toBeCloseTo(.2)
    expect(getCareerMultiOpenBatch(upgrades)).toBe(25)
    expect(getCareerInventoryCapacityBonus(upgrades)).toBe(200)
    expect(getCareerOperatingCapacityBonus(upgrades)).toBe(2)
    expect(getCareerUpgradeEffect(upgrades, 'inventory.capacity')).toBe(200)
  })

  it('exposes every purchased information or mechanical node through its declared runtime consumer', () => {
    for (const definition of CAREER_UPGRADE_DEFINITIONS) {
      const upgrades = createDefaultCareerUpgradeState()
      upgrades.levels = { [definition.id]: 1 }
      const capabilities = getActiveCareerUpgradeCapabilities(upgrades, definition.specialization)
      expect(capabilities).toContainEqual(expect.objectContaining({
        id: definition.id,
        consumer: definition.consumer,
        effectKey: definition.effectKey,
        effect: getCareerUpgradeCurrentEffect(definition, 1),
      }))
    }
  })

  it('keeps branches independent and provides useful, finite progression at every rank gate', () => {
    const gates = [1, 15, 35, 55, 75, 100]
    for (const specialization of ['caseOpening', 'trading', 'collecting', 'tradeUps', 'business'] as const) {
      const branch = CAREER_UPGRADE_DEFINITIONS.filter((definition) => definition.specialization === specialization)
      expect(branch.some((definition) => definition.requiredLevel <= 15)).toBe(true)
      for (const definition of branch) {
        for (const prerequisiteId of definition.prerequisites) {
          expect(CAREER_UPGRADE_DEFINITIONS.find((candidate) => candidate.id === prerequisiteId)?.specialization).toBe(specialization)
        }
        const fullNodeCost = Array.from({ length: definition.maxLevel }, (_, level) => getCareerUpgradeCost(definition, level)).reduce((sum, value) => sum + value, 0)
        expect(Number.isFinite(fullNodeCost)).toBe(true)
        expect(fullNodeCost).toBeLessThan(10_000_000)
      }
      for (const gate of gates) {
        const available = branch.filter((definition) => definition.requiredLevel <= gate)
        if (gate >= Math.min(...branch.map((definition) => definition.requiredLevel))) {
          expect(available.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('enforces level, prerequisite, cash, and reducer-side maximum checks', () => {
    const lockedDefinition = CAREER_UPGRADE_DEFINITIONS.find((definition) => definition.id === 'case-opening.probability-table')!
    const locked = getCareerUpgradeStatus(lockedDefinition, { career: levelState(100).career, money: 1_000_000, upgrades: createDefaultCareerUpgradeState() })
    expect(locked.prerequisitesMet).toBe(false)

    let state = levelState(100)
    state = gameReducer(state, { type: 'PURCHASE_CAREER_UPGRADE', upgradeId: 'case-opening.presentation-drive', now: 100 })
    expect(state.careerUpgrades.levels['case-opening.presentation-drive']).toBe(1)
    expect(state.money).toBeLessThan(10_000_000)
    state = gameReducer({ ...state, careerUpgrades: { ...state.careerUpgrades, levels: { ...state.careerUpgrades.levels, 'case-opening.presentation-drive': 3 } } }, { type: 'PURCHASE_CAREER_UPGRADE', upgradeId: 'case-opening.presentation-drive', now: 101 })
    expect(state.careerUpgrades.levels['case-opening.presentation-drive']).toBe(3)
    expect(state.lastError).toBe('Career upgrade is already maxed.')
  })

  it('converts legacy progression once into bounded noncash credit and round-trips v37', () => {
    const migrated = createLegacyCareerUpgradeState({ now: 123, skillPoints: 50, upgradePoints: 20, learnedSkillCount: 80, legacyUpgradeLevels: 20 })
    expect(migrated.migration.applied).toBe(true)
    expect(migrated.migration.transitionCredit).toBeLessThanOrEqual(75_000)
    expect(normalizeCareerUpgradeState(migrated, 999)).toEqual(migrated)
    const state = { ...defaultGameState, careerUpgrades: migrated }
    const loaded = parseGameSaveText(JSON.stringify(createSaveEnvelope(state)))
    expect(loaded.careerUpgrades).toEqual(expect.objectContaining({ levels: {}, migration: expect.objectContaining({ applied: true, transitionCredit: migrated.migration.transitionCredit }) }))
  })

  it.each([33, 34, 35, 36, 37])('migrates v%s saves without changing item identity or awarding credit twice', (version) => {
    const item = {
      id: 'ak47_case_hardened',
      instanceId: 'migration-pattern-661',
      weapon: 'AK-47',
      finish: 'Case Hardened',
      rarity: Rarity.Classified,
      baseValue: 100,
      caseIds: ['starter_case'],
      image: '/assets/placeholder.png',
      wear: WearCondition.MinimalWear,
      floatValue: 0.1,
      marketValue: 1_000,
      paintSeed: 661,
      isLocked: true,
      isFavorited: true,
      discoveredAt: 123,
    }
    const state = {
      ...defaultGameState,
      inventory: [item],
      skillPoints: 3,
      upgradePoints: 2,
      careerUpgrades: version === 37 ? createLegacyCareerUpgradeState({ now: 123, skillPoints: 3, upgradePoints: 2, learnedSkillCount: 0, legacyUpgradeLevels: 0 }) : undefined,
    }
    const first = parseGameSaveText(JSON.stringify({ version, savedAt: 123, state }))
    const second = parseGameSaveText(JSON.stringify(createSaveEnvelope(first)))
    expect(second.inventory[0]).toMatchObject({ instanceId: item.instanceId, paintSeed: 661, floatValue: .1, isLocked: true, isFavorited: true })
    expect(second.careerUpgrades.migration.initialTransitionCredit).toBe(first.careerUpgrades.migration.initialTransitionCredit)
    expect(second.careerUpgrades.migration.transitionCredit).toBe(first.careerUpgrades.migration.transitionCredit)
  })

  it('resets run upgrades on Prestige without regenerating transition credit', () => {
    const state = levelState(100)
    const eligible = {
      ...state,
      inventoryValue: 1_000_000,
      statistics: { ...state.statistics, casesOpened: 25_000, moneyEarned: 500_000, moneySpent: 250_000 },
      careerUpgrades: {
        ...createLegacyCareerUpgradeState({ now: 1, skillPoints: 1, upgradePoints: 1, learnedSkillCount: 1, legacyUpgradeLevels: 1 }),
        levels: { 'case-opening.presentation-drive': 2 },
      },
      career: {
        ...state.career,
        currentRunDiscoveryKeys: Array.from({ length: 100 }, (_, index) => `run-discovery-${index}`),
      },
      economyLedger: {
        ...state.economyLedger,
        currentRun: { ...state.economyLedger.currentRun, tradeUpOutputValue: 6_000 },
      },
    }
    const credit = eligible.careerUpgrades.migration.transitionCredit
    const prestiged = gameReducer(eligible, { type: 'PRESTIGE', now: 2 })
    expect(prestiged.careerUpgrades.levels).toEqual({})
    expect(prestiged.careerUpgrades.migration.transitionCredit).toBe(credit)
  })
})
