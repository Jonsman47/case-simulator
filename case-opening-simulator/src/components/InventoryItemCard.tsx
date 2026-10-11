import { Lock, LockOpen, Star } from 'lucide-react'
import { memo, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'
import type { SkinInstance } from '../data/models'
import { Rarity } from '../data/models'
import { formatCurrency } from '../utils/format'
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import { getSkinRarityColor } from '../data/rarities'
import { AssetImage } from './AssetImage'

const rarityStyles: Record<Rarity, { border: string }> = {
  [Rarity.Consumer]: {
    border: 'border-rarity-consumer',
  },
  [Rarity.Industrial]: {
    border: 'border-rarity-industrial',
  },
  [Rarity.MilSpec]: {
    border: 'border-rarity-mil-spec',
  },
  [Rarity.Restricted]: {
    border: 'border-rarity-restricted',
  },
  [Rarity.Classified]: {
    border: 'border-rarity-classified',
  },
  [Rarity.Covert]: {
    border: 'border-rarity-covert',
  },
  [Rarity.SpecialItem]: {
    border: 'border-rarity-special',
  },
  [Rarity.Contraband]: {
    border: 'border-rarity-contraband',
  },
}

export const InventoryItemCard = memo(function InventoryItemCard({
  bulkSelectMode,
  index,
  isDuplicateSkin,
  isSelected,
  item,
  onOpen,
  onToggleFavorite,
  onToggleLock,
  onToggleSelect,
}: {
  bulkSelectMode: boolean
  index: number
  isDuplicateSkin: boolean
  isSelected: boolean
  item: SkinInstance
  onOpen: (item: SkinInstance) => void
  onToggleFavorite: (itemId: string) => void
  onToggleLock: (itemId: string) => void
  onToggleSelect: (itemId: string, index: number, isRangeSelection: boolean) => void
}) {
  const styles = rarityStyles[item.rarity]
  const rarityColor = getSkinRarityColor(item)
  const longPressTimerRef = useRef<number | undefined>(undefined)
  const suppressClickRef = useRef(false)

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = undefined
    }
  }

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = undefined
      }
    }
  }, [])

  function handleCardClick(event: MouseEvent<HTMLElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (bulkSelectMode || event.shiftKey) {
      onToggleSelect(item.instanceId, index, event.shiftKey)
      return
    }

    onOpen(item)
  }

  function handleSelectionClick(event: MouseEvent<HTMLInputElement>) {
    event.stopPropagation()
    onToggleSelect(item.instanceId, index, event.shiftKey)
  }

  function handleLockClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onToggleLock(item.instanceId)
  }

  function handleFavoriteClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onToggleFavorite(item.instanceId)
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return
    }

    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true
      onToggleSelect(item.instanceId, index, false)

      if (navigator.vibrate) {
        navigator.vibrate(12)
      }
    }, 520)
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    onToggleSelect(item.instanceId, index, event.shiftKey)
  }

  return (
    <article
      className={[
        'relative flex h-full min-h-[19rem] cursor-pointer touch-manipulation flex-col border bg-cs-panel p-2.5 outline-none transition-colors hover:bg-cs-panelMuted focus-visible:ring-2 focus-visible:ring-rarity-special sm:min-h-[20rem]',
        styles.border,
        isDuplicateSkin ? 'shadow-glow' : '',
        isSelected ? 'ring-2 ring-rarity-special' : '',
      ].join(' ')}
      onContextMenu={handleContextMenu}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (bulkSelectMode) {
            onToggleSelect(item.instanceId, index, event.shiftKey)
            return
          }
          onOpen(item)
        }
      }}
      onPointerCancel={clearLongPressTimer}
      onPointerDown={handlePointerDown}
      onPointerLeave={clearLongPressTimer}
      onPointerMove={clearLongPressTimer}
      onPointerUp={clearLongPressTimer}
      tabIndex={0}
      title="Tap to inspect, long press to select"
      style={{ borderColor: rarityColor }}
    >
      {bulkSelectMode || isSelected ? (
        <input
          aria-label={`Select ${item.weapon} ${item.finish}`}
          checked={isSelected}
          className="absolute left-3 top-3 z-10 h-5 w-5 accent-rarity-special"
          onChange={() => undefined}
          onClick={handleSelectionClick}
          type="checkbox"
        />
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <div className="flex gap-1">
          {isDuplicateSkin ? (
            <span
              className="grid h-8 place-items-center border border-rarity-special bg-rarity-special/10 px-2 font-mono text-[10px] uppercase text-rarity-special"
              title="This skin has duplicate inventory copies"
            >
              Dupe
            </span>
          ) : null}
          <button
            aria-label={item.isLocked ? 'Unlock item' : 'Lock item'}
            className="grid h-7 w-7 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
            onClick={handleLockClick}
            title={item.isLocked ? 'Unlock item' : 'Lock item'}
            type="button"
          >
            {item.isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
          </button>
          <button
            aria-label={item.isFavorited ? 'Remove favorite' : 'Favorite item'}
            className={[
              'grid h-7 w-7 place-items-center border border-cs-border transition-colors hover:text-rarity-special',
              item.isFavorited ? 'text-rarity-special' : 'text-cs-muted',
            ].join(' ')}
            onClick={handleFavoriteClick}
            title={item.isFavorited ? 'Remove favorite' : 'Favorite item'}
            type="button"
          >
            <Star fill={item.isFavorited ? 'currentColor' : 'none'} size={14} />
          </button>
        </div>
      </div>

      <div
        className={`mt-2 grid h-24 place-items-center border bg-cs-surface sm:h-28 xl:h-32 ${styles.border}`}
        style={{
          borderColor: rarityColor,
        }}
      >
        <AssetImage
          alt=""
          className="h-16 w-16 object-contain opacity-90 sm:h-20 sm:w-20"
          draggable={false}
          src={item.image}
        />
      </div>

      <div className="mt-2 min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-cs-text">
          {item.weapon} | {item.finish}
        </h3>
        <p className="mt-1 font-mono text-xs uppercase text-cs-muted">
          {getSkinRarityLabel(item)}
        </p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="border border-cs-border bg-cs-surface px-2 py-1.5">
          <dt className="font-mono text-[10px] uppercase text-cs-muted">Wear</dt>
          <dd className="mt-1 truncate text-cs-text">{getWearLabel(item.wear)}</dd>
        </div>
        <div className="border border-cs-border bg-cs-surface px-2 py-1.5">
          <dt className="font-mono text-[10px] uppercase text-cs-muted">Float</dt>
          <dd className="mt-1 font-mono text-cs-text">{item.floatValue.toFixed(6)}</dd>
        </div>
      </dl>

      <div className="mt-2 border border-cs-border bg-cs-surface px-2 py-1.5">
        <p className="font-mono text-[10px] uppercase text-cs-muted">Market Value</p>
        <p className="mt-1 text-base font-semibold text-cs-green">{formatCurrency(item.marketValue)}</p>
      </div>
    </article>
  )
})
