import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { selectTradeUpQuickFill } from './tradeUpQuickFill'

function item(index: number, overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: `skin-${index}`,
    weapon: 'P250',
    finish: `Finish ${index}`,
    rarity: Rarity.Consumer,
    baseValue: index + 1,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: `item-${index}`,
    wear: WearCondition.FieldTested,
    floatValue: (index + 1) / 100,
    marketValue: index + 1,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1,
    ...overrides,
  }
}

describe('trade-up quick fill', () => {
  it('fills the cheapest unique eligible items', () => {
    const candidates = Array.from({ length: 14 }, (_, index) => item(index))
    const result = selectTradeUpQuickFill({ candidates: candidates.reverse(), capacity: 10, marketValues: {}, mode: 'cheapest', selectedItems: [] })
    expect(result.itemIds).toEqual(Array.from({ length: 10 }, (_, index) => `item-${index}`))
    expect(new Set(result.itemIds).size).toBe(10)
  })

  it('fills remaining slots without replacing existing selection', () => {
    const candidates = Array.from({ length: 12 }, (_, index) => item(index))
    const result = selectTradeUpQuickFill({ candidates, capacity: 10, marketValues: {}, mode: 'remaining', selectedItems: candidates.slice(0, 3) })
    expect(result.itemIds.slice(0, 3)).toEqual(['item-0', 'item-1', 'item-2'])
    expect(result.itemIds).toHaveLength(10)
    expect(new Set(result.itemIds).size).toBe(10)
  })

  it('uses actual float order for lowest-float fill', () => {
    const candidates = [item(1, { floatValue: .4 }), item(2, { floatValue: .01 }), item(3, { floatValue: .2 })]
    const result = selectTradeUpQuickFill({ candidates, capacity: 2, marketValues: {}, mode: 'lowest-float', selectedItems: [] })
    expect(result.itemIds).toEqual(['item-2', 'item-3'])
  })

  it('keeps random selection inside one compatible edition group', () => {
    const regular = Array.from({ length: 10 }, (_, index) => item(index))
    const statTrak = Array.from({ length: 10 }, (_, index) => item(index + 20, { statTrak: true }))
    const result = selectTradeUpQuickFill({ candidates: [...regular, ...statTrak], capacity: 10, marketValues: {}, mode: 'random', random: () => .99, selectedItems: [] })
    expect(result.itemIds).toHaveLength(10)
    expect(result.itemIds.every((id) => Number(id.replace('item-', '')) >= 20)).toBe(true)
  })

  it('never selects protected items and does not partially mutate Random 10', () => {
    const candidates = [
      ...Array.from({ length: 9 }, (_, index) => item(index)),
      item(20, { isLocked: true }),
      item(21, { isFavorited: true }),
    ]
    const result = selectTradeUpQuickFill({ candidates, capacity: 10, marketValues: {}, mode: 'random', random: () => .5, selectedItems: [] })
    expect(result.itemIds).toEqual([])
    expect(result.addedIds).toEqual([])
    expect(result.message).toContain('only 9')
  })

  it('supports the five-Covert contract capacity', () => {
    const candidates = Array.from({ length: 6 }, (_, index) => item(index, { rarity: Rarity.Covert }))
    const result = selectTradeUpQuickFill({ candidates, capacity: 5, marketValues: {}, mode: 'random', random: () => .2, selectedItems: [] })
    expect(result.itemIds).toHaveLength(5)
  })
})
