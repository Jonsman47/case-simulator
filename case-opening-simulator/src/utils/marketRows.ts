import type { MarketTrendArrow } from '../market/marketSimulation'
import type { SkinBase } from '../data/models'
import { getSkinRarityLabel } from './itemLabels'
import { getSkinMarketPriceRange, type MarketPriceRange } from './patternPriceExplorer'

export type MarketSortOption =
  | 'highest-maximum'
  | 'lowest-minimum'
  | 'highest-minimum'
  | 'lowest-maximum'
  | 'alphabetical'

export interface MarketSearchEntry {
  rarityLabel: string
  searchText: string
  skin: SkinBase
}

export interface MarketSkinRow {
  baseValue: number
  marketValue: number
  priceRange: MarketPriceRange
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
  sort: MarketSortOption = 'highest-maximum',
  rangeResolver: (skin: SkinBase, currentMarketValue?: number) => MarketPriceRange = getSkinMarketPriceRange,
) {
  const normalizedQuery = query.trim().toLowerCase()
  const rows: MarketSkinRow[] = []

  for (const entry of searchIndex) {
    if (normalizedQuery && !entry.searchText.includes(normalizedQuery)) {
      continue
    }

    const marketValue = prices[entry.skin.id] ?? entry.skin.baseValue
    rows.push({
      baseValue: entry.skin.baseValue,
      marketValue,
      priceRange: rangeResolver(entry.skin, marketValue),
      rarityLabel: entry.rarityLabel,
      searchText: entry.searchText,
      skin: entry.skin,
      trend: marketTrends[entry.skin.id] ?? '→',
    })
  }

  rows.sort((left, right) => {
    const priceDifference = sort === 'lowest-minimum'
      ? left.priceRange.minimum - right.priceRange.minimum
      : sort === 'highest-minimum'
        ? right.priceRange.minimum - left.priceRange.minimum
        : sort === 'lowest-maximum'
          ? left.priceRange.maximum - right.priceRange.maximum
          : sort === 'alphabetical'
            ? 0
            : right.priceRange.maximum - left.priceRange.maximum

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
