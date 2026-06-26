import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { defaultInventoryFilters, filterAndSortInventory } from './inventoryFilters'

const rarities = Object.values(Rarity)
const wears = Object.values(WearCondition)

function makeItem(index: number): SkinInstance {
  const rarity = rarities[index % rarities.length]
  const wear = wears[index % wears.length]

  return {
    id: `skin_${index % 350}`,
    weapon: index % 2 === 0 ? 'AK-47' : 'M4A1-S',
    finish: `Pattern ${index % 90}`,
    rarity,
    baseValue: 1 + (index % 120),
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: `item_${index}`,
    wear,
    floatValue: (index % 1_000) / 1_000,
    marketValue: (index % 300) + (rarity === Rarity.SpecialItem ? 500 : 0),
    isLocked: index % 17 === 0,
    isFavorited: index % 23 === 0,
    discoveredAt: 1_782_147_600_000 + index,
  }
}

describe('inventory filtering performance', () => {
  it('filters and sorts a large inventory inside the UI budget', () => {
    const inventory = Array.from({ length: 8_000 }, (_, index) => makeItem(index))
    const start = performance.now()
    const result = filterAndSortInventory(
      inventory,
      {
        ...defaultInventoryFilters,
        search: 'pattern 1',
        rarities: [Rarity.Classified, Rarity.Covert, Rarity.SpecialItem],
      },
      'valueDesc',
    )
    const duration = performance.now() - start

    expect(result.length).toBeGreaterThan(0)
    expect(duration).toBeLessThan(250)
  })
})
