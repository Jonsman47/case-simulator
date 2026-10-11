import { Star, X, Zap } from 'lucide-react'
import { Rarity, type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { formatCurrency } from '../utils/format'
import { getRarityLabel, getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import { AssetImage } from './AssetImage'

export interface BatchOpenSummaryModalProps {
  autoSoldItems: SkinInstance[]
  caseName: string
  items: SkinInstance[]
  onClose: () => void
  openedCount: number
  saleValue: number
  skipAnimations: boolean
}

const rarityOrder = [
  Rarity.Contraband,
  Rarity.SpecialItem,
  Rarity.Covert,
  Rarity.Classified,
  Rarity.Restricted,
  Rarity.MilSpec,
  Rarity.Industrial,
  Rarity.Consumer,
]

function isExcitingDrop(item: SkinInstance) {
  return (
    item.rarity === Rarity.Covert ||
    item.rarity === Rarity.SpecialItem ||
    item.rarity === Rarity.Contraband
  )
}

function groupItemsByRarity(items: SkinInstance[]) {
  const itemsByRarity = new Map<Rarity, SkinInstance[]>()

  for (const item of items) {
    itemsByRarity.set(item.rarity, [...(itemsByRarity.get(item.rarity) ?? []), item])
  }

  return rarityOrder
    .map((rarity) => ({
      items: [...(itemsByRarity.get(rarity) ?? [])].sort((left, right) => right.marketValue - left.marketValue),
      rarity,
    }))
    .filter((group) => group.items.length > 0)
}

export function BatchOpenSummaryModal({
  autoSoldItems,
  caseName,
  items,
  onClose,
  openedCount,
  saleValue,
  skipAnimations,
}: BatchOpenSummaryModalProps) {
  if (items.length === 0) {
    return null
  }

  const groupedItems = groupItemsByRarity(items)
  const mostValuableItems = [...items].sort((left, right) => right.marketValue - left.marketValue).slice(0, 3)
  const totalValue = items.reduce((total, item) => total + item.marketValue, 0)
  const excitingDrops = items.filter(isExcitingDrop)
  const revealMode = skipAnimations && excitingDrops.length === 0 ? 'Skipped' : 'Short reveal'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:p-4">
      <section
        aria-label="Case opening batch summary"
        aria-modal="true"
        className="relative min-h-dvh w-full max-w-none border border-cs-border bg-cs-surface p-3 text-cs-text shadow-glow sm:min-h-0 sm:max-w-5xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase text-rarity-special">{caseName}</p>
            <h2 className="mt-1 text-xl font-semibold text-cs-text sm:text-3xl">Opening Summary</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryPill label="Opened" value={openedCount.toLocaleString()} />
              <SummaryPill label="Drops" value={items.length.toLocaleString()} />
              <SummaryPill label="Value" value={formatCurrency(totalValue)} tone="green" />
              <SummaryPill label="Reveal" value={revealMode} />
            </div>
          </div>
          <button
            aria-label="Close opening summary"
            className="grid h-11 w-11 shrink-0 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {excitingDrops.length > 0 ? (
          <div className="mt-4 flex items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted">
            <Zap size={16} />
            <span>{excitingDrops.length} premium reveal{excitingDrops.length === 1 ? '' : 's'}</span>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            {groupedItems.map((group) => (
              <section
                className="border border-cs-border bg-cs-panel p-3"
                key={group.rarity}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-xs uppercase text-cs-muted">
                    {getRarityLabel(group.rarity)}
                  </h3>
                  <span className="font-mono text-xs text-cs-muted">
                    {group.items.length} / {formatCurrency(group.items.reduce((total, item) => total + item.marketValue, 0))}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.slice(0, 12).map((item) => (
                    <DropSummaryCard
                      isHighlighted={mostValuableItems.some((topItem) => topItem.instanceId === item.instanceId)}
                      item={item}
                      key={item.instanceId}
                    />
                  ))}
                </div>
                {group.items.length > 12 ? (
                  <p className="mt-3 font-mono text-xs uppercase text-cs-muted">
                    +{group.items.length - 12} more
                  </p>
                ) : null}
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            <section className="border border-cs-border bg-cs-panel p-3">
              <h3 className="font-mono text-xs uppercase text-cs-muted">Top Value</h3>
              <div className="mt-3 space-y-2">
                {mostValuableItems.map((item) => (
                  <DropSummaryCard isCompact isHighlighted item={item} key={item.instanceId} />
                ))}
              </div>
            </section>

            <section className="border border-cs-green bg-cs-green/5 p-3">
              <h3 className="font-mono text-xs uppercase text-cs-green">Auto-Sold</h3>
              {autoSoldItems.length > 0 ? (
                <>
                  <p className="mt-2 text-sm text-cs-muted">
                    {autoSoldItems.length} item{autoSoldItems.length === 1 ? '' : 's'} sold for{' '}
                    <span className="font-semibold text-cs-green">{formatCurrency(saleValue)}</span>
                  </p>
                  <div className="mt-3 space-y-2">
                    {autoSoldItems.slice(0, 6).map((item) => (
                      <DropSummaryCard isCompact item={item} key={item.instanceId} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-cs-muted">0 items sold</p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </div>
  )
}

function SummaryPill({
  label,
  tone = 'default',
  value,
}: {
  label: string
  tone?: 'default' | 'green' | 'special'
  value: string
}) {
  const valueClass =
    tone === 'green' ? 'text-cs-green' : tone === 'special' ? 'text-rarity-special' : 'text-cs-text'

  return (
    <span className="border border-cs-border bg-cs-panel px-3 py-2">
      <span className="font-mono text-[10px] uppercase text-cs-muted">{label}</span>{' '}
      <span className={`font-mono text-xs font-semibold ${valueClass}`}>{value}</span>
    </span>
  )
}

function DropSummaryCard({
  isCompact = false,
  isHighlighted = false,
  item,
}: {
  isCompact?: boolean
  isHighlighted?: boolean
  item: SkinInstance
}) {
  const rarityColor = getSkinRarityColor(item)

  return (
    <article
      className={[
        'border bg-cs-surface p-2',
        isHighlighted ? 'shadow-glow' : '',
      ].join(' ')}
      style={{ borderColor: rarityColor }}
    >
      <div className="flex items-center gap-2">
        <AssetImage
          alt=""
          className={isCompact ? 'h-10 w-10 object-contain' : 'h-12 w-12 object-contain'}
          draggable={false}
          src={item.image}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-cs-text">
            {item.weapon} | {item.finish}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] uppercase text-cs-muted">
            {getWearLabel(item.wear)} / {item.floatValue.toFixed(3)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase text-cs-muted">
          {getSkinRarityLabel(item)}
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-xs text-cs-green">
          {isHighlighted ? <Star fill="currentColor" size={12} /> : null}
          {formatCurrency(item.marketValue)}
        </span>
      </div>
    </article>
  )
}
