import { ChevronLeft, ChevronRight, Lock, LockOpen, Star, Trophy, X } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Rarity, type SkinInstance, type TrophySlotId } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import type { MarketPriceHistory } from '../market/marketSimulation'
import { formatCurrency } from '../utils/format'
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import { TROPHY_SLOT_DEFINITIONS } from '../utils/trophyRoom'
import { AssetImage } from './AssetImage'
import { PriceChart } from './PriceChart'

export interface ItemDetailModalProps {
  item: SkinInstance | undefined
  items?: SkinInstance[]
  isOwned?: boolean
  onAddToTrophyRoom?: (itemId: string, slotId: TrophySlotId) => void
  onClose: () => void
  onItemChange?: (item: SkinInstance) => void
  onSell: (itemId: string) => void
  onToggleFavorite: (itemId: string) => void
  onToggleLock: (itemId: string) => void
  marketHistory?: MarketPriceHistory
  saleValue: number | undefined
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const rarityStyles: Record<
  Rarity,
  {
    border: string
    chart: string
    glow: string
    label: string
    text: string
    tint: string
  }
> = {
  [Rarity.Consumer]: {
    border: 'border-rarity-consumer',
    chart: '#9ca3af',
    glow: 'rgba(156, 163, 175, 0.24)',
    label: 'border-rarity-consumer bg-rarity-consumer/10 text-rarity-consumer',
    text: 'text-rarity-consumer',
    tint: 'bg-rarity-consumer/10',
  },
  [Rarity.Industrial]: {
    border: 'border-rarity-industrial',
    chart: '#5e98d9',
    glow: 'rgba(94, 152, 217, 0.28)',
    label: 'border-rarity-industrial bg-rarity-industrial/10 text-rarity-industrial',
    text: 'text-rarity-industrial',
    tint: 'bg-rarity-industrial/10',
  },
  [Rarity.MilSpec]: {
    border: 'border-rarity-mil-spec',
    chart: '#4b69ff',
    glow: 'rgba(75, 105, 255, 0.3)',
    label: 'border-rarity-mil-spec bg-rarity-mil-spec/10 text-rarity-mil-spec',
    text: 'text-rarity-mil-spec',
    tint: 'bg-rarity-mil-spec/10',
  },
  [Rarity.Restricted]: {
    border: 'border-rarity-restricted',
    chart: '#8847ff',
    glow: 'rgba(136, 71, 255, 0.3)',
    label: 'border-rarity-restricted bg-rarity-restricted/10 text-rarity-restricted',
    text: 'text-rarity-restricted',
    tint: 'bg-rarity-restricted/10',
  },
  [Rarity.Classified]: {
    border: 'border-rarity-classified',
    chart: '#d32ce6',
    glow: 'rgba(211, 44, 230, 0.32)',
    label: 'border-rarity-classified bg-rarity-classified/10 text-rarity-classified',
    text: 'text-rarity-classified',
    tint: 'bg-rarity-classified/10',
  },
  [Rarity.Covert]: {
    border: 'border-rarity-covert',
    chart: '#eb4b4b',
    glow: 'rgba(235, 75, 75, 0.32)',
    label: 'border-rarity-covert bg-rarity-covert/10 text-rarity-covert',
    text: 'text-rarity-covert',
    tint: 'bg-rarity-covert/10',
  },
  [Rarity.SpecialItem]: {
    border: 'border-rarity-special',
    chart: '#ffd700',
    glow: 'rgba(255, 215, 0, 0.32)',
    label: 'border-rarity-special bg-rarity-special/10 text-rarity-special',
    text: 'text-rarity-special',
    tint: 'bg-rarity-special/10',
  },
  [Rarity.Contraband]: {
    border: 'border-rarity-contraband',
    chart: '#e4ae39',
    glow: 'rgba(228, 174, 57, 0.34)',
    label: 'border-rarity-contraband bg-rarity-contraband/10 text-rarity-contraband',
    text: 'text-rarity-contraband',
    tint: 'bg-rarity-contraband/10',
  },
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    return element.getAttribute('aria-hidden') !== 'true'
  })
}

function isFormControl(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  )
}

function getAdjacentItem(
  items: SkinInstance[] | undefined,
  activeItemId: string,
  direction: -1 | 1,
) {
  if (!items || items.length < 2) {
    return undefined
  }

  const activeIndex = items.findIndex((listItem) => listItem.instanceId === activeItemId)

  if (activeIndex < 0) {
    return undefined
  }

  const nextIndex = (activeIndex + direction + items.length) % items.length

  return items[nextIndex]
}

export function ItemDetailModal({
  item,
  items,
  isOwned = true,
  onAddToTrophyRoom,
  onClose,
  onItemChange,
  onSell,
  onToggleFavorite,
  onToggleLock,
  marketHistory = {},
  saleValue,
}: ItemDetailModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const modalRef = useRef<HTMLElement | null>(null)
  const pinchDistanceRef = useRef<number | undefined>(undefined)
  const previousFocusRef = useRef<Element | null>(null)
  const [confirmingSaleForItemId, setConfirmingSaleForItemId] = useState<string | undefined>()
  const [imageZoom, setImageZoom] = useState<{ itemId: string; scale: number } | undefined>()
  const [isTrophySelectorOpen, setIsTrophySelectorOpen] = useState(false)
  const [selectedTrophySlot, setSelectedTrophySlot] = useState<TrophySlotId>(
    TROPHY_SLOT_DEFINITIONS[0].id,
  )

  const currentSaleValue = item ? saleValue ?? item.marketValue : 0
  const imageScale = imageZoom && imageZoom.itemId === item?.instanceId ? imageZoom.scale : 1
  const styles = item ? rarityStyles[item.rarity] : rarityStyles[Rarity.Consumer]
  const rarityColor = item ? getSkinRarityColor(item) : styles.chart
  const canMoveBetweenItems = Boolean(items && items.length > 1 && onItemChange)

  useEffect(() => {
    if (!item || !modalRef.current) {
      return undefined
    }

    previousFocusRef.current = document.activeElement
    const focusableElements = getFocusableElements(modalRef.current)
    const firstFocusable = focusableElements[0]

    if (firstFocusable) {
      firstFocusable.focus()
    } else {
      modalRef.current.focus()
    }

    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [item])

  useEffect(() => {
    if (!item) {
      return undefined
    }

    const activeItem = item

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (isFormControl(event.target)) {
          return
        }

        const nextItem = getAdjacentItem(
          items,
          activeItem.instanceId,
          event.key === 'ArrowLeft' ? -1 : 1,
        )

        if (nextItem && onItemChange) {
          event.preventDefault()
          setConfirmingSaleForItemId(undefined)
          setIsTrophySelectorOpen(false)
          onItemChange(nextItem)
        }
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = getFocusableElements(modalRef.current)

        if (focusableElements.length === 0) {
          event.preventDefault()
          modalRef.current.focus()
          return
        }

        const firstFocusable = focusableElements[0]
        const lastFocusable = focusableElements[focusableElements.length - 1]

        if (event.shiftKey && document.activeElement === firstFocusable) {
          event.preventDefault()
          lastFocusable.focus()
        } else if (!event.shiftKey && document.activeElement === lastFocusable) {
          event.preventDefault()
          firstFocusable.focus()
        }
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [item, items, onClose, onItemChange])

  if (!item) {
    return null
  }

  const selectedItem = item
  const canUseItemActions = isOwned
  const isConfirmingSale = confirmingSaleForItemId === selectedItem.instanceId
  const lockedSaleTooltip = isOwned
    ? 'Locked items cannot be sold unless unlocked.'
    : 'Sold items are kept here as recent drop history.'

  function closeModal() {
    setConfirmingSaleForItemId(undefined)
    setIsTrophySelectorOpen(false)
    onClose()
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeModal()
    }
  }

  function handleModalKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' && event.target === event.currentTarget) {
      event.preventDefault()
    }
  }

  function handleImageTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) {
      return
    }

    const firstTouch = event.touches[0]
    const secondTouch = event.touches[1]

    pinchDistanceRef.current = Math.hypot(
      firstTouch.clientX - secondTouch.clientX,
      firstTouch.clientY - secondTouch.clientY,
    )
  }

  function handleImageTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2 || !pinchDistanceRef.current) {
      return
    }

    event.preventDefault()

    const firstTouch = event.touches[0]
    const secondTouch = event.touches[1]
    const nextDistance = Math.hypot(
      firstTouch.clientX - secondTouch.clientX,
      firstTouch.clientY - secondTouch.clientY,
    )
    const scaleChange = nextDistance / pinchDistanceRef.current

    pinchDistanceRef.current = nextDistance
    setImageZoom((currentZoom) => {
      const activeItemId = item?.instanceId

      if (!activeItemId) {
        return currentZoom
      }

      const currentScale = currentZoom?.itemId === activeItemId ? currentZoom.scale : 1

      return {
        itemId: activeItemId,
        scale: Math.min(2.4, Math.max(1, currentScale * scaleChange)),
      }
    })
  }

  function handleImageTouchEnd() {
    pinchDistanceRef.current = undefined
  }

  function confirmSale() {
    if (!canUseItemActions) {
      return
    }

    onSell(selectedItem.instanceId)
    closeModal()
  }

  function assignTrophySlot() {
    if (!canUseItemActions) {
      return
    }

    onAddToTrophyRoom?.(selectedItem.instanceId, selectedTrophySlot)
    setIsTrophySelectorOpen(false)
  }

  return (
    <div
      aria-label="Item details overlay"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:p-4"
      data-testid="item-detail-backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        aria-describedby={descriptionId}
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'relative min-h-dvh w-full max-w-none overflow-y-auto border bg-cs-surface p-4 text-cs-text outline-none sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:p-6',
          styles.border,
        ].join(' ')}
        onKeyDown={handleModalKeyDown}
        ref={modalRef}
        role="dialog"
        style={{ boxShadow: `0 0 42px ${rarityColor}55` }}
        tabIndex={-1}
      >
        <div className={`absolute left-0 top-0 h-1 w-full ${styles.tint}`} aria-hidden="true" />
        <div className={`absolute bottom-0 left-0 h-1 w-full ${styles.tint}`} aria-hidden="true" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`border px-2 py-1 font-mono text-xs uppercase ${styles.label}`}
                style={{
                  backgroundColor: `${rarityColor}1a`,
                  borderColor: rarityColor,
                  color: rarityColor,
                }}
              >
                {getSkinRarityLabel(item)}
              </span>
              {item.statTrak ? (
                <span className="border border-cs-amber bg-cs-amber/10 px-2 py-1 font-mono text-xs uppercase text-cs-amber">
                  StatTrak
                </span>
              ) : null}
              {item.souvenir ? (
                <span className="border border-cs-green bg-cs-green/10 px-2 py-1 font-mono text-xs uppercase text-cs-green">
                  Souvenir
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 truncate text-2xl font-semibold text-cs-text sm:text-3xl" id={titleId}>
              {item.weapon} | {item.finish}
            </h2>
            <p className="mt-1 font-mono text-xs uppercase text-cs-muted" id={descriptionId}>
              Instance {item.instanceId}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canMoveBetweenItems ? (
              <>
                <button
                  aria-label="Previous inventory item"
                  className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
                  onClick={() => {
                    const nextItem = getAdjacentItem(items, item.instanceId, -1)

                    if (nextItem && onItemChange) {
                      onItemChange(nextItem)
                    }
                  }}
                  title="Previous item"
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  aria-label="Next inventory item"
                  className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
                  onClick={() => {
                    const nextItem = getAdjacentItem(items, item.instanceId, 1)

                    if (nextItem && onItemChange) {
                      onItemChange(nextItem)
                    }
                  }}
                  title="Next item"
                  type="button"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            ) : null}
            <button
              aria-label="Close item details"
              className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
              onClick={closeModal}
              title="Close"
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <div
              className={`grid aspect-[16/10] touch-none place-items-center overflow-hidden border ${styles.border} ${styles.tint}`}
              data-swipe-ignore="true"
              onTouchCancel={handleImageTouchEnd}
              onTouchEnd={handleImageTouchEnd}
              onTouchMove={handleImageTouchMove}
              onTouchStart={handleImageTouchStart}
            >
              <AssetImage
                alt={`${item.weapon} ${item.finish}`}
                className="h-48 w-48 object-contain opacity-95 transition-transform sm:h-64 sm:w-64"
                draggable={false}
                src={item.image}
                style={{ transform: `scale(${imageScale})` }}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailStat label="Wear Condition" value={getWearLabel(item.wear)} />
              <DetailStat label="Float Value" value={item.floatValue.toFixed(3)} />
              <DetailStat
                label="Current Market Value"
                tone="green"
                value={formatCurrency(currentSaleValue)}
              />
              <DetailStat label="Base Value" value={formatCurrency(item.baseValue)} />
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <PriceChart
              accentColor={rarityColor}
              history={marketHistory}
              skinId={item.id}
              title="Price History"
            />

            <div className="border border-cs-border bg-cs-panel p-4">
              <h3 className="text-lg font-semibold text-cs-text">Actions</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  aria-label={item.isLocked ? 'Unlock item' : 'Lock item'}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUseItemActions}
                  onClick={() => onToggleLock(item.instanceId)}
                  type="button"
                >
                  {item.isLocked ? <LockOpen size={16} /> : <Lock size={16} />}
                  {item.isLocked ? 'Unlock' : 'Lock'}
                </button>
                <button
                  aria-label={item.isFavorited ? 'Unfavorite item' : 'Favorite item'}
                  className={[
                    'inline-flex min-h-11 items-center justify-center gap-2 border border-cs-border px-3 py-2 text-sm font-medium transition-colors hover:text-rarity-special disabled:cursor-not-allowed disabled:opacity-50',
                    item.isFavorited ? 'text-rarity-special' : 'text-cs-muted',
                  ].join(' ')}
                  disabled={!canUseItemActions}
                  onClick={() => onToggleFavorite(item.instanceId)}
                  type="button"
                >
                  <Star fill={item.isFavorited ? 'currentColor' : 'none'} size={16} />
                  {item.isFavorited ? 'Unfavorite' : 'Favorite'}
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special px-3 py-2 text-sm font-medium text-rarity-special transition-colors hover:bg-rarity-special/10 disabled:cursor-not-allowed disabled:border-cs-border disabled:text-cs-muted disabled:opacity-50"
                  disabled={!canUseItemActions}
                  onClick={() => setIsTrophySelectorOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <Trophy size={16} />
                  Add to Trophy Room
                </button>
                <span className="group relative">
                  <button
                    aria-describedby={item.isLocked || !isOwned ? 'locked-sale-tooltip' : undefined}
                    className="min-h-11 w-full border border-rarity-covert px-3 py-2 text-sm font-semibold text-rarity-covert transition-colors hover:bg-rarity-covert/10 disabled:cursor-not-allowed disabled:border-cs-border disabled:text-cs-muted disabled:opacity-60"
                    disabled={item.isLocked || !canUseItemActions}
                    onClick={() => setConfirmingSaleForItemId(item.instanceId)}
                    type="button"
                  >
                    Sell
                  </button>
                  {item.isLocked || !isOwned ? (
                    <span
                      className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-64 border border-cs-border bg-cs-bg px-3 py-2 text-xs text-cs-muted shadow-glow group-hover:block"
                      id="locked-sale-tooltip"
                      role="tooltip"
                    >
                      {lockedSaleTooltip}
                    </span>
                  ) : null}
                </span>
              </div>

              {isTrophySelectorOpen ? (
                <div className="mt-4 border border-rarity-special bg-cs-surface p-3">
                  <label className="block text-sm text-cs-muted">
                    Trophy slot
                    <select
                      className="mt-2 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
                      onChange={(event) => setSelectedTrophySlot(event.target.value as TrophySlotId)}
                      value={selectedTrophySlot}
                    >
                      {TROPHY_SLOT_DEFINITIONS.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="mt-3 min-h-11 w-full border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
                    onClick={assignTrophySlot}
                    type="button"
                  >
                    Assign Slot
                  </button>
                </div>
              ) : null}

              {isConfirmingSale ? (
                <div
                  aria-label="Confirm sale"
                  className="mt-4 border border-rarity-covert bg-cs-surface p-4"
                  role="dialog"
                >
                  <p className="text-sm text-cs-muted">
                    Sell this item for{' '}
                    <span className="font-semibold text-cs-green">{formatCurrency(currentSaleValue)}</span>?
                  </p>
                  <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
                    <button
                      className="min-h-11 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text"
                      onClick={() => setConfirmingSaleForItemId(undefined)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="min-h-11 border border-rarity-covert bg-rarity-covert/10 px-3 py-2 text-sm font-semibold text-rarity-covert transition-colors hover:bg-rarity-covert/20"
                      onClick={confirmSale}
                      type="button"
                    >
                      Confirm Sale
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function DetailStat({
  label,
  tone = 'default',
  value,
}: {
  label: string
  tone?: 'default' | 'green'
  value: string
}) {
  return (
    <dl className="border border-cs-border bg-cs-panel px-3 py-2">
      <dt className="font-mono text-xs uppercase text-cs-muted">{label}</dt>
      <dd className={['mt-1 font-mono text-lg', tone === 'green' ? 'text-cs-green' : 'text-cs-text'].join(' ')}>
        {value}
      </dd>
    </dl>
  )
}
