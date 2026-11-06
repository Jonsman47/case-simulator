import { describe, expect, it } from 'vitest'
import { AutoSellRuleType, Rarity, WearCondition, type SkinInstance } from '../data/models'
import { getKeepBestDuplicateSaleCandidates, shouldAutoSell, simulateAutoSell } from './autoSell'

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
  it('never auto-sells exceptional paint patterns', () => {
    const item = makeItem({
      marketValue: 10_000,
      paintSeed: 661,
      pattern: {
        family: 'case_hardened',
        name: 'AK-47 Blue Gem · Pattern 661',
        tier: 'iconic',
        premiumMultiplier: 100,
        referenceConfidence: 'estimated',
      },
    })

    expect(shouldAutoSell(item, [{ enabled: true, id: 'sell-all', type: AutoSellRuleType.MaxRarity, rarityThreshold: Rarity.Contraband }])).toBe(false)
  })

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
    expect(simulation.totalValue).toBeGreaterThanOrEqual(1.7)
    expect(simulation.totalValue).toBeLessThanOrEqual(1.9)
  })

  it('keeps the best deterministic duplicate and never sells protected or exceptional copies', () => {
    const rule = { enabled: true, id: 'keep-best', type: AutoSellRuleType.SellDuplicatesKeepOne }
    const protectedCopy = makeItem({ instanceId: 'locked', isLocked: true, marketValue: 5 })
    const ordinary = makeItem({ instanceId: 'ordinary', marketValue: 20 })
    const best = makeItem({ instanceId: 'best', marketValue: 50, paintSeed: 10 })
    const exceptional = makeItem({
      instanceId: 'blue-gem',
      marketValue: 10_000,
      pattern: { family: 'case_hardened', name: 'Blue Gem', premiumMultiplier: 20, referenceConfidence: 'estimated', tier: 'exceptional' },
    })

    expect(getKeepBestDuplicateSaleCandidates([protectedCopy, ordinary, best, exceptional], [rule]))
      .toEqual([ordinary])
  })

  it('uses stable instance ids to break equal-value duplicate ties', () => {
    const rule = { enabled: true, id: 'keep-best', type: AutoSellRuleType.SellDuplicatesKeepOne }
    const laterId = makeItem({ instanceId: 'z-copy', marketValue: 30, discoveredAt: 10 })
    const earlierId = makeItem({ instanceId: 'a-copy', marketValue: 30, discoveredAt: 10 })

    expect(getKeepBestDuplicateSaleCandidates([laterId, earlierId], [rule]).map((item) => item.instanceId))
      .toEqual(['z-copy'])
  })

  it('keeps a custom N highest-valued copies and sells the worst copies first', () => {
    const rule = { enabled: true, id: 'keep-three', type: AutoSellRuleType.SellDuplicatesKeepOne, keepCount: 3 }
    const copies = [10, 50, 20, 40, 30].map((marketValue, index) => makeItem({ instanceId: `copy-${index}`, marketValue }))
    expect(getKeepBestDuplicateSaleCandidates(copies, [rule]).map((item) => item.marketValue)).toEqual([10, 20])
  })

  it('protects StatTrak and Souvenir duplicates unless the player explicitly includes them', () => {
    const regular = makeItem({ instanceId: 'regular', marketValue: 50 })
    const statTrak = makeItem({ instanceId: 'st', marketValue: 10, statTrak: true })
    const souvenir = makeItem({ instanceId: 'souvenir', marketValue: 5, souvenir: true })
    const safeRule = { enabled: true, id: 'safe', type: AutoSellRuleType.SellDuplicatesKeepOne }
    expect(getKeepBestDuplicateSaleCandidates([regular, statTrak, souvenir], [safeRule])).toEqual([])
    const explicitRule = { ...safeRule, includeStatTrak: true, includeSouvenir: true }
    expect(getKeepBestDuplicateSaleCandidates([regular, statTrak, souvenir], [explicitRule]).map((item) => item.instanceId)).toEqual(['st', 'souvenir'])
  })
})
