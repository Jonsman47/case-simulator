import { ArrowLeft, ArrowRight, BookOpen, Boxes, CheckCircle2, CircleDollarSign, Compass, Gem, ShoppingCart, Sparkles, Store, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { OnboardingStepId, OnboardingTipId } from '../data/gameState'
import { useGame } from '../hooks/useGame'

interface TutorialStep {
  body: string
  clickHint: string
  icon: typeof Compass
  id: OnboardingStepId
  path: string
  targetId: string
  title: string
}

interface ContextTip {
  body: string
  id: OnboardingTipId
  path: string
  title: string
}

const tutorialSteps: TutorialStep[] = [
  {
    body: 'Cases contain a random skin. Select a case, check its price and drop odds, then choose Open 1. The displayed price is deducted once when the opening begins.',
    clickHint: 'Select a case, then press Open 1.',
    icon: ShoppingCart,
    id: 'open_case',
    path: '/',
    targetId: 'open-case-controls',
    title: 'Open Your First Case',
  },
  {
    body: 'Blue drops are common; purple, pink, red, knives, and gloves are increasingly rare. Wear and float describe condition. Some finishes also have valuable Pattern IDs.',
    clickHint: 'Read the odds and item details before opening.',
    icon: Gem,
    id: 'understand_drops',
    path: '/',
    targetId: 'open-case-controls',
    title: 'Know What Can Drop',
  },
  {
    body: 'Every kept reward goes to Inventory. Use filters and sorting to find valuable wears, low floats, StatTrak items, and special patterns.',
    clickHint: 'Open Inventory and select a skin card.',
    icon: Boxes,
    id: 'view_inventory',
    path: '/inventory',
    targetId: 'inventory-filters',
    title: 'Check Your Inventory',
  },
  {
    body: 'Selling turns a skin into game money. Lock or favorite anything important first; protected items are excluded from automatic selling.',
    clickHint: 'Select an item to view Sell, Lock, and Favorite.',
    icon: CircleDollarSign,
    id: 'sell_item',
    path: '/inventory',
    targetId: 'inventory-grid',
    title: 'Sell Or Protect Drops',
  },
  {
    body: 'Market prices vary by wear, edition, and pattern. Click a skin to compare condition prices and explore supported Pattern IDs before deciding what to sell.',
    clickHint: 'Open Market and click any skin row.',
    icon: Store,
    id: 'check_market',
    path: '/market',
    targetId: 'market-catalog',
    title: 'Check Market Prices',
  },
  {
    body: 'The Collection Book records discoveries even after an item is sold. Completing sets and wear variants builds long-term progress.',
    clickHint: 'Open Collection to review discovered skins.',
    icon: BookOpen,
    id: 'build_collection',
    path: '/collection-book',
    targetId: 'collection-book',
    title: 'Build Your Collection',
  },
  {
    body: 'Work provides early cash. Upgrades, skills, prestige, and automation improve your run later, but each purchase should fit your current budget.',
    clickHint: 'Try a Work job, then explore Upgrades and Automation.',
    icon: Sparkles,
    id: 'earn_and_upgrade',
    path: '/work',
    targetId: 'work-jobs',
    title: 'Earn And Progress',
  },
  {
    body: 'Auto-sell can clear low-value drops after openings. Start conservatively, protect favorites, and preview the rule simulation before enabling it.',
    clickHint: 'In Settings, add an Auto-Sell rule only when ready.',
    icon: Compass,
    id: 'enable_auto_sell',
    path: '/settings',
    targetId: 'auto-sell-rules',
    title: 'Enable Auto-Sell',
  },
]

function getStepIndex(stepId: OnboardingStepId | undefined) {
  const index = tutorialSteps.findIndex((step) => step.id === stepId)

  return index >= 0 ? index : 0
}

function getStepProgressLabel(stepId: OnboardingStepId, state: ReturnType<typeof useGame>['state']) {
  if (stepId === 'open_case') {
    return state.statistics.casesOpened > 0 ? 'First case opened' : 'Waiting for first open'
  }

  if (stepId === 'understand_drops') return 'Odds and prices are visible before opening'
  if (stepId === 'view_inventory') {
    return state.inventory.length > 0 ? `${state.inventory.length} items stored` : 'Inventory is ready'
  }

  if (stepId === 'sell_item') {
    return state.statistics.itemsSold > 0 ? 'Sale recorded' : 'No manual sales yet'
  }

  if (stepId === 'check_market') return `${Object.keys(state.marketValues).length.toLocaleString()} prices tracked`
  if (stepId === 'build_collection') return `${state.collectionBook.length.toLocaleString()} discoveries recorded`
  if (stepId === 'earn_and_upgrade') return `${state.statistics.workJobsCompleted} Work jobs completed`
  return state.autoSellRules.some((rule) => rule.enabled) ? 'Auto-sell active' : 'No active rules yet'
}

function getContextTips(state: ReturnType<typeof useGame>['state']): ContextTip[] {
  const tips: ContextTip[] = []

  if (state.statistics.drops > 0) {
    tips.push({
      body: 'Every discovered skin is tracked forever, even after selling. Check completion rewards when a set starts filling in.',
      id: 'collection_book_after_drop',
      path: '/collection-book',
      title: 'Collection Book Unlocked',
    })
  }

  if (state.inventory.length >= 10) {
    tips.push({
      body: 'You have enough inventory depth to start trying 10-item contracts. Check the outcomes, then decide how much risk feels worth it.',
      id: 'trade_up_ready',
      path: '/trade-ups',
      title: 'Trade-Ups Are Relevant',
    })
  }

  if (state.inventory.length >= 3 && state.autoSellRules.length === 0) {
    tips.push({
      body: 'Low-value duplicates can be cleared automatically. Start with a conservative value rule and protect favorites.',
      id: 'auto_sell_ready',
      path: '/settings',
      title: 'Auto-Sell Can Save Clicks',
    })
  }

  return tips
}

function useTargetRect(targetId: string, isActive: boolean) {
  const [rect, setRect] = useState<DOMRect | undefined>(undefined)

  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    let animationFrame = 0
    const requestFrame = window.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(callback, 0))
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout

    function updateRect() {
      const target = document.querySelector<HTMLElement>(`[data-onboarding-target="${targetId}"]`)

      setRect(target?.getBoundingClientRect())
    }

    function queueUpdate() {
      cancelFrame(animationFrame)
      animationFrame = requestFrame(updateRect)
    }

    queueUpdate()
    window.addEventListener('resize', queueUpdate)
    window.addEventListener('scroll', queueUpdate, true)

    return () => {
      cancelFrame(animationFrame)
      window.removeEventListener('resize', queueUpdate)
      window.removeEventListener('scroll', queueUpdate, true)
    }
  }, [isActive, targetId])

  return isActive ? rect : undefined
}

export function OnboardingTutorial() {
  const { state, updateOnboardingState } = useGame()
  const navigate = useNavigate()
  const location = useLocation()
  const onboarding = state.ui.onboarding
  const activeStepIndex = getStepIndex(onboarding.activeStepId)
  const activeStep = tutorialSteps[activeStepIndex]
  const isTutorialOpen = !onboarding.isDismissed || onboarding.isReviewing
  const isOnStepPath = location.pathname === activeStep.path
  const highlightRect = useTargetRect(activeStep.targetId, isTutorialOpen && isOnStepPath)
  const completedStepIds = useMemo(
    () => new Set(onboarding.completedStepIds),
    [onboarding.completedStepIds],
  )
  const dismissedTipIds = useMemo(
    () => new Set(onboarding.dismissedTipIds),
    [onboarding.dismissedTipIds],
  )
  const activeTip = useMemo(() => {
    if (isTutorialOpen) {
      return undefined
    }

    return getContextTips(state).find((tip) => !dismissedTipIds.has(tip.id))
  }, [dismissedTipIds, isTutorialOpen, state])

  function setStep(stepIndex: number) {
    updateOnboardingState({
      activeStepId: tutorialSteps[Math.min(Math.max(stepIndex, 0), tutorialSteps.length - 1)].id,
      isDismissed: false,
      isReviewing: true,
    })
  }

  function completeCurrentStep() {
    const nextCompletedStepIds = Array.from(new Set([...onboarding.completedStepIds, activeStep.id]))
    const nextStepIndex = activeStepIndex + 1

    if (nextStepIndex >= tutorialSteps.length) {
      updateOnboardingState({
        activeStepId: activeStep.id,
        completedStepIds: nextCompletedStepIds,
        isDismissed: true,
        isReviewing: false,
      })
      return
    }

    updateOnboardingState({
      activeStepId: tutorialSteps[nextStepIndex].id,
      completedStepIds: nextCompletedStepIds,
      isDismissed: false,
      isReviewing: true,
    })
  }

  function skipTutorial() {
    updateOnboardingState({
      isDismissed: true,
      isReviewing: false,
    })
  }

  function dismissTip(tipId: OnboardingTipId) {
    updateOnboardingState({
      dismissedTipIds: Array.from(new Set([...onboarding.dismissedTipIds, tipId])),
    })
  }

  if (isTutorialOpen) {
    const StepIcon = activeStep.icon
    return (
      <>
        <div aria-hidden="true" className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-[1px]" />
        {highlightRect ? (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[60] border-2 border-rarity-special bg-rarity-special/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.24),0_0_28px_rgba(255,215,0,0.25)]"
            style={{
              height: Math.max(0, highlightRect.height + 14),
              left: Math.max(8, highlightRect.left - 7),
              top: Math.max(8, highlightRect.top - 7),
              width: Math.max(0, highlightRect.width + 14),
            }}
          />
        ) : null}
        <aside
          aria-label="Onboarding tutorial"
          className="fixed inset-x-3 bottom-3 z-[70] max-h-[calc(100dvh-1.5rem)] overflow-y-auto border border-rarity-special bg-cs-surface p-4 shadow-glow sm:inset-x-auto sm:right-5 sm:w-[28rem]"
          data-testid="onboarding-tutorial"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special"><StepIcon size={21} /></span>
              <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase text-rarity-special">
                Step {activeStepIndex + 1} / {tutorialSteps.length}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-cs-text">{activeStep.title}</h2>
              </div>
            </div>
            <button
              aria-label="Skip tutorial"
              className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
              onClick={skipTutorial}
              type="button"
            >
              <X size={17} />
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-cs-muted">{activeStep.body}</p>
          <div className="mt-3 border-l-2 border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-cs-text">
            What to do: {activeStep.clickHint}
          </div>
          <div className="mt-3 flex items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-xs text-cs-muted">
            {completedStepIds.has(activeStep.id) ? (
              <CheckCircle2 className="text-cs-green" size={15} />
            ) : (
              <Compass className="text-rarity-special" size={15} />
            )}
            <span>{getStepProgressLabel(activeStep.id, state)}</span>
          </div>
          <div aria-label="Tutorial progress" className="mt-4 grid grid-cols-8 gap-1">
            {tutorialSteps.map((step, index) => <span className={`h-1.5 ${index <= activeStepIndex ? 'bg-rarity-special' : 'bg-cs-border'}`} key={step.id} />)}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button
                className="min-h-10 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-40"
                disabled={activeStepIndex === 0}
                onClick={() => setStep(activeStepIndex - 1)}
                type="button"
              >
                <ArrowLeft size={15} />
                Back
              </button>
              <button
                className="min-h-10 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text"
                onClick={skipTutorial}
                type="button"
              >
                Skip
              </button>
            </div>
            <div className="flex gap-2">
              {!isOnStepPath ? (
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
                  onClick={() => navigate(activeStep.path)}
                  type="button"
                >
                  Go There
                  <ArrowRight size={16} />
                </button>
              ) : null}
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
                onClick={completeCurrentStep}
                type="button"
              >
                {activeStepIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </aside>
      </>
    )
  }

  if (!activeTip) {
    return null
  }

  return (
    <aside
      aria-label={activeTip.title}
      className="pointer-events-none fixed bottom-3 left-3 z-50 w-[min(24rem,calc(100vw-1.5rem))] border border-cs-border bg-cs-surface p-4 shadow-glow"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-rarity-special">Tip</p>
          <h2 className="mt-1 text-base font-semibold text-cs-text">{activeTip.title}</h2>
        </div>
        <button
          aria-label={`Dismiss ${activeTip.title}`}
          className="pointer-events-auto grid h-9 w-9 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
          onClick={() => dismissTip(activeTip.id)}
          type="button"
        >
          <X size={17} />
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-cs-muted">{activeTip.body}</p>
      <button
        className="pointer-events-auto mt-3 inline-flex min-h-10 items-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
        onClick={() => {
          dismissTip(activeTip.id)
          navigate(activeTip.path)
        }}
        type="button"
      >
        Open
        <ArrowRight size={16} />
      </button>
    </aside>
  )
}
