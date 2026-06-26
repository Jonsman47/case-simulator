import { memo, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { POOP_CLEANUP_REWARD } from '../utils/poopCleanupMinigame'
import { formatCurrency } from '../utils/format'

const pileIds = ['left', 'center', 'right'] as const

interface PoopCleanupMinigameProps {
  onClose: () => void
  onComplete: () => void
}

export const PoopCleanupMinigame = memo(function PoopCleanupMinigame({
  onClose,
  onComplete,
}: PoopCleanupMinigameProps) {
  const [cleanedPileIds, setCleanedPileIds] = useState<Set<string>>(() => new Set())
  const completedRef = useRef(false)
  const cleanedCount = cleanedPileIds.size
  const progressLabel = useMemo(() => `${cleanedCount} / ${pileIds.length}`, [cleanedCount])

  function cleanPile(pileId: string) {
    setCleanedPileIds((currentPileIds) => {
      if (currentPileIds.has(pileId) || completedRef.current) {
        return currentPileIds
      }

      const nextPileIds = new Set(currentPileIds)

      nextPileIds.add(pileId)

      if (nextPileIds.size === pileIds.length) {
        completedRef.current = true
        window.setTimeout(onComplete, 220)
      }

      return nextPileIds
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm">
      <section
        aria-label="A Clean Pooping Job minigame"
        aria-modal="true"
        className="w-full max-w-2xl border border-cs-border bg-cs-surface p-4 text-cs-text shadow-glow sm:p-5"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-cs-green">Minigame</p>
            <h2 className="mt-1 text-xl font-semibold">A Clean Pooping Job</h2>
            <p className="mt-2 text-sm text-cs-muted">
              Clean all three piles for {formatCurrency(POOP_CLEANUP_REWARD)}.
            </p>
          </div>
          <button
            aria-label="Close minigame"
            className="grid h-10 w-10 shrink-0 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 overflow-hidden border border-cs-border bg-cs-bg p-4">
          <div
            aria-label="Cleanup field"
            className="relative grid min-h-72 grid-cols-3 items-end gap-3 bg-[radial-gradient(circle_at_50%_25%,rgb(42_52_70_/_0.55),transparent_52%)] px-2 pb-5 pt-8"
          >
            {pileIds.map((pileId, index) => {
              const isCleaned = cleanedPileIds.has(pileId)

              return (
                <button
                  aria-label={`Clean pile ${index + 1}`}
                  className={[
                    'group mx-auto grid h-24 w-24 place-items-center border transition-all duration-200 sm:h-28 sm:w-28',
                    isCleaned
                      ? 'pointer-events-none scale-75 border-cs-green/40 bg-cs-green/5 opacity-0'
                      : 'border-cs-border bg-cs-panel hover:-translate-y-1 hover:border-cs-green hover:bg-cs-green/10',
                  ].join(' ')}
                  disabled={isCleaned}
                  key={pileId}
                  onClick={() => cleanPile(pileId)}
                  type="button"
                >
                  <PoopPileIcon />
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border border-cs-border bg-cs-panel px-3 py-2">
          <span className="font-mono text-xs uppercase text-cs-muted">Cleaned</span>
          <span className="font-mono text-sm font-semibold text-cs-green">{progressLabel}</span>
        </div>
      </section>
    </div>
  )
})

function PoopPileIcon() {
  return (
    <span aria-hidden="true" className="relative block h-14 w-16">
      <span className="absolute bottom-0 left-1/2 h-7 w-14 -translate-x-1/2 rounded-full bg-[#6b3b1f] shadow-[inset_0_-6px_0_rgb(51_28_15_/_0.55)]" />
      <span className="absolute bottom-5 left-1/2 h-6 w-11 -translate-x-1/2 rounded-full bg-[#7a4628] shadow-[inset_0_-5px_0_rgb(66_35_18_/_0.5)]" />
      <span className="absolute bottom-9 left-1/2 h-5 w-7 -translate-x-1/2 rounded-full bg-[#8a5431] shadow-[inset_0_-4px_0_rgb(66_35_18_/_0.42)]" />
    </span>
  )
}
