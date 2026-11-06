import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type NpcMarketListing, type PlayerMarketListing, type SkinInstance } from '../data/models'
import {
  NPC_ARCHETYPES,
  createDefaultMarketplaceState,
  createMarketplaceNpc,
  createSeededPrng,
  getInstantSaleQuote,
  getMarketplaceSupplyExpectation,
  negotiateNpcListing,
  refreshNpcSupply,
  tickMarketplace,
} from './marketplace'

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'test-skin', weapon: 'AK-47', finish: 'Test', rarity: Rarity.MilSpec,
    baseValue: 20, caseIds: ['crate-test'], image: '/assets/placeholder.png',
    instanceId: 'instance-1', wear: WearCondition.FieldTested, floatValue: .2,
    marketValue: 20, isLocked: false, isFavorited: false, discoveredAt: 1,
    ...overrides,
  }
}

function makeListing(overrides: Partial<NpcMarketListing> = {}): NpcMarketListing {
  const item = makeItem()
  return {
    id: 'listing-1', item, seller: createMarketplaceNpc(42, item), askingPrice: 100,
    reservationPrice: 90, fairMarketValue: 95, liquidityScore: .5, scarcityScore: .5,
    createdAt: 1_000, expiresAt: 1_000_000,
    ...overrides,
  }
}

describe('simulated NPC marketplace', () => {
  it('ships 18 stable hidden behavior archetypes and deterministic identities', () => {
    expect(NPC_ARCHETYPES).toHaveLength(18)
    expect(createMarketplaceNpc(12345)).toEqual(createMarketplaceNpc(12345))
    expect(createMarketplaceNpc(12345).username).not.toContain(createMarketplaceNpc(12345).archetypeId)
  })

  it('keeps elite supply dramatically below common supply', () => {
    const common = makeItem({ rarity: Rarity.Consumer, marketValue: 1 })
    const elite = makeItem({
      rarity: Rarity.SpecialItem,
      marketValue: 400_000,
      pattern: { family: 'case_hardened', name: 'Blue Gem', tier: 'iconic', premiumMultiplier: 50, referenceConfidence: 'estimated' },
    })
    expect(getMarketplaceSupplyExpectation(common)).toBeGreaterThan(getMarketplaceSupplyExpectation(elite) * 100)
    expect(getMarketplaceSupplyExpectation(elite)).toBeLessThan(.1)
    const populated = refreshNpcSupply(createDefaultMarketplaceState(0), {}, 10_000, createSeededPrng(77))
    expect(populated.npcListings).toHaveLength(0)
    expect(populated.virtualMarketEpoch).toBe(0)
  })

  it('quotes full-instance instant sales only inside the 85–95% band', () => {
    const ordinary = makeItem({ marketValue: 100 })
    const exceptional = makeItem({
      marketValue: 2_000,
      pattern: { family: 'case_hardened', name: 'Blue Gem', tier: 'exceptional', premiumMultiplier: 20, referenceConfidence: 'estimated' },
    })
    const ordinaryQuote = getInstantSaleQuote(ordinary, {})
    const exceptionalQuote = getInstantSaleQuote(exceptional, {})
    expect(ordinaryQuote.rate).toBeGreaterThanOrEqual(.85)
    expect(ordinaryQuote.rate).toBeLessThanOrEqual(.95)
    expect(exceptionalQuote.rate).toBeGreaterThanOrEqual(.85)
    expect(exceptionalQuote.rate).toBeLessThanOrEqual(.95)
    expect(exceptionalQuote.value).toBeGreaterThan(ordinaryQuote.value * 10)
  })

  it('keeps a coherent reservation floor and remembers regressive offers', () => {
    const first = negotiateNpcListing(makeListing(), 70, 10_000).listing
    const second = negotiateNpcListing(first, 80, 20_000).listing
    expect(first.negotiation?.currentCounterOffer).toBeGreaterThanOrEqual(90)
    expect(second.negotiation?.currentCounterOffer).toBeGreaterThanOrEqual(90)
    expect(second.negotiation?.currentCounterOffer).toBeLessThanOrEqual(first.negotiation?.currentCounterOffer ?? 100)
    const regressive = negotiateNpcListing(second, 60, 30_000).listing
    expect(regressive.negotiation?.bestPlayerOffer).toBe(80)
    expect(regressive.negotiation?.patienceRemaining).toBeLessThan(second.negotiation?.patienceRemaining ?? 99)
    const accepted = negotiateNpcListing(makeListing(), 90, 10_000)
    expect(accepted.acceptedPrice).toBe(90)
    expect(accepted.listing.reservationPrice).toBe(90)
  })

  it('uses hazard ticks for fair player listings and returns expired escrow', () => {
    const item = makeItem()
    const active: PlayerMarketListing = {
      id: 'active', item, askingPrice: 18, fairMarketValue: 20,
      createdAt: 1_000, expiresAt: 1_000_000, status: 'active',
    }
    const expired: PlayerMarketListing = {
      ...active, id: 'expired', item: makeItem({ instanceId: 'expired-item' }), expiresAt: 5_000,
    }
    const marketplace = { ...createDefaultMarketplaceState(1_000), nextSupplyTick: Number.MAX_SAFE_INTEGER, playerListings: [active, expired] }
    const result = tickMarketplace(marketplace, {}, 100_000, () => 0)
    expect(result.completedSales.map((listing) => listing.id)).toContain('active')
    expect(result.expiredListings.map((listing) => listing.id)).toEqual(['expired'])
    expect(result.marketplace.playerListings).toHaveLength(0)
  })
})
