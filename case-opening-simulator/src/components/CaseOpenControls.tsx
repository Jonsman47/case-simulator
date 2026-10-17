import { Lock, PackageOpen } from 'lucide-react'
import { memo, useState } from 'react'
import type { CaseDefinition } from '../data/models'
import { formatCurrency } from '../utils/format'

const batchStep = 10
const maximumDisplayedBatch = 100

export interface CaseOpenOptions {
  skipAnimations: boolean
}

export interface CaseOpenControlsProps {
  canOpen: boolean
  caseDef: CaseDefinition
  maxQuantity?: number
  money: number
  onOpen: (quantity: number, options: CaseOpenOptions) => void
  requiresLicense?: boolean
}

export const CaseOpenControls = memo(function CaseOpenControls({
  canOpen,
  caseDef,
  maxQuantity = 10,
  money,
  onOpen,
  requiresLicense = false,
}: CaseOpenControlsProps) {
  const [skipAnimations, setSkipAnimations] = useState(false)
  const affordableCount = Math.floor(money / caseDef.cost)
  const canAffordAny = affordableCount > 0
  // Batch buttons expand with upgrades/skills while staying hidden for new players,
  // so Open 100 only appears after progression has explicitly earned it.
  const normalizedMaxQuantity = Math.max(batchStep, Math.min(maximumDisplayedBatch, Math.floor(maxQuantity)))
  const batchQuantities = Array.from(
    { length: Math.floor(normalizedMaxQuantity / batchStep) },
    (_, index) => (index + 1) * batchStep,
  )
  // Small batches are always available so the adaptive 2/3/5 presentation can
  // be used directly; progression continues to control the 10+ batch ceiling.
  const openQuantities = [1, 2, 3, 5, ...batchQuantities]

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
        {openQuantities.map((quantity) => {
          const totalCost = caseDef.cost * quantity
          const canAffordQuantity = money >= totalCost
          const disabled = (!canOpen && !requiresLicense) || !canAffordQuantity

          return (
            <button
              className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition hover:-translate-y-px hover:bg-rarity-special/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rarity-special active:translate-y-0 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={disabled}
              key={quantity}
              onClick={() => onOpen(quantity, { skipAnimations: quantity >= 10 && skipAnimations })}
              title={disabled && (canOpen || requiresLicense) ? `Need ${formatCurrency(totalCost)}` : undefined}
              type="button"
            >
              {disabled || requiresLicense ? <Lock className="shrink-0" size={16} /> : <PackageOpen className="shrink-0" size={16} />}
              Open {quantity}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-cs-muted">
          <input
            checked={skipAnimations}
            className="h-4 w-4 accent-rarity-special"
            onChange={(event) => setSkipAnimations(event.target.checked)}
            type="checkbox"
          />
          Skip Animations
        </label>
        {requiresLicense ? (
          <p className="border border-cs-border bg-cs-surface px-3 py-2 text-sm text-cs-muted">
            License required
          </p>
        ) : !canOpen ? (
          <p className="border border-cs-border bg-cs-surface px-3 py-2 text-sm text-cs-muted">
            Case unavailable
          </p>
        ) : !canAffordAny ? (
          <p className="border border-cs-border bg-cs-surface px-3 py-2 text-sm text-cs-muted">
            Need {formatCurrency(caseDef.cost)}
          </p>
        ) : (
          <p className="font-mono text-xs uppercase text-cs-muted">
            Can open {affordableCount.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
})
