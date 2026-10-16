import { type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getSkinRarityLabel } from '../utils/itemLabels'
import { isHighlightedRecentDrop } from '../utils/openingAnimation'
import { AssetImage } from './AssetImage'
import { PatternBadge } from './PatternInfo'

export interface RecentDropsFeedProps {
  drops: SkinInstance[]
  inventory: SkinInstance[]
  animateHighlights?: boolean
  limit?: number
  marketValues: Record<string, number>
  onOpenItem: (item: SkinInstance) => void
}

export function RecentDropsFeed({
  animateHighlights = true,
  drops,
  inventory,
  limit = 10,
  marketValues,
  onOpenItem,
}: RecentDropsFeedProps) {
  const visibleDrops = drops.slice(0, limit)

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-cs-text">Recent Drops</h3>
        <span className="font-mono text-xs uppercase text-cs-muted">
          {drops.length} tracked
        </span>
      </div>
      {visibleDrops.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleDrops.map((drop) => {
            const ownedItem = inventory.find((item) => item.instanceId === drop.instanceId)
            const itemForDisplay = ownedItem ?? drop

            return (
              <RecentDropCard
                isOwned={Boolean(ownedItem)}
                item={itemForDisplay}
                key={drop.instanceId}
                marketValue={getCurrentItemMarketValue(itemForDisplay, marketValues)}
                animateHighlights={animateHighlights}
                onOpen={onOpenItem}
              />
            )
          })}
        </div>
      ) : (
        <div className="mt-4 grid min-h-40 place-items-center border border-cs-border bg-cs-surface p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-cs-text">No recent drops yet</p>
            <p className="mt-2 text-sm text-cs-muted">Open cases to fill this feed.</p>
          </div>
        </div>
      )}
    </section>
  )
}

function RecentDropCard({
  animateHighlights,
  isOwned,
  item,
  marketValue,
  onOpen,
}: {
  animateHighlights: boolean
  isOwned: boolean
  item: SkinInstance
  marketValue: number
  onOpen: (item: SkinInstance) => void
}) {
  const isHighlighted = animateHighlights && isHighlightedRecentDrop(item)
  const rarityColor = getSkinRarityColor(item)

  return (
    <article
      className={[
        'border bg-cs-surface p-3 outline-none transition-colors hover:bg-cs-panelMuted focus-visible:ring-2 focus-visible:ring-rarity-special',
        isHighlighted ? 'shadow-glow' : '',
        isHighlighted && isOwned ? 'animate-pulse' : '',
        isOwned ? 'cursor-pointer' : 'cursor-pointer opacity-70',
      ].join(' ')}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(item)
        }
      }}
      style={{ borderColor: rarityColor }}
      tabIndex={0}
    >
      <div
        className="grid h-20 place-items-center border bg-cs-panel"
        style={{ borderColor: rarityColor, backgroundColor: `${rarityColor}14` }}
      >
        <AssetImage alt="" className="h-14 w-14 object-contain" draggable={false} src={item.image} />
      </div>
      <h3 className="mt-3 truncate text-sm font-semibold text-cs-text">
        {item.weapon} | {item.finish}
      </h3>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-mono uppercase" style={{ color: rarityColor }}>
          {getSkinRarityLabel(item)}
        </span>
        <span className="font-semibold text-cs-green">{formatCurrency(marketValue)}</span>
      </div>
      <div className="mt-2"><PatternBadge compact item={item} /></div>
      {!isOwned ? (
        <p className="mt-2 border border-cs-border px-2 py-1 font-mono text-[10px] uppercase text-cs-muted">
          Sold
        </p>
      ) : null}
    </article>
  )
}
