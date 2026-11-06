import { ArrowDownWideNarrow, RefreshCw, Search, Sparkles } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { List } from 'react-window'
import { AssetImage } from '../components/AssetImage'
import { MarketSkinDetails } from '../components/MarketSkinDetails'
import { NpcMarketplace } from '../components/NpcMarketplace'
import { AcquisitionReveal } from '../components/AcquisitionReveal'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { useMarket } from '../hooks/useMarket'
import { useGame } from '../hooks/useGame'
import { type MarketTrendArrow } from '../market/marketSimulation'
import { formatCurrency } from '../utils/format'
import {
  createMarketSearchIndex,
  filterAndSortMarketRows,
  type MarketSortOption,
  type MarketSkinRow,
} from '../utils/marketRows'

const trendClasses: Record<MarketTrendArrow, string> = {
  '↑': 'text-cs-green',
  '↓': 'text-rarity-covert',
  '→': 'text-cs-muted',
}

const MARKET_ROW_HEIGHT = 68
const MARKET_LIST_MAX_HEIGHT = 640
const marketSearchIndex = createMarketSearchIndex(SKIN_DEFINITIONS)
const marketGridColumns =
  'minmax(20rem,2fr) minmax(9rem,1fr) minmax(13rem,1fr) minmax(4rem,.35fr)'

const marketSortOptions: { label: string; value: MarketSortOption }[] = [
  { label: 'Highest maximum price', value: 'highest-maximum' },
  { label: 'Lowest minimum price', value: 'lowest-minimum' },
  { label: 'Highest minimum price', value: 'highest-minimum' },
  { label: 'Lowest maximum price', value: 'lowest-maximum' },
  { label: 'Alphabetical', value: 'alphabetical' },
]

function maximumConfidenceLabel(row: MarketSkinRow) {
  if (row.priceRange.maximumVariant.confidence === 'market-listing') return 'Listing-backed max'
  if (row.priceRange.maximumVariant.confidence === 'market') return 'Market-priced max'
  return 'Estimated max'
}

function formatTickTime(value: number) {
  if (!value) {
    return 'Waiting'
  }

  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface MarketRowProps {
  onSelect: (row: MarketSkinRow) => void
  rows: MarketSkinRow[]
}

function MarketRow({
  ariaAttributes,
  index,
  onSelect,
  rows,
  style,
}: MarketRowProps & {
  ariaAttributes: {
    'aria-posinset': number
    'aria-setsize': number
    role: 'listitem'
  }
  index: number
  style: CSSProperties
}) {
  const row = rows[index]

  if (!row) {
    return null
  }

  const rarityColor = getSkinRarityColor(row.skin)

  return (
    <div {...ariaAttributes} style={style}>
      <button
        className={[
          'grid h-full w-full items-center border-b border-cs-border text-left text-sm transition-colors hover:bg-rarity-special/10 focus-visible:relative focus-visible:z-10',
          index % 2 === 0 ? 'bg-cs-surface/60' : 'bg-cs-panel',
        ].join(' ')}
        data-testid="market-row"
        onClick={() => onSelect(row)}
        style={{ borderColor: rarityColor, gridTemplateColumns: marketGridColumns }}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-2 border-r border-cs-border px-2 py-1.5 text-cs-text">
          <AssetImage
            alt=""
            className="h-11 w-14 shrink-0 object-contain"
            draggable={false}
            src={row.skin.image}
          />
          <span className="min-w-0 truncate">{row.skin.weapon} | {row.skin.finish}</span>
        </div>
        <div
          className="truncate border-r border-cs-border px-2 py-1.5 text-cs-text"
        >
          {row.rarityLabel}
        </div>
        <div className="min-w-0 border-r border-cs-border px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 font-mono text-sm font-semibold text-cs-green">
            {row.priceRange.hasExceptionalVariant ? <Sparkles aria-hidden="true" className="shrink-0 text-rarity-special" size={14} /> : null}
            <span className="truncate">{formatCurrency(row.priceRange.minimum)} – {formatCurrency(row.priceRange.maximum)}</span>
          </div>
          <span className={`mt-0.5 block font-mono text-[10px] uppercase ${row.priceRange.maximumVariant.confidence === 'simulator-estimate' ? 'text-rarity-special' : 'text-cs-muted'}`}>
            {maximumConfidenceLabel(row)}
          </span>
        </div>
        <div className={`px-2 py-1.5 text-lg ${trendClasses[row.trend]}`}>
          {row.trend}
        </div>
      </button>
    </div>
  )
}

export function Market() {
  const { claimAcquisition, state } = useGame()
  const {
    lastMarketTick,
    marketTrends,
    prices,
    tickMarketNow,
  } = useMarket()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRow, setSelectedRow] = useState<MarketSkinRow>()
  const [sort, setSort] = useState<MarketSortOption>('highest-maximum')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim().toLowerCase())
    }, 180)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchQuery])

  const rows = useMemo(() => {
    return filterAndSortMarketRows(marketSearchIndex, prices, marketTrends, deferredSearchQuery, sort)
  }, [deferredSearchQuery, marketTrends, prices, sort])
  const listHeight =
    rows.length === 0
      ? 0
      : Math.min(MARKET_LIST_MAX_HEIGHT, Math.max(240, rows.length * MARKET_ROW_HEIGHT))
  const rowProps = useMemo<MarketRowProps>(() => ({ onSelect: setSelectedRow, rows }), [rows])

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5" data-onboarding-target="market-catalog">
      <div className="flex flex-col gap-4 border-l-4 border-rarity-contraband pl-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-cs-text sm:text-3xl">Market</h2>
          <p className="mt-2 font-mono text-xs uppercase text-cs-muted">
            Last tick: {formatTickTime(lastMarketTick)}
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
          onClick={tickMarketNow}
          type="button"
        >
          <RefreshCw size={16} />
          Tick Market
        </button>
      </div>

      <NpcMarketplace />

      <div className="mt-7 border-l-4 border-rarity-industrial pl-4">
        <p className="font-mono text-xs uppercase text-rarity-industrial">Reference catalog</p>
        <h3 className="mt-1 text-2xl font-semibold text-cs-text">Price Checker</h3>
        <p className="mt-1 text-sm text-cs-muted">Inspect valid wear, edition, and Pattern ranges across the complete skin catalog.</p>
      </div>

      <div className="mt-4 grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <label className="flex min-h-11 min-w-0 items-center gap-3 border border-cs-border bg-cs-panel px-3 py-1.5 text-sm text-cs-muted">
          <Search size={17} className="shrink-0 text-rarity-special" />
          <span className="sr-only">Search market skins</span>
          <input
            className="min-h-8 min-w-0 flex-1 bg-transparent text-cs-text outline-none placeholder:text-cs-muted"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search weapon, finish, or rarity"
            type="search"
            value={searchQuery}
          />
          <span className="shrink-0 font-mono text-[10px] uppercase">
            {rows.length.toLocaleString()} skins
          </span>
        </label>
        <label className="flex min-h-11 min-w-0 items-center gap-2 border border-cs-border bg-cs-panel px-3 text-sm text-cs-muted">
          <ArrowDownWideNarrow aria-hidden="true" className="shrink-0 text-rarity-special" size={16} />
          <span className="sr-only">Sort Market skins</span>
          <select className="min-w-0 flex-1 bg-cs-panel text-cs-text outline-none" onChange={(event) => setSort(event.target.value as MarketSortOption)} value={sort}>
            {marketSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <div className="overflow-hidden border border-cs-border bg-cs-panel">
          <div className="overflow-x-auto">
            <div className="min-w-[50rem]">
              <div
                className="grid border-b border-cs-border bg-cs-surface text-cs-muted"
                style={{ gridTemplateColumns: marketGridColumns }}
              >
                {['Skin preview', 'Rarity', 'Valid price range', 'Trend'].map((heading) => (
                  <div
                    className="border-r border-cs-border px-2 py-1.5 font-mono text-[10px] uppercase last:border-r-0"
                    key={heading}
                  >
                    {heading}
                  </div>
                ))}
              </div>
              {rows.length > 0 ? (
                <List
                  className="bg-cs-panel"
                  defaultHeight={listHeight}
                  overscanCount={8}
                  rowComponent={MarketRow}
                  rowCount={rows.length}
                  rowHeight={MARKET_ROW_HEIGHT}
                  rowProps={rowProps}
                  style={{ height: listHeight }}
                />
              ) : (
                <div className="grid min-h-60 place-items-center border-t border-cs-border p-8 text-center text-cs-muted">
                  No market listings match this search.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedRow ? <MarketSkinDetails currentMarketValue={selectedRow.marketValue} marketPriceRange={selectedRow.priceRange} onClose={() => setSelectedRow(undefined)} skin={selectedRow.skin} /> : null}
      {state.marketplace.pendingAcquisition && state.marketplace.pendingAcquisition.source !== 'trade-up' ? <AcquisitionReveal acquisition={state.marketplace.pendingAcquisition} onClaim={claimAcquisition} /> : null}
    </section>
  )
}
