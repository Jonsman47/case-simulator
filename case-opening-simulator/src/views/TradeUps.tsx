import { AlertTriangle, ArrowRight, Check, ChevronDown, ClipboardCheck, Filter, Lock, PackageSearch, RotateCcw, Search, ShieldAlert, Sparkles, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AcquisitionReveal } from '../components/AcquisitionReveal'
import { AssetImage } from '../components/AssetImage'
import { PatternBadge } from '../components/PatternInfo'
import { CASE_DEFINITIONS } from '../data/cases'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getRarityLabel, getWearLabel } from '../utils/itemLabels'
import { isExceptionalPattern } from '../utils/skinPatterns'
import { analyzeTradeUp, getNextTradeUpRarity, getTradeUpInputCount, isTradeUpEligibleItem, tradeUpRarityOrder } from '../utils/tradeUp'

const tradeableRarities = tradeUpRarityOrder.filter((rarity) => getNextTradeUpRarity(rarity))
const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))
const casesById = new Map(CASE_DEFINITIONS.map((caseDef) => [caseDef.id, caseDef]))

function imageFor(item: Pick<SkinInstance, 'id' | 'image'>) {
  return item.image && item.image !== '/assets/placeholder.png' ? item.image : skinsById.get(item.id)?.image ?? '/assets/placeholder.png'
}

function eligibilityReason(item: SkinInstance) {
  if (item.isLocked) return 'Locked items are protected.'
  if (item.isFavorited) return 'Favorited items are protected.'
  if (isExceptionalPattern(item)) return 'Exceptional Patterns are protected.'
  if (!getNextTradeUpRarity(item.rarity)) return 'This rarity has no valid contract output.'
  return undefined
}

function collectionLabel(item: SkinInstance) {
  const skin = skinsById.get(item.id)
  return skin?.collections?.[0] ?? item.caseIds.map((id) => casesById.get(id)?.name).find(Boolean) ?? 'Unknown collection'
}

function Metric({ label, value, tone = 'text-cs-text' }: { label: string; value: string; tone?: string }) {
  return <div className="border border-cs-border bg-cs-surface px-3 py-2"><p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p><p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p></div>
}

function ContractSlot({ index, item, onRemove }: { index: number; item?: SkinInstance; onRemove: (id: string) => void }) {
  const color = item ? getSkinRarityColor(item) : undefined
  return <div className={`relative min-h-28 border bg-cs-surface p-2 ${item ? '' : 'border-dashed border-cs-border'}`} style={item ? { borderColor: color } : undefined}>
    <span className="absolute left-2 top-2 font-mono text-[9px] uppercase text-cs-muted">{String(index + 1).padStart(2, '0')}</span>
    {item ? <><button aria-label={`Remove ${item.weapon} ${item.finish}`} className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center border border-cs-border bg-cs-panel text-cs-muted hover:text-rarity-covert" onClick={() => onRemove(item.instanceId)} type="button"><Trash2 size={13} /></button><AssetImage alt="" className="mx-auto mt-3 h-12 w-16 object-contain" src={imageFor(item)} /><p className="mt-1 truncate text-[11px] font-semibold text-cs-text">{item.weapon} | {item.finish}</p><div className="mt-1 flex justify-between gap-1 font-mono text-[9px] uppercase text-cs-muted"><span>{item.floatValue.toFixed(4)}</span><span>{formatCurrency(item.marketValue)}</span></div></> : <div className="grid h-full min-h-24 place-items-center text-center"><div><PackageSearch className="mx-auto text-cs-border" size={22} /><p className="mt-1 font-mono text-[9px] uppercase text-cs-muted">Input slot</p></div></div>}
  </div>
}

function InventoryChoice({ disabledReason, item, selected, value, onToggle }: { disabledReason?: string; item: SkinInstance; selected: boolean; value: number; onToggle: () => void }) {
  const color = getSkinRarityColor(item)
  return <button aria-pressed={selected} className={`relative grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] gap-2 border bg-cs-surface p-2 text-left transition-colors ${selected ? 'ring-2 ring-rarity-special' : disabledReason ? 'opacity-55' : 'hover:bg-cs-panelMuted'}`} data-testid="trade-up-inventory-item" disabled={Boolean(disabledReason)} onClick={onToggle} style={{ borderColor: color }} title={disabledReason} type="button">
    <span className="grid h-14 w-14 place-items-center border border-cs-border bg-cs-panel"><AssetImage alt="" className="h-10 w-12 object-contain" src={imageFor(item)} /></span>
    <span className="min-w-0 pr-5"><span className="block truncate text-xs font-semibold text-cs-text">{item.weapon} | {item.finish}</span><span className="mt-1 block truncate font-mono text-[9px] uppercase text-cs-muted">{getWearLabel(item.wear)} · {item.floatValue.toFixed(5)}</span><span className="mt-1 block truncate text-[10px] text-cs-muted">{collectionLabel(item)}</span><span className="mt-1 block text-xs font-semibold text-cs-green">{formatCurrency(value)}</span></span>
    <span className="absolute right-1.5 top-1.5">{selected ? <Check className="text-rarity-special" size={14} /> : disabledReason ? <Lock className="text-cs-muted" size={13} /> : null}</span>
  </button>
}

export function TradeUps() {
  const { claimAcquisition, state, tradeUpItems } = useGame()
  const [rarity, setRarity] = useState<Rarity>(Rarity.Consumer)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [wear, setWear] = useState<'all' | WearCondition>('all')
  const [collection, setCollection] = useState('all')
  const [minimumFloat, setMinimumFloat] = useState('')
  const [maximumFloat, setMaximumFloat] = useState('')
  const [minimumPrice, setMinimumPrice] = useState('')
  const [maximumPrice, setMaximumPrice] = useState('')
  const [showIneligible, setShowIneligible] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const selected = useMemo(() => selectedIds.flatMap((id) => state.inventory.find((item) => item.instanceId === id) ?? []), [selectedIds, state.inventory])
  const analysis = useMemo(() => analyzeTradeUp({ inputItems: selected, marketValues: state.marketValues }), [selected, state.marketValues])
  const capacity = getTradeUpInputCount(rarity)
  const collections = useMemo(() => Array.from(new Set(state.inventory.filter((item) => item.rarity === rarity).map(collectionLabel))).sort(), [rarity, state.inventory])
  const visibleItems = useMemo(() => state.inventory.filter((item) => {
    if (item.rarity !== rarity) return false
    const reason = eligibilityReason(item)
    if (!showIneligible && reason) return false
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
  }).sort((a, b) => getCurrentItemMarketValue(a, state.marketValues) - getCurrentItemMarketValue(b, state.marketValues)), [collection, maximumFloat, maximumPrice, minimumFloat, minimumPrice, rarity, search, showIneligible, state.inventory, state.marketValues, wear])
  const worst = analysis.outcomes.length ? Math.min(...analysis.outcomes.map((outcome) => outcome.value)) : 0
  const best = analysis.outcomes.length ? Math.max(...analysis.outcomes.map((outcome) => outcome.value)) : 0
  const roi = analysis.inputValue > 0 ? analysis.expectedProfit / analysis.inputValue * 100 : 0

  function toggle(item: SkinInstance) {
    if (eligibilityReason(item)) return
    setReviewing(false)
    setSelectedIds((current) => current.includes(item.instanceId) ? current.filter((id) => id !== item.instanceId) : current.length < capacity ? [...current, item.instanceId] : current)
  }

  function changeRarity(next: Rarity) { setRarity(next); setSelectedIds([]); setReviewing(false); setCollection('all') }
  function execute() { if (!analysis.canTradeUp || !reviewing) return; tradeUpItems([...selectedIds]); setSelectedIds([]); setReviewing(false) }

  return <section className="w-full min-w-0 border border-cs-border bg-cs-surface p-3 sm:p-5" data-testid="trade-up-workbench">
    <header className="flex flex-col gap-3 border-l-4 border-rarity-restricted pl-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-mono text-xs uppercase text-rarity-restricted">High-stakes contract workbench</p><h1 className="mt-1 text-2xl font-semibold text-cs-text">Trade-Ups</h1><p className="mt-1 max-w-3xl text-sm text-cs-muted">Build a contract, inspect the real outcome distribution, then deliberately execute through the authoritative trade-up pipeline.</p></div><div className="flex flex-wrap gap-2">{tradeableRarities.map((entry) => <button aria-pressed={rarity === entry} className={`min-h-9 border px-3 font-mono text-[10px] uppercase ${rarity === entry ? 'border-rarity-restricted bg-rarity-restricted/10 text-rarity-restricted' : 'border-cs-border text-cs-muted'}`} key={entry} onClick={() => changeRarity(entry)} type="button">{getRarityLabel(entry)} · {state.inventory.filter((item) => item.rarity === entry && isTradeUpEligibleItem(item)).length}</button>)}</div></header>

    <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,.8fr)]">
      <main className="min-w-0 space-y-4">
        <section className="border border-rarity-restricted/60 bg-cs-panel p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-rarity-restricted">Contract inputs</p><h2 className="mt-1 text-lg font-semibold text-cs-text">{selected.length}/{capacity} items selected</h2></div><button className="inline-flex min-h-9 items-center gap-2 border border-cs-border px-3 text-xs text-cs-muted disabled:opacity-40" disabled={!selected.length} onClick={() => { setSelectedIds([]); setReviewing(false) }} type="button"><RotateCcw size={14} /> Clear</button></div><div className={`mt-3 grid gap-2 ${capacity === 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-5 xl:grid-cols-10'}`}>{Array.from({ length: capacity }, (_, index) => <ContractSlot index={index} item={selected[index]} key={index} onRemove={(id) => { setSelectedIds((current) => current.filter((entry) => entry !== id)); setReviewing(false) }} />)}</div><div className="mt-3 h-2 border border-cs-border bg-cs-surface"><div className="h-full bg-rarity-restricted transition-[width]" style={{ width: `${selected.length / capacity * 100}%` }} /></div></section>

        <section className="border border-cs-border bg-cs-panel p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter className="text-rarity-industrial" size={17} /><h2 className="font-semibold text-cs-text">Inventory picker</h2></div><label className="flex items-center gap-2 text-xs text-cs-muted"><input checked={showIneligible} onChange={(event) => setShowIneligible(event.target.checked)} type="checkbox" /> Show protected/ineligible</label></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><label className="relative sm:col-span-2"><span className="sr-only">Search inventory</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-muted" size={15} /><input className="min-h-10 w-full border border-cs-border bg-cs-surface pl-9 pr-3 text-sm text-cs-text" onChange={(event) => setSearch(event.target.value)} placeholder="Skin, weapon, collection or Pattern" value={search} /></label><select aria-label="Wear filter" className="min-h-10 border border-cs-border bg-cs-surface px-2 text-xs text-cs-text" onChange={(event) => setWear(event.target.value as 'all' | WearCondition)} value={wear}><option value="all">All wears</option>{Object.values(WearCondition).map((entry) => <option key={entry} value={entry}>{getWearLabel(entry)}</option>)}</select><select aria-label="Collection filter" className="min-h-10 border border-cs-border bg-cs-surface px-2 text-xs text-cs-text" onChange={(event) => setCollection(event.target.value)} value={collection}><option value="all">All collections</option>{collections.map((entry) => <option key={entry}>{entry}</option>)}</select></div><details className="mt-2 border border-cs-border bg-cs-surface p-2"><summary className="flex cursor-pointer items-center gap-2 text-xs text-cs-muted"><ChevronDown size={14} /> Float and price ranges</summary><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><input aria-label="Minimum float" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" max="1" min="0" onChange={(event) => setMinimumFloat(event.target.value)} placeholder="Min float" step="0.001" type="number" value={minimumFloat} /><input aria-label="Maximum float" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" max="1" min="0" onChange={(event) => setMaximumFloat(event.target.value)} placeholder="Max float" step="0.001" type="number" value={maximumFloat} /><input aria-label="Minimum price" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" min="0" onChange={(event) => setMinimumPrice(event.target.value)} placeholder="Min price" type="number" value={minimumPrice} /><input aria-label="Maximum price" className="min-h-9 min-w-0 border border-cs-border bg-cs-panel px-2 text-xs text-cs-text" min="0" onChange={(event) => setMaximumPrice(event.target.value)} placeholder="Max price" type="number" value={maximumPrice} /></div></details><div className="mt-3 grid max-h-[28rem] gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{visibleItems.map((item) => <InventoryChoice disabledReason={eligibilityReason(item)} item={item} key={item.instanceId} onToggle={() => toggle(item)} selected={selectedIds.includes(item.instanceId)} value={getCurrentItemMarketValue(item, state.marketValues)} />)}{visibleItems.length === 0 ? <p className="col-span-full border border-cs-border bg-cs-surface p-6 text-center text-sm text-cs-muted">No inventory items match these eligibility filters.</p> : null}</div></section>
      </main>

      <aside className="min-w-0 space-y-4">
        <section className="border border-cs-border bg-cs-panel p-3"><div className="flex items-center gap-2"><ClipboardCheck className="text-rarity-restricted" size={18} /><h2 className="font-semibold text-cs-text">Probability & risk</h2></div><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Opportunity cost" value={formatCurrency(analysis.inputValue)} /><Metric label="Expected output" value={formatCurrency(analysis.expectedValue)} /><Metric label="Expected P/L" value={`${analysis.expectedProfit >= 0 ? '+' : ''}${formatCurrency(analysis.expectedProfit)}`} tone={analysis.expectedProfit >= 0 ? 'text-cs-green' : 'text-rarity-covert'} /><Metric label="Expected ROI" value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} tone={roi >= 0 ? 'text-cs-green' : 'text-rarity-covert'} /><Metric label="Worst outcome" value={`${formatCurrency(worst)} (${formatCurrency(worst - analysis.inputValue)})`} tone="text-rarity-covert" /><Metric label="Best outcome" value={`${formatCurrency(best)} (+${formatCurrency(best - analysis.inputValue)})`} tone="text-rarity-special" /></div><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-cs-muted"><AlertTriangle className="mt-0.5 shrink-0 text-cs-amber" size={14} /> Expected value is a probability-weighted estimate, never guaranteed profit. Pattern-dependent output values use the simulator’s documented confidence.</p>{analysis.message ? <p className="mt-3 border border-rarity-covert/50 bg-rarity-covert/5 p-2 text-xs text-rarity-covert">{analysis.message}</p> : null}</section>

        <section className="border border-cs-border bg-cs-panel p-3"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-cs-text">Possible outputs</h2><span className="font-mono text-[10px] uppercase text-cs-muted">{analysis.outcomes.length} outcomes</span></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{analysis.outcomes.map((outcome) => <article className="border border-cs-border bg-cs-surface p-2" key={`${outcome.skin.id}:${outcome.isStatTrak}`}><div className="flex items-center gap-2"><AssetImage alt="" className="h-10 w-12 object-contain" src={outcome.skin.image} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-cs-text">{outcome.skin.weapon} | {outcome.skin.finish}</p><p className="text-[10px] text-cs-muted">{getWearLabel(outcome.predictedWear)} · {outcome.predictedFloat.toFixed(6)}{outcome.isStatTrak ? ' · StatTrak' : ''}</p></div><div className="text-right"><p className="font-mono text-[10px] text-rarity-special">{outcome.probability.toFixed(3)}%</p><p className="text-xs font-semibold text-cs-green">{formatCurrency(outcome.value)}</p></div></div><div className="mt-1 h-1 bg-cs-panel"><div className="h-full bg-rarity-restricted" style={{ width: `${Math.min(100, outcome.probability)}%` }} /></div></article>)}{!analysis.outcomes.length ? <p className="border border-cs-border bg-cs-surface p-4 text-center text-xs text-cs-muted">Complete the input set to calculate the authoritative output distribution.</p> : null}</div></section>

        <section className={`border p-3 ${reviewing ? 'border-rarity-special bg-rarity-special/5' : 'border-cs-border bg-cs-panel'}`}><div className="flex items-start gap-2">{reviewing ? <ShieldAlert className="text-rarity-special" size={18} /> : <Sparkles className="text-rarity-restricted" size={18} />}<div><h2 className="font-semibold text-cs-text">{reviewing ? 'Final irreversible review' : 'Contract execution'}</h2><p className="mt-1 text-xs leading-5 text-cs-muted">{reviewing ? `Consume ${selected.length} exact items worth ${formatCurrency(analysis.inputValue)} for one real outcome?` : 'Review the complete contract before the executor can run.'}</p></div></div>{reviewing ? <div className="mt-3 grid grid-cols-2 gap-2"><button className="min-h-10 border border-cs-border text-sm text-cs-muted" onClick={() => setReviewing(false)} type="button">Back</button><button className="inline-flex min-h-10 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 text-sm font-semibold text-rarity-special" data-testid="execute-trade-up" onClick={execute} type="button">Execute Trade-Up <ArrowRight size={15} /></button></div> : <button className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-rarity-restricted bg-rarity-restricted/10 font-semibold text-rarity-restricted disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted" disabled={!analysis.canTradeUp} onClick={() => setReviewing(true)} type="button">Review Contract <ArrowRight size={16} /></button>}</section>
      </aside>
    </div>

    <section className="mt-4 border border-cs-border bg-cs-panel p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-cs-muted">Bounded real history</p><h2 className="mt-1 font-semibold text-cs-text">Recent contracts</h2></div><span className="text-xs text-cs-muted">{state.ui.tradeUpHistory.length}/24 retained</span></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{state.ui.tradeUpHistory.slice(0, 6).map((entry) => <article className="flex min-w-0 items-center gap-3 border border-cs-border bg-cs-surface p-2" key={entry.id}><AssetImage alt="" className="h-12 w-16 object-contain" src={imageFor(entry.outputItem)} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-cs-text">{entry.outputItem.weapon} | {entry.outputItem.finish}</p><p className="mt-1 text-[10px] text-cs-muted">{new Date(entry.createdAt).toLocaleString()} · {entry.inputItemIds.length} inputs</p><p className={`mt-1 text-xs font-semibold ${entry.profit >= 0 ? 'text-cs-green' : 'text-rarity-covert'}`}>{entry.profit >= 0 ? <TrendingUp className="mr-1 inline" size={12} /> : <TrendingDown className="mr-1 inline" size={12} />}{entry.profit >= 0 ? '+' : ''}{formatCurrency(entry.profit)}</p></div><div className="shrink-0"><PatternBadge compact item={entry.outputItem} /></div></article>)}{!state.ui.tradeUpHistory.length ? <p className="col-span-full border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">No fabricated history. Your first completed contract will appear here.</p> : null}</div></section>

    {state.marketplace.pendingAcquisition?.source === 'trade-up' ? <AcquisitionReveal acquisition={state.marketplace.pendingAcquisition} onClaim={claimAcquisition} /> : null}
  </section>
}
