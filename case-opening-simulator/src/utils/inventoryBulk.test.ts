import { describe, expect, it } from 'vitest'
import { AutoSellRuleType, Rarity, WearCondition, type SkinInstance } from '../data/models'
import { getSelectedItemsValue, selectDuplicates } from './inventoryBulk'

function makeItem(overrides: Partial<SkinInstance>): SkinInstance {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 40,
    caseIds: ['test_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FactoryNew,
    floatValue: 0.03,
    marketValue: 30,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1,
    ...overrides,
  }
}

describe('inventory bulk helpers', () => {
  it('sums selected unlocked items with current market values', () => {
    const inventory = [
      makeItem({ instanceId: 'item-1', id: 'skin-1', floatValue: 0 }),
      makeItem({ instanceId: 'item-2', id: 'skin-2', isLocked: true }),
    ]

    expect(getSelectedItemsValue(inventory, { 'skin-1': 100, 'skin-2': 200 }, ['item-1', 'item-2'])).toBe(
      105,
    )
  })

  it('selects duplicate copies while keeping the highest-value or best-float version', () => {
    const inventory = [
      makeItem({
        instanceId: 'keeper-high-value',
        id: 'skin-1',
        floatValue: 0.06,
        marketValue: 100,
      }),
      makeItem({
        instanceId: 'sell-lower-value',
        id: 'skin-1',
        floatValue: 0.01,
        marketValue: 50,
      }),
      makeItem({
        instanceId: 'favorited-copy',
        id: 'skin-1',
        isFavorited: true,
        marketValue: 20,
      }),
      makeItem({
        instanceId: 'special-copy',
        id: 'knife-gold',
        rarity: Rarity.SpecialItem,
      }),
      makeItem({
        instanceId: 'special-keeper',
        id: 'knife-gold',
        rarity: Rarity.SpecialItem,
        marketValue: 999,
      }),
      makeItem({ instanceId: 'same-value-best-float', id: 'skin-2', floatValue: 0.01 }),
      makeItem({ instanceId: 'same-value-worse-float', id: 'skin-2', floatValue: 0.06 }),
    ]
    const selectedIds = selectDuplicates(
      inventory,
      {
        'skin-2': 50,
        'knife-gold': 1000,
      },
      [],
    )

    expect(selectedIds).toEqual(['sell-lower-value', 'same-value-worse-float'])
  })

  it('excludes duplicate quick-select items protected by auto-sell rules', () => {
    const inventory = [
      makeItem({ instanceId: 'keeper', id: 'skin-1' }),
      makeItem({ instanceId: 'excluded-copy', id: 'skin-1' }),
      makeItem({ instanceId: 'covert-keeper', id: 'skin-2', rarity: Rarity.Covert }),
      makeItem({ instanceId: 'covert-copy', id: 'skin-2', rarity: Rarity.Covert }),
    ]
    const selectedIds = selectDuplicates(
      inventory,
      {
        'skin-1': 100,
        'skin-2': 20,
      },
      [
        {
          enabled: true,
          excludedIds: ['excluded-copy'],
          id: 'excluded',
          type: AutoSellRuleType.ExcludedIds,
        },
        {
          enabled: true,
          id: 'max-rarity',
          rarityThreshold: Rarity.Classified,
          type: AutoSellRuleType.MaxRarity,
        },
      ],
    )

    expect(selectedIds).toEqual([])
  })
})
