import { getMarketAdjustedSkinConditionPrice } from '../data/skinPrices'
import { Rarity, WearCondition, type NpcMarketListing, type SkinBase, type SkinInstance, type SkinPattern } from '../data/models'
import { getSkinMarketPriceRange } from '../utils/patternPriceExplorer'
import { roundCurrency } from '../utils/safeNumbers'
import { applyPatternPremium, classifySkinPattern, getPatternPremiumValue } from '../utils/skinPatterns'
import { applyWearMultiplier, getPossibleWearFloatRangesForSkin, WEAR_CONDITION_ORDER } from '../utils/wear'
import { MARKETPLACE_EPOCH_MS, createMarketplaceNpc, getInstantSaleRate } from './marketplace'

export const VIRTUAL_MARKET_EPOCH_MS = MARKETPLACE_EPOCH_MS
export const VIRTUAL_MARKET_PAGE_SIZE = 24
export const VIRTUAL_MARKET_MAX_SCAN = 300_000

export type VirtualListingSort = 'lowest-price' | 'highest-price' | 'lowest-float' | 'highest-float' | 'best-deals' | 'newest' | 'expiring-soon' | 'valuable-pattern'
export type VirtualListingEdition = 'all' | 'normal' | 'stattrak' | 'souvenir'
export type VirtualPatternTier = 'all' | 'special' | SkinPattern['tier']

export interface VirtualListingFilters {
  minPrice?: number
  maxPrice?: number
  wear?: WearCondition | 'all'
  minFloat?: number
  maxFloat?: number
  patternId?: number
  patternTier?: VirtualPatternTier
  patternClassification?: string
  edition?: VirtualListingEdition
  seller?: string
  /** Internal continuation cursor used by the virtualized browser. */
  afterPrice?: { value: number; id: string; descending: boolean }
  /** Internal continuation cursor used by the virtualized browser. */
  afterFloat?: { value: number; id: string; descending: boolean }
  afterDeal?: { score: number; askingPrice: number; id: string }
  afterCreatedAt?: { value: number; id: string }
  afterExpiresAt?: { value: number; id: string }
  afterPattern?: { multiplier: number; fairMarketValue: number; id: string }
}

export interface VirtualListingPage {
  listings: NpcMarketListing[]
  totalSupply: number
  filteredSupplyEstimate: number
  page: number
  pageSize: number
  scanned: number
  exactPatternUnavailable: boolean
}

export interface VirtualSkinMarketSummary {
  skin: SkinBase
  supply: number
  startingPrice: number
  minimumValue: number
  maximumValue: number
  maximumConfidence: 'listing' | 'market' | 'estimated'
  hasExceptionalVariant: boolean
}

const raritySupplyBase: Record<Rarity, number> = {
  [Rarity.Consumer]: 165_000,
  [Rarity.Industrial]: 105_000,
  [Rarity.MilSpec]: 52_000,
  [Rarity.Restricted]: 16_000,
  [Rarity.Classified]: 4_600,
  [Rarity.Covert]: 820,
  [Rarity.SpecialItem]: 92,
  [Rarity.Contraband]: 7,
}

const weaponPopularity: Record<string, number> = {
  'AK-47': 1.42,
  AWP: 1.35,
  'M4A1-S': 1.25,
  M4A4: 1.2,
  'Desert Eagle': 1.18,
  'Glock-18': 1.12,
  'USP-S': 1.12,
  'Five-SeveN': 1.04,
  Karambit: 1.2,
  'Butterfly Knife': 1.25,
}

const patternAvailability: Record<SkinPattern['tier'], number> = {
  standard: 1,
  notable: .38,
  rare: .075,
  exceptional: .009,
  iconic: .0012,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function hashVirtualMarketValue(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function epochNoise(skinId: string, epoch: number, seed: number) {
  return .94 + (hashVirtualMarketValue(`${skinId}:${epoch}:${seed}:supply`) % 1_201) / 10_000
}

/**
 * Estimated active listings for one base skin. Counts are intentionally
 * simulator estimates: they model circulation without claiming live provider
 * inventory. The function is O(1), so all catalog counts can be precomputed.
 */
export function getVirtualSkinSupply(skin: SkinBase, currentMarketValue?: number, epoch = 0, seed = 0) {
  const marketValue = Math.max(.01, currentMarketValue ?? skin.baseValue)
  const priceFactor = clamp(Math.pow(24 / marketValue, .24), .055, 3.4)
  const sourceBreadth = skin.caseIds.length > 0
    ? clamp(.72 + Math.min(5, skin.caseIds.length) * .13, .72, 1.37)
    : .5
  const collectionBreadth = clamp(.86 + Math.min(3, skin.collections?.length ?? 0) * .08, .86, 1.1)
  const popularity = weaponPopularity[skin.weapon] ?? 1
  const circulation = .78 + (hashVirtualMarketValue(`${skin.id}:circulation`) % 4_501) / 10_000
  return Math.max(0, Math.round(
    raritySupplyBase[skin.rarity] * priceFactor * sourceBreadth * collectionBreadth * popularity * circulation * epochNoise(skin.id, epoch, seed),
  ))
}

export function getTotalVirtualMarketSupply(
  skins: readonly SkinBase[],
  marketValues: Record<string, number>,
  epoch = 0,
  seed = 0,
) {
  return skins.reduce((sum, skin) => sum + getVirtualSkinSupply(skin, marketValues[skin.id], epoch, seed), 0)
}

export function getVirtualPatternSupply(skin: SkinBase, paintSeed: number, totalSupply: number, epoch = 0, seed = 0) {
  if (!Number.isInteger(paintSeed) || paintSeed < 0 || paintSeed > 1000 || totalSupply <= 0) return 0
  const pattern = classifySkinPattern(skin, paintSeed)
  const expected = totalSupply / 1001 * patternAvailability[pattern.tier]
  const whole = Math.floor(expected)
  const remainder = expected - whole
  const roll = (hashVirtualMarketValue(`${skin.id}:${paintSeed}:${epoch}:${seed}:pattern-supply`) % 10_000) / 10_000
  return Math.max(0, whole + (roll < remainder ? 1 : 0))
}

export function createVirtualSkinMarketSummary(
  skin: SkinBase,
  currentMarketValue: number | undefined,
  epoch: number,
  seed: number,
): VirtualSkinMarketSummary {
  const range = getSkinMarketPriceRange(skin, currentMarketValue)
  return {
    skin,
    supply: getVirtualSkinSupply(skin, currentMarketValue, epoch, seed),
    startingPrice: roundCurrency(Math.max(.01, range.minimum * .92)),
    minimumValue: range.minimum,
    maximumValue: range.maximum,
    maximumConfidence: range.maximumVariant.confidence === 'market-listing'
      ? 'listing'
      : range.maximumVariant.confidence === 'market' ? 'market' : 'estimated',
    hasExceptionalVariant: range.hasExceptionalVariant,
  }
}

function getDimensionValue(sourceIndex: number, skinId: string, epoch: number, dimension: string) {
  return (hashVirtualMarketValue(`${skinId}:${epoch}:${dimension}:${sourceIndex}`) % 1_000_001) / 1_000_000
}

function getWearAndFloat(skin: SkinBase, sourceIndex: number, epoch: number) {
  const ranges = getPossibleWearFloatRangesForSkin(skin)
  const available = WEAR_CONDITION_ORDER.filter((wear) => ranges[wear])
  const wearRoll = getDimensionValue(sourceIndex, skin.id, epoch, 'wear')
  const weighted = available.map((wear) => ({ wear, weight: wear === WearCondition.FieldTested ? 5 : wear === WearCondition.BattleScarred ? 4 : wear === WearCondition.MinimalWear ? 3 : wear === WearCondition.WellWorn ? 2 : 1 }))
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  let target = wearRoll * total
  const selected = weighted.find((entry) => {
    target -= entry.weight
    return target <= 0
  })?.wear ?? available[0] ?? WearCondition.FieldTested
  const range = ranges[selected] ?? { min: 0, max: 1 }
  const floatRank = getDimensionValue(sourceIndex, skin.id, epoch, 'float')
  const floatValue = Number((range.min + (range.max - range.min) * floatRank).toFixed(6))
  return { wear: selected, floatValue: Math.min(range.max, Math.max(range.min, floatValue)) }
}

function getEdition(skin: SkinBase, sourceIndex: number, epoch: number) {
  const roll = getDimensionValue(sourceIndex, skin.id, epoch, 'edition')
  const hasStatTrak = Boolean(skin.hasStatTrak ?? skin.statTrak)
  const hasSouvenir = Boolean(skin.hasSouvenir ?? skin.souvenir)
  const statTrak = hasStatTrak && roll < .085
  const souvenir = !statTrak && hasSouvenir && roll >= .085 && roll < .091
  return { statTrak, souvenir }
}

function getScarcityAdjustedPattern(skin: SkinBase, sourceIndex: number, epoch: number, seed: number) {
  let paintSeed = hashVirtualMarketValue(`${skin.id}:${epoch}:${seed}:pattern:${sourceIndex}`) % 1001
  let pattern = classifySkinPattern(skin, paintSeed)
  if (pattern.tier !== 'standard') {
    const gate = getDimensionValue(sourceIndex, skin.id, epoch + seed, 'pattern-gate')
    if (gate > patternAvailability[pattern.tier]) {
      for (let attempt = 1; attempt <= 1001; attempt += 1) {
        const candidate = (paintSeed + attempt * 137) % 1001
        const candidatePattern = classifySkinPattern(skin, candidate)
        if (candidatePattern.tier === 'standard') {
          paintSeed = candidate
          pattern = candidatePattern
          break
        }
      }
    }
  }
  return { paintSeed, pattern }
}

function getListingId(skin: SkinBase, epoch: number, sourceIndex: number) {
  return `vm-${epoch.toString(36)}-${hashVirtualMarketValue(skin.id).toString(36)}-${sourceIndex.toString(36)}`
}

export function createVirtualListing({
  skin,
  marketValues,
  epoch,
  seed,
  sourceIndex,
}: {
  skin: SkinBase
  marketValues: Record<string, number>
  epoch: number
  seed: number
  sourceIndex: number
}): NpcMarketListing {
  const id = getListingId(skin, epoch, sourceIndex)
  const { wear, floatValue } = getWearAndFloat(skin, sourceIndex, epoch)
  const { statTrak, souvenir } = getEdition(skin, sourceIndex, epoch)
  const { paintSeed, pattern } = getScarcityAdjustedPattern(skin, sourceIndex, epoch, seed)
  const fallback = applyWearMultiplier(marketValues[skin.id] ?? skin.baseValue, wear, floatValue)
  const baseMarketValue = roundCurrency(getMarketAdjustedSkinConditionPrice({
    fallbackValue: fallback,
    isStatTrak: statTrak,
    isSouvenir: souvenir,
    marketValues,
    skin,
    wear,
  }) ?? fallback)
  const fairMarketValue = roundCurrency(applyPatternPremium(baseMarketValue, pattern))
  const npcSeed = hashVirtualMarketValue(`${id}:seller:${seed}`)
  const seller = createMarketplaceNpc(npcSeed, skin)
  const scarcityScore = clamp(1 - Math.min(1, getVirtualSkinSupply(skin, marketValues[skin.id], epoch, seed) / 50_000), 0, 1)
  const priceRank = getDimensionValue(sourceIndex, skin.id, epoch, 'price')
  const normalBias = .92 + Math.pow(priceRank, .72) * .31
  const rareAskPremium = pattern.tier === 'iconic' ? 1.12 : pattern.tier === 'exceptional' ? 1.07 : 1
  const askingPrice = roundCurrency(Math.max(.01, fairMarketValue * normalBias * rareAskPremium))
  const reservationDiscount = seller.negotiationTolerance * (.55 + getDimensionValue(sourceIndex, skin.id, epoch, 'reservation') * .35)
  const reservationPrice = roundCurrency(Math.max(
    fairMarketValue * getInstantSaleRate({ ...skin, instanceId: `${id}-item`, wear, floatValue, paintSeed, pattern, baseMarketValue, patternPremium: getPatternPremiumValue(baseMarketValue, pattern), marketValue: fairMarketValue, statTrak, souvenir, isLocked: false, isFavorited: false, discoveredAt: epoch * VIRTUAL_MARKET_EPOCH_MS }, fairMarketValue) * 1.01,
    askingPrice * (1 - reservationDiscount),
  ))
  const epochStart = epoch * VIRTUAL_MARKET_EPOCH_MS
  const createdAt = Math.max(0, epochStart)
  const item: SkinInstance = {
    ...skin,
    instanceId: `${id}-item`,
    wear,
    floatValue,
    paintSeed,
    pattern,
    baseMarketValue,
    patternPremium: getPatternPremiumValue(baseMarketValue, pattern),
    marketValue: fairMarketValue,
    statTrak,
    souvenir,
    isLocked: false,
    isFavorited: false,
    discoveredAt: createdAt,
  }

  return {
    id,
    item,
    seller,
    askingPrice,
    reservationPrice: Math.min(askingPrice, reservationPrice),
    fairMarketValue,
    liquidityScore: clamp(1 - scarcityScore, .005, 1),
    scarcityScore,
    createdAt,
    expiresAt: createdAt + VIRTUAL_MARKET_EPOCH_MS,
  }
}

function matchesFilters(listing: NpcMarketListing, filters: VirtualListingFilters) {
  if (typeof filters.minPrice === 'number' && listing.askingPrice < filters.minPrice) return false
  if (typeof filters.maxPrice === 'number' && listing.askingPrice > filters.maxPrice) return false
  if (filters.wear && filters.wear !== 'all' && listing.item.wear !== filters.wear) return false
  if (typeof filters.minFloat === 'number' && listing.item.floatValue < filters.minFloat) return false
  if (typeof filters.maxFloat === 'number' && listing.item.floatValue > filters.maxFloat) return false
  if (typeof filters.patternId === 'number' && listing.item.paintSeed !== filters.patternId) return false
  if (filters.patternTier && filters.patternTier !== 'all') {
    if (filters.patternTier === 'special' && listing.item.pattern?.tier === 'standard') return false
    if (filters.patternTier !== 'special' && listing.item.pattern?.tier !== filters.patternTier) return false
  }
  if (filters.patternClassification?.trim()) {
    const query = filters.patternClassification.trim().toLowerCase()
    const pattern = listing.item.pattern
    if (!pattern || !`${pattern.name} ${pattern.family} ${pattern.tier}`.toLowerCase().includes(query)) return false
  }
  if (filters.edition && filters.edition !== 'all') {
    if (filters.edition === 'stattrak' && !listing.item.statTrak) return false
    if (filters.edition === 'souvenir' && !listing.item.souvenir) return false
    if (filters.edition === 'normal' && (listing.item.statTrak || listing.item.souvenir)) return false
  }
  if (filters.seller && !listing.seller.username.toLowerCase().includes(filters.seller.trim().toLowerCase())) return false
  if (filters.afterPrice) {
    const { descending, id, value } = filters.afterPrice
    const followsCursor = descending
      ? listing.askingPrice < value || (listing.askingPrice === value && listing.id.localeCompare(id) > 0)
      : listing.askingPrice > value || (listing.askingPrice === value && listing.id.localeCompare(id) > 0)
    if (!followsCursor) return false
  }
  if (filters.afterFloat) {
    const { descending, id, value } = filters.afterFloat
    const followsCursor = descending
      ? listing.item.floatValue < value || (listing.item.floatValue === value && listing.id.localeCompare(id) > 0)
      : listing.item.floatValue > value || (listing.item.floatValue === value && listing.id.localeCompare(id) > 0)
    if (!followsCursor) return false
  }
  if (filters.afterDeal) {
    const score = getCredibleDealScore(listing)
    const cursor = filters.afterDeal
    const followsCursor = score < cursor.score
      || (score === cursor.score && listing.askingPrice > cursor.askingPrice)
      || (score === cursor.score && listing.askingPrice === cursor.askingPrice && listing.id.localeCompare(cursor.id) > 0)
    if (!followsCursor) return false
  }
  if (filters.afterCreatedAt) {
    const cursor = filters.afterCreatedAt
    if (!(listing.createdAt < cursor.value || (listing.createdAt === cursor.value && listing.id.localeCompare(cursor.id) > 0))) return false
  }
  if (filters.afterExpiresAt) {
    const cursor = filters.afterExpiresAt
    if (!(listing.expiresAt > cursor.value || (listing.expiresAt === cursor.value && listing.id.localeCompare(cursor.id) > 0))) return false
  }
  if (filters.afterPattern) {
    const multiplier = listing.item.pattern?.premiumMultiplier ?? 1
    const cursor = filters.afterPattern
    const followsCursor = multiplier < cursor.multiplier
      || (multiplier === cursor.multiplier && listing.fairMarketValue < cursor.fairMarketValue)
      || (multiplier === cursor.multiplier && listing.fairMarketValue === cursor.fairMarketValue && listing.id.localeCompare(cursor.id) > 0)
    if (!followsCursor) return false
  }
  return true
}

export function createVirtualListingContinuationFilters(
  filters: VirtualListingFilters,
  sort: VirtualListingSort,
  boundary: NpcMarketListing,
): VirtualListingFilters {
  if (sort === 'lowest-price' || sort === 'highest-price') {
    return {
      ...filters,
      afterPrice: { value: boundary.askingPrice, id: boundary.id, descending: sort === 'highest-price' },
    }
  }
  if (sort === 'lowest-float' || sort === 'highest-float') {
    return {
      ...filters,
      afterFloat: { value: boundary.item.floatValue, id: boundary.id, descending: sort === 'highest-float' },
    }
  }
  if (sort === 'best-deals') {
    return {
      ...filters,
      afterDeal: { score: getCredibleDealScore(boundary), askingPrice: boundary.askingPrice, id: boundary.id },
    }
  }
  if (sort === 'newest') return { ...filters, afterCreatedAt: { value: boundary.createdAt, id: boundary.id } }
  if (sort === 'expiring-soon') return { ...filters, afterExpiresAt: { value: boundary.expiresAt, id: boundary.id } }
  return {
    ...filters,
    afterPattern: {
      multiplier: boundary.item.pattern?.premiumMultiplier ?? 1,
      fairMarketValue: boundary.fairMarketValue,
      id: boundary.id,
    },
  }
}

function estimateFilteredSupply(skin: SkinBase, supply: number, filters: VirtualListingFilters, epoch: number, seed: number) {
  let factor = 1
  if (filters.wear && filters.wear !== 'all') factor *= filters.wear === WearCondition.FieldTested ? .33 : filters.wear === WearCondition.BattleScarred ? .27 : filters.wear === WearCondition.MinimalWear ? .2 : .1
  if (typeof filters.minFloat === 'number' || typeof filters.maxFloat === 'number') factor *= clamp((filters.maxFloat ?? 1) - (filters.minFloat ?? 0), .001, 1)
  if (filters.edition === 'stattrak') factor *= (skin.hasStatTrak ?? skin.statTrak) ? .085 : 0
  if (filters.edition === 'souvenir') factor *= (skin.hasSouvenir ?? skin.souvenir) ? .006 : 0
  if (filters.edition === 'normal') factor *= .909
  if (typeof filters.patternId === 'number') return getVirtualPatternSupply(skin, filters.patternId, supply, epoch, seed)
  if (filters.patternTier === 'special') factor *= .015
  else if (filters.patternTier && filters.patternTier !== 'all') factor *= patternAvailability[filters.patternTier] * .025
  if (filters.patternClassification?.trim()) factor *= .02
  if (filters.seller?.trim()) factor *= .0025
  if (typeof filters.minPrice === 'number' || typeof filters.maxPrice === 'number') factor *= .65
  return Math.max(0, Math.round(supply * factor))
}

function sourceIndexForRank(rank: number, supply: number, skin: SkinBase, epoch: number, sort: VirtualListingSort) {
  if (supply <= 1) return 0
  const direction = sort === 'highest-price' || sort === 'highest-float' || sort === 'newest' || sort === 'valuable-pattern' ? -1 : 1
  const offset = hashVirtualMarketValue(`${skin.id}:${epoch}:${sort}:offset`) % supply
  let step = (hashVirtualMarketValue(`${skin.id}:${sort}:step`) % Math.max(1, supply - 1)) + 1
  while (greatestCommonDivisor(step, supply) !== 1) step += 1
  const normalizedRank = direction < 0 ? supply - 1 - (rank % supply) : rank % supply
  return (offset + normalizedRank * step) % supply
}

function greatestCommonDivisor(a: number, b: number) {
  let left = Math.abs(a)
  let right = Math.abs(b)
  while (right !== 0) {
    const next = left % right
    left = right
    right = next
  }
  return left
}

function compareListings(sort: VirtualListingSort) {
  return (a: NpcMarketListing, b: NpcMarketListing) => {
    if (sort === 'highest-price') return b.askingPrice - a.askingPrice || a.id.localeCompare(b.id)
    if (sort === 'lowest-float') return a.item.floatValue - b.item.floatValue || a.id.localeCompare(b.id)
    if (sort === 'highest-float') return b.item.floatValue - a.item.floatValue || a.id.localeCompare(b.id)
    if (sort === 'best-deals') return getCredibleDealScore(b) - getCredibleDealScore(a) || a.askingPrice - b.askingPrice || a.id.localeCompare(b.id)
    if (sort === 'newest') return b.createdAt - a.createdAt || a.id.localeCompare(b.id)
    if (sort === 'expiring-soon') return a.expiresAt - b.expiresAt || a.id.localeCompare(b.id)
    if (sort === 'valuable-pattern') return (b.item.pattern?.premiumMultiplier ?? 1) - (a.item.pattern?.premiumMultiplier ?? 1) || b.fairMarketValue - a.fairMarketValue || a.id.localeCompare(b.id)
    return a.askingPrice - b.askingPrice || a.id.localeCompare(b.id)
  }
}

export function getCredibleDealScore(listing: NpcMarketListing) {
  const discount = clamp((listing.fairMarketValue - listing.askingPrice) / Math.max(.01, listing.fairMarketValue), -.5, .5)
  const confidence = listing.item.pattern?.referenceConfidence === 'verified'
    ? 1
    : listing.item.pattern?.referenceConfidence === 'estimated' ? .68 : .5
  return discount * confidence
}

export function generateVirtualListingPage({
  skin,
  marketValues,
  epoch,
  seed,
  removedListingIds = [],
  overrides = [],
  filters = {},
  sort = 'lowest-price',
  page = 0,
  pageSize = VIRTUAL_MARKET_PAGE_SIZE,
  now = epoch * VIRTUAL_MARKET_EPOCH_MS + VIRTUAL_MARKET_EPOCH_MS / 2,
}: {
  skin: SkinBase
  marketValues: Record<string, number>
  epoch: number
  seed: number
  removedListingIds?: readonly string[]
  overrides?: readonly NpcMarketListing[]
  filters?: VirtualListingFilters
  sort?: VirtualListingSort
  page?: number
  pageSize?: number
  now?: number
}): VirtualListingPage {
  const totalSupply = getVirtualSkinSupply(skin, marketValues[skin.id], epoch, seed)
  const normalizedPage = Math.max(0, Math.floor(page))
  const normalizedPageSize = clamp(Math.floor(pageSize), 1, 100)
  const epochStart = epoch * VIRTUAL_MARKET_EPOCH_MS
  const virtualPopulationActive = now >= epochStart && now < epochStart + VIRTUAL_MARKET_EPOCH_MS
  const exactPatternSupply = typeof filters.patternId === 'number'
    ? getVirtualPatternSupply(skin, filters.patternId, totalSupply, epoch, seed)
    : undefined
  const removedBeforeGeneration = new Set(removedListingIds)
  const matchingPersistedOverrides = overrides.filter((listing) => listing.expiresAt > now && !removedBeforeGeneration.has(listing.id) && matchesFilters(listing, filters))
  if (!virtualPopulationActive && matchingPersistedOverrides.length === 0) {
    return { listings: [], totalSupply, filteredSupplyEstimate: 0, page: normalizedPage, pageSize: normalizedPageSize, scanned: 0, exactPatternUnavailable: false }
  }
  if (exactPatternSupply === 0 && matchingPersistedOverrides.length === 0) {
    return { listings: [], totalSupply, filteredSupplyEstimate: 0, page: normalizedPage, pageSize: normalizedPageSize, scanned: 0, exactPatternUnavailable: true }
  }
  const removed = removedBeforeGeneration
  const overrideMap = new Map(overrides.map((listing) => [listing.id, listing]))
  const rankedCandidateMultiplier = sort === 'newest' || sort === 'expiring-soon' ? 1 : 16
  const candidateTarget = normalizedPageSize * rankedCandidateMultiplier
  // Page zero ranks a wider deterministic candidate window. Direct numbered
  // pages begin after that window so they cannot overlap it, while cursor-based
  // infinite scrolling always asks for page zero with a continuation filter.
  const skip = normalizedPage === 0
    ? 0
    : normalizedPage * normalizedPageSize + (rankedCandidateMultiplier - 1) * normalizedPageSize
  const matches: NpcMarketListing[] = []
  const seen = new Set<string>()
  let matched = 0
  let scanned = 0
  const scanLimit = Math.min(totalSupply, Math.max(VIRTUAL_MARKET_MAX_SCAN, (skip + normalizedPageSize) * 24))

  // Current-epoch overrides stay at their deterministic source rank. Only an
  // unexpired interacted listing from an older epoch is pinned to page one.
  if (normalizedPage === 0) {
    const currentEpochPrefix = `vm-${epoch.toString(36)}-`
    for (const listing of overrides) {
      if (listing.id.startsWith(currentEpochPrefix) || matches.length >= candidateTarget || listing.expiresAt <= now || removed.has(listing.id) || !matchesFilters(listing, filters)) continue
      matches.push(listing)
      seen.add(listing.id)
    }
  }

  for (let rank = 0; rank < totalSupply && scanned < scanLimit && matches.length < candidateTarget; rank += 1) {
    const sourceIndex = sourceIndexForRank(rank, totalSupply, skin, epoch, sort)
    const generated = createVirtualListing({ skin, marketValues, epoch, seed, sourceIndex })
    scanned += 1
    if (removed.has(generated.id)) continue
    const listing = overrideMap.get(generated.id) ?? generated
    if (listing.expiresAt <= now) continue
    if (seen.has(listing.id)) continue
    if (!matchesFilters(listing, filters)) continue
    if (matched < skip) {
      matched += 1
      continue
    }
    matches.push(listing)
    seen.add(listing.id)
  }

  const listings = matches.sort(compareListings(sort)).slice(0, normalizedPageSize)
  return {
    listings,
    totalSupply,
    filteredSupplyEstimate: estimateFilteredSupply(skin, totalSupply, filters, epoch, seed) + matchingPersistedOverrides.length,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    scanned,
    exactPatternUnavailable: false,
  }
}

export function getVirtualWearDistribution(skin: SkinBase, supply: number) {
  const ranges = getPossibleWearFloatRangesForSkin(skin)
  const available = WEAR_CONDITION_ORDER.filter((wear) => ranges[wear])
  const weights = available.map((wear) => wear === WearCondition.FieldTested ? 5 : wear === WearCondition.BattleScarred ? 4 : wear === WearCondition.MinimalWear ? 3 : wear === WearCondition.WellWorn ? 2 : 1)
  const total = weights.reduce((sum, value) => sum + value, 0)
  return available.map((wear, index) => ({ wear, count: Math.round(supply * weights[index] / total) }))
}

