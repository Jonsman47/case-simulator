import { AlertTriangle, CircleDollarSign, X } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency } from '../utils/format'

export function BulkActionsToolbar({
  lockedSelectedCount,
  onClearSelection,
  onSellSelected,
  selectedCount,
  selectedValue,
  sellableCount,
}: {
  lockedSelectedCount: number
  onClearSelection: () => void
  onSellSelected: () => void
  selectedCount: number
  selectedValue: number
  sellableCount: number
}) {
  const [isConfirming, setIsConfirming] = useState(false)
  const hasSellableItems = sellableCount > 0

  function confirmSale() {
    onSellSelected()
    setIsConfirming(false)
  }

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-40 flex flex-col gap-3 border border-rarity-special bg-cs-surface p-3 shadow-glow sm:sticky sm:inset-x-auto sm:top-3 sm:bottom-auto lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-sm uppercase text-rarity-special">
            {selectedCount} selected
          </p>
          <p className="mt-1 text-sm text-cs-muted">
            Sale value:{' '}
            <span className="font-semibold text-cs-green">{formatCurrency(selectedValue)}</span>
          </p>
          {lockedSelectedCount > 0 ? (
            <p className="mt-1 inline-flex items-center gap-2 text-xs text-cs-muted">
              <AlertTriangle size={14} />
              {lockedSelectedCount} locked item{lockedSelectedCount === 1 ? '' : 's'} will remain.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text"
            onClick={onClearSelection}
            type="button"
          >
            <X size={16} />
            Clear
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-covert bg-rarity-covert/10 px-4 py-2 text-sm font-semibold text-rarity-covert transition-colors hover:bg-rarity-covert/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted disabled:opacity-60"
            disabled={!hasSellableItems}
            onClick={() => setIsConfirming(true)}
            type="button"
          >
            <CircleDollarSign size={16} />
            Sell Selected
          </button>
        </div>
      </div>

      {isConfirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-0 backdrop-blur-sm sm:p-4">
          <section
            aria-label="Confirm bulk sale"
            aria-modal="true"
            className="flex min-h-dvh w-full max-w-none flex-col justify-center border border-rarity-covert bg-cs-surface p-5 shadow-glow sm:min-h-0 sm:max-w-md"
            role="dialog"
          >
            <h3 className="text-xl font-semibold text-cs-text">Sell Selected Items?</h3>
            <p className="mt-3 text-sm text-cs-muted">
              Sell {sellableCount} unlocked item{sellableCount === 1 ? '' : 's'} for{' '}
              <span className="font-semibold text-cs-green">{formatCurrency(selectedValue)}</span>.
            </p>
            {lockedSelectedCount > 0 ? (
              <p className="mt-2 text-sm text-cs-muted">
                {lockedSelectedCount} locked item{lockedSelectedCount === 1 ? '' : 's'} will be skipped.
              </p>
            ) : null}
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button
                className="min-h-11 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text"
                onClick={() => setIsConfirming(false)}
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
          </section>
        </div>
      ) : null}
    </>
  )
}
