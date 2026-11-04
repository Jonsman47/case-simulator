import { BarChart3, ChevronLeft, ChevronRight, Database, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ImportedSkinDefinition } from '../data/importedAssetTypes'
import { WearCondition, type SkinBase } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { AssetImage } from './AssetImage'
import { formatCurrency } from '../utils/format'
import { getRarityLabel, getWearLabel } from '../utils/itemLabels'
import {
  BASE_PRICE_DATA_UPDATED_AT,
  createPatternPriceRows,
  getAvailableWearConditions,
  getConditionBasePrice,
  getConditionPriceConfidence,
  isPaintKitVariant,
  isSeedPriceRelevant,
  type PatternEdition,
  type PatternPriceRow,
} from '../utils/patternPriceExplorer'

const PAGE_SIZE = 25
type PatternSort = 'highest' | 'lowest' | 'seed'

function supportsEdition(skin: SkinBase, edition: PatternEdition) {
  if (edition === 'normal') return true
  const imported = skin as ImportedSkinDefinition
  return edition === 'stattrak' ? Boolean(imported.hasStatTrak || skin.statTrak) : Boolean(imported.hasSouvenir || skin.souvenir)
}

function confidenceLabel(row: PatternPriceRow) {
  if (row.confidence === 'market-listing') return 'Market listing observation'
  if (row.confidence === 'simulator-estimate') return 'Simulator estimate'
  return 'No pattern premium expected'
}

export function MarketSkinDetails({ currentMarketValue, onClose, skin }: { currentMarketValue?: number; onClose: () => void; skin: SkinBase }) {
  const availableWears = useMemo(() => getAvailableWearConditions(skin), [skin])
  const [wear, setWear] = useState(() => availableWears[0] ?? WearCondition.FieldTested)
  const [edition, setEdition] = useState<PatternEdition>('normal')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PatternSort>('highest')
  const [specialOnly, setSpecialOnly] = useState(false)
  const [page, setPage] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const seedRelevant = isSeedPriceRelevant(skin)
  const paintKitVariant = isPaintKitVariant(skin)
  const allRows = useMemo(() => createPatternPriceRows({ currentRepresentativeValue: currentMarketValue, edition, skin, wear }), [currentMarketValue, edition, skin, wear])
  const filteredRows = useMemo(() => {
    const numericQuery = query.trim() === '' ? undefined : Number(query)
    return allRows
      .filter((row) => numericQuery === undefined || row.seed === numericQuery)
      .filter((row) => !specialOnly || row.pattern.tier !== 'standard')
      .sort((left, right) => sort === 'seed'
        ? left.seed - right.seed
        : sort === 'lowest'
          ? left.estimatedValue - right.estimatedValue || left.seed - right.seed
          : right.estimatedValue - left.estimatedValue || left.seed - right.seed)
  }, [allRows, query, sort, specialOnly])
  const topRows = useMemo(() => [...allRows].sort((left, right) => right.estimatedValue - left.estimatedValue || left.seed - right.seed).slice(0, 10), [allRows])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const baseValue = getConditionBasePrice(skin, wear, edition, currentMarketValue)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
      if (!focusable.length) return
      const [first] = focusable; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [onClose])

  return createPortal(<div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-2 backdrop-blur-sm sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section aria-label={`${skin.weapon} ${skin.finish} price details`} aria-modal="true" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden border border-cs-border bg-cs-surface shadow-glow sm:max-h-[calc(100dvh-2rem)]" ref={dialogRef} role="dialog"><header className="flex shrink-0 items-start justify-between gap-3 border-b border-cs-border bg-cs-panel p-3 sm:p-4"><div className="flex min-w-0 items-center gap-3"><AssetImage alt="" className="h-16 w-24 shrink-0 object-contain" src={skin.image} /><div className="min-w-0"><p className="font-mono text-[10px] uppercase" style={{ color: getSkinRarityColor(skin) }}>{getRarityLabel(skin.rarity)}</p><h2 className="truncate text-xl font-semibold text-cs-text sm:text-2xl">{skin.weapon} | {skin.finish}</h2><p className="mt-1 text-xs text-cs-muted">Base catalog value {formatCurrency(currentMarketValue ?? skin.baseValue)} · USD simulator market</p></div></div><button aria-label="Close price details" className="grid h-11 w-11 shrink-0 place-items-center border border-cs-border text-cs-muted hover:text-cs-text" onClick={onClose} ref={closeRef} type="button"><X size={19} /></button></header><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"><section><div className="flex items-center gap-2"><BarChart3 className="text-rarity-special" size={18} /><h3 className="text-lg font-semibold text-cs-text">Wear price table</h3></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[42rem] border-collapse text-left text-sm"><thead><tr className="border border-cs-border bg-cs-panel font-mono text-[10px] uppercase text-cs-muted"><th className="p-2">Wear</th><th className="p-2">Standard</th><th className="p-2">StatTrak</th><th className="p-2">Souvenir</th><th className="p-2">Source confidence</th></tr></thead><tbody>{Object.values(WearCondition).map((condition) => { const available = availableWears.includes(condition); return <tr className={`border border-cs-border ${condition === wear ? 'bg-rarity-special/10' : 'bg-cs-surface'} ${available ? '' : 'opacity-45'}`} key={condition}><td className="p-2"><button className="font-semibold text-cs-text disabled:cursor-not-allowed" disabled={!available} onClick={() => { setWear(condition); setPage(0) }} type="button">{getWearLabel(condition)}</button></td>{(['normal', 'stattrak', 'souvenir'] as PatternEdition[]).map((version) => <td className="p-2 font-mono text-cs-green" key={version}>{available && supportsEdition(skin, version) ? formatCurrency(getConditionBasePrice(skin, condition, version, currentMarketValue)) : 'Not available'}</td>)}<td className="p-2 text-cs-muted">{available ? getConditionPriceConfidence(skin, condition, 'normal') : 'Impossible wear'}</td></tr>})}</tbody></table></div><div className="mt-3 flex flex-wrap gap-2">{(['normal', 'stattrak', 'souvenir'] as PatternEdition[]).filter((version) => supportsEdition(skin, version)).map((version) => <button className={`min-h-10 border px-3 text-sm font-semibold ${edition === version ? 'border-rarity-special bg-rarity-special/10 text-rarity-special' : 'border-cs-border text-cs-muted'}`} key={version} onClick={() => { setEdition(version); setPage(0) }} type="button">{version === 'normal' ? 'Standard' : version === 'stattrak' ? 'StatTrak' : 'Souvenir'}</button>)}</div><p className="mt-2 text-xs text-cs-muted">Selected base: {getWearLabel(wear)} · {formatCurrency(baseValue)} · price cache updated {new Date(BASE_PRICE_DATA_UPDATED_AT).toLocaleDateString()}</p></section><section className="mt-6 border-t border-cs-border pt-5"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 shrink-0 text-rarity-special" size={19} /><div><h3 className="text-lg font-semibold text-cs-text">Pattern price explorer</h3><p className="mt-1 text-sm text-cs-muted">Generic thumbnails do not show the selected Pattern ID. Values below never claim to be seed-specific renders.</p></div></div>{paintKitVariant ? <div className="mt-4 border border-rarity-special bg-rarity-special/10 p-3 text-sm text-cs-muted"><strong className="text-cs-text">{allRows[0]?.pattern.name}</strong> is determined by this skin's paint kit/phase, not Pattern ID. Searching seeds would create a false ranking, so no Top 10 seed list is shown.</div> : !seedRelevant ? <div className="mt-4 border border-cs-border bg-cs-panel p-3 text-sm text-cs-muted">This finish has no supported seed-dependent price behavior. Pattern IDs remain valid item identity, but all 0–1000 IDs use the ordinary value.</div> : <><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_12rem_auto]"><label className="flex min-h-11 items-center gap-2 border border-cs-border bg-cs-panel px-3"><Search className="text-rarity-special" size={16} /><span className="sr-only">Search pattern ID</span><input className="min-w-0 flex-1 bg-transparent text-cs-text outline-none" max="1000" min="0" onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Pattern ID 0–1000" type="number" value={query} /></label><select aria-label="Sort patterns" className="min-h-11 border border-cs-border bg-cs-panel px-3 text-cs-text" onChange={(event) => { setSort(event.target.value as PatternSort); setPage(0) }} value={sort}><option value="highest">Most expensive</option><option value="lowest">Lowest price</option><option value="seed">Pattern ID</option></select><label className="flex min-h-11 items-center gap-2 border border-cs-border bg-cs-panel px-3 text-sm text-cs-text"><input checked={specialOnly} onChange={(event) => { setSpecialOnly(event.target.checked); setPage(0) }} type="checkbox" /> Special only</label></div><div className="mt-4 grid gap-4 xl:grid-cols-[18rem_1fr]"><div className="border border-cs-border bg-cs-panel p-3"><div className="flex items-center gap-2"><ShieldCheck className="text-rarity-special" size={16} /><h4 className="font-semibold text-cs-text">Top 10 patterns</h4></div><p className="mt-1 text-xs text-cs-muted">Ranked for this exact weapon, finish, wear, and edition.</p><ol className="mt-3 grid gap-1">{topRows.map((row, index) => <li className="flex items-center justify-between gap-2 border border-cs-border bg-cs-surface px-2 py-1.5 text-xs" key={row.seed}><span className="truncate text-cs-text">{index + 1}. #{row.seed} · {row.pattern.name}</span><span className="shrink-0 font-mono text-cs-green">{formatCurrency(row.estimatedValue)}</span></li>)}</ol></div><div className="min-w-0 overflow-hidden border border-cs-border"><div className="overflow-x-auto"><table className="w-full min-w-[48rem] border-collapse text-left text-xs"><thead><tr className="bg-cs-panel font-mono uppercase text-cs-muted"><th className="p-2">Pattern</th><th className="p-2">Classification</th><th className="p-2">Estimated value</th><th className="p-2">Premium</th><th className="p-2">Confidence / source</th></tr></thead><tbody>{visibleRows.map((row) => <tr className="border-t border-cs-border bg-cs-surface" key={row.seed}><td className="p-2 font-mono font-semibold text-cs-text">#{row.seed}</td><td className="p-2 text-cs-text">{row.pattern.name}<span className="ml-2 font-mono text-[10px] uppercase text-cs-muted">{row.pattern.tier}</span></td><td className="p-2 font-mono text-cs-green">{formatCurrency(row.estimatedValue)}</td><td className="p-2 text-cs-text">+{formatCurrency(row.premiumValue)} ({row.premiumPercent.toLocaleString()}%)</td><td className="p-2 text-cs-muted"><span className="block">{confidenceLabel(row)}</span><span className="block text-[10px]">{row.source} · {new Date(row.updatedAt).toLocaleDateString()}{row.sampleSize ? ` · n=${row.sampleSize}` : ''}</span></td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3 border-t border-cs-border bg-cs-panel p-2"><span className="font-mono text-[10px] uppercase text-cs-muted">{filteredRows.length} patterns · page {page + 1}/{pageCount}</span><div className="flex gap-2"><button aria-label="Previous pattern page" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-text disabled:opacity-40" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button"><ChevronLeft size={16} /></button><button aria-label="Next pattern page" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-text disabled:opacity-40" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button"><ChevronRight size={16} /></button></div></div></div></div><div className="mt-3 flex items-start gap-2 border border-cs-border bg-cs-panel p-3 text-xs text-cs-muted"><Database className="mt-0.5 shrink-0" size={15} /><p>Market-listing observations are labeled separately from simulator estimates. An asking price is not treated as a confirmed sale. Empty or stale provider data falls back to conservative skin-specific classification.</p></div></>}</section></div></section></div>, document.body)
}
