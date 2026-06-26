import { describe, expect, it } from 'vitest'
import { Rarity, type SkinBase } from '../data/models'
import {
  createMarketSearchIndex,
  filterAndSortMarketRows,
} from './marketRows'

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
})
