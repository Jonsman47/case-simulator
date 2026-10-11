import { Rarity, WearCondition, getWearValueMultiplier, type SkinBase } from '../data/models'
import { hasImportedSkinMetadata } from '../data/rarities'
import type { Prng } from '../data/dropLogic'

export interface WearDistributionEntry {
  condition: WearCondition
  weight: number
}

export interface WearFloatRange {
  max: number
  min: number
}

export const WEAR_FLOAT_RANGES: Record<WearCondition, { min: number; max: number }> = {
  [WearCondition.FactoryNew]: { min: 0, max: 0.07 },
  [WearCondition.MinimalWear]: { min: 0.07, max: 0.15 },
  [WearCondition.FieldTested]: { min: 0.15, max: 0.38 },
  [WearCondition.WellWorn]: { min: 0.38, max: 0.45 },
  [WearCondition.BattleScarred]: { min: 0.45, max: 1 },
}

export const WEAR_CONDITION_ODDS: WearDistributionEntry[] = [
  { condition: WearCondition.FactoryNew, weight: 1 },
  { condition: WearCondition.MinimalWear, weight: 3 },
  { condition: WearCondition.FieldTested, weight: 5 },
  { condition: WearCondition.WellWorn, weight: 2 },
  { condition: WearCondition.BattleScarred, weight: 4 },
]

export const WEAR_DISTRIBUTIONS_BY_RARITY: Record<Rarity, WearDistributionEntry[]> = {
  [Rarity.Consumer]: WEAR_CONDITION_ODDS,
  [Rarity.Industrial]: WEAR_CONDITION_ODDS,
  [Rarity.MilSpec]: WEAR_CONDITION_ODDS,
  [Rarity.Restricted]: WEAR_CONDITION_ODDS,
  [Rarity.Classified]: WEAR_CONDITION_ODDS,
  [Rarity.Covert]: WEAR_CONDITION_ODDS,
  [Rarity.SpecialItem]: WEAR_CONDITION_ODDS,
  [Rarity.Contraband]: WEAR_CONDITION_ODDS,
}

export const WEAR_CONDITION_ORDER = [
  WearCondition.FactoryNew,
  WearCondition.MinimalWear,
  WearCondition.FieldTested,
  WearCondition.WellWorn,
  WearCondition.BattleScarred,
]

function clampRandomValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(Math.max(value, 0), 1)
}

export function randomWearConditionForSkin(skin: SkinBase, prng: Prng = Math.random) {
  const possibleRanges = getPossibleWearFloatRangesForSkin(skin)
  const distribution = WEAR_DISTRIBUTIONS_BY_RARITY[skin.rarity].filter((entry) => {
    return possibleRanges[entry.condition] !== undefined
  })
  const totalWeight = distribution.reduce((total, entry) => total + entry.weight, 0)

  if (totalWeight <= 0) {
    return WearCondition.FieldTested
  }

  let targetWeight = clampRandomValue(prng()) * totalWeight

  for (const entry of distribution) {
    targetWeight -= entry.weight

    if (targetWeight < 0) {
      return entry.condition
    }
  }

  return distribution[distribution.length - 1].condition
}

export function randomFloatForCondition(
  wear: WearCondition,
  prng: Prng = Math.random,
  range: WearFloatRange = WEAR_FLOAT_RANGES[wear],
) {
  const floatValue = range.min + clampRandomValue(prng()) * (range.max - range.min)

  return Number(floatValue.toFixed(6))
}

export function randomFloatForSkin(skin: SkinBase, prng: Prng = Math.random) {
  const wear = randomWearConditionForSkin(skin, prng)
  const range = getPossibleWearFloatRangesForSkin(skin)[wear] ?? getSkinFloatRange(skin)
  let floatValue = randomFloatForCondition(wear, prng, range)

  if (wear !== WearCondition.BattleScarred && floatValue >= range.max) {
    floatValue = Number(Math.max(range.min, range.max - 0.000001).toFixed(6))
  }

  return floatValue
}

export function getWearConditionForFloat(skin: SkinBase, floatValue: number) {
  const ranges = getPossibleWearFloatRangesForSkin(skin)

  for (const wear of WEAR_CONDITION_ORDER) {
    const range = ranges[wear]

    if (!range) {
      continue
    }

    if (floatValue >= range.min && (floatValue < range.max || wear === WearCondition.BattleScarred)) {
      return wear
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

export function getSkinFloatRange(skin: SkinBase): WearFloatRange {
  if (!hasImportedSkinMetadata(skin)) {
    return { min: 0, max: 1 }
  }

  const minFloat = Math.max(0, Math.min(1, skin.minFloat))
  const maxFloat = Math.max(minFloat, Math.min(1, skin.maxFloat))

  return { min: minFloat, max: maxFloat }
}

export function getPossibleWearFloatRangesForSkin(skin: SkinBase) {
  const skinRange = getSkinFloatRange(skin)

  return WEAR_CONDITION_ORDER.reduce<Partial<Record<WearCondition, WearFloatRange>>>((ranges, wear) => {
    const wearRange = hasImportedSkinMetadata(skin)
      ? skin.wearRanges[wear] ?? WEAR_FLOAT_RANGES[wear]
      : WEAR_FLOAT_RANGES[wear]
    const min = Math.max(skinRange.min, wearRange.min)
    const max = Math.min(skinRange.max, wearRange.max)

    if (max > min || (wear === WearCondition.BattleScarred && max === min && max === 1)) {
      ranges[wear] = { min, max }
    }

    return ranges
  }, {})
}

export function applyWearMultiplier(baseValue: number, wear: WearCondition, floatValue: number) {
  const range = WEAR_FLOAT_RANGES[wear]
  const clampedFloat = Math.min(Math.max(floatValue, range.min), range.max)
  const rangeSize = range.max - range.min
  const wearPosition = rangeSize > 0 ? (clampedFloat - range.min) / rangeSize : 0
  const floatQualityAdjustment = 1.05 - wearPosition * 0.1

  return Number((baseValue * getWearValueMultiplier(wear) * floatQualityAdjustment).toFixed(2))
}
