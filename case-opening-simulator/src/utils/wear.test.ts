import { describe, expect, it, vi } from 'vitest'
import type { ImportedSkinDefinition } from '../data/importedAssetTypes'
import { Rarity, WearCondition, type SkinBase } from '../data/models'
import {
  WEAR_CONDITION_ODDS,
  WEAR_DISTRIBUTIONS_BY_RARITY,
  WEAR_FLOAT_RANGES,
  applyWearMultiplier,
  getPossibleWearFloatRangesForSkin,
  getWearConditionForFloat,
  randomFloatForCondition,
  randomFloatForSkin,
  randomWearConditionForSkin,
} from './wear'

function makeSkin(rarity: Rarity): SkinBase {
  return {
    id: `${rarity.toLowerCase()}_test_skin`,
    weapon: 'Test Weapon',
    finish: 'Test Finish',
    rarity,
    baseValue: 100,
    caseIds: ['test_case'],
    image: '/assets/placeholder.png',
  }
}

function makeImportedSkin(): ImportedSkinDefinition {
  return {
    ...makeSkin(Rarity.Restricted),
    displayName: 'Test Weapon | Imported Finish',
    hasSouvenir: false,
    hasStatTrak: true,
    maxFloat: 0.33,
    minFloat: 0.12,
    patternId: 'imported_finish',
    rarityColor: '#8847ff',
    rarityId: 'rarity_restricted_weapon',
    weaponId: 'weapon_test',
    collections: ['test_collection'],
    wearRanges: {
      [WearCondition.MinimalWear]: { min: 0.12, max: 0.15 },
      [WearCondition.FieldTested]: { min: 0.15, max: 0.33 },
    },
  }
}

describe('wear condition generation', () => {
  it('uses the same exact 15-weight wear distribution for every rarity', () => {
    for (const rarity of Object.values(Rarity)) {
      const skin = makeSkin(rarity)
      const distribution = WEAR_DISTRIBUTIONS_BY_RARITY[rarity]
      const totalWeight = distribution.reduce((total, entry) => total + entry.weight, 0)
      let cumulativeWeight = 0

      expect(distribution, rarity).toEqual(WEAR_CONDITION_ODDS)
      expect(totalWeight, rarity).toBe(15)

      for (const entry of distribution) {
        const randomValueInsideSlot = (cumulativeWeight + entry.weight / 2) / totalWeight

        expect(randomWearConditionForSkin(skin, () => randomValueInsideSlot), rarity).toBe(
          entry.condition,
        )

        cumulativeWeight += entry.weight
      }
    }
  })

  it('uses the provided PRNG instead of Math.random', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')

    randomWearConditionForSkin(makeSkin(Rarity.Consumer), () => 0.5)

    expect(mathRandomSpy).not.toHaveBeenCalled()

    mathRandomSpy.mockRestore()
  })

  it('matches the requested distribution over 100,000 simulated case drops', () => {
    const skin = makeSkin(Rarity.Restricted)
    const counts = Object.fromEntries(
      Object.values(WearCondition).map((wear) => [wear, 0]),
    ) as Record<WearCondition, number>
    let seed = 123_456_789
    const prng = () => {
      seed = (1664525 * seed + 1013904223) % 2 ** 32

      return seed / 2 ** 32
    }

    for (let index = 0; index < 100_000; index += 1) {
      const floatValue = randomFloatForSkin(skin, prng)
      const wear = getWearConditionForFloat(skin, floatValue)

      if (floatValue < 0 || floatValue > 1) {
        throw new Error(`Generated float outside skin range: ${floatValue}`)
      }

      counts[wear] += 1
    }

    expect(counts[WearCondition.FactoryNew] / 100_000).toBeCloseTo(1 / 15, 2)
    expect(counts[WearCondition.MinimalWear] / 100_000).toBeCloseTo(3 / 15, 2)
    expect(counts[WearCondition.FieldTested] / 100_000).toBeCloseTo(5 / 15, 2)
    expect(counts[WearCondition.WellWorn] / 100_000).toBeCloseTo(2 / 15, 2)
    expect(counts[WearCondition.BattleScarred] / 100_000).toBeCloseTo(4 / 15, 2)
  }, 15_000)

  it('redistributes impossible wear condition odds across possible imported skin wears', () => {
    const skin = makeImportedSkin()
    const counts = Object.fromEntries(
      Object.values(WearCondition).map((wear) => [wear, 0]),
    ) as Record<WearCondition, number>
    let seed = 987_654_321
    const prng = () => {
      seed = (1664525 * seed + 1013904223) % 2 ** 32

      return seed / 2 ** 32
    }

    expect(Object.keys(getPossibleWearFloatRangesForSkin(skin)).sort()).toEqual([
      WearCondition.FieldTested,
      WearCondition.MinimalWear,
    ].sort())

    for (let index = 0; index < 20_000; index += 1) {
      const floatValue = randomFloatForSkin(skin, prng)
      const wear = getWearConditionForFloat(skin, floatValue)

      expect(floatValue).toBeGreaterThanOrEqual(skin.minFloat)
      expect(floatValue).toBeLessThanOrEqual(skin.maxFloat)
      expect([WearCondition.MinimalWear, WearCondition.FieldTested]).toContain(wear)
      counts[wear] += 1
    }

    expect(counts[WearCondition.FactoryNew]).toBe(0)
    expect(counts[WearCondition.WellWorn]).toBe(0)
    expect(counts[WearCondition.BattleScarred]).toBe(0)
    expect(counts[WearCondition.MinimalWear] / 20_000).toBeCloseTo(3 / 8, 2)
    expect(counts[WearCondition.FieldTested] / 20_000).toBeCloseTo(5 / 8, 2)
  })
})

describe('float generation and wear value adjustment', () => {
  it('generates floats within each wear condition range', () => {
    for (const wear of Object.values(WearCondition)) {
      const range = WEAR_FLOAT_RANGES[wear]

      expect(randomFloatForCondition(wear, () => 0), wear).toBe(range.min)
      expect(randomFloatForCondition(wear, () => 1), wear).toBe(range.max)
      expect(randomFloatForCondition(wear, () => -1), wear).toBe(range.min)
      expect(randomFloatForCondition(wear, () => 2), wear).toBe(range.max)
    }
  })

  it('generates imported skin floats within the skin-specific min and max range', () => {
    const skin = makeImportedSkin()

    expect(randomFloatForSkin(skin, () => 0)).toBe(0.12)
    expect(randomFloatForSkin(skin, () => 1)).toBe(0.329999)
    expect(randomFloatForSkin(skin, () => 0.5)).toBe(0.24)
  })

  it('derives wear from imported skin wear ranges', () => {
    const skin = makeImportedSkin()

    expect(getWearConditionForFloat(skin, 0.13)).toBe(WearCondition.MinimalWear)
    expect(getWearConditionForFloat(skin, 0.15)).toBe(WearCondition.FieldTested)
    expect(getWearConditionForFloat(skin, 0.2)).toBe(WearCondition.FieldTested)
  })

  it('rewards excellent floats and penalizes worse floats within a wear band', () => {
    const range = WEAR_FLOAT_RANGES[WearCondition.FieldTested]
    const excellentValue = applyWearMultiplier(100, WearCondition.FieldTested, range.min)
    const poorValue = applyWearMultiplier(100, WearCondition.FieldTested, range.max)

    expect(excellentValue).toBe(78.75)
    expect(poorValue).toBe(71.25)
    expect(excellentValue).toBeGreaterThan(poorValue)
  })
})
