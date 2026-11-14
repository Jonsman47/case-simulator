import { describe, expect, it } from 'vitest'
import { getCumulativeXpForLevel, recordCareerAction } from '../../career/careerProgress'
import { CAREER_UPGRADE_COUNTS } from '../../career/careerUpgrades'
import { CASE_DEFINITIONS } from '../../data/cases'
import { defaultGameState } from '../../data/gameState'
import { createInitialMarketValues } from '../../market/marketSimulation'
import { generateVirtualListingPage, getCredibleDealScore } from '../../marketplace/virtualMarket'
import { SKIN_DEFINITIONS } from '../../data/skins'
import {
  auditCareerUpgrades,
  auditEmployeeEconomy,
  getFiveTierMasteryHours,
  runCareerSimulations,
  selectRepresentativeCases,
  simulatePatternAwareCaseEconomy,
} from './index'

describe('career economy simulation framework', () => {
  it('is deterministic and covers every profile/decision-quality combination', () => {
    const config = { seed: 0xC52E_2026, careersPerCombination: 100, maximumEngagedHours: 800 }
    const first = runCareerSimulations(config)
    const second = runCareerSimulations(config)
    expect(first).toEqual(second)
    expect(first).toHaveLength(30)
    expect(first.every((entry) => entry.sampleSize === 100)).toBe(true)
    expect(first.find((entry) => entry.profile === 'regular' && entry.quality === 'competent')?.hoursToLevel15.median).toBeGreaterThan(15)
    expect(first.find((entry) => entry.profile === 'regular' && entry.quality === 'competent')?.hoursToLevel15.median).toBeLessThan(35)
  })

  it('keeps five-tier mastery in the intended long-term range for a competent mixed player', () => {
    const projection = getFiveTierMasteryHours(2_750)
    expect(projection.tiers).toHaveLength(5)
    expect(projection.cumulativeHours).toBeGreaterThanOrEqual(500)
    expect(projection.cumulativeHours).toBeLessThanOrEqual(800)
  })

  it('audits all 95 upgrades and every employee training level without modeling free cash', () => {
    const upgrades = auditCareerUpgrades()
    const employees = auditEmployeeEconomy()
    expect(CAREER_UPGRADE_COUNTS.total).toBe(95)
    expect(upgrades).toHaveLength(95)
    expect(upgrades.every((entry) => entry.totalCurrentCost > 0 && entry.practicalBenefit.length > 0)).toBe(true)
    expect(employees).toHaveLength(45)
    expect(employees.every((entry) => entry.directCashCreation === 0 && entry.hourlyWage > 0)).toBe(true)
  })

  it('runs repeatable pattern-aware case samples without modifying production odds', () => {
    const cases = selectRepresentativeCases(CASE_DEFINITIONS, SKIN_DEFINITIONS)
    const marketValues = createInitialMarketValues()
    const request = { caseDef: cases[0], iterations: 2_000, marketValues, seed: 52_026, skins: SKIN_DEFINITIONS }
    const first = simulatePatternAwareCaseEconomy(request)
    const second = simulatePatternAwareCaseEconomy(request)
    expect(first).toEqual(second)
    expect(first.iterations).toBe(2_000)
    expect(first.rareDropRate).toBeGreaterThanOrEqual(0)
    expect(first.rareDropRate).toBeLessThan(0.1)
  })

  it('uses credible valuation confidence when ranking deterministic virtual deals', () => {
    const skin = SKIN_DEFINITIONS.find((entry) => entry.rarity !== 'Contraband')!
    const marketValues = createInitialMarketValues()
    const page = generateVirtualListingPage({ skin, marketValues, epoch: 20, seed: 50_005, sort: 'best-deals', page: 0 })
    expect(page.listings.length).toBeGreaterThan(0)
    for (let index = 1; index < page.listings.length; index += 1) {
      expect(getCredibleDealScore(page.listings[index - 1])).toBeGreaterThanOrEqual(getCredibleDealScore(page.listings[index]))
    }
  })

  it('records legitimate offline business XP once and rejects replay', () => {
    const before = structuredClone(defaultGameState)
    const operation = {
      id: 'offline-operation-1',
      employeeRole: 'salesAssistant' as const,
      type: 'instant-sale' as const,
      timestamp: 10_000,
      description: 'Offline duplicate sale',
      grossVolume: 100,
      revenue: 90,
      expense: 0,
      realizedProfit: 10,
      relatedItemIds: ['item-1'],
    }
    const after = {
      ...structuredClone(before),
      lastSaved: 10_000,
      business: { ...structuredClone(before.business), recentOperations: [operation] },
    }
    const first = recordCareerAction(before, after, { type: 'APPLY_OFFLINE_PROGRESS', state: after })
    const replay = recordCareerAction(first, first, { type: 'APPLY_OFFLINE_PROGRESS', state: first })
    expect(first.career.currentRunXp).toBeGreaterThan(0)
    expect(replay.career.currentRunXp).toBe(first.career.currentRunXp)
    expect(replay.career.processedEventIds.filter((id) => id === 'business:offline-operation-1')).toHaveLength(1)
  })

  it('keeps the tuned early curve faster while preserving a substantial level-100 gate', () => {
    expect(getCumulativeXpForLevel(15)).toBe(67_919)
    expect(getCumulativeXpForLevel(25)).toBe(166_176)
    expect(getCumulativeXpForLevel(100)).toBe(3_115_980)
  })
})
