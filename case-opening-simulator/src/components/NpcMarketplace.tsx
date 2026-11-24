import {
  ArrowLeft,
  Clock,
  HandCoins,
  History,
  ListFilter,
  ListPlus,
  LoaderCircle,
  MessageCircle,
  Search,
  ShoppingCart,
  Sparkles,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { GlossaryTerm } from './GlossaryTerm'
import { List, type ListImperativeAPI } from 'react-window'
import { Rarity, WearCondition, type NpcMarketListing, type PlayerMarketListing } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { useGame } from '../hooks/useGame'
import { useSessionStorageState } from '../hooks/useSessionStorageState'
import { getPlayerListingAttractiveness } from '../marketplace/marketplace'
import {
  VIRTUAL_MARKET_PAGE_SIZE,
  createVirtualSkinMarketSummary,
  createVirtualListingContinuationFilters,
  generateVirtualListingPage,
  getTotalVirtualMarketSupply,
  getVirtualWearDistribution,
  type VirtualListingEdition,
  type VirtualListingFilters,
  type VirtualListingSort,
  type VirtualPatternTier,
  type VirtualSkinMarketSummary,
} from '../marketplace/virtualMarket'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getCareerSellerFeeDiscount } from '../career/careerUpgrades'
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import { AssetImage } from './AssetImage'
import { PatternBadge } from './PatternInfo'

type MarketplaceTab = 'browse' | 'sell' | 'history'
type CatalogSort = 'most-offers' | 'lowest-starting' | 'highest-maximum' | 'alphabetical'
const CATALOG_PAGE_SIZE = 30
const LISTING_ROW_HEIGHT = 320
const LISTING_ROW_HEIGHT_LARGE_TEXT = 420
const MAX_CACHED_LISTING_PAGES = 18

export function NpcMarketplace() {
  const game = useGame()
  const { state } = game
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSkinId = searchParams.get('skin') ?? undefined
  const requestedTab = searchParams.get('tab')
  const requestedItemId = searchParams.get('item') ?? undefined
  const tab: MarketplaceTab = requestedTab === 'sell' || requestedTab === 'history' ? requestedTab : 'browse'
  const initialListingItem = requestedItemId
    ? state.inventory.find((candidate) => candidate.instanceId === requestedItemId && !candidate.isLocked)
    : undefined
  const [selectedItemId, setSelectedItemId] = useState(() => initialListingItem?.instanceId ?? '')
  const [askingPrice, setAskingPrice] = useState(() => initialListingItem
    ? (getCurrentItemMarketValue(initialListingItem, state.marketValues) * 1.03).toFixed(2)
    : '')
  const totalVirtualSupply = useMemo(() => getTotalVirtualMarketSupply(
    SKIN_DEFINITIONS,
    state.marketValues,
    state.marketplace.virtualMarketEpoch,
    state.marketplace.virtualMarketSeed,
  ), [state.marketValues, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])

  const setTab = (nextTab: MarketplaceTab) => {
    const next = new URLSearchParams(searchParams)
    if (nextTab === 'browse') next.delete('tab')
    else next.set('tab', nextTab)
    next.delete('skin')
    setSearchParams(next)
  }
  const selectSkin = (skinId: string) => {
    sessionStorage.setItem('cswear:catalog-scroll', String(window.scrollY))
    navigate(`/cswear?skin=${encodeURIComponent(skinId)}`, { state: { fromCSWearCatalog: true } })
  }
  const returnToCatalog = () => {
    if ((location.state as { fromCSWearCatalog?: boolean } | null)?.fromCSWearCatalog || window.history.length > 1) navigate(-1)
    else navigate('/cswear')
  }

  return <section className="border border-cs-border bg-cs-panel p-3 sm:p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="font-mono text-xs uppercase text-rarity-special">Procedural simulated market</p><h2 className="mt-1 text-3xl font-semibold text-cs-text">CSWEAR</h2><p className="mt-1 max-w-3xl text-sm text-cs-muted">{SKIN_DEFINITIONS.length.toLocaleString()} skin markets and {totalVirtualSupply.toLocaleString()} estimated active offers, generated on demand. Counts are simulator estimates, not live CSFloat inventory.</p><p className="mt-2 flex flex-wrap gap-3 text-xs text-cs-muted"><GlossaryTerm term="escrow" /><GlossaryTerm term="marketValue" /><GlossaryTerm term="realizedProfit" /><GlossaryTerm term="costBasis" /></p></div>
      <div className="grid grid-cols-3 gap-1 border border-cs-border bg-cs-surface p-1"><TabButton active={tab === 'browse'} icon={<ShoppingCart size={15} />} label="Browse" onClick={() => setTab('browse')} /><TabButton active={tab === 'sell'} icon={<ListPlus size={15} />} label={`My Listings (${state.marketplace.playerListings.length})`} onClick={() => setTab('sell')} /><TabButton active={tab === 'history'} icon={<History size={15} />} label="History" onClick={() => setTab('history')} /></div>
    </div>
    {tab === 'browse' ? selectedSkinId ? <SkinListingMarket onBack={returnToCatalog} skinId={selectedSkinId} /> : <SkinMarketCatalog onSelectSkin={selectSkin} /> : null}
    {tab === 'sell' ? <PlayerSellingPanel askingPrice={askingPrice} selectedItemId={selectedItemId} setAskingPrice={setAskingPrice} setSelectedItemId={setSelectedItemId} /> : null}
    {tab === 'history' ? <TransactionHistory /> : null}
  </section>
}

function SkinMarketCatalog({ onSelectSkin }: { onSelectSkin: (skinId: string) => void }) {
  const { state } = useGame()
  const [search, setSearch] = useSessionStorageState('cswear:catalog-search', '')
  const [weapon, setWeapon] = useSessionStorageState('cswear:catalog-weapon', 'all')
  const [rarity, setRarity] = useSessionStorageState('cswear:catalog-rarity', 'all')
  const [sort, setSort] = useSessionStorageState<CatalogSort>('cswear:catalog-sort', 'most-offers')
  const [visibleCount, setVisibleCount] = useSessionStorageState('cswear:catalog-visible-count', CATALOG_PAGE_SIZE)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const summaries = useMemo(() => SKIN_DEFINITIONS.map((skin) => createVirtualSkinMarketSummary(skin, state.marketValues[skin.id], state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed)), [state.marketValues, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])
  const weapons = useMemo(() => [...new Set(SKIN_DEFINITIONS.map((skin) => skin.weapon))].sort(), [])
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return summaries.filter((summary) => (!query || `${summary.skin.weapon} ${summary.skin.finish}`.toLowerCase().includes(query)) && (weapon === 'all' || summary.skin.weapon === weapon) && (rarity === 'all' || summary.skin.rarity === rarity)).sort((a, b) => {
      if (sort === 'lowest-starting') return a.startingPrice - b.startingPrice || a.skin.id.localeCompare(b.skin.id)
      if (sort === 'highest-maximum') return b.maximumValue - a.maximumValue || a.skin.id.localeCompare(b.skin.id)
      if (sort === 'alphabetical') return `${a.skin.weapon} ${a.skin.finish}`.localeCompare(`${b.skin.weapon} ${b.skin.finish}`)
      return b.supply - a.supply || a.skin.id.localeCompare(b.skin.id)
    })
  }, [rarity, search, sort, summaries, weapon])
  const visible = rows.slice(0, visibleCount)
  const hasMore = visible.length < rows.length

  useEffect(() => {
    const savedScroll = Number(sessionStorage.getItem('cswear:catalog-scroll'))
    if (Number.isFinite(savedScroll) && savedScroll > 0) {
      requestAnimationFrame(() => window.scrollTo({ top: savedScroll }))
    }
  }, [])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !hasMore || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(rows.length, count + CATALOG_PAGE_SIZE))
      }
    }, { rootMargin: '500px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, rows.length, setVisibleCount])

  const resetCatalog = () => setVisibleCount(CATALOG_PAGE_SIZE)

  return <div className="mt-4"><div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_14rem]"><label className="flex min-h-11 items-center gap-2 border border-cs-border bg-cs-surface px-3"><Search className="text-rarity-special" size={16} /><span className="sr-only">Search skin markets</span><input className="min-w-0 flex-1 bg-transparent text-cs-text outline-none" onChange={(event) => { setSearch(event.target.value); resetCatalog() }} placeholder="Search all skins" value={search} /></label><CatalogSelect label="Weapon" onChange={(value) => { setWeapon(value); resetCatalog() }} options={weapons} value={weapon} /><CatalogSelect label="Rarity" onChange={(value) => { setRarity(value); resetCatalog() }} options={Object.values(Rarity)} value={rarity} /><label className="border border-cs-border bg-cs-surface px-3 py-2"><span className="sr-only">Sort skin markets</span><select className="w-full bg-cs-surface text-sm text-cs-text outline-none" onChange={(event) => { setSort(event.target.value as CatalogSort); resetCatalog() }} value={sort}><option value="most-offers">Most active offers</option><option value="lowest-starting">Lowest starting price</option><option value="highest-maximum">Highest possible value</option><option value="alphabetical">Alphabetical</option></select></label></div>
    <div className="content-card-grid mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map((summary) => <SkinMarketCard key={summary.skin.id} onClick={() => onSelectSkin(summary.skin.id)} summary={summary} />)}{visible.length === 0 ? <EmptyState text="No skin markets match those filters." /> : null}</div>
    <div className="mt-4 grid place-items-center border border-cs-border bg-cs-surface px-3 py-3" ref={loadMoreRef}>
      <p className="text-xs text-cs-muted">Showing {visible.length.toLocaleString()} of {rows.length.toLocaleString()} skin markets</p>
      {hasMore ? <button className="mt-2 inline-flex min-h-10 items-center gap-2 border border-cs-border px-4 text-sm text-cs-text hover:border-rarity-special" onClick={() => setVisibleCount((count) => Math.min(rows.length, count + CATALOG_PAGE_SIZE))} type="button"><LoaderCircle size={15} /> Load more skin markets</button> : null}
    </div>
  </div>
}

function SkinMarketCard({ onClick, summary }: { onClick: () => void; summary: VirtualSkinMarketSummary }) {
  return <button className="group flex h-full min-w-0 flex-col border bg-cs-surface p-2.5 text-left transition hover:-translate-y-0.5 hover:bg-cs-panel" data-layout-card="true" onClick={onClick} style={{ borderColor: getSkinRarityColor(summary.skin) }} type="button"><div className="flex min-w-0 items-center gap-2.5"><AssetImage alt="" className="h-16 w-20 shrink-0 object-contain" loading="lazy" src={summary.skin.image} /><div className="min-w-0"><h4 className="break-words font-semibold text-cs-text">{summary.skin.weapon} | {summary.skin.finish}</h4><p className="mt-1 text-xs" style={{ color: getSkinRarityColor(summary.skin) }}>{getSkinRarityLabel(summary.skin)}</p></div></div><div className="mt-2 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2"><Metric label="Starting at" value={formatCurrency(summary.startingPrice)} /><Metric label="Estimated offers" value={summary.supply.toLocaleString()} /></div><div className="mt-2 border border-cs-border bg-cs-panel px-2 py-1.5"><p className="font-mono text-[10px] uppercase text-cs-muted">Full estimated value range</p><p className="mt-1 flex flex-wrap items-center gap-1 break-words text-sm font-semibold text-cs-text">{formatCurrency(summary.minimumValue)} – {formatCurrency(summary.maximumValue)} {summary.hasExceptionalVariant ? <Sparkles aria-label="Exceptional variant available" className="shrink-0 text-rarity-special" size={13} /> : null}</p><p className="mt-1 text-[10px] text-cs-muted">Maximum: {summary.maximumConfidence}</p></div><span className="mt-auto inline-flex min-h-9 items-center justify-center gap-2 border border-rarity-special/60 bg-rarity-special/10 px-3 pt-2 text-center text-sm font-semibold text-rarity-special"><Users className="shrink-0" size={15} /> View all listings</span></button>
}

function SkinListingMarket({ onBack, skinId }: { onBack: () => void; skinId: string }) {
  const game = useGame()
  const { state } = game
  const skin = SKIN_DEFINITIONS.find((candidate) => candidate.id === skinId)
  const key = `cswear:skin:${skinId}`
  const [sort, setSort] = useSessionStorageState<VirtualListingSort>(`${key}:sort`, 'lowest-price')
  const [wear, setWear] = useSessionStorageState<WearCondition | 'all'>(`${key}:wear`, 'all')
  const [edition, setEdition] = useSessionStorageState<VirtualListingEdition>(`${key}:edition`, 'all')
  const [patternTier, setPatternTier] = useSessionStorageState<VirtualPatternTier>(`${key}:pattern-tier`, 'all')
  const [patternClassification, setPatternClassification] = useSessionStorageState(`${key}:classification`, '')
  const [patternId, setPatternId] = useSessionStorageState(`${key}:pattern-id`, '')
  const [minPrice, setMinPrice] = useSessionStorageState(`${key}:min-price`, '')
  const [maxPrice, setMaxPrice] = useSessionStorageState(`${key}:max-price`, '')
  const [minFloat, setMinFloat] = useSessionStorageState(`${key}:min-float`, '')
  const [maxFloat, setMaxFloat] = useSessionStorageState(`${key}:max-float`, '')
  const [seller, setSeller] = useSessionStorageState(`${key}:seller`, '')
  const [negotiatingListing, setNegotiatingListing] = useState<NpcMarketListing>()
  const [listingNow] = useState(() => Date.now())
  const numericPattern = parseOptionalNumber(patternId)
  const filters = useMemo<VirtualListingFilters>(() => ({ wear, edition, patternTier, patternClassification, patternId: numericPattern !== undefined ? Math.floor(numericPattern) : undefined, minPrice: parseOptionalNumber(minPrice), maxPrice: parseOptionalNumber(maxPrice), minFloat: parseOptionalNumber(minFloat), maxFloat: parseOptionalNumber(maxFloat), seller }), [edition, maxFloat, maxPrice, minFloat, minPrice, numericPattern, patternClassification, patternTier, seller, wear])
  const selectedOverrides = useMemo(() => state.marketplace.npcListings.filter((listing) => listing.item.id === skinId), [skinId, state.marketplace.npcListings])
  const activeNegotiationListing = negotiatingListing
    ? selectedOverrides.find((listing) => listing.id === negotiatingListing.id) ?? negotiatingListing
    : undefined
  const result = useMemo(() => skin ? generateVirtualListingPage({ skin, marketValues: state.marketValues, epoch: state.marketplace.virtualMarketEpoch, seed: state.marketplace.virtualMarketSeed, removedListingIds: state.marketplace.removedVirtualListingIds, overrides: selectedOverrides, filters, sort, page: 0, now: listingNow }) : undefined, [filters, listingNow, selectedOverrides, skin, sort, state.marketValues, state.marketplace.removedVirtualListingIds, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])
  const summary = useMemo(() => skin ? createVirtualSkinMarketSummary(skin, state.marketValues[skin.id], state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed) : undefined, [skin, state.marketValues, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])
  const wearDistribution = useMemo(() => skin && summary ? getVirtualWearDistribution(skin, summary.supply) : [], [skin, summary])
  const playerListings = state.marketplace.playerListings.filter((listing) => listing.item.id === skinId)
  if (!skin || !summary || !result) return <EmptyState text="This skin market is unavailable." />
  const resetPage = () => undefined

  return <div className="mt-4"><button className="inline-flex min-h-10 items-center gap-2 border border-cs-border px-3 text-sm text-cs-muted hover:text-cs-text" onClick={onBack} type="button"><ArrowLeft size={16} /> Back to all skin markets</button>
    <div className="mt-3 grid gap-4 border border-cs-border bg-cs-surface p-4 lg:grid-cols-[18rem_minmax(0,1fr)]"><div className="grid min-h-56 place-items-center bg-cs-panel"><AssetImage alt={`${skin.weapon} | ${skin.finish}`} className="max-h-56 w-full object-contain p-4" src={skin.image} /></div><div className="min-w-0"><p className="font-mono text-xs uppercase" style={{ color: getSkinRarityColor(skin) }}>{getSkinRarityLabel(skin)}</p><h4 className="mt-1 text-2xl font-semibold text-cs-text">{skin.weapon} | {skin.finish}</h4><p className="mt-2 text-sm text-cs-muted">A dedicated procedurally generated market. Every new listing has a stable identity and a seven-day lifetime.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Estimated offers" value={(summary.supply + playerListings.length).toLocaleString()} /><Metric label="Lowest listing" value={formatCurrency(result.listings[0]?.askingPrice ?? summary.startingPrice)} /><Metric label="Highest estimated value" value={formatCurrency(summary.maximumValue)} /><Metric label="Player listings" value={playerListings.length.toLocaleString()} /></div><div className="mt-3 flex flex-wrap gap-2">{wearDistribution.map((entry) => <span className="border border-cs-border bg-cs-panel px-2 py-1 text-xs text-cs-muted" key={entry.wear}>{getWearLabel(entry.wear)} · {entry.count.toLocaleString()}</span>)}</div></div></div>
    <div className="mt-3 border border-cs-border bg-cs-surface p-3"><div className="flex items-center gap-2"><ListFilter className="text-rarity-special" size={16} /><h5 className="font-semibold text-cs-text">Listing filters</h5></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"><FilterSelect label="Wear" onChange={(value) => { setWear(value as WearCondition | 'all'); resetPage() }} options={Object.values(WearCondition)} value={wear} /><FilterSelect label="Edition" onChange={(value) => { setEdition(value as VirtualListingEdition); resetPage() }} options={['normal', 'stattrak', 'souvenir']} value={edition} /><FilterSelect label="Pattern tier" onChange={(value) => { setPatternTier(value as VirtualPatternTier); resetPage() }} options={['special', 'notable', 'rare', 'exceptional', 'iconic']} value={patternTier} /><FilterInput label="Pattern ID" max="1000" min="0" onChange={(value) => { setPatternId(value); resetPage() }} placeholder="0–1000" type="number" value={patternId} /><FilterInput label="Pattern classification" onChange={(value) => { setPatternClassification(value); resetPage() }} placeholder="Blue Gem, Fade…" value={patternClassification} /><FilterInput label="Seller" onChange={(value) => { setSeller(value); resetPage() }} placeholder="Username" value={seller} /><FilterInput label="Minimum price" min="0" onChange={(value) => { setMinPrice(value); resetPage() }} placeholder="No minimum" type="number" value={minPrice} /><FilterInput label="Maximum price" min="0" onChange={(value) => { setMaxPrice(value); resetPage() }} placeholder="No maximum" type="number" value={maxPrice} /><FilterInput label="Minimum float" max="1" min="0" onChange={(value) => { setMinFloat(value); resetPage() }} placeholder="0.00" step="0.000001" type="number" value={minFloat} /><FilterInput label="Maximum float" max="1" min="0" onChange={(value) => { setMaxFloat(value); resetPage() }} placeholder="1.00" step="0.000001" type="number" value={maxFloat} /><label className="border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-[10px] uppercase text-cs-muted">Sort listings</span><select aria-label="Sort listings" className="mt-1 w-full bg-cs-panel text-sm text-cs-text outline-none" onChange={(event) => { setSort(event.target.value as VirtualListingSort); resetPage() }} value={sort}><option value="lowest-price">Lowest price</option><option value="highest-price">Highest price</option><option value="lowest-float">Lowest float</option><option value="highest-float">Highest float</option><option value="best-deals">Best deals</option><option value="newest">Newest listings</option><option value="expiring-soon">Expiring soon</option><option value="valuable-pattern">Most valuable patterns</option></select></label></div><p className="mt-2 text-xs text-cs-muted">Visible rows are generated from the deterministic full-population index and virtualized. The complete offer population is never allocated in memory.</p></div>
    {playerListings.length > 0 ? <div className="mt-3 border border-rarity-special/50 bg-rarity-special/10 p-3"><p className="font-semibold text-cs-text">Your listings in this skin market</p><div className="mt-2 space-y-2">{playerListings.map((listing) => <PlayerListingCard key={listing.id} listing={listing} onAccept={() => game.acceptPlayerMarketOffer(listing.id)} onCancel={() => game.cancelPlayerMarketListing(listing.id)} onDecline={() => game.declinePlayerMarketOffer(listing.id)} />)}</div></div> : null}
    <ContinuousListingBrowser filters={filters} key={`${sort}:${JSON.stringify(filters)}`} onNegotiate={setNegotiatingListing} overrides={selectedOverrides} skin={skin} sort={sort} />
    {result.exactPatternUnavailable ? <EmptyState text={`No active listings for Pattern #${filters.patternId}. Rare pattern scarcity is stable for this market epoch.`} /> : result.listings.length === 0 ? <EmptyState text="No active listings match these filters. Try broadening the range." /> : null}
    {activeNegotiationListing ? <NegotiationModal listing={activeNegotiationListing} onBuy={(price) => { game.buyMarketListing(activeNegotiationListing.id, price, activeNegotiationListing); setNegotiatingListing(undefined) }} onClose={() => setNegotiatingListing(undefined)} onOffer={(offer) => game.negotiateMarketListing(activeNegotiationListing.id, offer, activeNegotiationListing)} /> : null}
  </div>
}

interface ContinuousListingRowProps {
  canAfford: (listing: NpcMarketListing) => boolean
  now: number
  onBuy: (listing: NpcMarketListing) => void
  onNegotiate: (listing: NpcMarketListing) => void
  overrides: Map<string, NpcMarketListing>
  pages: Map<number, ReturnType<typeof generateVirtualListingPage>>
}

function ContinuousListingRow({
  ariaAttributes,
  canAfford,
  index,
  now,
  onBuy,
  onNegotiate,
  overrides,
  pages,
  style,
}: ContinuousListingRowProps & {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' }
  index: number
  style: CSSProperties
}) {
  const pageIndex = Math.floor(index / VIRTUAL_MARKET_PAGE_SIZE)
  const page = pages.get(pageIndex)
  const generated = page?.listings[index % VIRTUAL_MARKET_PAGE_SIZE]
  const listing = generated ? overrides.get(generated.id) ?? generated : undefined

  return (
    <div {...ariaAttributes} className="p-1.5" style={style}>
      {listing ? (
        <ListingCard
          canAfford={canAfford(listing)}
          listing={listing}
          now={now}
          onBuy={() => onBuy(listing)}
          onNegotiate={() => onNegotiate(listing)}
        />
      ) : (
        <div className="grid h-full place-items-center border border-cs-border bg-cs-surface text-sm text-cs-muted">
          <span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={16} /> Loading offer…</span>
        </div>
      )}
    </div>
  )
}

function ContinuousListingBrowser({
  filters,
  onNegotiate,
  overrides,
  skin,
  sort,
}: {
  filters: VirtualListingFilters
  onNegotiate: (listing: NpcMarketListing) => void
  overrides: NpcMarketListing[]
  skin: (typeof SKIN_DEFINITIONS)[number]
  sort: VirtualListingSort
}) {
  const game = useGame()
  const { state } = game
  const [queryNow] = useState(() => Date.now())
  const displayNow = useMinuteNow()
  const scrollKey = `cswear:list-scroll:${skin.id}:${sort}:${JSON.stringify(filters)}`
  const cursorStorageKey = `${scrollKey}:cursor`
  const savedStartIndex = Math.max(0, Number(sessionStorage.getItem(scrollKey)) || 0)
  const savedCursor = parseSavedListingFilters(sessionStorage.getItem(cursorStorageKey))
  const generatePage = useCallback((page: number, pageFilters: VirtualListingFilters = filters) => generateVirtualListingPage({
    skin,
    marketValues: state.marketValues,
    epoch: state.marketplace.virtualMarketEpoch,
    seed: state.marketplace.virtualMarketSeed,
    removedListingIds: state.marketplace.removedVirtualListingIds,
    overrides,
    filters: pageFilters,
    sort,
    page,
    now: queryNow,
  }), [filters, overrides, queryNow, skin, sort, state.marketValues, state.marketplace.removedVirtualListingIds, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])
  const firstPage = useMemo(() => generatePage(0), [generatePage])
  const savedPage = Math.floor(savedStartIndex / VIRTUAL_MARKET_PAGE_SIZE)
  const pageFiltersRef = useRef(new Map<number, VirtualListingFilters>([
    [0, filters],
    ...(savedPage > 0 && savedCursor ? [[savedPage, savedCursor] as [number, VirtualListingFilters]] : []),
  ]))
  const [pages, setPages] = useState(() => {
    const initial = new Map<number, ReturnType<typeof generateVirtualListingPage>>([[0, firstPage]])
    if (savedPage > 0) initial.set(savedPage, savedCursor ? generatePage(0, savedCursor) : generatePage(savedPage))
    return initial
  })
  const totalCount = Math.max(0, firstPage.filteredSupplyEstimate)
  const [loadedCount, setLoadedCount] = useState(() => Math.min(totalCount, Math.max(VIRTUAL_MARKET_PAGE_SIZE, savedStartIndex + VIRTUAL_MARKET_PAGE_SIZE)))
  const listRef = useRef<ListImperativeAPI>(null)
  const overrideMap = useMemo(() => new Map(overrides.map((listing) => [listing.id, listing])), [overrides])

  useEffect(() => {
    if (savedStartIndex > 0 && loadedCount > savedStartIndex) {
      listRef.current?.scrollToRow({ align: 'start', behavior: 'instant', index: savedStartIndex })
    }
  }, [loadedCount, savedStartIndex])

  const loadPageRange = useCallback((startIndex: number, stopIndex: number) => {
    const startPage = Math.floor(startIndex / VIRTUAL_MARKET_PAGE_SIZE)
    const stopPage = Math.floor(stopIndex / VIRTUAL_MARKET_PAGE_SIZE)
    setPages((current) => {
      const next = new Map(current)
      let changed = false
      for (let page = startPage; page <= stopPage + 1; page += 1) {
        if (page * VIRTUAL_MARKET_PAGE_SIZE >= totalCount || next.has(page)) continue
        const savedPageFilters = pageFiltersRef.current.get(page)
        if (savedPageFilters) {
          next.set(page, generatePage(0, savedPageFilters))
          changed = true
          continue
        }
        const previous = next.get(page - 1)
        const boundary = previous?.listings.at(-1)
        if (page > 0 && boundary) {
          const continuationFilters = createVirtualListingContinuationFilters(filters, sort, boundary)
          pageFiltersRef.current.set(page, continuationFilters)
          next.set(page, generatePage(0, continuationFilters))
        } else {
          next.set(page, generatePage(page))
        }
        changed = true
      }
      if (next.size > MAX_CACHED_LISTING_PAGES) {
        const center = Math.floor((startPage + stopPage) / 2)
        const ordered = [...next.keys()].sort((left, right) => Math.abs(left - center) - Math.abs(right - center))
        const keep = new Set(ordered.slice(0, MAX_CACHED_LISTING_PAGES))
        for (const page of next.keys()) {
          if (!keep.has(page)) {
            next.delete(page)
            changed = true
          }
        }
      }
      return changed ? next : current
    })
  }, [filters, generatePage, sort, totalCount])

  const handleRowsRendered = useCallback(({ startIndex, stopIndex }: { startIndex: number; stopIndex: number }) => {
    sessionStorage.setItem(scrollKey, String(startIndex))
    const startPage = Math.floor(startIndex / VIRTUAL_MARKET_PAGE_SIZE)
    const startPageFilters = pageFiltersRef.current.get(startPage)
    if (startPageFilters) sessionStorage.setItem(cursorStorageKey, JSON.stringify(startPageFilters))
    loadPageRange(startIndex, stopIndex)
    if (stopIndex >= loadedCount - 6 && loadedCount < totalCount) {
      setLoadedCount((count) => Math.min(totalCount, count + VIRTUAL_MARKET_PAGE_SIZE))
    }
  }, [cursorStorageKey, loadPageRange, loadedCount, scrollKey, totalCount])

  if (totalCount === 0) return null

  return (
    <section className="mt-3 border border-cs-border bg-cs-panel" data-testid="cswear-infinite-list">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cs-border bg-cs-surface px-3 py-2">
        <p className="text-sm text-cs-text">{totalCount.toLocaleString()} estimated matching offers</p>
        <p className="inline-flex items-center gap-1 text-xs text-cs-muted"><LoaderCircle size={13} /> Continuous virtualized browsing</p>
      </div>
      <List
        className="h-[min(64dvh,40rem)] min-h-[24rem] bg-cs-panel"
        defaultHeight={620}
        listRef={listRef}
        onRowsRendered={handleRowsRendered}
        overscanCount={3}
        rowComponent={ContinuousListingRow}
        rowCount={loadedCount}
        rowHeight={state.settings.largeText ? LISTING_ROW_HEIGHT_LARGE_TEXT : LISTING_ROW_HEIGHT}
        rowProps={{
          canAfford: (listing) => state.money >= listing.askingPrice,
          now: displayNow,
          onBuy: (listing) => game.buyMarketListing(listing.id, undefined, listing),
          onNegotiate,
          overrides: overrideMap,
          pages,
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cs-border bg-cs-surface px-3 py-2">
        <p className="text-xs text-cs-muted">Loaded index: {loadedCount.toLocaleString()} of {totalCount.toLocaleString()}. Only nearby rows stay mounted.</p>
        {loadedCount < totalCount ? <button className="min-h-10 border border-cs-border px-4 text-sm text-cs-text hover:border-rarity-special" onClick={() => { const nextCount = Math.min(totalCount, loadedCount + VIRTUAL_MARKET_PAGE_SIZE); loadPageRange(loadedCount, nextCount); setLoadedCount(nextCount) }} type="button">Load more offers</button> : null}
      </div>
    </section>
  )
}

function PlayerSellingPanel({ askingPrice, selectedItemId, setAskingPrice, setSelectedItemId }: { askingPrice: string; selectedItemId: string; setAskingPrice: (value: string) => void; setSelectedItemId: (value: string) => void }) {
  const game = useGame()
  const { state } = game
  const [isReviewing, setIsReviewing] = useState(false)
  const selectedItem = state.inventory.find((item) => item.instanceId === selectedItemId)
  const selectedFairValue = selectedItem ? getCurrentItemMarketValue(selectedItem, state.marketValues) : 0
  const numericAsk = Number(askingPrice)
  const feeRate = Math.max(0.025, 0.05 - getCareerSellerFeeDiscount(state.careerUpgrades))
  const expectedFee = Number.isFinite(numericAsk) ? Math.max(0, numericAsk * feeRate) : 0
  const expectedProceeds = Math.max(0, (Number.isFinite(numericAsk) ? numericAsk : 0) - expectedFee)
  const draftAttractiveness = selectedItem && numericAsk > 0 ? getPlayerListingAttractiveness({ item: selectedItem, askingPrice: numericAsk, fairMarketValue: selectedFairValue }) : undefined
  const canList = Boolean(selectedItem && Number.isFinite(numericAsk) && numericAsk > 0)

  function selectItem(itemId: string) {
    setSelectedItemId(itemId)
    const item = state.inventory.find((candidate) => candidate.instanceId === itemId)
    setAskingPrice(item ? (getCurrentItemMarketValue(item, state.marketValues) * 1.03).toFixed(2) : '')
    setIsReviewing(false)
  }

  function createListing() {
    if (!selectedItem || !canList) return
    game.listItemOnMarket(selectedItem.instanceId, numericAsk)
    setSelectedItemId('')
    setAskingPrice('')
    setIsReviewing(false)
  }

  return <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]"><section className="border border-cs-border bg-cs-surface p-4"><h4 className="flex items-center gap-2 text-lg font-semibold text-cs-text"><Tags size={18} className="text-rarity-special" /> List an owned skin</h4><label className="mt-4 block text-sm text-cs-muted">Inventory item<select className="mt-2 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text" onChange={(event) => selectItem(event.target.value)} value={selectedItemId}><option value="">Choose an unlocked item</option>{state.inventory.filter((item) => !item.isLocked).sort((a, b) => getCurrentItemMarketValue(b, state.marketValues) - getCurrentItemMarketValue(a, state.marketValues)).map((item) => <option key={item.instanceId} value={item.instanceId}>{item.weapon} | {item.finish} · {getWearLabel(item.wear)} · {formatCurrency(getCurrentItemMarketValue(item, state.marketValues))}</option>)}</select></label><label className="mt-3 block text-sm text-cs-muted">Your asking price<input className="mt-2 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text" min="0.01" onChange={(event) => { setAskingPrice(event.target.value); setIsReviewing(false) }} step="0.01" type="number" value={askingPrice} /></label>{selectedItem ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><Metric label="Market estimate" value={formatCurrency(selectedFairValue)} /><Metric label="Difference" value={`${numericAsk >= selectedFairValue ? '+' : ''}${formatCurrency((numericAsk || 0) - selectedFairValue)} (${selectedFairValue > 0 ? (((numericAsk || 0) / selectedFairValue - 1) * 100).toFixed(1) : '0'}%)`} /><Metric label={`Seller fee (${(feeRate * 100).toFixed(1)}%)`} value={formatCurrency(expectedFee)} /><Metric label="Expected proceeds" value={formatCurrency(expectedProceeds)} /><div className="sm:col-span-2"><Metric label="Expected interest" value={draftAttractiveness?.label ?? 'Enter a price'} /></div></div> : null}<p className="mt-3 text-xs leading-relaxed text-cs-muted">The exact item moves into seven-day marketplace escrow only after confirmation. Its Pattern, float, wear, and lock state are preserved.</p>{isReviewing && selectedItem ? <div className="mt-4 border border-rarity-special bg-rarity-special/10 p-3"><p className="font-semibold text-cs-text">Confirm listing</p><p className="mt-1 text-sm text-cs-muted">List {selectedItem.weapon} | {selectedItem.finish} for {formatCurrency(numericAsk)}? Estimated proceeds after fees: <span className="font-semibold text-cs-green">{formatCurrency(expectedProceeds)}</span>.</p><div className="mt-3 grid grid-cols-2 gap-2"><button className="min-h-10 border border-cs-border text-sm text-cs-muted" onClick={() => setIsReviewing(false)} type="button">Back</button><button className="min-h-10 border border-rarity-special bg-rarity-special/10 text-sm font-semibold text-rarity-special" onClick={createListing} type="button">Confirm Listing</button></div></div> : <button className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 py-3 font-semibold text-rarity-special disabled:cursor-not-allowed disabled:opacity-40" disabled={!canList} onClick={() => setIsReviewing(true)} type="button"><ListPlus size={17} /> Review Listing</button>}</section><section className="space-y-3">{state.marketplace.playerListings.map((listing) => <PlayerListingCard key={listing.id} listing={listing} onAccept={() => game.acceptPlayerMarketOffer(listing.id)} onCancel={() => game.cancelPlayerMarketListing(listing.id)} onDecline={() => game.declinePlayerMarketOffer(listing.id)} />)}{state.marketplace.playerListings.length === 0 ? <EmptyState text="You have no active marketplace listings." /> : null}</section></div>
}

function TransactionHistory() {
  const { state } = useGame()
  return <div className="mt-4 overflow-x-auto border border-cs-border"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="bg-cs-surface font-mono text-[10px] uppercase text-cs-muted"><tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Item</th><th className="p-3">Market</th><th className="p-3">Price</th><th className="p-3">Difference</th></tr></thead><tbody>{state.marketplace.transactions.map((transaction) => <tr className="border-t border-cs-border" key={transaction.id}><td className="p-3 text-cs-muted">{new Date(transaction.createdAt).toLocaleString()}</td><td className="p-3 text-cs-text">{transaction.type.replaceAll('-', ' ')}</td><td className="p-3 text-cs-text">{transaction.item.weapon} | {transaction.item.finish}</td><td className="p-3 text-cs-muted">{formatCurrency(transaction.fairMarketValue)}</td><td className="p-3 font-semibold text-cs-green">{formatCurrency(transaction.price)}</td><td className="p-3 text-cs-muted">{transaction.fairMarketValue > 0 ? `${((transaction.price / transaction.fairMarketValue - 1) * 100).toFixed(1)}%` : '—'}</td></tr>)}</tbody></table>{state.marketplace.transactions.length === 0 ? <EmptyState text="Marketplace purchases, sales, offers, negotiations, cancellations, and instant sales appear here." /> : null}</div>
}

function ListingCard({ canAfford, listing, now, onBuy, onNegotiate }: { canAfford: boolean; listing: NpcMarketListing; now: number; onBuy: () => void; onNegotiate: () => void }) {
  const difference = (listing.askingPrice / Math.max(.01, listing.fairMarketValue) - 1) * 100
  const reputation = 82 + (listing.seller.personalitySeed % 180) / 10
  const ageMs = Math.max(0, now - listing.createdAt)
  const ageLabel = ageMs < 60 * 60_000 ? `${Math.max(1, Math.round(ageMs / 60_000))}m ago` : ageMs < 24 * 60 * 60_000 ? `${Math.round(ageMs / 60 / 60_000)}h ago` : `${Math.round(ageMs / 24 / 60 / 60_000)}d ago`
  const expired = listing.expiresAt <= now
  return <article className="flex h-full min-w-0 flex-col border bg-cs-surface p-3" data-layout-card="true" data-testid="cswear-listing-card" style={{ borderColor: getSkinRarityColor(listing.item) }}><div className="flex items-center gap-3"><AssetImage alt="" className="h-16 w-20 shrink-0 object-contain" loading="lazy" src={listing.item.image} /><div className="min-w-0"><h4 className="break-words font-semibold text-cs-text">{listing.item.weapon} | {listing.item.finish}</h4><p className="mt-1 text-xs text-cs-muted">{getWearLabel(listing.item.wear)} · {listing.item.floatValue.toFixed(6)}</p><p className="mt-1 text-xs text-cs-muted">Pattern #{listing.item.paintSeed ?? 0}{listing.item.statTrak ? ' · StatTrak™' : listing.item.souvenir ? ' · Souvenir' : ''}</p></div></div><div className="mt-1 min-h-6"><PatternBadge compact item={listing.item} /></div><div className="mt-2 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2"><Metric label="Seller price" value={formatCurrency(listing.askingPrice)} /><Metric label="Market value" value={formatCurrency(listing.fairMarketValue)} /></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className={difference <= 0 ? 'text-cs-green' : 'text-cs-muted'}>{difference >= 0 ? '+' : ''}{difference.toFixed(1)}% vs market</span><span className={`inline-flex items-center gap-1 ${expired ? 'text-rarity-covert' : 'text-rarity-special'}`}><Clock className="shrink-0" size={12} /> {expired ? 'Expired' : `Expires in ${formatRemainingDuration(listing.expiresAt - now)}`}</span><span className="text-cs-muted">Listed {ageLabel}</span></div><div className="mt-2 flex flex-wrap items-center gap-2 border-t border-cs-border pt-2"><NpcAvatar listing={listing} /><span className="min-w-0 flex-1 break-words text-sm text-cs-text">{listing.seller.username}</span><span className="text-xs text-cs-muted">{reputation.toFixed(1)}% rep</span></div><div className="mt-auto grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 pt-2"><button className="inline-flex min-h-10 items-center justify-center gap-1 border border-cs-border px-2 text-sm text-cs-muted hover:text-cs-text disabled:opacity-40" disabled={expired} onClick={onNegotiate} type="button"><MessageCircle className="shrink-0" size={15} /> Negotiate</button><button className="inline-flex min-h-10 items-center justify-center gap-1 border border-cs-green bg-cs-green/10 px-2 text-sm font-semibold text-cs-green disabled:opacity-40" disabled={!canAfford || expired} onClick={onBuy} type="button"><ShoppingCart className="shrink-0" size={15} /> Buy</button></div></article>
}

function PlayerListingCard({ listing, onAccept, onCancel, onDecline }: { listing: PlayerMarketListing; onAccept: () => void; onCancel: () => void; onDecline: () => void }) {
  const attractiveness = getPlayerListingAttractiveness(listing)
  const now = useMinuteNow()
  return <article className="border border-cs-border bg-cs-surface p-3"><div className="flex gap-3"><AssetImage alt="" className="h-16 w-20 object-contain" src={listing.item.image} /><div className="min-w-0 flex-1"><h4 className="truncate font-semibold text-cs-text">{listing.item.weapon} | {listing.item.finish}</h4><p className="mt-1 text-sm text-cs-muted">Ask {formatCurrency(listing.askingPrice)} · Market {formatCurrency(listing.fairMarketValue)}</p><p className="mt-1 text-xs text-rarity-special">{attractiveness.label} · Expires in {formatRemainingDuration(listing.expiresAt - now)}</p></div><button aria-label="Cancel listing" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={onCancel} type="button"><X size={15} /></button></div>{listing.incomingOffer ? <div className="mt-3 flex flex-col gap-2 border border-rarity-special/60 bg-rarity-special/10 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-cs-text">{listing.incomingOffer.buyer.username} offered {formatCurrency(listing.incomingOffer.amount)}</p><p className="text-xs text-cs-muted">{((listing.incomingOffer.amount / listing.fairMarketValue - 1) * 100).toFixed(1)}% vs market</p></div><button className="border border-cs-border px-3 py-2 text-sm text-cs-muted" onClick={onDecline} type="button">Decline</button><button className="border border-cs-green bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green" onClick={onAccept} type="button">Accept</button></div> : null}</article>
}

function NegotiationModal({ listing, onBuy, onClose, onOffer }: { listing: NpcMarketListing; onBuy: (price: number) => void; onClose: () => void; onOffer: (offer: number) => void }) {
  const [offer, setOffer] = useState(() => (listing.negotiation?.currentCounterOffer ?? listing.askingPrice * .92).toFixed(2))
  const negotiation = listing.negotiation
  const acceptedPrice = negotiation?.status === 'accepted' ? negotiation.currentCounterOffer : undefined
  return <div aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/80 p-3" role="dialog"><section className="my-auto w-full max-w-xl border border-rarity-special bg-cs-surface p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs uppercase text-rarity-special">Negotiation</p><h3 className="mt-1 text-xl font-semibold text-cs-text">{listing.seller.username}</h3><p className="text-sm text-cs-muted">{listing.item.weapon} | {listing.item.finish} · asking {formatCurrency(listing.askingPrice)}</p></div><button aria-label="Close negotiation" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={onClose} type="button"><X size={16} /></button></div><div className="mt-4 max-h-72 space-y-2 overflow-y-auto border border-cs-border bg-cs-panel p-3">{negotiation?.messages.length ? negotiation.messages.map((message) => <div className={`max-w-[86%] border px-3 py-2 text-sm ${message.author === 'player' ? 'ml-auto border-rarity-special/50 bg-rarity-special/10 text-cs-text' : 'border-cs-border bg-cs-surface text-cs-text'}`} key={message.id}>{message.text}</div>) : <p className="text-sm text-cs-muted">Make an offer. This seller has a persistent floor and remembers earlier offers.</p>}</div>{negotiation?.status === 'walked-away' ? <p className="mt-3 border border-rarity-covert/50 bg-rarity-covert/10 p-3 text-sm text-rarity-covert">The seller ended this negotiation.</p> : acceptedPrice !== undefined ? <button className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-cs-green bg-cs-green/10 px-4 py-3 font-semibold text-cs-green" onClick={() => onBuy(acceptedPrice)} type="button"><HandCoins size={17} /> Buy for {formatCurrency(acceptedPrice)}</button> : <><div aria-label="Offer percentage shortcuts" className="mt-3 grid grid-cols-4 gap-2">{[5, 10, 15, 20].map((percent) => <button className="min-h-9 border border-cs-border bg-cs-panel text-sm text-cs-muted hover:border-rarity-special hover:text-cs-text" key={percent} onClick={() => setOffer(Math.max(.01, listing.askingPrice * (1 - percent / 100)).toFixed(2))} type="button">-{percent}%</button>)}</div><div className="mt-2 flex gap-2"><input aria-label="Offer amount" className="min-w-0 flex-1 border border-cs-border bg-cs-panel px-3 py-2 text-cs-text" min="0.01" onChange={(event) => setOffer(event.target.value)} step="0.01" type="number" value={offer} /><button className="border border-rarity-special bg-rarity-special/10 px-4 py-2 font-semibold text-rarity-special" onClick={() => onOffer(Number(offer))} type="button">Send offer</button></div><p className="mt-2 text-xs text-cs-muted">Shortcuts only fill the amount. They never submit an offer automatically.</p></>}<p className="mt-3 text-xs text-cs-muted">Round {negotiation?.round ?? 0} · patience remaining {negotiation?.patienceRemaining ?? listing.seller.patience}. Rare and high-value sellers generally maintain stronger floors.</p></section></div>
}

function formatRemainingDuration(milliseconds: number) { const totalHours = Math.max(0, Math.floor(milliseconds / 3_600_000)); const days = Math.floor(totalHours / 24); const hours = totalHours % 24; return days > 0 ? `${days}d ${hours}h` : `${hours}h` }
function useMinuteNow() { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const intervalId = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(intervalId) }, []); return now }
function NpcAvatar({ listing }: { listing: NpcMarketListing }) { return <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 text-xs font-bold text-white" style={{ backgroundColor: `hsl(${listing.seller.avatarHue} 55% 38%)` }}>{listing.seller.username.slice(0, 2).toUpperCase()}</span> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border border-cs-border bg-cs-panel px-2 py-1.5"><p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p><p className="mt-1 break-words text-sm font-semibold text-cs-text">{value}</p></div> }
function EmptyState({ text }: { text: string }) { return <div className="col-span-full grid min-h-32 place-items-center border border-dashed border-cs-border bg-cs-surface p-6 text-center text-sm text-cs-muted">{text}</div> }
function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) { return <button className={`inline-flex min-h-10 items-center justify-center gap-1 px-2 text-xs font-semibold ${active ? 'bg-rarity-special/15 text-rarity-special' : 'text-cs-muted hover:text-cs-text'}`} onClick={onClick} type="button">{icon}<span className="truncate">{label}</span></button> }
function CatalogSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) { return <label className="border border-cs-border bg-cs-surface px-3 py-2"><span className="sr-only">Filter by {label}</span><select className="w-full bg-cs-surface text-sm text-cs-text outline-none" onChange={(event) => onChange(event.target.value)} value={value}><option value="all">All {label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> }
function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) { return <label className="border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-[10px] uppercase text-cs-muted">{label}</span><select className="mt-1 w-full bg-cs-panel text-sm text-cs-text outline-none" onChange={(event) => onChange(event.target.value)} value={value}><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> }
function FilterInput({ label, onChange, value, ...props }: { label: string; onChange: (value: string) => void; value: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) { return <label className="border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-[10px] uppercase text-cs-muted">{label}</span><input {...props} className="mt-1 w-full bg-transparent text-sm text-cs-text outline-none" onChange={(event) => onChange(event.target.value)} value={value} /></label> }
function parseOptionalNumber(value: string) { if (!value.trim()) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined }
function parseSavedListingFilters(value: string | null): VirtualListingFilters | undefined { if (!value) return undefined; try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as VirtualListingFilters : undefined } catch { return undefined } }
