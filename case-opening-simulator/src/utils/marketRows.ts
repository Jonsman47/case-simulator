import type { MarketTrendArrow } from '../market/marketSimulation'
import type { SkinBase } from '../data/models'
import { getSkinRarityLabel } from './itemLabels'

export interface MarketSearchEntry {
  rarityLabel: string
  searchText: string
  skin: SkinBase
}

export interface MarketSkinRow {
  baseValue: number
  marketValue: number
  rarityLabel: string
  searchText: string
  skin: SkinBase
  trend: MarketTrendArrow
}

const marketNameCollator = new Intl.Collator(undefined, { sensitivity: 'base' })

export function createMarketSearchIndex(skins: SkinBase[]): MarketSearchEntry[] {
  return skins.map((skin) => {
    const rarityLabel = getSkinRarityLabel(skin)

    return {
      rarityLabel,
      searchText: `${skin.weapon} ${skin.finish} ${rarityLabel}`.toLowerCase(),
      skin,
    }
  })
}

export function filterAndSortMarketRows(
  searchIndex: MarketSearchEntry[],
  prices: Record<string, number>,
  marketTrends: Record<string, MarketTrendArrow>,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase()
  const rows: MarketSkinRow[] = []

  for (const entry of searchIndex) {
    if (normalizedQuery && !entry.searchText.includes(normalizedQuery)) {
      continue
    }

    rows.push({
      baseValue: entry.skin.baseValue,
      marketValue: prices[entry.skin.id] ?? entry.skin.baseValue,
      rarityLabel: entry.rarityLabel,
      searchText: entry.searchText,
      skin: entry.skin,
      trend: marketTrends[entry.skin.id] ?? '→',
    })
  }

  rows.sort((left, right) => {
    const priceDifference = right.marketValue - left.marketValue

    if (priceDifference !== 0) {
      return priceDifference
    }

    return marketNameCollator.compare(
      `${left.skin.weapon} ${left.skin.finish}`,
      `${right.skin.weapon} ${right.skin.finish}`,
    )
  })

  return rows
}
