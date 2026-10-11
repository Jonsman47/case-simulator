import { RefreshCw, Search } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { List } from 'react-window'
import { AssetImage } from '../components/AssetImage'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { useMarket } from '../hooks/useMarket'
import { type MarketTrendArrow } from '../market/marketSimulation'
import { formatCurrency } from '../utils/format'
import {
  createMarketSearchIndex,
  filterAndSortMarketRows,
  type MarketSkinRow,
} from '../utils/marketRows'

const trendClasses: Record<MarketTrendArrow, string> = {
  '↑': 'text-cs-green',
  '↓': 'text-rarity-covert',
  '→': 'text-cs-muted',
}

const MARKET_ROW_HEIGHT = 58
const MARKET_LIST_MAX_HEIGHT = 640
const marketSearchIndex = createMarketSearchIndex(SKIN_DEFINITIONS)
const marketGridColumns =
  'minmax(20rem,2fr) minmax(9rem,1fr) minmax(8rem,.8fr) minmax(4rem,.35fr)'

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
  rows: MarketSkinRow[]
}

function MarketRow({
  ariaAttributes,
  index,
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
      <div
        className={[
          'grid h-full items-center border-b border-cs-border text-left text-sm',
          index % 2 === 0 ? 'bg-cs-surface/60' : 'bg-cs-panel',
        ].join(' ')}
        data-testid="market-row"
        style={{ borderColor: rarityColor, gridTemplateColumns: marketGridColumns }}
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
        <div className="border-r border-cs-border px-2 py-1.5 font-mono text-cs-green">
          {formatCurrency(row.marketValue)}
        </div>
        <div className={`px-2 py-1.5 text-lg ${trendClasses[row.trend]}`}>
          {row.trend}
        </div>
      </div>
    </div>
  )
}

export function Market() {
  const {
    lastMarketTick,
    marketTrends,
    prices,
    tickMarketNow,
  } = useMarket()
  const [searchQuery, setSearchQuery] = useState('')
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
    return filterAndSortMarketRows(marketSearchIndex, prices, marketTrends, deferredSearchQuery)
  }, [deferredSearchQuery, marketTrends, prices])
  const listHeight =
    rows.length === 0
      ? 0
      : Math.min(MARKET_LIST_MAX_HEIGHT, Math.max(240, rows.length * MARKET_ROW_HEIGHT))
  const rowProps = useMemo<MarketRowProps>(() => ({ rows }), [rows])

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
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

      <label className="mt-4 flex min-h-10 min-w-0 items-center gap-3 border border-cs-border bg-cs-panel px-3 py-1.5 text-sm text-cs-muted">
        <Search size={17} className="shrink-0 text-rarity-special" />
        <span className="sr-only">Search market skins</span>
        <input
          className="min-h-8 min-w-0 flex-1 bg-transparent text-cs-text outline-none placeholder:text-cs-muted"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search weapon, finish, or rarity"
          type="search"
          value={searchQuery}
        />
        <span className="font-mono text-[10px] uppercase">
          {rows.length.toLocaleString()} skins
        </span>
      </label>

      <div className="mt-4">
        <div className="overflow-hidden border border-cs-border bg-cs-panel">
          <div className="overflow-x-auto">
            <div className="min-w-[44rem]">
              <div
                className="grid border-b border-cs-border bg-cs-surface text-cs-muted"
                style={{ gridTemplateColumns: marketGridColumns }}
              >
                {['Skin preview', 'Rarity', 'Market', 'Trend'].map((heading) => (
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
    </section>
  )
}
