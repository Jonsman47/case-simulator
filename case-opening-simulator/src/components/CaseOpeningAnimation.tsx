import { FastForward, PackageOpen, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { AnimationSpeed } from '../data/gameState'
import { Rarity, type SkinBase, type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { formatCurrency } from '../utils/format'
import { getSkinRarityLabel } from '../utils/itemLabels'
import {
  isPremiumRevealDrop,
  openingRarityRank,
  type WeightedSkinOption,
} from '../utils/openingAnimation'
import { CASE_OPENING_SOUND_SRC } from '../utils/soundManifest'
import { AssetImage } from './AssetImage'
import { PatternBadge } from './PatternInfo'

export interface CaseOpeningAnimationProps {
  caseImage?: string
  caseName?: string
  finalItem: SkinInstance
  finalItems?: SkinInstance[]
  firstCaseHook?: 'nearMissGold' | 'forcedGold'
  onComplete: (item: SkinInstance) => void
  potentialSkins: WeightedSkinOption[]
  soundEnabled?: boolean
  speed?: AnimationSpeed
  speedBonus?: number
  startSkipped?: boolean
}

type ReelPhase = 'ready' | 'spinning' | 'quickReveal' | 'revealed'

interface ReelItem {
  isFinal: boolean
  isSuspensePlaceholder?: boolean
  key: string
  skin: SkinBase
}

interface OpeningReel {
  item: SkinInstance
  reelItems: ReelItem[]
}

interface ReelLayout {
  afterCount: number
  cardWidthRem: number
  fillerCount: number
  slotPitchRem: number
  startIndex: number
  targetIndex: number
}

const normalRevealHoldMs = 650
const quickRevealDurationMs = 420
const audioRollStartMs = 1250
const audioRevealAtMs = 8000
const normalRollDurationMs = audioRevealAtMs - audioRollStartMs
const maxAnimatedBatchItems = 120
const placeholderCaseImage = '/assets/placeholder.png'
const rareSpecialSuspenseImage = '/assets/GOLDGOLDGOLD.png'
const preRevealAccentColor = 'rgb(var(--rarity-special))'

function getReelLayout(batchSize: number): ReelLayout {
  if (batchSize > 25) {
    // High-volume opens use tiny cards, but every lane still needs a real tail after
    // the target card. Without the extra cards, the ticker can reveal the dark stage
    // before the final item lands under the center marker.
    return {
      afterCount: 12,
      cardWidthRem: 3.3,
      fillerCount: 40,
      slotPitchRem: 3.8,
      startIndex: 3,
      targetIndex: 18,
    }
  }

  if (batchSize > 10) {
    // Multi-open reels still need enough offscreen cards to keep every lane filled
    // during deceleration; this keeps the CS-style ticker continuous instead of
    // ending on a blank panel.
    return {
      afterCount: 20,
      cardWidthRem: 5.25,
      fillerCount: 60,
      slotPitchRem: 5.75,
      startIndex: 5,
      targetIndex: 28,
    }
  }

  if (batchSize > 6) {
    return { afterCount: 20, cardWidthRem: 7.25, fillerCount: 60, slotPitchRem: 7.75, startIndex: 5, targetIndex: 28 }
  }

  if (batchSize > 3) {
    return { afterCount: 20, cardWidthRem: 8, fillerCount: 60, slotPitchRem: 8.5, startIndex: 5, targetIndex: 28 }
  }

  if (batchSize > 1) {
    return { afterCount: 20, cardWidthRem: 9.5, fillerCount: 60, slotPitchRem: 10, startIndex: 5, targetIndex: 28 }
  }

  return {
    afterCount: 30,
    cardWidthRem: 8,
    fillerCount: 96,
    slotPitchRem: 8.75,
    startIndex: 8,
    targetIndex: 56,
  }
}

function getPrimaryItem(items: SkinInstance[]) {
  let bestItem = items[0]

  for (const item of items) {
    if (!bestItem) {
      bestItem = item
      continue
    }

    const rarityDelta = openingRarityRank[item.rarity] - openingRarityRank[bestItem.rarity]
    const valueDelta = item.marketValue - bestItem.marketValue
    const timeDelta = item.discoveredAt - bestItem.discoveredAt

    if (rarityDelta > 0 || (rarityDelta === 0 && valueDelta > 0) || (rarityDelta === 0 && valueDelta === 0 && timeDelta > 0)) {
      bestItem = item
    }
  }

  return bestItem
}

function getAnimatedItems(items: SkinInstance[], primaryItem: SkinInstance) {
  if (items.length <= maxAnimatedBatchItems) {
    return items
  }

  const visibleItems = items.slice(0, maxAnimatedBatchItems)

  if (!visibleItems.some((item) => item.instanceId === primaryItem.instanceId)) {
    visibleItems[0] = primaryItem
  }

  return visibleItems
}

function pickWeightedSkin(options: WeightedSkinOption[]) {
  const fallback = options[0]?.skin
  const totalWeight = options.reduce((total, option) => total + Math.max(0, option.weight), 0)

  if (!fallback) {
    return undefined
  }

  if (totalWeight <= 0) {
    return fallback
  }

  let target = Math.random() * totalWeight

  for (const option of options) {
    target -= Math.max(0, option.weight)

    if (target <= 0) {
      return option.skin
    }
  }

  return fallback
}

function shuffleReelItems(items: ReelItem[]) {
  const shuffledItems = [...items]

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentItem = shuffledItems[index]
    const nextItem = shuffledItems[swapIndex]

    shuffledItems[index] = nextItem
    shuffledItems[swapIndex] = currentItem
  }

  return shuffledItems
}

function isGoldSuspenseDrop(item: Pick<SkinBase, 'rarity' | 'weapon'>) {
  if (item.rarity === Rarity.SpecialItem) {
    return true
  }

  const weaponName = item.weapon.toLowerCase()
  const goldWeaponTerms = [
    'knife',
    'bayonet',
    'karambit',
    'dagger',
    'glove',
    'gloves',
    'hand wrap',
    'hand wraps',
    'wraps',
  ]

  return goldWeaponTerms.some((term) => weaponName.includes(term))
}

function getGoldSuspenseSkin(finalItem: SkinBase): SkinBase {
  return {
    ...finalItem,
    id: `${finalItem.id}_gold_suspense`,
    weapon: 'Rare Special Item',
    finish: 'Mystery Drop',
    image: rareSpecialSuspenseImage,
  }
}

function buildReelItems(
  potentialSkins: WeightedSkinOption[],
  finalItem: SkinInstance,
  layout: ReelLayout,
  nearMissGold = false,
) {
  const safeOptions =
    potentialSkins.length > 0
      ? potentialSkins
      : [{ skin: finalItem, weight: 1 }]
  // Guard the reel contract in one place: future layout tweaks must always leave
  // enough cards before and after the final target for the whole transform path.
  const fillerCount = Math.max(layout.fillerCount, layout.targetIndex + layout.afterCount + 1)
  const fillerItems = Array.from({ length: fillerCount }, (_, index) => {
    const pickedSkin = pickWeightedSkin(safeOptions) ?? finalItem
    const skin = isGoldSuspenseDrop(pickedSkin) ? getGoldSuspenseSkin(pickedSkin) : pickedSkin

    return {
      isFinal: false,
      isSuspensePlaceholder: skin.id !== pickedSkin.id,
      key: `${skin.id}-${finalItem.instanceId}-${index}-${Math.random().toString(36).slice(2)}`,
      skin,
    }
  })
  const shuffledItems = shuffleReelItems(fillerItems)
  const beforeTarget = shuffledItems.slice(0, layout.targetIndex)
  const afterTarget = shuffledItems.slice(layout.targetIndex, layout.targetIndex + layout.afterCount)
  const finalSkin = isGoldSuspenseDrop(finalItem) ? getGoldSuspenseSkin(finalItem) : finalItem

  if (nearMissGold && beforeTarget.length > 0) {
    const suspenseSkin = getGoldSuspenseSkin(finalItem)

    beforeTarget[beforeTarget.length - 1] = {
      isFinal: false,
      isSuspensePlaceholder: true,
      key: `${finalItem.instanceId}-near-miss-gold`,
      skin: suspenseSkin,
    }
  }

  return [
    ...beforeTarget,
    {
      isFinal: true,
      isSuspensePlaceholder: finalSkin.id !== finalItem.id,
      key: `${finalItem.instanceId}-final`,
      skin: finalSkin,
    },
    ...afterTarget,
  ]
}

function getTrackTransform(isRolling: boolean, layout: ReelLayout) {
  const activeIndex = isRolling ? layout.targetIndex : layout.startIndex

  return `translate3d(-${activeIndex * layout.slotPitchRem}rem, 0, 0)`
}

function getTransitionDuration(phase: ReelPhase, rollDurationMs: number, quickDurationMs: number) {
  if (phase === 'spinning') {
    return `${rollDurationMs}ms`
  }

  if (phase === 'quickReveal') {
    return `${quickDurationMs}ms`
  }

  return '180ms'
}

function getGridStyle(batchSize: number) {
  if (batchSize > 25) {
    return {
      gridTemplateColumns: 'repeat(auto-fit, minmax(3.85rem, 1fr))',
    }
  }

  const columns = batchSize <= 2 ? 2 : batchSize === 3 ? 3 : batchSize <= 4 ? 2 : batchSize <= 6 ? 3 : batchSize <= 8 ? 4 : 5

  return {
    '--opening-columns': columns,
    '--opening-columns-sm': Math.min(2, columns),
  } as CSSProperties
}

export function CaseOpeningAnimation({
  caseImage = placeholderCaseImage,
  caseName = 'Case Opening',
  finalItem,
  finalItems,
  firstCaseHook,
  onComplete,
  potentialSkins,
  soundEnabled = false,
  speed = 'normal',
  speedBonus = 0,
  startSkipped = false,
}: CaseOpeningAnimationProps) {
  const timingMultiplier = Math.max(
    0.35,
    (speed === 'fast' ? 0.65 : 1) / (1 + Math.max(0, speedBonus)),
  )
  const rollStartMs = Math.round(audioRollStartMs * timingMultiplier)
  const revealAtMs = Math.round(audioRevealAtMs * timingMultiplier)
  const rollDurationMs = Math.round(normalRollDurationMs * timingMultiplier)
  const revealHoldMs = Math.round(normalRevealHoldMs * timingMultiplier)
  const quickDurationMs = Math.round(quickRevealDurationMs * timingMultiplier)
  const items = useMemo(
    () => finalItems && finalItems.length > 0 ? finalItems : [finalItem],
    [finalItem, finalItems],
  )
  const primaryItem = useMemo(() => getPrimaryItem(items) ?? finalItem, [finalItem, items])
  const animatedItems = useMemo(() => getAnimatedItems(items, primaryItem), [items, primaryItem])
  const batchSize = items.length
  const animatedBatchSize = animatedItems.length
  const hiddenBatchCount = batchSize - animatedBatchSize
  const layout = useMemo(() => getReelLayout(batchSize), [batchSize])
  const reels = useMemo<OpeningReel[]>(
    () => animatedItems.map((item) => ({
      item,
      reelItems: buildReelItems(
        potentialSkins,
        item,
        layout,
        firstCaseHook === 'nearMissGold' && item.instanceId === items[0]?.instanceId,
      ),
    })),
    [animatedItems, firstCaseHook, items, layout, potentialSkins],
  )
  const [phase, setPhase] = useState<ReelPhase>(() => (startSkipped ? 'quickReveal' : 'ready'))
  const [rollStarted, setRollStarted] = useState(startSkipped)
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined)
  const completedRef = useRef(false)
  const closedRef = useRef(false)
  const completeTimerRef = useRef<number | undefined>(undefined)
  const skipTimerRef = useRef<number | undefined>(undefined)
  const rollFrameRef = useRef<number | undefined>(undefined)
  const secondRollFrameRef = useRef<number | undefined>(undefined)
  const isPremiumBatch = useMemo(() => items.some(isPremiumRevealDrop), [items])
  const keepsResultsOpen = isPremiumBatch || batchSize > 1
  const totalValue = useMemo(() => items.reduce((total, item) => total + item.marketValue, 0), [items])
  const isRolling = rollStarted && (phase === 'spinning' || phase === 'quickReveal')
  const trackTransform = getTrackTransform(isRolling, layout)
  const transitionDuration = isRolling
    ? getTransitionDuration(phase, rollDurationMs, quickDurationMs)
    : '0ms'
  const transitionTimingFunction =
    phase === 'spinning' ? 'cubic-bezier(0.08, 0.72, 0.12, 1)' : 'cubic-bezier(0.2, 0.8, 0.2, 1)'

  const finishAnimation = useCallback(
    (holdMs: number) => {
      if (completedRef.current) {
        return
      }

      completedRef.current = true
      setPhase('revealed')
      stopCaseOpeningAudio(audioRef.current)
      if (!keepsResultsOpen) {
        completeTimerRef.current = window.setTimeout(() => {
          if (!closedRef.current) {
            closedRef.current = true
            onComplete(primaryItem)
          }
        }, holdMs)
      }
    },
    [keepsResultsOpen, onComplete, primaryItem, setPhase],
  )

  const cancelRollFrames = useCallback(() => {
    if (rollFrameRef.current) {
      window.cancelAnimationFrame(rollFrameRef.current)
      rollFrameRef.current = undefined
    }

    if (secondRollFrameRef.current) {
      window.cancelAnimationFrame(secondRollFrameRef.current)
      secondRollFrameRef.current = undefined
    }
  }, [])

  const startReelRoll = useCallback(() => {
    cancelRollFrames()
    setRollStarted(false)
    rollFrameRef.current = window.requestAnimationFrame(() => {
      secondRollFrameRef.current = window.requestAnimationFrame(() => {
        setRollStarted(true)
      })
    })
  }, [cancelRollFrames, setRollStarted])

  useEffect(() => {
    const timers: number[] = []

    completedRef.current = false
    closedRef.current = false
    audioRef.current = undefined
    cancelRollFrames()

    if (startSkipped) {
      timers.push(window.setTimeout(() => finishAnimation(0), quickDurationMs))
    } else {
      audioRef.current = playCaseOpeningAudio(soundEnabled)
      timers.push(window.setTimeout(() => {
        setPhase('spinning')
        startReelRoll()
      }, rollStartMs))
      timers.push(window.setTimeout(() => finishAnimation(revealHoldMs), revealAtMs))
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      cancelRollFrames()
      stopCaseOpeningAudio(audioRef.current)

      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current)
      }

      if (skipTimerRef.current) {
        window.clearTimeout(skipTimerRef.current)
      }
    }
  }, [cancelRollFrames, finishAnimation, quickDurationMs, revealAtMs, revealHoldMs, rollStartMs, soundEnabled, startReelRoll, startSkipped])

  function skipAnimation() {
    if (phase === 'revealed') {
      if (!closedRef.current) {
        closedRef.current = true
        onComplete(primaryItem)
      }

      return
    }

    if (completedRef.current) {
      return
    }

    if (isPremiumBatch) {
      setPhase('quickReveal')
      startReelRoll()
      skipTimerRef.current = window.setTimeout(() => finishAnimation(0), quickDurationMs)
      return
    }

    finishAnimation(0)
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/80 p-0 backdrop-blur-sm sm:p-4">
      <section
        aria-label="Case opening animation"
        aria-modal="true"
        className={[
          'relative w-full border border-cs-border bg-cs-surface p-3 text-cs-text shadow-glow sm:p-5',
          batchSize === 1 ? 'min-h-dvh sm:min-h-0 sm:max-w-5xl' : '',
          batchSize > 1 && batchSize <= 10 ? 'flex h-dvh max-h-dvh max-w-none flex-col overflow-hidden sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[120rem]' : '',
          batchSize > 10 ? 'min-h-dvh max-w-7xl sm:min-h-0' : '',
        ].join(' ')}
        data-batch-layout={batchSize === 1 ? 'single' : batchSize <= 3 ? 'showcase' : batchSize <= 6 ? 'grid' : batchSize <= 10 ? 'dashboard' : 'high-volume'}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase text-rarity-special">{caseName}</p>
            <h2 className="mt-1 text-xl font-semibold text-cs-text sm:text-3xl">
              Opening {batchSize.toLocaleString()}
            </h2>
            <p className="mt-2 font-mono text-xs uppercase text-cs-muted">
              {phase === 'ready' ? 'Unlocking' : phase === 'revealed' ? 'Revealed' : 'Rolling'} / {formatCurrency(totalValue)}
            </p>
          </div>
          <button
            aria-label="Skip opening animation"
            className="inline-flex min-h-11 items-center gap-2 border border-cs-border px-3 py-2 text-sm font-semibold text-cs-muted transition-colors hover:text-cs-text"
            onClick={skipAnimation}
            type="button"
          >
            {phase === 'revealed' ? <X size={16} /> : <FastForward size={16} />}
            {phase === 'revealed' ? 'Close' : 'Skip Animation'}
          </button>
        </div>

        <div className={batchSize > 1 && batchSize <= 10 ? 'mt-3 min-h-0 flex-1' : 'mt-5'} data-phase={phase} data-testid="case-opening-reel">
          {phase === 'ready' ? (
            <CasePreRollGrid
              batchSize={batchSize}
              caseImage={caseImage}
              caseName={caseName}
              hiddenItemCount={hiddenBatchCount}
              items={animatedItems}
            />
          ) : phase === 'revealed' ? (
            <RevealGrid hiddenItemCount={hiddenBatchCount} items={animatedItems} primaryItem={primaryItem} totalCount={batchSize} />
          ) : (
            <ReelGrid
              batchSize={batchSize}
              hiddenItemCount={hiddenBatchCount}
              layout={layout}
              reels={reels}
              trackTransform={trackTransform}
              transitionDuration={transitionDuration}
              transitionTimingFunction={transitionTimingFunction}
            />
          )}
        </div>

        <div
          className={[
            'relative overflow-hidden border bg-cs-panel transition-opacity',
            isPremiumBatch && phase === 'revealed' ? 'border-rarity-special shadow-[0_0_44px_rgba(255,215,0,0.4)]' : 'border-cs-border',
            batchSize > 1 && batchSize <= 10 ? 'mt-3 shrink-0 p-3' : 'mt-5 p-4',
            phase === 'revealed' || phase === 'quickReveal' ? 'opacity-100' : 'opacity-70',
          ].join(' ')}
          data-testid="opening-result"
        >
          {phase === 'revealed' ? (
            <div className={isPremiumBatch && batchSize === 1 ? 'grid gap-4 py-4 text-center' : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'}>
              <div className={isPremiumBatch && batchSize === 1 ? 'grid min-w-0 place-items-center gap-3' : 'flex min-w-0 items-center gap-3'}>
                <AssetImage
                  alt=""
                  className={isPremiumBatch && batchSize === 1 ? 'h-52 w-52 shrink-0 object-contain drop-shadow-2xl' : 'h-12 w-12 shrink-0 object-contain sm:h-16 sm:w-16'}
                  draggable={false}
                  src={primaryItem.image}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs uppercase text-cs-muted">
                      {getSkinRarityLabel(primaryItem)}
                    </span>
                  </div>
                  <h3 className="mt-1 truncate text-xl font-semibold text-cs-text">
                    {primaryItem.weapon} | {primaryItem.finish}
                  </h3>
                  <div className="mt-2"><PatternBadge compact item={primaryItem} /></div>
                </div>
              </div>
              <div className={isPremiumBatch ? 'shrink-0 font-mono text-lg font-semibold text-rarity-special' : 'shrink-0 font-mono text-lg font-semibold text-cs-green'}>
                {batchSize === 1 ? formatCurrency(primaryItem.marketValue) : formatCurrency(totalValue)}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center border border-cs-border bg-cs-panel">
                <PackageOpen aria-hidden="true" className="text-rarity-special" size={24} />
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-rarity-special">
                  {phase === 'ready' ? 'Unlocking case seals' : 'Rolling'}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-cs-text">
                  {phase === 'ready' ? 'Starting...' : 'Opening...'}
                </h3>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function CasePreRollGrid({
  batchSize,
  caseImage,
  caseName,
  hiddenItemCount,
  items,
}: {
  batchSize: number
  caseImage: string
  caseName: string
  hiddenItemCount: number
  items: SkinInstance[]
}) {
  if (batchSize === 1) {
    return (
      <div
        className="case-preroll-stage relative grid min-h-80 place-items-center overflow-hidden border border-cs-border bg-cs-bg p-6"
        data-testid="case-pre-roll-hero"
        style={{ '--case-accent': preRevealAccentColor } as CSSProperties}
      >
        <AssetImage
          alt=""
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 scale-150 object-contain opacity-25 blur-3xl"
          draggable={false}
          src={caseImage}
        />
        <div className="case-preroll-wash absolute inset-0" />
        <div className="case-preroll-scanline absolute inset-x-10 top-12 h-px bg-rarity-special/80 shadow-glow" />
        <div className="case-preroll-scanline absolute inset-x-16 bottom-12 h-px bg-rarity-special/60 shadow-glow" />
        <div className="case-preroll-ring absolute h-72 w-72 rounded-full border border-white/10" />
        <div className="case-preroll-case relative grid h-56 w-56 place-items-center border bg-cs-panel/95 shadow-glow">
          <AssetImage alt="" className="h-40 w-40 object-contain drop-shadow-2xl" draggable={false} src={caseImage} />
        </div>
        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-3 font-mono text-xs uppercase text-cs-muted">
          <span>{caseName}</span>
          <span>Seals priming</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className={[
          'grid gap-2 overflow-y-auto border border-cs-border bg-cs-bg p-3',
          batchSize > 25 ? 'max-h-[68vh]' : batchSize <= 10 ? 'opening-adaptive-grid h-full' : 'max-h-[62vh]',
        ].join(' ')}
        style={getGridStyle(batchSize)}
      >
        {items.map((item, index) => (
          <div
            className={[
              'case-preroll-cell relative grid place-items-center overflow-hidden border bg-cs-panel',
              batchSize > 25 ? 'aspect-square p-1' : batchSize <= 10 ? 'min-h-32 p-3 sm:min-h-0' : 'min-h-28 p-3',
              'border-rarity-special',
            ].join(' ')}
            data-testid="case-pre-roll-cell"
            key={item.instanceId}
            style={{ '--case-accent': preRevealAccentColor, animationDelay: `${(index % 16) * 34}ms` } as CSSProperties}
          >
            <AssetImage
              alt=""
              aria-hidden="true"
              className="absolute h-full w-full scale-150 object-contain opacity-15 blur-xl"
              draggable={false}
              src={caseImage}
            />
            <div className="case-preroll-wash absolute inset-0" />
            <div className="absolute inset-x-2 top-2 h-px bg-rarity-special/70 animate-pulse" />
            <AssetImage
              alt=""
              className={[
                'case-preroll-case object-contain',
                batchSize > 25 ? 'h-8 w-8' : batchSize <= 3 ? 'h-28 w-28' : batchSize <= 10 ? 'h-20 w-20' : 'h-14 w-14',
              ].join(' ')}
              draggable={false}
              src={caseImage}
            />
          </div>
        ))}
      </div>
      {hiddenItemCount > 0 ? <HiddenBatchBadge count={hiddenItemCount} /> : null}
    </div>
  )
}

function HiddenBatchBadge({ count }: { count: number }) {
  return (
    <div
      className="pointer-events-none absolute bottom-3 right-3 border border-cs-border bg-cs-bg/90 px-3 py-2 font-mono text-xs uppercase text-cs-muted shadow-glow"
      data-testid="hidden-batch-count"
    >
      +{count.toLocaleString()} more
    </div>
  )
}

function ReelGrid({
  batchSize,
  hiddenItemCount,
  layout,
  reels,
  trackTransform,
  transitionDuration,
  transitionTimingFunction,
}: {
  batchSize: number
  hiddenItemCount: number
  layout: ReelLayout
  reels: OpeningReel[]
  trackTransform: string
  transitionDuration: string
  transitionTimingFunction: string
}) {
  if (batchSize === 1) {
    const reel = reels[0]

    if (!reel) {
      return null
    }

    return (
      <div className="relative overflow-hidden border border-cs-border bg-cs-bg py-5">
        <div className="pointer-events-none absolute bottom-2 left-1/2 top-2 z-10 w-px -translate-x-1/2 bg-rarity-special shadow-glow" />
        <div
          className="roulette-track flex gap-3 will-change-transform"
          data-after-target-count={layout.afterCount}
          data-reel-length={reel.reelItems.length}
          data-start-offset-rem={layout.startIndex * layout.slotPitchRem}
          data-target-offset-rem={layout.targetIndex * layout.slotPitchRem}
          data-testid="roulette-track"
          style={{
            minWidth: 'max-content',
            paddingLeft: `calc(50% - ${layout.cardWidthRem / 2}rem)`,
            transform: trackTransform,
            transitionDuration,
            transitionProperty: 'transform',
            transitionTimingFunction,
            width: 'max-content',
          }}
        >
          {reel.reelItems.map((item) => (
            <ReelCard item={item} key={item.key} layout={layout} variant="single" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className={[
          'grid gap-2 overflow-y-auto border border-cs-border bg-cs-bg p-3',
          batchSize > 25 ? 'max-h-[68vh]' : batchSize <= 10 ? 'opening-adaptive-grid h-full' : 'max-h-[62vh]',
        ].join(' ')}
        style={getGridStyle(batchSize)}
      >
        {reels.map((reel) => (
          <div
            className={[
              'case-opening-cell relative overflow-hidden border bg-cs-panel',
              batchSize > 25 ? 'aspect-square' : batchSize <= 10 ? 'min-h-36 sm:min-h-0' : 'h-28',
              'border-cs-border',
            ].join(' ')}
            key={reel.item.instanceId}
          >
            <div className="pointer-events-none absolute bottom-1 left-1/2 top-1 z-10 w-px -translate-x-1/2 bg-rarity-special/80" />
            <div
              className="roulette-track flex h-full items-stretch gap-2 will-change-transform"
              data-after-target-count={layout.afterCount}
              data-reel-length={reel.reelItems.length}
              data-start-offset-rem={layout.startIndex * layout.slotPitchRem}
              data-target-offset-rem={layout.targetIndex * layout.slotPitchRem}
              data-testid="roulette-track"
              style={{
                minWidth: 'max-content',
                paddingLeft: `calc(50% - ${layout.cardWidthRem / 2}rem)`,
                transform: trackTransform,
                transitionDuration,
                transitionProperty: 'transform',
                transitionTimingFunction,
                width: 'max-content',
              }}
            >
              {reel.reelItems.map((item) => (
                <ReelCard
                  item={item}
                  key={item.key}
                  layout={layout}
                  variant={batchSize > 25 ? 'mega' : batchSize <= 10 ? 'large' : 'compact'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {hiddenItemCount > 0 ? <HiddenBatchBadge count={hiddenItemCount} /> : null}
    </div>
  )
}

function RevealGrid({
  hiddenItemCount,
  items,
  primaryItem,
  totalCount,
}: {
  hiddenItemCount: number
  items: SkinInstance[]
  primaryItem: SkinInstance
  totalCount: number
}) {
  if (totalCount === 1) {
    return (
      <div className="grid min-h-64 place-items-center border border-cs-border bg-cs-bg p-6">
        <AssetImage alt="" className="h-44 w-44 object-contain" draggable={false} src={primaryItem.image} />
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className={[
          'grid gap-2 overflow-y-auto border border-cs-border bg-cs-bg p-3',
          totalCount > 25 ? 'max-h-[68vh]' : totalCount <= 10 ? 'opening-adaptive-grid h-full' : 'max-h-[62vh]',
        ].join(' ')}
        style={getGridStyle(totalCount)}
      >
        {items.map((item, index) => {
          return (
            <article
              className={[
                'case-opening-cell grid overflow-hidden border border-cs-border bg-cs-panel cascade-reveal',
                totalCount > 25 ? 'aspect-square place-items-center p-1' : totalCount <= 10 ? 'min-h-36 grid-rows-[1fr_auto] p-3 sm:min-h-0' : 'min-h-28 grid-rows-[1fr_auto] p-2',
              ].join(' ')}
              data-testid="case-reveal-cell"
              key={item.instanceId}
              style={{ animationDelay: `${Math.min(index, 40) * 18}ms` }}
            >
              <AssetImage
                alt=""
                className={totalCount > 25 ? 'h-8 w-8 object-contain' : totalCount <= 3 ? 'mx-auto h-32 w-32 object-contain' : totalCount <= 10 ? 'mx-auto h-20 w-20 object-contain' : 'mx-auto h-12 w-12 object-contain'}
                draggable={false}
                src={item.image}
              />
              {totalCount <= 25 ? (
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-cs-text">
                    {item.weapon} | {item.finish}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-cs-green">
                    {formatCurrency(item.marketValue)}
                  </p>
                  <div className="mt-1"><PatternBadge compact item={item} /></div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      {hiddenItemCount > 0 ? <HiddenBatchBadge count={hiddenItemCount} /> : null}
    </div>
  )
}

function playCaseOpeningAudio(enabled: boolean) {
  if (!enabled || typeof Audio === 'undefined') {
    return undefined
  }

  try {
    const audio = new Audio(CASE_OPENING_SOUND_SRC)

    audio.currentTime = 0
    audio.preload = 'auto'
    audio.volume = 0.9

    const playResult = audio.play()

    if (playResult && typeof playResult.catch === 'function') {
      void playResult.catch(() => undefined)
    }

    return audio
  } catch {
    return undefined
  }
}

function stopCaseOpeningAudio(audio: HTMLAudioElement | undefined) {
  if (!audio) {
    return
  }

  audio.pause()
  audio.currentTime = 0
}

const ReelCard = memo(function ReelCard({
  item,
  layout,
  variant,
}: {
  item: ReelItem
  layout: ReelLayout
  variant: 'compact' | 'large' | 'mega' | 'single'
}) {
  const isGoldSuspense = item.isSuspensePlaceholder
  const rarityColor = isGoldSuspense ? 'rgb(var(--rarity-covert))' : getSkinRarityColor(item.skin)

  return (
    <article
      className={[
        'grid shrink-0 border bg-cs-panel p-2',
        variant === 'single' ? 'h-36 grid-rows-[1fr_auto]' : '',
        variant === 'compact' ? 'h-full grid-rows-[1fr_auto]' : '',
        variant === 'large' ? 'h-full grid-rows-[1fr_auto]' : '',
        variant === 'mega' ? 'h-full place-items-center' : '',
        isGoldSuspense ? 'border-rarity-covert bg-cs-bg' : '',
      ].join(' ')}
      data-testid={item.isFinal ? 'case-opening-target' : undefined}
      style={{ borderColor: rarityColor, width: `${layout.cardWidthRem}rem` }}
    >
      <div className="grid place-items-center">
        {isGoldSuspense ? (
          <AssetImage
            alt=""
            className={[
              'object-contain drop-shadow-2xl',
              variant === 'mega' ? 'h-8 w-8' : variant === 'large' ? 'h-28 w-28' : 'h-20 w-20',
            ].join(' ')}
            draggable={false}
            data-testid="gold-suspense-placeholder"
            src={item.skin.image}
          />
        ) : (
          <AssetImage
            alt=""
            className={variant === 'mega' ? 'h-7 w-7 object-contain' : variant === 'large' ? 'h-24 w-24 object-contain' : 'h-16 w-16 object-contain'}
            draggable={false}
            src={item.skin.image}
          />
        )}
      </div>
      {variant !== 'mega' ? (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-cs-text">
            {item.skin.weapon} | {item.skin.finish}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] uppercase" style={{ color: rarityColor }}>
            {getSkinRarityLabel(item.skin)}
          </p>
        </div>
      ) : null}
    </article>
  )
})
