import { Check, Sparkles, X } from 'lucide-react'
import type { AcquisitionReveal as AcquisitionRevealModel } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { formatCurrency } from '../utils/format'
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import { AssetImage } from './AssetImage'
import { PatternDetails } from './PatternInfo'

export function AcquisitionReveal({ acquisition, onClaim }: {
  acquisition: AcquisitionRevealModel
  onClaim: (id: string) => void
}) {
  const item = acquisition.item
  const accent = getSkinRarityColor(item)
  return (
    <div aria-labelledby="acquisition-title" aria-modal="true" className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm" role="dialog">
      <section className="relative my-auto w-full max-w-2xl border bg-cs-surface p-5 shadow-2xl sm:p-7" style={{ borderColor: accent }}>
        <button aria-label="Claim and close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center border border-cs-border text-cs-muted hover:text-cs-text" onClick={() => onClaim(acquisition.id)} type="button"><X size={18} /></button>
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[.28em] text-rarity-special">New Item</p>
          <h2 className="mt-2 text-2xl font-semibold text-cs-text" id="acquisition-title">{item.weapon} | {item.finish}</h2>
          <p className="mt-1 text-sm" style={{ color: accent }}>{getSkinRarityLabel(item)}</p>
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
