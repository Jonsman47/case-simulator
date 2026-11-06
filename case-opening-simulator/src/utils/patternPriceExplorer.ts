import patternPriceCache from '../data/generated/pattern-price-cache.json'
import { WearCondition, getWearValueMultiplier, type SkinBase, type SkinPattern } from '../data/models'
import { getSkinConditionPrice, getSkinPriceConfidence, getRepresentativeSkinPrice } from '../data/skinPrices'
import { applyPatternPremium, classifySkinPattern, getPatternPremiumValue } from './skinPatterns'

export type PatternEdition = 'normal' | 'stattrak' | 'souvenir'
export type PatternPriceConfidence = 'market-listing' | 'simulator-estimate' | 'neutral'
export type MarketRangeConfidence = 'market' | 'market-listing' | 'fallback' | 'simulator-estimate'

export interface MarketPriceRangeVariant {
  confidence: MarketRangeConfidence
  edition: PatternEdition
  patternName: string
  seed?: number
  source: string
  value: number
  wear: WearCondition
}

export interface MarketPriceRange {
  hasExceptionalVariant: boolean
  maximum: number
  maximumVariant: MarketPriceRangeVariant
  minimum: number
  minimumVariant: MarketPriceRangeVariant
}

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
const observationsByVariant = new Map<string, CachedPatternObservation[]>()

for (const observation of observations) {
  const key = `${observation.skinId}|${observation.wear}|${observation.edition}`
  observationsByVariant.set(key, [...(observationsByVariant.get(key) ?? []), observation])
}

interface PatternModelExtrema {
  maximum: { multiplier: number; pattern: SkinPattern; seed: number }
  minimum: { multiplier: number; pattern: SkinPattern; seed: number }
}

const patternExtremaCache = new Map<string, PatternModelExtrema>()

export const PATTERN_PRICE_CACHE_UPDATED_AT = patternPriceCache.generatedAt
export const BASE_PRICE_DATA_UPDATED_AT = '2026-10-17T11:40:06.446Z'

export function getAvailableWearConditions(skin: SkinBase) {
  const wearRanges = 'wearRanges' in skin
    ? (skin as SkinBase & { wearRanges?: Partial<Record<WearCondition, unknown>> }).wearRanges
    : undefined

  if (wearRanges && Object.keys(wearRanges).length > 0) {
    return Object.values(WearCondition).filter((wear) => Boolean(wearRanges[wear]))
  }

  const sourcedWears = Object.values(WearCondition).filter((wear) => typeof getSkinConditionPrice(skin, wear) === 'number')
  return sourcedWears.length > 0 ? sourcedWears : [WearCondition.FieldTested]
}

export function getAvailablePatternEditions(skin: SkinBase): PatternEdition[] {
  const editionSupport = skin as SkinBase & { hasSouvenir?: boolean; hasStatTrak?: boolean }
  const editions: PatternEdition[] = ['normal']

  if (editionSupport.hasStatTrak || skin.statTrak) editions.push('stattrak')
  if (editionSupport.hasSouvenir || skin.souvenir) editions.push('souvenir')

  return editions
}

export function getCurrentMarketRatio(skin: SkinBase, currentRepresentativeValue?: number) {
  const representative = getRepresentativeSkinPrice(skin)
  return typeof currentRepresentativeValue === 'number' && Number.isFinite(currentRepresentativeValue) && representative > 0
    ? Math.max(0, currentRepresentativeValue) / representative
    : 1
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
  const marketRatio = getCurrentMarketRatio(skin, currentRepresentativeValue)

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
  const marketRatio = getCurrentMarketRatio(skin, currentRepresentativeValue)

  return Array.from({ length: 1001 }, (_, seed) => {
    const pattern = classifySkinPattern(skin, seed)
    const observation = observationByKey.get(`${skin.id}|${wear}|${edition}|${seed}`)
    const estimatedValue = observation
      ? Number((observation.price * marketRatio).toFixed(2))
      : applyPatternPremium(baseValue, pattern)
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

function getPatternModelExtrema(skin: SkinBase): PatternModelExtrema {
  const cacheKey = `${skin.id}|${skin.weapon}|${skin.finish}|${skin.paintIndex ?? ''}|${skin.phase ?? ''}`
  const cached = patternExtremaCache.get(cacheKey)
  if (cached) return cached

  const seedCount = isSeedPriceRelevant(skin) ? 1001 : 1
  let minimum: PatternModelExtrema['minimum'] | undefined
  let maximum: PatternModelExtrema['maximum'] | undefined

  for (let seed = 0; seed < seedCount; seed += 1) {
    const pattern = classifySkinPattern(skin, seed)
    const multiplier = applyPatternPremium(1_000_000, pattern) / 1_000_000
    const candidate = { multiplier, pattern, seed }
    if (!minimum || multiplier < minimum.multiplier) minimum = candidate
    if (!maximum || multiplier > maximum.multiplier) maximum = candidate
  }

  const extrema = { minimum: minimum!, maximum: maximum! }
  patternExtremaCache.set(cacheKey, extrema)
  return extrema
}

function getUnobservedModelExtrema(
  skin: SkinBase,
  excludedSeeds: Set<number>,
): PatternModelExtrema {
  const cached = getPatternModelExtrema(skin)
  if (!excludedSeeds.has(cached.minimum.seed) && !excludedSeeds.has(cached.maximum.seed)) return cached

  let minimum: PatternModelExtrema['minimum'] | undefined
  let maximum: PatternModelExtrema['maximum'] | undefined
  const seedCount = isSeedPriceRelevant(skin) ? 1001 : 1

  for (let seed = 0; seed < seedCount; seed += 1) {
    if (excludedSeeds.has(seed)) continue
    const pattern = classifySkinPattern(skin, seed)
    const multiplier = applyPatternPremium(1_000_000, pattern) / 1_000_000
    const candidate = { multiplier, pattern, seed }
    if (!minimum || multiplier < minimum.multiplier) minimum = candidate
    if (!maximum || multiplier > maximum.multiplier) maximum = candidate
  }

  return {
    minimum: minimum ?? cached.minimum,
    maximum: maximum ?? cached.maximum,
  }
}

function modelRangeVariant(
  skin: SkinBase,
  wear: WearCondition,
  edition: PatternEdition,
  baseValue: number,
  candidate: PatternModelExtrema['minimum'],
): MarketPriceRangeVariant {
  const priceConfidence = getConditionPriceConfidence(skin, wear, edition)
  const hasPatternPremium = candidate.multiplier > 1

  return {
    confidence: hasPatternPremium
      ? 'simulator-estimate'
      : priceConfidence === 'market' ? 'market' : priceConfidence === 'fallback' ? 'fallback' : 'simulator-estimate',
    edition,
    patternName: candidate.pattern.name,
    seed: isSeedPriceRelevant(skin) ? candidate.seed : undefined,
    source: hasPatternPremium ? 'Simulator pattern model' : priceConfidence === 'market' ? 'Imported market price' : 'Simulator price fallback',
    value: applyPatternPremium(baseValue, candidate.pattern),
    wear,
  }
}

export function getSkinMarketPriceRange(
  skin: SkinBase,
  currentRepresentativeValue?: number,
): MarketPriceRange {
  const marketRatio = getCurrentMarketRatio(skin, currentRepresentativeValue)
  let minimumVariant: MarketPriceRangeVariant | undefined
  let maximumVariant: MarketPriceRangeVariant | undefined

  for (const wear of getAvailableWearConditions(skin)) {
    for (const edition of getAvailablePatternEditions(skin)) {
      const baseValue = getConditionBasePrice(skin, wear, edition, currentRepresentativeValue)
      const variantObservations = observationsByVariant.get(`${skin.id}|${wear}|${edition}`) ?? []
      const observedSeeds = new Set(variantObservations.map((observation) => observation.seed))
      const modelExtrema = getUnobservedModelExtrema(skin, observedSeeds)
      const candidates = [
        modelRangeVariant(skin, wear, edition, baseValue, modelExtrema.minimum),
        modelRangeVariant(skin, wear, edition, baseValue, modelExtrema.maximum),
        ...variantObservations.map<MarketPriceRangeVariant>((observation) => ({
          confidence: 'market-listing',
          edition,
          patternName: classifySkinPattern(skin, observation.seed).name,
          seed: observation.seed,
          source: observation.source,
          value: Number((observation.price * marketRatio).toFixed(2)),
          wear,
        })),
      ]

      for (const candidate of candidates) {
        if (!minimumVariant || candidate.value < minimumVariant.value) minimumVariant = candidate
        if (!maximumVariant || candidate.value > maximumVariant.value) maximumVariant = candidate
      }
    }
  }

  const fallback = modelRangeVariant(
    skin,
    WearCondition.FieldTested,
    'normal',
    getConditionBasePrice(skin, WearCondition.FieldTested, 'normal', currentRepresentativeValue),
    getPatternModelExtrema(skin).minimum,
  )
  const minimum = minimumVariant ?? fallback
  const maximum = maximumVariant ?? fallback

  return {
    hasExceptionalVariant: maximum.value >= minimum.value * 2 && maximum.patternName !== 'Standard pattern',
    maximum: maximum.value,
    maximumVariant: maximum,
    minimum: minimum.value,
    minimumVariant: minimum,
  }
}
