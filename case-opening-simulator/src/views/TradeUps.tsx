import {
  AlertOctagon, AlertTriangle, ArrowRight, BadgeDollarSign, Check, ChevronDown, ClipboardCheck,
  Dices, Eye, Filter, Gauge, Layers3, Lock, PackagePlus, PackageSearch, RotateCcw, Search,
  ShieldAlert, SlidersHorizontal, Sparkles, Stamp, Trash2, TrendingDown, TrendingUp, X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { AcquisitionReveal } from '../components/AcquisitionReveal'
import { AssetImage } from '../components/AssetImage'
import { ItemEditionBadge } from '../components/ItemEditionBadge'
import { PatternBadge } from '../components/PatternInfo'
import { CASE_DEFINITIONS } from '../data/cases'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { useGame } from '../hooks/useGame'
import { useSessionStorageState } from '../hooks/useSessionStorageState'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getRarityLabel, getWearLabel } from '../utils/itemLabels'
import { getItemEdition, getItemEditionLabel, type ItemEdition } from '../utils/itemEdition'
import {
  analyzeTradeUp, getNextTradeUpRarity, getTradeUpCompatibilityReason, getTradeUpInputCount,
  isTradeUpEligibleItem, tradeUpRarityOrder, type TradeUpOutcome,
} from '../utils/tradeUp'
import { selectTradeUpQuickFill, type TradeUpQuickFillMode } from '../utils/tradeUpQuickFill'

type SortMode = 'float-asc' | 'float-desc' | 'name' | 'price-asc' | 'price-desc'
type EditionFilter = 'all' | ItemEdition

const tradeableRarities = tradeUpRarityOrder.filter((rarity) => getNextTradeUpRarity(rarity))
const descendingRarities = [...tradeableRarities].reverse()
const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))
const casesById = new Map(CASE_DEFINITIONS.map((caseDef) => [caseDef.id, caseDef]))

function imageFor(item: Pick<SkinInstance, 'id' | 'image'>) {
  return item.image && item.image !== '/assets/placeholder.png' ? item.image : skinsById.get(item.id)?.image ?? '/assets/placeholder.png'
}

function collectionLabel(item: SkinInstance) {
  const skin = skinsById.get(item.id)
  return skin?.collections?.[0] ?? item.caseIds.map((id) => casesById.get(id)?.name).find(Boolean) ?? 'Unknown collection'
}

function formatProbability(value: number) {
  if (value >= 10) return `${value.toFixed(1)}%`
  if (value >= 1) return `${value.toFixed(2)}%`
  return `${value.toFixed(3)}%`
}

function Metric({ label, value, tone = 'text-cs-text' }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0 border-l-2 border-cs-border bg-cs-surface/70 px-2.5 py-2"><p className="font-mono text-[9px] uppercase tracking-wide text-cs-muted">{label}</p><p className={`mt-0.5 break-words text-sm font-semibold tabular-nums ${tone}`}>{value}</p></div>
}

function ContractSlot({ index, item, onRemove }: { index: number; item?: SkinInstance; onRemove: (id: string) => void }) {
  const color = item ? getSkinRarityColor(item) : undefined
  return <div className={`trade-up-slot relative min-h-28 overflow-hidden border bg-cs-surface/85 p-2 sm:min-h-36 ${item ? 'trade-up-slot-filled' : 'border-dashed border-cs-border'}`} data-testid={item ? 'filled-contract-slot' : 'empty-contract-slot'} style={item ? { borderColor: color, boxShadow: `inset 0 -3px 0 ${color}55` } : undefined}>
    <span className="absolute left-2 top-2 z-10 font-mono text-[9px] uppercase tracking-[.18em] text-cs-muted">Input {String(index + 1).padStart(2, '0')}</span>
    {item ? <>
      <button aria-label={`Remove ${item.weapon} ${item.finish}`} className="absolute right-1.5 top-1.5 z-20 grid h-8 w-8 place-items-center border border-cs-border bg-cs-panel/95 text-cs-muted hover:border-rarity-covert hover:text-rarity-covert" onClick={() => onRemove(item.instanceId)} type="button"><Trash2 size={14} /></button>
      <AssetImage alt="" className="mx-auto mt-5 h-14 w-full object-contain drop-shadow-lg sm:h-20" src={imageFor(item)} />
      <div className="mt-1 flex min-h-6 flex-wrap items-center gap-1"><ItemEditionBadge compact item={item} /></div>
      <p className="mt-1 truncate text-xs font-semibold text-cs-text">{item.weapon} | {item.finish}</p>
      <div className="mt-1.5 flex justify-between gap-2 font-mono text-[9px] uppercase text-cs-muted"><span>{getWearLabel(item.wear)} · {item.floatValue.toFixed(4)}</span><span className="text-cs-green">{formatCurrency(item.marketValue)}</span></div>
    </> : <div className="grid h-full min-h-24 place-items-center text-center sm:min-h-32"><div><PackageSearch className="mx-auto text-cs-border" size={28} /><p className="mt-2 font-mono text-[9px] uppercase tracking-[.18em] text-cs-muted">Awaiting skin</p></div></div>}
  </div>
}

function InventoryChoice({ incompatibility, item, selected, value, onToggle }: { incompatibility?: string; item: SkinInstance; selected: boolean; value: number; onToggle: () => void }) {
  const color = getSkinRarityColor(item)
  return <button aria-pressed={selected} className={`group relative grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-2.5 border bg-cs-surface p-2 text-left transition-all ${selected ? 'ring-2 ring-rarity-special' : incompatibility ? 'opacity-65 hover:opacity-90' : 'hover:-translate-y-0.5 hover:bg-cs-panelMuted'}`} data-testid="trade-up-inventory-item" onClick={onToggle} style={{ borderColor: color }} title={incompatibility} type="button">
    <span className="grid h-20 w-20 place-items-center border border-cs-border bg-cs-panel"><AssetImage alt="" className="h-16 w-[4.5rem] object-contain transition-transform group-hover:scale-105" src={imageFor(item)} /></span>
    <span className="min-w-0 pr-5"><span className="flex min-h-5 flex-wrap gap-1"><ItemEditionBadge compact item={item} showRegular /></span><span className="mt-1 block truncate text-xs font-semibold text-cs-text">{item.weapon} | {item.finish}</span><span className="mt-1 block truncate font-mono text-[9px] uppercase text-cs-muted">{getWearLabel(item.wear)} · {item.floatValue.toFixed(5)}</span><span className="mt-1 block truncate text-[10px] text-cs-muted">{collectionLabel(item)}</span><span className="mt-1 block text-xs font-semibold text-cs-green">{formatCurrency(value)}</span>{incompatibility ? <span className="mt-1 block text-[10px] leading-4 text-cs-amber">{incompatibility}</span> : null}</span>
    <span className="absolute right-1.5 top-1.5">{selected ? <Check className="text-rarity-special" size={15} /> : incompatibility ? <Lock className="text-cs-amber" size={14} /> : <PackagePlus className="text-cs-muted group-hover:text-rarity-special" size={15} />}</span>
  </button>
}

function OutcomeCard({ outcome, onInspect }: { outcome: TradeUpOutcome; onInspect: () => void }) {
  const color = getSkinRarityColor(outcome.skin)
  return <button className="group relative min-w-0 overflow-hidden border bg-cs-surface p-2.5 text-left hover:bg-cs-panelMuted" onClick={onInspect} style={{ borderColor: color }} type="button">
    <div className="flex items-start justify-between gap-2"><span className="font-mono text-[10px] font-semibold text-rarity-special">{formatProbability(outcome.probability)}</span><Eye className="text-cs-muted group-hover:text-cs-text" size={14} /></div>
    <AssetImage alt="" className="mx-auto h-20 w-full object-contain transition-transform group-hover:scale-105" src={outcome.skin.image} />
    <div className="mt-1 flex min-h-5 flex-wrap gap-1">{outcome.isStatTrak ? <ItemEditionBadge compact item={{ statTrak: true, souvenir: false }} /> : null}</div>
    <p className="truncate text-xs font-semibold text-cs-text">{outcome.skin.weapon} | {outcome.skin.finish}</p>
    <p className="mt-1 truncate font-mono text-[9px] uppercase text-cs-muted">{getWearLabel(outcome.predictedWear)} · {outcome.predictedFloat.toFixed(6)}</p>
    <p className="mt-1 text-sm font-semibold text-cs-green">{outcome.hasValuation ? formatCurrency(outcome.value) : 'Value unavailable'}</p>
    <p className="mt-0.5 text-[9px] uppercase text-cs-muted">{outcome.valuationConfidence === 'market' ? 'Market-priced estimate' : outcome.valuationConfidence === 'estimated' ? 'Catalog estimate' : 'No reliable valuation'}</p>
    <div className="mt-2 h-1 bg-cs-panel"><div className="h-full bg-rarity-restricted" style={{ width: `${Math.min(100, outcome.probability)}%` }} /></div>
  </button>
}

export function TradeUps() {
  const { claimAcquisition, state, tradeUpItems } = useGame()
  const [rarity, setRarity] = useSessionStorageState<Rarity | 'all'>('trade-ups:rarity-v2', 'all')
  const [selectedIds, setSelectedIds] = useSessionStorageState<string[]>('trade-ups:selected', [])
  const [search, setSearch] = useSessionStorageState('trade-ups:search', '')
  const [wear, setWear] = useSessionStorageState<'all' | WearCondition>('trade-ups:wear', 'all')
  const [collection, setCollection] = useSessionStorageState('trade-ups:collection', 'all')
  const [edition, setEdition] = useSessionStorageState<EditionFilter>('trade-ups:edition', 'all')
  const [sort, setSort] = useSessionStorageState<SortMode>('trade-ups:sort', 'price-desc')
  const [minimumFloat, setMinimumFloat] = useSessionStorageState('trade-ups:min-float', '')
  const [maximumFloat, setMaximumFloat] = useSessionStorageState('trade-ups:max-float', '')
  const [minimumPrice, setMinimumPrice] = useSessionStorageState('trade-ups:min-price', '')
  const [maximumPrice, setMaximumPrice] = useSessionStorageState('trade-ups:max-price', '')
  const [showIneligible, setShowIneligible] = useSessionStorageState('trade-ups:show-ineligible', false)
  const [compatibleOnly, setCompatibleOnly] = useSessionStorageState('trade-ups:compatible-only', true)
  const [reviewing, setReviewing] = useState(false)
  const [riskAccepted, setRiskAccepted] = useState(false)
  const [selectionNotice, setSelectionNotice] = useState<string>()
  const [inspectedOutcome, setInspectedOutcome] = useState<TradeUpOutcome>()
  const [outcomeLimit, setOutcomeLimit] = useState(12)

  const inventoryById = useMemo(() => new Map(state.inventory.map((item) => [item.instanceId, item])), [state.inventory])
  const selected = useMemo(() => selectedIds.flatMap((id) => inventoryById.get(id) ?? []), [selectedIds, inventoryById])
  const analysis = useMemo(() => analyzeTradeUp({ inputItems: selected, marketValues: state.marketValues }), [selected, state.marketValues])
  const activeRarity = selected[0]?.rarity ?? (rarity === 'all' ? undefined : rarity)
  const capacity = getTradeUpInputCount(activeRarity)
  const collections = useMemo(() => Array.from(new Set(state.inventory.filter((item) => !activeRarity || item.rarity === activeRarity).map(collectionLabel))).sort(), [activeRarity, state.inventory])
  const visibleItems = useMemo(() => state.inventory.filter((item) => {
    if (activeRarity && item.rarity !== activeRarity) return false
    const protectionReason = isTradeUpEligibleItem(item) ? undefined : getTradeUpCompatibilityReason(item, [])
    const compatibilityReason = getTradeUpCompatibilityReason(item, selected)
    if (!showIneligible && protectionReason) return false
    if (compatibleOnly && compatibilityReason) return false
    if (edition !== 'all' && getItemEdition(item) !== edition) return false
    const query = search.trim().toLowerCase()
    if (query && !`${item.weapon} ${item.finish} ${collectionLabel(item)} ${item.paintSeed ?? ''}`.toLowerCase().includes(query)) return false
    if (wear !== 'all' && item.wear !== wear) return false
    if (collection !== 'all' && collectionLabel(item) !== collection) return false
    const value = getCurrentItemMarketValue(item, state.marketValues)
    if (minimumFloat && item.floatValue < Number(minimumFloat)) return false
    if (maximumFloat && item.floatValue > Number(maximumFloat)) return false
    if (minimumPrice && value < Number(minimumPrice)) return false
    if (maximumPrice && value > Number(maximumPrice)) return false
    return true
  }).sort((a, b) => {
    if (a.rarity !== b.rarity) return descendingRarities.indexOf(a.rarity) - descendingRarities.indexOf(b.rarity)
    const leftValue = getCurrentItemMarketValue(a, state.marketValues)
    const rightValue = getCurrentItemMarketValue(b, state.marketValues)
    if (sort === 'price-desc') return rightValue - leftValue
    if (sort === 'float-asc') return a.floatValue - b.floatValue
    if (sort === 'float-desc') return b.floatValue - a.floatValue
    if (sort === 'name') return `${a.weapon} ${a.finish}`.localeCompare(`${b.weapon} ${b.finish}`)
    return leftValue - rightValue
  }), [activeRarity, collection, compatibleOnly, edition, maximumFloat, maximumPrice, minimumFloat, minimumPrice, search, selected, showIneligible, sort, state.inventory, state.marketValues, wear])
  const visibleGroups = useMemo(() => descendingRarities.map((groupRarity) => ({ rarity: groupRarity, items: visibleItems.filter((item) => item.rarity === groupRarity) })).filter((group) => group.items.length > 0), [visibleItems])

  const knownOutcomes = analysis.outcomes.filter((outcome) => outcome.hasValuation)
  const worst = knownOutcomes.length ? Math.min(...knownOutcomes.map((outcome) => outcome.value)) : undefined
  const best = knownOutcomes.length ? Math.max(...knownOutcomes.map((outcome) => outcome.value)) : undefined
  const roi = analysis.hasCompleteValuation && analysis.inputValue > 0 ? analysis.expectedProfit / analysis.inputValue * 100 : undefined
  const negativeReturn = analysis.hasCompleteValuation && analysis.expectedProfit < 0
  const highRisk = roi !== undefined && roi <= -50
  const contractEdition = analysis.editionGroup === 'stattrak' ? 'StatTrak™' : analysis.editionGroup === 'standard' ? 'Standard (regular + Souvenir)' : analysis.editionGroup === 'mixed' ? 'Mixed — invalid' : 'Choose first input'
  const latestTradeUp = state.ui.tradeUpHistory.find((entry) => entry.outputItem.instanceId === state.marketplace.pendingAcquisition?.item.instanceId)

  function resetReview() { setReviewing(false); setRiskAccepted(false) }
  function toggle(item: SkinInstance) {
    if (selectedIds.includes(item.instanceId)) {
      setSelectedIds((current) => current.filter((id) => id !== item.instanceId)); setSelectionNotice(undefined); resetReview(); return
    }
    const reason = getTradeUpCompatibilityReason(item, selected)
    if (reason) { setSelectionNotice(`${getItemEditionLabel(item)} ${item.weapon} | ${item.finish}: ${reason}`); return }
    if (selectedIds.length >= capacity) { setSelectionNotice(`This ${activeRarity === Rarity.Covert ? 'five-Covert' : 'standard'} contract already has all ${capacity} inputs.`); return }
    setSelectedIds((current) => [...current, item.instanceId]); setSelectionNotice(undefined); resetReview()
  }
  function changeRarity(next: Rarity | 'all') { setRarity(next); setSelectedIds([]); resetReview(); setCollection('all'); setSelectionNotice(selected.length ? 'Previous inputs were cleared because the contract type changed.' : undefined) }
  function clearContract() { setSelectedIds([]); resetReview(); setSelectionNotice(undefined) }
  function quickFill(mode: TradeUpQuickFillMode) {
    // Before the first pick, use the highest rarity with a complete edition pool.
    const counts = new Map<string, number>()
    for (const item of visibleItems) {
      const key = `${item.rarity}:${Boolean(item.statTrak)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const firstComplete = visibleItems.find((candidate) => (counts.get(`${candidate.rarity}:${Boolean(candidate.statTrak)}`) ?? 0) >= getTradeUpInputCount(candidate.rarity))
    const pool = selected.length || activeRarity ? visibleItems : firstComplete ? visibleItems.filter((item) => item.rarity === firstComplete.rarity) : []
    const result = selectTradeUpQuickFill({
      candidates: pool,
      capacity: selected[0] ? capacity : activeRarity ? capacity : getTradeUpInputCount(pool[0]?.rarity),
      marketValues: state.marketValues,
      mode,
      selectedItems: selected,
    })
    setSelectedIds(result.itemIds)
    const label = mode === 'random' ? `Random ${capacity}` : mode === 'cheapest' ? 'Cheapest' : mode === 'lowest-float' ? 'Lowest Float' : 'Fill Remaining'
    setSelectionNotice(result.message ?? `${label} added ${result.addedIds.length} compatible item${result.addedIds.length === 1 ? '' : 's'} from the filtered pool.`)
    resetReview()
  }
  function execute() {
    if (!analysis.canTradeUp || !reviewing || (highRisk && !riskAccepted)) return
    tradeUpItems([...selectedIds]); setSelectedIds([]); resetReview()
  }

  return <section className="trade-up-workbench w-full min-w-0 border border-cs-border bg-cs-surface p-3 sm:p-4" data-testid="trade-up-workbench">
    <header className="flex flex-col gap-3 border-l-4 border-rarity-restricted pl-3 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="font-mono text-[10px] uppercase tracking-[.22em] text-rarity-restricted">Tactical contract desk</p><h1 className="mt-0.5 text-2xl font-semibold text-cs-text">Trade-Up Workbench</h1><p className="mt-1 max-w-3xl text-sm text-cs-muted">Commit eligible skins, inspect the honest odds, and accept the result. Profitability informs your choice—it never decides for you.</p></div>
      <div className="flex max-w-4xl flex-wrap gap-1.5"><button aria-pressed={rarity === 'all'} className={`min-h-9 border px-2.5 font-mono text-[9px] uppercase ${rarity === 'all' ? 'border-rarity-restricted bg-rarity-restricted/10 text-rarity-restricted' : 'border-cs-border text-cs-muted'}`} onClick={() => changeRarity('all')} type="button">All rarities</button>{descendingRarities.map((entry) => <button aria-pressed={rarity === entry} className={`min-h-9 border px-2.5 font-mono text-[9px] uppercase ${rarity === entry ? 'border-rarity-restricted bg-rarity-restricted/10 text-rarity-restricted' : 'border-cs-border text-cs-muted'}`} key={entry} onClick={() => changeRarity(entry)} type="button">{getRarityLabel(entry)} · {state.inventory.filter((item) => item.rarity === entry && isTradeUpEligibleItem(item)).length}</button>)}</div>
    </header>

    <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-[minmax(20rem,.68fr)_minmax(0,1.32fr)] xl:items-start" data-testid="trade-up-left-right-workspace">
      <main className="min-w-0 space-y-3 xl:contents">
        <section className="trade-up-contract-paper relative overflow-hidden border border-rarity-restricted/60 p-3 sm:p-4 xl:col-start-2 xl:row-start-1" data-testid="trade-up-contract-panel">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:100%_1.75rem]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex items-center gap-2"><Stamp className="text-rarity-restricted" size={20} /><div><p className="font-mono text-[9px] uppercase tracking-[.2em] text-rarity-restricted">Official exchange contract</p><h2 className="text-lg font-semibold text-cs-text">{activeRarity ? `${getRarityLabel(activeRarity)} → ${getRarityLabel(getNextTradeUpRarity(activeRarity)!)}` : 'Choose any eligible skin'}</h2></div></div><p className="mt-1.5 text-xs text-cs-muted">Edition group: <strong className={analysis.editionGroup === 'mixed' ? 'text-rarity-covert' : 'text-cs-text'}>{contractEdition}</strong></p></div>
            <div className="flex flex-wrap items-center justify-end gap-2"><span className="border border-cs-border bg-cs-surface/70 px-2.5 py-1.5 font-mono text-xs text-cs-text">{selected.length}/{capacity} signed</span><button className="inline-flex min-h-9 items-center gap-1.5 border border-cs-border px-2.5 text-xs text-cs-muted disabled:opacity-40" disabled={!selected.length} onClick={clearContract} type="button"><RotateCcw size={13} /> Clear</button><button aria-label="Review contract from header" className="inline-flex min-h-9 items-center gap-1.5 border border-rarity-restricted/60 bg-rarity-restricted/10 px-2.5 text-xs font-semibold text-rarity-restricted disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted" disabled={!analysis.canTradeUp} onClick={() => { setReviewing(true); setRiskAccepted(false) }} type="button">Review <ArrowRight size={13} /></button></div>
          </div>
          <div className={`content-card-grid relative mt-3 grid gap-2 ${capacity === 5 ? 'grid-cols-1 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-5'}`}>{Array.from({ length: capacity }, (_, index) => <ContractSlot index={index} item={selected[index]} key={index} onRemove={(id) => { setSelectedIds((current) => current.filter((entry) => entry !== id)); resetReview() }} />)}</div>
          <div className="relative mt-3 h-2 border border-cs-border bg-cs-surface"><div className="h-full bg-rarity-restricted transition-[width] duration-300" style={{ width: `${selected.length / capacity * 100}%` }} /></div>
          {selectionNotice ? <div className="relative mt-3 flex items-start justify-between gap-3 border border-cs-amber/60 bg-cs-amber/10 p-2.5 text-xs text-cs-amber" role="alert"><span>{selectionNotice}</span><button aria-label="Dismiss selection explanation" onClick={() => setSelectionNotice(undefined)} type="button"><X size={14} /></button></div> : null}
          {analysis.message && selected.length === capacity ? <div className="relative mt-3 flex items-start gap-2 border border-rarity-covert/60 bg-rarity-covert/10 p-2.5 text-xs text-rarity-covert" role="alert"><AlertOctagon className="mt-0.5 shrink-0" size={15} />{analysis.message}</div> : null}
        </section>

        <section className="border border-cs-border bg-cs-panel p-3 xl:sticky xl:top-2 xl:col-start-1 xl:row-span-2 xl:row-start-1" data-testid="trade-up-picker-panel">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Filter className="text-rarity-industrial" size={17} /><div><h2 className="font-semibold text-cs-text">Inventory source</h2><p className="text-[10px] text-cs-muted">Filters and selection stay here while the contract updates on the right.</p></div></div><button className="inline-flex min-h-9 items-center gap-1.5 border border-cs-border px-2.5 text-xs text-cs-muted hover:text-cs-text" onClick={() => setCompatibleOnly((value) => !value)} type="button"><Layers3 size={13} /> {compatibleOnly ? 'Compatible only' : 'All editions'}</button></div>
          <div className="mt-2 grid grid-cols-2 gap-1.5" aria-label="Trade-Up quick fill actions">
            <button className="inline-flex min-h-9 items-center justify-center gap-1.5 border border-rarity-special/60 px-2 text-xs font-semibold text-rarity-special disabled:opacity-40" data-testid="random-trade-up-fill" disabled={selected.length >= capacity} onClick={() => quickFill('random')} type="button"><Dices size={14} /> Select Random {capacity}</button>
            <button className="inline-flex min-h-9 items-center justify-center gap-1.5 border border-cs-green/60 px-2 text-xs font-semibold text-cs-green disabled:opacity-40" data-testid="cheapest-trade-up-fill" disabled={selected.length >= capacity} onClick={() => quickFill('cheapest')} type="button"><BadgeDollarSign size={14} /> Fill Cheapest</button>
            <button className="inline-flex min-h-9 items-center justify-center gap-1.5 border border-rarity-industrial/60 px-2 text-xs font-semibold text-rarity-industrial disabled:opacity-40" data-testid="lowest-float-trade-up-fill" disabled={selected.length >= capacity} onClick={() => quickFill('lowest-float')} type="button"><Gauge size={14} /> Fill Lowest Float</button>
            <button className="inline-flex min-h-9 items-center justify-center gap-1.5 border border-cs-border px-2 text-xs font-semibold text-cs-text disabled:opacity-40" data-testid="remaining-trade-up-fill" disabled={selected.length >= capacity} onClick={() => quickFill('remaining')} type="button"><PackagePlus size={14} /> Fill Remaining</button>
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="relative sm:col-span-2"><span className="sr-only">Search inventory</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-muted" size={15} /><input className="min-h-10 w-full border border-cs-border bg-cs-surface pl-9 pr-3 text-sm text-cs-text" onChange={(event) => setSearch(event.target.value)} placeholder="Skin, weapon, collection or Pattern" value={search} /></label>
            <select aria-label="Edition filter" className="min-h-10 border border-cs-border bg-cs-surface px-2 text-xs text-cs-text" onChange={(event) => setEdition(event.target.value as EditionFilter)} value={edition}><option value="all">All editions</option><option value="regular">Regular</option><option value="stattrak">StatTrak™</option><option value="souvenir">Souvenir</option></select>
            <select aria-label="Sort inventory" className="min-h-10 border border-cs-border bg-cs-surface px-2 text-xs text-cs-text" onChange={(event) => setSort(event.target.value as SortMode)} value={sort}><option value="price-asc">Lowest price</option><option value="price-desc">Highest price</option><option value="float-asc">Lowest float</option><option value="float-desc">Highest float</option><option value="name">Name</option></select>
            <select aria-label="Wear filter" className="min-h-10 border border-cs-border bg-cs-surface px-2 text-xs text-cs-text" onChange={(event) => setWear(event.target.value as 'all' | WearCondition)} value={wear}><option value="all">All wears</option>{Object.values(WearCondition).map((entry) => <option key={entry} value={entry}>{getWearLabel(entry)}</option>)}</select>
            <select aria-label="Collection filter" className="min-h-10 border border-cs-border bg-cs-surface px-2 text-xs text-cs-text" onChange={(event) => setCollection(event.target.value)} value={collection}><option value="all">All collections</option>{collections.map((entry) => <option key={entry}>{entry}</option>)}</select>
            <label className="flex min-h-10 items-center gap-2 border border-cs-border bg-cs-surface px-2 text-xs text-cs-muted"><input checked={showIneligible} onChange={(event) => setShowIneligible(event.target.checked)} type="checkbox" /> Protected/ineligible</label>
          </div>
          <details className="mt-2 border border-cs-border bg-cs-surface p-2"><summary className="flex cursor-pointer items-center gap-2 text-xs text-cs-muted"><SlidersHorizontal size={14} /> Float and price ranges <ChevronDown size={13} /></summary><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><input aria-label="Minimum float" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" max="1" min="0" onChange={(event) => setMinimumFloat(event.target.value)} placeholder="Min float" step="0.001" type="number" value={minimumFloat} /><input aria-label="Maximum float" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" max="1" min="0" onChange={(event) => setMaximumFloat(event.target.value)} placeholder="Max float" step="0.001" type="number" value={maximumFloat} /><input aria-label="Minimum price" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" min="0" onChange={(event) => setMinimumPrice(event.target.value)} placeholder="Min price" type="number" value={minimumPrice} /><input aria-label="Maximum price" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" min="0" onChange={(event) => setMaximumPrice(event.target.value)} placeholder="Max price" type="number" value={maximumPrice} /></div></details>
          <div className="mt-3 max-h-[min(58dvh,38rem)] space-y-3 overflow-y-auto overscroll-contain pr-1">{visibleGroups.map((group) => <section data-testid="trade-up-rarity-group" key={group.rarity}><h3 className="mb-1.5 border-b border-cs-border pb-1 font-mono text-xs font-semibold uppercase text-cs-text">{getRarityLabel(group.rarity)} · {group.items.length}</h3><div className="grid gap-2 2xl:grid-cols-2">{group.items.map((item) => { const reason = getTradeUpCompatibilityReason(item, selected); return <InventoryChoice incompatibility={reason} item={item} key={item.instanceId} onToggle={() => toggle(item)} selected={selectedIds.includes(item.instanceId)} value={getCurrentItemMarketValue(item, state.marketValues)} /> })}</div></section>)}{visibleItems.length === 0 ? <p className="border border-cs-border bg-cs-surface p-6 text-center text-sm text-cs-muted">No items match these filters. Check your search and filters.</p> : null}</div>
        </section>
      </main>

      <aside className="grid min-w-0 gap-3 xl:col-start-2 xl:row-start-2 xl:grid-cols-[minmax(18rem,.8fr)_minmax(0,1.2fr)]" data-testid="trade-up-analysis-panel">
        <section className="border border-cs-border bg-cs-panel p-3"><div className="flex items-center gap-2"><ClipboardCheck className="text-rarity-restricted" size={18} /><h2 className="font-semibold text-cs-text">Contract analysis</h2></div><div className="mt-2.5 grid grid-cols-2 gap-1.5"><Metric label="Opportunity cost" value={formatCurrency(analysis.inputValue)} /><Metric label="Expected output" value={analysis.hasCompleteValuation ? formatCurrency(analysis.expectedValue) : analysis.outcomes.length ? 'Value unavailable' : 'Pending inputs'} /><Metric label="Expected P/L" value={analysis.hasCompleteValuation ? `${analysis.expectedProfit >= 0 ? '+' : ''}${formatCurrency(analysis.expectedProfit)}` : 'Value unavailable'} tone={analysis.hasCompleteValuation ? analysis.expectedProfit >= 0 ? 'text-cs-green' : 'text-rarity-covert' : 'text-cs-amber'} /><Metric label="Expected ROI" value={roi === undefined ? 'Value unavailable' : `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} tone={roi === undefined ? 'text-cs-amber' : roi >= 0 ? 'text-cs-green' : 'text-rarity-covert'} /><Metric label="Worst known" value={worst === undefined ? 'Value unavailable' : `${formatCurrency(worst)} (${formatCurrency(worst - analysis.inputValue)})`} tone="text-rarity-covert" /><Metric label="Best known" value={best === undefined ? 'Value unavailable' : `${formatCurrency(best)} (${best - analysis.inputValue >= 0 ? '+' : ''}${formatCurrency(best - analysis.inputValue)})`} tone="text-rarity-special" /></div>{negativeReturn ? <div className={`mt-2.5 flex items-start gap-2 border p-2.5 text-xs ${highRisk ? 'border-rarity-covert bg-rarity-covert/10 text-rarity-covert' : 'border-cs-amber bg-cs-amber/10 text-cs-amber'}`} data-testid="negative-ev-warning"><AlertTriangle className="mt-0.5 shrink-0" size={15} /><span><strong>Expected loss: {formatCurrency(Math.abs(analysis.expectedProfit))}.</strong> This valid manual contract has a negative expected return. You may still execute it deliberately.</span></div> : null}{analysis.unvaluedOutcomeCount > 0 ? <div className="mt-2.5 border border-cs-amber/60 bg-cs-amber/10 p-2.5 text-xs text-cs-amber">{analysis.unvaluedOutcomeCount} outcome valuation{analysis.unvaluedOutcomeCount === 1 ? ' is' : 's are'} unavailable. No guaranteed-loss percentage is shown.</div> : null}<p className="mt-2.5 flex items-start gap-2 text-[11px] leading-4 text-cs-muted"><AlertTriangle className="mt-0.5 shrink-0 text-cs-amber" size={13} /> Odds are authoritative; values are estimates. Manual contracts are never blocked just for negative ROI.</p></section>

        <section className="border border-cs-border bg-cs-panel p-3"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Sparkles className="text-rarity-special" size={17} /><h2 className="font-semibold text-cs-text">Possible outcomes</h2></div><span className="font-mono text-[9px] uppercase text-cs-muted">{analysis.outcomes.length} real odds</span></div><div className="mt-2.5 grid max-h-[30rem] grid-cols-2 gap-2 overflow-y-auto pr-1">{analysis.outcomes.slice(0, outcomeLimit).map((outcome) => <OutcomeCard key={`${outcome.skin.id}:${outcome.isStatTrak}`} onInspect={() => setInspectedOutcome(outcome)} outcome={outcome} />)}{!analysis.outcomes.length ? <p className="col-span-2 border border-cs-border bg-cs-surface p-5 text-center text-xs leading-5 text-cs-muted">Complete a compatible input set to reveal the real output pool, predicted float, and exact probabilities.</p> : null}</div>{analysis.outcomes.length > outcomeLimit ? <button className="mt-2 w-full border border-cs-border py-2 text-xs text-cs-muted hover:text-cs-text" onClick={() => setOutcomeLimit((value) => value + 12)} type="button">Show 12 more outcomes</button> : null}</section>

        <section className="order-first border border-rarity-restricted/60 bg-gradient-to-br from-rarity-restricted/15 to-cs-panel p-3 shadow-2xl xl:col-span-2"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 text-rarity-restricted" size={18} /><div><h2 className="font-semibold text-cs-text">{selected.length}/{capacity} inputs ready</h2><p className="mt-1 text-xs leading-5 text-cs-muted">The review dock stays in the workspace flow, so it remains easy to reach without covering contract analysis.</p></div></div><button className="inline-flex min-h-11 min-w-48 items-center justify-center gap-2 border border-rarity-restricted bg-rarity-restricted/10 px-4 font-semibold text-rarity-restricted disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted" disabled={!analysis.canTradeUp} onClick={() => { setReviewing(true); setRiskAccepted(false) }} type="button">Review Contract <ArrowRight size={16} /></button></div></section>
      </aside>
    </div>

    <section className="mt-3 border border-cs-border bg-cs-panel p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-cs-muted">Saved contract register</p><h2 className="mt-0.5 font-semibold text-cs-text">Recent contracts</h2></div><span className="text-xs text-cs-muted">{state.ui.tradeUpHistory.length}/24 retained</span></div><div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{state.ui.tradeUpHistory.slice(0, 8).map((entry) => <article className="flex min-w-0 items-center gap-3 border border-cs-border bg-cs-surface p-2" key={entry.id}><AssetImage alt="" className="h-14 w-20 object-contain" src={imageFor(entry.outputItem)} /><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1"><ItemEditionBadge compact item={entry.outputItem} /></div><p className="mt-1 truncate text-xs font-semibold text-cs-text">{entry.outputItem.weapon} | {entry.outputItem.finish}</p><p className="mt-1 text-[9px] text-cs-muted">{new Date(entry.createdAt).toLocaleString()} · {entry.inputItemIds.length} inputs</p><p className={`mt-1 text-xs font-semibold ${entry.profit >= 0 ? 'text-cs-green' : 'text-rarity-covert'}`}>{entry.profit >= 0 ? <TrendingUp className="mr-1 inline" size={12} /> : <TrendingDown className="mr-1 inline" size={12} />}{entry.profit >= 0 ? '+' : ''}{formatCurrency(entry.profit)}</p></div><div className="shrink-0"><PatternBadge compact item={entry.outputItem} /></div></article>)}{!state.ui.tradeUpHistory.length ? <p className="col-span-full border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">No fabricated history. Your first completed contract will appear here.</p> : null}</div></section>

    {reviewing ? <div aria-modal="true" className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm" role="dialog"><section className="my-auto w-full max-w-4xl border border-rarity-restricted bg-cs-surface p-4 shadow-2xl sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><Stamp className="mt-0.5 text-rarity-restricted" size={24} /><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-rarity-restricted">Final irreversible review</p><h2 className="mt-1 text-xl font-semibold text-cs-text">Sign and execute this contract?</h2><p className="mt-1 text-sm text-cs-muted">The result is generated exactly once by the reducer before the reveal animation begins.</p></div></div><button aria-label="Close contract review" className="grid h-9 w-9 shrink-0 place-items-center border border-cs-border text-cs-muted" onClick={resetReview} type="button"><X size={17} /></button></div><div className="mt-4 grid grid-cols-5 gap-1.5 sm:grid-cols-10">{selected.map((item) => <div className="min-w-0 border border-cs-border bg-cs-panel p-1.5" key={item.instanceId}><AssetImage alt="" className="h-12 w-full object-contain" src={imageFor(item)} /><div className="mt-1 flex justify-center"><ItemEditionBadge compact item={item} /></div><p className="mt-1 truncate text-[9px] text-cs-muted">{item.finish}</p></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Inputs consumed" value={`${selected.length} exact items`} /><Metric label="Opportunity cost" value={formatCurrency(analysis.inputValue)} /><Metric label="Possible outcomes" value={`${analysis.outcomes.length}`} /><Metric label="Expected ROI" value={roi === undefined ? 'Value unavailable' : `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} tone={roi === undefined ? 'text-cs-amber' : roi >= 0 ? 'text-cs-green' : 'text-rarity-covert'} /></div>{negativeReturn ? <div className="mt-3 border border-rarity-covert/60 bg-rarity-covert/10 p-3 text-sm text-rarity-covert"><strong>This contract is expected to lose {formatCurrency(Math.abs(analysis.expectedProfit))}.</strong> Expected return is information, not permission. The actual result may differ.</div> : null}{highRisk ? <label className="mt-3 flex cursor-pointer items-start gap-2 border border-cs-amber bg-cs-amber/10 p-3 text-sm text-cs-text"><input checked={riskAccepted} className="mt-1" onChange={(event) => setRiskAccepted(event.target.checked)} type="checkbox" /><span><strong>I understand this contract could lose most of its input value.</strong><span className="mt-0.5 block text-xs text-cs-muted">Required because the estimated ROI is {roi?.toFixed(1)}%.</span></span></label> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button className="min-h-11 border border-cs-border text-sm text-cs-muted" onClick={resetReview} type="button">Back to workbench</button><button className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 text-sm font-semibold text-rarity-special disabled:opacity-40" data-testid="execute-trade-up" disabled={highRisk && !riskAccepted} onClick={execute} type="button"><Stamp size={16} /> Execute Trade-Up</button></div></section></div> : null}

    {inspectedOutcome ? <div aria-modal="true" className="fixed inset-0 z-[86] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" role="dialog"><section className="w-full max-w-lg border bg-cs-surface p-4" style={{ borderColor: getSkinRarityColor(inspectedOutcome.skin) }}><div className="flex justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-rarity-special">{formatProbability(inspectedOutcome.probability)} contract probability</p><h2 className="mt-1 text-xl font-semibold text-cs-text">{inspectedOutcome.skin.weapon} | {inspectedOutcome.skin.finish}</h2></div><button aria-label="Close outcome inspection" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={() => setInspectedOutcome(undefined)} type="button"><X size={17} /></button></div><AssetImage alt="" className="mx-auto mt-3 h-52 w-full object-contain" src={inspectedOutcome.skin.image} /><div className="mt-3 flex flex-wrap gap-1">{inspectedOutcome.isStatTrak ? <ItemEditionBadge item={{ statTrak: true, souvenir: false }} /> : <ItemEditionBadge item={{ statTrak: false, souvenir: false }} showRegular />}</div><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Predicted wear" value={getWearLabel(inspectedOutcome.predictedWear)} /><Metric label="Predicted float" value={inspectedOutcome.predictedFloat.toFixed(6)} /><Metric label="Estimated value" value={inspectedOutcome.hasValuation ? formatCurrency(inspectedOutcome.value) : 'Value unavailable'} /><Metric label="Valuation" value={inspectedOutcome.valuationConfidence === 'market' ? 'Market source' : inspectedOutcome.valuationConfidence === 'estimated' ? 'Catalog estimate' : 'Unavailable'} /></div><p className="mt-3 text-xs text-cs-muted">The image represents the finish, not a seed-specific render. Actual Pattern identity is generated only if this outcome wins.</p></section></div> : null}

    {state.marketplace.pendingAcquisition?.source === 'trade-up' ? <AcquisitionReveal acquisition={state.marketplace.pendingAcquisition} onClaim={claimAcquisition} tradeUpResult={latestTradeUp ? { inputValue: latestTradeUp.inputValue, outputValue: latestTradeUp.outputValue, profit: latestTradeUp.profit } : undefined} reducedMotion={state.settings.simplifiedAnimations} /> : null}
  </section>
}
