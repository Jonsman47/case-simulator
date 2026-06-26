import { Rarity, WearCondition, getWearValueMultiplier, type SkinBase } from '../data/models'
import { hasImportedSkinMetadata } from '../data/rarities'
import type { Prng } from '../data/dropLogic'

export interface WearDistributionEntry {
  condition: WearCondition
  weight: number
}

export const WEAR_FLOAT_RANGES: Record<WearCondition, { min: number; max: number }> = {
  [WearCondition.FactoryNew]: { min: 0, max: 0.07 },
  [WearCondition.MinimalWear]: { min: 0.07, max: 0.15 },
  [WearCondition.FieldTested]: { min: 0.15, max: 0.38 },
  [WearCondition.WellWorn]: { min: 0.38, max: 0.45 },
  [WearCondition.BattleScarred]: { min: 0.45, max: 1 },
}

export const WEAR_DISTRIBUTIONS_BY_RARITY: Record<Rarity, WearDistributionEntry[]> = {
  [Rarity.Consumer]: [
    { condition: WearCondition.FactoryNew, weight: 4 },
    { condition: WearCondition.MinimalWear, weight: 14 },
    { condition: WearCondition.FieldTested, weight: 44 },
    { condition: WearCondition.WellWorn, weight: 24 },
    { condition: WearCondition.BattleScarred, weight: 14 },
  ],
  [Rarity.Industrial]: [
    { condition: WearCondition.FactoryNew, weight: 5 },
    { condition: WearCondition.MinimalWear, weight: 15 },
    { condition: WearCondition.FieldTested, weight: 42 },
    { condition: WearCondition.WellWorn, weight: 24 },
    { condition: WearCondition.BattleScarred, weight: 14 },
  ],
  [Rarity.MilSpec]: [
    { condition: WearCondition.FactoryNew, weight: 5 },
    { condition: WearCondition.MinimalWear, weight: 16 },
    { condition: WearCondition.FieldTested, weight: 40 },
    { condition: WearCondition.WellWorn, weight: 24 },
    { condition: WearCondition.BattleScarred, weight: 15 },
  ],
  [Rarity.Restricted]: [
    { condition: WearCondition.FactoryNew, weight: 6 },
    { condition: WearCondition.MinimalWear, weight: 17 },
    { condition: WearCondition.FieldTested, weight: 38 },
    { condition: WearCondition.WellWorn, weight: 23 },
    { condition: WearCondition.BattleScarred, weight: 16 },
  ],
  [Rarity.Classified]: [
    { condition: WearCondition.FactoryNew, weight: 7 },
    { condition: WearCondition.MinimalWear, weight: 18 },
    { condition: WearCondition.FieldTested, weight: 36 },
    { condition: WearCondition.WellWorn, weight: 22 },
    { condition: WearCondition.BattleScarred, weight: 17 },
  ],
  [Rarity.Covert]: [
    { condition: WearCondition.FactoryNew, weight: 8 },
    { condition: WearCondition.MinimalWear, weight: 19 },
    { condition: WearCondition.FieldTested, weight: 34 },
    { condition: WearCondition.WellWorn, weight: 22 },
    { condition: WearCondition.BattleScarred, weight: 17 },
  ],
  [Rarity.SpecialItem]: [
    { condition: WearCondition.FactoryNew, weight: 4 },
    { condition: WearCondition.MinimalWear, weight: 12 },
    { condition: WearCondition.FieldTested, weight: 35 },
    { condition: WearCondition.WellWorn, weight: 26 },
    { condition: WearCondition.BattleScarred, weight: 23 },
  ],
  [Rarity.Contraband]: [
    { condition: WearCondition.FactoryNew, weight: 9 },
    { condition: WearCondition.MinimalWear, weight: 20 },
    { condition: WearCondition.FieldTested, weight: 33 },
    { condition: WearCondition.WellWorn, weight: 20 },
    { condition: WearCondition.BattleScarred, weight: 18 },
  ],
}

function clampRandomValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(Math.max(value, 0), 1)
}

export function randomWearConditionForSkin(skin: SkinBase, prng: Prng = Math.random) {
  const distribution = WEAR_DISTRIBUTIONS_BY_RARITY[skin.rarity]
  const totalWeight = distribution.reduce((total, entry) => total + entry.weight, 0)
  let targetWeight = clampRandomValue(prng()) * totalWeight

  for (const entry of distribution) {
    targetWeight -= entry.weight

    if (targetWeight < 0) {
      return entry.condition
    }
  }

  return distribution[distribution.length - 1].condition
}

export function randomFloatForCondition(wear: WearCondition, prng: Prng = Math.random) {
  const range = WEAR_FLOAT_RANGES[wear]
  const floatValue = range.min + clampRandomValue(prng()) * (range.max - range.min)

  return Number(floatValue.toFixed(6))
}

export function randomFloatForSkin(skin: SkinBase, prng: Prng = Math.random) {
  if (!hasImportedSkinMetadata(skin)) {
    return randomFloatForCondition(randomWearConditionForSkin(skin, prng), prng)
  }

  const minFloat = Math.max(0, Math.min(1, skin.minFloat))
  const maxFloat = Math.max(minFloat, Math.min(1, skin.maxFloat))
  const floatValue = minFloat + clampRandomValue(prng()) * (maxFloat - minFloat)

  return Number(floatValue.toFixed(6))
}

export function getWearConditionForFloat(skin: SkinBase, floatValue: number) {
  const ranges = hasImportedSkinMetadata(skin) ? skin.wearRanges : undefined

  if (ranges) {
    for (const wear of Object.values(WearCondition)) {
      const range = ranges[wear]

      if (range && floatValue >= range.min && floatValue <= range.max) {
        return wear
      }
    }
  }

  if (floatValue < WEAR_FLOAT_RANGES[WearCondition.FactoryNew].max) {
    return WearCondition.FactoryNew
  }

  if (floatValue < WEAR_FLOAT_RANGES[WearCondition.MinimalWear].max) {
    return WearCondition.MinimalWear
  }

  if (floatValue < WEAR_FLOAT_RANGES[WearCondition.FieldTested].max) {
    return WearCondition.FieldTested
  }

  if (floatValue < WEAR_FLOAT_RANGES[WearCondition.WellWorn].max) {
    return WearCondition.WellWorn
  }

  return WearCondition.BattleScarred
}

export function applyWearMultiplier(baseValue: number, wear: WearCondition, floatValue: number) {
  const range = WEAR_FLOAT_RANGES[wear]
  const clampedFloat = Math.min(Math.max(floatValue, range.min), range.max)
  const rangeSize = range.max - range.min
  const wearPosition = rangeSize > 0 ? (clampedFloat - range.min) / rangeSize : 0
  const floatQualityAdjustment = 1.05 - wearPosition * 0.1

  return Number((baseValue * getWearValueMultiplier(wear) * floatQualityAdjustment).toFixed(2))
}
