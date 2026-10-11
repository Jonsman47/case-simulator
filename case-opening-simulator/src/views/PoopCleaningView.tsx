import { useEffect, useState } from 'react'
import { PlaceholderView } from '../components/PlaceholderView'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import {
  formatPoopCleanupCooldown,
  getPoopCleanupCooldownRemaining,
  POOP_CLEANUP_REWARD,
  writePoopCleanupLastCompleted,
} from '../utils/poopCleanupMinigame'

const pileIds = ['left', 'center', 'right'] as const
const emptyPileIds = new Set<string>()
const pilePositions = [
  { left: '17%', top: '58%' },
  { left: '52%', top: '34%' },
  { left: '78%', top: '63%' },
] as const

export function PoopCleaningView() {
  const { dispatch, state } = useGame()
  const [now, setNow] = useState(() => Date.now())
  const [cleaningRound, setCleaningRound] = useState(() => ({
    cleanedPileIds: new Set<string>(),
    startedAfter: state.lastPoopCleaningAt,
  }))
  const [successMessage, setSuccessMessage] = useState<string | undefined>()
  const cooldownRemaining = getPoopCleanupCooldownRemaining(now, state.lastPoopCleaningAt)
  const isOnCooldown = cooldownRemaining > 0
  const cleanedPileIds = cleaningRound.startedAfter === state.lastPoopCleaningAt
    ? cleaningRound.cleanedPileIds
    : emptyPileIds
  const progressLabel = `${cleanedPileIds.size} / ${pileIds.length}`

  useEffect(() => {
    if (!isOnCooldown) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isOnCooldown])

  function cleanPile(pileId: string) {
    if (isOnCooldown || cleanedPileIds.has(pileId)) {
      return
    }

    const nextPileIds = new Set(cleanedPileIds)
    nextPileIds.add(pileId)
    setCleaningRound({
      cleanedPileIds: nextPileIds,
      startedAfter: state.lastPoopCleaningAt,
    })

    if (nextPileIds.size === pileIds.length) {
      const completedAt = getCurrentTimestamp()

      writePoopCleanupLastCompleted(completedAt)
      setNow(completedAt)
      setSuccessMessage('Poop cleaned. +$10')
      dispatch({ type: 'COMPLETE_POOP_CLEANING', now: completedAt })
    }
  }

  return (
    <PlaceholderView accent="industrial" title="Poop Cleaning">
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <section className="border border-cs-border bg-cs-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-cs-green">Emergency Cash</p>
              <h2 className="mt-1 text-xl font-semibold text-cs-text">Poop Cleaning</h2>
            </div>
            <div className="border border-cs-border bg-cs-panel px-3 py-2 text-right">
              <p className="font-mono text-[10px] uppercase text-cs-muted">Reward</p>
              <p className="mt-1 font-mono text-sm font-semibold text-cs-green">
                +{formatCurrency(POOP_CLEANUP_REWARD)}
              </p>
            </div>
          </div>

          {isOnCooldown ? (
            <div className="mt-4 border border-cs-border bg-cs-panel px-4 py-6 text-center">
              <p className="text-sm font-semibold text-cs-text">
                Come back in {formatPoopCleanupCooldown(cooldownRemaining)} to clean more poop.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 overflow-hidden border border-cs-border bg-cs-bg p-3">
                <div
                  aria-label="Poop cleaning grass field"
                  className="relative h-72 overflow-hidden border border-cs-border bg-[linear-gradient(135deg,rgb(44_122_72)_0_25%,rgb(35_104_64)_25%_50%,rgb(44_122_72)_50%_75%,rgb(35_104_64)_75%)] bg-[length:46px_46px]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255_/_0.12),transparent_18%),radial-gradient(circle_at_74%_74%,rgb(0_0_0_/_0.12),transparent_22%)]" />
                  {pileIds.map((pileId, index) => {
                    const isCleaned = cleanedPileIds.has(pileId)

                    return (
                      <button
                        aria-label={`Clean poop ${index + 1}`}
                        className={[
                          'absolute grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center border transition-all duration-200',
                          isCleaned
                            ? 'pointer-events-none scale-50 border-cs-green/30 bg-cs-green/10 opacity-0'
                            : 'border-cs-border bg-cs-panel/95 shadow-glow hover:-translate-y-[calc(50%+0.25rem)] hover:border-cs-green hover:bg-cs-green/15',
                        ].join(' ')}
                        disabled={isCleaned}
                        key={pileId}
                        onClick={() => cleanPile(pileId)}
                        style={pilePositions[index]}
                        type="button"
                      >
                        <PoopPileIcon />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border border-cs-border bg-cs-panel px-3 py-2">
                <span className="font-mono text-xs uppercase text-cs-muted">Cleaned</span>
                <span className="font-mono text-sm font-semibold text-cs-green">{progressLabel}</span>
              </div>
            </>
          )}

          {successMessage ? (
            <p className="mt-3 border border-cs-green bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green">
              {successMessage}
            </p>
          ) : null}
        </section>
      </div>
    </PlaceholderView>
  )
}

function getCurrentTimestamp() {
  return Date.now()
}

function PoopPileIcon() {
  return (
    <span aria-hidden="true" className="relative block h-12 w-14">
      <span className="absolute bottom-0 left-1/2 h-6 w-12 -translate-x-1/2 rounded-full bg-[#6b3b1f] shadow-[inset_0_-5px_0_rgb(51_28_15_/_0.55)]" />
      <span className="absolute bottom-4 left-1/2 h-6 w-10 -translate-x-1/2 rounded-full bg-[#7a4628] shadow-[inset_0_-5px_0_rgb(66_35_18_/_0.5)]" />
      <span className="absolute bottom-8 left-1/2 h-5 w-7 -translate-x-1/2 rounded-full bg-[#8a5431] shadow-[inset_0_-4px_0_rgb(66_35_18_/_0.42)]" />
    </span>
  )
}
