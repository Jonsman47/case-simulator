import { useEffect, useMemo, useState } from 'react'
import { AssetImage } from '../components/AssetImage'
import { BatchOpenSummaryModal } from '../components/BatchOpenSummaryModal'
import { CaseOpeningAnimation } from '../components/CaseOpeningAnimation'
import { CaseOpenControls, type CaseOpenOptions } from '../components/CaseOpenControls'
import { ItemDetailModal } from '../components/ItemDetailModal'
import { PlaceholderView } from '../components/PlaceholderView'
import { PoopCleanupMinigame } from '../components/PoopCleanupMinigame'
import { RecentDropsFeed } from '../components/RecentDropsFeed'
import { SKIN_DEFINITIONS } from '../data/skins'
import type { SkinInstance } from '../data/models'
import { getSkillMinigameRewardMultiplier } from '../data/skills'
import { getMaxMultiOpenBatch } from '../data/upgrades'
import { useGame } from '../hooks/useGame'
import { canOpenCaseFromSelection } from '../utils/caseSelection'
import { getLatestCaseOpeningSummary } from '../utils/caseOpeningSummary'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import {
  formatPoopCleanupCooldown,
  getPoopCleanupCooldownRemaining,
  POOP_CLEANUP_REWARD,
  readPoopCleanupLastCompleted,
  writePoopCleanupLastCompleted,
} from '../utils/poopCleanupMinigame'
import {
  getPotentialSkinOptions,
  selectOpeningAnimationItem,
  shouldPlayOpeningAnimation,
} from '../utils/openingAnimation'

const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

export function Main() {
  const {
    assignTrophyItem,
    availableCases,
    dispatch,
    openCase,
    sellItem,
    state,
    toggleItemFavorite,
    toggleItemLock,
  } = useGame()
  const [activeItem, setActiveItem] = useState<SkinInstance | undefined>(undefined)
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const [summaryOptions, setSummaryOptions] = useState<CaseOpenOptions | undefined>()
  const [dismissedSummaryEventId, setDismissedSummaryEventId] = useState<string | undefined>()
  const [completedAnimationEventId, setCompletedAnimationEventId] = useState<string | undefined>()
  const [isMinigameOpen, setIsMinigameOpen] = useState(false)
  const [minigameNow, setMinigameNow] = useState(() => Date.now())
  const [lastMinigameCompletedAt, setLastMinigameCompletedAt] = useState(() => readPoopCleanupLastCompleted())
  const openableCases = useMemo(() => {
    const cases = availableCases.filter((caseDef) => canOpenCaseFromSelection(caseDef, state))

    return [...cases].sort((left, right) => {
      const leftFavorite = state.favoriteCaseIds.includes(left.id) ? 0 : 1
      const rightFavorite = state.favoriteCaseIds.includes(right.id) ? 0 : 1

      return leftFavorite - rightFavorite || left.cost - right.cost || left.name.localeCompare(right.name)
    })
  }, [availableCases, state])
  const selectedCase = useMemo(() => {
    return openableCases.find((caseDef) => caseDef.id === selectedCaseId) ?? openableCases[0]
  }, [openableCases, selectedCaseId])
  const modalItem = useMemo(() => {
    if (!activeItem) {
      return undefined
    }

    return state.inventory.find((item) => item.instanceId === activeItem.instanceId) ?? activeItem
  }, [activeItem, state.inventory])
  const modalItemIsOwned = modalItem
    ? state.inventory.some((item) => item.instanceId === modalItem.instanceId)
    : false
  const activeItemSaleValue = useMemo(() => {
    if (!modalItem) {
      return undefined
    }

    return getCurrentItemMarketValue(modalItem, state.marketValues)
  }, [modalItem, state.marketValues])
  const latestOpeningSummary = getLatestCaseOpeningSummary(state)
  const summaryCase = latestOpeningSummary
    ? availableCases.find((caseDef) => caseDef.id === latestOpeningSummary.startedEvent.caseId)
    : undefined
  const shouldAnimateOpening =
    summaryOptions !== undefined &&
    latestOpeningSummary !== undefined &&
    shouldPlayOpeningAnimation(
      state.lastOpenedItems,
      state.settings.animationsEnabled && !state.settings.simplifiedAnimations,
      summaryOptions.skipAnimations || state.settings.animationSpeed === 'skip',
    )
  const openingAnimationItem =
    shouldAnimateOpening &&
    latestOpeningSummary &&
    latestOpeningSummary.startedEvent.id !== completedAnimationEventId
      ? selectOpeningAnimationItem(state.lastOpenedItems, summaryOptions?.skipAnimations ?? false)
      : undefined
  const openingAnimationItems = openingAnimationItem ? state.lastOpenedItems : []
  const openingPotentialSkins = useMemo(() => {
    return getPotentialSkinOptions(summaryCase, skinsById)
  }, [summaryCase])
  const showBatchSummary =
    summaryOptions !== undefined &&
    latestOpeningSummary !== undefined &&
    latestOpeningSummary.startedEvent.quantity > 1 &&
    latestOpeningSummary.startedEvent.id !== dismissedSummaryEventId &&
    (!shouldAnimateOpening || latestOpeningSummary.startedEvent.id === completedAnimationEventId)
  const minigameCooldownRemaining = getPoopCleanupCooldownRemaining(minigameNow, lastMinigameCompletedAt)
  const canPlayMinigame = minigameCooldownRemaining <= 0
  const poopCleanupReward = useMemo(() => {
    return Number((POOP_CLEANUP_REWARD * getSkillMinigameRewardMultiplier(state.learnedSkillNodeIds)).toFixed(2))
  }, [state.learnedSkillNodeIds])

  useEffect(() => {
    if (minigameCooldownRemaining <= 0) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setMinigameNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [minigameCooldownRemaining])

  function handleOpenSelectedCase(quantity: number, options: CaseOpenOptions) {
    if (!selectedCase) {
      return
    }

    setSummaryOptions(options)
    setDismissedSummaryEventId(undefined)
    setCompletedAnimationEventId(undefined)
    openCase(selectedCase.id, quantity)
  }

  function handleStartMinigame() {
    setMinigameNow(Date.now())

    if (getPoopCleanupCooldownRemaining(Date.now(), lastMinigameCompletedAt) > 0) {
      return
    }

    setIsMinigameOpen(true)
  }

  function handleCompleteMinigame() {
    const completedAt = Date.now()

    writePoopCleanupLastCompleted(completedAt)
    setLastMinigameCompletedAt(completedAt)
    setMinigameNow(completedAt)
    setIsMinigameOpen(false)
    dispatch({
      type: 'COMPLETE_POOP_CLEANUP_MINIGAME',
      reward: poopCleanupReward,
      now: completedAt,
    })
  }

  return (
    <PlaceholderView accent="special" title="Main">
      <div className="grid gap-5 xl:grid-cols-[14rem_1fr]">
        <div className="border border-cs-border bg-cs-surface p-4">
          <div className="grid min-h-44 place-items-center border border-cs-border bg-cs-panel">
            <AssetImage alt="" className="h-32 w-32 object-contain" src={selectedCase?.image} />
          </div>
          <div className="mt-4">
            <label className="block text-sm text-cs-muted">
              Active Case
              <select
                className="mt-2 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
                disabled={openableCases.length === 0}
                onChange={(event) => setSelectedCaseId(event.target.value)}
                value={selectedCase?.id ?? ''}
              >
                {openableCases.map((caseDef) => (
                  <option key={caseDef.id} value={caseDef.id}>
                    {caseDef.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedCase ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="border border-cs-border bg-cs-panel px-3 py-2">
                  <p className="font-mono text-[10px] uppercase text-cs-muted">Cost</p>
                  <p className="mt-1 font-semibold text-cs-text">{formatCurrency(selectedCase.cost)}</p>
                </div>
                <div className="border border-cs-border bg-cs-panel px-3 py-2">
                  <p className="font-mono text-[10px] uppercase text-cs-muted">Drop Odds</p>
                  <p className="mt-1 font-semibold text-rarity-special">By rarity</p>
                </div>
              </div>
            ) : null}
            {selectedCase ? (
              <div className="mt-4" data-onboarding-target="open-case-controls">
                <CaseOpenControls
                  canOpen={canOpenCaseFromSelection(selectedCase, state)}
                  caseDef={selectedCase}
                  maxQuantity={getMaxMultiOpenBatch(state.upgrades, state.learnedSkillNodeIds)}
                  money={state.money}
                  onOpen={handleOpenSelectedCase}
                />
              </div>
            ) : (
              <p className="mt-4 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted">
                No openable cases
              </p>
            )}

            <div className="mt-4 border border-cs-border bg-cs-panel p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase text-cs-muted">Side Job</p>
                  <p className="mt-1 text-sm font-semibold text-cs-text">A Clean Pooping Job</p>
                </div>
                <span className="font-mono text-xs text-cs-green">
                  +{formatCurrency(poopCleanupReward)}
                </span>
              </div>
              <button
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center border border-cs-green bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green transition-colors hover:bg-cs-green/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted disabled:opacity-60"
                disabled={!canPlayMinigame}
                onClick={handleStartMinigame}
                title={!canPlayMinigame ? `Available in ${formatPoopCleanupCooldown(minigameCooldownRemaining)}` : undefined}
                type="button"
              >
                {canPlayMinigame
                  ? 'Start Job'
                  : `Cooldown ${formatPoopCleanupCooldown(minigameCooldownRemaining)}`}
              </button>
            </div>
          </div>
        </div>
        <RecentDropsFeed
          animateHighlights={state.settings.recentDropFeedAnimationsEnabled && !state.settings.simplifiedAnimations}
          drops={state.recentDrops}
          inventory={state.inventory}
          marketValues={state.marketValues}
          onOpenItem={setActiveItem}
        />
      </div>

      <ItemDetailModal
        isOwned={modalItemIsOwned}
        item={modalItem}
        items={state.inventory}
        onClose={() => setActiveItem(undefined)}
        onItemChange={setActiveItem}
        onAddToTrophyRoom={(itemId, slotId) => assignTrophyItem(slotId, itemId)}
        onSell={sellItem}
        onToggleFavorite={toggleItemFavorite}
        onToggleLock={toggleItemLock}
        marketHistory={state.marketHistory}
        saleValue={activeItemSaleValue}
      />

      {openingAnimationItem && latestOpeningSummary && summaryOptions ? (
        <CaseOpeningAnimation
          caseImage={summaryCase?.image}
          caseName={summaryCase?.name ?? latestOpeningSummary.startedEvent.caseId}
          finalItem={openingAnimationItem}
          finalItems={openingAnimationItems}
          key={latestOpeningSummary.startedEvent.id}
          onComplete={() => setCompletedAnimationEventId(latestOpeningSummary.startedEvent.id)}
          potentialSkins={openingPotentialSkins}
          soundEnabled={state.settings.soundEnabled}
          speed={state.settings.animationSpeed}
          startSkipped={summaryOptions.skipAnimations || state.settings.animationSpeed === 'skip'}
        />
      ) : null}

      {showBatchSummary && latestOpeningSummary && summaryOptions ? (
        <BatchOpenSummaryModal
          autoSoldItems={latestOpeningSummary.autoSoldEvent?.items ?? []}
          caseName={summaryCase?.name ?? latestOpeningSummary.startedEvent.caseId}
          items={state.lastOpenedItems}
          onClose={() => setDismissedSummaryEventId(latestOpeningSummary.startedEvent.id)}
          openedCount={latestOpeningSummary.startedEvent.quantity}
          saleValue={latestOpeningSummary.autoSoldEvent?.salePrice ?? 0}
          skipAnimations={summaryOptions.skipAnimations}
        />
      ) : null}

      {isMinigameOpen ? (
        <PoopCleanupMinigame
          onClose={() => setIsMinigameOpen(false)}
          onComplete={handleCompleteMinigame}
        />
      ) : null}
    </PlaceholderView>
  )
}
