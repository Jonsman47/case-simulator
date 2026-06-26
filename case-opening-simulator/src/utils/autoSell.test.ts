import { describe, expect, it } from 'vitest'
import { AutoSellRuleType, Rarity, WearCondition, type SkinInstance } from '../data/models'
import { shouldAutoSell, simulateAutoSell } from './autoSell'

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 40,
    caseIds: ['test_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FieldTested,
    floatValue: 0.2,
    marketValue: 30,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1,
    ...overrides,
  }
}

describe('shouldAutoSell', () => {
  it('matches legacy value, rarity, duplicate, and wear rules', () => {
    expect(
      shouldAutoSell(makeItem({ marketValue: 0.99 }), [
        {
          enabled: true,
          id: 'low-value',
          type: AutoSellRuleType.MinValue,
          valueThreshold: 1,
        },
      ]),
    ).toBe(true)

    expect(
      shouldAutoSell(makeItem({ rarity: Rarity.MilSpec }), [
        {
          enabled: true,
          id: 'low-rarity',
          rarityThreshold: Rarity.MilSpec,
          type: AutoSellRuleType.MaxRarity,
        },
      ]),
    ).toBe(true)

    const firstCopy = makeItem({ id: 'skin-1', instanceId: 'copy-1', discoveredAt: 1 })
    const duplicate = makeItem({ id: 'skin-1', instanceId: 'copy-2', discoveredAt: 2 })

    expect(
      shouldAutoSell(
        duplicate,
        [
          {
            enabled: true,
            id: 'duplicates',
            sellDuplicates: true,
            type: AutoSellRuleType.SellDuplicates,
          },
        ],
        [duplicate, firstCopy],
      ),
    ).toBe(true)

    expect(
      shouldAutoSell(makeItem({ wear: WearCondition.BattleScarred }), [
        {
          enabled: true,
          id: 'wear',
          type: AutoSellRuleType.MaxWear,
          wearThreshold: WearCondition.FieldTested,
        },
      ]),
    ).toBe(true)
  })

  it('matches per-rarity, non-favorited, non-knife, and sell-wear-below rules', () => {
    expect(
      shouldAutoSell(makeItem({ rarity: Rarity.Classified, marketValue: 7 }), [
        {
          enabled: true,
          id: 'per-rarity',
          type: AutoSellRuleType.SellBelowValuePerRarity,
          valueThresholdsByRarity: {
            [Rarity.Classified]: 8,
          },
        },
      ]),
    ).toBe(true)

    expect(
      shouldAutoSell(makeItem({ marketValue: 4 }), [
        {
          enabled: true,
          id: 'non-fav',
          type: AutoSellRuleType.SellNonFavoritedBelow,
          valueThreshold: 5,
        },
      ]),
    ).toBe(true)

    expect(
      shouldAutoSell(makeItem({ rarity: Rarity.SpecialItem, marketValue: 4, weapon: 'Knife' }), [
        {
          enabled: true,
          id: 'non-knife',
          type: AutoSellRuleType.SellNonKnifeUnderValue,
          valueThreshold: 5,
        },
      ]),
    ).toBe(false)

    expect(
      shouldAutoSell(makeItem({ wear: WearCondition.WellWorn }), [
        {
          enabled: true,
          id: 'sell-wear-below',
          type: AutoSellRuleType.SellWearBelow,
          wearThreshold: WearCondition.FieldTested,
        },
      ]),
    ).toBe(true)
  })

  it('lets KeepFactoryNew override value-based sell rules', () => {
    expect(
      shouldAutoSell(makeItem({ marketValue: 0.01, wear: WearCondition.FactoryNew }), [
        {
          enabled: true,
          id: 'sell-low',
          type: AutoSellRuleType.MinValue,
          valueThreshold: 100,
        },
        {
          enabled: true,
          id: 'keep-factory-new',
          type: AutoSellRuleType.KeepFactoryNew,
        },
      ]),
    ).toBe(false)
  })

  it('respects rule ordering when keep-one conflicts with value selling', () => {
    const firstCopy = makeItem({ id: 'skin-1', instanceId: 'copy-1', marketValue: 1 })
    const keepOneRule = {
      enabled: true,
      id: 'keep-one',
      sellDuplicates: true,
      type: AutoSellRuleType.SellDuplicatesKeepOne,
    }
    const sellLowRule = {
      enabled: true,
      id: 'sell-low',
      type: AutoSellRuleType.MinValue,
      valueThreshold: 5,
    }

    expect(shouldAutoSell(firstCopy, [keepOneRule, sellLowRule], [firstCopy])).toBe(false)
    expect(shouldAutoSell(firstCopy, [sellLowRule, keepOneRule], [firstCopy])).toBe(true)
  })

  it('ignores disabled rules and protected items', () => {
    const rule = {
      enabled: false,
      id: 'disabled',
      type: AutoSellRuleType.MinValue,
      valueThreshold: 100,
    }

    expect(shouldAutoSell(makeItem({ marketValue: 1 }), [rule])).toBe(false)
    expect(shouldAutoSell(makeItem({ isLocked: true, marketValue: 1 }), [{ ...rule, enabled: true }])).toBe(
      false,
    )
    expect(
      shouldAutoSell(makeItem({ isFavorited: true, marketValue: 1 }), [{ ...rule, enabled: true }]),
    ).toBe(false)
  })

  it('simulates current inventory sale count and total value', () => {
    const inventory = [
      makeItem({ instanceId: 'sell', marketValue: 2 }),
      makeItem({ instanceId: 'keep', marketValue: 10 }),
    ]
    const simulation = simulateAutoSell(inventory, [
      {
        enabled: true,
        id: 'sell-low',
        type: AutoSellRuleType.MinValue,
        valueThreshold: 5,
      },
    ])

    expect(simulation.items.map((item) => item.instanceId)).toEqual(['sell'])
    expect(simulation.totalValue).toBe(2)
  })
})
