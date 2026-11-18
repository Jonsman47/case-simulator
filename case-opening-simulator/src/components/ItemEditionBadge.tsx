import type { SkinInstance } from '../data/models'
import { getItemEdition, getItemEditionLabel } from '../utils/itemEdition'

export function ItemEditionBadge({
  compact = false,
  item,
  showRegular = false,
}: {
  compact?: boolean
  item: Pick<SkinInstance, 'souvenir' | 'statTrak'>
  showRegular?: boolean
}) {
  const edition = getItemEdition(item)
  if (edition === 'regular' && !showRegular) return null

  const label = getItemEditionLabel(item)
  const classes = edition === 'stattrak'
    ? 'border-[#cf6a32] bg-[#cf6a32]/10 text-[#f29a62]'
    : edition === 'souvenir'
      ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
      : 'border-cs-border bg-cs-panel text-cs-muted'

  return (
    <span
      aria-label={`Edition: ${label}`}
      className={`inline-flex max-w-full items-center border font-mono font-semibold uppercase tracking-wide ${classes} ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'}`}
      data-edition={edition}
      title={`${label} edition`}
    >
      {label}
    </span>
  )
}
