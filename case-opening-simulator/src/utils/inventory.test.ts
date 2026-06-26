import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import {
  appendInventoryValueHistory,
  canPrestigeWithInventoryValue,
  getInventoryValue,
  summarizeInventoryValueHistory,
} from './inventory'

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 100,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FactoryNew,
    floatValue: 0,
    marketValue: 100,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1_782_147_600_000,
    ...overrides,
  }
}

describe('inventory valuation', () => {
  it('sums inventory value from current market prices', () => {
    const factoryNewItem = makeItem({ id: 'ak47_redline' })
    const battleScarredItem = makeItem({
      id: 'm4a4_desolate_space',
      instanceId: 'item-2',
      wear: WearCondition.BattleScarred,
      floatValue: 1,
      marketValue: 10,
    })

    expect(getInventoryValue([factoryNewItem, battleScarredItem], {
      ak47_redline: 200,
      m4a4_desolate_space: 50,
    })).toBe(229)
  })

  it('keeps only the latest bounded inventory value history', () => {
    const history = Array.from({ length: 105 }, (_, index) => ({
      timestamp: index,
      value: index,
    }))
    const nextHistory = appendInventoryValueHistory(history, 200, 105)

    expect(nextHistory).toHaveLength(100)
    expect(nextHistory[0]).toEqual({ timestamp: 6, value: 6 })
    expect(nextHistory[nextHistory.length - 1]).toEqual({ timestamp: 105, value: 200 })
  })

  it('summarizes session or 24h inventory value changes', () => {
    const now = 1_782_147_600_000
    const history = [
      { timestamp: now - 25 * 60 * 60 * 1_000, value: 100 },
      { timestamp: now, value: 125 },
    ]

    expect(summarizeInventoryValueHistory(history)).toMatchObject({
      changePercent: 25,
      periodLabel: '24h',
    })
  })

  it('checks the prestige inventory value gate', () => {
    expect(canPrestigeWithInventoryValue(999_999)).toBe(false)
    expect(canPrestigeWithInventoryValue(1_000_000)).toBe(true)
  })
})
