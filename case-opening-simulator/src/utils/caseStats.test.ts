import { describe, expect, it } from 'vitest'
import { CaseStatus, Rarity, type CaseDefinition, type SkinBase } from '../data/models'
import { calculateCaseStats, simulateCaseOpenings } from './caseStats'

const testSkins: SkinBase[] = [
  {
    id: 'cheap_skin',
    weapon: 'P250',
    finish: 'Budget',
    rarity: Rarity.Consumer,
    baseValue: 10,
    caseIds: ['math_case'],
    image: '/assets/placeholder.png',
  },
  {
    id: 'expensive_skin',
    weapon: 'AK-47',
    finish: 'Jackpot',
    rarity: Rarity.Covert,
    baseValue: 100,
    caseIds: ['math_case'],
    image: '/assets/placeholder.png',
  },
]

const testCase: CaseDefinition = {
  id: 'math_case',
  name: 'Math Case',
  cost: 20,
  status: CaseStatus.Unlocked,
  image: '/assets/placeholder.png',
  dropTable: [
    { skinId: 'cheap_skin', weight: 75 },
    { skinId: 'expensive_skin', weight: 25 },
  ],
}

describe('case stats', () => {
  it('summarizes the current drop table and market data without case EV fields', () => {
    const stats = calculateCaseStats(testCase, {
      cheap_skin: 10,
      expensive_skin: 100,
    }, testSkins)

    expect(stats.totalWeight).toBe(100)
    expect(stats.bestDrop?.skin.id).toBe('expensive_skin')
    expect(stats.bestDrop?.chance).toBe(25)
    expect(stats.rarityStats).toEqual([
      {
        itemCount: 1,
        probability: 75,
        rarity: Rarity.Consumer,
        weight: 75,
      },
      {
        itemCount: 1,
        probability: 25,
        rarity: Rarity.Covert,
        weight: 25,
      },
    ])
  })

  it('simulates openings near the mathematical expected value', () => {
    const result = simulateCaseOpenings({
      applyAutoSell: false,
      autoSellRules: [],
      caseDef: testCase,
      iterations: 10_000,
      marketValues: {
        cheap_skin: 10,
        expensive_skin: 100,
      },
      seed: 42,
      skins: testSkins,
    })

    expect(result.iterations).toBe(10_000)
    expect(result.averageDropValue).toBeGreaterThan(31)
    expect(result.averageDropValue).toBeLessThan(34)
    expect(result.averageProfit).toBeGreaterThan(11)
    expect(result.averageProfit).toBeLessThan(14)
    expect(result.bestDropChance).toBeGreaterThan(24)
    expect(result.bestDropChance).toBeLessThan(26)
  })
})
