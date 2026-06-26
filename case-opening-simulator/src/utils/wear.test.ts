import { describe, expect, it, vi } from 'vitest'
import type { ImportedSkinDefinition } from '../data/importedAssetTypes'
import { Rarity, WearCondition, type SkinBase } from '../data/models'
import {
  WEAR_DISTRIBUTIONS_BY_RARITY,
  WEAR_FLOAT_RANGES,
  applyWearMultiplier,
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
  it('covers every rarity distribution segment with injected randomness', () => {
    for (const rarity of Object.values(Rarity)) {
      const skin = makeSkin(rarity)
      const distribution = WEAR_DISTRIBUTIONS_BY_RARITY[rarity]
      const totalWeight = distribution.reduce((total, entry) => total + entry.weight, 0)
      let cumulativeWeight = 0

      expect(totalWeight, rarity).toBe(100)

      for (const entry of distribution) {
        const randomValueInsideSlot = (cumulativeWeight + entry.weight / 2) / totalWeight

        expect(randomWearConditionForSkin(skin, () => randomValueInsideSlot), rarity).toBe(
          entry.condition,
        )

        cumulativeWeight += entry.weight
      }
    }
  })

  it('makes special items slightly more worn than rifles/covert skins', () => {
    const specialHighWearWeight = WEAR_DISTRIBUTIONS_BY_RARITY[Rarity.SpecialItem]
      .filter((entry) => {
        return (
          entry.condition === WearCondition.WellWorn ||
          entry.condition === WearCondition.BattleScarred
        )
      })
      .reduce((total, entry) => total + entry.weight, 0)
    const covertHighWearWeight = WEAR_DISTRIBUTIONS_BY_RARITY[Rarity.Covert]
      .filter((entry) => {
        return (
          entry.condition === WearCondition.WellWorn ||
          entry.condition === WearCondition.BattleScarred
        )
      })
      .reduce((total, entry) => total + entry.weight, 0)

    expect(specialHighWearWeight).toBeGreaterThan(covertHighWearWeight)
  })

  it('uses the provided PRNG instead of Math.random', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')

    randomWearConditionForSkin(makeSkin(Rarity.Consumer), () => 0.5)

    expect(mathRandomSpy).not.toHaveBeenCalled()

    mathRandomSpy.mockRestore()
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
    expect(randomFloatForSkin(skin, () => 1)).toBe(0.33)
    expect(randomFloatForSkin(skin, () => 0.5)).toBe(0.225)
  })

  it('derives wear from imported skin wear ranges', () => {
    const skin = makeImportedSkin()

    expect(getWearConditionForFloat(skin, 0.13)).toBe(WearCondition.MinimalWear)
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
