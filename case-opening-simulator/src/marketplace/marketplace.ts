import { nanoid } from 'nanoid'
import { getMarketAdjustedSkinConditionPrice } from '../data/skinPrices'
import {
  Rarity,
  type MarketplaceNpc,
  type MarketplaceState,
  type MarketplaceTransaction,
  type NpcMarketListing,
  type PlayerMarketListing,
  type SkinBase,
  type SkinInstance,
} from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { roundCurrency } from '../utils/safeNumbers'
import {
  applyPatternPremium,
  classifySkinPattern,
  generatePaintSeed,
  getPatternPremiumValue,
  isExceptionalPattern,
  isSpecialPattern,
} from '../utils/skinPatterns'
import { applyWearMultiplier, getWearConditionForFloat, randomFloatForSkin } from '../utils/wear'

export const MARKETPLACE_HISTORY_LIMIT = 160
export const MARKETPLACE_REQUEST_LEDGER_LIMIT = 120
export const MARKETPLACE_LISTING_DURATION_MS = 6 * 60 * 60 * 1_000
export const MARKETPLACE_SUPPLY_TICK_MS = 60_000
export const MARKETPLACE_EPOCH_MS = 6 * 60 * 60 * 1_000

type Prng = () => number

interface NpcArchetype {
  id: string
  patience: [number, number]
  priceSensitivity: [number, number]
  tolerance: [number, number]
  responseDelay: [number, number]
  askBias: [number, number]
  styles: readonly string[]
  preferredWeapons: readonly string[]
}

/** Internal behavior profiles. Their labels are deliberately never shown in the UI. */
export const NPC_ARCHETYPES: readonly NpcArchetype[] = [
  { id: 'swift', patience: [1, 3], priceSensitivity: [.75, .95], tolerance: [.09, .18], responseDelay: [250, 900], askBias: [.96, 1.05], styles: ['short', 'direct'], preferredWeapons: ['AK-47', 'M4A1-S'] },
  { id: 'stone', patience: [2, 4], priceSensitivity: [.92, 1], tolerance: [.01, .045], responseDelay: [700, 1800], askBias: [1.06, 1.19], styles: ['firm'], preferredWeapons: ['Knife', 'Gloves'] },
  { id: 'warm', patience: [4, 7], priceSensitivity: [.7, .9], tolerance: [.08, .16], responseDelay: [500, 1400], askBias: [.98, 1.1], styles: ['friendly'], preferredWeapons: ['USP-S', 'Glock-18'] },
  { id: 'ledger', patience: [5, 8], priceSensitivity: [.88, .98], tolerance: [.03, .08], responseDelay: [900, 2200], askBias: [1.02, 1.15], styles: ['formal'], preferredWeapons: ['AWP', 'AK-47'] },
  { id: 'flip', patience: [2, 5], priceSensitivity: [.74, .94], tolerance: [.06, .14], responseDelay: [300, 1200], askBias: [.95, 1.09], styles: ['direct'], preferredWeapons: ['M4A4', 'AK-47'] },
  { id: 'blue', patience: [5, 9], priceSensitivity: [.94, 1], tolerance: [.01, .055], responseDelay: [1100, 2600], askBias: [1.08, 1.23], styles: ['collector'], preferredWeapons: ['AK-47', 'Five-SeveN', 'Knife'] },
  { id: 'decimal', patience: [4, 8], priceSensitivity: [.9, .99], tolerance: [.02, .065], responseDelay: [900, 2300], askBias: [1.04, 1.18], styles: ['precise'], preferredWeapons: ['AWP', 'M4A1-S'] },
  { id: 'casual', patience: [2, 5], priceSensitivity: [.62, .88], tolerance: [.1, .22], responseDelay: [450, 1700], askBias: [.92, 1.08], styles: ['casual'], preferredWeapons: ['P250', 'MP9'] },
  { id: 'quiet', patience: [6, 10], priceSensitivity: [.9, 1], tolerance: [.015, .05], responseDelay: [1400, 3200], askBias: [1.07, 1.21], styles: ['firm', 'short'], preferredWeapons: ['Knife', 'AWP'] },
  { id: 'hunter', patience: [3, 6], priceSensitivity: [.72, .94], tolerance: [.07, .15], responseDelay: [450, 1500], askBias: [.97, 1.12], styles: ['direct'], preferredWeapons: ['AK-47', 'Desert Eagle'] },
  { id: 'vault', patience: [7, 11], priceSensitivity: [.96, 1], tolerance: [.005, .035], responseDelay: [1200, 3000], askBias: [1.12, 1.28], styles: ['collector', 'formal'], preferredWeapons: ['Knife', 'Gloves', 'AWP'] },
  { id: 'chatty', patience: [4, 7], priceSensitivity: [.72, .92], tolerance: [.08, .17], responseDelay: [350, 1300], askBias: [.96, 1.11], styles: ['friendly', 'casual'], preferredWeapons: ['Glock-18', 'USP-S'] },
  { id: 'anchor', patience: [3, 6], priceSensitivity: [.9, 1], tolerance: [.015, .055], responseDelay: [750, 1800], askBias: [1.05, 1.2], styles: ['firm'], preferredWeapons: ['M4A4', 'M4A1-S'] },
  { id: 'rookie', patience: [2, 5], priceSensitivity: [.55, .82], tolerance: [.12, .25], responseDelay: [300, 1500], askBias: [.88, 1.07], styles: ['casual'], preferredWeapons: ['MAC-10', 'P90'] },
  { id: 'edge', patience: [3, 7], priceSensitivity: [.82, .97], tolerance: [.04, .1], responseDelay: [450, 1500], askBias: [1, 1.15], styles: ['direct', 'precise'], preferredWeapons: ['Knife', 'AK-47'] },
  { id: 'patient', patience: [8, 12], priceSensitivity: [.91, 1], tolerance: [.02, .06], responseDelay: [1500, 3500], askBias: [1.06, 1.2], styles: ['formal'], preferredWeapons: ['AWP', 'Knife'] },
  { id: 'spark', patience: [2, 4], priceSensitivity: [.68, .9], tolerance: [.09, .2], responseDelay: [250, 850], askBias: [.94, 1.08], styles: ['friendly', 'short'], preferredWeapons: ['Tec-9', 'Five-SeveN'] },
  { id: 'highline', patience: [6, 10], priceSensitivity: [.95, 1], tolerance: [.008, .04], responseDelay: [1000, 2800], askBias: [1.1, 1.3], styles: ['collector', 'precise'], preferredWeapons: ['Knife', 'Gloves', 'AK-47'] },
] as const

const usernamePartsA = ['Nova', 'Dust', 'Pixel', 'Crimson', 'Silent', 'Neon', 'Cache', 'Mirage', 'Orbit', 'Frost', 'Copper', 'Echo', 'Vector', 'Marble', 'Carbon', 'Azure', 'Ivy', 'Static']
const usernamePartsB = ['Scout', 'Trader', 'Stack', 'Clutch', 'Scope', 'Rush', 'Vault', 'Fox', 'Byte', 'Wolf', 'Mint', 'Peak', 'Rook', 'Kite', 'Hawk', 'Shift', 'Arc', 'Drift']

const raritySupplyWeight: Record<Rarity, number> = {
  [Rarity.Consumer]: 12,
  [Rarity.Industrial]: 9,
  [Rarity.MilSpec]: 6,
  [Rarity.Restricted]: 3.1,
  [Rarity.Classified]: 1.45,
  [Rarity.Covert]: 0.45,
  [Rarity.SpecialItem]: 0.055,
  [Rarity.Contraband]: 0.012,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function between(range: [number, number], prng: Prng) {
  return range[0] + (range[1] - range[0]) * prng()
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createSeededPrng(seed: number): Prng {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: readonly T[], prng: Prng): T {
  return items[Math.min(items.length - 1, Math.floor(prng() * items.length))]
}

export function createMarketplaceNpc(seed: number, item?: SkinBase): MarketplaceNpc {
  const prng = createSeededPrng(seed)
  const archetype = pick(NPC_ARCHETYPES, prng)
  const suffix = 10 + Math.floor(prng() * 989)
  const preferredWeapons = [...archetype.preferredWeapons]
  if (item && !preferredWeapons.includes(item.weapon) && prng() < .35) preferredWeapons.push(item.weapon)

  return {
    id: `npc-${seed.toString(36)}`,
    username: `${pick(usernamePartsA, prng)}${pick(usernamePartsB, prng)}${suffix}`,
    avatarHue: Math.floor(prng() * 360),
    personalitySeed: seed,
    archetypeId: archetype.id,
    patience: Math.max(1, Math.round(between(archetype.patience, prng))),
    priceSensitivity: between(archetype.priceSensitivity, prng),
    negotiationTolerance: between(archetype.tolerance, prng),
    responseDelayMs: Math.round(between(archetype.responseDelay, prng)),
    preferredWeapons,
  }
}

function getArchetype(npc: MarketplaceNpc) {
  return NPC_ARCHETYPES.find((candidate) => candidate.id === npc.archetypeId) ?? NPC_ARCHETYPES[0]
}

export function getItemLiquidityScore(item: SkinInstance, fairMarketValue = item.marketValue) {
  const rarityFactor = clamp(raritySupplyWeight[item.rarity] / 12, .015, 1)
  const priceFactor = 1 / (1 + Math.pow(Math.max(0, fairMarketValue) / 180, .62))
  const patternFactor = isExceptionalPattern(item) ? .04 : isSpecialPattern(item) ? .4 : 1
  const editionFactor = item.souvenir ? .62 : item.statTrak ? .78 : 1
  return clamp(rarityFactor * priceFactor * patternFactor * editionFactor, .005, 1)
}

export function getInstantSaleRate(item: SkinInstance, fairMarketValue = item.marketValue) {
  return clamp(.85 + .1 * Math.pow(getItemLiquidityScore(item, fairMarketValue), .45), .85, .95)
}

export function getInstantSaleQuote(
  item: SkinInstance,
  marketValues: Record<string, number>,
  sellBonus = 1,
) {
  const fairMarketValue = getCurrentItemMarketValue(item, marketValues)
  const baseRate = getInstantSaleRate(item, fairMarketValue)
  // Progression improves the quote, but direct liquidation never exceeds 95%.
  const effectiveRate = clamp(baseRate * Math.max(.8, sellBonus), .85, .95)
  return {
    fairMarketValue: roundCurrency(fairMarketValue),
    rate: effectiveRate,
    value: roundCurrency(fairMarketValue * effectiveRate),
  }
}

function createMarketItem(
  skin: SkinBase,
  marketValues: Record<string, number>,
  now: number,
  prng: Prng,
): SkinInstance {
  const floatValue = randomFloatForSkin(skin, prng)
  const wear = getWearConditionForFloat(skin, floatValue)
  const hasStatTrak = Boolean(skin.hasStatTrak ?? skin.statTrak)
  const hasSouvenir = Boolean(skin.hasSouvenir ?? skin.souvenir)
  const statTrak = hasStatTrak && prng() < .085
  const souvenir = !statTrak && hasSouvenir && prng() < .006
  const fallback = applyWearMultiplier(marketValues[skin.id] ?? skin.baseValue, wear, floatValue)
  const baseMarketValue = roundCurrency(getMarketAdjustedSkinConditionPrice({
    fallbackValue: fallback,
    isStatTrak: statTrak,
    isSouvenir: souvenir,
    marketValues,
    skin,
    wear,
  }) ?? fallback)
  const paintSeed = generatePaintSeed(prng)
  const pattern = classifySkinPattern(skin, paintSeed)

  return {
    ...skin,
    instanceId: nanoid(),
    wear,
    floatValue,
    paintSeed,
    pattern,
    baseMarketValue,
    patternPremium: getPatternPremiumValue(baseMarketValue, pattern),
    marketValue: applyPatternPremium(baseMarketValue, pattern),
    statTrak,
    souvenir,
    isLocked: false,
    isFavorited: false,
    discoveredAt: now,
  }
}

const catalogSupplyEntries = SKIN_DEFINITIONS.map((skin) => {
  const pricePenalty = 1 / (1 + Math.pow(Math.max(.01, skin.baseValue) / 120, .55))
  const collectionPenalty = skin.caseIds.length === 0 ? .6 : 1
  return { skin, weight: raritySupplyWeight[skin.rarity] * pricePenalty * collectionPenalty }
})
const catalogSupplyTotal = catalogSupplyEntries.reduce((sum, entry) => sum + entry.weight, 0)

function pickSupplySkin(prng: Prng) {
  let target = prng() * catalogSupplyTotal
  for (const entry of catalogSupplyEntries) {
    target -= entry.weight
    if (target <= 0) return entry.skin
  }
  return catalogSupplyEntries[catalogSupplyEntries.length - 1].skin
}

export function createNpcListing({
  marketValues,
  now,
  prng = Math.random,
  skin = pickSupplySkin(prng),
}: {
  marketValues: Record<string, number>
  now: number
  prng?: Prng
  skin?: SkinBase
}): NpcMarketListing {
  const item = createMarketItem(skin, marketValues, now, prng)
  const fairMarketValue = roundCurrency(getCurrentItemMarketValue(item, marketValues))
  const liquidityScore = getItemLiquidityScore(item, fairMarketValue)
  const scarcityScore = clamp(1 - liquidityScore, 0, 1)
  const npcSeed = Math.floor(prng() * 0xffffffff)
  const seller = createMarketplaceNpc(npcSeed, skin)
  const archetype = getArchetype(seller)
  const scarcityPremium = 1 + scarcityScore * scarcityScore * .1
  const askMultiplier = between(archetype.askBias, prng) * scarcityPremium
  const askingPrice = roundCurrency(Math.max(.01, fairMarketValue * askMultiplier))
  const reservationDiscount = seller.negotiationTolerance * (.65 + prng() * .35)
  const reservationPrice = roundCurrency(Math.max(
    fairMarketValue * getInstantSaleRate(item, fairMarketValue) * 1.015,
    askingPrice * (1 - reservationDiscount),
  ))
  const lifetimeMultiplier = 1 + scarcityScore * 3 + prng()

  return {
    id: `listing-${now.toString(36)}-${nanoid(7)}`,
    item,
    seller,
    askingPrice,
    reservationPrice: Math.min(askingPrice, reservationPrice),
    fairMarketValue,
    liquidityScore,
    scarcityScore,
    createdAt: now,
    expiresAt: now + Math.round(MARKETPLACE_LISTING_DURATION_MS * lifetimeMultiplier),
  }
}

export function createDefaultMarketplaceState(now = Date.now()): MarketplaceState {
  return {
    npcListings: [],
    playerListings: [],
    transactions: [],
    processedRequestIds: [],
    lastSupplyTick: now,
    nextSupplyTick: now,
    virtualMarketEpoch: Math.floor(Math.max(0, now) / MARKETPLACE_EPOCH_MS),
    virtualMarketNextEpochAt: Math.max(0, now) + MARKETPLACE_EPOCH_MS,
    virtualMarketSeed: 0x435332,
    removedVirtualListingIds: [],
  }
}

export function refreshNpcSupply(
  marketplace: MarketplaceState,
  _marketValues: Record<string, number>,
  now: number,
  _prng: Prng = Math.random,
) {
  void _prng
  // Ordinary supply is generated per skin and per page by virtualMarket.ts.
  // Only negotiated/materialized exceptions remain in persisted state here.
  const nextListings = marketplace.npcListings.filter((listing) => listing.expiresAt > now)
  const shouldAdvanceEpoch = now >= marketplace.virtualMarketNextEpochAt
  return {
    ...marketplace,
    npcListings: nextListings,
    lastSupplyTick: now,
    nextSupplyTick: now + MARKETPLACE_SUPPLY_TICK_MS,
    virtualMarketEpoch: shouldAdvanceEpoch ? marketplace.virtualMarketEpoch + 1 : marketplace.virtualMarketEpoch,
    virtualMarketNextEpochAt: shouldAdvanceEpoch ? now + MARKETPLACE_EPOCH_MS : marketplace.virtualMarketNextEpochAt,
  }
}

const lowballPhrases = ['nah, too low', 'That is nowhere close.', 'I cannot do that.', 'Come back with a serious offer.']
const firmPhrases = ['Price is firm.', 'I am comfortable waiting.', 'Not moving much on this one.', 'There is not another one like it listed.']
const counterPhrases = ['I could probably do {price}. Would that work?', 'Meet me at {price}?', 'Closest I can get is {price}.', 'I can move to {price}, no lower.']
const acceptPhrases = ['Deal.', 'That works for me.', 'All right, yours.', 'We have a deal.']

function phraseFor(listing: NpcMarketListing, round: number, phrases: readonly string[], price?: number) {
  const prng = createSeededPrng(hashString(`${listing.id}:${round}:${listing.seller.personalitySeed}`))
  return pick(phrases, prng).replace('{price}', price === undefined ? '' : `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
}

export interface NegotiationResult {
  listing: NpcMarketListing
  acceptedPrice?: number
  error?: string
}

export function negotiateNpcListing(listing: NpcMarketListing, rawOffer: number, now = Date.now()): NegotiationResult {
  const offer = roundCurrency(Math.max(0, rawOffer))
  const previous = listing.negotiation
  if (previous && previous.status !== 'open') return { listing, error: 'This negotiation is closed.' }
  if (previous?.cooldownUntil && previous.cooldownUntil > now) return { listing, error: 'The seller is not responding yet.' }
  const round = (previous?.round ?? 0) + 1
  const bestPlayerOffer = Math.max(previous?.bestPlayerOffer ?? 0, offer)
  let patienceRemaining = previous?.patienceRemaining ?? listing.seller.patience
  const messages = [
    ...(previous?.messages ?? []),
    { id: nanoid(), author: 'player' as const, amount: offer, text: `Offer $${offer.toFixed(2)}`, createdAt: now },
  ]

  if (offer >= listing.askingPrice || offer >= listing.reservationPrice && offer >= (previous?.currentCounterOffer ?? 0) * .965) {
    const acceptedPrice = Math.min(listing.askingPrice, offer)
    return {
      acceptedPrice,
      listing: {
        ...listing,
        negotiation: {
          status: 'accepted', round, patienceRemaining, bestPlayerOffer,
          currentCounterOffer: acceptedPrice,
          messages: [...messages, { id: nanoid(), author: 'npc', amount: acceptedPrice, text: phraseFor(listing, round, acceptPhrases), createdAt: now + listing.seller.responseDelayMs }],
        },
      },
    }
  }

  const priorOffer = previous?.messages.filter((message) => message.author === 'player').at(-1)?.amount ?? 0
  const isRegressive = offer <= priorOffer
  const severity = clamp((listing.reservationPrice - offer) / Math.max(.01, listing.reservationPrice), 0, 1)
  patienceRemaining -= isRegressive ? 2 : severity > .18 ? 1 : 0

  if (patienceRemaining <= 0 || (round >= listing.seller.patience && severity > .08)) {
    return {
      listing: {
        ...listing,
        negotiation: {
          status: 'walked-away', round, patienceRemaining: 0, bestPlayerOffer,
          messages: [...messages, { id: nanoid(), author: 'npc', text: phraseFor(listing, round, severity > .2 ? lowballPhrases : firmPhrases), createdAt: now + listing.seller.responseDelayMs }],
        },
      },
    }
  }

  const previousCounter = previous?.currentCounterOffer ?? listing.askingPrice
  const progress = clamp((offer - (previous?.bestPlayerOffer ?? 0)) / Math.max(.01, listing.askingPrice), 0, .25)
  const movement = (.1 + progress) * (1 - listing.scarcityScore * .65) * listing.seller.negotiationTolerance
  const counterOffer = roundCurrency(Math.max(
    listing.reservationPrice,
    previousCounter - (previousCounter - Math.max(offer, listing.reservationPrice)) * clamp(.22 + movement * 2.5, .18, .62),
  ))
  const phrasePool = severity > .22 ? lowballPhrases : counterOffer >= listing.askingPrice * .985 ? firmPhrases : counterPhrases

  return {
    listing: {
      ...listing,
      negotiation: {
        status: 'open', round, patienceRemaining, bestPlayerOffer, currentCounterOffer: counterOffer,
        cooldownUntil: now + Math.min(5_000, listing.seller.responseDelayMs),
        messages: [...messages, { id: nanoid(), author: 'npc', amount: counterOffer, text: phraseFor(listing, round, phrasePool, counterOffer), createdAt: now + listing.seller.responseDelayMs }],
      },
    },
  }
}

export function getPlayerListingAttractiveness(listing: Pick<PlayerMarketListing, 'askingPrice' | 'fairMarketValue' | 'item'>) {
  const ratio = listing.askingPrice / Math.max(.01, listing.fairMarketValue)
  const liquidity = getItemLiquidityScore(listing.item, listing.fairMarketValue)
  if (ratio <= .92) return { label: 'Likely to sell quickly', score: clamp(.82 + liquidity * .18, 0, 1) }
  if (ratio <= 1.02) return { label: 'Competitive market price', score: clamp(.52 + liquidity * .28, 0, 1) }
  if (ratio <= 1.18) return { label: 'May attract an offer', score: clamp(.24 + liquidity * .18, 0, 1) }
  if (ratio <= 1.5) return { label: 'Slow sale expected', score: clamp(.06 + liquidity * .08, 0, 1) }
  return { label: 'Very unlikely to sell', score: .005 }
}

export interface MarketplaceTickResult {
  marketplace: MarketplaceState
  completedSales: PlayerMarketListing[]
  expiredListings: PlayerMarketListing[]
}

export function tickMarketplace(
  marketplace: MarketplaceState,
  marketValues: Record<string, number>,
  now: number,
  prng: Prng = Math.random,
): MarketplaceTickResult {
  let next = now >= marketplace.nextSupplyTick
    ? refreshNpcSupply(marketplace, marketValues, now, prng)
    : { ...marketplace, npcListings: marketplace.npcListings.filter((listing) => listing.expiresAt > now) }
  const completedSales: PlayerMarketListing[] = []
  const expiredListings: PlayerMarketListing[] = []
  const offerTransactions: MarketplaceTransaction[] = []
  const playerListings = next.playerListings.flatMap((listing) => {
    if (listing.expiresAt <= now) {
      expiredListings.push(listing)
      return []
    }
    const ageTicks = Math.max(1, (now - Math.max(listing.createdAt, marketplace.lastSupplyTick)) / MARKETPLACE_SUPPLY_TICK_MS)
    const attractiveness = getPlayerListingAttractiveness(listing)
    const valueDrag = 1 / (1 + Math.pow(listing.fairMarketValue / 2_500, .45))
    const specialCollectorBoost = isSpecialPattern(listing.item) ? 1.22 : 1
    const saleHazard = clamp(attractiveness.score * getItemLiquidityScore(listing.item, listing.fairMarketValue) * valueDrag * specialCollectorBoost * .22 * ageTicks, 0, .72)
    if (prng() < saleHazard) {
      completedSales.push(listing)
      return []
    }
    if (!listing.incomingOffer && prng() < clamp(saleHazard * .7 + (listing.askingPrice > listing.fairMarketValue ? .025 : 0), 0, .18)) {
      const buyer = createMarketplaceNpc(Math.floor(prng() * 0xffffffff), listing.item)
      const floor = listing.fairMarketValue * (.86 + buyer.priceSensitivity * .12)
      const ceiling = Math.min(listing.askingPrice, listing.fairMarketValue * (1 + (isSpecialPattern(listing.item) ? .1 : .035)))
      const amount = roundCurrency(Math.max(.01, floor + (ceiling - floor) * prng()))
      offerTransactions.push({
        id: nanoid(),
        type: 'npc-offer',
        item: listing.item,
        price: amount,
        fairMarketValue: listing.fairMarketValue,
        counterparty: buyer.username,
        createdAt: now,
      })
      return [{
        ...listing,
        status: 'offer-received' as const,
        incomingOffer: { id: nanoid(), buyer, amount, createdAt: now, expiresAt: now + 20 * 60_000 },
      }]
    }
    return [{
      ...listing,
      incomingOffer: listing.incomingOffer && listing.incomingOffer.expiresAt <= now ? undefined : listing.incomingOffer,
      status: listing.incomingOffer && listing.incomingOffer.expiresAt > now ? 'offer-received' as const : 'active' as const,
    }]
  })

  next = {
    ...next,
    playerListings,
    transactions: [...offerTransactions, ...next.transactions].slice(0, MARKETPLACE_HISTORY_LIMIT),
  }
  return { marketplace: next, completedSales, expiredListings }
}

export function rememberMarketplaceRequest(marketplace: MarketplaceState, requestId: string) {
  return {
    ...marketplace,
    processedRequestIds: [...marketplace.processedRequestIds, requestId].slice(-MARKETPLACE_REQUEST_LEDGER_LIMIT),
  }
}

export function hasProcessedMarketplaceRequest(marketplace: MarketplaceState, requestId: string) {
  return marketplace.processedRequestIds.includes(requestId)
}

export function getMarketplaceSupplyExpectation(item: SkinInstance) {
  const liquidity = getItemLiquidityScore(item, item.marketValue)
  // This is the expected count for one exact variant, not the broad base skin.
  // A floor on catalog breadth keeps placeholder/dev catalogs from making an
  // elite float/pattern combination appear artificially common.
  const expected = 96 * liquidity / Math.max(100, SKIN_DEFINITIONS.length / 18)
  return expected
}
