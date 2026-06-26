import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type CollectionEntry, type SkinBase, type SkinInstance } from '../data/models'
import {
  buildSkinCollectionRows,
  calculateCollectionCompletion,
  isCompletedWearSet,
} from './collectionBook'

function makeSkin(overrides: Partial<SkinBase>): SkinBase {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 42,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    ...overrides,
  }
}

function makeItem(overrides: Partial<SkinInstance>): SkinInstance {
  const skin = makeSkin(overrides)

  return {
    ...skin,
    instanceId: 'item-1',
    wear: WearCondition.FactoryNew,
    floatValue: 0.01,
    marketValue: 100,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1,
    ...overrides,
  }
}

describe('collection book helpers', () => {
  it('calculates overall and rarity completion from discovered skins', () => {
    const skins = [
      makeSkin({ id: 'p250_sand_dune', rarity: Rarity.Consumer }),
      makeSkin({ id: 'nova_predator', rarity: Rarity.Consumer }),
      makeSkin({ id: 'ak47_redline', rarity: Rarity.Classified }),
      makeSkin({ id: 'm4a1_s_printstream', rarity: Rarity.Covert }),
    ]
    const collectionBook: CollectionEntry[] = [
      {
        skinId: 'p250_sand_dune',
        foundWearConditions: [WearCondition.FactoryNew],
        timesFound: 1,
        firstFoundAt: 1,
      },
      {
        skinId: 'ak47_redline',
        foundWearConditions: [WearCondition.FieldTested],
        timesFound: 1,
        firstFoundAt: 2,
      },
    ]
    const progress = calculateCollectionCompletion(skins, collectionBook)

    expect(progress).toMatchObject({
      discovered: 2,
      total: 4,
      percentage: 50,
    })
    expect(progress.byRarity[Rarity.Consumer]).toEqual({
      discovered: 1,
      total: 2,
      percentage: 50,
    })
    expect(progress.byRarity[Rarity.Classified]).toEqual({
      discovered: 1,
      total: 1,
      percentage: 100,
    })
    expect(progress.byRarity[Rarity.Covert]).toEqual({
      discovered: 0,
      total: 1,
      percentage: 0,
    })
  })

  it('detects completed wear sets and held records', () => {
    const entry: CollectionEntry = {
      skinId: 'ak47_redline',
      foundWearConditions: [
        WearCondition.FactoryNew,
        WearCondition.MinimalWear,
        WearCondition.FieldTested,
        WearCondition.WellWorn,
        WearCondition.BattleScarred,
      ],
      bestFloat: 0.01,
      highestValue: 100,
      timesFound: 5,
      firstFoundAt: 1,
    }
    const rows = buildSkinCollectionRows(
      [makeSkin({ id: 'ak47_redline' })],
      [entry],
      [makeItem({ id: 'ak47_redline', floatValue: 0.01, marketValue: 100 })],
    )

    expect(isCompletedWearSet(entry)).toBe(true)
    expect(rows[0]).toMatchObject({
      isDiscovered: true,
      isCompletedWearSet: true,
      holdsBestFloat: true,
      holdsHighestValue: true,
    })
  })
})
