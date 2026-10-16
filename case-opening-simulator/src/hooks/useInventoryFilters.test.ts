import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import {
  defaultInventoryFilters,
  filterAndSortInventory,
  getDuplicateSkinIds,
  sortInventory,
} from './useInventoryFilters'

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
    wear: WearCondition.FieldTested,
    floatValue: 0.2,
    marketValue: 30,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1,
    ...overrides,
  }
}

const inventory = [
  makeItem({
    id: 'ak47_redline',
    instanceId: 'item-1',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    marketValue: 42,
    discoveredAt: 10,
    isLocked: true,
  }),
  makeItem({
    id: 'm4a1_s_printstream',
    instanceId: 'item-2',
    weapon: 'M4A1-S',
    finish: 'Printstream',
    rarity: Rarity.Covert,
    wear: WearCondition.FactoryNew,
    floatValue: 0.03,
    marketValue: 180,
    discoveredAt: 30,
    isFavorited: true,
  }),
  makeItem({
    id: 'ak47_redline',
    instanceId: 'item-3',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    wear: WearCondition.WellWorn,
    floatValue: 0.4,
    marketValue: 25,
    discoveredAt: 20,
  }),
]

function itemIds(items: SkinInstance[]) {
  return items.map((item) => item.instanceId)
}

describe('inventory filters', () => {
  it('searches, filters, and sorts special paint patterns', () => {
    const ordinary = makeItem({ instanceId: 'ordinary', paintSeed: 123 })
    const blueGem = makeItem({
      instanceId: 'blue-gem',
      paintSeed: 661,
      pattern: {
        family: 'case_hardened',
        name: 'AK-47 Blue Gem · Pattern 661',
        tier: 'iconic',
        premiumMultiplier: 100,
        referenceConfidence: 'estimated',
      },
    })

    expect(itemIds(filterAndSortInventory([ordinary, blueGem], { ...defaultInventoryFilters, search: '661' }, 'newest'))).toEqual(['blue-gem'])
    expect(itemIds(filterAndSortInventory([ordinary, blueGem], { ...defaultInventoryFilters, specialPatternsOnly: true }, 'newest'))).toEqual(['blue-gem'])
    expect(itemIds(sortInventory([ordinary, blueGem], 'patternDesc'))).toEqual(['blue-gem', 'ordinary'])
  })

  it('searches weapon and finish case-insensitively before sorting', () => {
    const items = filterAndSortInventory(
      inventory,
      {
        ...defaultInventoryFilters,
        search: 'print',
      },
      'nameAsc',
    )

    expect(itemIds(items)).toEqual(['item-2'])
  })

  it('filters by rarity, wear, locked, favorited, and duplicates', () => {
    const inventoryWithSpecialItem = [
      ...inventory,
      makeItem({
        id: 'karambit_doppler',
        instanceId: 'item-4',
        weapon: 'Karambit',
        finish: 'Doppler',
        rarity: Rarity.SpecialItem,
      }),
    ]

    expect(
      itemIds(
        filterAndSortInventory(
          inventoryWithSpecialItem,
          {
            ...defaultInventoryFilters,
            rarities: [Rarity.Covert],
          },
          'nameAsc',
        ),
      ),
    ).toEqual(['item-2'])

    expect(
      itemIds(
        filterAndSortInventory(
          inventoryWithSpecialItem,
          {
            ...defaultInventoryFilters,
            rarities: [Rarity.SpecialItem],
          },
          'nameAsc',
        ),
      ),
    ).toEqual(['item-4'])

    expect(
      itemIds(
        filterAndSortInventory(
          inventory,
          {
            ...defaultInventoryFilters,
            wearConditions: [WearCondition.WellWorn],
          },
          'nameAsc',
        ),
      ),
    ).toEqual(['item-3'])

    expect(
      itemIds(
        filterAndSortInventory(
          inventory,
          {
            ...defaultInventoryFilters,
            lockedOnly: true,
          },
          'nameAsc',
        ),
      ),
    ).toEqual(['item-1'])

    expect(
      itemIds(
        filterAndSortInventory(
          inventory,
          {
            ...defaultInventoryFilters,
            favoritedOnly: true,
          },
          'nameAsc',
        ),
      ),
    ).toEqual(['item-2'])

    expect(
      itemIds(
        filterAndSortInventory(
          inventory,
          {
            ...defaultInventoryFilters,
            duplicatesOnly: true,
          },
          'newest',
        ),
      ),
    ).toEqual(['item-3', 'item-1'])
  })

  it('sorts value and discovered time in both directions', () => {
    expect(itemIds(sortInventory(inventory, 'valueDesc'))).toEqual(['item-2', 'item-1', 'item-3'])
    expect(itemIds(sortInventory(inventory, 'valueAsc'))).toEqual(['item-3', 'item-1', 'item-2'])
    expect(itemIds(sortInventory(inventory, 'newest'))).toEqual(['item-2', 'item-3', 'item-1'])
    expect(itemIds(sortInventory(inventory, 'oldest'))).toEqual(['item-1', 'item-3', 'item-2'])
  })

  it('sorts rarity tiers from rare to common and common to rare', () => {
    const tieredItems = [
      makeItem({ instanceId: 'consumer', rarity: Rarity.Consumer }),
      makeItem({ instanceId: 'classified', rarity: Rarity.Classified }),
      makeItem({ instanceId: 'contraband', rarity: Rarity.Contraband }),
      makeItem({ instanceId: 'special', rarity: Rarity.SpecialItem }),
      makeItem({ instanceId: 'covert', rarity: Rarity.Covert }),
    ]

    expect(itemIds(sortInventory(tieredItems, 'rarityDesc'))).toEqual([
      'contraband',
      'special',
      'covert',
      'classified',
      'consumer',
    ])
    expect(itemIds(sortInventory(tieredItems, 'rarityAsc'))).toEqual([
      'consumer',
      'classified',
      'covert',
      'special',
      'contraband',
    ])
  })

  it('sorts wear best-to-worst and worst-to-best with float tie-breakers', () => {
    const wornItems = [
      makeItem({
        instanceId: 'field-tested-better-float',
        wear: WearCondition.FieldTested,
        floatValue: 0.16,
      }),
      makeItem({
        instanceId: 'factory-new-worse-float',
        wear: WearCondition.FactoryNew,
        floatValue: 0.06,
      }),
      makeItem({
        instanceId: 'field-tested-worse-float',
        wear: WearCondition.FieldTested,
        floatValue: 0.35,
      }),
      makeItem({
        instanceId: 'factory-new-better-float',
        wear: WearCondition.FactoryNew,
        floatValue: 0.01,
      }),
    ]

    expect(itemIds(sortInventory(wornItems, 'wearBest'))).toEqual([
      'factory-new-better-float',
      'factory-new-worse-float',
      'field-tested-better-float',
      'field-tested-worse-float',
    ])
    expect(itemIds(sortInventory(wornItems, 'wearWorst'))).toEqual([
      'field-tested-worse-float',
      'field-tested-better-float',
      'factory-new-worse-float',
      'factory-new-better-float',
    ])
  })

  it('sorts names in both directions', () => {
    expect(itemIds(sortInventory(inventory, 'nameAsc'))).toEqual(['item-1', 'item-3', 'item-2'])
    expect(itemIds(sortInventory(inventory, 'nameDesc'))).toEqual(['item-2', 'item-1', 'item-3'])
  })

  it('keeps equal comparisons stable', () => {
    const equalItems = [
      makeItem({ instanceId: 'first', marketValue: 10 }),
      makeItem({ instanceId: 'second', marketValue: 10 }),
      makeItem({ instanceId: 'third', marketValue: 10 }),
    ]

    expect(itemIds(sortInventory(equalItems, 'valueDesc'))).toEqual(['first', 'second', 'third'])
  })

  it('detects duplicate skin ids', () => {
    expect(Array.from(getDuplicateSkinIds(inventory))).toEqual(['ak47_redline'])
  })
})
