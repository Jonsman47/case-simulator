import { CircleHelp, Hash, Sparkles } from 'lucide-react'
import type { SkinInstance } from '../data/models'
import { formatCurrency } from '../utils/format'
import { getPatternTierLabel, isSpecialPattern } from '../utils/skinPatterns'

type PatternBadgeItem = Pick<SkinInstance, 'paintSeed' | 'pattern'>

function tierClasses(item: PatternBadgeItem) {
  if (item.pattern?.tier === 'iconic') {
    return 'border-rarity-special bg-rarity-special/15 text-rarity-special shadow-glow'
  }

  if (item.pattern?.tier === 'exceptional') {
    return 'border-rarity-covert bg-rarity-covert/10 text-rarity-covert'
  }

  if (item.pattern?.tier === 'rare') {
    return 'border-rarity-classified bg-rarity-classified/10 text-rarity-classified'
  }

  return 'border-cs-border bg-cs-surface text-cs-muted'
}

export function PatternBadge({ compact = false, item }: { compact?: boolean; item: PatternBadgeItem }) {
  if (item.paintSeed === undefined) {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 border border-cs-border px-2 py-1 font-mono text-[10px] uppercase text-cs-muted" title="This item predates paint-seed tracking and was not rerolled during migration.">
        <CircleHelp size={12} /> Legacy seed unavailable
      </span>
    )
  }

  const label = isSpecialPattern(item) ? item.pattern?.name : `Seed ${item.paintSeed}`

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase ${tierClasses(item)}`}
      title={`${item.pattern?.name ?? 'Standard pattern'} · Paint seed ${item.paintSeed}. The catalog image is not seed-specific.`}
    >
      {isSpecialPattern(item) ? <Sparkles className="shrink-0" size={12} /> : <Hash className="shrink-0" size={12} />}
      <span className="truncate">{label}</span>
    </span>
  )
}

export function PatternDetails({ estimatedValue, item }: { estimatedValue?: number; item: SkinInstance }) {
  const finalValue = estimatedValue ?? item.marketValue

  if (item.paintSeed === undefined || !item.pattern) {
    return (
      <section className="border border-cs-border bg-cs-panel p-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-cs-text"><CircleHelp size={16} /> Paint pattern</h3>
        <p className="mt-2 text-sm text-cs-muted">Legacy item: paint seed unavailable. Existing items were preserved without silently rerolling them.</p>
      </section>
    )
  }

  const multiplier = Math.max(1, item.pattern.premiumMultiplier)
  const baseValue = finalValue / multiplier
  const premium = Math.max(0, finalValue - baseValue)

  return (
    <section className={`border bg-cs-panel p-4 ${isSpecialPattern(item) ? 'border-rarity-special/70' : 'border-cs-border'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-cs-text"><Sparkles size={16} /> Paint pattern</h3>
        <PatternBadge item={item} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <PatternStat label="Paint Seed" value={String(item.paintSeed)} />
        <PatternStat label="Tier" value={getPatternTierLabel(item.pattern)} />
        {item.pattern.phase ? <PatternStat label="Paint-kit Phase" value={item.pattern.phase} /> : null}
        {item.pattern.fadePercentage !== undefined ? <PatternStat label="Fade" value={`${item.pattern.fadePercentage.toFixed(1)}%`} /> : null}
        {item.pattern.bluePercentage !== undefined ? <PatternStat label="Blue Coverage" value={`${item.pattern.bluePercentage.toFixed(1)}%`} /> : null}
        <PatternStat label="Base Value" value={formatCurrency(baseValue)} />
        <PatternStat label="Pattern Premium" value={premium > 0 ? `+${formatCurrency(premium)} (${multiplier.toFixed(2)}x)` : formatCurrency(0)} />
        <PatternStat label="Estimated Value" value={formatCurrency(finalValue)} tone="green" />
      </dl>
      {item.pattern.description ? <p className="mt-3 text-xs text-cs-muted">{item.pattern.description}</p> : null}
      <p className="mt-3 flex gap-2 border-t border-cs-border pt-3 text-xs text-cs-muted">
        <CircleHelp className="mt-0.5 shrink-0" size={14} />
        Catalog thumbnails show the finish only; they do not render this seed-specific appearance.
      </p>
    </section>
  )
}

function PatternStat({ label, tone, value }: { label: string; tone?: 'green'; value: string }) {
  return (
    <div className="min-w-0 border border-cs-border bg-cs-surface px-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase text-cs-muted">{label}</dt>
      <dd className={`mt-1 truncate font-mono ${tone === 'green' ? 'text-cs-green' : 'text-cs-text'}`}>{value}</dd>
    </div>
  )
}
