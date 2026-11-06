import {
  ArrowLeft,
  Clock,
  HandCoins,
  History,
  ListFilter,
  ListPlus,
  MessageCircle,
  Search,
  ShoppingCart,
  Sparkles,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Rarity, WearCondition, type NpcMarketListing, type PlayerMarketListing } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { useGame } from '../hooks/useGame'
import { getPlayerListingAttractiveness } from '../marketplace/marketplace'
import {
  VIRTUAL_MARKET_PAGE_SIZE,
  createVirtualSkinMarketSummary,
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
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import { AssetImage } from './AssetImage'
import { PatternBadge } from './PatternInfo'

type MarketplaceTab = 'browse' | 'sell' | 'history'
type CatalogSort = 'most-offers' | 'lowest-starting' | 'highest-maximum' | 'alphabetical'
const CATALOG_PAGE_SIZE = 30

export function NpcMarketplace() {
  const game = useGame()
  const { state } = game
  const [tab, setTab] = useState<MarketplaceTab>('browse')
  const [selectedSkinId, setSelectedSkinId] = useState<string>()
  const [selectedItemId, setSelectedItemId] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const totalVirtualSupply = useMemo(() => getTotalVirtualMarketSupply(
    SKIN_DEFINITIONS,
    state.marketValues,
    state.marketplace.virtualMarketEpoch,
    state.marketplace.virtualMarketSeed,
  ), [state.marketValues, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])

  return <section className="mt-5 border border-cs-border bg-cs-panel p-3 sm:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="font-mono text-xs uppercase text-rarity-special">Procedural simulated market</p><h3 className="mt-1 text-2xl font-semibold text-cs-text">Skin Marketplace</h3><p className="mt-1 max-w-3xl text-sm text-cs-muted">{SKIN_DEFINITIONS.length.toLocaleString()} skin markets and {totalVirtualSupply.toLocaleString()} estimated active offers, generated on demand. Counts are simulator estimates, not live CSFloat inventory.</p></div>
      <div className="grid grid-cols-3 gap-1 border border-cs-border bg-cs-surface p-1"><TabButton active={tab === 'browse'} icon={<ShoppingCart size={15} />} label="Browse" onClick={() => setTab('browse')} /><TabButton active={tab === 'sell'} icon={<ListPlus size={15} />} label={`My Listings (${state.marketplace.playerListings.length})`} onClick={() => setTab('sell')} /><TabButton active={tab === 'history'} icon={<History size={15} />} label="History" onClick={() => setTab('history')} /></div>
    </div>
    {tab === 'browse' ? selectedSkinId ? <SkinListingMarket onBack={() => setSelectedSkinId(undefined)} skinId={selectedSkinId} /> : <SkinMarketCatalog onSelectSkin={setSelectedSkinId} /> : null}
    {tab === 'sell' ? <PlayerSellingPanel askingPrice={askingPrice} selectedItemId={selectedItemId} setAskingPrice={setAskingPrice} setSelectedItemId={setSelectedItemId} /> : null}
    {tab === 'history' ? <TransactionHistory /> : null}
  </section>
}

function SkinMarketCatalog({ onSelectSkin }: { onSelectSkin: (skinId: string) => void }) {
  const { state } = useGame()
  const [search, setSearch] = useState('')
  const [weapon, setWeapon] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [sort, setSort] = useState<CatalogSort>('most-offers')
  const [page, setPage] = useState(0)
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
  const pageCount = Math.max(1, Math.ceil(rows.length / CATALOG_PAGE_SIZE))
  const visiblePage = Math.min(page, pageCount - 1)
  const visible = rows.slice(visiblePage * CATALOG_PAGE_SIZE, (visiblePage + 1) * CATALOG_PAGE_SIZE)

  return <div className="mt-4"><div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_14rem]"><label className="flex min-h-11 items-center gap-2 border border-cs-border bg-cs-surface px-3"><Search className="text-rarity-special" size={16} /><span className="sr-only">Search skin markets</span><input className="min-w-0 flex-1 bg-transparent text-cs-text outline-none" onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search all skins" value={search} /></label><CatalogSelect label="Weapon" onChange={(value) => { setWeapon(value); setPage(0) }} options={weapons} value={weapon} /><CatalogSelect label="Rarity" onChange={(value) => { setRarity(value); setPage(0) }} options={Object.values(Rarity)} value={rarity} /><label className="border border-cs-border bg-cs-surface px-3 py-2"><span className="sr-only">Sort skin markets</span><select className="w-full bg-cs-surface text-sm text-cs-text outline-none" onChange={(event) => { setSort(event.target.value as CatalogSort); setPage(0) }} value={sort}><option value="most-offers">Most active offers</option><option value="lowest-starting">Lowest starting price</option><option value="highest-maximum">Highest possible value</option><option value="alphabetical">Alphabetical</option></select></label></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map((summary) => <SkinMarketCard key={summary.skin.id} onClick={() => onSelectSkin(summary.skin.id)} summary={summary} />)}{visible.length === 0 ? <EmptyState text="No skin markets match those filters." /> : null}</div>
    <Pagination label={`${rows.length.toLocaleString()} skin markets`} onPage={setPage} page={visiblePage} pageCount={pageCount} />
  </div>
}

function SkinMarketCard({ onClick, summary }: { onClick: () => void; summary: VirtualSkinMarketSummary }) {
  return <button className="group flex min-w-0 flex-col border bg-cs-surface p-3 text-left transition hover:-translate-y-0.5 hover:bg-cs-panel" onClick={onClick} style={{ borderColor: getSkinRarityColor(summary.skin) }} type="button"><div className="flex min-w-0 items-center gap-3"><AssetImage alt="" className="h-20 w-24 shrink-0 object-contain" loading="lazy" src={summary.skin.image} /><div className="min-w-0"><h4 className="line-clamp-2 font-semibold text-cs-text">{summary.skin.weapon} | {summary.skin.finish}</h4><p className="mt-1 text-xs" style={{ color: getSkinRarityColor(summary.skin) }}>{getSkinRarityLabel(summary.skin)}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Starting at" value={formatCurrency(summary.startingPrice)} /><Metric label="Estimated offers" value={summary.supply.toLocaleString()} /></div><div className="mt-2 border border-cs-border bg-cs-panel px-2 py-2"><p className="font-mono text-[10px] uppercase text-cs-muted">Full estimated value range</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-cs-text">{formatCurrency(summary.minimumValue)} – {formatCurrency(summary.maximumValue)} {summary.hasExceptionalVariant ? <Sparkles aria-label="Exceptional variant available" className="text-rarity-special" size={13} /> : null}</p><p className="mt-1 text-[10px] text-cs-muted">Maximum: {summary.maximumConfidence}</p></div><span className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 border border-rarity-special/60 bg-rarity-special/10 px-3 text-sm font-semibold text-rarity-special"><Users size={15} /> View all listings</span></button>
}

function SkinListingMarket({ onBack, skinId }: { onBack: () => void; skinId: string }) {
  const game = useGame()
  const { state } = game
  const skin = SKIN_DEFINITIONS.find((candidate) => candidate.id === skinId)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<VirtualListingSort>('lowest-price')
  const [wear, setWear] = useState<WearCondition | 'all'>('all')
  const [edition, setEdition] = useState<VirtualListingEdition>('all')
  const [patternTier, setPatternTier] = useState<VirtualPatternTier>('all')
  const [patternId, setPatternId] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minFloat, setMinFloat] = useState('')
  const [maxFloat, setMaxFloat] = useState('')
  const [seller, setSeller] = useState('')
  const [negotiatingId, setNegotiatingId] = useState<string>()
  const numericPattern = parseOptionalNumber(patternId)
  const filters = useMemo<VirtualListingFilters>(() => ({ wear, edition, patternTier, patternId: numericPattern !== undefined ? Math.floor(numericPattern) : undefined, minPrice: parseOptionalNumber(minPrice), maxPrice: parseOptionalNumber(maxPrice), minFloat: parseOptionalNumber(minFloat), maxFloat: parseOptionalNumber(maxFloat), seller }), [edition, maxFloat, maxPrice, minFloat, minPrice, numericPattern, patternTier, seller, wear])
  const selectedOverrides = useMemo(() => state.marketplace.npcListings.filter((listing) => listing.item.id === skinId), [skinId, state.marketplace.npcListings])
  const result = useMemo(() => skin ? generateVirtualListingPage({ skin, marketValues: state.marketValues, epoch: state.marketplace.virtualMarketEpoch, seed: state.marketplace.virtualMarketSeed, removedListingIds: state.marketplace.removedVirtualListingIds, overrides: selectedOverrides, filters, sort, page }) : undefined, [filters, page, selectedOverrides, skin, sort, state.marketValues, state.marketplace.removedVirtualListingIds, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])
  const summary = useMemo(() => skin ? createVirtualSkinMarketSummary(skin, state.marketValues[skin.id], state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed) : undefined, [skin, state.marketValues, state.marketplace.virtualMarketEpoch, state.marketplace.virtualMarketSeed])
  const wearDistribution = useMemo(() => skin && summary ? getVirtualWearDistribution(skin, summary.supply) : [], [skin, summary])
  const playerListings = state.marketplace.playerListings.filter((listing) => listing.item.id === skinId)
  const negotiationListing = selectedOverrides.find((listing) => listing.id === negotiatingId) ?? result?.listings.find((listing) => listing.id === negotiatingId)
  const pageCount = Math.max(1, Math.ceil((result?.filteredSupplyEstimate ?? 0) / VIRTUAL_MARKET_PAGE_SIZE))
  if (!skin || !summary || !result) return <EmptyState text="This skin market is unavailable." />
  const resetPage = () => setPage(0)

  return <div className="mt-4"><button className="inline-flex min-h-10 items-center gap-2 border border-cs-border px-3 text-sm text-cs-muted hover:text-cs-text" onClick={onBack} type="button"><ArrowLeft size={16} /> Back to all skin markets</button>
    <div className="mt-3 grid gap-4 border border-cs-border bg-cs-surface p-4 lg:grid-cols-[18rem_minmax(0,1fr)]"><div className="grid min-h-56 place-items-center bg-cs-panel"><AssetImage alt={`${skin.weapon} | ${skin.finish}`} className="max-h-56 w-full object-contain p-4" src={skin.image} /></div><div className="min-w-0"><p className="font-mono text-xs uppercase" style={{ color: getSkinRarityColor(skin) }}>{getSkinRarityLabel(skin)}</p><h4 className="mt-1 text-2xl font-semibold text-cs-text">{skin.weapon} | {skin.finish}</h4><p className="mt-2 text-sm text-cs-muted">A dedicated procedurally generated market. Supply remains stable throughout the current six-hour market epoch.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Estimated offers" value={(summary.supply + playerListings.length).toLocaleString()} /><Metric label="Lowest listing" value={formatCurrency(result.listings[0]?.askingPrice ?? summary.startingPrice)} /><Metric label="Highest estimated value" value={formatCurrency(summary.maximumValue)} /><Metric label="Player listings" value={playerListings.length.toLocaleString()} /></div><div className="mt-3 flex flex-wrap gap-2">{wearDistribution.map((entry) => <span className="border border-cs-border bg-cs-panel px-2 py-1 text-xs text-cs-muted" key={entry.wear}>{getWearLabel(entry.wear)} · {entry.count.toLocaleString()}</span>)}</div></div></div>
    <div className="mt-3 border border-cs-border bg-cs-surface p-3"><div className="flex items-center gap-2"><ListFilter className="text-rarity-special" size={16} /><h5 className="font-semibold text-cs-text">Listing filters</h5></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"><FilterSelect label="Wear" onChange={(value) => { setWear(value as WearCondition | 'all'); resetPage() }} options={Object.values(WearCondition)} value={wear} /><FilterSelect label="Edition" onChange={(value) => { setEdition(value as VirtualListingEdition); resetPage() }} options={['normal', 'stattrak', 'souvenir']} value={edition} /><FilterSelect label="Pattern tier" onChange={(value) => { setPatternTier(value as VirtualPatternTier); resetPage() }} options={['special', 'notable', 'rare', 'exceptional', 'iconic']} value={patternTier} /><FilterInput label="Pattern ID" max="1000" min="0" onChange={(value) => { setPatternId(value); resetPage() }} placeholder="0–1000" type="number" value={patternId} /><FilterInput label="Seller" onChange={(value) => { setSeller(value); resetPage() }} placeholder="Username" value={seller} /><FilterInput label="Minimum price" min="0" onChange={(value) => { setMinPrice(value); resetPage() }} placeholder="No minimum" type="number" value={minPrice} /><FilterInput label="Maximum price" min="0" onChange={(value) => { setMaxPrice(value); resetPage() }} placeholder="No maximum" type="number" value={maxPrice} /><FilterInput label="Minimum float" max="1" min="0" onChange={(value) => { setMinFloat(value); resetPage() }} placeholder="0.00" step="0.000001" type="number" value={minFloat} /><FilterInput label="Maximum float" max="1" min="0" onChange={(value) => { setMaxFloat(value); resetPage() }} placeholder="1.00" step="0.000001" type="number" value={maxFloat} /><label className="border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-[10px] uppercase text-cs-muted">Sort listings</span><select aria-label="Sort listings" className="mt-1 w-full bg-cs-panel text-sm text-cs-text outline-none" onChange={(event) => { setSort(event.target.value as VirtualListingSort); resetPage() }} value={sort}><option value="lowest-price">Lowest price</option><option value="highest-price">Highest price</option><option value="lowest-float">Lowest float</option><option value="highest-float">Highest float</option><option value="newest">Newest listed</option><option value="valuable-pattern">Most valuable pattern</option></select></label></div><p className="mt-2 text-xs text-cs-muted">Only the visible page is generated. {result.scanned.toLocaleString()} deterministic candidates were inspected for this page; the full market is never allocated in memory.</p></div>
    {playerListings.length > 0 ? <div className="mt-3 border border-rarity-special/50 bg-rarity-special/10 p-3"><p className="font-semibold text-cs-text">Your listings in this skin market</p><div className="mt-2 space-y-2">{playerListings.map((listing) => <PlayerListingCard key={listing.id} listing={listing} onAccept={() => game.acceptPlayerMarketOffer(listing.id)} onCancel={() => game.cancelPlayerMarketListing(listing.id)} onDecline={() => game.declinePlayerMarketOffer(listing.id)} />)}</div></div> : null}
    <div className="mt-3 grid items-stretch gap-3 md:grid-cols-2 2xl:grid-cols-3">{result.listings.map((listing) => <ListingCard canAfford={state.money >= listing.askingPrice} key={listing.id} listing={listing} now={Math.max(state.marketplace.lastSupplyTick, state.lastSaved, listing.createdAt)} onBuy={() => game.buyMarketListing(listing.id, undefined, listing)} onNegotiate={() => setNegotiatingId(listing.id)} />)}{result.exactPatternUnavailable ? <EmptyState text={`No active listings for Pattern #${filters.patternId}. Rare pattern scarcity is stable for this market epoch.`} /> : result.listings.length === 0 ? <EmptyState text="No active listings match these filters. Try broadening the range." /> : null}</div>
    {result.filteredSupplyEstimate > 0 ? <Pagination label={`${result.filteredSupplyEstimate.toLocaleString()} estimated matching offers`} onPage={setPage} page={Math.min(page, pageCount - 1)} pageCount={pageCount} /> : null}
    {negotiationListing ? <NegotiationModal listing={negotiationListing} onBuy={(price) => { game.buyMarketListing(negotiationListing.id, price, negotiationListing); setNegotiatingId(undefined) }} onClose={() => setNegotiatingId(undefined)} onOffer={(offer) => game.negotiateMarketListing(negotiationListing.id, offer, negotiationListing)} /> : null}
  </div>
}

function PlayerSellingPanel({ askingPrice, selectedItemId, setAskingPrice, setSelectedItemId }: { askingPrice: string; selectedItemId: string; setAskingPrice: (value: string) => void; setSelectedItemId: (value: string) => void }) {
  const game = useGame()
  const { state } = game
  const selectedItem = state.inventory.find((item) => item.instanceId === selectedItemId)
  const selectedFairValue = selectedItem ? getCurrentItemMarketValue(selectedItem, state.marketValues) : 0
  const numericAsk = Number(askingPrice)
  const draftAttractiveness = selectedItem && numericAsk > 0 ? getPlayerListingAttractiveness({ item: selectedItem, askingPrice: numericAsk, fairMarketValue: selectedFairValue }) : undefined
  return <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]"><section className="border border-cs-border bg-cs-surface p-4"><h4 className="flex items-center gap-2 text-lg font-semibold text-cs-text"><Tags size={18} className="text-rarity-special" /> List an owned skin</h4><label className="mt-4 block text-sm text-cs-muted">Inventory item<select className="mt-2 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text" onChange={(event) => { setSelectedItemId(event.target.value); const item = state.inventory.find((candidate) => candidate.instanceId === event.target.value); setAskingPrice(item ? getCurrentItemMarketValue(item, state.marketValues).toFixed(2) : '') }} value={selectedItemId}><option value="">Choose an unlocked item</option>{state.inventory.filter((item) => !item.isLocked).sort((a, b) => getCurrentItemMarketValue(b, state.marketValues) - getCurrentItemMarketValue(a, state.marketValues)).map((item) => <option key={item.instanceId} value={item.instanceId}>{item.weapon} | {item.finish} · {getWearLabel(item.wear)} · {formatCurrency(getCurrentItemMarketValue(item, state.marketValues))}</option>)}</select></label><label className="mt-3 block text-sm text-cs-muted">Your asking price<input className="mt-2 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text" min="0.01" onChange={(event) => setAskingPrice(event.target.value)} step="0.01" type="number" value={askingPrice} /></label>{selectedItem ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><Metric label="Market value" value={formatCurrency(selectedFairValue)} /><Metric label="Difference" value={`${numericAsk >= selectedFairValue ? '+' : ''}${formatCurrency((numericAsk || 0) - selectedFairValue)} (${selectedFairValue > 0 ? (((numericAsk || 0) / selectedFairValue - 1) * 100).toFixed(1) : '0'}%)`} /><div className="sm:col-span-2"><Metric label="Expected interest" value={draftAttractiveness?.label ?? 'Enter a price'} /></div></div> : null}<p className="mt-3 text-xs leading-relaxed text-cs-muted">The item moves into marketplace escrow and appears in its dedicated skin market. Refreshing or relaunching cannot remove it.</p><button className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 py-3 font-semibold text-rarity-special disabled:cursor-not-allowed disabled:opacity-40" disabled={!selectedItem || !Number.isFinite(numericAsk) || numericAsk <= 0} onClick={() => { if (!selectedItem) return; game.listItemOnMarket(selectedItem.instanceId, numericAsk); setSelectedItemId(''); setAskingPrice('') }} type="button"><ListPlus size={17} /> Create Listing</button></section><section className="space-y-3">{state.marketplace.playerListings.map((listing) => <PlayerListingCard key={listing.id} listing={listing} onAccept={() => game.acceptPlayerMarketOffer(listing.id)} onCancel={() => game.cancelPlayerMarketListing(listing.id)} onDecline={() => game.declinePlayerMarketOffer(listing.id)} />)}{state.marketplace.playerListings.length === 0 ? <EmptyState text="You have no active marketplace listings." /> : null}</section></div>
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
  return <article className="flex h-full min-w-0 flex-col border bg-cs-surface p-3" style={{ borderColor: getSkinRarityColor(listing.item) }}><div className="flex items-center gap-3"><AssetImage alt="" className="h-20 w-24 shrink-0 object-contain" loading="lazy" src={listing.item.image} /><div className="min-w-0"><h4 className="truncate font-semibold text-cs-text">{listing.item.weapon} | {listing.item.finish}</h4><p className="mt-1 text-xs text-cs-muted">{getWearLabel(listing.item.wear)} · {listing.item.floatValue.toFixed(6)}</p><p className="mt-1 text-xs text-cs-muted">Pattern #{listing.item.paintSeed ?? 0}{listing.item.statTrak ? ' · StatTrak™' : listing.item.souvenir ? ' · Souvenir' : ''}</p></div></div><div className="mt-2 min-h-7"><PatternBadge compact item={listing.item} /></div><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Seller price" value={formatCurrency(listing.askingPrice)} /><Metric label="Market value" value={formatCurrency(listing.fairMarketValue)} /></div><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className={difference <= 0 ? 'text-cs-green' : 'text-cs-muted'}>{difference >= 0 ? '+' : ''}{difference.toFixed(1)}% vs market</span><span className="inline-flex items-center gap-1 text-cs-muted"><Clock size={12} /> {ageLabel}</span></div><div className="mt-3 flex items-center gap-2 border-t border-cs-border pt-3"><NpcAvatar listing={listing} /><span className="min-w-0 flex-1 truncate text-sm text-cs-text">{listing.seller.username}</span><span className="text-xs text-cs-muted">{reputation.toFixed(1)}% rep</span></div><div className="mt-auto grid grid-cols-2 gap-2 pt-3"><button className="inline-flex min-h-10 items-center justify-center gap-1 border border-cs-border px-2 text-sm text-cs-muted hover:text-cs-text" onClick={onNegotiate} type="button"><MessageCircle size={15} /> Negotiate</button><button className="inline-flex min-h-10 items-center justify-center gap-1 border border-cs-green bg-cs-green/10 px-2 text-sm font-semibold text-cs-green disabled:opacity-40" disabled={!canAfford} onClick={onBuy} type="button"><ShoppingCart size={15} /> Buy</button></div></article>
}

function PlayerListingCard({ listing, onAccept, onCancel, onDecline }: { listing: PlayerMarketListing; onAccept: () => void; onCancel: () => void; onDecline: () => void }) {
  const attractiveness = getPlayerListingAttractiveness(listing)
  return <article className="border border-cs-border bg-cs-surface p-3"><div className="flex gap-3"><AssetImage alt="" className="h-16 w-20 object-contain" src={listing.item.image} /><div className="min-w-0 flex-1"><h4 className="truncate font-semibold text-cs-text">{listing.item.weapon} | {listing.item.finish}</h4><p className="mt-1 text-sm text-cs-muted">Ask {formatCurrency(listing.askingPrice)} · Market {formatCurrency(listing.fairMarketValue)}</p><p className="mt-1 text-xs text-rarity-special">{attractiveness.label}</p></div><button aria-label="Cancel listing" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={onCancel} type="button"><X size={15} /></button></div>{listing.incomingOffer ? <div className="mt-3 flex flex-col gap-2 border border-rarity-special/60 bg-rarity-special/10 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-cs-text">{listing.incomingOffer.buyer.username} offered {formatCurrency(listing.incomingOffer.amount)}</p><p className="text-xs text-cs-muted">{((listing.incomingOffer.amount / listing.fairMarketValue - 1) * 100).toFixed(1)}% vs market</p></div><button className="border border-cs-border px-3 py-2 text-sm text-cs-muted" onClick={onDecline} type="button">Decline</button><button className="border border-cs-green bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green" onClick={onAccept} type="button">Accept</button></div> : null}</article>
}

function NegotiationModal({ listing, onBuy, onClose, onOffer }: { listing: NpcMarketListing; onBuy: (price: number) => void; onClose: () => void; onOffer: (offer: number) => void }) {
  const [offer, setOffer] = useState(() => (listing.negotiation?.currentCounterOffer ?? listing.askingPrice * .92).toFixed(2))
  const negotiation = listing.negotiation
  const acceptedPrice = negotiation?.status === 'accepted' ? negotiation.currentCounterOffer : undefined
  return <div aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/80 p-3" role="dialog"><section className="my-auto w-full max-w-xl border border-rarity-special bg-cs-surface p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs uppercase text-rarity-special">Negotiation</p><h3 className="mt-1 text-xl font-semibold text-cs-text">{listing.seller.username}</h3><p className="text-sm text-cs-muted">{listing.item.weapon} | {listing.item.finish} · asking {formatCurrency(listing.askingPrice)}</p></div><button aria-label="Close negotiation" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={onClose} type="button"><X size={16} /></button></div><div className="mt-4 max-h-72 space-y-2 overflow-y-auto border border-cs-border bg-cs-panel p-3">{negotiation?.messages.length ? negotiation.messages.map((message) => <div className={`max-w-[86%] border px-3 py-2 text-sm ${message.author === 'player' ? 'ml-auto border-rarity-special/50 bg-rarity-special/10 text-cs-text' : 'border-cs-border bg-cs-surface text-cs-text'}`} key={message.id}>{message.text}</div>) : <p className="text-sm text-cs-muted">Make an offer. This seller has a persistent floor and remembers earlier offers.</p>}</div>{negotiation?.status === 'walked-away' ? <p className="mt-3 border border-rarity-covert/50 bg-rarity-covert/10 p-3 text-sm text-rarity-covert">The seller ended this negotiation.</p> : acceptedPrice !== undefined ? <button className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-cs-green bg-cs-green/10 px-4 py-3 font-semibold text-cs-green" onClick={() => onBuy(acceptedPrice)} type="button"><HandCoins size={17} /> Buy for {formatCurrency(acceptedPrice)}</button> : <div className="mt-3 flex gap-2"><input aria-label="Offer amount" className="min-w-0 flex-1 border border-cs-border bg-cs-panel px-3 py-2 text-cs-text" min="0.01" onChange={(event) => setOffer(event.target.value)} step="0.01" type="number" value={offer} /><button className="border border-rarity-special bg-rarity-special/10 px-4 py-2 font-semibold text-rarity-special" onClick={() => onOffer(Number(offer))} type="button">Send offer</button></div>}<p className="mt-3 text-xs text-cs-muted">Round {negotiation?.round ?? 0} · patience remaining {negotiation?.patienceRemaining ?? listing.seller.patience}. Rare and high-value sellers generally maintain stronger floors.</p></section></div>
}

function Pagination({ label, onPage, page, pageCount }: { label: string; onPage: (page: number) => void; page: number; pageCount: number }) { return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-cs-border bg-cs-surface px-3 py-2"><p className="text-xs text-cs-muted">Page {(page + 1).toLocaleString()} of {pageCount.toLocaleString()} · {label}</p><div className="flex gap-2"><button className="min-h-10 border border-cs-border px-4 text-sm text-cs-text disabled:cursor-not-allowed disabled:opacity-40" disabled={page === 0} onClick={() => onPage(Math.max(0, page - 1))} type="button">Previous</button><button className="min-h-10 border border-cs-border px-4 text-sm text-cs-text disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => onPage(Math.min(pageCount - 1, page + 1))} type="button">Next</button></div></div> }
function NpcAvatar({ listing }: { listing: NpcMarketListing }) { return <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 text-xs font-bold text-white" style={{ backgroundColor: `hsl(${listing.seller.avatarHue} 55% 38%)` }}>{listing.seller.username.slice(0, 2).toUpperCase()}</span> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border border-cs-border bg-cs-panel px-2 py-1.5"><p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p><p className="mt-1 break-words text-sm font-semibold text-cs-text">{value}</p></div> }
function EmptyState({ text }: { text: string }) { return <div className="col-span-full grid min-h-32 place-items-center border border-dashed border-cs-border bg-cs-surface p-6 text-center text-sm text-cs-muted">{text}</div> }
function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) { return <button className={`inline-flex min-h-10 items-center justify-center gap-1 px-2 text-xs font-semibold ${active ? 'bg-rarity-special/15 text-rarity-special' : 'text-cs-muted hover:text-cs-text'}`} onClick={onClick} type="button">{icon}<span className="truncate">{label}</span></button> }
function CatalogSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) { return <label className="border border-cs-border bg-cs-surface px-3 py-2"><span className="sr-only">Filter by {label}</span><select className="w-full bg-cs-surface text-sm text-cs-text outline-none" onChange={(event) => onChange(event.target.value)} value={value}><option value="all">All {label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> }
function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) { return <label className="border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-[10px] uppercase text-cs-muted">{label}</span><select className="mt-1 w-full bg-cs-panel text-sm text-cs-text outline-none" onChange={(event) => onChange(event.target.value)} value={value}><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> }
function FilterInput({ label, onChange, value, ...props }: { label: string; onChange: (value: string) => void; value: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) { return <label className="border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-[10px] uppercase text-cs-muted">{label}</span><input {...props} className="mt-1 w-full bg-transparent text-sm text-cs-text outline-none" onChange={(event) => onChange(event.target.value)} value={value} /></label> }
function parseOptionalNumber(value: string) { if (!value.trim()) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined }
