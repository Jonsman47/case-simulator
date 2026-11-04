import patternPriceCache from '../data/generated/pattern-price-cache.json'
import { WearCondition, getWearValueMultiplier, type SkinBase, type SkinPattern } from '../data/models'
import { getSkinConditionPrice, getSkinPriceConfidence, getRepresentativeSkinPrice } from '../data/skinPrices'
import { applyPatternPremium, classifySkinPattern, getPatternPremiumValue } from './skinPatterns'

export type PatternEdition = 'normal' | 'stattrak' | 'souvenir'
export type PatternPriceConfidence = 'market-listing' | 'simulator-estimate' | 'neutral'

interface CachedPatternObservation {
  confidence: 'market-listing'
  edition: PatternEdition
  observedAt: string
  price: number
  sampleSize?: number
  seed: number
  skinId: string
  source: string
  wear: WearCondition
}

export interface PatternPriceRow {
  confidence: PatternPriceConfidence
  estimatedValue: number
  pattern: SkinPattern
  premiumPercent: number
  premiumValue: number
  sampleSize?: number
  seed: number
  source: string
  updatedAt: string
}

const observations = (patternPriceCache.observations as CachedPatternObservation[])
const observationByKey = new Map(observations.map((entry) => [
  `${entry.skinId}|${entry.wear}|${entry.edition}|${entry.seed}`,
  entry,
]))

export const PATTERN_PRICE_CACHE_UPDATED_AT = patternPriceCache.generatedAt
export const BASE_PRICE_DATA_UPDATED_AT = '2026-10-17T11:40:06.446Z'

export function getAvailableWearConditions(skin: SkinBase) {
  const wearRanges = 'wearRanges' in skin
    ? (skin as SkinBase & { wearRanges?: Partial<Record<WearCondition, unknown>> }).wearRanges
    : undefined

  return Object.values(WearCondition).filter((wear) => (
    Boolean(wearRanges?.[wear]) || typeof getSkinConditionPrice(skin, wear) === 'number'
  ))
}

export function getConditionBasePrice(
  skin: SkinBase,
  wear: WearCondition,
  edition: PatternEdition,
  currentRepresentativeValue?: number,
) {
  const isStatTrak = edition === 'stattrak'
  const isSouvenir = edition === 'souvenir'
  const sourced = getSkinConditionPrice(skin, wear, isStatTrak, isSouvenir)
  const representative = getRepresentativeSkinPrice(skin)
  const marketRatio = currentRepresentativeValue && representative > 0
    ? currentRepresentativeValue / representative
    : 1

  if (typeof sourced === 'number') return Number((sourced * marketRatio).toFixed(2))
  return Number((skin.baseValue * getWearValueMultiplier(wear) * marketRatio).toFixed(2))
}

export function getConditionPriceConfidence(skin: SkinBase, wear: WearCondition, edition: PatternEdition) {
  return getSkinPriceConfidence(skin, wear, edition === 'stattrak', edition === 'souvenir')
}

export function isSeedPriceRelevant(skin: SkinBase) {
  return ['case hardened', 'heat treated', 'fade', 'marble fade'].includes(skin.finish.toLowerCase())
}

export function isPaintKitVariant(skin: SkinBase) {
  return ['doppler', 'gamma doppler'].includes(skin.finish.toLowerCase())
}

export function createPatternPriceRows({
  currentRepresentativeValue,
  edition,
  skin,
  wear,
}: {
  currentRepresentativeValue?: number
  edition: PatternEdition
  skin: SkinBase
  wear: WearCondition
}): PatternPriceRow[] {
  const baseValue = getConditionBasePrice(skin, wear, edition, currentRepresentativeValue)

  return Array.from({ length: 1001 }, (_, seed) => {
    const pattern = classifySkinPattern(skin, seed)
    const observation = observationByKey.get(`${skin.id}|${wear}|${edition}|${seed}`)
    const estimatedValue = observation?.price ?? applyPatternPremium(baseValue, pattern)
    const premiumValue = observation
      ? Math.max(0, estimatedValue - baseValue)
      : getPatternPremiumValue(baseValue, pattern)

    return {
      confidence: observation?.confidence ?? (pattern.referenceConfidence === 'neutral' ? 'neutral' : 'simulator-estimate'),
      estimatedValue,
      pattern,
      premiumPercent: baseValue > 0 ? Number(((premiumValue / baseValue) * 100).toFixed(1)) : 0,
      premiumValue,
      sampleSize: observation?.sampleSize,
      seed,
      source: observation?.source ?? 'Simulator pattern model',
      updatedAt: observation?.observedAt ?? PATTERN_PRICE_CACHE_UPDATED_AT,
    }
  })
}
