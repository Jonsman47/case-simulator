import { describe, expect, it } from 'vitest'
import { createDefaultMarketplaceState, createMarketplaceNpc } from '../marketplace/marketplace'
import { gameReducer } from './gameReducer'
import { defaultGameState } from './gameState'
import { Rarity, WearCondition, type NpcMarketListing, type SkinInstance } from './models'

function item(): SkinInstance {
  return {
    id: 'market-test', weapon: 'M4A1-S', finish: 'Test Finish', rarity: Rarity.Classified,
    baseValue: 100, caseIds: ['crate-test'], image: '/assets/placeholder.png', instanceId: 'exact-instance',
    wear: WearCondition.MinimalWear, floatValue: .12, paintSeed: 661,
    pattern: { family: 'case_hardened', name: 'Blue Gem', tier: 'exceptional', premiumMultiplier: 2, referenceConfidence: 'estimated' },
    marketValue: 200, isLocked: false, isFavorited: false, discoveredAt: 1,
  }
}

function listing(): NpcMarketListing {
  const exactItem = item()
  return {
    id: 'listing', item: exactItem, seller: createMarketplaceNpc(99, exactItem),
    askingPrice: 180, reservationPrice: 165, fairMarketValue: 200,
    liquidityScore: .2, scarcityScore: .8, createdAt: 1, expiresAt: 10_000,
  }
}

describe('marketplace reducer transactions', () => {
  it('transfers the exact instance and charges once for replayed requests', () => {
    const initial = { ...defaultGameState, money: 500, inventory: [], marketplace: { ...createDefaultMarketplaceState(), npcListings: [listing()] } }
    const action = { type: 'BUY_MARKET_LISTING' as const, listingId: 'listing', requestId: 'request-1', now: 100 }
    const purchased = gameReducer(initial, action)
    const replayed = gameReducer(purchased, action)
    expect(purchased.money).toBe(320)
    expect(purchased.inventory).toHaveLength(1)
    expect(purchased.inventory[0]).toMatchObject({ instanceId: 'exact-instance', floatValue: .12, paintSeed: 661 })
    expect(purchased.marketplace.pendingAcquisition?.item.instanceId).toBe('exact-instance')
    expect(replayed.money).toBe(320)
    expect(replayed.inventory).toHaveLength(1)
    expect(replayed.marketplace.transactions).toHaveLength(1)
  })

  it('rejects insufficient funds without consuming the listing', () => {
    const initial = { ...defaultGameState, money: 5, inventory: [], marketplace: { ...createDefaultMarketplaceState(), npcListings: [listing()] } }
    const next = gameReducer(initial, { type: 'BUY_MARKET_LISTING', listingId: 'listing', requestId: 'request-2', now: 100 })
    expect(next.money).toBe(5)
    expect(next.inventory).toHaveLength(0)
    expect(next.marketplace.npcListings).toHaveLength(1)
    expect(next.lastError).toMatch(/Need/)
  })

  it('buys a generated listing snapshot once and remembers its virtual ID as removed', () => {
    const virtual = { ...listing(), id: 'vm-epoch-skin-1' }
    const initial = { ...defaultGameState, money: 500, inventory: [], marketplace: createDefaultMarketplaceState() }
    const action = { type: 'BUY_MARKET_LISTING' as const, listingId: virtual.id, listing: virtual, requestId: 'virtual-request', now: 100 }
    const purchased = gameReducer(initial, action)
    const replayed = gameReducer(purchased, action)
    expect(purchased.money).toBe(320)
    expect(purchased.inventory).toHaveLength(1)
    expect(purchased.marketplace.removedVirtualListingIds).toContain(virtual.id)
    expect(replayed.money).toBe(320)
    expect(replayed.inventory).toHaveLength(1)
  })

  it('escrows, expires, and restores a player listing without duplicating it', () => {
    const owned = item()
    const listed = gameReducer({ ...defaultGameState, inventory: [owned], marketplace: createDefaultMarketplaceState() }, {
      type: 'LIST_ITEM_ON_MARKET', itemId: owned.instanceId, askingPrice: 250, requestId: 'list-1', now: 1,
    })
    expect(listed.inventory).toHaveLength(0)
    expect(listed.marketplace.playerListings).toHaveLength(1)
    const expired = gameReducer(listed, { type: 'TICK_MARKETPLACE', now: 8 * 24 * 60 * 60_000, prng: () => 1 })
    expect(expired.inventory.map((candidate) => candidate.instanceId)).toEqual(['exact-instance'])
    expect(expired.marketplace.playerListings).toHaveLength(0)
  })
})
