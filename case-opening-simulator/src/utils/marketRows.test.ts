import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinBase } from '../data/models'
import {
  createMarketSearchIndex,
  filterAndSortMarketRows,
} from './marketRows'
import type { MarketPriceRange } from './patternPriceExplorer'

function makeSkin(index: number): SkinBase {
  return {
    id: `skin_${index}`,
    weapon: index % 2 === 0 ? 'AK-47' : 'M4A1-S',
    finish: `Pattern ${index % 200}`,
    rarity: index % 7 === 0 ? Rarity.Covert : Rarity.MilSpec,
    baseValue: index + 1,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
  }
}

describe('market row filtering', () => {
  it('filters and sorts a large market catalog within the UI budget', () => {
    const skins = Array.from({ length: 8_000 }, (_, index) => makeSkin(index))
    const prices = Object.fromEntries(skins.map((skin, index) => [skin.id, index % 500]))
    const trends = Object.fromEntries(skins.map((skin) => [skin.id, '→' as const]))
    const searchIndex = createMarketSearchIndex(skins)
    const start = performance.now()
    const rows = filterAndSortMarketRows(searchIndex, prices, trends, 'AK-47 Pattern 1')
    const duration = performance.now() - start

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.searchText.includes('ak-47 pattern 1'))).toBe(true)
    expect(rows[0].marketValue).toBeGreaterThanOrEqual(rows.at(-1)?.marketValue ?? 0)
    expect(duration).toBeLessThan(250)
  })

  it('sorts by valid range extrema, including a lower ordinary price with a $400,000 variant', () => {
    const skins = [makeSkin(0), makeSkin(1), makeSkin(2)].map((skin, index) => ({
      ...skin,
      finish: ['Rare Pattern', 'Premium Ordinary', 'High Floor'][index],
      id: ['skin-a', 'skin-b', 'skin-c'][index],
    }))
    const ranges: Record<string, MarketPriceRange> = {
      'skin-a': makeRange(7_000, 400_000),
      'skin-b': makeRange(15_000, 100_000),
      'skin-c': makeRange(30_000, 90_000),
    }
    const searchIndex = createMarketSearchIndex(skins)
    const resolver = (skin: SkinBase) => ranges[skin.id]

    expect(filterAndSortMarketRows(searchIndex, {}, {}, '', 'highest-maximum', resolver).map((row) => row.skin.id)).toEqual(['skin-a', 'skin-b', 'skin-c'])
    expect(filterAndSortMarketRows(searchIndex, {}, {}, '', 'lowest-minimum', resolver).map((row) => row.skin.id)).toEqual(['skin-a', 'skin-b', 'skin-c'])
    expect(filterAndSortMarketRows(searchIndex, {}, {}, '', 'highest-minimum', resolver).map((row) => row.skin.id)).toEqual(['skin-c', 'skin-b', 'skin-a'])
    expect(filterAndSortMarketRows(searchIndex, {}, {}, '', 'lowest-maximum', resolver).map((row) => row.skin.id)).toEqual(['skin-c', 'skin-b', 'skin-a'])
  })
})

function makeRange(minimum: number, maximum: number): MarketPriceRange {
  const variant = {
    confidence: 'simulator-estimate' as const,
    edition: 'normal' as const,
    patternName: 'Test pattern',
    source: 'Test',
    wear: WearCondition.FieldTested,
  }
  return {
    hasExceptionalVariant: maximum >= minimum * 2,
    maximum,
    maximumVariant: { ...variant, value: maximum },
    minimum,
    minimumVariant: { ...variant, value: minimum },
  }
}
