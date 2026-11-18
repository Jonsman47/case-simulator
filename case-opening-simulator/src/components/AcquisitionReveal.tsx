import { Check, FastForward, FileCheck2, LoaderCircle, Sparkles, Stamp, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AcquisitionReveal as AcquisitionRevealModel } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { formatCurrency } from '../utils/format'
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import { AssetImage } from './AssetImage'
import { PatternDetails } from './PatternInfo'
import { ItemEditionBadge } from './ItemEditionBadge'

export function AcquisitionReveal({ acquisition, onClaim, reducedMotion = false, tradeUpResult }: {
  acquisition: AcquisitionRevealModel
  onClaim: (id: string) => void
  reducedMotion?: boolean
  tradeUpResult?: { inputValue: number; outputValue: number; profit: number }
}) {
  const item = acquisition.item
  const accent = getSkinRarityColor(item)
  const isTradeUp = acquisition.source === 'trade-up'
  const [phase, setPhase] = useState<'processing' | 'revealed' | 'sealing'>(isTradeUp && !reducedMotion ? 'sealing' : 'revealed')

  useEffect(() => {
    if (!isTradeUp || reducedMotion) return undefined
    const processingTimer = window.setTimeout(() => setPhase('processing'), 620)
    const revealTimer = window.setTimeout(() => setPhase('revealed'), 1_420)
    return () => { window.clearTimeout(processingTimer); window.clearTimeout(revealTimer) }
  }, [acquisition.id, isTradeUp, reducedMotion])

  if (phase !== 'revealed') {
    return (
      <div aria-label="Trade-Up contract processing" aria-live="polite" aria-modal="true" className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-3 backdrop-blur-sm" role="dialog">
        <section className="trade-up-seal-card relative w-full max-w-xl overflow-hidden border border-rarity-restricted bg-cs-surface p-6 text-center shadow-2xl">
          <div className="trade-up-seal-paper mx-auto grid h-60 max-w-md place-items-center border border-cs-border bg-cs-panel p-5">
            {phase === 'sealing' ? <div className="trade-up-stamp-animation"><Stamp className="mx-auto text-rarity-restricted" size={58} /><p className="mt-4 font-mono text-sm uppercase tracking-[.3em] text-rarity-restricted">Contract sealed</p></div> : <div><LoaderCircle className="trade-up-processing mx-auto text-rarity-special" size={54} /><p className="mt-4 font-mono text-sm uppercase tracking-[.3em] text-rarity-special">Processing exchange</p></div>}
          </div>
          <p className="mt-4 text-sm text-cs-muted"><FileCheck2 className="mr-2 inline text-cs-green" size={16} />The authoritative result is already saved. This animation cannot reroll it.</p>
          <button className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 border border-cs-border px-4 text-sm text-cs-muted hover:text-cs-text" onClick={() => setPhase('revealed')} type="button"><FastForward size={15} /> Skip reveal</button>
        </section>
      </div>
    )
  }
  return (
    <div aria-labelledby="acquisition-title" aria-modal="true" className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm" role="dialog">
      <section className="relative my-auto w-full max-w-2xl border bg-cs-surface p-5 shadow-2xl sm:p-7" style={{ borderColor: accent }}>
        <button aria-label="Claim and close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center border border-cs-border text-cs-muted hover:text-cs-text" onClick={() => onClaim(acquisition.id)} type="button"><X size={18} /></button>
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[.28em] text-rarity-special">{isTradeUp ? 'Contract Result' : 'New Item'}</p>
          <h2 className="mt-2 text-2xl font-semibold text-cs-text" id="acquisition-title">{item.weapon} | {item.finish}</h2>
          <p className="mt-1 text-sm" style={{ color: accent }}>{getSkinRarityLabel(item)}</p>
          <div className="mt-2 flex justify-center"><ItemEditionBadge item={item} showRegular /></div>
        </div>
        <div className="mt-5 grid min-h-56 place-items-center border border-cs-border bg-cs-panel p-5">
          <AssetImage alt={`${item.weapon} ${item.finish}`} className="h-48 w-full object-contain" src={item.image} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Detail label="Wear" value={getWearLabel(item.wear)} />
          <Detail label="Float" value={item.floatValue.toFixed(6)} />
          <Detail label="Pattern" value={item.paintSeed === undefined ? 'N/A' : `#${item.paintSeed}`} />
          <Detail label="Estimated Value" value={formatCurrency(item.marketValue)} />
          <Detail label="Purchase Price" value={acquisition.price === undefined ? 'Trade-up output' : formatCurrency(acquisition.price)} />
          <Detail label="Edition" value={item.statTrak ? 'StatTrak' : item.souvenir ? 'Souvenir' : 'Regular'} />
        </div>
        {item.pattern ? <div className="mt-3"><PatternDetails item={item} /></div> : null}
        {isTradeUp && tradeUpResult ? <div className="mt-3 grid grid-cols-3 gap-2"><Detail label="Inputs consumed" value={formatCurrency(tradeUpResult.inputValue)} /><Detail label="Actual output" value={formatCurrency(tradeUpResult.outputValue)} /><Detail label="Realized result" value={`${tradeUpResult.profit >= 0 ? '+' : ''}${formatCurrency(tradeUpResult.profit)}`} /></div> : null}
        <p className="mt-4 text-center text-xs text-cs-muted">The transaction is already saved. Claim only acknowledges this reveal.</p>
        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 py-3 font-semibold text-rarity-special hover:bg-rarity-special/20" onClick={() => onClaim(acquisition.id)} type="button">
          {acquisition.source === 'trade-up' ? <Sparkles size={18} /> : <Check size={18} />} Claim
        </button>
      </section>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border border-cs-border bg-cs-panel px-3 py-2"><p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p><p className="mt-1 truncate text-sm font-semibold text-cs-text">{value}</p></div>
}
