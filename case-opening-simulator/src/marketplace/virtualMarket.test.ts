import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinBase } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import {
  createVirtualListing,
  generateVirtualListingPage,
  getTotalVirtualMarketSupply,
  getVirtualPatternSupply,
  getVirtualSkinSupply,
} from './virtualMarket'

const commonSkin = SKIN_DEFINITIONS.find((skin) => skin.rarity === Rarity.Consumer && skin.baseValue < 5) ?? SKIN_DEFINITIONS[0]
const rareSkin = SKIN_DEFINITIONS.find((skin) => skin.rarity === Rarity.SpecialItem && skin.baseValue > 100) ?? SKIN_DEFINITIONS.at(-1)!
const akCaseHardened: SkinBase = {
  ...commonSkin,
  id: 'ak-case-hardened-test',
  weapon: 'AK-47',
  finish: 'Case Hardened',
  rarity: Rarity.Classified,
  baseValue: 600,
  hasStatTrak: true,
  minFloat: 0,
  maxFloat: 1,
}
const marketValues = Object.fromEntries(SKIN_DEFINITIONS.map((skin) => [skin.id, skin.baseValue]))

describe('virtual marketplace', () => {
  it('models millions of offers without constructing listing objects', () => {
    const started = performance.now()
    const total = getTotalVirtualMarketSupply(SKIN_DEFINITIONS, marketValues, 12, 99)
    expect(total).toBeGreaterThan(1_000_000)
    expect(getVirtualSkinSupply(commonSkin, commonSkin.baseValue, 12, 99)).toBeGreaterThan(10_000)
    expect(getVirtualSkinSupply(commonSkin, commonSkin.baseValue, 12, 99)).toBeGreaterThan(getVirtualSkinSupply(rareSkin, rareSkin.baseValue, 12, 99) * 100)
    expect(performance.now() - started).toBeLessThan(250)
  })

  it('keeps iconic Pattern 661 scarce and permits a zero-listing result', () => {
    const supply = getVirtualSkinSupply(akCaseHardened, akCaseHardened.baseValue, 12, 99)
    expect(getVirtualPatternSupply(akCaseHardened, 661, supply, 12, 99)).toBeLessThanOrEqual(1)
    const epochsWithNoListing = Array.from({ length: 12 }, (_, epoch) => getVirtualPatternSupply(akCaseHardened, 661, supply, epoch, 99)).filter((count) => count === 0)
    expect(epochsWithNoListing.length).toBeGreaterThan(0)
  })

  it('regenerates identical listings with stable IDs and exact item attributes', () => {
    const first = createVirtualListing({ skin: commonSkin, marketValues, epoch: 12, seed: 99, sourceIndex: 872 })
    const second = createVirtualListing({ skin: commonSkin, marketValues, epoch: 12, seed: 99, sourceIndex: 872 })
    expect(second).toEqual(first)
    expect(first.id).toMatch(/^vm-/)
    expect(first.item.instanceId).toBe(`${first.id}-item`)
  })

  it('returns stable pages without duplicate listing IDs', () => {
    const page0 = generateVirtualListingPage({ skin: commonSkin, marketValues, epoch: 12, seed: 99, page: 0, pageSize: 24 })
    const repeated = generateVirtualListingPage({ skin: commonSkin, marketValues, epoch: 12, seed: 99, page: 0, pageSize: 24 })
    const page1 = generateVirtualListingPage({ skin: commonSkin, marketValues, epoch: 12, seed: 99, page: 1, pageSize: 24 })
    expect(repeated.listings).toEqual(page0.listings)
    expect(new Set(page0.listings.map((listing) => listing.id)).size).toBe(page0.listings.length)
    expect(page1.listings.some((listing) => page0.listings.some((first) => first.id === listing.id))).toBe(false)
  })

  it('keeps filtering and sorting stable without scanning the entire supply', () => {
    const result = generateVirtualListingPage({
      skin: commonSkin,
      marketValues,
      epoch: 12,
      seed: 99,
      filters: { wear: WearCondition.FieldTested, minFloat: .15, maxFloat: .3 },
      sort: 'lowest-price',
      page: 0,
    })
    expect(result.listings.length).toBeGreaterThan(0)
    expect(result.listings.every((listing) => listing.item.wear === WearCondition.FieldTested && listing.item.floatValue >= .15 && listing.item.floatValue <= .3)).toBe(true)
    expect(result.listings.map((listing) => listing.askingPrice)).toEqual([...result.listings].map((listing) => listing.askingPrice).sort((a, b) => a - b))
    expect(result.scanned).toBeLessThan(5_000)
  })

  it('excludes purchased IDs from regeneration and preserves materialized negotiation overrides', () => {
    const initial = generateVirtualListingPage({ skin: commonSkin, marketValues, epoch: 12, seed: 99, page: 0 })
    const removed = initial.listings[0]
    const override = { ...initial.listings[1], askingPrice: 1.23 }
    const regenerated = generateVirtualListingPage({ skin: commonSkin, marketValues, epoch: 12, seed: 99, page: 0, removedListingIds: [removed.id], overrides: [override] })
    expect(regenerated.listings.some((listing) => listing.id === removed.id)).toBe(false)
    expect(regenerated.listings.find((listing) => listing.id === override.id)?.askingPrice).toBe(1.23)
  })

  it('browses a thousandth high-supply page within a bounded scan', () => {
    const synthetic: SkinBase = { ...commonSkin, id: 'performance-common', rarity: Rarity.Consumer, baseValue: .05, caseIds: ['a', 'b', 'c', 'd'] }
    const started = performance.now()
    const result = generateVirtualListingPage({ skin: synthetic, marketValues: { [synthetic.id]: .05 }, epoch: 12, seed: 99, page: 1_000, pageSize: 24 })
    expect(result.listings).toHaveLength(24)
    expect(result.scanned).toBeLessThan(30_000)
    expect(performance.now() - started).toBeLessThan(2_000)
  })
})
